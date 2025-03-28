import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { CCXTService } from './ccxt-service';
import { indicatorService } from './indicators';
import type { MarketData, Strategy, MarketCondition } from './types';

export class MarketService extends EventEmitter {
  private static instance: MarketService;
  private ccxtService: CCXTService;
  private marketData: Map<string, MarketData> = new Map();
  private monitoredStrategies: Set<string> = new Set();
  private intervalIds: Map<string, NodeJS.Timer> = new Map();

  private readonly UPDATE_INTERVAL = 60000; // 1 minute
  private readonly MARKET_CONDITIONS_CHECK_INTERVAL = 300000; // 5 minutes

  private constructor() {
    super();
    this.ccxtService = CCXTService.getInstance();
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
}

export const marketService = new MarketService();
