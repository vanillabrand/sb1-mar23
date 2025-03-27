import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import * as technicalIndicators from 'technicalindicators';

class IndicatorService extends EventEmitter {
  private static instance: IndicatorService;

  private constructor() {
    super();
  }

  public static getInstance(): IndicatorService {
    if (!IndicatorService.instance) {
      IndicatorService.instance = new IndicatorService();
    }
    return IndicatorService.instance;
  }

  async calculateADX(candles: any[], period: number = 14): Promise<number> {
    try {
      const input = {
        high: candles.map(c => c.high),
        low: candles.map(c => c.low),
        close: candles.map(c => c.close),
        period
      };

      const adx = new technicalIndicators.ADX(input);
      const result = adx.getResult();
      return result[result.length - 1];
    } catch (error) {
      logService.log('error', 'Failed to calculate ADX', error, 'IndicatorService');
      throw error;
    }
  }

  async calculateMACD(candles: any[], options: {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
  }): Promise<{ histogram: number[]; signal: number[]; macd: number[] }> {
    try {
      const input = {
        values: candles.map(c => c.close),
        ...options
      };

      const macd = new technicalIndicators.MACD(input);
      const result = macd.getResult();
      
      return {
        histogram: result.map(r => r.histogram),
        signal: result.map(r => r.signal),
        macd: result.map(r => r.MACD)
      };
    } catch (error) {
      logService.log('error', 'Failed to calculate MACD', error, 'IndicatorService');
      throw error;
    }
  }

  async calculateBB(candles: any[], period: number, stdDev: number): Promise<{
    upper: number[];
    middle: number[];
    lower: number[];
  }> {
    try {
      const input = {
        period,
        values: candles.map(c => c.close),
        stdDev
      };

      const bb = new technicalIndicators.BollingerBands(input);
      const result = bb.getResult();

      return {
        upper: result.map(r => r.upper),
        middle: result.map(r => r.middle),
        lower: result.map(r => r.lower)
      };
    } catch (error) {
      logService.log('error', 'Failed to calculate Bollinger Bands', error, 'IndicatorService');
      throw error;
    }
  }

  async calculateATR(candles: any[], period: number = 14): Promise<number[]> {
    try {
      const input = {
        high: candles.map(c => c.high),
        low: candles.map(c => c.low),
        close: candles.map(c => c.close),
        period
      };

      const atr = new technicalIndicators.ATR(input);
      return atr.getResult();
    } catch (error) {
      logService.log('error', 'Failed to calculate ATR', error, 'IndicatorService');
      throw error;
    }
  }

  async calculateRSI(candles: any[], period: number = 14): Promise<number> {
    try {
      const input = {
        values: candles.map(c => c.close),
        period
      };

      const rsi = new technicalIndicators.RSI(input);
      const result = rsi.getResult();
      return result[result.length - 1];
    } catch (error) {
      logService.log('error', 'Failed to calculate RSI', error, 'IndicatorService');
      throw error;
    }
  }
}

export const indicatorService = IndicatorService.getInstance();