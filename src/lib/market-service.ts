import { logService } from './log-service';
import { EventEmitter } from './event-emitter';
import type { Strategy } from './types';
import { demoService } from './demo-service';
import { rustApiService } from './rust-api-service';

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

  private async fetchMarketData(strategy: Strategy): Promise<any> {
    try {
      // Initialize Rust API service
      const isApiAvailable = await rustApiService.initialize();

      if (isApiAvailable && strategy.selected_pairs && strategy.selected_pairs.length > 0) {
        // Use the first selected pair for market data
        const symbol = strategy.selected_pairs[0];

        try {
          // Try to get market data from Rust API
          const marketData = await rustApiService.getMarketData(symbol);
          logService.log('debug', `Fetched market data via Rust API for ${symbol}`, null, 'MarketService');
          return marketData;
        } catch (apiError) {
          logService.log('warn', `Failed to fetch market data via Rust API for ${symbol}, using fallback`, apiError, 'MarketService');
        }
      }

      // Fallback to mock data
      return {
        price: 50000 + Math.random() * 1000, // Mock price with some variation
        high24h: 52000,
        low24h: 48000,
        volume24h: 1000000000,
        recentTrades: [],
        orderBook: { bids: [], asks: [] },
        timestamp: Date.now()
      };
    } catch (error) {
      logService.log('error', 'Failed to fetch market data', error, 'MarketService');
      // Return fallback data
      return {
        price: 50000,
        high24h: 52000,
        low24h: 48000,
        volume24h: 1000000000,
        recentTrades: [],
        orderBook: { bids: [], asks: [] },
        timestamp: Date.now()
      };
    }
  }

  private async analyzeMarketConditions(
    strategy: Strategy,
    data: any
  ): Promise<any> {
    try {
      // Check if strategy has indicators in its strategy_config
      const strategyConfig = strategy.strategy_config || {};
      let indicators = [];

      // Safely check if indicators is an array before trying to map over it
      if (strategyConfig.indicators && Array.isArray(strategyConfig.indicators)) {
        try {
          indicators = await Promise.all(
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
          );
        } catch (error) {
          logService.log('error', 'Error processing indicators array', error, 'MarketService');
          // Continue with empty indicators array
        }
      } else {
        logService.log('debug', `Strategy ${strategy.id} has no indicators or indicators is not an array`,
          { hasIndicators: !!strategyConfig.indicators, isArray: Array.isArray(strategyConfig.indicators) },
          'MarketService');
      }

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

      // Get the strategy budget - getBudget is not async so no need for await
      const budget = tradeService.getBudget(strategy.id);
      if (!budget || budget.available <= 0) {
        logService.log('warn', `No budget available for strategy ${strategy.id}`, null, 'MarketService');
        return;
      }

      // Get market data
      let marketData = this.marketData.get(strategy.id);
      if (!marketData) {
        // Try to fetch fresh market data
        marketData = await this.fetchMarketData(strategy);
        this.marketData.set(strategy.id, marketData);
      }

      logService.log('info', `Generating initial trades for strategy ${strategy.id} via Rust API`, {
        budget: budget.available,
        hasMarketData: !!marketData
      }, 'MarketService');

      // Try to use Rust API for trade generation
      const isApiAvailable = await rustApiService.initialize();

      if (isApiAvailable) {
        try {
          // Use Rust API to generate trades
          const trades = await rustApiService.generateTrades(strategy.id, {
            symbols: strategy.selected_pairs || ['BTC/USDT'],
            marketConditions: await this.analyzeMarketConditions(strategy, marketData),
            budget: budget.available,
            riskLevel: strategy.riskLevel || 'Medium',
            marketType: strategy.market_type || 'spot'
          });

          logService.log('info', `Generated ${trades.length} trades via Rust API for strategy ${strategy.id}`, null, 'MarketService');
          return;
        } catch (apiError) {
          logService.log('warn', `Failed to generate trades via Rust API for strategy ${strategy.id}, falling back to trade generator`, apiError, 'MarketService');
        }
      }

      // Fallback to existing trade generator
      try {
        const { tradeGenerator } = await import('./trade-generator');

        // Add the strategy to the trade generator if it's not already there
        await tradeGenerator.addStrategy(strategy as any);

        // Trigger a check for trade opportunities
        await tradeGenerator.checkTradeOpportunities(strategy.id);

        logService.log('info', `Trade generation triggered via fallback for strategy ${strategy.id}`, null, 'MarketService');
      } catch (error) {
        logService.log('error', `Failed to generate trades for strategy ${strategy.id}`, error, 'MarketService');
      }
    } catch (error) {
      logService.log('error', `Failed to generate initial trades for strategy ${strategy.id}`, error, 'MarketService');
    }
  }

  // Removed duplicate analyzeMarketConditions method

  /**
   * Get available trading pairs
   * @returns Array of available trading pairs in the format 'BTC_USDT'
   */
  async getAvailablePairs(): Promise<string[]> {
    try {
      // Common trading pairs
      const commonPairs = [
        'BTC_USDT', 'ETH_USDT', 'BNB_USDT', 'SOL_USDT', 'ADA_USDT',
        'XRP_USDT', 'DOT_USDT', 'DOGE_USDT', 'AVAX_USDT', 'MATIC_USDT',
        'LINK_USDT', 'UNI_USDT', 'ATOM_USDT', 'LTC_USDT', 'BCH_USDT',
        'ALGO_USDT', 'XLM_USDT', 'FIL_USDT', 'TRX_USDT', 'ETC_USDT'
      ];

      // In a real implementation, we would fetch this from the exchange
      // For now, we'll just return a static list of common pairs
      logService.log('info', 'Returning available trading pairs', { count: commonPairs.length }, 'MarketService');

      return commonPairs;
    } catch (error) {
      logService.log('error', 'Failed to get available trading pairs', error, 'MarketService');
      // Return a minimal set of pairs as fallback
      return ['BTC_USDT', 'ETH_USDT', 'SOL_USDT'];
    }
  }

  /**
   * Get market data for a specific trading pair
   * @param symbol Trading pair symbol (e.g., 'BTC_USDT')
   * @returns Market data for the specified pair
   */
  async getMarketData(symbol: string): Promise<any> {
    try {
      // In a real implementation, we would fetch this from the exchange
      // For now, we'll just return mock data
      const normalizedSymbol = symbol.replace('_', '/');

      // Import dynamically to avoid circular dependencies
      const { exchangeService } = await import('./exchange-service');

      // Check if we're in demo mode
      const isDemoMode = demoService.isDemoMode();

      if (isDemoMode) {
        // In demo mode, use mock data
        return {
          symbol: normalizedSymbol,
          price: 50000, // Mock price
          high24h: 52000,
          low24h: 48000,
          volume24h: 1000000000,
          timestamp: Date.now()
        };
      } else {
        // In live mode, try to get data from the exchange
        try {
          const price = await exchangeService.fetchMarketPrice(normalizedSymbol);
          return {
            symbol: normalizedSymbol,
            price: price.price,
            high24h: price.price * 1.05, // Estimate
            low24h: price.price * 0.95, // Estimate
            volume24h: 1000000000, // Mock volume
            timestamp: price.timestamp
          };
        } catch (error) {
          logService.log('error', `Failed to fetch market data for ${symbol}`, error, 'MarketService');
          // Return mock data as fallback
          return {
            symbol: normalizedSymbol,
            price: 50000, // Mock price
            high24h: 52000,
            low24h: 48000,
            volume24h: 1000000000,
            timestamp: Date.now()
          };
        }
      }
    } catch (error) {
      logService.log('error', `Failed to get market data for ${symbol}`, error, 'MarketService');
      // Return mock data as fallback
      return {
        symbol: symbol.replace('_', '/'),
        price: 50000, // Mock price
        high24h: 52000,
        low24h: 48000,
        volume24h: 1000000000,
        timestamp: Date.now()
      };
    }
  }
}

// Create and export a singleton instance
export const marketService = new MarketService();
