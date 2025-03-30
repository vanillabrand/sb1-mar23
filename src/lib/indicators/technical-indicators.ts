import { 
  SMA, EMA, WMA, MACD, RSI, StochasticRSI, BollingerBands,
  ATR, ADX, IchimokuCloud, OBV, VWAP, ROC, CCI
} from 'technicalindicators';
import { logService } from '../services';

export class TechnicalIndicators {
  async calculateRSI(prices: number[], period: number = 14): Promise<number> {
    try {
      const rsi = new RSI({ period, values: prices });
      const result = rsi.getResult();
      return result[result.length - 1];
    } catch (error) {
      logService.error('Failed to calculate RSI', { error });
      throw error;
    }
  }

  async calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): Promise<{ macd: number; signal: number; histogram: number }> {
    try {
      const macd = new MACD({
        values: prices,
        fastPeriod,
        slowPeriod,
        signalPeriod,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      });
      const result = macd.getResult();
      const latest = result[result.length - 1];
      return {
        macd: latest.MACD,
        signal: latest.signal,
        histogram: latest.histogram
      };
    } catch (error) {
      logService.error('Failed to calculate MACD', { error });
      throw error;
    }
  }

  async calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
  ): Promise<{ upper: number; middle: number; lower: number }> {
    try {
      const bb = new BollingerBands({
        period,
        values: prices,
        stdDev
      });
      const result = bb.getResult();
      const latest = result[result.length - 1];
      return {
        upper: latest.upper,
        middle: latest.middle,
        lower: latest.lower
      };
    } catch (error) {
      logService.error('Failed to calculate Bollinger Bands', { error });
      throw error;
    }
  }

  private calculateEMA(prices: number[], period: number): number {
    try {
      const ema = new EMA({ period, values: prices });
      const result = ema.getResult();
      return result[result.length - 1];
    } catch (error) {
      logService.error('Failed to calculate EMA', { error });
      throw error;
    }
  }
}