import { logService } from './log-service';
import { EventEmitter } from './event-emitter';
import type { Strategy } from './types';

class MarketService extends EventEmitter {
  private monitoredStrategies: Set<string> = new Set();
  private marketData: Map<string, any> = new Map();
  private intervalIds: Map<string, NodeJS.Timer> = new Map();
  private readonly UPDATE_INTERVAL = 5000; // 5 seconds

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    try {
      logService.log('info', 'Initializing market service', null, 'MarketService');
      // Any initialization logic here
      return Promise.resolve();
    } catch (error) {
      logService.log('error', 'Failed to initialize market service', error, 'MarketService');
      throw error;
    }
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
      // Use window.clearInterval to avoid TypeScript errors
      // This is safe because we're in a browser environment
      window.clearInterval(intervalId as unknown as number);
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

  private async fetchMarketData(_strategy: Strategy): Promise<any> {
    // This is a placeholder implementation that would be replaced with actual market data fetching
    // For now, we're just returning an empty object to avoid errors
    return {
      price: 0,
      high24h: 0,
      low24h: 0,
      volume24h: 0,
      recentTrades: [],
      orderBook: { bids: [], asks: [] }
    };
  }

  private async analyzeMarketConditions(
    strategy: Strategy,
    data: any
  ): Promise<any> {
    try {
      // Check if strategy has indicators in its strategy_config
      const strategyConfig = strategy.strategy_config || {};
      const indicators = strategyConfig.indicators ? await Promise.all(
        strategyConfig.indicators.map((config: any) => {
          // Safely handle indicator calculation
          try {
            // Dynamically import to avoid circular dependencies
            const { indicatorService } = require('./indicator-service');
            return indicatorService.calculateIndicator(config, data?.recentTrades || []);
          } catch (error) {
            logService.log('warn', `Failed to calculate indicator`, error, 'MarketService');
            return { name: config?.type || 'unknown', value: 0, timestamp: Date.now() };
          }
        })
      ) : [];

      // Create a safe result object with default values
      const result = {
        timestamp: Date.now(),
        volatility: 0,
        trend: 'neutral' as 'bullish' | 'bearish' | 'neutral',
        liquidity: 'medium' as 'high' | 'medium' | 'low',
        indicators: {}
      };

      // Safely calculate volatility if data is available
      if (data && typeof data.price === 'number' && typeof data.high24h === 'number' && typeof data.low24h === 'number') {
        result.volatility = this.calculateVolatility(data);
      }

      // Safely analyze trend if indicators are available
      if (Array.isArray(indicators) && indicators.length > 0) {
        result.trend = this.analyzeTrend(indicators);
      }

      // Safely analyze liquidity if order book is available
      if (data && data.orderBook) {
        result.liquidity = this.analyzeLiquidity(data.orderBook);
      }

      // Safely reduce indicators to a map
      if (Array.isArray(indicators)) {
        result.indicators = indicators.reduce((acc: Record<string, any>, ind: any) => {
          if (ind && typeof ind.name === 'string' && 'value' in ind) {
            acc[ind.name] = ind.value;
          }
          return acc;
        }, {});
      }

      return result;
    } catch (error) {
      logService.log('error', 'Failed to analyze market conditions',
        error, 'MarketService');
      throw error;
    }
  }

  private calculateVolatility(data: any): number {
    try {
      if (!data || typeof data.high24h !== 'number' || typeof data.low24h !== 'number' || typeof data.price !== 'number' || data.price === 0) {
        return 0;
      }
      const range = data.high24h - data.low24h;
      return (range / data.price) * 100;
    } catch (error) {
      logService.log('warn', 'Failed to calculate volatility', error, 'MarketService');
      return 0;
    }
  }

  private analyzeTrend(_indicators: any[]): 'bullish' | 'bearish' | 'neutral' {
    try {
      // Implement trend analysis logic based on indicators
      // This is a placeholder implementation that could be expanded with actual logic
      // For now, we're just returning a default value to avoid errors
      return 'neutral';
    } catch (error) {
      logService.log('warn', 'Failed to analyze trend', error, 'MarketService');
      return 'neutral';
    }
  }

  private analyzeLiquidity(_orderBook: any): 'high' | 'medium' | 'low' {
    try {
      // Implement liquidity analysis logic based on order book
      // This is a placeholder implementation that could be expanded with actual logic
      // For now, we're just returning a default value to avoid errors
      return 'medium';
    } catch (error) {
      logService.log('warn', 'Failed to analyze liquidity', error, 'MarketService');
      return 'medium';
    }
  }

  /**
   * Generate initial trades for a newly activated strategy
   * This method is called when a strategy is first activated
   * @param strategy The strategy to generate trades for
   */
  async generateInitialTrades(strategy: Strategy): Promise<void> {
    try {
      // Import dynamically to avoid circular dependencies
      const { tradeService } = await import('./trade-service');
      const { tradeGenerator } = await import('./trade-generator');

      // Get the strategy budget - getBudget is not async so no need for await
      const budget = tradeService.getBudget(strategy.id);
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

      // Import additional services
      const { demoService } = await import('./demo-service');
      const { exchangeService } = await import('./exchange-service');

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

      try {
        // Add the strategy to the trade generator if it's not already there
        // Use type assertion to handle potential type mismatch
        await tradeGenerator.addStrategy(strategy as any);

        // Trigger a check for trade opportunities
        await tradeGenerator.checkTradeOpportunities(strategy.id);
      } catch (error) {
        logService.log('error', `Failed to add strategy to trade generator: ${strategy.id}`, error, 'MarketService');
        // Continue execution - don't throw here to prevent interval disruption
      }

      logService.log('info', `Trade generation triggered for strategy ${strategy.id}`, null, 'MarketService');
    } catch (error) {
      logService.log('error', `Failed to generate initial trades for strategy ${strategy.id}`, error, 'MarketService');
    }
  }
}

// Create and export a singleton instance
export const marketService = new MarketService();
