import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { exchangeService } from './exchange-service';
import { marketDataService } from './market-data-service';
import { marketAnalyzer } from './market-analyzer';
import { eventBus } from './event-bus';
import { demoService } from './demo-service';
import { websocketService } from './websocket-service';
import { cacheService } from './cache-service';

/**
 * Enhanced market data service for providing comprehensive market data to Deepseek
 * Collects and formats market data for use in trade generation and strategy adaptation
 */
class EnhancedMarketDataService extends EventEmitter {
  private static instance: EnhancedMarketDataService;
  private readonly CACHE_NAMESPACE = 'enhanced_market_data';
  private readonly CACHE_TTL = 60 * 1000; // 1 minute
  private readonly UPDATE_INTERVAL = 60 * 1000; // 1 minute
  private marketDataCache: Map<string, any> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private initialized = false;

  private constructor() {
    super();
    this._initialize();
  }

  static getInstance(): EnhancedMarketDataService {
    if (!EnhancedMarketDataService.instance) {
      EnhancedMarketDataService.instance = new EnhancedMarketDataService();
    }
    return EnhancedMarketDataService.instance;
  }

  /**
   * Initialize the service
   * Public method that can be called to ensure the service is initialized
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize cache
      try {
        cacheService.initializeCache({
          namespace: this.CACHE_NAMESPACE,
          ttl: this.CACHE_TTL,
          maxSize: 100
        });
      } catch (cacheError) {
        logService.log('warn', 'Failed to initialize cache service, will use in-memory cache', cacheError, 'EnhancedMarketDataService');
        // Continue without cache service - we'll use our in-memory cache
      }

      // Subscribe to market data updates
      try {
        websocketService.on('message', this.handleWebSocketMessage.bind(this));
      } catch (wsError) {
        logService.log('warn', 'Failed to subscribe to websocket messages', wsError, 'EnhancedMarketDataService');
        // Continue without websocket updates
      }

      try {
        eventBus.subscribe('market:data:updated', this.handleMarketDataUpdate.bind(this));
      } catch (eventError) {
        logService.log('warn', 'Failed to subscribe to market data updates', eventError, 'EnhancedMarketDataService');
        // Continue without event bus updates
      }

      this.initialized = true;
      logService.log('info', 'Enhanced market data service initialized', null, 'EnhancedMarketDataService');
    } catch (error) {
      logService.log('error', 'Failed to initialize enhanced market data service', error, 'EnhancedMarketDataService');
      throw error; // Re-throw to allow caller to handle initialization failure
    }
  }

  /**
   * Private initialization method called from constructor
   */
  private async _initialize(): Promise<void> {
    try {
      await this.initialize();
    } catch (error) {
      logService.log('error', 'Failed to initialize enhanced market data service from constructor', error, 'EnhancedMarketDataService');
      // Don't throw from constructor initialization
    }
  }

  /**
   * Get comprehensive market data for a symbol
   * @param symbol The trading pair symbol (e.g., BTC/USDT)
   * @param timeframes Array of timeframes to include (e.g., ['1m', '5m', '1h'])
   * @param includeIndicators Whether to include technical indicators
   * @returns Comprehensive market data object
   */
  async getMarketData(
    symbol: string,
    timeframes: string[] = ['5m', '1h', '4h', '1d'],
    includeIndicators: boolean = true
  ): Promise<any> {
    try {
      // Check cache first
      const cacheKey = `${symbol}:${timeframes.join(',')}:${includeIndicators}`;
      let cachedData = null;

      // Try external cache first
      try {
        cachedData = cacheService.get(cacheKey, this.CACHE_NAMESPACE);
      } catch (cacheError) {
        // Fall back to in-memory cache if external cache fails
        cachedData = this.marketDataCache.get(cacheKey);
        logService.log('debug', 'Using in-memory cache fallback', null, 'EnhancedMarketDataService');
      }

      if (cachedData) {
        return cachedData;
      }

      // Start collecting data
      const marketData: any = {
        symbol,
        timestamp: Date.now(),
        currentPrice: null,
        priceChange24h: null,
        volume24h: null,
        marketCap: null,
        high24h: null,
        low24h: null,
        candles: {},
        indicators: {},
        orderbook: null,
        trades: [],
        volatility: null,
        trend: null,
        marketConditions: null
      };

      // Get current ticker data
      const ticker = await exchangeService.getTicker(symbol);
      if (ticker) {
        marketData.currentPrice = ticker.last;
        marketData.priceChange24h = ticker.percentage;
        marketData.volume24h = ticker.volume;
        marketData.high24h = ticker.high;
        marketData.low24h = ticker.low;
      }

      // Get candles for each timeframe
      for (const timeframe of timeframes) {
        const candles = await marketDataService.getCandles(symbol, timeframe, 100);
        if (candles && candles.length > 0) {
          marketData.candles[timeframe] = candles;
        }
      }

      // Get order book data (limited depth for efficiency)
      const orderbook = await exchangeService.getOrderBook(symbol, 10);
      if (orderbook) {
        marketData.orderbook = orderbook;
      }

      // Get recent trades
      const trades = await exchangeService.getTrades(symbol, 50);
      if (trades && trades.length > 0) {
        marketData.trades = trades;
      }

      // Calculate volatility
      marketData.volatility = this.calculateVolatility(marketData.candles['1h'] || marketData.candles['5m'] || []);

      // Identify trend
      marketData.trend = this.identifyTrend(marketData.candles['1h'] || marketData.candles['5m'] || []);

      // Include technical indicators if requested
      if (includeIndicators) {
        for (const timeframe of timeframes) {
          if (marketData.candles[timeframe]) {
            marketData.indicators[timeframe] = await this.calculateIndicators(marketData.candles[timeframe]);
          }
        }
      }

      // Get market conditions from market analyzer
      try {
        const analysis = await marketAnalyzer.analyzeMarket(symbol);
        if (analysis) {
          marketData.marketConditions = {
            volatility: analysis.volatility,
            trend: analysis.trend,
            volume: analysis.volume,
            sentiment: analysis.sentiment || 'neutral',
            tradingOpportunity: analysis.tradingOpportunity || false,
            opportunityDetails: analysis.opportunityDetails || null
          };
        }
      } catch (analyzerError) {
        logService.log('warn', `Failed to get market analysis for ${symbol}`, analyzerError, 'EnhancedMarketDataService');
      }

      // Cache the data in both external and in-memory cache
      try {
        cacheService.set(cacheKey, marketData, this.CACHE_NAMESPACE, this.CACHE_TTL);
      } catch (cacheError) {
        logService.log('debug', 'Using in-memory cache only', cacheError, 'EnhancedMarketDataService');
      }

      // Always update in-memory cache as fallback
      this.marketDataCache.set(cacheKey, marketData);

      // Set up automatic update if not already set
      if (!this.updateIntervals.has(cacheKey)) {
        const interval = setInterval(() => {
          this.refreshMarketData(symbol, timeframes, includeIndicators).catch(error => {
            logService.log('error', `Failed to refresh market data for ${symbol}`, error, 'EnhancedMarketDataService');
          });
        }, this.UPDATE_INTERVAL);
        this.updateIntervals.set(cacheKey, interval);
      }

      return marketData;
    } catch (error) {
      logService.log('error', `Failed to get enhanced market data for ${symbol}`, error, 'EnhancedMarketDataService');
      throw error;
    }
  }

  /**
   * Get market data for multiple symbols
   * @param symbols Array of trading pair symbols
   * @param timeframes Array of timeframes to include
   * @param includeIndicators Whether to include technical indicators
   * @returns Object with market data for each symbol
   */
  async getMultipleMarketData(
    symbols: string[],
    timeframes: string[] = ['5m', '1h'],
    includeIndicators: boolean = true
  ): Promise<Record<string, any>> {
    try {
      const results: Record<string, any> = {};

      // Process symbols in parallel with a limit of 5 concurrent requests
      const batchSize = 5;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(symbol =>
            this.getMarketData(symbol, timeframes, includeIndicators)
              .catch(error => {
                logService.log('error', `Failed to get market data for ${symbol}`, error, 'EnhancedMarketDataService');
                return null;
              })
          )
        );

        // Add successful results to the output
        batch.forEach((symbol, index) => {
          if (batchResults[index]) {
            results[symbol] = batchResults[index];
          }
        });
      }

      return results;
    } catch (error) {
      logService.log('error', 'Failed to get multiple market data', error, 'EnhancedMarketDataService');
      throw error;
    }
  }

  /**
   * Get market data for a strategy
   * @param strategy The strategy object
   * @param timeframes Array of timeframes to include
   * @param includeIndicators Whether to include technical indicators
   * @returns Object with market data for each symbol in the strategy
   */
  async getStrategyMarketData(
    strategy: any,
    timeframes: string[] = ['5m', '1h', '4h'],
    includeIndicators: boolean = true
  ): Promise<Record<string, any>> {
    try {
      // Extract symbols from strategy
      const symbols = strategy.selected_pairs || [];
      if (!symbols || symbols.length === 0) {
        throw new Error(`No symbols found in strategy ${strategy.id}`);
      }

      return await this.getMultipleMarketData(symbols, timeframes, includeIndicators);
    } catch (error) {
      logService.log('error', `Failed to get market data for strategy ${strategy.id}`, error, 'EnhancedMarketDataService');
      throw error;
    }
  }

  /**
   * Refresh market data for a symbol
   * @param symbol The trading pair symbol
   * @param timeframes Array of timeframes to include
   * @param includeIndicators Whether to include technical indicators
   */
  private async refreshMarketData(
    symbol: string,
    timeframes: string[] = ['5m', '1h', '4h', '1d'],
    includeIndicators: boolean = true
  ): Promise<void> {
    try {
      const cacheKey = `${symbol}:${timeframes.join(',')}:${includeIndicators}`;
      const cachedData = cacheService.get(cacheKey, this.CACHE_NAMESPACE);

      if (!cachedData) {
        // If no cached data, get fresh data
        await this.getMarketData(symbol, timeframes, includeIndicators);
        return;
      }

      // Update only what needs to be updated
      const updatedData = { ...cachedData, timestamp: Date.now() };

      // Update ticker data
      const ticker = await exchangeService.getTicker(symbol);
      if (ticker) {
        updatedData.currentPrice = ticker.last;
        updatedData.priceChange24h = ticker.percentage;
        updatedData.volume24h = ticker.volume;
        updatedData.high24h = ticker.high;
        updatedData.low24h = ticker.low;
      }

      // Update the most recent timeframe candles
      const mostRecentTimeframe = timeframes[0] || '5m';
      const candles = await marketDataService.getCandles(symbol, mostRecentTimeframe, 20);
      if (candles && candles.length > 0) {
        updatedData.candles[mostRecentTimeframe] = candles;

        // Update volatility and trend based on new candles
        updatedData.volatility = this.calculateVolatility(candles);
        updatedData.trend = this.identifyTrend(candles);

        // Update indicators for this timeframe if needed
        if (includeIndicators) {
          updatedData.indicators[mostRecentTimeframe] = await this.calculateIndicators(candles);
        }
      }

      // Cache the updated data
      cacheService.set(cacheKey, updatedData, this.CACHE_NAMESPACE, this.CACHE_TTL);

      // Emit event for the update
      this.emit('marketDataUpdated', { symbol, data: updatedData });
      eventBus.emit('market:data:updated', { symbol, data: updatedData });
    } catch (error) {
      logService.log('error', `Failed to refresh market data for ${symbol}`, error, 'EnhancedMarketDataService');
    }
  }

  /**
   * Calculate technical indicators for candles
   * @param candles Array of candle data
   * @returns Object with calculated indicators
   */
  private async calculateIndicators(candles: any[]): Promise<any> {
    try {
      if (!candles || candles.length === 0) {
        return {};
      }

      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const volumes = candles.map(c => c.volume);

      // Calculate SMA
      const sma20 = this.calculateSMA(closes, 20);
      const sma50 = this.calculateSMA(closes, 50);

      // Calculate EMA
      const ema12 = this.calculateEMA(closes, 12);
      const ema26 = this.calculateEMA(closes, 26);

      // Calculate MACD
      const macd = ema12 - ema26;
      const signal = this.calculateEMA([...Array(closes.length - 26).fill(0), macd], 9);

      // Calculate RSI
      const rsi = this.calculateRSI(closes, 14);

      // Calculate Bollinger Bands
      const middle = sma20;
      const stdDev = this.calculateStdDev(closes, 20);
      const upper = middle + (stdDev * 2);
      const lower = middle - (stdDev * 2);

      // Calculate support and resistance levels
      const supportResistance = this.calculateSupportResistance(highs, lows, closes);

      return {
        sma: { sma20, sma50 },
        ema: { ema12, ema26 },
        macd: { macd, signal, histogram: macd - signal },
        rsi,
        bollingerBands: { upper, middle, lower },
        supportResistance
      };
    } catch (error) {
      logService.log('error', 'Failed to calculate indicators', error, 'EnhancedMarketDataService');
      return {};
    }
  }

  /**
   * Calculate Simple Moving Average
   * @param data Array of price data
   * @param period Period for SMA calculation
   * @returns SMA value
   */
  private calculateSMA(data: number[], period: number): number {
    if (data.length < period) {
      return 0;
    }

    const slice = data.slice(-period);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  }

  /**
   * Calculate Exponential Moving Average
   * @param data Array of price data
   * @param period Period for EMA calculation
   * @returns EMA value
   */
  private calculateEMA(data: number[], period: number): number {
    if (data.length < period) {
      return 0;
    }

    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

    for (let i = period; i < data.length; i++) {
      ema = (data[i] * k) + (ema * (1 - k));
    }

    return ema;
  }

  /**
   * Calculate Relative Strength Index
   * @param data Array of price data
   * @param period Period for RSI calculation
   * @returns RSI value
   */
  private calculateRSI(data: number[], period: number): number {
    if (data.length < period + 1) {
      return 50; // Default to neutral
    }

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = data[data.length - i] - data[data.length - i - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    if (losses === 0) {
      return 100;
    }

    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate Standard Deviation
   * @param data Array of price data
   * @param period Period for calculation
   * @returns Standard deviation value
   */
  private calculateStdDev(data: number[], period: number): number {
    if (data.length < period) {
      return 0;
    }

    const slice = data.slice(-period);
    const avg = slice.reduce((sum, value) => sum + value, 0) / period;
    const squareDiffs = slice.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, value) => sum + value, 0) / period;

    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Calculate support and resistance levels
   * @param highs Array of high prices
   * @param lows Array of low prices
   * @param closes Array of close prices
   * @returns Support and resistance levels
   */
  private calculateSupportResistance(highs: number[], lows: number[], closes: number[]): any {
    try {
      if (highs.length < 10 || lows.length < 10) {
        return { support: 0, resistance: 0 };
      }

      // Find recent swing highs and lows
      const recentHighs = highs.slice(-20);
      const recentLows = lows.slice(-20);

      // Sort to find potential levels
      const sortedHighs = [...recentHighs].sort((a, b) => a - b);
      const sortedLows = [...recentLows].sort((a, b) => a - b);

      // Get current price
      const currentPrice = closes[closes.length - 1];

      // Find nearest resistance (above current price)
      let resistance = 0;
      for (let i = 0; i < sortedHighs.length; i++) {
        if (sortedHighs[i] > currentPrice) {
          resistance = sortedHighs[i];
          break;
        }
      }

      // Find nearest support (below current price)
      let support = 0;
      for (let i = sortedLows.length - 1; i >= 0; i--) {
        if (sortedLows[i] < currentPrice) {
          support = sortedLows[i];
          break;
        }
      }

      return { support, resistance };
    } catch (error) {
      logService.log('error', 'Failed to calculate support and resistance', error, 'EnhancedMarketDataService');
      return { support: 0, resistance: 0 };
    }
  }

  /**
   * Calculate volatility from candle data
   * @param candles Array of candle data
   * @returns Volatility value (0-100)
   */
  private calculateVolatility(candles: any[]): number {
    try {
      if (!candles || candles.length < 10) {
        return 0;
      }

      // Calculate true range for each candle
      const trueRanges: number[] = [];

      for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;

        const tr1 = high - low;
        const tr2 = Math.abs(high - prevClose);
        const tr3 = Math.abs(low - prevClose);

        trueRanges.push(Math.max(tr1, tr2, tr3));
      }

      // Calculate Average True Range (ATR)
      const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;

      // Normalize to a 0-100 scale (this is a simplified approach)
      const avgPrice = candles.reduce((sum, candle) => sum + candle.close, 0) / candles.length;
      const normalizedATR = (atr / avgPrice) * 100;

      // Cap at 100
      return Math.min(normalizedATR * 10, 100);
    } catch (error) {
      logService.log('error', 'Failed to calculate volatility', error, 'EnhancedMarketDataService');
      return 0;
    }
  }

  /**
   * Identify trend from candle data
   * @param candles Array of candle data
   * @returns Trend ('up', 'down', or 'sideways')
   */
  private identifyTrend(candles: any[]): string {
    try {
      if (!candles || candles.length < 10) {
        return 'sideways';
      }

      const closes = candles.map(candle => candle.close);

      // Calculate short-term and long-term moving averages
      const shortTermMA = this.calculateSMA(closes, 5);
      const longTermMA = this.calculateSMA(closes, 20);

      // Calculate price change percentage
      const startPrice = closes[0];
      const endPrice = closes[closes.length - 1];
      const priceChangePercent = ((endPrice - startPrice) / startPrice) * 100;

      // Determine trend based on moving averages and price change
      if (shortTermMA > longTermMA && priceChangePercent > 1) {
        return 'up';
      } else if (shortTermMA < longTermMA && priceChangePercent < -1) {
        return 'down';
      } else {
        return 'sideways';
      }
    } catch (error) {
      logService.log('error', 'Failed to identify trend', error, 'EnhancedMarketDataService');
      return 'sideways';
    }
  }

  /**
   * Handle WebSocket message
   * @param message WebSocket message
   */
  private handleWebSocketMessage(message: any): void {
    try {
      // Only process relevant messages
      if (message.type === 'ticker' && message.data && message.data.symbol) {
        const symbol = message.data.symbol;

        // Find all cache keys for this symbol
        const keysToUpdate: string[] = [];

        cacheService.getKeys(this.CACHE_NAMESPACE).forEach(key => {
          if (key.startsWith(`${symbol}:`)) {
            keysToUpdate.push(key);
          }
        });

        // Update each cached item
        keysToUpdate.forEach(key => {
          const cachedData = cacheService.get(key, this.CACHE_NAMESPACE);
          if (cachedData) {
            cachedData.currentPrice = message.data.last;
            cachedData.timestamp = Date.now();
            cacheService.set(key, cachedData, this.CACHE_NAMESPACE, this.CACHE_TTL);
          }
        });
      }
    } catch (error) {
      logService.log('error', 'Failed to handle WebSocket message', error, 'EnhancedMarketDataService');
    }
  }

  /**
   * Handle market data update event
   * @param data Event data
   */
  private handleMarketDataUpdate(data: any): void {
    try {
      if (data && data.symbol) {
        // Find all cache keys for this symbol
        const keysToUpdate: string[] = [];

        cacheService.getKeys(this.CACHE_NAMESPACE).forEach(key => {
          if (key.startsWith(`${data.symbol}:`)) {
            keysToUpdate.push(key);
          }
        });

        // Update each cached item if needed
        keysToUpdate.forEach(key => {
          const cachedData = cacheService.get(key, this.CACHE_NAMESPACE);
          if (cachedData && (!cachedData.timestamp || data.timestamp > cachedData.timestamp)) {
            // Only update if the new data is newer
            cacheService.set(key, { ...cachedData, ...data.data }, this.CACHE_NAMESPACE, this.CACHE_TTL);
          }
        });
      }
    } catch (error) {
      logService.log('error', 'Failed to handle market data update', error, 'EnhancedMarketDataService');
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Clear all update intervals
    this.updateIntervals.forEach(interval => clearInterval(interval));
    this.updateIntervals.clear();

    // Clear external cache
    try {
      cacheService.clearNamespace(this.CACHE_NAMESPACE);
    } catch (error) {
      logService.log('warn', 'Failed to clear external cache', error, 'EnhancedMarketDataService');
    }

    // Clear in-memory cache
    this.marketDataCache.clear();

    // Reset initialization flag
    this.initialized = false;

    logService.log('info', 'Enhanced market data service cleaned up', null, 'EnhancedMarketDataService');
  }
}

export const enhancedMarketDataService = EnhancedMarketDataService.getInstance();
