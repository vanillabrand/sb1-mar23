import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { marketMonitor } from './market-monitor';
import { supabase } from './supabase';
import { detectMarketType, normalizeMarketType, supportsLeverage, supportsShortPositions } from './market-type-detection';
import type { MarketType } from './types';
import { v4 as uuidv4 } from 'uuid';
import { strategyMetricsCalculator } from './strategy-metrics-calculator';

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

      // Log the request details
      logService.log('info', `Analyzing market conditions for ${symbol} with risk level ${riskLevel}`, {
        symbol,
        riskLevel,
        marketDataCount: marketData?.length || 0,
        strategyId: strategyConfig?.strategyId,
        strategyName: strategyConfig?.strategyName,
        attempt: strategyConfig?.attempt || 1
      }, 'AIService');

      // Prepare market data summary for the prompt
      const marketSummary = marketData.map(data => {
        return `${data.asset || data.symbol}: Price: ${data.currentPrice}, 24h Volume: ${data.volume24h || 'Unknown'}, Trend: ${this.analyzeTrend(data.priceHistory)}`;
      }).join('\n');

      // Extract market type from strategy config or detect from description
      let marketType: MarketType = 'spot';
      if (strategyConfig?.marketType) {
        marketType = normalizeMarketType(strategyConfig.marketType);
      } else if (strategyConfig?.market_type) {
        marketType = normalizeMarketType(strategyConfig.market_type);
      } else if (strategyConfig?.strategyDescription) {
        marketType = detectMarketType(strategyConfig.strategyDescription);
      }

      // Create a detailed prompt for DeepSeek
      const prompt = `Analyze the current market conditions for ${symbol} and generate trade signals based on the following data:

Risk Level: ${riskLevel}
Market Type: ${marketType}
Market Data:
${marketSummary}

Strategy Configuration:
${JSON.stringify(strategyConfig || {}, null, 2)}

Provide trade recommendations in JSON format with the following structure:
{
  "trades": [
    {
      "symbol": "Trading pair symbol",
      "direction": "Long"/"Short",
      "confidence": 0.0-1.0,
      "positionSize": number,
      "stopLossPercent": number,
      "takeProfitPercent": number,
      "trailingStop": number,
      "rationale": "Detailed explanation of the trade recommendation",
      "entryConditions": ["Condition 1", "Condition 2"],
      "exitConditions": ["Condition 1", "Condition 2"]
    }
  ],
  "marketAnalysis": "Detailed market analysis"
}`;

      logService.log('info', 'Sending market analysis prompt to DeepSeek', {
        prompt: prompt.substring(0, 200) + '...',
        strategyId: strategyConfig?.strategyId,
        attempt: strategyConfig?.attempt || 1
      }, 'AIService');

      logService.log('info', `Using market type ${marketType} for market analysis`, {
        symbol,
        marketType,
        strategyId: strategyConfig?.strategyId
      }, 'AIService');

      // Simulate DeepSeek API call with detailed analysis
      const analysis = this.generateMarketAnalysis(riskLevel, symbol, marketData, marketType, strategyConfig);

      // Log the analysis results
      logService.log('info', `Market analysis completed for ${symbol}`, {
        strategyId: strategyConfig?.strategyId,
        hasTradeSignals: analysis.trades && Array.isArray(analysis.trades) ? analysis.trades.length : 0,
        direction: analysis.direction,
        confidence: analysis.confidence
      }, 'AIService');

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
  private generateMarketAnalysis(riskLevel: string, symbol: string, marketData: any[], marketType: MarketType = 'spot', strategyConfig?: any): any {
    // Extract current price and trend
    const currentPrice = marketData[0]?.currentPrice || 0;
    const trend = this.analyzeTrend(marketData[0]?.priceHistory || []);
    const volatility = this.calculateVolatility(marketData[0]?.priceHistory || []);

    // Log the market type being used
    logService.log('info', `Using market type ${marketType} for market analysis in generateMarketAnalysis`, {
      symbol,
      marketType,
      strategyId: strategyConfig?.strategyId,
      riskLevel
    }, 'AIService');

    // Determine if we should trade based on market conditions
    let shouldTrade = Math.random() > 0.3; // 70% chance of trading

    // If this is a specific strategy, use the strategy ID to make the decision more deterministic
    // This ensures different strategies generate different trades
    if (strategyConfig?.strategyId) {
      const strategyIdHash = this.hashString(strategyConfig.strategyId);
      const deterministicRandom = (strategyIdHash % 100) / 100;
      shouldTrade = deterministicRandom > 0.3;
    }

    // Adjust based on risk level
    if (riskLevel === 'Low') {
      // More conservative - only trade in clear trends with low volatility
      shouldTrade = shouldTrade && (trend.includes('Uptrend') || trend.includes('Downtrend')) && volatility !== 'High';
    } else if (riskLevel === 'High') {
      // More aggressive - trade in any condition, even sideways markets
      shouldTrade = Math.random() > 0.2; // 80% chance of trading
    }

    // Determine direction based on trend and market type
    let direction = 'Long';

    // For spot markets, prefer long positions
    if (marketType === 'spot') {
      // Spot markets typically only support long positions
      direction = 'Long';
    } else if (trend.includes('Downtrend')) {
      // In downtrends, prefer short positions for margin and futures
      direction = 'Short';
    } else if (trend === 'Sideways') {
      // In sideways markets, direction is more random
      // But make it deterministic based on strategy ID if available
      if (strategyConfig?.strategyId) {
        const strategyIdHash = this.hashString(strategyConfig.strategyId);
        direction = (strategyIdHash % 2 === 0) ? 'Long' : 'Short';
      } else {
        direction = Math.random() > 0.5 ? 'Long' : 'Short';
      }
    }

    // If market type is spot and direction is Short, change to Long
    if (marketType === 'spot' && direction === 'Short') {
      direction = 'Long';
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

    // Calculate stop loss and take profit percentages based on volatility, risk, and market type
    let stopLossPercent, takeProfitPercent, trailingStop, leverage, marginType;

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

    // Set market-specific parameters
    if (marketType === 'futures') {
      // Set leverage based on risk level and volatility
      if (volatility === 'Low') {
        leverage = riskLevel === 'Low' ? '2x' : riskLevel === 'Medium' ? '5x' : '10x';
      } else if (volatility === 'Medium') {
        leverage = riskLevel === 'Low' ? '3x' : riskLevel === 'Medium' ? '7x' : '15x';
      } else { // High volatility
        leverage = riskLevel === 'Low' ? '5x' : riskLevel === 'Medium' ? '10x' : '20x';
      }

      // Set margin type (cross is safer, isolated is riskier)
      marginType = riskLevel === 'Low' ? 'cross' : riskLevel === 'High' ? 'isolated' : 'cross';
    }

    // Generate rationale with market type information
    const rationale = `${direction} ${marketType} signal generated for ${symbol} based on ${trend} trend and ${volatility} volatility. ` +
      `Market conditions indicate a ${confidence.toFixed(2)} confidence level for this trade. ` +
      `Stop loss set at ${(stopLossPercent * 100).toFixed(1)}% and take profit at ${(takeProfitPercent * 100).toFixed(1)}% ` +
      `with a ${(trailingStop * 100).toFixed(1)}% trailing stop.` +
      (marketType === 'futures' ? ` Using ${leverage} leverage with ${marginType} margin.` : '');

    return {
      shouldTrade,
      direction,
      confidence,
      stopLossPercent,
      takeProfitPercent,
      trailingStop,
      rationale,
      marketType,
      leverage,
      marginType,
      // Include multiple trades if this is a higher risk level
      trades: this.generateMultipleTrades(riskLevel, symbol, direction, confidence, stopLossPercent, takeProfitPercent, trailingStop, marketType, leverage, marginType, strategyConfig)
    };
  }

  /**
   * Generate multiple trades for a single analysis
   * This helps create variety in the trades generated for a strategy
   */
  private generateMultipleTrades(riskLevel: string, symbol: string, direction: string, confidence: number, stopLossPercent: number, takeProfitPercent: number, trailingStop: number, marketType: MarketType, leverage?: string, marginType?: string, strategyConfig?: any): any[] {
    // Determine how many trades to generate based on risk level
    let numTrades = 1; // Default to 1 trade

    if (riskLevel === 'High') {
      numTrades = 3;
    } else if (riskLevel === 'Medium') {
      numTrades = 2;
    }

    // If we have a strategy ID, use it to make the number of trades more deterministic
    if (strategyConfig?.strategyId) {
      const strategyIdHash = this.hashString(strategyConfig.strategyId);
      // Use the hash to adjust the number of trades (1-3)
      numTrades = 1 + (strategyIdHash % 3);
    }

    const trades = [];

    // Generate the primary trade
    trades.push({
      symbol,
      direction,
      confidence,
      stopLossPercent,
      takeProfitPercent,
      trailingStop,
      marketType,
      leverage,
      marginType,
      rationale: `Primary ${direction} ${marketType} trade for ${symbol} with ${confidence.toFixed(2)} confidence.`
    });

    // Generate additional trades with variations
    for (let i = 1; i < numTrades; i++) {
      // Vary the parameters slightly for each additional trade
      const variationFactor = 0.8 + (i * 0.1); // 0.9, 1.0, 1.1, etc.

      // For spot markets, only generate long trades
      const tradeDirection = marketType === 'spot' ? 'Long' :
                            direction === 'Long' ? 'Short' : 'Long'; // Opposite of primary trade

      trades.push({
        symbol,
        direction: tradeDirection,
        confidence: Math.max(0.1, Math.min(0.9, confidence * variationFactor)),
        stopLossPercent: stopLossPercent * variationFactor,
        takeProfitPercent: takeProfitPercent * variationFactor,
        trailingStop: trailingStop * variationFactor,
        marketType,
        leverage: marketType === 'futures' ? leverage : undefined,
        marginType: marketType === 'futures' ? marginType : undefined,
        rationale: `Additional ${tradeDirection} ${marketType} trade for ${symbol} with ${(confidence * variationFactor).toFixed(2)} confidence.`
      });
    }

    return trades;
  }

  /**
   * Simple string hash function to generate deterministic values from strategy IDs
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generates mock price history for a given asset
   * @param asset Asset symbol
   * @returns Array of price history data points
   */
  private generateMockPriceHistory(asset: string): any[] {
    const priceHistory = [];
    const basePrice = this.getDefaultPrice(asset);
    const now = Date.now();

    // Generate 30 days of price history
    for (let i = 0; i < 30; i++) {
      const timestamp = now - (29 - i) * 24 * 60 * 60 * 1000; // Start 30 days ago
      const randomChange = (Math.random() - 0.5) * 0.02; // -1% to +1%
      const price = basePrice * (1 + randomChange * i); // Gradual trend

      priceHistory.push({
        timestamp,
        price
      });
    }

    return priceHistory;
  }

  /**
   * Gets a default price for a given asset
   * @param asset Asset symbol
   * @returns Default price
   */
  private getDefaultPrice(asset: string): number {
    const baseAsset = asset.split('/')[0];

    switch (baseAsset) {
      case 'BTC': return 50000;
      case 'ETH': return 3000;
      case 'SOL': return 100;
      case 'BNB': return 500;
      case 'XRP': return 0.5;
      default: return 100;
    }
  }

  /**
   * Gets a default 24h volume for a given asset
   * @param asset Asset symbol
   * @returns Default 24h volume
   */
  private getDefaultVolume(asset: string): number {
    const baseAsset = asset.split('/')[0];

    switch (baseAsset) {
      case 'BTC': return 1000000000; // $1B
      case 'ETH': return 500000000;  // $500M
      case 'SOL': return 100000000;  // $100M
      case 'BNB': return 200000000;  // $200M
      case 'XRP': return 50000000;   // $50M
      default: return 10000000;      // $10M
    }
  }

  private analyzeTrend(priceHistory: any[]): string {
    if (!priceHistory || priceHistory.length < 2) return 'Neutral';

    // Handle both formats: {close, timestamp} and {price, timestamp}
    const firstPrice = priceHistory[0].close || priceHistory[0].price;
    const lastPrice = priceHistory[priceHistory.length - 1].close || priceHistory[priceHistory.length - 1].price;
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

      // Detect market type from description
      const marketType = detectMarketType(description);

      logService.log('info', `Detected market type: ${marketType} for strategy generation`, {
        description: description.substring(0, 50) + '...',
      }, 'AIService');

      // Create a detailed prompt for DeepSeek
      const prompt = `Generate a detailed cryptocurrency trading strategy based on the following requirements:

Description: ${description}
Risk Level: ${riskLevel}
Assets: ${Array.isArray(assets) ? assets.join(', ') : 'BTC/USDT'}
Market Type: ${marketType} (spot, margin, or futures)

Current Market Data:
${marketData.map(data => `${data.asset}: Price: ${data.currentPrice}, 24h Volume: ${data.volume24h}, Trend: ${this.analyzeTrend(data.priceHistory)}`).join('\n')}

Please provide a complete strategy in JSON format with the following structure:
{
  "name": "Strategy name",
  "description": "Detailed strategy description",
  "riskLevel": "${riskLevel}",
  "marketType": "${marketType}",
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
    "maxOpenPositions": number,
    ${marketType === 'futures' ? '"leverage": "amount (e.g., 5x, 10x)",' : ''}
    ${marketType === 'margin' ? '"borrowAmount": "percentage of position",' : ''}
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
   * Generate a rule-based strategy as a fallback when DeepSeek fails
   * @param description The strategy description
   * @param riskLevel The risk level to generate a strategy for
   * @param assets Array of asset pairs to generate strategies for
   * @param marketType Optional market type to use
   * @returns Strategy object
   */
  private async generateRuleBasedStrategy(description: string, riskLevel: string, assets: string[], marketType?: MarketType): Promise<any> {
    try {
      this.emit('progress', { step: 'Generating rule-based strategy...', progress: 50 });

      // Determine market type if not provided
      const detectedMarketType = marketType || detectMarketType(description);

      // Get market data for the assets
      const marketData = await this.getMarketData(assets);

      // Generate a strategy for the detected market type
      return this.generateStrategyForMarketType(detectedMarketType, riskLevel, assets, marketData);
    } catch (error) {
      logService.log('error', 'Failed to generate rule-based strategy', error, 'AIService');

      // Create a very basic strategy as a last resort
      return {
        id: uuidv4(),
        name: `${riskLevel} Risk Strategy`,
        description: description || `A ${riskLevel.toLowerCase()} risk trading strategy.`,
        riskLevel: riskLevel,
        risk_level: riskLevel,
        marketType: marketType || 'spot',
        market_type: marketType || 'spot',
        assets: assets,
        selected_pairs: assets,
        timeframe: '1h',
        entryConditions: ['Price above moving average'],
        exitConditions: ['Take profit at 10%', 'Stop loss at 5%'],
        riskManagement: {
          stopLoss: '5%',
          takeProfit: '10%',
          positionSize: '10%'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'inactive'
      };
    }
  }




  /**
   * Internal method to generate detailed strategies for a specific risk level
   * @param riskLevel The risk level to generate strategies for
   * @param assets Array of asset pairs to generate strategies for
   * @param marketData Market data for the assets
   * @returns Array of strategy objects
   */
  private async generateDetailedStrategiesInternal(riskLevel: string, assets: string[], marketData: any[]): Promise<any[]> {
    try {
      this.emit('progress', { step: `Generating ${riskLevel} risk strategies...`, progress: 30 });

      // Generate strategies for different market types
      const strategies = [];

      // Generate spot strategy
      try {
        const spotStrategy = this.generateStrategyForMarketType('spot', riskLevel, assets, marketData);
        strategies.push(spotStrategy);
      } catch (spotError) {
        logService.log('warn', `Failed to generate spot strategy for risk level ${riskLevel}`, spotError, 'AIService');
      }

      // Generate margin strategy
      try {
        const marginStrategy = this.generateStrategyForMarketType('margin', riskLevel, assets, marketData);
        strategies.push(marginStrategy);
      } catch (marginError) {
        logService.log('warn', `Failed to generate margin strategy for risk level ${riskLevel}`, marginError, 'AIService');
      }

      // Generate futures strategy
      try {
        const futuresStrategy = this.generateStrategyForMarketType('futures', riskLevel, assets, marketData);
        strategies.push(futuresStrategy);
      } catch (futuresError) {
        logService.log('warn', `Failed to generate futures strategy for risk level ${riskLevel}`, futuresError, 'AIService');
      }

      return strategies;
    } catch (error) {
      logService.log('error', `Failed to generate detailed strategies for risk level ${riskLevel}`, error, 'AIService');
      return [];
    }
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
    // Generate a UUID for the strategy if it doesn't have one
    const id = config.id || uuidv4();

    // Detect or normalize market type
    let marketType: MarketType;
    if (config.marketType) {
      marketType = normalizeMarketType(config.marketType);
    } else if (config.market_type) {
      marketType = normalizeMarketType(config.market_type);
    } else {
      // Default to spot if no market type is specified
      marketType = 'spot';
    }

    // Create risk management with market-specific parameters
    const riskManagement: any = {
      stopLoss: config.riskManagement?.stopLoss || '5%',
      takeProfit: config.riskManagement?.takeProfit || '10%',
      positionSize: config.riskManagement?.positionSize || '10%',
      maxOpenPositions: config.riskManagement?.maxOpenPositions || 5
    };

    // Calculate metrics using the strategy metrics calculator
    const tempStrategy = {
      id,
      riskLevel: riskLevel,
      risk_level: riskLevel,
      market_type: marketType,
      marketType: marketType,
      strategy_config: {
        ...config,
        riskManagement
      }
    };

    // Calculate win rate and potential profit
    const winRate = strategyMetricsCalculator.calculateWinRate(tempStrategy as any);
    const potentialProfit = strategyMetricsCalculator.calculatePotentialProfit(tempStrategy as any);

    // Create metrics object
    const metrics = {
      winRate: parseFloat(winRate.toFixed(1)),
      potentialProfit: parseFloat(potentialProfit.toFixed(1)),
      averageProfit: parseFloat(potentialProfit.toFixed(1))
    };

    // Add market-specific parameters if they don't exist
    if (marketType === 'futures' && !config.riskManagement?.leverage) {
      riskManagement.leverage = riskLevel === 'Low' ? '2x' :
                              riskLevel === 'Medium' ? '5x' : '10x';
    } else if (marketType === 'futures' && config.riskManagement?.leverage) {
      riskManagement.leverage = config.riskManagement.leverage;
    }

    if (marketType === 'margin' && !config.riskManagement?.borrowAmount) {
      riskManagement.borrowAmount = riskLevel === 'Low' ? '20%' :
                                  riskLevel === 'Medium' ? '50%' : '80%';
    } else if (marketType === 'margin' && config.riskManagement?.borrowAmount) {
      riskManagement.borrowAmount = config.riskManagement.borrowAmount;
    }

    // Log the strategy ID to ensure it's set
    logService.log('info', `Normalizing strategy with ID: ${id}`, { id }, 'AIService');

    // Ensure all required fields are present
    return {
      id, // Explicitly set the ID to ensure it's never null
      name: config.name || `${riskLevel} Risk ${marketType.charAt(0).toUpperCase() + marketType.slice(1)} Strategy`,
      description: config.description || `A ${riskLevel.toLowerCase()} risk ${marketType} trading strategy.`,
      riskLevel: config.riskLevel || riskLevel,
      risk_level: config.riskLevel || riskLevel, // Add both formats for compatibility
      marketType: marketType,
      market_type: marketType, // Add both formats for compatibility
      assets: config.assets || ['BTC/USDT'],
      selected_pairs: config.assets || config.selected_pairs || ['BTC/USDT'], // Add selected_pairs for compatibility
      timeframe: config.timeframe || '1h',
      entryConditions: config.entryConditions || [],
      exitConditions: config.exitConditions || [],
      riskManagement: riskManagement,
      metrics: metrics, // Add metrics to the strategy
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'inactive',
      user_id: config.user_id || null, // Will be set by the strategy sync service
      strategy_config: {
        ...(config.strategy_config || {}),
        metrics: metrics, // Also add metrics to strategy_config for compatibility
        takeProfit: parseFloat(riskManagement.takeProfit) || potentialProfit // Ensure takeProfit is available for UI display
      }
    };
  }



  /**
   * Generates a strategy based on the provided description, risk level, and assets
   */
  async generateStrategy(description: string, riskLevel: string, assets: string[] | any, marketType?: MarketType): Promise<any> {
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

      // Determine market type - use provided marketType, or detect from description
      const detectedMarketType = marketType || detectMarketType(description);

      logService.log('info', `Generating strategy with market type: ${detectedMarketType}`, {
        marketType: detectedMarketType,
        providedMarketType: marketType,
        detectedFromDescription: !marketType,
        assets: assets.join(', '),
        riskLevel
      }, 'AIService');

      // Try to generate strategy with DeepSeek
      try {
        const strategy = await this.generateWithDeepSeek(description, riskLevel, assets);

        // Ensure the market type is set correctly
        if (detectedMarketType) {
          strategy.marketType = detectedMarketType;
          strategy.market_type = detectedMarketType;
        }

        return this.normalizeStrategyConfig(strategy, riskLevel);
      } catch (error) {
        logService.log('warn', 'Failed to generate strategy with DeepSeek, falling back to rule-based', error, 'AIService');

        // Fallback to rule-based strategy
        const strategy = await this.generateRuleBasedStrategy(description, riskLevel, assets, detectedMarketType);

        // Ensure the market type is set correctly
        if (detectedMarketType) {
          strategy.marketType = detectedMarketType;
          strategy.market_type = detectedMarketType;
        }

        return this.normalizeStrategyConfig(strategy, riskLevel);
      }
    } catch (error) {
      logService.log('error', 'Failed to generate strategy', error, 'AIService');
      throw error;
    }
  }

  /**
   * Generates multiple detailed strategies for different risk levels
   * @param assets Array of asset pairs to generate strategies for
   * @param riskLevels Array of risk levels to generate strategies for
   * @returns Array of strategy objects
   */
  async generateDetailedStrategies(assets: string[], riskLevels: string[]): Promise<any[]> {
    try {
      this.emit('progress', { step: 'Generating detailed strategies...', progress: 10 });

      // Ensure assets is an array
      if (!assets || !Array.isArray(assets)) {
        logService.log('warn', 'Assets is not an array in generateDetailedStrategies', { assets }, 'AIService');
        assets = ['BTC/USDT'];
      }

      // If assets array is empty, use default
      if (assets.length === 0) {
        logService.log('warn', 'Assets array is empty in generateDetailedStrategies', null, 'AIService');
        assets = ['BTC/USDT'];
      }

      // Ensure riskLevels is an array
      if (!riskLevels || !Array.isArray(riskLevels)) {
        logService.log('warn', 'Risk levels is not an array in generateDetailedStrategies', { riskLevels }, 'AIService');
        riskLevels = ['Low', 'Medium', 'High'];
      }

      // If riskLevels array is empty, use default
      if (riskLevels.length === 0) {
        logService.log('warn', 'Risk levels array is empty in generateDetailedStrategies', null, 'AIService');
        riskLevels = ['Low', 'Medium', 'High'];
      }

      // Get market data for the assets
      const marketData = await this.getMarketData(assets);

      // Generate strategies for each risk level
      const strategies = [];

      for (const riskLevel of riskLevels) {
        try {
          // Generate strategies for this risk level
          const riskStrategies = await this.generateDetailedStrategiesInternal(riskLevel, assets, marketData);
          strategies.push(...riskStrategies);
        } catch (error) {
          logService.log('warn', `Failed to generate strategies for risk level ${riskLevel}`, error, 'AIService');
        }
      }

      // If no strategies were generated, return an empty array
      if (strategies.length === 0) {
        logService.log('warn', 'No strategies were generated', null, 'AIService');
        return [];
      }

      return strategies;
    } catch (error) {
      logService.log('error', 'Failed to generate detailed strategies', error, 'AIService');
      return [];
    }
  }

  /**
   * Generate trades for a strategy using DeepSeek AI
   * @param strategy The strategy to generate trades for
   * @param budget The budget available for trading
   * @returns Array of generated trades
   */
  async generateTradesForStrategy(strategy: any, budget: any): Promise<any[]> {
    try {
      logService.log('info', `Generating trades for strategy ${strategy.id}`, {
        strategyName: strategy.name,
        marketType: strategy.market_type || strategy.marketType,
        budget: budget?.available || 0
      }, 'AIService');

      // Check if we have a valid strategy
      if (!strategy || !strategy.id) {
        logService.log('error', 'Invalid strategy provided for trade generation', { strategy }, 'AIService');
        return [];
      }

      // Check if we have a valid budget
      if (!budget || budget.available <= 0) {
        logService.log('info', `No available budget for strategy ${strategy.id}, skipping trade generation`, { budget }, 'AIService');
        return [];
      }

      // Get the strategy's assets
      const assets = strategy.assets || strategy.selected_pairs || ['BTC/USDT'];

      // Get the strategy's risk level
      const riskLevel = strategy.risk_level || strategy.riskLevel || 'Medium';

      // Get the strategy's market type
      const marketType = strategy.market_type || strategy.marketType || 'spot';

      // Get market data for the assets
      const marketData = await this.getMarketData(assets);

      // Analyze market conditions for each asset
      const trades = [];

      for (const asset of assets) {
        try {
          // Get market data for this asset
          const assetData = marketData.find(data => data.asset === asset) || marketData[0];

          // Analyze market conditions
          const analysis = await this.analyzeMarketConditions(asset, riskLevel, [assetData], {
            strategyId: strategy.id,
            strategyName: strategy.name,
            marketType: marketType,
            attempt: 1
          });

          // Check if we should trade
          if (!analysis.shouldTrade) {
            logService.log('info', `Market conditions not favorable for trading ${asset}`, {
              strategyId: strategy.id,
              asset
            }, 'AIService');
            continue;
          }

          // Get the trades from the analysis
          const assetTrades = analysis.trades || [];

          // Process each trade
          for (const trade of assetTrades) {
            // Calculate trade amount based on budget and position size
            const positionSize = strategy.riskManagement?.positionSize || '10%';
            const positionSizePercent = parseFloat(positionSize) / 100;

            // Get current price
            const currentPrice = assetData.currentPrice || 0;

            // Calculate trade amount
            const tradeAmount = (budget.available * positionSizePercent) / currentPrice;

            // Format the trade
            const formattedTrade = {
              symbol: asset,
              side: trade.direction === 'Long' ? 'buy' : 'sell',
              type: 'market',
              amount: tradeAmount,
              price: currentPrice,
              stop_loss: trade.stopLossPercent,
              take_profit: trade.takeProfitPercent,
              trailing_stop: trade.trailingStop,
              market_type: marketType,
              leverage: trade.leverage,
              marginType: trade.marginType,
              entry_conditions: [
                `Price: ${currentPrice}`,
                `Direction: ${trade.direction}`,
                `Confidence: ${trade.confidence}`
              ],
              exit_conditions: [
                `Stop Loss: ${trade.stopLossPercent * 100}%`,
                `Take Profit: ${trade.takeProfitPercent * 100}%`,
                `Trailing Stop: ${trade.trailingStop * 100}%`
              ],
              reason: trade.rationale || 'AI generated trade'
            };

            trades.push(formattedTrade);

            logService.log('info', `Generated trade for ${asset}`, {
              strategyId: strategy.id,
              asset,
              side: formattedTrade.side,
              amount: formattedTrade.amount,
              price: formattedTrade.price
            }, 'AIService');
          }
        } catch (error) {
          logService.log('error', `Failed to generate trades for asset ${asset}`, error, 'AIService');
        }
      }

      return trades;
    } catch (error) {
      logService.log('error', `Failed to generate trades for strategy ${strategy?.id}`, error, 'AIService');
      return [];
    }
  }

  /**
   * Check if a trade should be closed
   * @param trade The trade to check
   * @returns True if the trade should be closed, false otherwise
   */
  async shouldCloseTrade(trade: any): Promise<boolean> {
    try {
      if (!trade || !trade.id) {
        logService.log('error', 'Invalid trade provided for close check', { trade }, 'AIService');
        return false;
      }

      // Get the trade's symbol
      const symbol = trade.symbol;

      // Get the trade's entry price
      const entryPrice = trade.price || trade.entry_price || 0;

      // Get the trade's side
      const side = trade.side || 'buy';

      // Get the trade's stop loss and take profit
      const stopLoss = trade.stop_loss || trade.metadata?.stop_loss;
      const takeProfit = trade.take_profit || trade.metadata?.take_profit;

      // Get current market data
      const marketData = await this.getMarketData([symbol]);

      // Get current price
      const currentPrice = marketData[0]?.currentPrice || 0;

      // Calculate profit/loss percentage
      let profitPercent = 0;

      if (side === 'buy') {
        profitPercent = (currentPrice - entryPrice) / entryPrice;
      } else {
        profitPercent = (entryPrice - currentPrice) / entryPrice;
      }

      // Check if we should close the trade
      let shouldClose = false;

      // Check stop loss
      if (stopLoss && side === 'buy' && profitPercent <= stopLoss) {
        shouldClose = true;
        logService.log('info', `Trade ${trade.id} hit stop loss`, {
          symbol,
          entryPrice,
          currentPrice,
          profitPercent,
          stopLoss
        }, 'AIService');
      }

      // Check take profit
      if (takeProfit && side === 'buy' && profitPercent >= takeProfit) {
        shouldClose = true;
        logService.log('info', `Trade ${trade.id} hit take profit`, {
          symbol,
          entryPrice,
          currentPrice,
          profitPercent,
          takeProfit
        }, 'AIService');
      }

      // Check stop loss for short positions
      if (stopLoss && side === 'sell' && profitPercent <= stopLoss) {
        shouldClose = true;
        logService.log('info', `Trade ${trade.id} hit stop loss (short)`, {
          symbol,
          entryPrice,
          currentPrice,
          profitPercent,
          stopLoss
        }, 'AIService');
      }

      // Check take profit for short positions
      if (takeProfit && side === 'sell' && profitPercent >= takeProfit) {
        shouldClose = true;
        logService.log('info', `Trade ${trade.id} hit take profit (short)`, {
          symbol,
          entryPrice,
          currentPrice,
          profitPercent,
          takeProfit
        }, 'AIService');
      }

      // Also randomly close some trades to simulate market conditions
      // This is just for demo purposes
      if (Math.random() < 0.05) { // 5% chance to close
        shouldClose = true;
        logService.log('info', `Trade ${trade.id} closed randomly`, {
          symbol,
          entryPrice,
          currentPrice,
          profitPercent
        }, 'AIService');
      }

      return shouldClose;
    } catch (error) {
      logService.log('error', `Failed to check if trade ${trade?.id} should be closed`, error, 'AIService');
      return false;
    }
  }





  /**
   * Generate a strategy for a specific market type
   * @param marketType The market type to generate a strategy for
   * @param riskLevel The risk level to generate a strategy for
   * @param assets Array of asset pairs to generate strategies for
   * @param marketData Market data for the assets
   * @returns Strategy object
   */
  private generateStrategyForMarketType(marketType: MarketType, riskLevel: string, assets: string[], marketData: any[]): any {
    // Generate a unique ID for the strategy
    const id = uuidv4();

    // Create strategy name
    const name = `${riskLevel} Risk ${marketType.charAt(0).toUpperCase() + marketType.slice(1)} Strategy`;

    // Create strategy description
    const description = `A ${riskLevel.toLowerCase()} risk ${marketType} trading strategy for ${assets.join(', ')}.`;

    // Create entry conditions based on risk level and market type
    const entryConditions = [];

    if (riskLevel === 'Low') {
      entryConditions.push('Strong uptrend confirmed by multiple indicators');
      entryConditions.push('Volume increasing');
      entryConditions.push('Low volatility');
    } else if (riskLevel === 'Medium') {
      entryConditions.push('Uptrend or consolidation pattern');
      entryConditions.push('Support level confirmed');
      entryConditions.push('Moderate volume');
    } else { // High risk
      entryConditions.push('Potential trend reversal');
      entryConditions.push('Oversold conditions');
      entryConditions.push('High volume spike');
    }

    // Add market-specific entry conditions
    if (marketType === 'futures') {
      entryConditions.push('Futures premium within acceptable range');
      entryConditions.push('Funding rate favorable');
    } else if (marketType === 'margin') {
      entryConditions.push('Borrowing rate favorable');
      entryConditions.push('Sufficient liquidity');
    }

    // Create exit conditions based on risk level and market type
    const exitConditions = [];

    if (riskLevel === 'Low') {
      exitConditions.push('Take profit at 5%');
      exitConditions.push('Stop loss at 2%');
      exitConditions.push('Trailing stop at 1%');
    } else if (riskLevel === 'Medium') {
      exitConditions.push('Take profit at 10%');
      exitConditions.push('Stop loss at 5%');
      exitConditions.push('Trailing stop at 2%');
    } else { // High risk
      exitConditions.push('Take profit at 20%');
      exitConditions.push('Stop loss at 10%');
      exitConditions.push('Trailing stop at 5%');
    }

    // Add market-specific exit conditions
    if (marketType === 'futures') {
      exitConditions.push('Exit if funding rate becomes unfavorable');
      exitConditions.push('Exit if futures premium exceeds threshold');
    } else if (marketType === 'margin') {
      exitConditions.push('Exit if borrowing rate increases significantly');
      exitConditions.push('Exit if liquidity decreases');
    }

    // Create risk management based on risk level and market type
    const riskManagement: any = {};

    if (riskLevel === 'Low') {
      riskManagement.stopLoss = '2%';
      riskManagement.takeProfit = '5%';
      riskManagement.trailingStop = '1%';
      riskManagement.positionSize = '5%';
      riskManagement.maxOpenPositions = 3;
    } else if (riskLevel === 'Medium') {
      riskManagement.stopLoss = '5%';
      riskManagement.takeProfit = '10%';
      riskManagement.trailingStop = '2%';
      riskManagement.positionSize = '10%';
      riskManagement.maxOpenPositions = 5;
    } else { // High risk
      riskManagement.stopLoss = '10%';
      riskManagement.takeProfit = '20%';
      riskManagement.trailingStop = '5%';
      riskManagement.positionSize = '20%';
      riskManagement.maxOpenPositions = 10;
    }

    // Add market-specific risk management
    if (marketType === 'futures') {
      riskManagement.leverage = riskLevel === 'Low' ? '2x' :
                              riskLevel === 'Medium' ? '5x' : '10x';
      riskManagement.marginType = riskLevel === 'Low' ? 'cross' : 'isolated';
    } else if (marketType === 'margin') {
      riskManagement.borrowAmount = riskLevel === 'Low' ? '20%' :
                                  riskLevel === 'Medium' ? '50%' : '80%';
    }

    // Calculate metrics
    const winRate = riskLevel === 'Low' ? 0.7 :
                  riskLevel === 'Medium' ? 0.6 : 0.5;

    const potentialProfit = riskLevel === 'Low' ? 5 :
                          riskLevel === 'Medium' ? 10 : 20;

    const metrics = {
      winRate: winRate,
      potentialProfit: potentialProfit,
      averageProfit: potentialProfit * winRate
    };

    // Create the strategy
    return {
      id,
      name,
      description,
      riskLevel,
      risk_level: riskLevel,
      marketType,
      market_type: marketType,
      assets,
      selected_pairs: assets,
      timeframe: '1h',
      entryConditions,
      exitConditions,
      riskManagement,
      metrics,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'inactive',
      strategy_config: {
        riskManagement,
        metrics,
        takeProfit: parseFloat(riskManagement.takeProfit) || potentialProfit
      }
    };
  }


}

export const aiService = AIService.getInstance();
