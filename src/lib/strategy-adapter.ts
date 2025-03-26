import { Strategy, MarketConditions } from './types';
import { logService } from './log-service';
import { marketMonitor } from './market-monitor';
import { AIService } from './ai-service';

export class StrategyAdapter {
  private static instance: StrategyAdapter;
  private readonly ADAPTATION_THRESHOLD = 0.15; // 15% market condition change

  private constructor() {}

  static getInstance(): StrategyAdapter {
    if (!StrategyAdapter.instance) {
      StrategyAdapter.instance = new StrategyAdapter();
    }
    return StrategyAdapter.instance;
  }

  async shouldAdaptStrategy(strategy: Strategy): Promise<boolean> {
    const currentConditions = await marketMonitor.getMarketConditions();
    const strategyConditions = strategy.market_conditions;

    // Calculate condition differences
    const volatilityDiff = Math.abs(currentConditions.volatility - strategyConditions.volatility);
    const trendDiff = Math.abs(currentConditions.trend - strategyConditions.trend);

    return volatilityDiff > this.ADAPTATION_THRESHOLD || trendDiff > this.ADAPTATION_THRESHOLD;
  }

  async adaptStrategy(strategy: Strategy): Promise<Strategy> {
    try {
      const currentConditions = await marketMonitor.getMarketConditions();
      const marketData = await this.getMarketData(strategy.strategy_config.assets);

      const prompt = `Adapt the following trading strategy to current market conditions:

Original Strategy:
${JSON.stringify(strategy, null, 2)}

Current Market Conditions:
${JSON.stringify(currentConditions, null, 2)}

Market Data:
${JSON.stringify(marketData, null, 2)}

Requirements:
1. Preserve the original strategy's core logic
2. Adjust parameters to match current market conditions
3. Update risk management rules if needed
4. Modify indicators and thresholds appropriately
5. Keep the same assets and market type
6. Return complete strategy in strict JSON format

Focus on these adaptations:
- Adjust indicator parameters for current volatility
- Update position sizing for risk management
- Modify entry/exit rules based on market trend
- Adjust stop-loss and take-profit levels
- Add any necessary market filters

Return the adapted strategy in the exact same JSON structure as the input.`;

      const adaptedStrategy = await AIService.generateStrategy(
        prompt,
        strategy.risk_level,
        {
          timeframe: strategy.timeframe,
          marketType: strategy.market_type,
          marketConditions: currentConditions
        }
      );

      logService.log('info', `Strategy ${strategy.id} adapted to current market conditions`, 
        { 
          originalStrategy: strategy.id,
          adaptedStrategy: adaptedStrategy.id
        }, 
        'StrategyAdapter'
      );

      return adaptedStrategy;
    } catch (error) {
      logService.log('error', `Failed to adapt strategy ${strategy.id}`, error, 'StrategyAdapter');
      throw error;
    }
  }

  private async getMarketData(assets: string[]): Promise<any> {
    return Promise.all(assets.map(async (asset) => {
      const ticker = await ccxtService.fetchTicker(asset);
      const historicalData = await marketMonitor.getHistoricalData(asset, 100);
      return {
        asset,
        currentPrice: ticker.last_price,
        volume24h: ticker.quote_volume_24h,
        priceHistory: historicalData
      };
    }));
  }
}

export const strategyAdapter = StrategyAdapter.getInstance();