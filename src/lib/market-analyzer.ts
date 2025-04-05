import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { marketDataService } from './market-data-service';
import { exchangeService } from './exchange-service';
import { indicatorService } from './indicators';
import { eventBus } from './event-bus';
import type { Strategy } from './types';

interface MarketAnalysis {
  symbol: string;
  strategyId: string;
  timestamp: number;
  price: number;
  indicators: any[];
  trend: 'up' | 'down' | 'sideways';
  volatility: number;
  volume: {
    current: number;
    average: number;
    change: number;
  };
  tradingOpportunity: boolean;
  opportunityDetails?: {
    direction: 'long' | 'short';
    confidence: number;
    rationale: string;
  };
}

class MarketAnalyzer extends EventEmitter {
  private static instance: MarketAnalyzer;
  private analyses: Map<string, MarketAnalysis> = new Map();
  private isInitialized: boolean = false;
  private readonly ANALYSIS_INTERVAL = 60000; // 1 minute
  private analysisInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
  }

  static getInstance(): MarketAnalyzer {
    if (!MarketAnalyzer.instance) {
      MarketAnalyzer.instance = new MarketAnalyzer();
    }
    return MarketAnalyzer.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logService.log('info', 'Initializing market analyzer', null, 'MarketAnalyzer');
      
      // Listen for market data updates
      eventBus.subscribe('market:dataUpdated', (data) => {
        this.analyzeMarketData(data.symbol, data.strategyId, data.ticker, data.trades);
      });
      
      // Start the analysis interval
      this.analysisInterval = setInterval(() => {
        this.runPeriodicAnalysis();
      }, this.ANALYSIS_INTERVAL);

      this.isInitialized = true;
      logService.log('info', 'Market analyzer initialized', null, 'MarketAnalyzer');
    } catch (error) {
      logService.log('error', 'Failed to initialize market analyzer', error, 'MarketAnalyzer');
      throw error;
    }
  }

  /**
   * Analyze market data for a specific symbol and strategy
   */
  async analyzeMarketData(symbol: string, strategyId: string, ticker: any, trades: any[]): Promise<MarketAnalysis | null> {
    try {
      // Get the strategy
      const strategy = await this.getStrategy(strategyId);
      if (!strategy) {
        logService.log('warn', `Strategy ${strategyId} not found for market analysis`, null, 'MarketAnalyzer');
        return null;
      }

      // Get historical candles for technical analysis
      const candles = await marketDataService.getCandles(symbol, '5m', 100);
      if (!candles || candles.length === 0) {
        logService.log('warn', `No candles available for ${symbol}`, null, 'MarketAnalyzer');
        return null;
      }

      // Calculate technical indicators
      const indicators = await this.calculateIndicators(strategy, candles);
      
      // Identify trend
      const trend = this.identifyTrend(candles);
      
      // Calculate volatility
      const volatility = this.calculateVolatility(candles);
      
      // Analyze volume
      const volume = this.analyzeVolume(candles, ticker);
      
      // Determine if there's a trading opportunity
      const { tradingOpportunity, opportunityDetails } = this.identifyTradingOpportunity(
        strategy, 
        indicators, 
        trend, 
        volatility, 
        volume,
        ticker.last
      );

      // Create analysis object
      const analysis: MarketAnalysis = {
        symbol,
        strategyId,
        timestamp: Date.now(),
        price: ticker.last,
        indicators,
        trend,
        volatility,
        volume,
        tradingOpportunity,
        opportunityDetails
      };
      
      // Store the analysis
      const key = `${symbol}-${strategyId}`;
      this.analyses.set(key, analysis);
      
      // Emit events
      this.emit('analysisCompleted', analysis);
      eventBus.emit('market:analysisCompleted', analysis);
      
      // If there's a trading opportunity, emit a special event
      if (tradingOpportunity) {
        this.emit('tradingOpportunity', analysis);
        eventBus.emit('market:tradingOpportunity', analysis);
        
        logService.log('info', `Trading opportunity identified for ${symbol} (Strategy: ${strategyId})`, 
          { direction: opportunityDetails?.direction, confidence: opportunityDetails?.confidence }, 
          'MarketAnalyzer');
      }
      
      logService.log('debug', `Market analysis completed for ${symbol} (Strategy: ${strategyId})`, null, 'MarketAnalyzer');
      
      return analysis;
    } catch (error) {
      logService.log('error', `Failed to analyze market data for ${symbol} (Strategy: ${strategyId})`, error, 'MarketAnalyzer');
      return null;
    }
  }

  /**
   * Run periodic analysis for all tracked symbols
   */
  private async runPeriodicAnalysis(): Promise<void> {
    try {
      const analysisKeys = Array.from(this.analyses.keys());
      
      for (const key of analysisKeys) {
        const [symbol, strategyId] = key.split('-');
        
        // Get latest market data
        const marketData = await exchangeService.getMarketData(symbol);
        if (!marketData) continue;
        
        // Run analysis
        await this.analyzeMarketData(symbol, strategyId, marketData.ticker, marketData.trades || []);
      }
      
      logService.log('debug', 'Periodic market analysis completed', null, 'MarketAnalyzer');
    } catch (error) {
      logService.log('error', 'Failed to run periodic market analysis', error, 'MarketAnalyzer');
    }
  }

  /**
   * Calculate technical indicators for a strategy
   */
  private async calculateIndicators(strategy: Strategy, candles: any[]): Promise<any[]> {
    const indicators: any[] = [];
    const closes = candles.map(candle => candle.close);
    
    try {
      // Calculate RSI
      if (strategy.strategy_config?.indicators?.includes('RSI')) {
        const rsiConfig = {
          type: 'RSI',
          period: 14,
          parameters: {}
        };
        const rsi = await indicatorService.calculateIndicator(rsiConfig, closes);
        indicators.push({
          name: 'RSI',
          value: rsi.value,
          timeframe: '5m'
        });
      }
      
      // Calculate MACD
      if (strategy.strategy_config?.indicators?.includes('MACD')) {
        const macdConfig = {
          type: 'MACD',
          period: null,
          parameters: {
            fast_period: 12,
            slow_period: 26,
            signal_period: 9
          }
        };
        const macd = await indicatorService.calculateIndicator(macdConfig, closes);
        indicators.push({
          name: 'MACD',
          value: macd.value,
          signal: macd.signal,
          timeframe: '5m'
        });
      }
      
      // Calculate Bollinger Bands
      if (strategy.strategy_config?.indicators?.includes('BBANDS')) {
        const bbandsConfig = {
          type: 'BBANDS',
          period: 20,
          parameters: {
            stdDev: 2
          }
        };
        const bbands = await indicatorService.calculateIndicator(bbandsConfig, closes);
        indicators.push({
          name: 'BBANDS',
          upper: bbands.upper,
          middle: bbands.middle,
          lower: bbands.lower,
          timeframe: '5m'
        });
      }
      
      return indicators;
    } catch (error) {
      logService.log('error', 'Error calculating indicators', error, 'MarketAnalyzer');
      return indicators;
    }
  }

  /**
   * Identify market trend from candles
   */
  private identifyTrend(candles: any[]): 'up' | 'down' | 'sideways' {
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
      logService.log('error', 'Failed to identify trend', error, 'MarketAnalyzer');
      return 'sideways';
    }
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return 0;
    }
    
    const sum = prices.slice(-period).reduce((total, price) => total + price, 0);
    return sum / period;
  }

  /**
   * Calculate market volatility
   */
  private calculateVolatility(candles: any[]): number {
    try {
      if (!candles || candles.length < 10) {
        return 0;
      }
      
      const closes = candles.map(candle => candle.close);
      
      // Calculate returns
      const returns = [];
      for (let i = 1; i < closes.length; i++) {
        returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      }
      
      // Calculate variance
      const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
      const variance = returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / returns.length;
      
      // Return standard deviation as percentage
      return Math.sqrt(variance) * 100;
    } catch (error) {
      logService.log('error', 'Failed to calculate volatility', error, 'MarketAnalyzer');
      return 0;
    }
  }

  /**
   * Analyze volume data
   */
  private analyzeVolume(candles: any[], ticker: any): {
    current: number;
    average: number;
    change: number;
  } {
    try {
      if (!candles || candles.length < 10 || !ticker) {
        return {
          current: 0,
          average: 0,
          change: 0
        };
      }
      
      const volumes = candles.map(candle => candle.volume);
      const currentVolume = ticker.quoteVolume || volumes[volumes.length - 1];
      
      // Calculate average volume (last 24 hours)
      const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
      
      // Calculate volume change
      const volumeChange = ((currentVolume - avgVolume) / avgVolume) * 100;
      
      return {
        current: currentVolume,
        average: avgVolume,
        change: volumeChange
      };
    } catch (error) {
      logService.log('error', 'Failed to analyze volume', error, 'MarketAnalyzer');
      return {
        current: 0,
        average: 0,
        change: 0
      };
    }
  }

  /**
   * Identify if there's a trading opportunity based on market conditions
   */
  private identifyTradingOpportunity(
    strategy: Strategy,
    indicators: any[],
    trend: 'up' | 'down' | 'sideways',
    volatility: number,
    volume: { current: number; average: number; change: number },
    currentPrice: number
  ): {
    tradingOpportunity: boolean;
    opportunityDetails?: {
      direction: 'long' | 'short';
      confidence: number;
      rationale: string;
    };
  } {
    try {
      // Default response
      const result = {
        tradingOpportunity: false
      };
      
      // Get strategy configuration
      const config = strategy.strategy_config;
      if (!config) return result;
      
      // Check if we have the necessary indicators
      const rsi = indicators.find(i => i.name === 'RSI');
      const macd = indicators.find(i => i.name === 'MACD');
      const bbands = indicators.find(i => i.name === 'BBANDS');
      
      // Simple opportunity identification based on strategy type
      if (config.type === 'trend_following') {
        // Trend following strategy
        if (trend === 'up' && volume.change > 10) {
          // Potential long opportunity in uptrend with increasing volume
          if (rsi && rsi.value > 50 && rsi.value < 70) {
            return {
              tradingOpportunity: true,
              opportunityDetails: {
                direction: 'long',
                confidence: 0.7,
                rationale: 'Uptrend with increasing volume and moderate RSI'
              }
            };
          }
        } else if (trend === 'down' && volume.change > 10) {
          // Potential short opportunity in downtrend with increasing volume
          if (rsi && rsi.value < 50 && rsi.value > 30) {
            return {
              tradingOpportunity: true,
              opportunityDetails: {
                direction: 'short',
                confidence: 0.7,
                rationale: 'Downtrend with increasing volume and moderate RSI'
              }
            };
          }
        }
      } else if (config.type === 'mean_reversion') {
        // Mean reversion strategy
        if (bbands) {
          if (currentPrice <= bbands.lower && trend !== 'down') {
            // Price at lower band, potential bounce
            return {
              tradingOpportunity: true,
              opportunityDetails: {
                direction: 'long',
                confidence: 0.65,
                rationale: 'Price at lower Bollinger Band, potential bounce'
              }
            };
          } else if (currentPrice >= bbands.upper && trend !== 'up') {
            // Price at upper band, potential reversal
            return {
              tradingOpportunity: true,
              opportunityDetails: {
                direction: 'short',
                confidence: 0.65,
                rationale: 'Price at upper Bollinger Band, potential reversal'
              }
            };
          }
        }
      } else if (config.type === 'breakout') {
        // Breakout strategy
        if (bbands && volatility > 2) {
          if (currentPrice > bbands.upper && volume.change > 20) {
            // Breakout above upper band with high volume
            return {
              tradingOpportunity: true,
              opportunityDetails: {
                direction: 'long',
                confidence: 0.75,
                rationale: 'Breakout above upper Bollinger Band with high volume'
              }
            };
          } else if (currentPrice < bbands.lower && volume.change > 20) {
            // Breakdown below lower band with high volume
            return {
              tradingOpportunity: true,
              opportunityDetails: {
                direction: 'short',
                confidence: 0.75,
                rationale: 'Breakdown below lower Bollinger Band with high volume'
              }
            };
          }
        }
      }
      
      return result;
    } catch (error) {
      logService.log('error', 'Failed to identify trading opportunity', error, 'MarketAnalyzer');
      return { tradingOpportunity: false };
    }
  }

  /**
   * Get a strategy by ID
   */
  private async getStrategy(strategyId: string): Promise<Strategy | null> {
    try {
      // This would typically fetch from a database or cache
      // For now, we'll just return a mock strategy
      return {
        id: strategyId,
        name: 'Mock Strategy',
        description: 'Mock strategy for testing',
        status: 'active',
        risk_level: 'Medium',
        strategy_config: {
          type: 'trend_following',
          indicators: ['RSI', 'MACD', 'BBANDS'],
          assets: ['BTC/USDT']
        }
      } as any;
    } catch (error) {
      logService.log('error', `Failed to get strategy ${strategyId}`, error, 'MarketAnalyzer');
      return null;
    }
  }

  /**
   * Get the latest analysis for a symbol and strategy
   */
  getAnalysis(symbol: string, strategyId: string): MarketAnalysis | null {
    const key = `${symbol}-${strategyId}`;
    return this.analyses.get(key) || null;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    
    // Clear all analyses
    this.analyses.clear();
    
    logService.log('info', 'Market analyzer cleaned up', null, 'MarketAnalyzer');
  }
}

export const marketAnalyzer = MarketAnalyzer.getInstance();
