import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { ccxtService } from './ccxt-service';
import { indicatorService } from './indicators';
import type { MarketData, Strategy, MarketCondition } from './types';

export class MarketService extends EventEmitter {
  private static instance: MarketService;
  private marketData: Map<string, MarketData> = new Map();
  private monitoredStrategies: Set<string> = new Set();
  private intervalIds: Map<string, NodeJS.Timer> = new Map();

  private readonly UPDATE_INTERVAL = 60000; // 1 minute
  private readonly MARKET_CONDITIONS_CHECK_INTERVAL = 300000; // 5 minutes

  private constructor() {
    super();
  }

  static getInstance(): MarketService {
    if (!MarketService.instance) {
      MarketService.instance = new MarketService();
    }
    return MarketService.instance;
  }

  async startStrategyMonitoring(strategy: Strategy): Promise<void> {
    try {
      if (this.monitoredStrategies.has(strategy.id)) {
        return;
      }

      this.monitoredStrategies.add(strategy.id);
      await this.initializeMarketData(strategy);

      const intervalId = setInterval(
        () => this.updateMarketData(strategy),
        this.UPDATE_INTERVAL
      );
      this.intervalIds.set(strategy.id, intervalId);

      // Generate initial trades for the strategy
      await this.generateInitialTrades(strategy);

      logService.log('info', `Started monitoring strategy: ${strategy.id}`,
        { strategyId: strategy.id }, 'MarketService');
    } catch (error) {
      logService.log('error', `Failed to start monitoring strategy: ${strategy.id}`,
        error, 'MarketService');
      throw error;
    }
  }

  async stopStrategyMonitoring(strategyId: string): Promise<void> {
    const intervalId = this.intervalIds.get(strategyId);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervalIds.delete(strategyId);
      this.monitoredStrategies.delete(strategyId);
      this.marketData.delete(strategyId);

      logService.log('info', `Stopped monitoring strategy: ${strategyId}`,
        { strategyId }, 'MarketService');
    }
  }

  private async initializeMarketData(strategy: Strategy): Promise<void> {
    try {
      const data = await this.fetchMarketData(strategy);
      this.marketData.set(strategy.id, data);
      this.emit('marketDataUpdated', { strategyId: strategy.id, data });
    } catch (error) {
      logService.log('error', `Failed to initialize market data for strategy: ${strategy.id}`,
        error, 'MarketService');
      throw error;
    }
  }

  private async updateMarketData(strategy: Strategy): Promise<void> {
    try {
      const data = await this.fetchMarketData(strategy);
      this.marketData.set(strategy.id, data);

      const marketConditions = await this.analyzeMarketConditions(strategy, data);
      this.emit('marketDataUpdated', {
        strategyId: strategy.id,
        data,
        marketConditions
      });
    } catch (error) {
      logService.log('error', `Failed to update market data for strategy: ${strategy.id}`,
        error, 'MarketService');
      // Don't throw here to prevent interval disruption
    }
  }

  private async fetchMarketData(strategy: Strategy): Promise<MarketData> {
    // Check if ccxtService is properly initialized and has the executeWithRetry method
    if (!this.ccxtService || typeof this.ccxtService.executeWithRetry !== 'function') {
      logService.log('error', 'CCXT Service not properly initialized', { strategy }, 'MarketService');

      // Return default market data to prevent errors
      return {
        ticker: {
          symbol: strategy.symbol || 'BTC/USDT',
          last: 0,
          bid: 0,
          ask: 0,
          high: 0,
          low: 0,
          volume: 0,
          timestamp: Date.now()
        },
        orderBook: {
          bids: [],
          asks: [],
          timestamp: Date.now()
        },
        trades: [],
        timestamp: Date.now()
      };
    }

    try {
      return await this.ccxtService.executeWithRetry(
        async () => {
          const ticker = await this.ccxtService.fetchTicker(strategy.symbol);
          const orderBook = await this.ccxtService.fetchOrderBook(strategy.symbol);
          const trades = await this.ccxtService.fetchRecentTrades(strategy.symbol);

        return {
          timestamp: Date.now(),
          symbol: strategy.symbol,
          price: ticker.last,
          volume: ticker.baseVolume,
          high24h: ticker.high,
          low24h: ticker.low,
          orderBook,
          recentTrades: trades,
        };
      },
      `fetchMarketData-${strategy.id}`
    );
    } catch (error) {
      logService.log('error', 'Failed to fetch market data', { error, strategy }, 'MarketService');

      // Return default market data to prevent errors
      return {
        timestamp: Date.now(),
        symbol: strategy.symbol || 'BTC/USDT',
        price: 0,
        volume: 0,
        high24h: 0,
        low24h: 0,
        orderBook: {
          bids: [],
          asks: [],
          timestamp: Date.now()
        },
        recentTrades: [],
      };
    }
  }

  private async analyzeMarketConditions(
    strategy: Strategy,
    data: MarketData
  ): Promise<MarketCondition> {
    try {
      const indicators = await Promise.all(
        strategy.indicators.map(config =>
          IndicatorService.calculateIndicator(config, data.recentTrades)
        )
      );

      return {
        timestamp: Date.now(),
        volatility: this.calculateVolatility(data),
        trend: this.analyzeTrend(indicators),
        liquidity: this.analyzeLiquidity(data.orderBook),
        indicators: indicators.reduce((acc, ind) => ({
          ...acc,
          [ind.name]: ind.value
        }), {})
      };
    } catch (error) {
      logService.log('error', 'Failed to analyze market conditions',
        error, 'MarketService');
      throw error;
    }
  }

  private calculateVolatility(data: MarketData): number {
    const range = data.high24h - data.low24h;
    return (range / data.price) * 100;
  }

  private analyzeTrend(indicators: any[]): 'bullish' | 'bearish' | 'neutral' {
    // Implement trend analysis logic based on indicators
    // This is a placeholder implementation
    return 'neutral';
  }

  private analyzeLiquidity(orderBook: any): 'high' | 'medium' | 'low' {
    // Implement liquidity analysis logic based on order book
    // This is a placeholder implementation
    return 'medium';
  }

  /**
   * Generate initial trades for a newly activated strategy
   * @param strategy The strategy to generate trades for
   */
  private async generateInitialTrades(strategy: Strategy): Promise<void> {
    try {
      // Import dynamically to avoid circular dependencies
      const { tradeManager } = await import('./trade-manager');
      const { demoService } = await import('./demo-service');
      const { tradeService } = await import('./trade-service');
      const { tradeGenerator } = await import('./trade-generator');
      const { exchangeService } = await import('./exchange-service');

      // Get the strategy budget
      const budget = await tradeService.getBudget(strategy.id);
      if (!budget || budget.available <= 0) {
        logService.log('warn', `No budget available for strategy ${strategy.id}`, null, 'MarketService');
        return;
      }

      // Get market data
      const marketData = this.marketData.get(strategy.id);
      if (!marketData) {
        logService.log('warn', `No market data available for strategy ${strategy.id}`, null, 'MarketService');
        return;
      }

      // Check if we're in demo mode or using a live exchange
      const isDemoMode = demoService.isDemoMode();
      const isExchangeConnected = await exchangeService.isConnected();

      logService.log('info', `Generating initial trades for strategy ${strategy.id}`, {
        isDemoMode,
        isExchangeConnected,
        budget: budget.available
      }, 'MarketService');

      // Let DeepSeek decide whether to generate trades
      // We'll just trigger the trade generator and let it handle the decision-making
      logService.log('info', `Triggering trade generation for strategy ${strategy.id}`, null, 'MarketService');

      // Add the strategy to the trade generator if it's not already there
      await tradeGenerator.addStrategy(strategy);

      // Trigger a check for trade opportunities
      await tradeGenerator.checkTradeOpportunities(strategy.id);

      logService.log('info', `Trade generation triggered for strategy ${strategy.id}`, null, 'MarketService');
    } catch (error) {
      logService.log('error', `Failed to generate initial trades for strategy ${strategy.id}`, error, 'MarketService');
    }
  }
}

export const marketService = MarketService.getInstance();
