import { 
  SMA, EMA, WMA, MACD, RSI, StochasticRSI, BollingerBands, 
  ATR, ADX, IchimokuCloud, OBV, VWAP, ROC, CCI, 
  WilliamsR, MFI, TRIX, Stochastic
} from 'technicalindicators';
import { Decimal } from 'decimal.js';
import { logService } from '../log-service';
import { EventEmitter } from '../event-emitter';
import type { Trade } from '../types';

export interface IndicatorConfig {
  name: string;
  type: string;
  period: number;
  parameters: Record<string, number>;
  timeframe?: string;
  weight?: number;
}

export interface IndicatorResult {
  name: string;
  value: number;
  signal?: number;
  upper?: number;
  lower?: number;
  timestamp?: number;
  additional?: Record<string, any>;
}

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

      const prices = trades.map(trade => trade.price);
      const result = await this.compute(config, prices);
      
      const finalResult = {
        ...result,
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, finalResult);
      return finalResult;
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

    const age = Date.now() - (cached.timestamp || 0);
    if (age > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  private async compute(
    config: IndicatorConfig,
    prices: number[]
  ): Promise<IndicatorResult> {
    const input = { 
      values: prices,
      period: config.period,
      ...config.parameters
    };

    switch (config.type) {
      case 'SMA':
        return {
          name: config.name,
          value: new SMA(input).getResult().slice(-1)[0]
        };
      case 'EMA':
        return {
          name: config.name,
          value: new EMA(input).getResult().slice(-1)[0]
        };
      case 'RSI':
        return {
          name: config.name,
          value: new RSI(input).getResult().slice(-1)[0]
        };
      case 'MACD': {
        const result = new MACD(input).getResult().slice(-1)[0];
        return {
          name: config.name,
          value: result.MACD,
          signal: result.signal,
          additional: { histogram: result.histogram }
        };
      }
      case 'BB': {
        const result = new BollingerBands(input).getResult().slice(-1)[0];
        return {
          name: config.name,
          value: result.middle,
          upper: result.upper,
          lower: result.lower
        };
      }
      default:
        throw new Error(`Unsupported indicator type: ${config.type}`);
    }
  }
}

// Export singleton instances
export const indicatorService = IndicatorService.getInstance();
