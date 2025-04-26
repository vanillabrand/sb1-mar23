import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { demoService } from './demo-service';
import { configService } from './config-service';
import { config } from './config';
import { supabase } from './supabase';
import ReconnectingWebSocket from 'reconnecting-websocket';
// Define WebSocket types locally since they're not in the main types file
interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface WebSocketConfig {
  url?: string;
  subscriptions?: string[];
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: any) => void;
  onMessage?: (message: any) => void;
}

export class WebSocketService extends EventEmitter {
  private static instance: WebSocketService;
  private socket: ReconnectingWebSocket | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly MAX_RECONNECT_ATTEMPTS = 10; // Increased from 5 to 10
  // RECONNECT_INTERVAL is used in the ReconnectingWebSocket config
  private readonly MESSAGE_QUEUE_SIZE = 1000;
  private readonly PING_INTERVAL = 30000; // 30 seconds

  private isPageVisible: boolean = true;
  private visibilityChangeHandler: () => void;

  private constructor() {
    super();

    // Set up visibility change handler
    this.visibilityChangeHandler = this.handleVisibilityChange.bind(this);

    // Add event listener for visibility change
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    }
  }

  /**
   * Handle visibility change events to manage WebSocket connection
   */
  private handleVisibilityChange(): void {
    if (typeof document === 'undefined') return;

    const isVisible = document.visibilityState === 'visible';

    if (isVisible && !this.isPageVisible) {
      // Page became visible again
      logService.log('info', 'Page became visible, checking WebSocket connection', null, 'WebSocketService');

      // Check if the connection is still alive
      if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
        logService.log('warn', 'WebSocket not open after visibility change, reconnecting...', null, 'WebSocketService');
        this.reconnect();
      } else {
        // Send a ping to verify the connection
        this.send({
          type: 'ping',
          timestamp: Date.now(),
          isVisibilityCheck: true
        }).catch(() => {
          logService.log('warn', 'Failed to send ping after visibility change, reconnecting...', null, 'WebSocketService');
          this.reconnect();
        });
      }
    }

    this.isPageVisible = isVisible;
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private getWebSocketUrl(): string {
    // Check if we're in demo mode
    const isDemo = demoService.isDemoMode();

    if (isDemo) {
      // Use Binance TestNet WebSocket URL directly for demo mode
      const binanceTestnetWsUrl = 'wss://testnet.binancefuture.com/ws-fapi/v1';
      logService.log('info', `Using Binance TestNet WebSocket URL: ${binanceTestnetWsUrl}`, null, 'WebSocketService');
      return binanceTestnetWsUrl;
    }

    // For non-demo mode, use the proxy server
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Try to find an available port starting from 3001
    let proxyPort = 3001;
    // Check if we have a stored port from a previous connection
    const storedPort = localStorage.getItem('proxyPort');
    if (storedPort) {
      proxyPort = parseInt(storedPort, 10);
    }

    // Use window.location.hostname instead of hardcoded localhost
    const proxyHost = `${window.location.hostname}:${proxyPort}`;
    const demoParam = '';

    // Use the proxy server WebSocket endpoint
    const wsUrl = `${wsProtocol}//${proxyHost}/ws${demoParam}`;

    logService.log('info', `Using WebSocket URL through proxy: ${wsUrl}`, null, 'WebSocketService');
    return wsUrl;
  }

  async connect(config: WebSocketConfig): Promise<void> {
    try {
      if (this.socket) {
        await this.disconnect();
      }

      // Use secure WebSocket if on HTTPS
      const wsUrl = config.url || this.getWebSocketUrl();

      this.socket = new ReconnectingWebSocket(wsUrl, [], {
        WebSocket: WebSocket,
        connectionTimeout: 10000, // Increase timeout to 10 seconds
        maxRetries: this.MAX_RECONNECT_ATTEMPTS,
        maxReconnectionDelay: 10000,
        minReconnectionDelay: 1000,
        // Add debug logging
        debug: true, // Always enable debug logging
      });

      // Store the URL for future reference
      // Store the port regardless of hostname
      const portMatch = wsUrl.match(/:([0-9]+)\/ws/);
      if (portMatch && portMatch[1]) {
        localStorage.setItem('proxyPort', portMatch[1]);
      }

      this.setupEventListeners();
      await this.waitForConnection();

      // Start the ping interval
      this.startPingInterval();

      if (config.subscriptions) {
        await this.subscribe(config.subscriptions);
      }

      logService.log('info', 'WebSocket connected',
        { url: wsUrl }, 'WebSocketService');
    } catch (error) {
      logService.log('error', 'Failed to establish WebSocket connection',
        error, 'WebSocketService');

      // Try a different port if connection fails
      if (!config.url) {
        const storedPort = localStorage.getItem('proxyPort');
        if (storedPort) {
          const currentPort = parseInt(storedPort, 10);
          const nextPort = currentPort + 1;
          localStorage.setItem('proxyPort', nextPort.toString());
          logService.log('info', `Trying next port: ${nextPort}`, null, 'WebSocketService');

          // Try to reconnect with the new port
          return this.connect(config);
        }
      }

      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.addEventListener('open', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      this.processMessageQueue();
    });

    this.socket.addEventListener('close', () => {
      this.isConnected = false;
      this.emit('disconnected');
      this.handleDisconnection();
    });

    this.socket.addEventListener('error', (error) => {
      logService.log('error', 'WebSocket error', error, 'WebSocketService');
      this.emit('error', error);
    });

    this.socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        logService.log('debug', 'WebSocket message received', message, 'WebSocketService');

        // Emit the message to all listeners
        this.emit('message', message);

        // Handle ping/pong messages
        if (message.type === 'ping') {
          // Respond with a pong message
          this.send({
            type: 'pong',
            timestamp: Date.now(),
            echo: message.timestamp
          }).catch(error => {
            logService.log('error', 'Failed to send pong message', error, 'WebSocketService');
          });
        } else if (message.type === 'pong') {
          // Update the last pong received timestamp
          this.lastPongReceived = Date.now();

          // Calculate round-trip time
          const rtt = Date.now() - (message.echo || 0);
          logService.log('debug', 'WebSocket pong received', { rtt }, 'WebSocketService');
        }

        // Handle Binance TestNet data
        else if (message.type === 'binance_data' || message.type === 'binance_market_data') {
          this.handleBinanceData(message.data);
        }

        // Also emit based on message type
        if (message.type) {
          this.emit(message.type, message.data);
        }
      } catch (error) {
        logService.log('error', 'Failed to parse WebSocket message',
          error, 'WebSocketService');
      }
    });
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        // Instead of rejecting, we'll resolve with a warning
        logService.log('warn', 'WebSocket connection timeout, continuing anyway', null, 'WebSocketService');
        resolve(); // Resolve instead of reject to allow the application to continue
      }, 10000);

      const handleConnection = () => {
        clearTimeout(timeout);
        this.socket?.removeEventListener('open', handleConnection);
        resolve();
      };

      if (this.socket.readyState === WebSocket.OPEN) {
        handleConnection();
      } else {
        this.socket.addEventListener('open', handleConnection);
      }
    });
  }

  private async subscribe(subscriptions: string[]): Promise<void> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    try {
      const subscribeMessage = {
        type: 'subscribe',
        channels: subscriptions
      };

      await this.send(subscribeMessage);
      logService.log('info', 'Subscribed to WebSocket channels',
        { channels: subscriptions }, 'WebSocketService');
    } catch (error) {
      logService.log('error', 'Failed to subscribe to WebSocket channels',
        error, 'WebSocketService');
      throw error;
    }
  }

  async send(message: WebSocketMessage): Promise<void> {
    if (!this.isConnected) {
      if (this.messageQueue.length >= this.MESSAGE_QUEUE_SIZE) {
        this.messageQueue.shift();
      }
      this.messageQueue.push(message);
      return;
    }

    try {
      this.socket?.send(JSON.stringify(message));
    } catch (error) {
      logService.log('error', 'Failed to send WebSocket message',
        error, 'WebSocketService');
      throw error;
    }
  }

  private async processMessageQueue(): Promise<void> {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        await this.send(message);
      }
    }
  }

  private handleDisconnection(): void {
    this.reconnectAttempts++;
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logService.log('error', 'Max WebSocket reconnection attempts reached',
        null, 'WebSocketService');
      this.emit('maxReconnectAttemptsReached');

      // Reset reconnect attempts to allow future reconnection attempts
      setTimeout(() => {
        this.reconnectAttempts = 0;
        logService.log('info', 'Reset WebSocket reconnection attempts counter', null, 'WebSocketService');
      }, 60000); // Wait 1 minute before resetting
    }
  }

  /**
   * Force a reconnection of the WebSocket
   */
  async reconnect(): Promise<void> {
    logService.log('info', 'Forcing WebSocket reconnection', null, 'WebSocketService');

    // Disconnect first
    await this.disconnect();

    // Small delay to ensure clean disconnection
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reconnect
    try {
      await this.connect({});
      logService.log('info', 'WebSocket reconnected successfully', null, 'WebSocketService');
    } catch (error) {
      logService.log('error', 'Failed to reconnect WebSocket', error, 'WebSocketService');

      // Try again after a delay if not at max attempts
      if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        logService.log('info', `Will try to reconnect again in 5 seconds (attempt ${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`, null, 'WebSocketService');
        setTimeout(() => this.reconnect(), 5000);
      }
    }
  }

  async disconnect(): Promise<void> {
    // Stop the ping interval
    this.stopPingInterval();

    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
      this.messageQueue = [];
      logService.log('info', 'WebSocket disconnected', null, 'WebSocketService');
    }
  }

  /**
   * Clean up resources when the service is no longer needed
   */
  cleanup(): void {
    // Remove event listeners
    if (typeof document !== 'undefined' && this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }

    // Disconnect the WebSocket
    this.disconnect();

    logService.log('info', 'WebSocket service cleaned up', null, 'WebSocketService');
  }

  /**
   * Check if the WebSocket is connected
   * @returns True if connected, false otherwise
   */
  getConnectionStatus(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  // Queue for strategy subscriptions to avoid overwhelming the connection
  private subscriptionQueue: { strategyId: string; resolve: () => void; reject: (error: Error) => void }[] = [];
  private isProcessingQueue = false;

  /**
   * Subscribe to a strategy and its market data with improved batching and queuing
   * @param strategyId The ID of the strategy to subscribe to
   */
  async subscribeToStrategy(strategyId: string): Promise<void> {
    // Return a promise that will be resolved when the subscription is processed
    return new Promise((resolve, reject) => {
      // Add to queue
      this.subscriptionQueue.push({ strategyId, resolve, reject });

      // Start processing the queue if not already processing
      if (!this.isProcessingQueue) {
        this.processSubscriptionQueue();
      }
    });
  }

  /**
   * Process the subscription queue with controlled concurrency
   */
  private async processSubscriptionQueue(): Promise<void> {
    if (this.isProcessingQueue || this.subscriptionQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Ensure connection is established
      if (!this.getConnectionStatus()) {
        try {
          await this.connect({});
        } catch (error) {
          // If connection fails, reject all pending subscriptions
          this.rejectAllPendingSubscriptions(new Error('Failed to establish WebSocket connection'));
          return;
        }
      }

      // Process up to 3 subscriptions at a time
      while (this.subscriptionQueue.length > 0) {
        const batch = this.subscriptionQueue.splice(0, 3);
        const batchPromises = batch.map(item => this.processStrategySubscription(item.strategyId, item.resolve, item.reject));

        // Wait for the batch to complete
        await Promise.allSettled(batchPromises);

        // Small delay between batches to avoid overwhelming the connection
        if (this.subscriptionQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      this.isProcessingQueue = false;

      // If new items were added while processing, start processing again
      if (this.subscriptionQueue.length > 0) {
        this.processSubscriptionQueue();
      }
    }
  }

  /**
   * Process a single strategy subscription
   */
  private async processStrategySubscription(
    strategyId: string,
    resolve: () => void,
    reject: (error: Error) => void
  ): Promise<void> {
    try {
      // Send subscription message
      await this.send({
        type: 'subscribe',
        channel: 'strategy',
        strategyId
      });

      // Get strategy details to subscribe to its trading pairs
      try {
        const { data: strategy } = await supabase
          .from('strategies')
          .select('*')
          .eq('id', strategyId)
          .single();

        if (strategy && strategy.selected_pairs) {
          // Batch subscribe to market data for all trading pairs
          await this.batchSubscribeToMarketData(strategy.selected_pairs);
        }
      } catch (strategyError) {
        logService.log('warn', `Failed to get strategy details for ${strategyId}`, strategyError, 'WebSocketService');
        // Continue anyway - we've at least subscribed to the strategy itself
      }

      logService.log('info', `Subscribed to strategy ${strategyId}`, null, 'WebSocketService');
      resolve();
    } catch (error) {
      logService.log('error', `Failed to subscribe to strategy ${strategyId}`, error, 'WebSocketService');
      reject(error as Error);
    }
  }

  /**
   * Reject all pending subscriptions with an error
   */
  private rejectAllPendingSubscriptions(error: Error): void {
    const pendingSubscriptions = [...this.subscriptionQueue];
    this.subscriptionQueue = [];

    for (const item of pendingSubscriptions) {
      item.reject(error);
    }
  }

  /**
   * Subscribe to market data for a symbol
   * @param symbol The trading pair symbol to subscribe to
   */
  async subscribeToMarketData(symbol: string): Promise<void> {
    try {
      if (!this.getConnectionStatus()) {
        await this.connect({});
      }

      // Import the format utilities
      const { toBinanceWsFormat, standardizeAssetPairFormat } = require('./format-utils');

      // Format the symbol for Binance WebSocket
      const formattedSymbol = toBinanceWsFormat(symbol, '@trade');
      const displaySymbol = standardizeAssetPairFormat(symbol);

      // Send subscription message
      await this.send({
        type: 'subscribe',
        channel: 'market',
        symbol: formattedSymbol
      });

      logService.log('info', `Subscribed to market data for ${displaySymbol}`, null, 'WebSocketService');
    } catch (error) {
      logService.log('error', `Failed to subscribe to market data for ${symbol}`, error, 'WebSocketService');
      throw error;
    }
  }

  /**
   * Batch subscribe to market data for multiple symbols
   * @param symbols Array of trading pair symbols to subscribe to
   */
  async batchSubscribeToMarketData(symbols: string[]): Promise<void> {
    if (!symbols || symbols.length === 0) {
      return;
    }

    try {
      if (!this.getConnectionStatus()) {
        await this.connect({});
      }

      // Format all symbols for Binance WebSocket
      const formattedSymbols = symbols.map(symbol =>
        symbol.replace('/', '').toLowerCase() + '@trade'
      );

      // Group symbols into batches of 10 to avoid overwhelming the connection
      const batches = [];
      for (let i = 0; i < formattedSymbols.length; i += 10) {
        batches.push(formattedSymbols.slice(i, i + 10));
      }

      // Process each batch with a small delay between batches
      for (const batch of batches) {
        // Send batch subscription message
        await this.send({
          type: 'subscribe',
          channel: 'market',
          symbols: batch
        });

        logService.log('info', `Batch subscribed to market data for ${batch.length} symbols`, null, 'WebSocketService');

        // Add a small delay between batches
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      logService.log('error', `Failed to batch subscribe to market data`, error, 'WebSocketService');
      throw error;
    }
  }

  /**
   * Handle Binance TestNet data
   * @param data The Binance data
   */
  private handleBinanceData(data: any): void {
    try {
      // Check if this is a trade update
      if (data.e === 'trade') {
        // Format the trade data to match our application's format
        const trade = {
          id: `binance-${data.t}`,
          timestamp: data.T,
          datetime: new Date(data.T).toISOString(),
          symbol: data.s.toUpperCase(),
          side: data.m ? 'sell' : 'buy', // m = is buyer the market maker
          price: parseFloat(data.p),
          amount: parseFloat(data.q),
          cost: parseFloat(data.p) * parseFloat(data.q),
          fee: {
            cost: parseFloat(data.p) * parseFloat(data.q) * 0.001, // 0.1% fee
            currency: data.s.slice(-4) // Last 4 characters (e.g., USDT from BTCUSDT)
          },
          status: 'closed',
          strategyId: 'binance-testnet'
        };

        // Emit the trade update
        this.emit('trade_update', {
          strategyId: 'binance-testnet',
          trade
        });
      }

      // Emit the raw Binance data
      this.emit('binance_raw_data', data);
    } catch (error) {
      logService.log('error', 'Failed to handle Binance data', error, 'WebSocketService');
    }
  }

  private lastPongReceived: number = 0;
  private pingTimeoutTimer: NodeJS.Timeout | null = null;

  private startPingInterval(): void {
    // Clear any existing ping interval and timeout
    this.stopPingInterval();

    // Initialize the last pong time to now
    this.lastPongReceived = Date.now();

    // Start a new ping interval
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
        // Check if we've received a pong since the last ping timeout check
        const now = Date.now();
        const timeSinceLastPong = now - this.lastPongReceived;

        // If we haven't received a pong in 2.5x the ping interval, reconnect
        if (timeSinceLastPong > this.PING_INTERVAL * 2.5) {
          logService.log('warn', `No pong received in ${Math.round(timeSinceLastPong / 1000)}s, reconnecting...`, null, 'WebSocketService');

          // Force reconnection
          this.reconnect();
          return;
        }

        // Send a ping message
        this.send({
          type: 'ping',
          timestamp: now
        }).catch(error => {
          logService.log('error', 'Failed to send ping message', error, 'WebSocketService');
        });

        // Set a timeout to check if we receive a pong
        if (this.pingTimeoutTimer) {
          clearTimeout(this.pingTimeoutTimer);
        }

        this.pingTimeoutTimer = setTimeout(() => {
          const timeSincePing = Date.now() - now;
          logService.log('warn', `No pong received within timeout (${Math.round(timeSincePing / 1000)}s), checking connection...`, null, 'WebSocketService');

          // Check if the connection is still alive
          if (this.socket?.readyState === WebSocket.OPEN) {
            // Send another ping to verify connection
            this.send({
              type: 'ping',
              timestamp: Date.now(),
              isVerification: true
            }).catch(() => {
              // If this fails, force reconnection
              logService.log('warn', 'Verification ping failed, reconnecting...', null, 'WebSocketService');
              this.reconnect();
            });
          } else {
            // Socket is not open, force reconnection
            logService.log('warn', 'Socket not open, reconnecting...', null, 'WebSocketService');
            this.reconnect();
          }
        }, this.PING_INTERVAL * 1.5); // Wait 1.5x the ping interval for a pong
      }
    }, this.PING_INTERVAL);

    logService.log('debug', 'Started WebSocket ping interval', null, 'WebSocketService');
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      logService.log('debug', 'Stopped WebSocket ping interval', null, 'WebSocketService');
    }

    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = null;
      logService.log('debug', 'Cleared WebSocket ping timeout timer', null, 'WebSocketService');
    }
  }
}

export const websocketService = WebSocketService.getInstance();
