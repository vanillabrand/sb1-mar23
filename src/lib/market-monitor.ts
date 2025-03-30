import { EventEmitter } from './event-emitter';
import { logService } from './services';
import type { Strategy, MarketData, MarketCondition } from './types';

class MarketMonitor extends EventEmitter {
  private readonly UPDATE_INTERVAL = 60000; // 1 minute
  private readonly ANALYSIS_INTERVAL = 300000; // 5 minutes

  private strategies: Strategy[] = [];
  private marketData: Map<string, MarketData> = new Map();

  constructor() {
    super();
    this.startMonitoring();
  }

  private async startMonitoring(): Promise<void> {
    setInterval(() => {
      this.strategies.forEach(strategy => {
        this.updateMarketData(strategy).catch(error => {
          logService.log('error', 'Market data update failed',
            { strategy: strategy.id, error }, 'MarketMonitor');
        });
      });
    }, this.UPDATE_INTERVAL);

    setInterval(() => {
      this.strategies.forEach(strategy => {
        this.analyzeMarketConditions(strategy).catch(error => {
          logService.log('error', 'Market analysis failed',
            { strategy: strategy.id, error }, 'MarketMonitor');
        });
      });
    }, this.ANALYSIS_INTERVAL);
  }

  private async analyzeMarketConditions(strategy: Strategy): Promise<void> {
    try {
      const marketData = this.marketData.get(strategy.id);
      if (!marketData) return;

      const conditions: MarketCondition = {
        timestamp: Date.now(),
        volatility: this.calculateVolatility(marketData),
        trend: this.identifyTrend(marketData),
        volume: this.analyzeVolume(marketData),
        liquidity: this.assessLiquidity(marketData),
        sentiment: await this.analyzeSentiment(marketData)
      };

      this.emit('marketConditionUpdate', {
        strategyId: strategy.id,
        conditions
      });
    } catch (error) {
      logService.log('error', 'Failed to analyze market conditions',
        { strategy: strategy.id, error }, 'MarketMonitor');
      throw error;
    }
  }

  private calculateVolatility(marketData: MarketData): number {
    try {
      // Calculate standard deviation of price changes
      if (!marketData.candles || marketData.candles.length < 2) {
        return 0;
      }

      const prices = marketData.candles.map(candle => candle.close);
      const returns = [];

      // Calculate percentage returns
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }

      // Calculate standard deviation
      const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
      const squaredDiffs = returns.map(value => Math.pow(value - mean, 2));
      const variance = squaredDiffs.reduce((sum, value) => sum + value, 0) / returns.length;

      return Math.sqrt(variance) * 100; // Convert to percentage
    } catch (error) {
      logService.log('error', 'Failed to calculate volatility', { error }, 'MarketMonitor');
      return 0;
    }
  }

  private identifyTrend(marketData: MarketData): 'up' | 'down' | 'sideways' {
    try {
      if (!marketData.candles || marketData.candles.length < 10) {
        return 'sideways';
      }

      const prices = marketData.candles.map(candle => candle.close);

      // Calculate short-term and long-term moving averages
      const shortTermMA = this.calculateSMA(prices, 5);
      const longTermMA = this.calculateSMA(prices, 20);

      // Calculate price change percentage
      const startPrice = prices[0];
      const endPrice = prices[prices.length - 1];
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
      logService.log('error', 'Failed to identify trend', { error }, 'MarketMonitor');
      return 'sideways';
    }
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return 0;
    }

    const sum = prices.slice(-period).reduce((total, price) => total + price, 0);
    return sum / period;
  }

  private analyzeVolume(marketData: MarketData): {
    current: number;
    average: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    try {
      if (!marketData.candles || marketData.candles.length < 10) {
        return {
          current: 0,
          average: 0,
          trend: 'stable'
        };
      }

      const volumes = marketData.candles.map(candle => candle.volume);
      const current = volumes[volumes.length - 1];
      const average = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;

      // Calculate short-term volume trend
      const recentVolumes = volumes.slice(-5);
      const recentAvg = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;

      // Determine volume trend
      let trend: 'increasing' | 'decreasing' | 'stable';
      const changePercent = ((recentAvg - average) / average) * 100;

      if (changePercent > 10) {
        trend = 'increasing';
      } else if (changePercent < -10) {
        trend = 'decreasing';
      } else {
        trend = 'stable';
      }

      return {
        current,
        average,
        trend
      };
    } catch (error) {
      logService.log('error', 'Failed to analyze volume', { error }, 'MarketMonitor');
      return {
        current: 0,
        average: 0,
        trend: 'stable'
      };
    }
  }

  private assessLiquidity(marketData: MarketData): {
    score: number;
    spreadAvg: number;
    depth: number;
  } {
    try {
      if (!marketData.ticker || !marketData.trades || marketData.trades.length === 0) {
        return {
          score: 0,
          spreadAvg: 0,
          depth: 0
        };
      }

      // Calculate average spread
      const spread = marketData.ticker.ask - marketData.ticker.bid;
      const spreadPercent = (spread / marketData.ticker.bid) * 100;

      // Calculate market depth (simplified)
      const depth = marketData.ticker.bidVolume + marketData.ticker.askVolume;

      // Calculate trade frequency
      const tradeFrequency = marketData.trades.length / 10; // Assuming trades are from last 10 minutes

      // Calculate liquidity score (0-100)
      const spreadScore = Math.max(0, 100 - (spreadPercent * 20)); // Lower spread is better
      const depthScore = Math.min(100, (depth / 1000) * 100); // Higher depth is better
      const frequencyScore = Math.min(100, tradeFrequency * 10); // Higher frequency is better

      const liquidityScore = (spreadScore * 0.4) + (depthScore * 0.4) + (frequencyScore * 0.2);

      return {
        score: Math.round(liquidityScore),
        spreadAvg: spreadPercent,
        depth
      };
    } catch (error) {
      logService.log('error', 'Failed to assess liquidity', { error }, 'MarketMonitor');
      return {
        score: 0,
        spreadAvg: 0,
        depth: 0
      };
    }
  }

  private async analyzeSentiment(marketData: MarketData): Promise<{
    score: number;
    signals: string[];
  }> {
    try {
      if (!marketData.candles || marketData.candles.length < 20) {
        return {
          score: 50, // Neutral
          signals: ['Insufficient data for sentiment analysis']
        };
      }

      const signals: string[] = [];
      let sentimentScore = 50; // Start with neutral sentiment

      // Analyze price action
      const prices = marketData.candles.map(candle => candle.close);
      const priceChange = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;

      if (priceChange > 5) {
        sentimentScore += 15;
        signals.push('Strong bullish price action');
      } else if (priceChange > 2) {
        sentimentScore += 10;
        signals.push('Moderate bullish price action');
      } else if (priceChange < -5) {
        sentimentScore -= 15;
        signals.push('Strong bearish price action');
      } else if (priceChange < -2) {
        sentimentScore -= 10;
        signals.push('Moderate bearish price action');
      }

      // Analyze volume
      const volumes = marketData.candles.map(candle => candle.volume);
      const avgVolume = volumes.slice(0, volumes.length - 5).reduce((sum, vol) => sum + vol, 0) / (volumes.length - 5);
      const recentVolume = volumes.slice(-5).reduce((sum, vol) => sum + vol, 0) / 5;
      const volumeChange = ((recentVolume - avgVolume) / avgVolume) * 100;

      if (volumeChange > 50 && priceChange > 0) {
        sentimentScore += 15;
        signals.push('High volume supporting upward movement');
      } else if (volumeChange > 50 && priceChange < 0) {
        sentimentScore -= 15;
        signals.push('High volume supporting downward movement');
      } else if (volumeChange < -30) {
        sentimentScore -= 5;
        signals.push('Declining volume indicating potential reversal');
      }

      // Ensure score is within 0-100 range
      sentimentScore = Math.max(0, Math.min(100, sentimentScore));

      return {
        score: sentimentScore,
        signals
      };
    } catch (error) {
      logService.log('error', 'Failed to analyze sentiment', { error }, 'MarketMonitor');
      return {
        score: 50,
        signals: ['Error in sentiment analysis']
      };
    }
  }

  public async updateMarketData(strategy: Strategy): Promise<void> {
    try {
      // This would typically fetch data from an exchange API
      // For now, we'll create mock data if none exists
      if (!this.marketData.has(strategy.id)) {
        this.marketData.set(strategy.id, this.createInitialMarketData());
        return;
      }

      // Update existing market data
      const existingData = this.marketData.get(strategy.id)!;
      const updatedData = await this.fetchLatestMarketData(strategy, existingData);
      this.marketData.set(strategy.id, updatedData);

      // Emit event with updated data
      this.emit('marketDataUpdate', {
        strategyId: strategy.id,
        marketData: updatedData
      });
    } catch (error) {
      logService.log('error', 'Failed to update market data',
        { strategy: strategy.id, error }, 'MarketMonitor');
      throw error;
    }
  }

  private createInitialMarketData(): MarketData {
    // Create mock market data for initial state
    const now = Date.now();
    const basePrice = 50000 + Math.random() * 1000;

    // Generate mock candles for the past 24 hours (24 hourly candles)
    const candles = Array.from({ length: 24 }, (_, i) => {
      const timestamp = now - (23 - i) * 3600000; // hourly candles
      const open = basePrice * (1 + (Math.random() * 0.02 - 0.01));
      const high = open * (1 + Math.random() * 0.01);
      const low = open * (1 - Math.random() * 0.01);
      const close = low + Math.random() * (high - low);
      const volume = 10000 + Math.random() * 5000;

      return { timestamp, open, high, low, close, volume };
    });

    // Generate mock ticker data
    const lastCandle = candles[candles.length - 1];
    const ticker = {
      bid: lastCandle.close * 0.999,
      ask: lastCandle.close * 1.001,
      last: lastCandle.close,
      bidVolume: 5000 + Math.random() * 2000,
      askVolume: 5000 + Math.random() * 2000,
      timestamp: now
    };

    // Generate mock trades
    const trades = Array.from({ length: 50 }, (_, i) => {
      const timestamp = now - (50 - i) * 60000; // one per minute
      const price = lastCandle.close * (1 + (Math.random() * 0.004 - 0.002));
      const amount = 0.1 + Math.random() * 2;
      const side = Math.random() > 0.5 ? 'buy' : 'sell';

      return { timestamp, price, amount, side };
    });

    return {
      ticker,
      candles,
      trades,
      lastUpdate: now
    };
  }

  private async fetchLatestMarketData(strategy: Strategy, existingData: MarketData): Promise<MarketData> {
    // In a real implementation, this would fetch from an exchange API
    // For now, we'll just update the mock data

    const now = Date.now();
    const lastCandle = existingData.candles[existingData.candles.length - 1];
    const lastPrice = lastCandle.close;

    // Update ticker
    const newPrice = lastPrice * (1 + (Math.random() * 0.006 - 0.003));
    const ticker = {
      bid: newPrice * 0.999,
      ask: newPrice * 1.001,
      last: newPrice,
      bidVolume: 5000 + Math.random() * 2000,
      askVolume: 5000 + Math.random() * 2000,
      timestamp: now
    };

    // Add new candle if an hour has passed
    const candles = [...existingData.candles];
    const hoursSinceLastCandle = (now - lastCandle.timestamp) / 3600000;

    if (hoursSinceLastCandle >= 1) {
      const open = lastPrice;
      const high = open * (1 + Math.random() * 0.01);
      const low = open * (1 - Math.random() * 0.01);
      const close = newPrice;
      const volume = 10000 + Math.random() * 5000;

      // Remove oldest candle if we have more than 24
      if (candles.length >= 24) {
        candles.shift();
      }

      candles.push({ timestamp: now, open, high, low, close, volume });
    } else {
      // Update the last candle
      const updatedLastCandle = { ...lastCandle };
      updatedLastCandle.close = newPrice;
      updatedLastCandle.high = Math.max(updatedLastCandle.high, newPrice);
      updatedLastCandle.low = Math.min(updatedLastCandle.low, newPrice);
      updatedLastCandle.volume += Math.random() * 100;

      candles[candles.length - 1] = updatedLastCandle;
    }

    // Add new trades
    const trades = [...existingData.trades];
    const newTrades = Array.from({ length: 5 }, (_, i) => {
      const timestamp = now - (5 - i) * 12000; // 5 trades in the last minute
      const price = newPrice * (1 + (Math.random() * 0.002 - 0.001));
      const amount = 0.1 + Math.random() * 2;
      const side = Math.random() > 0.5 ? 'buy' : 'sell';

      return { timestamp, price, amount, side };
    });

    // Keep only the most recent 50 trades
    trades.push(...newTrades);
    if (trades.length > 50) {
      trades.splice(0, trades.length - 50);
    }

    return {
      ticker,
      candles,
      trades,
      lastUpdate: now
    };
  }

  public getMarketData(strategyId: string): MarketData | undefined {
    return this.marketData.get(strategyId);
  }

  public addStrategy(strategy: Strategy): void {
    this.strategies.push(strategy);
  }

  public removeStrategy(strategyId: string): void {
    this.strategies = this.strategies.filter(s => s.id !== strategyId);
    this.marketData.delete(strategyId);
  }
}

// Export singleton instance
export const marketMonitor = new MarketMonitor();
