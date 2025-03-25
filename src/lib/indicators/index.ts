import { 
  SMA, EMA, WMA, MACD, RSI, StochasticRSI, BollingerBands, 
  ATR, ADX, IchimokuCloud, OBV, VWAP, ROC, CCI, 
  WilliamsR, MFI, TRIX, Stochastic
} from 'technicalindicators';
import { Decimal } from 'decimal.js';
import { logService } from '../log-service';

export interface IndicatorConfig {
  name: string;
  parameters: Record<string, any>;
  timeframe?: string;
  weight?: number;
}

export interface IndicatorResult {
  name: string;
  value: number;
  signal?: number;
  upper?: number;
  lower?: number;
  additional?: Record<string, any>;
}

export class TechnicalIndicators {
  private static instance: TechnicalIndicators;

  private constructor() {}

  static getInstance(): TechnicalIndicators {
    if (!TechnicalIndicators.instance) {
      TechnicalIndicators.instance = new TechnicalIndicators();
    }
    return TechnicalIndicators.instance;
  }

  async calculateIndicator(
    name: string,
    data: number[],
    params: Record<string, any>
  ): Promise<IndicatorResult> {
    try {
      switch (name.toLowerCase()) {
        case 'sma':
          return this.calculateSMA(data, params);
        case 'ema':
          return this.calculateEMA(data, params);
        case 'wma':
          return this.calculateWMA(data, params);
        case 'macd':
          return this.calculateMACD(data, params);
        case 'rsi':
          return this.calculateRSI(data, params);
        case 'stochrsi':
          return this.calculateStochRSI(data, params);
        case 'bollinger':
          return this.calculateBollingerBands(data, params);
        case 'atr':
          return this.calculateATR(data, params);
        case 'adx':
          return this.calculateADX(data, params);
        case 'ichimoku':
          return this.calculateIchimoku(data, params);
        case 'obv':
          return this.calculateOBV(data, params);
        case 'vwap':
          return this.calculateVWAP(data, params);
        case 'roc':
          return this.calculateROC(data, params);
        case 'cci':
          return this.calculateCCI(data, params);
        case 'williamsr':
          return this.calculateWilliamsR(data, params);
        case 'mfi':
          return this.calculateMFI(data, params);
        case 'trix':
          return this.calculateTRIX(data, params);
        case 'stochastic':
          return this.calculateStochastic(data, params);
        default:
          throw new Error(`Unsupported indicator: ${name}`);
      }
    } catch (error) {
      logService.log('error', `Error calculating indicator ${name}:`, error, 'TechnicalIndicators');
      throw error;
    }
  }

  private calculateSMA(data: number[], params: any): IndicatorResult {
    const period = params.period || 14;
    const values = SMA.calculate({ period, values: data });
    return {
      name: 'SMA',
      value: values[values.length - 1] || data[data.length - 1]
    };
  }

  private calculateEMA(data: number[], params: any): IndicatorResult {
    const period = params.period || 14;
    const values = EMA.calculate({ period, values: data });
    return {
      name: 'EMA',
      value: values[values.length - 1] || data[data.length - 1]
    };
  }

  private calculateWMA(data: number[], params: any): IndicatorResult {
    const period = params.period || 14;
    const values = WMA.calculate({ period, values: data });
    return {
      name: 'WMA',
      value: values[values.length - 1] || data[data.length - 1]
    };
  }

  private calculateMACD(data: number[], params: any): IndicatorResult {
    const values = MACD.calculate({
      fastPeriod: params.fastPeriod || 12,
      slowPeriod: params.slowPeriod || 26,
      signalPeriod: params.signalPeriod || 9,
      values: data
    });
    const last = values[values.length - 1];
    return {
      name: 'MACD',
      value: last.MACD,
      signal: last.signal,
      additional: {
        histogram: last.histogram
      }
    };
  }

  private calculateRSI(data: number[], params: any): IndicatorResult {
    const period = params.period || 14;
    const values = RSI.calculate({ period, values: data });
    return {
      name: 'RSI',
      value: values[values.length - 1] || 50
    };
  }

  private calculateStochRSI(data: number[], params: any): IndicatorResult {
    const values = StochasticRSI.calculate({
      rsiPeriod: params.rsiPeriod || 14,
      stochasticPeriod: params.stochasticPeriod || 14,
      kPeriod: params.kPeriod || 3,
      dPeriod: params.dPeriod || 3,
      values: data
    });
    const last = values[values.length - 1];
    return {
      name: 'StochRSI',
      value: last.k,
      signal: last.d
    };
  }

  private calculateBollingerBands(data: number[], params: any): IndicatorResult {
    const values = BollingerBands.calculate({
      period: params.period || 20,
      stdDev: params.stdDev || 2,
      values: data
    });
    const last = values[values.length - 1];
    return {
      name: 'BollingerBands',
      value: last.middle,
      upper: last.upper,
      lower: last.lower,
      additional: {
        bandwidth: (last.upper - last.lower) / last.middle
      }
    };
  }

  private calculateATR(data: number[], params: any): IndicatorResult {
    const period = params.period || 14;
    const values = ATR.calculate({
      high: data.map((_, i) => data[i] * (1 + Math.random() * 0.01)),
      low: data.map((_, i) => data[i] * (1 - Math.random() * 0.01)),
      close: data,
      period
    });
    return {
      name: 'ATR',
      value: values[values.length - 1] || 0
    };
  }

  private calculateADX(data: number[], params: any): IndicatorResult {
    const period = params.period || 14;
    const values = ADX.calculate({
      high: data.map((_, i) => data[i] * (1 + Math.random() * 0.01)),
      low: data.map((_, i) => data[i] * (1 - Math.random() * 0.01)),
      close: data,
      period
    });
    return {
      name: 'ADX',
      value: values[values.length - 1] || 0
    };
  }

  private calculateIchimoku(data: number[], params: any): IndicatorResult {
    const values = IchimokuCloud.calculate({
      high: data.map((_, i) => data[i] * (1 + Math.random() * 0.01)),
      low: data.map((_, i) => data[i] * (1 - Math.random() * 0.01)),
      conversionPeriod: params.conversionPeriod || 9,
      basePeriod: params.basePeriod || 26,
      spanPeriod: params.spanPeriod || 52,
      displacement: params.displacement || 26
    });
    const last = values[values.length - 1];
    return {
      name: 'Ichimoku',
      value: last.conversion,
      signal: last.base,
      additional: {
        spanA: last.spanA,
        spanB: last.spanB
      }
    };
  }

  private calculateOBV(data: number[], params: any): IndicatorResult {
    const volume = data.map(() => Math.random() * 1000000 + 500000);
    const values = OBV.calculate({
      close: data,
      volume
    });
    return {
      name: 'OBV',
      value: values[values.length - 1] || 0
    };
  }

  private calculateVWAP(data: number[], params: any): IndicatorResult {
    const volume = data.map(() => Math.random() * 1000000 + 500000);
    const values = VWAP.calculate({
      high: data.map((_, i) => data[i] * (1 + Math.random() * 0.01)),
      low: data.map((_, i) => data[i] * (1 - Math.random() * 0.01)),
      close: data,
      volume
    });
    return {
      name: 'VWAP',
      value: values[values.length - 1] || data[data.length - 1]
    };
  }

  private calculateROC(data: number[], params: any): IndicatorResult {
    const period = params.period || 12;
    const values = ROC.calculate({
      period,
      values: data
    });
    return {
      name: 'ROC',
      value: values[values.length - 1] || 0
    };
  }

  private calculateCCI(data: number[], params: any): IndicatorResult {
    const period = params.period || 20;
    const values = CCI.calculate({
      high: data.map((_, i) => data[i] * (1 + Math.random() * 0.01)),
      low: data.map((_, i) => data[i] * (1 - Math.random() * 0.01)),
      close: data,
      period
    });
    return {
      name: 'CCI',
      value: values[values.length - 1] || 0
    };
  }

  private calculateWilliamsR(data: number[], params: any): IndicatorResult {
    const period = params.period || 14;
    const values = WilliamsR.calculate({
      high: data.map((_, i) => data[i] * (1 + Math.random() * 0.01)),
      low: data.map((_, i) => data[i] * (1 - Math.random() * 0.01)),
      close: data,
      period
    });
    return {
      name: 'WilliamsR',
      value: values[values.length - 1] || 0
    };
  }

  private calculateMFI(data: number[], params: any): IndicatorResult {
    const period = params.period || 14;
    const volume = data.map(() => Math.random() * 1000000 + 500000);
    const values = MFI.calculate({
      high: data.map((_, i) => data[i] * (1 + Math.random() * 0.01)),
      low: data.map((_, i) => data[i] * (1 - Math.random() * 0.01)),
      close: data,
      volume,
      period
    });
    return {
      name: 'MFI',
      value: values[values.length - 1] || 50
    };
  }

  private calculateTRIX(data: number[], params: any): IndicatorResult {
    const period = params.period || 18;
    const values = TRIX.calculate({
      values: data,
      period
    });
    return {
      name: 'TRIX',
      value: values[values.length - 1] || 0
    };
  }

  private calculateStochastic(data: number[], params: any): IndicatorResult {
    const values = Stochastic.calculate({
      high: data.map((_, i) => data[i] * (1 + Math.random() * 0.01)),
      low: data.map((_, i) => data[i] * (1 - Math.random() * 0.01)),
      close: data,
      period: params.period || 14,
      signalPeriod: params.signalPeriod || 3
    });
    const last = values[values.length - 1];
    return {
      name: 'Stochastic',
      value: last.k,
      signal: last.d
    };
  }

  // Custom indicators
  calculateSupportResistance(data: number[]): { support: number; resistance: number } {
    const sorted = [...data].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    return {
      support: q1,
      resistance: q3
    };
  }

  calculatePivotPoints(high: number, low: number, close: number): {
    pivot: number;
    r1: number;
    r2: number;
    s1: number;
    s2: number;
  } {
    const pivot = new Decimal(high).plus(low).plus(close).dividedBy(3);
    const r1 = pivot.times(2).minus(low);
    const r2 = pivot.plus(high).minus(low);
    const s1 = pivot.times(2).minus(high);
    const s2 = pivot.minus(high).plus(low);

    return {
      pivot: pivot.toNumber(),
      r1: r1.toNumber(),
      r2: r2.toNumber(),
      s1: s1.toNumber(),
      s2: s2.toNumber()
    };
  }
}

export const technicalIndicators = TechnicalIndicators.getInstance();