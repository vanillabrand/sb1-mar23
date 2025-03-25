import { Decimal } from 'decimal.js';
import { technicalIndicators } from './index';
import { logService } from '../log-service';
import type { IndicatorConfig, IndicatorResult } from './index';

export class IndicatorProcessor {
  private static instance: IndicatorProcessor;

  private constructor() {}

  static getInstance(): IndicatorProcessor {
    if (!IndicatorProcessor.instance) {
      IndicatorProcessor.instance = new IndicatorProcessor();
    }
    return IndicatorProcessor.instance;
  }

  async processIndicators(
    data: number[],
    indicators: IndicatorConfig[]
  ): Promise<IndicatorResult[]> {
    try {
      const results = await Promise.all(
        indicators.map(async (indicator) => {
          try {
            return await technicalIndicators.calculateIndicator(
              indicator.name,
              data,
              indicator.parameters
            );
          } catch (error) {
            logService.log('error', `Error processing indicator ${indicator.name}:`, error, 'IndicatorProcessor');
            return null;
          }
        })
      );

      return results.filter((result): result is IndicatorResult => result !== null);
    } catch (error) {
      logService.log('error', 'Error processing indicators:', error, 'IndicatorProcessor');
      throw error;
    }
  }

  normalizeIndicatorValue(value: number, min: number, max: number): number {
    return new Decimal(value)
      .minus(min)
      .dividedBy(new Decimal(max).minus(min))
      .times(100)
      .toNumber();
  }

  calculateSignalStrength(results: IndicatorResult[]): number {
    if (results.length === 0) return 50;

    const weights = {
      trend: 0.4,
      momentum: 0.3,
      volatility: 0.2,
      volume: 0.1
    };

    let trendSignal = 0;
    let momentumSignal = 0;
    let volatilitySignal = 0;
    let volumeSignal = 0;

    results.forEach(result => {
      switch (result.name.toLowerCase()) {
        // Trend indicators
        case 'sma':
        case 'ema':
        case 'adx':
        case 'ichimoku':
          trendSignal += this.normalizeIndicatorValue(result.value, 0, 100);
          break;

        // Momentum indicators
        case 'rsi':
        case 'macd':
        case 'roc':
        case 'cci':
          momentumSignal += this.normalizeIndicatorValue(result.value, -100, 100);
          break;

        // Volatility indicators
        case 'bollinger':
        case 'atr':
          volatilitySignal += this.normalizeIndicatorValue(result.value, 0, 100);
          break;

        // Volume indicators
        case 'obv':
        case 'mfi':
          volumeSignal += this.normalizeIndicatorValue(result.value, 0, 100);
          break;
      }
    });

    // Calculate weighted average
    const signalStrength = 
      (trendSignal * weights.trend) +
      (momentumSignal * weights.momentum) +
      (volatilitySignal * weights.volatility) +
      (volumeSignal * weights.volume);

    return Math.max(0, Math.min(100, signalStrength));
  }

  generateTradeSignal(results: IndicatorResult[]): {
    signal: 'buy' | 'sell' | 'hold';
    confidence: number;
    reason: string;
  } {
    const signalStrength = this.calculateSignalStrength(results);
    const signals = {
      bullish: 0,
      bearish: 0,
      neutral: 0
    };

    let reasons: string[] = [];

    results.forEach(result => {
      switch (result.name.toLowerCase()) {
        case 'rsi':
          if (result.value < 30) {
            signals.bullish++;
            reasons.push('RSI oversold');
          } else if (result.value > 70) {
            signals.bearish++;
            reasons.push('RSI overbought');
          } else {
            signals.neutral++;
          }
          break;

        case 'macd':
          if (result.value > result.signal!) {
            signals.bullish++;
            reasons.push('MACD bullish crossover');
          } else if (result.value < result.signal!) {
            signals.bearish++;
            reasons.push('MACD bearish crossover');
          }
          break;

        case 'bollinger':
          if (result.value < result.lower!) {
            signals.bullish++;
            reasons.push('Price below lower Bollinger Band');
          } else if (result.value > result.upper!) {
            signals.bearish++;
            reasons.push('Price above upper Bollinger Band');
          }
          break;
      }
    });

    const totalSignals = signals.bullish + signals.bearish + signals.neutral;
    const confidence = signalStrength / 100;

    if (signals.bullish > signals.bearish && signals.bullish / totalSignals > 0.5) {
      return {
        signal: 'buy',
        confidence,
        reason: reasons.join(', ')
      };
    } else if (signals.bearish > signals.bullish && signals.bearish / totalSignals > 0.5) {
      return {
        signal: 'sell',
        confidence,
        reason: reasons.join(', ')
      };
    }

    return {
      signal: 'hold',
      confidence: 0,
      reason: 'No clear signal'
    };
  }
}

export const indicatorProcessor = IndicatorProcessor.getInstance();