import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import type { IndicatorConfig, IndicatorResult, Trade } from './types';

export class IndicatorService extends EventEmitter {
  private static instance: IndicatorService;
  private indicators: Map<string, IndicatorConfig> = new Map();
  private cache: Map<string, IndicatorResult> = new Map();
  private readonly CACHE_DURATION = 60000; // 1 minute

  private constructor() {
    super();
  }

  static getInstance(): IndicatorService {
    if (!IndicatorService.instance) {
      IndicatorService.instance = new IndicatorService();
    }
    return IndicatorService.instance;
  }

  async calculateIndicator(
    config: IndicatorConfig,
    trades: Trade[]
  ): Promise<IndicatorResult> {
    try {
      const cacheKey = this.getCacheKey(config, trades);
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) return cachedResult;

      const result = await this.compute(config, trades);
      this.cache.set(cacheKey, {
        ...result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      logService.log('error', 'Failed to calculate indicator', 
        { config, error }, 'IndicatorService');
      throw error;
    }
  }

  private getCacheKey(config: IndicatorConfig, trades: Trade[]): string {
    const lastTradeTime = trades[trades.length - 1]?.timestamp || 0;
    return `${config.type}-${config.period}-${lastTradeTime}`;
  }

  private getFromCache(key: string): IndicatorResult | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  private async compute(
    config: IndicatorConfig,
    trades: Trade[]
  ): Promise<IndicatorResult> {
    switch (config.type) {
      case 'SMA':
        return this.calculateSMA(trades, config.period);
      case 'EMA':
        return this.calculateEMA(trades, config.period);
      case 'RSI':
        return this.calculateRSI(trades, config.period);
      case 'MACD':
        return this.calculateMACD(trades);
      case 'BB':
        return this.calculateBollingerBands(trades, config.period);
      default:
        throw new Error(`Unsupported indicator type: ${config.type}`);
    }
  }

  private calculateSMA(trades: Trade[], period: number): IndicatorResult {
    const prices = trades.map(trade => trade.price);
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    const sma = sum / period;

    return {
      name: 'SMA',
      value: sma,
      timestamp: Date.now(),
      metadata: { period }
    };
  }

  private calculateEMA(trades: Trade[], period: number): IndicatorResult {
    const prices = trades.map(trade => trade.price);
    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return {
      name: 'EMA',
      value: ema,
      timestamp: Date.now(),
      metadata: { period }
    };
  }

  private calculateRSI(trades: Trade[], period: number): IndicatorResult {
    const prices = trades.map(trade => trade.price);
    const changes = [];
    let gains = 0;
    let losses = 0;

    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    changes.slice(-period).forEach(change => {
      if (change > 0) gains += change;
      else losses -= change;
    });

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return {
      name: 'RSI',
      value: rsi,
      timestamp: Date.now(),
      metadata: { period }
    };
  }

  private calculateMACD(trades: Trade[]): IndicatorResult {
    const prices = trades.map(trade => trade.price);
    const ema12 = this.calculateEMA(trades, 12).value;
    const ema26 = this.calculateEMA(trades, 26).value;
    const macd = ema12 - ema26;
    const signal = this.calculateEMA(
      trades.map(t => ({ ...t, price: macd })),
      9
    ).value;

    return {
      name: 'MACD',
      value: macd,
      timestamp: Date.now(),
      metadata: {
        signal,
        histogram: macd - signal
      }
    };
  }

  private calculateBollingerBands(
    trades: Trade[],
    period: number
  ): IndicatorResult {
    const prices = trades.map(trade => trade.price);
    const sma = this.calculateSMA(trades, period).value;
    
    const squaredDiffs = prices
      .slice(-period)
      .map(price => Math.pow(price - sma, 2));
    
    const standardDeviation = Math.sqrt(
      squaredDiffs.reduce((a, b) => a + b, 0) / period
    );

    const upperBand = sma + (standardDeviation * 2);
    const lowerBand = sma - (standardDeviation * 2);

    return {
      name: 'BB',
      value: sma,
      timestamp: Date.now(),
      metadata: {
        upper: upperBand,
        lower: lowerBand,
        standardDeviation
      }
    };
  }

  clearCache(): void {
    this.cache.clear();
    logService.log('info', 'Indicator cache cleared', null, 'IndicatorService');
  }
}

export const indicatorService = IndicatorService.getInstance();
