import { websocketManager, WebSocketOptions } from './websocket-manager';
import { logService } from './log-service';
import { cacheService } from './cache-service';
import { eventBus } from './event-bus';

/**
 * WebSocket message handler for exchange service
 * This is separated into its own file to avoid circular dependencies
 */
export class ExchangeServiceWebSocket {
  private readonly MARKET_DATA_CACHE_NAMESPACE = 'market_data';
  private readonly TICKER_CACHE_TTL = 10 * 1000; // 10 seconds
  private readonly ORDERBOOK_CACHE_TTL = 5 * 1000; // 5 seconds
  private readonly TRADES_CACHE_TTL = 30 * 1000; // 30 seconds

  /**
   * Create a WebSocket connection for an exchange
   * @param exchangeId Exchange ID
   * @param options WebSocket options
   * @returns Connection ID
   */
  createWebSocketConnection(exchangeId: string, options: WebSocketOptions): string {
    // Add exchange name to options for easier identification
    const connectionOptions: WebSocketOptions = {
      ...options,
      name: `exchange-${exchangeId}-${Date.now()}`,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000
    };

    // Create the connection
    const connectionId = websocketManager.createConnection(connectionOptions);
    
    logService.log('info', `Created WebSocket connection for exchange ${exchangeId}`, {
      connectionId,
      url: options.url
    }, 'ExchangeServiceWebSocket');
    
    return connectionId;
  }

  /**
   * Subscribe to market data for a symbol
   * @param connectionId WebSocket connection ID
   * @param symbol Trading pair symbol
   * @param channel Channel to subscribe to (e.g., 'ticker', 'orderbook', 'trades')
   * @param subscriptionMessage Message to send for subscription
   * @returns Subscription ID
   */
  subscribeToMarketData(
    connectionId: string,
    symbol: string,
    channel: string,
    subscriptionMessage: any
  ): string {
    // Generate a unique subscription ID
    const subscriptionId = `${connectionId}-${symbol}-${channel}-${Date.now()}`;
    
    // Send the subscription message
    websocketManager.send(connectionId, subscriptionMessage);
    
    // Register the subscription with the WebSocket manager
    websocketManager.addSubscription(connectionId, subscriptionId);
    
    logService.log('info', `Subscribed to ${channel} for ${symbol}`, {
      connectionId,
      subscriptionId
    }, 'ExchangeServiceWebSocket');
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from market data
   * @param connectionId WebSocket connection ID
   * @param subscriptionId Subscription ID
   * @param unsubscriptionMessage Message to send for unsubscription
   */
  unsubscribeFromMarketData(
    connectionId: string,
    subscriptionId: string,
    unsubscriptionMessage: any
  ): void {
    // Send the unsubscription message
    websocketManager.send(connectionId, unsubscriptionMessage);
    
    // Remove the subscription from the WebSocket manager
    websocketManager.removeSubscription(connectionId, subscriptionId);
    
    logService.log('info', `Unsubscribed from market data`, {
      connectionId,
      subscriptionId
    }, 'ExchangeServiceWebSocket');
  }

  /**
   * Handle a WebSocket message
   * @param connectionId WebSocket connection ID
   * @param message Message received
   */
  handleWebSocketMessage(connectionId: string, message: any): void {
    try {
      // Parse the message if it's a string
      const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
      
      // Determine the message type
      const messageType = this.determineMessageType(parsedMessage);
      
      // Process the message based on its type
      switch (messageType) {
        case 'ticker':
          this.handleTickerMessage(connectionId, parsedMessage);
          break;
        case 'orderbook':
          this.handleOrderbookMessage(connectionId, parsedMessage);
          break;
        case 'trades':
          this.handleTradesMessage(connectionId, parsedMessage);
          break;
        case 'error':
          this.handleErrorMessage(connectionId, parsedMessage);
          break;
        default:
          // Unknown message type, just log it
          logService.log('debug', `Received unknown WebSocket message type`, {
            connectionId,
            message: parsedMessage
          }, 'ExchangeServiceWebSocket');
      }
    } catch (error) {
      logService.log('error', `Error handling WebSocket message`, {
        connectionId,
        error,
        message
      }, 'ExchangeServiceWebSocket');
    }
  }

  /**
   * Determine the type of a WebSocket message
   * @param message The message to analyze
   * @returns Message type
   */
  private determineMessageType(message: any): string {
    // This is a simplified implementation - in a real application,
    // you would need to adapt this to the specific format of each exchange
    
    // Check for error messages
    if (
      message.error ||
      message.code === 'error' ||
      message.type === 'error' ||
      message.status === 'error'
    ) {
      return 'error';
    }
    
    // Check for ticker messages
    if (
      message.type === 'ticker' ||
      message.channel === 'ticker' ||
      message.e === 'ticker' ||
      message.last ||
      (message.data && message.data.last)
    ) {
      return 'ticker';
    }
    
    // Check for orderbook messages
    if (
      message.type === 'orderbook' ||
      message.channel === 'orderbook' ||
      message.e === 'depthUpdate' ||
      message.bids ||
      (message.data && message.data.bids)
    ) {
      return 'orderbook';
    }
    
    // Check for trades messages
    if (
      message.type === 'trades' ||
      message.channel === 'trades' ||
      message.e === 'trade' ||
      message.trades ||
      (message.data && message.data.trades)
    ) {
      return 'trades';
    }
    
    // Unknown message type
    return 'unknown';
  }

  /**
   * Handle a ticker message
   * @param connectionId WebSocket connection ID
   * @param message Ticker message
   */
  private handleTickerMessage(connectionId: string, message: any): void {
    try {
      // Extract symbol and ticker data
      const { symbol, ticker } = this.extractTickerData(message);
      
      if (!symbol || !ticker) {
        logService.log('warn', `Invalid ticker message`, {
          connectionId,
          message
        }, 'ExchangeServiceWebSocket');
        return;
      }
      
      // Cache the ticker data
      const cacheKey = `ticker:${symbol}`;
      cacheService.set(cacheKey, ticker, this.MARKET_DATA_CACHE_NAMESPACE, this.TICKER_CACHE_TTL);
      
      // Emit ticker update event
      eventBus.emit('market:ticker', { symbol, ticker });
      
      logService.log('debug', `Updated ticker for ${symbol}`, {
        connectionId,
        symbol,
        ticker
      }, 'ExchangeServiceWebSocket');
    } catch (error) {
      logService.log('error', `Error handling ticker message`, {
        connectionId,
        error,
        message
      }, 'ExchangeServiceWebSocket');
    }
  }

  /**
   * Handle an orderbook message
   * @param connectionId WebSocket connection ID
   * @param message Orderbook message
   */
  private handleOrderbookMessage(connectionId: string, message: any): void {
    try {
      // Extract symbol and orderbook data
      const { symbol, orderbook } = this.extractOrderbookData(message);
      
      if (!symbol || !orderbook) {
        logService.log('warn', `Invalid orderbook message`, {
          connectionId,
          message
        }, 'ExchangeServiceWebSocket');
        return;
      }
      
      // Cache the orderbook data
      const cacheKey = `orderbook:${symbol}`;
      cacheService.set(cacheKey, orderbook, this.MARKET_DATA_CACHE_NAMESPACE, this.ORDERBOOK_CACHE_TTL);
      
      // Emit orderbook update event
      eventBus.emit('market:orderbook', { symbol, orderbook });
      
      logService.log('debug', `Updated orderbook for ${symbol}`, {
        connectionId,
        symbol,
        bids: orderbook.bids?.length,
        asks: orderbook.asks?.length
      }, 'ExchangeServiceWebSocket');
    } catch (error) {
      logService.log('error', `Error handling orderbook message`, {
        connectionId,
        error,
        message
      }, 'ExchangeServiceWebSocket');
    }
  }

  /**
   * Handle a trades message
   * @param connectionId WebSocket connection ID
   * @param message Trades message
   */
  private handleTradesMessage(connectionId: string, message: any): void {
    try {
      // Extract symbol and trades data
      const { symbol, trades } = this.extractTradesData(message);
      
      if (!symbol || !trades) {
        logService.log('warn', `Invalid trades message`, {
          connectionId,
          message
        }, 'ExchangeServiceWebSocket');
        return;
      }
      
      // Cache the trades data
      const cacheKey = `trades:${symbol}`;
      
      // Get existing trades from cache
      const existingTrades = cacheService.get<any[]>(cacheKey, this.MARKET_DATA_CACHE_NAMESPACE) || [];
      
      // Merge new trades with existing trades
      const mergedTrades = [...trades, ...existingTrades].slice(0, 100); // Keep only the latest 100 trades
      
      // Update the cache
      cacheService.set(cacheKey, mergedTrades, this.MARKET_DATA_CACHE_NAMESPACE, this.TRADES_CACHE_TTL);
      
      // Emit trades update event
      eventBus.emit('market:trades', { symbol, trades });
      
      logService.log('debug', `Updated trades for ${symbol}`, {
        connectionId,
        symbol,
        newTrades: trades.length,
        totalTrades: mergedTrades.length
      }, 'ExchangeServiceWebSocket');
    } catch (error) {
      logService.log('error', `Error handling trades message`, {
        connectionId,
        error,
        message
      }, 'ExchangeServiceWebSocket');
    }
  }

  /**
   * Handle an error message
   * @param connectionId WebSocket connection ID
   * @param message Error message
   */
  private handleErrorMessage(connectionId: string, message: any): void {
    logService.log('error', `Received error from WebSocket`, {
      connectionId,
      message
    }, 'ExchangeServiceWebSocket');
    
    // Emit error event
    eventBus.emit('market:error', { connectionId, error: message });
  }

  /**
   * Extract ticker data from a message
   * @param message Ticker message
   * @returns Symbol and ticker data
   */
  private extractTickerData(message: any): { symbol: string; ticker: any } {
    // This is a simplified implementation - in a real application,
    // you would need to adapt this to the specific format of each exchange
    
    let symbol = '';
    let ticker: any = null;
    
    // Try to extract symbol
    if (message.symbol) {
      symbol = message.symbol;
    } else if (message.s) {
      symbol = message.s;
    } else if (message.data && message.data.symbol) {
      symbol = message.data.symbol;
    } else if (message.pair) {
      symbol = message.pair;
    }
    
    // Normalize symbol format
    symbol = this.normalizeSymbol(symbol);
    
    // Try to extract ticker data
    if (message.data && typeof message.data === 'object') {
      ticker = message.data;
    } else if (message.last || message.bid || message.ask) {
      ticker = {
        last: message.last,
        bid: message.bid,
        ask: message.ask,
        volume: message.volume || message.vol || 0,
        timestamp: message.timestamp || message.time || Date.now()
      };
    } else if (message.c || message.b || message.a) {
      ticker = {
        last: message.c,
        bid: message.b,
        ask: message.a,
        volume: message.v || message.q || 0,
        timestamp: message.T || message.E || Date.now()
      };
    } else {
      ticker = message;
    }
    
    return { symbol, ticker };
  }

  /**
   * Extract orderbook data from a message
   * @param message Orderbook message
   * @returns Symbol and orderbook data
   */
  private extractOrderbookData(message: any): { symbol: string; orderbook: any } {
    // This is a simplified implementation - in a real application,
    // you would need to adapt this to the specific format of each exchange
    
    let symbol = '';
    let orderbook: any = null;
    
    // Try to extract symbol
    if (message.symbol) {
      symbol = message.symbol;
    } else if (message.s) {
      symbol = message.s;
    } else if (message.data && message.data.symbol) {
      symbol = message.data.symbol;
    } else if (message.pair) {
      symbol = message.pair;
    }
    
    // Normalize symbol format
    symbol = this.normalizeSymbol(symbol);
    
    // Try to extract orderbook data
    if (message.data && message.data.bids && message.data.asks) {
      orderbook = message.data;
    } else if (message.bids && message.asks) {
      orderbook = {
        bids: message.bids,
        asks: message.asks,
        timestamp: message.timestamp || message.time || Date.now()
      };
    } else if (message.b && message.a) {
      orderbook = {
        bids: message.b,
        asks: message.a,
        timestamp: message.T || message.E || Date.now()
      };
    } else {
      orderbook = message;
    }
    
    return { symbol, orderbook };
  }

  /**
   * Extract trades data from a message
   * @param message Trades message
   * @returns Symbol and trades data
   */
  private extractTradesData(message: any): { symbol: string; trades: any[] } {
    // This is a simplified implementation - in a real application,
    // you would need to adapt this to the specific format of each exchange
    
    let symbol = '';
    let trades: any[] = [];
    
    // Try to extract symbol
    if (message.symbol) {
      symbol = message.symbol;
    } else if (message.s) {
      symbol = message.s;
    } else if (message.data && message.data.symbol) {
      symbol = message.data.symbol;
    } else if (message.pair) {
      symbol = message.pair;
    }
    
    // Normalize symbol format
    symbol = this.normalizeSymbol(symbol);
    
    // Try to extract trades data
    if (message.data && Array.isArray(message.data)) {
      trades = message.data;
    } else if (message.data && message.data.trades && Array.isArray(message.data.trades)) {
      trades = message.data.trades;
    } else if (Array.isArray(message.trades)) {
      trades = message.trades;
    } else if (Array.isArray(message)) {
      trades = message;
    } else {
      // Single trade
      trades = [message];
    }
    
    return { symbol, trades };
  }

  /**
   * Normalize a symbol to a standard format
   * @param symbol Symbol to normalize
   * @returns Normalized symbol
   */
  private normalizeSymbol(symbol: string): string {
    // Convert to uppercase
    symbol = symbol.toUpperCase();
    
    // Replace common separators with standard format
    symbol = symbol.replace(/[-_]/g, '/');
    
    // Add slash if missing
    if (!symbol.includes('/') && symbol.length >= 6) {
      // Try to find common base currencies
      const baseCurrencies = ['USDT', 'USD', 'BTC', 'ETH', 'BNB'];
      
      for (const base of baseCurrencies) {
        if (symbol.endsWith(base)) {
          const quote = symbol.substring(0, symbol.length - base.length);
          return `${quote}/${base}`;
        }
      }
    }
    
    return symbol;
  }
}

export const exchangeServiceWebSocket = new ExchangeServiceWebSocket();
