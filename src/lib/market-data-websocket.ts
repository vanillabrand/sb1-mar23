import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { cacheService } from './cache-service';
import { websocketManager } from './websocket-manager';
import { eventBus } from './event-bus';
import { demoService } from './demo-service';

/**
 * Market data update from WebSocket
 */
export interface MarketDataUpdate {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  change24h?: number;
  timestamp: number;
  source: string;
}

/**
 * Market data subscription options
 */
export interface MarketDataSubscriptionOptions {
  priority?: 'high' | 'normal' | 'low';
  updateCallback?: (update: MarketDataUpdate) => void;
  errorCallback?: (error: any) => void;
}

/**
 * WebSocket-based market data service
 * Provides real-time market data updates via WebSockets
 */
class MarketDataWebSocket extends EventEmitter {
  private static instance: MarketDataWebSocket;
  private connections: Map<string, string> = new Map(); // Map of exchange ID to connection ID
  private subscriptions: Map<string, Set<string>> = new Map(); // Map of symbol to set of subscription IDs
  private symbolToExchange: Map<string, string> = new Map(); // Map of symbol to exchange ID
  private updateCallbacks: Map<string, ((update: MarketDataUpdate) => void)[]> = new Map(); // Map of symbol to callbacks
  private errorCallbacks: Map<string, ((error: any) => void)[]> = new Map(); // Map of symbol to callbacks
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map(); // Map of connection ID to reconnect timer
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly MARKET_DATA_CACHE_NAMESPACE = 'market_data';
  private readonly TICKER_CACHE_TTL = 60 * 1000; // 1 minute

  // Configuration
  private readonly HEALTH_CHECK_INTERVAL = 30 * 1000; // 30 seconds
  private readonly RECONNECT_INTERVAL = 5 * 1000; // 5 seconds
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly CONNECTION_TIMEOUT = 10 * 1000; // 10 seconds

  private constructor() {
    super();
    this.setupEventListeners();
    this.startHealthCheck();
  }

  static getInstance(): MarketDataWebSocket {
    if (!MarketDataWebSocket.instance) {
      MarketDataWebSocket.instance = new MarketDataWebSocket();
    }
    return MarketDataWebSocket.instance;
  }

  /**
   * Set up event listeners for WebSocket events
   */
  private setupEventListeners(): void {
    // Listen for WebSocket messages
    websocketManager.on('message', ({ connectionId, message }) => {
      this.handleWebSocketMessage(connectionId, message);
    });

    // Listen for WebSocket connection events
    websocketManager.on('connected', ({ connectionId }) => {
      logService.log('info', `WebSocket connection established: ${connectionId}`, null, 'MarketDataWebSocket');
      this.resubscribeSymbols(connectionId);
    });

    websocketManager.on('disconnected', ({ connectionId }) => {
      logService.log('warn', `WebSocket connection lost: ${connectionId}`, null, 'MarketDataWebSocket');
    });

    websocketManager.on('error', ({ connectionId, error }) => {
      logService.log('error', `WebSocket error: ${connectionId}`, error, 'MarketDataWebSocket');
    });

    websocketManager.on('reconnectFailed', ({ connectionId }) => {
      logService.log('error', `WebSocket reconnection failed: ${connectionId}`, null, 'MarketDataWebSocket');
      this.handleReconnectFailure(connectionId);
    });
  }

  /**
   * Start the health check interval
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.checkConnectionHealth();
    }, this.HEALTH_CHECK_INTERVAL);

    logService.log('info', `Started market data WebSocket health check (interval: ${this.HEALTH_CHECK_INTERVAL}ms)`, null, 'MarketDataWebSocket');
  }

  /**
   * Check the health of all WebSocket connections
   */
  private checkConnectionHealth(): void {
    for (const [exchangeId, connectionId] of this.connections.entries()) {
      const state = websocketManager.getState(connectionId);

      if (!state || !state.isConnected) {
        logService.log('warn', `WebSocket connection for ${exchangeId} is not connected`, null, 'MarketDataWebSocket');
        this.reconnectExchange(exchangeId);
      } else {
        // Check last message time
        const now = Date.now();
        const messageAge = now - state.lastMessageTime;

        // If we haven't received a message in 2 minutes, reconnect
        if (messageAge > 2 * 60 * 1000) {
          logService.log('warn', `WebSocket connection for ${exchangeId} is stale (no messages for ${Math.round(messageAge / 1000)}s)`, null, 'MarketDataWebSocket');
          this.reconnectExchange(exchangeId);
        }
      }
    }
  }

  /**
   * Reconnect to an exchange WebSocket
   * @param exchangeId Exchange ID
   */
  private reconnectExchange(exchangeId: string): void {
    const connectionId = this.connections.get(exchangeId);
    if (!connectionId) return;

    // Reconnect the WebSocket
    websocketManager.reconnect(connectionId);

    logService.log('info', `Reconnecting WebSocket for ${exchangeId}`, null, 'MarketDataWebSocket');
  }

  /**
   * Handle WebSocket reconnect failure
   * @param connectionId Connection ID
   */
  private handleReconnectFailure(connectionId: string): void {
    // Find the exchange ID for this connection
    let exchangeId: string | undefined;
    for (const [exId, connId] of this.connections.entries()) {
      if (connId === connectionId) {
        exchangeId = exId;
        break;
      }
    }

    if (!exchangeId) return;

    // Schedule a manual reconnect
    if (this.reconnectTimers.has(connectionId)) {
      clearTimeout(this.reconnectTimers.get(connectionId)!);
    }

    this.reconnectTimers.set(connectionId, setTimeout(() => {
      logService.log('info', `Attempting manual reconnect for ${exchangeId}`, null, 'MarketDataWebSocket');
      this.initializeExchangeWebSocket(exchangeId);
    }, this.RECONNECT_INTERVAL));
  }

  /**
   * Initialize a WebSocket connection for an exchange
   * @param exchangeId Exchange ID
   * @returns Promise that resolves to the connection ID
   */
  async initializeExchangeWebSocket(exchangeId: string): Promise<string> {
    try {
      // Close any existing connection
      this.closeExchangeWebSocket(exchangeId);

      // Get WebSocket URL for the exchange
      const wsUrl = this.getWebSocketUrlForExchange(exchangeId);

      if (!wsUrl) {
        throw new Error(`No WebSocket URL found for exchange ${exchangeId}`);
      }

      // Create WebSocket connection
      const connectionId = websocketManager.createConnection({
        url: wsUrl,
        name: `market-data-${exchangeId}-${Date.now()}`,
        reconnectInterval: this.RECONNECT_INTERVAL,
        maxReconnectAttempts: this.MAX_RECONNECT_ATTEMPTS,
        connectionTimeout: this.CONNECTION_TIMEOUT,
        heartbeatInterval: 30000,
        heartbeatMessage: this.getHeartbeatMessageForExchange(exchangeId)
      });

      // Store the connection ID
      this.connections.set(exchangeId, connectionId);

      logService.log('info', `Initialized WebSocket connection for ${exchangeId}`, {
        connectionId,
        url: wsUrl
      }, 'MarketDataWebSocket');

      return connectionId;
    } catch (error) {
      logService.log('error', `Failed to initialize WebSocket for ${exchangeId}`, error, 'MarketDataWebSocket');
      throw error;
    }
  }

  /**
   * Close a WebSocket connection for an exchange
   * @param exchangeId Exchange ID
   */
  closeExchangeWebSocket(exchangeId: string): void {
    const connectionId = this.connections.get(exchangeId);
    if (!connectionId) return;

    // Close the WebSocket connection
    websocketManager.close(connectionId);

    // Remove from connections map
    this.connections.delete(exchangeId);

    // Clear any reconnect timer
    if (this.reconnectTimers.has(connectionId)) {
      clearTimeout(this.reconnectTimers.get(connectionId)!);
      this.reconnectTimers.delete(connectionId);
    }

    logService.log('info', `Closed WebSocket connection for ${exchangeId}`, null, 'MarketDataWebSocket');
  }

  /**
   * Get the WebSocket URL for an exchange
   * @param exchangeId Exchange ID
   * @returns WebSocket URL or empty string if not found
   */
  private getWebSocketUrlForExchange(exchangeId: string): string {
    // Check if we're in demo mode
    const isDemo = demoService.isDemoMode();

    if (isDemo) {
      // Use Binance TestNet WebSocket URL for demo mode
      return 'wss://testnet.binance.vision/ws';
    }

    // For real mode, use the appropriate WebSocket URL for each exchange
    switch (exchangeId) {
      case 'binance':
        return 'wss://stream.binance.com:9443/ws';
      case 'bitmart':
        return 'wss://ws-manager-compress.bitmart.com/api?protocol=1.1';
      case 'kucoin':
        // KuCoin requires a token from the REST API, which we can't get here
        // This would need to be handled separately
        return '';
      default:
        // For other exchanges, use a proxy WebSocket
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const proxyPort = 3001; // Default proxy port
        return `${wsProtocol}//${window.location.hostname}:${proxyPort}/ws/${exchangeId}`;
    }
  }

  /**
   * Get the heartbeat message for an exchange
   * @param exchangeId Exchange ID
   * @returns Heartbeat message or undefined
   */
  private getHeartbeatMessageForExchange(exchangeId: string): any {
    switch (exchangeId) {
      case 'binance':
        return { method: 'ping' };
      case 'bitmart':
        return { op: 'ping' };
      default:
        return { type: 'ping', timestamp: Date.now() };
    }
  }

  /**
   * Subscribe to market data for a symbol
   * @param symbol Trading pair symbol (e.g., 'BTC/USDT')
   * @param options Subscription options
   * @returns Promise that resolves to the subscription ID
   */
  async subscribeToMarketData(symbol: string, options: MarketDataSubscriptionOptions = {}): Promise<string> {
    try {
      // Normalize the symbol format
      const normalizedSymbol = this.normalizeSymbol(symbol);

      // Determine the best exchange for this symbol
      const exchangeId = this.getBestExchangeForSymbol(normalizedSymbol);

      // Map the symbol to the exchange
      this.symbolToExchange.set(normalizedSymbol, exchangeId);

      // Initialize the exchange WebSocket if needed
      let connectionId = this.connections.get(exchangeId);
      if (!connectionId) {
        connectionId = await this.initializeExchangeWebSocket(exchangeId);
      }

      // Generate a unique subscription ID
      const subscriptionId = `${normalizedSymbol}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Add to subscriptions map
      if (!this.subscriptions.has(normalizedSymbol)) {
        this.subscriptions.set(normalizedSymbol, new Set());
      }
      this.subscriptions.get(normalizedSymbol)!.add(subscriptionId);

      // Add callbacks if provided
      if (options.updateCallback) {
        if (!this.updateCallbacks.has(normalizedSymbol)) {
          this.updateCallbacks.set(normalizedSymbol, []);
        }
        this.updateCallbacks.get(normalizedSymbol)!.push(options.updateCallback);
      }

      if (options.errorCallback) {
        if (!this.errorCallbacks.has(normalizedSymbol)) {
          this.errorCallbacks.set(normalizedSymbol, []);
        }
        this.errorCallbacks.get(normalizedSymbol)!.push(options.errorCallback);
      }

      // Send subscription message to the WebSocket
      const subscriptionMessage = this.getSubscriptionMessageForExchange(exchangeId, normalizedSymbol, options.priority || 'normal');
      websocketManager.send(connectionId, subscriptionMessage);

      logService.log('info', `Subscribed to market data for ${normalizedSymbol} on ${exchangeId}`, {
        connectionId,
        subscriptionId,
        priority: options.priority || 'normal'
      }, 'MarketDataWebSocket');

      // Emit subscription event
      this.emit('subscribed', { symbol: normalizedSymbol, subscriptionId, exchangeId });
      eventBus.emit('marketData:subscribed', { symbol: normalizedSymbol, subscriptionId, exchangeId });

      return subscriptionId;
    } catch (error) {
      logService.log('error', `Failed to subscribe to market data for ${symbol}`, error, 'MarketDataWebSocket');
      throw error;
    }
  }

  /**
   * Unsubscribe from market data for a symbol
   * @param subscriptionId Subscription ID
   * @returns True if unsubscribed successfully, false otherwise
   */
  unsubscribeFromMarketData(subscriptionId: string): boolean {
    try {
      // Find the symbol for this subscription ID
      let symbolToRemove: string | undefined;
      let subscriptionSet: Set<string> | undefined;

      for (const [symbol, subs] of this.subscriptions.entries()) {
        if (subs.has(subscriptionId)) {
          symbolToRemove = symbol;
          subscriptionSet = subs;
          break;
        }
      }

      if (!symbolToRemove || !subscriptionSet) {
        logService.log('warn', `Subscription ${subscriptionId} not found`, null, 'MarketDataWebSocket');
        return false;
      }

      // Remove the subscription
      subscriptionSet.delete(subscriptionId);

      // If no more subscriptions for this symbol, unsubscribe from the WebSocket
      if (subscriptionSet.size === 0) {
        const exchangeId = this.symbolToExchange.get(symbolToRemove);
        if (exchangeId) {
          const connectionId = this.connections.get(exchangeId);
          if (connectionId) {
            // Send unsubscribe message
            const unsubscribeMessage = this.getUnsubscribeMessageForExchange(exchangeId, symbolToRemove);
            websocketManager.send(connectionId, unsubscribeMessage);
          }
        }

        // Remove from maps
        this.subscriptions.delete(symbolToRemove);
        this.symbolToExchange.delete(symbolToRemove);
        this.updateCallbacks.delete(symbolToRemove);
        this.errorCallbacks.delete(symbolToRemove);
      }

      logService.log('info', `Unsubscribed from market data for ${symbolToRemove} (${subscriptionId})`, null, 'MarketDataWebSocket');

      // Emit unsubscribe event
      this.emit('unsubscribed', { symbol: symbolToRemove, subscriptionId });
      eventBus.emit('marketData:unsubscribed', { symbol: symbolToRemove, subscriptionId });

      return true;
    } catch (error) {
      logService.log('error', `Failed to unsubscribe from market data`, error, 'MarketDataWebSocket');
      return false;
    }
  }

  /**
   * Batch subscribe to market data for multiple symbols
   * @param symbols Array of trading pair symbols
   * @param options Subscription options
   * @returns Promise that resolves to an array of subscription IDs
   */
  async batchSubscribeToMarketData(symbols: string[], options: MarketDataSubscriptionOptions = {}): Promise<string[]> {
    if (!symbols || symbols.length === 0) {
      return [];
    }

    try {
      // Group symbols by exchange
      const symbolsByExchange = new Map<string, string[]>();

      for (const symbol of symbols) {
        const normalizedSymbol = this.normalizeSymbol(symbol);
        const exchangeId = this.getBestExchangeForSymbol(normalizedSymbol);

        if (!symbolsByExchange.has(exchangeId)) {
          symbolsByExchange.set(exchangeId, []);
        }

        symbolsByExchange.get(exchangeId)!.push(normalizedSymbol);
      }

      // Subscribe to each group of symbols
      const subscriptionPromises: Promise<string>[] = [];

      for (const [exchangeId, exchangeSymbols] of symbolsByExchange.entries()) {
        // Initialize the exchange WebSocket if needed
        let connectionId = this.connections.get(exchangeId);
        if (!connectionId) {
          connectionId = await this.initializeExchangeWebSocket(exchangeId);
        }

        // Subscribe to each symbol
        for (const symbol of exchangeSymbols) {
          subscriptionPromises.push(this.subscribeToMarketData(symbol, options));
        }
      }

      // Wait for all subscriptions to complete
      const subscriptionIds = await Promise.all(subscriptionPromises);

      logService.log('info', `Batch subscribed to market data for ${symbols.length} symbols`, null, 'MarketDataWebSocket');

      return subscriptionIds;
    } catch (error) {
      logService.log('error', `Failed to batch subscribe to market data`, error, 'MarketDataWebSocket');
      throw error;
    }
  }

  /**
   * Resubscribe to all symbols for a connection
   * @param connectionId Connection ID
   */
  private resubscribeSymbols(connectionId: string): void {
    // Find the exchange ID for this connection
    let exchangeId: string | undefined;
    for (const [exId, connId] of this.connections.entries()) {
      if (connId === connectionId) {
        exchangeId = exId;
        break;
      }
    }

    if (!exchangeId) return;

    // Find all symbols for this exchange
    const symbols: string[] = [];
    for (const [symbol, exId] of this.symbolToExchange.entries()) {
      if (exId === exchangeId) {
        symbols.push(symbol);
      }
    }

    if (symbols.length === 0) return;

    logService.log('info', `Resubscribing to ${symbols.length} symbols for ${exchangeId}`, null, 'MarketDataWebSocket');

    // Resubscribe to each symbol
    for (const symbol of symbols) {
      const subscriptionMessage = this.getSubscriptionMessageForExchange(exchangeId, symbol, 'normal');
      websocketManager.send(connectionId, subscriptionMessage);
    }
  }

  /**
   * Handle a WebSocket message
   * @param connectionId Connection ID
   * @param message Message received
   */
  private handleWebSocketMessage(connectionId: string, message: any): void {
    try {
      // Find the exchange ID for this connection
      let exchangeId: string | undefined;
      for (const [exId, connId] of this.connections.entries()) {
        if (connId === connectionId) {
          exchangeId = exId;
          break;
        }
      }

      if (!exchangeId) return;

      // Parse the message based on the exchange
      const update = this.parseMessageForExchange(exchangeId, message);

      if (!update) return;

      // Cache the update
      const cacheKey = `ticker:${update.symbol}`;
      cacheService.set(cacheKey, update, this.MARKET_DATA_CACHE_NAMESPACE, this.TICKER_CACHE_TTL);

      // Call update callbacks
      const callbacks = this.updateCallbacks.get(update.symbol);
      if (callbacks) {
        for (const callback of callbacks) {
          try {
            callback(update);
          } catch (callbackError) {
            logService.log('error', `Error in market data update callback for ${update.symbol}`, callbackError, 'MarketDataWebSocket');
          }
        }
      }

      // Emit update event
      this.emit('update', update);
      eventBus.emit('marketData:update', update);

      // Also emit a specific event for this symbol
      this.emit(`update:${update.symbol}`, update);
      eventBus.emit(`marketData:update:${update.symbol}`, update);
    } catch (error) {
      logService.log('error', `Failed to handle WebSocket message`, error, 'MarketDataWebSocket');
    }
  }

  /**
   * Get the best exchange for a symbol
   * @param symbol Trading pair symbol
   * @returns Exchange ID
   */
  private getBestExchangeForSymbol(symbol: string): string {
    // In a real implementation, this would consider factors like:
    // - Which exchanges support this symbol
    // - Exchange liquidity for this symbol
    // - Exchange reliability
    // - User preferences

    // For now, we'll use a simple mapping
    if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT')) {
      return 'binance';
    } else if (symbol.includes('BNB')) {
      return 'binance';
    } else {
      return 'bitmart';
    }
  }

  /**
   * Normalize a symbol to a standard format
   * @param symbol Trading pair symbol
   * @returns Normalized symbol
   */
  private normalizeSymbol(symbol: string): string {
    // Convert to uppercase
    let normalized = symbol.toUpperCase();

    // Ensure consistent separator
    if (normalized.includes('_')) {
      normalized = normalized.replace('_', '/');
    }

    return normalized;
  }

  /**
   * Get the subscription message for an exchange
   * @param exchangeId Exchange ID
   * @param symbol Trading pair symbol
   * @param priority Subscription priority
   * @returns Subscription message
   */
  private getSubscriptionMessageForExchange(exchangeId: string, symbol: string, priority: string): any {
    switch (exchangeId) {
      case 'binance':
        // Binance uses lowercase symbols with no separator
        const binanceSymbol = symbol.replace('/', '').toLowerCase();
        return {
          method: 'SUBSCRIBE',
          params: [`${binanceSymbol}@ticker`],
          id: Date.now()
        };
      case 'bitmart':
        // BitMart uses uppercase symbols with underscore separator
        const bitmartSymbol = symbol.replace('/', '_');
        return {
          op: 'subscribe',
          args: [`spot/ticker:${bitmartSymbol}`]
        };
      default:
        // Generic format
        return {
          type: 'subscribe',
          channel: 'ticker',
          symbol,
          priority
        };
    }
  }

  /**
   * Get the unsubscribe message for an exchange
   * @param exchangeId Exchange ID
   * @param symbol Trading pair symbol
   * @returns Unsubscribe message
   */
  private getUnsubscribeMessageForExchange(exchangeId: string, symbol: string): any {
    switch (exchangeId) {
      case 'binance':
        // Binance uses lowercase symbols with no separator
        const binanceSymbol = symbol.replace('/', '').toLowerCase();
        return {
          method: 'UNSUBSCRIBE',
          params: [`${binanceSymbol}@ticker`],
          id: Date.now()
        };
      case 'bitmart':
        // BitMart uses uppercase symbols with underscore separator
        const bitmartSymbol = symbol.replace('/', '_');
        return {
          op: 'unsubscribe',
          args: [`spot/ticker:${bitmartSymbol}`]
        };
      default:
        // Generic format
        return {
          type: 'unsubscribe',
          channel: 'ticker',
          symbol
        };
    }
  }

  /**
   * Parse a WebSocket message for an exchange
   * @param exchangeId Exchange ID
   * @param message WebSocket message
   * @returns Market data update or undefined if not a market data message
   */
  private parseMessageForExchange(exchangeId: string, message: any): MarketDataUpdate | undefined {
    if (!message) {
      logService.log('warn', `Received empty message from ${exchangeId}`, null, 'MarketDataWebSocket');
      return undefined;
    }

    try {
      switch (exchangeId) {
        case 'binance':
          return this.parseBinanceMessage(message);
        case 'bitmart':
          return this.parseBitmartMessage(message);
        default:
          return this.parseGenericMessage(message);
      }
    } catch (error) {
      logService.log('error', `Failed to parse WebSocket message for ${exchangeId}`, {
        error,
        message: typeof message === 'object' ? JSON.stringify(message) : message
      }, 'MarketDataWebSocket');
    }

    return undefined;
  }

  /**
   * Parse a Binance WebSocket message
   * @param message Binance WebSocket message
   * @returns Market data update or undefined if not a market data message
   */
  private parseBinanceMessage(message: any): MarketDataUpdate | undefined {
    try {
      // Check if this is a ticker message
      if (message.e === '24hrTicker') {
        // Extract the symbol parts
        let baseAsset, quoteAsset;

        // Handle different symbol formats
        if (message.s.endsWith('USDT')) {
          baseAsset = message.s.slice(0, -4);
          quoteAsset = 'USDT';
        } else if (message.s.endsWith('BTC')) {
          baseAsset = message.s.slice(0, -3);
          quoteAsset = 'BTC';
        } else if (message.s.endsWith('ETH')) {
          baseAsset = message.s.slice(0, -3);
          quoteAsset = 'ETH';
        } else if (message.s.endsWith('BUSD')) {
          baseAsset = message.s.slice(0, -4);
          quoteAsset = 'BUSD';
        } else {
          // Default case - try to split at 3 or 4 characters from the end
          baseAsset = message.s.slice(0, -4);
          quoteAsset = message.s.slice(-4);
        }

        const symbol = `${baseAsset}/${quoteAsset}`;

        // Safely parse numeric values with fallbacks
        const safeParseFloat = (value: string | number | undefined, fallback: number = 0): number => {
          if (value === undefined || value === null) return fallback;
          const parsed = parseFloat(String(value));
          return isNaN(parsed) ? fallback : parsed;
        };

        return {
          symbol,
          price: safeParseFloat(message.c),
          bid: safeParseFloat(message.b),
          ask: safeParseFloat(message.a),
          high24h: safeParseFloat(message.h),
          low24h: safeParseFloat(message.l),
          volume24h: safeParseFloat(message.v),
          change24h: safeParseFloat(message.P),
          timestamp: message.E || Date.now(),
          source: 'binance'
        };
      }

      // Handle other Binance message types if needed
      // For example, trade messages, depth updates, etc.

    } catch (error) {
      logService.log('error', 'Failed to parse Binance message', {
        error,
        message: typeof message === 'object' ? JSON.stringify(message) : message
      }, 'MarketDataWebSocket');
    }

    return undefined;
  }

  /**
   * Parse a BitMart WebSocket message
   * @param message BitMart WebSocket message
   * @returns Market data update or undefined if not a market data message
   */
  private parseBitmartMessage(message: any): MarketDataUpdate | undefined {
    try {
      // Check if this is a ticker message
      if (message.data && message.table === 'spot/ticker') {
        // Ensure we have data
        if (!Array.isArray(message.data) || message.data.length === 0) {
          return undefined;
        }

        const tickerData = message.data[0];
        if (!tickerData || !tickerData.symbol) {
          return undefined;
        }

        // Normalize the symbol
        const symbol = tickerData.symbol.replace(/_/g, '/');

        // Safely parse numeric values with fallbacks
        const safeParseFloat = (value: string | number | undefined, fallback: number = 0): number => {
          if (value === undefined || value === null) return fallback;
          const parsed = parseFloat(String(value));
          return isNaN(parsed) ? fallback : parsed;
        };

        return {
          symbol,
          price: safeParseFloat(tickerData.last_price),
          bid: safeParseFloat(tickerData.best_bid),
          ask: safeParseFloat(tickerData.best_ask),
          high24h: safeParseFloat(tickerData.high_24h),
          low24h: safeParseFloat(tickerData.low_24h),
          volume24h: safeParseFloat(tickerData.base_volume_24h),
          change24h: safeParseFloat(tickerData.change_24h),
          timestamp: tickerData.timestamp || Date.now(),
          source: 'bitmart'
        };
      }

      // Handle other BitMart message types if needed

    } catch (error) {
      logService.log('error', 'Failed to parse BitMart message', {
        error,
        message: typeof message === 'object' ? JSON.stringify(message) : message
      }, 'MarketDataWebSocket');
    }

    return undefined;
  }

  /**
   * Parse a generic WebSocket message
   * @param message Generic WebSocket message
   * @returns Market data update or undefined if not a market data message
   */
  private parseGenericMessage(message: any): MarketDataUpdate | undefined {
    try {
      // Check if this is a ticker message
      if (message.type === 'ticker' && message.symbol) {
        // Safely parse numeric values with fallbacks
        const safeParseFloat = (value: string | number | undefined, fallback: number = 0): number => {
          if (value === undefined || value === null) return fallback;
          const parsed = parseFloat(String(value));
          return isNaN(parsed) ? fallback : parsed;
        };

        return {
          symbol: message.symbol,
          price: safeParseFloat(message.price || message.last_price),
          bid: safeParseFloat(message.bid),
          ask: safeParseFloat(message.ask),
          high24h: safeParseFloat(message.high_24h),
          low24h: safeParseFloat(message.low_24h),
          volume24h: safeParseFloat(message.volume_24h),
          change24h: safeParseFloat(message.change_24h),
          timestamp: message.timestamp || Date.now(),
          source: message.source || 'generic'
        };
      }

      // Handle other generic message types if needed

    } catch (error) {
      logService.log('error', 'Failed to parse generic message', {
        error,
        message: typeof message === 'object' ? JSON.stringify(message) : message
      }, 'MarketDataWebSocket');
    }

    return undefined;
  }

  /**
   * Get the latest market data for a symbol
   * @param symbol Trading pair symbol
   * @returns Latest market data or undefined if not available
   */
  getLatestMarketData(symbol: string): MarketDataUpdate | undefined {
    try {
      // Normalize the symbol
      const normalizedSymbol = this.normalizeSymbol(symbol);

      // Try to get from cache
      const cacheKey = `ticker:${normalizedSymbol}`;
      return cacheService.get<MarketDataUpdate>(cacheKey, this.MARKET_DATA_CACHE_NAMESPACE);
    } catch (error) {
      logService.log('error', `Failed to get latest market data for ${symbol}`, error, 'MarketDataWebSocket');
      return undefined;
    }
  }

  /**
   * Close all WebSocket connections
   */
  closeAllConnections(): void {
    for (const [exchangeId, connectionId] of this.connections.entries()) {
      websocketManager.close(connectionId);
      logService.log('info', `Closed WebSocket connection for ${exchangeId}`, null, 'MarketDataWebSocket');
    }

    // Clear maps
    this.connections.clear();
    this.subscriptions.clear();
    this.symbolToExchange.clear();
    this.updateCallbacks.clear();
    this.errorCallbacks.clear();

    // Clear reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    logService.log('info', 'Closed all WebSocket connections', null, 'MarketDataWebSocket');
  }
}

export const marketDataWebSocket = MarketDataWebSocket.getInstance();
