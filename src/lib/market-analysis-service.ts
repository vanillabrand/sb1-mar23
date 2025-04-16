import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { marketDataService } from './market-data-service';
import { indicatorService } from './indicator-service';
import { bitmartService } from './bitmart-service';
import { MarketAnalysis, MarketRegime } from './types';

/**
 * Service for analyzing market conditions
 * Provides detailed market analysis for trading decisions
 */
class MarketAnalysisService extends EventEmitter {
  private static instance: MarketAnalysisService;
  private marketAnalysisCache: Map<string, MarketAnalysis> = new Map();
  private lastUpdated: Map<string, number> = new Map();
  private updateInterval: number = 5 * 60 * 1000; // 5 minutes
  private isInitialized: boolean = false;

  private constructor() {
    super();
  }

  static getInstance(): MarketAnalysisService {
    if (!MarketAnalysisService.instance) {
      MarketAnalysisService.instance = new MarketAnalysisService();
    }
    return MarketAnalysisService.instance;
  }

  /**
   * Initialize the market analysis service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logService.log('info', 'Initializing market analysis service', null, 'MarketAnalysisService');
      this.isInitialized = true;
    } catch (error) {
      logService.log('error', 'Failed to initialize market analysis service', error, 'MarketAnalysisService');
      throw error;
    }
  }

  /**
   * Get market analysis for a symbol
   * @param symbol The trading pair symbol
   * @param forceRefresh Whether to force a refresh of the analysis
   */
  async getMarketAnalysis(symbol: string, forceRefresh: boolean = false): Promise<MarketAnalysis> {
    try {
      // Normalize symbol format
      const normalizedSymbol = symbol.includes('/') ? symbol : symbol.replace('_', '/');
      
      // Check if we have a cached analysis that's still fresh
      const cachedAnalysis = this.marketAnalysisCache.get(normalizedSymbol);
      const lastUpdate = this.lastUpdated.get(normalizedSymbol) || 0;
      const now = Date.now();
      
      if (cachedAnalysis && !forceRefresh && (now - lastUpdate) < this.updateInterval) {
        return cachedAnalysis;
      }
      
      // Perform a new analysis
      logService.log('info', `Analyzing market conditions for ${normalizedSymbol}`, null, 'MarketAnalysisService');
      
      // Get historical data
      const historicalData = await this.getHistoricalData(normalizedSymbol);
      if (!historicalData || historicalData.length < 30) {
        throw new Error(`Insufficient historical data for ${normalizedSymbol}`);
      }
      
      // Detect market regime
      const regime = await this.detectMarketRegime(historicalData);
      
      // Analyze trend
      const trendAnalysis = await this.analyzeTrend(historicalData);
      
      // Calculate volatility
      const volatility = await this.calculateVolatility(historicalData);
      
      // Analyze volume
      const volumeAnalysis = await this.analyzeVolume(historicalData);
      
      // Analyze liquidity
      const liquidityAnalysis = await this.analyzeLiquidity(normalizedSymbol);
      
      // Find support and resistance levels
      const levels = await this.findSupportResistanceLevels(historicalData);
      
      // Create the market analysis object
      const analysis: MarketAnalysis = {
        regime,
        trend: trendAnalysis.trend,
        strength: trendAnalysis.strength,
        volatility: volatility.normalized,
        volume: {
          current: volumeAnalysis.current,
          average: volumeAnalysis.average,
          trend: volumeAnalysis.trend
        },
        liquidity: {
          score: liquidityAnalysis.score,
          spreadPercentage: liquidityAnalysis.spreadPercentage,
          depth: liquidityAnalysis.depth
        },
        support: levels.support,
        resistance: levels.resistance
      };
      
      // Cache the analysis
      this.marketAnalysisCache.set(normalizedSymbol, analysis);
      this.lastUpdated.set(normalizedSymbol, now);
      
      // Emit an event with the new analysis
      this.emit('analysisUpdated', {
        symbol: normalizedSymbol,
        analysis
      });
      
      return analysis;
    } catch (error) {
      logService.log('error', `Failed to analyze market for ${symbol}`, error, 'MarketAnalysisService');
      
      // Return a default analysis if we can't get a real one
      return this.createDefaultAnalysis();
    }
  }

  /**
   * Get historical market data for analysis
   * @param symbol The trading pair symbol
   */
  private async getHistoricalData(symbol: string): Promise<any[]> {
    try {
      // Try to get data from market data service first
      const marketData = marketDataService.getMarketData(symbol);
      if (marketData && marketData.candles && marketData.candles.length > 0) {
        return marketData.candles;
      }
      
      // Fallback to getting data directly
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (7 * 24 * 60 * 60); // 7 days of data
      
      const klines = await bitmartService.getKlines(symbol, startTime, endTime, '1h');
      return klines.map(kline => ({
        timestamp: kline[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5])
      }));
    } catch (error) {
      logService.log('error', `Failed to get historical data for ${symbol}`, error, 'MarketAnalysisService');
      return [];
    }
  }

  /**
   * Detect the current market regime
   * @param historicalData Historical market data
   */
  private async detectMarketRegime(historicalData: any[]): Promise<MarketRegime> {
    try {
      if (!historicalData || historicalData.length < 14) {
        return 'unknown';
      }
      
      // Calculate ADX to determine trend strength
      const adxConfig = {
        type: 'ADX',
        period: 14,
        parameters: {}
      };
      
      const adx = await indicatorService.calculateIndicator(adxConfig, historicalData.map(d => d.close));
      
      // Calculate ATR for volatility
      const atrConfig = {
        type: 'ATR',
        period: 14,
        parameters: {}
      };
      
      const atr = await indicatorService.calculateIndicator(atrConfig, historicalData);
      
      // Calculate volatility as percentage of price
      const currentPrice = historicalData[historicalData.length - 1].close;
      const volatilityRatio = atr.value / currentPrice;
      
      // Determine regime based on ADX and volatility
      if (adx.value > 25) {
        return 'trending';
      } else if (volatilityRatio > 0.03) {
        return 'volatile';
      } else {
        return 'ranging';
      }
    } catch (error) {
      logService.log('error', 'Failed to detect market regime', error, 'MarketAnalysisService');
      return 'unknown';
    }
  }

  /**
   * Analyze the market trend
   * @param historicalData Historical market data
   */
  private async analyzeTrend(historicalData: any[]): Promise<{ trend: 'bullish' | 'bearish' | 'neutral', strength: number }> {
    try {
      if (!historicalData || historicalData.length < 20) {
        return { trend: 'neutral', strength: 0 };
      }
      
      // Calculate EMAs
      const ema20Config = {
        type: 'EMA',
        period: 20,
        parameters: {}
      };
      
      const ema50Config = {
        type: 'EMA',
        period: 50,
        parameters: {}
      };
      
      const ema20 = await indicatorService.calculateIndicator(ema20Config, historicalData.map(d => d.close));
      const ema50 = await indicatorService.calculateIndicator(ema50Config, historicalData.map(d => d.close));
      
      // Calculate MACD
      const macdConfig = {
        type: 'MACD',
        period: null,
        parameters: {
          fast_period: 12,
          slow_period: 26,
          signal_period: 9
        }
      };
      
      const macd = await indicatorService.calculateIndicator(macdConfig, historicalData.map(d => d.close));
      
      // Determine trend based on EMAs and MACD
      let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      let strength = 0;
      
      // EMA trend
      const emaTrend = ema20.value > ema50.value ? 'bullish' : ema20.value < ema50.value ? 'bearish' : 'neutral';
      
      // MACD trend
      const macdTrend = macd.value > macd.signal ? 'bullish' : macd.value < macd.signal ? 'bearish' : 'neutral';
      
      // Price action trend
      const priceActionTrend = this.analyzePriceAction(historicalData);
      
      // Combine trends with weighting
      if (emaTrend === 'bullish' && macdTrend === 'bullish') {
        trend = 'bullish';
        strength = 80;
      } else if (emaTrend === 'bearish' && macdTrend === 'bearish') {
        trend = 'bearish';
        strength = 80;
      } else if (emaTrend === 'bullish' || macdTrend === 'bullish') {
        trend = priceActionTrend === 'bearish' ? 'neutral' : 'bullish';
        strength = 40;
      } else if (emaTrend === 'bearish' || macdTrend === 'bearish') {
        trend = priceActionTrend === 'bullish' ? 'neutral' : 'bearish';
        strength = 40;
      } else {
        trend = priceActionTrend;
        strength = 20;
      }
      
      // Adjust strength based on price action
      if (trend === priceActionTrend) {
        strength += 20;
      }
      
      return { trend, strength };
    } catch (error) {
      logService.log('error', 'Failed to analyze trend', error, 'MarketAnalysisService');
      return { trend: 'neutral', strength: 0 };
    }
  }

  /**
   * Analyze price action to determine trend
   * @param historicalData Historical market data
   */
  private analyzePriceAction(historicalData: any[]): 'bullish' | 'bearish' | 'neutral' {
    try {
      if (!historicalData || historicalData.length < 10) {
        return 'neutral';
      }
      
      // Get the last 10 candles
      const recentCandles = historicalData.slice(-10);
      
      // Count bullish and bearish candles
      let bullishCount = 0;
      let bearishCount = 0;
      
      for (const candle of recentCandles) {
        if (candle.close > candle.open) {
          bullishCount++;
        } else if (candle.close < candle.open) {
          bearishCount++;
        }
      }
      
      // Check for higher highs and higher lows (bullish) or lower highs and lower lows (bearish)
      let higherHighs = 0;
      let higherLows = 0;
      let lowerHighs = 0;
      let lowerLows = 0;
      
      for (let i = 1; i < recentCandles.length; i++) {
        if (recentCandles[i].high > recentCandles[i-1].high) higherHighs++;
        if (recentCandles[i].low > recentCandles[i-1].low) higherLows++;
        if (recentCandles[i].high < recentCandles[i-1].high) lowerHighs++;
        if (recentCandles[i].low < recentCandles[i-1].low) lowerLows++;
      }
      
      // Determine trend based on candle count and price structure
      if (bullishCount >= 7 || (higherHighs >= 6 && higherLows >= 6)) {
        return 'bullish';
      } else if (bearishCount >= 7 || (lowerHighs >= 6 && lowerLows >= 6)) {
        return 'bearish';
      } else {
        return 'neutral';
      }
    } catch (error) {
      logService.log('error', 'Failed to analyze price action', error, 'MarketAnalysisService');
      return 'neutral';
    }
  }

  /**
   * Calculate market volatility
   * @param historicalData Historical market data
   */
  private async calculateVolatility(historicalData: any[]): Promise<{ raw: number, normalized: number }> {
    try {
      if (!historicalData || historicalData.length < 14) {
        return { raw: 0, normalized: 50 };
      }
      
      // Calculate ATR for volatility
      const atrConfig = {
        type: 'ATR',
        period: 14,
        parameters: {}
      };
      
      const atr = await indicatorService.calculateIndicator(atrConfig, historicalData);
      
      // Calculate volatility as percentage of price
      const currentPrice = historicalData[historicalData.length - 1].close;
      const volatilityRatio = atr.value / currentPrice;
      
      // Normalize to 0-100 scale
      // Typical volatility ranges from 0.5% to 5% for most assets
      const normalizedVolatility = Math.min(100, Math.max(0, volatilityRatio * 2000));
      
      return {
        raw: volatilityRatio,
        normalized: normalizedVolatility
      };
    } catch (error) {
      logService.log('error', 'Failed to calculate volatility', error, 'MarketAnalysisService');
      return { raw: 0, normalized: 50 };
    }
  }

  /**
   * Analyze trading volume
   * @param historicalData Historical market data
   */
  private async analyzeVolume(historicalData: any[]): Promise<{ current: number, average: number, trend: 'increasing' | 'decreasing' | 'stable' }> {
    try {
      if (!historicalData || historicalData.length < 20) {
        return { current: 0, average: 0, trend: 'stable' };
      }
      
      // Get recent volume data
      const volumeData = historicalData.map(d => d.volume);
      const currentVolume = volumeData[volumeData.length - 1];
      
      // Calculate average volume (20 periods)
      const volumeSum = volumeData.slice(-20).reduce((sum, vol) => sum + vol, 0);
      const averageVolume = volumeSum / 20;
      
      // Calculate volume trend
      const recentVolumeSum = volumeData.slice(-5).reduce((sum, vol) => sum + vol, 0);
      const previousVolumeSum = volumeData.slice(-10, -5).reduce((sum, vol) => sum + vol, 0);
      
      let trend: 'increasing' | 'decreasing' | 'stable';
      
      if (recentVolumeSum > previousVolumeSum * 1.2) {
        trend = 'increasing';
      } else if (recentVolumeSum < previousVolumeSum * 0.8) {
        trend = 'decreasing';
      } else {
        trend = 'stable';
      }
      
      return {
        current: currentVolume,
        average: averageVolume,
        trend
      };
    } catch (error) {
      logService.log('error', 'Failed to analyze volume', error, 'MarketAnalysisService');
      return { current: 0, average: 0, trend: 'stable' };
    }
  }

  /**
   * Analyze market liquidity
   * @param symbol The trading pair symbol
   */
  private async analyzeLiquidity(symbol: string): Promise<{ score: number, spreadPercentage: number, depth: number }> {
    try {
      // Try to get order book data
      const orderBook = await marketDataService.getOrderBook(symbol);
      
      if (!orderBook || !orderBook.bids || !orderBook.asks || 
          orderBook.bids.length === 0 || orderBook.asks.length === 0) {
        return { score: 50, spreadPercentage: 0.1, depth: 0 };
      }
      
      // Calculate spread
      const bestBid = orderBook.bids[0][0];
      const bestAsk = orderBook.asks[0][0];
      const spread = bestAsk - bestBid;
      const spreadPercentage = (spread / bestBid) * 100;
      
      // Calculate depth (sum of bids and asks within 2% of mid price)
      const midPrice = (bestBid + bestAsk) / 2;
      const depthRange = midPrice * 0.02; // 2% of mid price
      
      let bidDepth = 0;
      let askDepth = 0;
      
      // Sum bid depth
      for (const [price, amount] of orderBook.bids) {
        if (price >= midPrice - depthRange) {
          bidDepth += price * amount;
        } else {
          break;
        }
      }
      
      // Sum ask depth
      for (const [price, amount] of orderBook.asks) {
        if (price <= midPrice + depthRange) {
          askDepth += price * amount;
        } else {
          break;
        }
      }
      
      const totalDepth = bidDepth + askDepth;
      
      // Calculate liquidity score (0-100)
      // Lower spread and higher depth = higher score
      const spreadScore = Math.max(0, 100 - (spreadPercentage * 100));
      const depthScore = Math.min(100, Math.log10(totalDepth + 1) * 20);
      
      const liquidityScore = (spreadScore * 0.6) + (depthScore * 0.4);
      
      return {
        score: liquidityScore,
        spreadPercentage,
        depth: totalDepth
      };
    } catch (error) {
      logService.log('error', `Failed to analyze liquidity for ${symbol}`, error, 'MarketAnalysisService');
      return { score: 50, spreadPercentage: 0.1, depth: 0 };
    }
  }

  /**
   * Find support and resistance levels
   * @param historicalData Historical market data
   */
  private async findSupportResistanceLevels(historicalData: any[]): Promise<{ support: number | null, resistance: number | null }> {
    try {
      if (!historicalData || historicalData.length < 30) {
        return { support: null, resistance: null };
      }
      
      const prices = historicalData.map(d => d.close);
      const currentPrice = prices[prices.length - 1];
      
      // Find potential support levels (recent lows)
      const lows = historicalData.map(d => d.low);
      const potentialSupports = this.findPivotPoints(lows, 'support');
      
      // Find potential resistance levels (recent highs)
      const highs = historicalData.map(d => d.high);
      const potentialResistances = this.findPivotPoints(highs, 'resistance');
      
      // Find nearest support below current price
      let nearestSupport: number | null = null;
      let supportDistance = Infinity;
      
      for (const support of potentialSupports) {
        if (support < currentPrice) {
          const distance = currentPrice - support;
          if (distance < supportDistance) {
            supportDistance = distance;
            nearestSupport = support;
          }
        }
      }
      
      // Find nearest resistance above current price
      let nearestResistance: number | null = null;
      let resistanceDistance = Infinity;
      
      for (const resistance of potentialResistances) {
        if (resistance > currentPrice) {
          const distance = resistance - currentPrice;
          if (distance < resistanceDistance) {
            resistanceDistance = distance;
            nearestResistance = resistance;
          }
        }
      }
      
      return {
        support: nearestSupport,
        resistance: nearestResistance
      };
    } catch (error) {
      logService.log('error', 'Failed to find support and resistance levels', error, 'MarketAnalysisService');
      return { support: null, resistance: null };
    }
  }

  /**
   * Find pivot points in price data
   * @param prices Array of price data
   * @param type Type of pivot points to find ('support' or 'resistance')
   */
  private findPivotPoints(prices: number[], type: 'support' | 'resistance'): number[] {
    const pivots: number[] = [];
    const windowSize = 5; // Look for local minima/maxima in a window of 5 candles
    
    for (let i = windowSize; i < prices.length - windowSize; i++) {
      const currentPrice = prices[i];
      let isPivot = true;
      
      if (type === 'support') {
        // For support, check if this is a local minimum
        for (let j = i - windowSize; j <= i + windowSize; j++) {
          if (j !== i && prices[j] < currentPrice) {
            isPivot = false;
            break;
          }
        }
      } else {
        // For resistance, check if this is a local maximum
        for (let j = i - windowSize; j <= i + windowSize; j++) {
          if (j !== i && prices[j] > currentPrice) {
            isPivot = false;
            break;
          }
        }
      }
      
      if (isPivot) {
        pivots.push(currentPrice);
      }
    }
    
    return pivots;
  }

  /**
   * Create a default market analysis when real analysis fails
   */
  private createDefaultAnalysis(): MarketAnalysis {
    return {
      regime: 'unknown',
      trend: 'neutral',
      strength: 50,
      volatility: 50,
      volume: {
        current: 0,
        average: 0,
        trend: 'stable'
      },
      liquidity: {
        score: 50,
        spreadPercentage: 0.1,
        depth: 0
      },
      support: null,
      resistance: null
    };
  }
}

export const marketAnalysisService = MarketAnalysisService.getInstance();
