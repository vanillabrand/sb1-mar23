import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { marketDataWebSocket, MarketDataUpdate } from './market-data-websocket';
import { cacheService } from './cache-service';
import { eventBus } from './event-bus';
import type { MarketData } from './types';

class MarketDataService extends EventEmitter {
  private marketData: Map<string, MarketData> = new Map();
  private subscriptions: Map<string, string> = new Map(); // Map of symbol to subscription ID
  private readonly MARKET_DATA_CACHE_NAMESPACE = 'market_data';
  private readonly TICKER_CACHE_TTL = 60 * 1000; // 1 minute

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    try {
      logService.log('info', 'Initializing market data service', null, 'MarketDataService');

      // Set up event listeners for market data updates
      this.setupEventListeners();

      // Initialize cache for market data
      if (!cacheService.getCacheNames().includes(this.MARKET_DATA_CACHE_NAMESPACE)) {
        cacheService.createCache(this.MARKET_DATA_CACHE_NAMESPACE, {
          maxSize: 1000,
          defaultTTL: this.TICKER_CACHE_TTL,
          evictionPolicy: 'lru'
        });
      }

      return Promise.resolve();
    } catch (error) {
      logService.log('error', 'Failed to initialize market data service', error, 'MarketDataService');
      throw error;
    }
  }

  /**
   * Set up event listeners for market data updates
   */
  private setupEventListeners(): void {
    // Listen for market data updates from WebSocket
    marketDataWebSocket.on('update', (update: MarketDataUpdate) => {
      this.handleMarketDataUpdate(update);
    });

    // Also listen for updates via the event bus
    eventBus.on('marketData:update', (update: MarketDataUpdate) => {
      this.handleMarketDataUpdate(update);
    });
  }

  /**
   * Handle a market data update
   * @param update Market data update
   */
  private handleMarketDataUpdate(update: MarketDataUpdate): void {
    try {
      // Convert WebSocket update to MarketData format
      const marketData: MarketData = {
        symbol: update.symbol,
        price: update.price,
        bid: update.bid || update.price,
        ask: update.ask || update.price,
        high24h: update.high24h || update.price,
        low24h: update.low24h || update.price,
        volume24h: update.volume24h || 0,
        change24h: update.change24h || 0,
        lastUpdate: update.timestamp,
        source: update.source
      };

      // Update the market data map
      this.marketData.set(update.symbol, marketData);

      // Emit update event
      this.emit('marketDataUpdated', { symbol: update.symbol, data: marketData });
    } catch (error) {
      logService.log('error', `Failed to handle market data update for ${update.symbol}`, error, 'MarketDataService');
    }
  }

  /**
   * Get market data for a symbol
   * @param symbol Trading pair symbol
   * @returns Promise that resolves to the market data or undefined if not available
   */
  async getMarketData(symbol: string): Promise<MarketData | undefined> {
    try {
      // Normalize the symbol
      const normalizedSymbol = this.normalizeSymbol(symbol);

      // Check if we have the data in memory
      let data = this.marketData.get(normalizedSymbol);

      // If not in memory, try to get from WebSocket service
      if (!data) {
        const wsData = marketDataWebSocket.getLatestMarketData(normalizedSymbol);

        if (wsData) {
          // Convert to MarketData format
          data = {
            symbol: wsData.symbol,
            price: wsData.price,
            bid: wsData.bid || wsData.price,
            ask: wsData.ask || wsData.price,
            high24h: wsData.high24h || wsData.price,
            low24h: wsData.low24h || wsData.price,
            volume24h: wsData.volume24h || 0,
            change24h: wsData.change24h || 0,
            lastUpdate: wsData.timestamp,
            source: wsData.source
          };

          // Update the market data map
          this.marketData.set(normalizedSymbol, data);
        }
      }

      // If still not found, try to get from cache
      if (!data) {
        const cacheKey = `ticker:${normalizedSymbol}`;
        const cachedData = cacheService.get<MarketDataUpdate>(cacheKey, this.MARKET_DATA_CACHE_NAMESPACE);

        if (cachedData) {
          // Convert to MarketData format
          data = {
            symbol: cachedData.symbol,
            price: cachedData.price,
            bid: cachedData.bid || cachedData.price,
            ask: cachedData.ask || cachedData.price,
            high24h: cachedData.high24h || cachedData.price,
            low24h: cachedData.low24h || cachedData.price,
            volume24h: cachedData.volume24h || 0,
            change24h: cachedData.change24h || 0,
            lastUpdate: cachedData.timestamp,
            source: cachedData.source
          };

          // Update the market data map
          this.marketData.set(normalizedSymbol, data);
        }
      }

      return data;
    } catch (error) {
      logService.log('error', `Failed to get market data for ${symbol}`, error, 'MarketDataService');
      return undefined;
    }
  }

  /**
   * Update market data for a symbol
   * @param symbol Trading pair symbol
   * @param data Market data
   */
  async updateMarketData(symbol: string, data: MarketData): Promise<void> {
    try {
      // Normalize the symbol
      const normalizedSymbol = this.normalizeSymbol(symbol);

      // Update the market data map
      this.marketData.set(normalizedSymbol, data);

      // Cache the data
      const cacheKey = `ticker:${normalizedSymbol}`;
      const update: MarketDataUpdate = {
        symbol: normalizedSymbol,
        price: data.price,
        bid: data.bid,
        ask: data.ask,
        high24h: data.high24h,
        low24h: data.low24h,
        volume24h: data.volume24h,
        change24h: data.change24h,
        timestamp: data.lastUpdate || Date.now(),
        source: data.source || 'manual'
      };

      cacheService.set(cacheKey, update, this.MARKET_DATA_CACHE_NAMESPACE, this.TICKER_CACHE_TTL);

      // Emit update event
      this.emit('marketDataUpdated', { symbol: normalizedSymbol, data });
      eventBus.emit('marketData:update', update);
    } catch (error) {
      logService.log('error', `Failed to update market data for ${symbol}`, error, 'MarketDataService');
      throw error;
    }
  }

  /**
   * Start tracking market data for a symbol
   * @param symbol Trading pair symbol
   * @param priority Subscription priority
   */
  async startTracking(symbol: string, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<void> {
    try {
      // Normalize the symbol
      const normalizedSymbol = this.normalizeSymbol(symbol);

      // Check if already tracking
      if (this.subscriptions.has(normalizedSymbol)) {
        return;
      }

      // Subscribe to market data via WebSocket
      const subscriptionId = await marketDataWebSocket.subscribeToMarketData(normalizedSymbol, {
        priority,
        updateCallback: (update) => {
          this.handleMarketDataUpdate(update);
        },
        errorCallback: (error) => {
          logService.log('error', `WebSocket error for ${normalizedSymbol}`, error, 'MarketDataService');
        }
      });

      // Store the subscription ID
      this.subscriptions.set(normalizedSymbol, subscriptionId);

      logService.log('info', `Started tracking market data for ${normalizedSymbol} with ${priority} priority`, null, 'MarketDataService');
    } catch (error) {
      logService.log('error', `Failed to start tracking market data for ${symbol}`, error, 'MarketDataService');
      throw error;
    }
  }

  /**
   * Stop tracking market data for a symbol
   * @param symbol Trading pair symbol
   */
  stopTracking(symbol: string): void {
    try {
      // Normalize the symbol
      const normalizedSymbol = this.normalizeSymbol(symbol);

      // Check if tracking
      const subscriptionId = this.subscriptions.get(normalizedSymbol);
      if (!subscriptionId) {
        return;
      }

      // Unsubscribe from market data
      marketDataWebSocket.unsubscribeFromMarketData(subscriptionId);

      // Remove from subscriptions map
      this.subscriptions.delete(normalizedSymbol);

      logService.log('info', `Stopped tracking market data for ${normalizedSymbol}`, null, 'MarketDataService');
    } catch (error) {
      logService.log('error', `Failed to stop tracking market data for ${symbol}`, error, 'MarketDataService');
    }
  }

  /**
   * Normalize a symbol to a standard format
   * @param symbol Trading pair symbol
   * @returns Normalized symbol
   */
  private normalizeSymbol(symbol: string): string {
    if (!symbol) return '';

    try {
      // Convert to uppercase
      let normalized = symbol.toUpperCase();

      // Ensure consistent separator (replace all underscores with slashes)
      if (normalized.includes('_')) {
        normalized = normalized.replace(/_/g, '/');
      }

      // Handle special cases
      if (normalized === 'BTCUSD') normalized = 'BTC/USD';
      if (normalized === 'ETHUSD') normalized = 'ETH/USD';

      // Ensure there's only one separator
      const parts = normalized.split('/');
      if (parts.length > 2) {
        // If there are multiple separators, take the first two parts
        normalized = `${parts[0]}/${parts[1]}`;
      } else if (parts.length === 1 && parts[0].length >= 6) {
        // If there's no separator but the string is long enough, try to split it
        // Common patterns: BTCUSDT, ETHUSDT, etc.
        const baseCurrencies = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOT'];
        const quoteCurrencies = ['USDT', 'USD', 'USDC', 'BUSD', 'DAI', 'TUSD'];

        // Try to find a known base currency at the start
        for (const base of baseCurrencies) {
          if (normalized.startsWith(base)) {
            const quote = normalized.substring(base.length);
            // Check if the remaining part is a known quote currency
            if (quoteCurrencies.includes(quote)) {
              normalized = `${base}/${quote}`;
              break;
            }
          }
        }
      }

      return normalized;
    } catch (error) {
      logService.log('error', `Failed to normalize symbol: ${symbol}`, error, 'MarketDataService');
      return symbol.toUpperCase(); // Return uppercase as fallback
    }
  }

  /**
   * Batch subscribe to market data for multiple symbols
   * @param symbols Array of trading pair symbols
   * @param priority Subscription priority
   */
  async batchStartTracking(symbols: string[], priority: 'high' | 'normal' | 'low' = 'normal'): Promise<void> {
    try {
      if (!symbols || symbols.length === 0) {
        return;
      }

      // Normalize symbols
      const normalizedSymbols = symbols.map(symbol => this.normalizeSymbol(symbol));

      // Filter out symbols that are already being tracked
      const symbolsToTrack = normalizedSymbols.filter(symbol => !this.subscriptions.has(symbol));

      if (symbolsToTrack.length === 0) {
        return;
      }

      // Batch subscribe to market data
      const subscriptionIds = await marketDataWebSocket.batchSubscribeToMarketData(symbolsToTrack, {
        priority,
        updateCallback: (update) => {
          this.handleMarketDataUpdate(update);
        },
        errorCallback: (error) => {
          logService.log('error', 'WebSocket error for batch subscription', error, 'MarketDataService');
        }
      });

      // Store subscription IDs
      for (let i = 0; i < symbolsToTrack.length; i++) {
        this.subscriptions.set(symbolsToTrack[i], subscriptionIds[i]);
      }

      logService.log('info', `Batch started tracking market data for ${symbolsToTrack.length} symbols with ${priority} priority`, null, 'MarketDataService');
    } catch (error) {
      logService.log('error', 'Failed to batch start tracking market data', error, 'MarketDataService');
      throw error;
    }
  }

  /**
   * Get all symbols currently being tracked
   * @returns Array of symbols
   */
  getTrackedSymbols(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get order book for a symbol
   * @param symbol Trading pair symbol
   * @returns Promise that resolves to the order book or undefined if not available
   */
  async getOrderBook(symbol: string): Promise<{ bids: [number, number][], asks: [number, number][] } | undefined> {
    try {
      // Normalize the symbol
      const normalizedSymbol = this.normalizeSymbol(symbol);

      // Try to get order book from WebSocket service
      const orderBook = marketDataWebSocket.getOrderBook?.(normalizedSymbol);

      if (orderBook) {
        return orderBook;
      }

      // If WebSocket doesn't have order book data, create a simulated one based on current price
      const marketData = await this.getMarketData(normalizedSymbol);

      if (!marketData) {
        return undefined;
      }

      // Create a simulated order book with 10 levels on each side
      const price = marketData.price;
      const bids: [number, number][] = [];
      const asks: [number, number][] = [];

      // Create bids (buy orders) below current price
      for (let i = 0; i < 10; i++) {
        const bidPrice = price * (1 - (0.001 * (i + 1)));
        const bidSize = 1 / (i + 1); // Decreasing size as we move away from the price
        bids.push([bidPrice, bidSize]);
      }

      // Create asks (sell orders) above current price
      for (let i = 0; i < 10; i++) {
        const askPrice = price * (1 + (0.001 * (i + 1)));
        const askSize = 1 / (i + 1); // Decreasing size as we move away from the price
        asks.push([askPrice, askSize]);
      }

      // Sort bids in descending order (highest price first)
      bids.sort((a, b) => b[0] - a[0]);

      // Sort asks in ascending order (lowest price first)
      asks.sort((a, b) => a[0] - b[0]);

      return { bids, asks };
    } catch (error) {
      logService.log('error', `Failed to get order book for ${symbol}`, error, 'MarketDataService');
      return undefined;
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    try {
      // Unsubscribe from all market data
      for (const [symbol, subscriptionId] of this.subscriptions.entries()) {
        try {
          marketDataWebSocket.unsubscribeFromMarketData(subscriptionId);
          logService.log('debug', `Unsubscribed from market data for ${symbol}`, null, 'MarketDataService');
        } catch (error) {
          logService.log('warn', `Failed to unsubscribe from market data for ${symbol}`, error, 'MarketDataService');
        }
      }

      // Clear maps
      this.subscriptions.clear();
      this.marketData.clear();

      logService.log('info', 'Cleaned up market data service', null, 'MarketDataService');
    } catch (error) {
      logService.log('error', 'Failed to clean up market data service', error, 'MarketDataService');
    }
  }
}

// Create and export a singleton instance
export const marketDataService = new MarketDataService();
