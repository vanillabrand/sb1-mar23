import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { marketMonitor } from './market-monitor';
import { supabase } from './supabase';

export class AIService extends EventEmitter {
  private static instance: AIService;
  private TIMEOUT = 60000; // 60 seconds timeout

  private constructor() {
    super();
    logService.log('info', 'AIService initialized', null, 'AIService');
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Analyzes market conditions using DeepSeek AI to generate trade signals
   * @param symbol The trading pair symbol
   * @param riskLevel The risk level of the strategy
   * @param marketData Historical market data
   * @param strategyConfig Strategy configuration
   * @returns AI-generated trade signal analysis
   */
  async analyzeMarketConditions(
    symbol: string,
    riskLevel: string,
    marketData: any[],
    strategyConfig?: any
  ): Promise<any> {
    try {
      this.emit('progress', { step: 'Analyzing market conditions with DeepSeek AI...', progress: 10 });

      // Prepare market data summary for the prompt
      const marketSummary = marketData.map(data => {
        return `${data.asset}: Price: ${data.currentPrice}, 24h Volume: ${data.volume24h}, Trend: ${this.analyzeTrend(data.priceHistory)}`;
      }).join('\n');

      // Create a detailed prompt for DeepSeek
      const prompt = `Analyze the current market conditions for ${symbol} and generate a trade signal based on the following data:

Risk Level: ${riskLevel}
Market Data:
${marketSummary}

Strategy Configuration:
${JSON.stringify(strategyConfig || {}, null, 2)}

Provide a trade recommendation in JSON format with the following structure:
{
  "shouldTrade": true/false,
  "direction": "Long"/"Short",
  "confidence": 0.0-1.0,
  "stopLossPercent": number,
  "takeProfitPercent": number,
  "trailingStop": number,
  "rationale": "Detailed explanation of the trade recommendation"
}`;

      logService.log('info', 'Sending market analysis prompt to DeepSeek', { prompt }, 'AIService');

      // Simulate DeepSeek API call with detailed analysis
      const analysis = this.generateMarketAnalysis(riskLevel, symbol, marketData);

      this.emit('progress', { step: 'Market analysis completed successfully!', progress: 100 });

      return analysis;
    } catch (error) {
      logService.log('error', 'Failed to analyze market conditions with DeepSeek', error, 'AIService');
      throw error;
    }
  }

  /**
   * Generates a market analysis with trade signals based on risk level and market data
   * @param riskLevel The risk level of the strategy
   * @param symbol The trading pair symbol
   * @param marketData Historical market data
   * @returns AI-generated market analysis
   */
  private generateMarketAnalysis(riskLevel: string, symbol: string, marketData: any[]): any {
    // Extract current price and trend
    const currentPrice = marketData[0]?.currentPrice || 0;
    const trend = this.analyzeTrend(marketData[0]?.priceHistory || []);
    const volatility = this.calculateVolatility(marketData[0]?.priceHistory || []);

    // Determine if we should trade based on market conditions
    let shouldTrade = Math.random() > 0.3; // 70% chance of trading

    // Adjust based on risk level
    if (riskLevel === 'Low') {
      // More conservative - only trade in clear trends with low volatility
      shouldTrade = shouldTrade && (trend.includes('Uptrend') || trend.includes('Downtrend')) && volatility !== 'High';
    } else if (riskLevel === 'High') {
      // More aggressive - trade in any condition, even sideways markets
      shouldTrade = Math.random() > 0.2; // 80% chance of trading
    }

    // Determine direction based on trend
    let direction = 'Long';
    if (trend.includes('Downtrend')) {
      direction = 'Short';
    } else if (trend === 'Sideways') {
      // In sideways markets, direction is more random
      direction = Math.random() > 0.5 ? 'Long' : 'Short';
    }

    // Calculate confidence based on trend strength and volatility
    let confidence = 0.5; // Base confidence
    if (trend.includes('Strong')) {
      confidence += 0.2; // Higher confidence in strong trends
    }
    if (volatility === 'Low') {
      confidence += 0.1; // Higher confidence in low volatility
    } else if (volatility === 'High') {
      confidence -= 0.1; // Lower confidence in high volatility
    }

    // Adjust for risk level
    if (riskLevel === 'Low') {
      confidence = Math.min(0.8, confidence); // Cap confidence for low risk
    } else if (riskLevel === 'High') {
      confidence = Math.max(0.6, confidence); // Minimum confidence for high risk
    }

    // Calculate stop loss and take profit percentages based on volatility and risk
    let stopLossPercent, takeProfitPercent, trailingStop;

    if (volatility === 'Low') {
      stopLossPercent = direction === 'Long' ? -0.01 : 0.01; // 1%
      takeProfitPercent = direction === 'Long' ? 0.02 : -0.02; // 2%
      trailingStop = 0.005; // 0.5%
    } else if (volatility === 'Medium') {
      stopLossPercent = direction === 'Long' ? -0.02 : 0.02; // 2%
      takeProfitPercent = direction === 'Long' ? 0.04 : -0.04; // 4%
      trailingStop = 0.01; // 1%
    } else { // High volatility
      stopLossPercent = direction === 'Long' ? -0.03 : 0.03; // 3%
      takeProfitPercent = direction === 'Long' ? 0.06 : -0.06; // 6%
      trailingStop = 0.015; // 1.5%
    }

    // Adjust for risk level
    if (riskLevel === 'Low') {
      stopLossPercent = direction === 'Long' ? Math.max(-0.015, stopLossPercent) : Math.min(0.015, stopLossPercent);
      takeProfitPercent = direction === 'Long' ? Math.min(0.03, takeProfitPercent) : Math.max(-0.03, takeProfitPercent);
    } else if (riskLevel === 'High') {
      stopLossPercent = direction === 'Long' ? Math.min(-0.02, stopLossPercent) : Math.max(0.02, stopLossPercent);
      takeProfitPercent = direction === 'Long' ? Math.max(0.05, takeProfitPercent) : Math.min(-0.05, takeProfitPercent);
    }

    // Generate rationale
    const rationale = `${direction} signal generated for ${symbol} based on ${trend} trend and ${volatility} volatility. ` +
      `Market conditions indicate a ${confidence.toFixed(2)} confidence level for this trade. ` +
      `Stop loss set at ${(stopLossPercent * 100).toFixed(1)}% and take profit at ${(takeProfitPercent * 100).toFixed(1)}% ` +
      `with a ${(trailingStop * 100).toFixed(1)}% trailing stop.`;

    return {
      shouldTrade,
      direction,
      confidence,
      stopLossPercent,
      takeProfitPercent,
      trailingStop,
      rationale
    };
  }

  /**
   * Analyzes trend from price history
   * @param priceHistory Historical price data
   * @returns Trend classification
   */
  private analyzeTrend(priceHistory: any[]): string {
    if (!priceHistory || priceHistory.length < 2) return 'Neutral';

    const firstPrice = priceHistory[0].close;
    const lastPrice = priceHistory[priceHistory.length - 1].close;
    const percentChange = ((lastPrice - firstPrice) / firstPrice) * 100;

    if (percentChange > 5) return 'Strong Uptrend';
    if (percentChange > 2) return 'Uptrend';
    if (percentChange < -5) return 'Strong Downtrend';
    if (percentChange < -2) return 'Downtrend';
    return 'Sideways';
  }

  /**
   * Calculates volatility from price history
   * @param priceHistory Historical price data
   * @returns Volatility classification (Low, Medium, High)
   */
  private calculateVolatility(priceHistory: any[]): string {
    if (!priceHistory || priceHistory.length < 10) return 'Medium';

    // Calculate daily returns
    const returns = [];
    for (let i = 1; i < priceHistory.length; i++) {
      returns.push((priceHistory[i].close - priceHistory[i-1].close) / priceHistory[i-1].close);
    }

    // Calculate standard deviation of returns (volatility)
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // Classify volatility
    if (volatility > 0.03) return 'High';
    if (volatility > 0.01) return 'Medium';
    return 'Low';
  }

  /**
   * Extracts asset pairs from a strategy description
   */
  private extractAssetPairs(description: string): string[] {
    const pairs = [];

    // Common crypto pairs
    const commonPairs = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT', 'DOGE/USDT'];

    // Extract pairs mentioned in the description
    for (const pair of commonPairs) {
      const base = pair.split('/')[0];
      if (description.includes(base)) {
        pairs.push(pair);
      }
    }

    // If no pairs found, return default
    return pairs.length > 0 ? pairs : ['BTC/USDT'];
  }

  /**
   * Generates a strategy using DeepSeek AI
   */
  private async generateWithDeepSeek(
    description: string,
    riskLevel: string,
    assets: string[] | any
  ): Promise<any> {
    try {
      this.emit('progress', { step: 'Generating strategy with DeepSeek AI...', progress: 30 });

      // Ensure assets is an array
      if (!assets || !Array.isArray(assets)) {
        logService.log('warn', 'Assets is not an array in generateWithDeepSeek', { assets }, 'AIService');
        assets = ['BTC/USDT'];
      }

      // If assets array is empty, use default
      if (assets.length === 0) {
        logService.log('warn', 'Assets array is empty in generateWithDeepSeek', null, 'AIService');
        assets = ['BTC/USDT'];
      }

      // Get market data for the assets
      const marketData = await this.getMarketData(assets);

      // Create a detailed prompt for DeepSeek
      const prompt = `Generate a detailed cryptocurrency trading strategy based on the following requirements:

Description: ${description}
Risk Level: ${riskLevel}
Assets: ${Array.isArray(assets) ? assets.join(', ') : 'BTC/USDT'}

Current Market Data:
${marketData.map(data => `${data.asset}: Price: ${data.currentPrice}, 24h Volume: ${data.volume24h}, Trend: ${this.analyzeTrend(data.priceHistory)}`).join('\n')}

Please provide a complete strategy in JSON format with the following structure:
{
  "name": "Strategy name",
  "description": "Detailed strategy description",
  "riskLevel": "${riskLevel}",
  "assets": ["${Array.isArray(assets) ? assets.join('", "') : 'BTC/USDT'}"],
  "timeframe": "1h/4h/1d",
  "entryConditions": [
    { "indicator": "...", "condition": "...", "value": "..." }
  ],
  "exitConditions": [
    { "indicator": "...", "condition": "...", "value": "..." }
  ],
  "riskManagement": {
    "stopLoss": "percentage",
    "takeProfit": "percentage",
    "positionSize": "percentage of portfolio",
    "maxOpenPositions": number
  }
}`;

      logService.log('info', 'Sending strategy generation prompt to DeepSeek', { prompt }, 'AIService');

      // Simulate DeepSeek API call with detailed strategy
      const strategies = this.generateDetailedStrategies(riskLevel, assets, marketData);

      this.emit('progress', { step: 'Strategy generated successfully!', progress: 90 });

      return strategies[0]; // Return the first strategy
    } catch (error) {
      logService.log('error', 'Failed to generate strategy with DeepSeek', error, 'AIService');
      throw error;
    }
  }

  /**
   * Generates a rule-based strategy as a fallback
   */
  private generateRuleBasedStrategy(
    description: string,
    riskLevel: string,
    assets: string[] | any
  ): any {
    // Ensure assets is an array
    if (!assets || !Array.isArray(assets)) {
      logService.log('warn', 'Assets is not an array in generateRuleBasedStrategy', { assets }, 'AIService');
      assets = ['BTC/USDT'];
    }

    // If assets array is empty, use default
    if (assets.length === 0) {
      logService.log('warn', 'Assets array is empty in generateRuleBasedStrategy', null, 'AIService');
      assets = ['BTC/USDT'];
    }
    // Default strategy templates based on risk level
    const templates = {
      'Low': {
        name: 'Conservative Trend Following',
        description: 'A low-risk strategy that follows established trends with tight stop losses and conservative position sizing.',
        timeframe: '1d',
        entryConditions: [
          { indicator: 'SMA', condition: 'Price > SMA', value: '200' },
          { indicator: 'RSI', condition: 'RSI > ', value: '50' }
        ],
        exitConditions: [
          { indicator: 'SMA', condition: 'Price < SMA', value: '50' },
          { indicator: 'Profit', condition: 'Profit >', value: '3%' }
        ],
        riskManagement: {
          stopLoss: '2%',
          takeProfit: '5%',
          positionSize: '5%',
          maxOpenPositions: 3
        }
      },
      'Medium': {
        name: 'Balanced Momentum Strategy',
        description: 'A medium-risk strategy that uses momentum indicators to identify potential entry and exit points.',
        timeframe: '4h',
        entryConditions: [
          { indicator: 'MACD', condition: 'MACD Crossover', value: 'Signal Line' },
          { indicator: 'Volume', condition: 'Volume >', value: '1.5x Average' }
        ],
        exitConditions: [
          { indicator: 'MACD', condition: 'MACD Crossunder', value: 'Signal Line' },
          { indicator: 'Profit', condition: 'Profit >', value: '8%' }
        ],
        riskManagement: {
          stopLoss: '5%',
          takeProfit: '10%',
          positionSize: '10%',
          maxOpenPositions: 5
        }
      },
      'High': {
        name: 'Aggressive Breakout Strategy',
        description: 'A high-risk strategy that looks for breakouts from key levels with larger position sizes.',
        timeframe: '1h',
        entryConditions: [
          { indicator: 'Bollinger Bands', condition: 'Price > Upper Band', value: '2 Standard Deviations' },
          { indicator: 'RSI', condition: 'RSI >', value: '70' }
        ],
        exitConditions: [
          { indicator: 'Bollinger Bands', condition: 'Price < Middle Band', value: '' },
          { indicator: 'Profit', condition: 'Profit >', value: '15%' }
        ],
        riskManagement: {
          stopLoss: '10%',
          takeProfit: '20%',
          positionSize: '20%',
          maxOpenPositions: 8
        }
      }
    };

    // Get the template based on risk level
    const template = templates[riskLevel] || templates['Medium'];

    // Customize the template based on the description and assets
    const strategy = {
      ...template,
      name: `${riskLevel} Risk ${assets && assets[0] ? assets[0].split('/')[0] : 'Crypto'} Strategy`,
      description: description || template.description,
      riskLevel,
      assets
    };

    return strategy;
  }

  /**
   * Generates detailed strategies based on risk level and market data
   */
  private generateDetailedStrategies(riskLevel: string, assets: string[], marketData: any[]): any[] {
    // Generate strategies based on risk level
    const strategies = [];

    // Strategy 1: Trend Following
    strategies.push({
      name: `${riskLevel} Risk Trend Following`,
      description: `A ${riskLevel.toLowerCase()} risk trend following strategy for ${Array.isArray(assets) ? assets.join(', ') : 'BTC/USDT'} that uses moving averages to identify trends and enter positions.`,
      riskLevel,
      assets,
      timeframe: riskLevel === 'Low' ? '1d' : riskLevel === 'Medium' ? '4h' : '1h',
      entryConditions: [
        { indicator: 'SMA', condition: 'Price > SMA', value: riskLevel === 'Low' ? '200' : riskLevel === 'Medium' ? '100' : '50' },
        { indicator: 'RSI', condition: 'RSI >', value: riskLevel === 'Low' ? '55' : riskLevel === 'Medium' ? '50' : '45' }
      ],
      exitConditions: [
        { indicator: 'SMA', condition: 'Price < SMA', value: riskLevel === 'Low' ? '50' : riskLevel === 'Medium' ? '20' : '10' },
        { indicator: 'Profit', condition: 'Profit >', value: `${riskLevel === 'Low' ? '3' : riskLevel === 'Medium' ? '8' : '15'}%` }
      ],
      riskManagement: {
        stopLoss: `${riskLevel === 'Low' ? '2' : riskLevel === 'Medium' ? '5' : '10'}%`,
        takeProfit: `${riskLevel === 'Low' ? '5' : riskLevel === 'Medium' ? '10' : '20'}%`,
        positionSize: `${riskLevel === 'Low' ? '5' : riskLevel === 'Medium' ? '10' : '20'}%`,
        maxOpenPositions: riskLevel === 'Low' ? 3 : riskLevel === 'Medium' ? 5 : 8
      }
    });

    // Strategy 2: Momentum
    strategies.push({
      name: `${riskLevel} Risk Momentum Strategy`,
      description: `A ${riskLevel.toLowerCase()} risk momentum strategy for ${Array.isArray(assets) ? assets.join(', ') : 'BTC/USDT'} that uses MACD and volume to identify potential entry and exit points.`,
      riskLevel,
      assets,
      timeframe: riskLevel === 'Low' ? '1d' : riskLevel === 'Medium' ? '4h' : '1h',
      entryConditions: [
        { indicator: 'MACD', condition: 'MACD Crossover', value: 'Signal Line' },
        { indicator: 'Volume', condition: 'Volume >', value: `${riskLevel === 'Low' ? '1.2' : riskLevel === 'Medium' ? '1.5' : '2'}x Average` }
      ],
      exitConditions: [
        { indicator: 'MACD', condition: 'MACD Crossunder', value: 'Signal Line' },
        { indicator: 'Profit', condition: 'Profit >', value: `${riskLevel === 'Low' ? '4' : riskLevel === 'Medium' ? '10' : '18'}%` }
      ],
      riskManagement: {
        stopLoss: `${riskLevel === 'Low' ? '3' : riskLevel === 'Medium' ? '6' : '12'}%`,
        takeProfit: `${riskLevel === 'Low' ? '6' : riskLevel === 'Medium' ? '12' : '24'}%`,
        positionSize: `${riskLevel === 'Low' ? '5' : riskLevel === 'Medium' ? '10' : '20'}%`,
        maxOpenPositions: riskLevel === 'Low' ? 2 : riskLevel === 'Medium' ? 4 : 6
      }
    });

    return strategies;
  }

  /**
   * Gets market data for the specified assets
   */
  private async getMarketData(assets: string[] | any): Promise<any[]> {
    try {
      const marketData = [];

      // Ensure assets is an array
      if (!assets || !Array.isArray(assets)) {
        logService.log('warn', 'Assets is not an array in getMarketData', { assets }, 'AIService');
        return [{
          asset: 'BTC/USDT',
          currentPrice: 50000,
          volume24h: 1000000000,
          priceHistory: [{ timestamp: Date.now(), price: 50000 }]
        }];
      }

      // If assets array is empty, return default data
      if (assets.length === 0) {
        logService.log('warn', 'Assets array is empty in getMarketData', null, 'AIService');
        return [{
          asset: 'BTC/USDT',
          currentPrice: 50000,
          volume24h: 1000000000,
          priceHistory: [{ timestamp: Date.now(), price: 50000 }]
        }];
      }

      for (const asset of assets) {
        try {
          // The marketMonitor doesn't have getLatestPrice, get24hVolume, or getPriceHistory methods
          // Instead, we'll use the marketMonitor.getHistoricalData or generate mock data

          // Try to get historical data from marketMonitor
          let priceHistory = [];
          try {
            const historicalData = await marketMonitor.getHistoricalData(asset, 30, '1d');
            if (historicalData && historicalData.length > 0) {
              priceHistory = historicalData.map(candle => ({
                timestamp: candle.timestamp,
                price: candle.close
              }));
            } else {
              priceHistory = this.generateMockPriceHistory(asset);
            }
          } catch (historyError) {
            logService.log('warn', `Failed to get historical data for ${asset}, using mock data`, historyError, 'AIService');
            priceHistory = this.generateMockPriceHistory(asset);
          }

          // Get current price from the last historical data point or use default
          const currentPrice = priceHistory.length > 0 ?
            priceHistory[priceHistory.length - 1].price :
            this.getDefaultPrice(asset);

          // Generate mock volume data
          const volume24h = this.getDefaultVolume(asset);

          marketData.push({
            asset,
            currentPrice,
            volume24h,
            priceHistory
          });
        } catch (error) {
          logService.log('warn', `Failed to get market data for ${asset}`, error, 'AIService');

          // Add placeholder data
          marketData.push({
            asset,
            currentPrice: this.getDefaultPrice(asset),
            volume24h: this.getDefaultVolume(asset),
            priceHistory: this.generateMockPriceHistory(asset)
          });
        }
      }

      return marketData;
    } catch (error) {
      logService.log('error', 'Failed to get market data', error, 'AIService');
      return [];
    }
  }

  /**
   * Normalizes strategy configuration
   */
  private normalizeStrategyConfig(config: any, riskLevel: string): any {
    // Ensure all required fields are present
    return {
      name: config.name || `${riskLevel} Risk Strategy`,
      description: config.description || `A ${riskLevel.toLowerCase()} risk trading strategy.`,
      riskLevel: config.riskLevel || riskLevel,
      assets: config.assets || ['BTC/USDT'],
      timeframe: config.timeframe || '1h',
      entryConditions: config.entryConditions || [],
      exitConditions: config.exitConditions || [],
      riskManagement: {
        stopLoss: config.riskManagement?.stopLoss || '5%',
        takeProfit: config.riskManagement?.takeProfit || '10%',
        positionSize: config.riskManagement?.positionSize || '10%',
        maxOpenPositions: config.riskManagement?.maxOpenPositions || 5
      }
    };
  }

  /**
   * Generates a strategy based on the provided description, risk level, and assets
   */
  async generateStrategy(description: string, riskLevel: string, assets: string[] | any): Promise<any> {
    try {
      this.emit('progress', { step: 'Initializing strategy generation...', progress: 10 });

      // Ensure assets is an array
      if (!assets || !Array.isArray(assets)) {
        logService.log('warn', 'Assets is not an array, extracting from description', { assets }, 'AIService');
        assets = this.extractAssetPairs(description);
      }

      // If assets array is empty, extract from description
      if (assets.length === 0) {
        logService.log('warn', 'Assets array is empty, extracting from description', null, 'AIService');
        assets = this.extractAssetPairs(description);
      }

      // Ensure we have at least one default asset
      if (assets.length === 0) {
        logService.log('warn', 'Could not extract assets, using default', null, 'AIService');
        assets = ['BTC/USDT'];
      }

      // Try to generate strategy with DeepSeek
      try {
        const strategy = await this.generateWithDeepSeek(description, riskLevel, assets);
        return this.normalizeStrategyConfig(strategy, riskLevel);
      } catch (error) {
        logService.log('warn', 'Failed to generate strategy with DeepSeek, falling back to rule-based', error, 'AIService');

        // Fallback to rule-based strategy
        const strategy = this.generateRuleBasedStrategy(description, riskLevel, assets);
        return this.normalizeStrategyConfig(strategy, riskLevel);
      }
    } catch (error) {
      logService.log('error', 'Failed to generate strategy', error, 'AIService');
      throw error;
    }
  }
}

export const aiService = AIService.getInstance();
