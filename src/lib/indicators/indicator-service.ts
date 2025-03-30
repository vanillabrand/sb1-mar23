import { EventEmitter } from '../event-emitter';
import { logService } from '../log-service';
import type { IndicatorConfig, IndicatorResult, Trade } from '../types';

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

  private calculateSMA(trades: Trade[], period: number = 20): IndicatorResult {
    try {
      if (!period || period <= 0) {
        throw new Error('Invalid period for SMA calculation');
      }

      if (trades.length < period) {
        throw new Error('Not enough data points for SMA calculation');
      }

      const prices = trades.map(trade => trade.price);
      const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
      const sma = sum / period;

      return {
        value: sma,
        timestamp: Date.now()
      };
    } catch (error) {
      logService.log('error', 'Failed to calculate SMA', error, 'IndicatorService');
      throw error;
    }
  }

  private calculateEMA(trades: Trade[], period: number = 20): IndicatorResult {
    try {
      if (!period || period <= 0) {
        throw new Error('Invalid period for EMA calculation');
      }

      if (trades.length < period) {
        throw new Error('Not enough data points for EMA calculation');
      }

      const prices = trades.map(trade => trade.price);
      const multiplier = 2 / (period + 1);
      let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period; // Start with SMA

      for (let i = period; i < prices.length; i++) {
        ema = (prices[i] - ema) * multiplier + ema;
      }

      return {
        value: ema,
        timestamp: Date.now()
      };
    } catch (error) {
      logService.log('error', 'Failed to calculate EMA', error, 'IndicatorService');
      throw error;
    }
  }

  private calculateRSI(trades: Trade[], period: number = 14): IndicatorResult {
    try {
      if (!period || period <= 0) {
        throw new Error('Invalid period for RSI calculation');
      }

      if (trades.length < period + 1) {
        throw new Error('Not enough data points for RSI calculation');
      }

      const prices = trades.map(trade => trade.price);
      const changes = [];
      let gains = 0;
      let losses = 0;

      // Calculate price changes
      for (let i = 1; i < prices.length; i++) {
        changes.push(prices[i] - prices[i - 1]);
      }

      // Calculate initial average gain and loss
      changes.slice(0, period).forEach(change => {
        if (change > 0) gains += change;
        else losses -= change; // Make losses positive
      });

      let avgGain = gains / period;
      let avgLoss = losses / period;

      // Calculate RSI using smoothed averages for the rest of the data
      for (let i = period; i < changes.length; i++) {
        const change = changes[i];
        if (change > 0) {
          avgGain = (avgGain * (period - 1) + change) / period;
          avgLoss = (avgLoss * (period - 1)) / period;
        } else {
          avgGain = (avgGain * (period - 1)) / period;
          avgLoss = (avgLoss * (period - 1) - change) / period;
        }
      }

      // Calculate RSI
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));

      return {
        value: rsi,
        timestamp: Date.now()
      };
    } catch (error) {
      logService.log('error', 'Failed to calculate RSI', error, 'IndicatorService');
      throw error;
    }
  }

  private calculateMACD(trades: Trade[]): IndicatorResult {
    try {
      if (trades.length < 26) {
        throw new Error('Not enough data points for MACD calculation');
      }

      // Calculate EMAs
      const fastEMA = this.calculateEMA(trades, 12).value;
      const slowEMA = this.calculateEMA(trades, 26).value;
      const macd = fastEMA - slowEMA;

      // Calculate signal line (9-day EMA of MACD)
      // Create synthetic trades with MACD as price
      const macdTrades: Trade[] = trades.slice(-9).map((trade, index) => ({
        ...trade,
        price: macd // Use MACD as the price for signal calculation
      }));

      const signal = this.calculateEMA(macdTrades, 9).value;

      return {
        value: macd,
        signal: signal,
        timestamp: Date.now()
      };
    } catch (error) {
      logService.log('error', 'Failed to calculate MACD', error, 'IndicatorService');
      throw error;
    }
  }

  private calculateBollingerBands(trades: Trade[], period: number = 20): IndicatorResult {
    try {
      if (!period || period <= 0) {
        throw new Error('Invalid period for Bollinger Bands calculation');
      }

      if (trades.length < period) {
        throw new Error('Not enough data points for Bollinger Bands calculation');
      }

      // Calculate SMA
      const sma = this.calculateSMA(trades, period).value;
      const prices = trades.map(trade => trade.price).slice(-period);

      // Calculate standard deviation
      const squaredDiffs = prices.map(price => Math.pow(price - sma, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
      const stdDev = Math.sqrt(variance);

      // Calculate upper and lower bands (2 standard deviations from SMA)
      const upperBand = sma + (2 * stdDev);
      const lowerBand = sma - (2 * stdDev);

      return {
        value: sma, // Middle band
        signal: upperBand, // Using signal to store upper band
        timestamp: Date.now()
      };
    } catch (error) {
      logService.log('error', 'Failed to calculate Bollinger Bands', error, 'IndicatorService');
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
    logService.log('info', 'Indicator cache cleared', null, 'IndicatorService');
  }
}