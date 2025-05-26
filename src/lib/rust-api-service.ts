import { apiClient } from './api-client';
import { logService } from './log-service';
import { eventBus } from './event-bus';
import type { Strategy } from './types';

/**
 * Service for integrating with the Rust Trading API
 * Provides high-level methods for trading operations
 */
class RustApiService {
  private static instance: RustApiService;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): RustApiService {
    if (!RustApiService.instance) {
      RustApiService.instance = new RustApiService();
    }
    return RustApiService.instance;
  }

  /**
   * Initialize the Rust API service
   */
  public async initialize(): Promise<boolean> {
    try {
      await apiClient.initialize();
      const health = await apiClient.checkHealth();
      this.isInitialized = health.status === 'ok';

      if (this.isInitialized) {
        logService.log('info', 'Rust API service initialized successfully', health, 'RustApiService');
      } else {
        logService.log('warn', 'Rust API service initialization failed', health, 'RustApiService');
      }

      return this.isInitialized;
    } catch (error) {
      logService.log('error', 'Failed to initialize Rust API service', error, 'RustApiService');
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Check if the service is initialized and API is available
   */
  public isAvailable(): boolean {
    return this.isInitialized;
  }

  // ===== STRATEGY OPERATIONS =====

  /**
   * Create a strategy using the Rust API
   */
  public async createStrategy(strategyData: Partial<Strategy>): Promise<Strategy> {
    try {
      const strategy = await apiClient.createStrategy(strategyData);
      eventBus.emit('strategy:created', strategy);
      logService.log('info', 'Strategy created via Rust API', { id: strategy.id }, 'RustApiService');
      return strategy;
    } catch (error) {
      logService.log('error', 'Failed to create strategy via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  /**
   * Activate a strategy using the Rust API
   */
  public async activateStrategy(strategyId: string): Promise<Strategy> {
    try {
      const strategy = await apiClient.activateStrategy(strategyId);
      eventBus.emit('strategy:activated', { strategyId, strategy });
      logService.log('info', 'Strategy activated via Rust API', { id: strategyId }, 'RustApiService');
      return strategy;
    } catch (error) {
      logService.log('error', 'Failed to activate strategy via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  /**
   * Generate trades for a strategy using AI
   */
  public async generateTrades(strategyId: string, marketData: any): Promise<any[]> {
    try {
      const trades = await apiClient.generateTrades(strategyId, marketData);
      eventBus.emit('trades:generated', { strategyId, trades });
      logService.log('info', `Generated ${trades.length} trades via Rust API`, { strategyId }, 'RustApiService');
      return trades;
    } catch (error) {
      logService.log('error', 'Failed to generate trades via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  // ===== TRADE OPERATIONS =====

  /**
   * Get all trades using the Rust API
   */
  public async getTrades(params?: { status?: string; strategy_id?: string }): Promise<any[]> {
    try {
      const trades = await apiClient.getTrades(params);
      logService.log('debug', `Fetched ${trades.length} trades via Rust API`, params, 'RustApiService');
      return trades;
    } catch (error) {
      logService.log('error', 'Failed to fetch trades via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  /**
   * Get a specific trade by ID
   */
  public async getTrade(tradeId: string): Promise<any> {
    try {
      const trade = await apiClient.getTrade(tradeId);
      logService.log('debug', 'Trade fetched via Rust API', { tradeId }, 'RustApiService');
      return trade;
    } catch (error) {
      logService.log('error', 'Failed to fetch trade via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  /**
   * Create a trade using the Rust API
   */
  public async createTrade(tradeData: any): Promise<any> {
    try {
      const trade = await apiClient.createTrade(tradeData);
      eventBus.emit('trade:created', trade);
      logService.log('info', 'Trade created via Rust API', { tradeId: trade.id }, 'RustApiService');
      return trade;
    } catch (error) {
      logService.log('error', 'Failed to create trade via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  /**
   * Execute a trade using the Rust API
   */
  public async executeTrade(tradeId: string): Promise<any> {
    try {
      const result = await apiClient.executeTrade(tradeId);
      eventBus.emit('trade:executed', { tradeId, result });
      logService.log('info', 'Trade executed via Rust API', { tradeId }, 'RustApiService');
      return result;
    } catch (error) {
      logService.log('error', 'Failed to execute trade via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  /**
   * Close a trade using the Rust API
   */
  public async closeTrade(tradeId: string): Promise<any> {
    try {
      const result = await apiClient.closeTrade(tradeId);
      eventBus.emit('trade:closed', { tradeId, result });
      logService.log('info', 'Trade closed via Rust API', { tradeId }, 'RustApiService');
      return result;
    } catch (error) {
      logService.log('error', 'Failed to close trade via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  // ===== MARKET DATA OPERATIONS =====

  /**
   * Get real-time market data for a symbol
   */
  public async getMarketData(symbol: string): Promise<any> {
    try {
      const data = await apiClient.getMarketData(symbol);
      logService.log('debug', 'Market data fetched via Rust API', { symbol }, 'RustApiService');
      return data;
    } catch (error) {
      logService.log('error', 'Failed to fetch market data via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  /**
   * Get candlestick data for a symbol
   */
  public async getCandles(symbol: string, timeframe: string, limit: number): Promise<any[]> {
    try {
      const candles = await apiClient.getCandles(symbol, timeframe, limit);
      logService.log('debug', `Fetched ${candles.length} candles via Rust API`, { symbol, timeframe }, 'RustApiService');
      return candles;
    } catch (error) {
      logService.log('error', 'Failed to fetch candles via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  /**
   * Get order book data for a symbol
   */
  public async getOrderBook(symbol: string, limit: number = 20): Promise<any> {
    try {
      const orderBook = await apiClient.getOrderBook(symbol, limit);
      logService.log('debug', 'Order book fetched via Rust API', { symbol, limit }, 'RustApiService');
      return orderBook;
    } catch (error) {
      logService.log('error', 'Failed to fetch order book via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  // ===== EXCHANGE OPERATIONS =====

  /**
   * Get account balance from the exchange
   */
  public async getBalance(): Promise<any> {
    try {
      const balance = await apiClient.getBalance();
      logService.log('debug', 'Balance fetched via Rust API', null, 'RustApiService');
      return balance;
    } catch (error) {
      logService.log('error', 'Failed to fetch balance via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  /**
   * Create an order on the exchange
   */
  public async createOrder(orderData: any): Promise<any> {
    try {
      const order = await apiClient.createOrder(orderData);
      eventBus.emit('order:created', order);
      logService.log('info', 'Order created via Rust API', { orderId: order.id }, 'RustApiService');
      return order;
    } catch (error) {
      logService.log('error', 'Failed to create order via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  /**
   * Get open orders from the exchange
   */
  public async getOpenOrders(symbol?: string): Promise<any[]> {
    try {
      const orders = await apiClient.getOpenOrders(symbol);
      logService.log('debug', `Fetched ${orders.length} open orders via Rust API`, { symbol }, 'RustApiService');
      return orders;
    } catch (error) {
      logService.log('error', 'Failed to fetch open orders via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  // ===== BATCH OPERATIONS =====

  /**
   * Get comprehensive market overview for multiple symbols
   */
  public async getMarketOverview(symbols: string[]): Promise<any[]> {
    try {
      const promises = symbols.map(symbol => this.getMarketData(symbol));
      const results = await Promise.allSettled(promises);

      const marketData = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value);

      logService.log('info', `Fetched market overview for ${marketData.length}/${symbols.length} symbols`,
        { symbols: symbols.length }, 'RustApiService');

      return marketData;
    } catch (error) {
      logService.log('error', 'Failed to fetch market overview via Rust API', error, 'RustApiService');
      throw error;
    }
  }

  /**
   * Get portfolio performance data
   */
  public async getPortfolioPerformance(strategyIds: string[]): Promise<any> {
    try {
      const promises = strategyIds.map(id => apiClient.getStrategy(id));
      const strategies = await Promise.all(promises);

      // Calculate portfolio metrics
      const totalValue = strategies.reduce((sum, strategy) => sum + (strategy.performance || 0), 0);
      const activeStrategies = strategies.filter(s => s.status === 'active').length;

      const performance = {
        totalValue,
        activeStrategies,
        totalStrategies: strategies.length,
        strategies: strategies
      };

      logService.log('info', 'Portfolio performance calculated via Rust API',
        { strategies: strategies.length }, 'RustApiService');

      return performance;
    } catch (error) {
      logService.log('error', 'Failed to calculate portfolio performance via Rust API', error, 'RustApiService');
      throw error;
    }
  }
}

// Export singleton instance
export const rustApiService = RustApiService.getInstance();
