import { logService } from './log-service';

class TechnicalIndicators {
  async calculateRSI(prices: number[], period: number = 14): Promise<number> {
    try {
      if (prices.length < period + 1) {
        throw new Error('Not enough data points for RSI calculation');
      }

      let gains = 0;
      let losses = 0;

      // Calculate initial average gain and loss
      for (let i = 1; i <= period; i++) {
        const difference = prices[i] - prices[i - 1];
        if (difference >= 0) {
          gains += difference;
        } else {
          losses -= difference;
        }
      }

      let avgGain = gains / period;
      let avgLoss = losses / period;

      // Calculate subsequent values using smoothing
      for (let i = period + 1; i < prices.length; i++) {
        const difference = prices[i] - prices[i - 1];
        if (difference >= 0) {
          avgGain = (avgGain * (period - 1) + difference) / period;
          avgLoss = (avgLoss * (period - 1)) / period;
        } else {
          avgGain = (avgGain * (period - 1)) / period;
          avgLoss = (avgLoss * (period - 1) - difference) / period;
        }
      }

      if (avgLoss === 0) {
        return 100;
      }

      const RS = avgGain / avgLoss;
      return 100 - (100 / (1 + RS));
    } catch (error) {
      logService.log('error', 'Failed to calculate RSI', error, 'TechnicalIndicators');
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
      const fastEMA = this.calculateEMA(prices, fastPeriod);
      const slowEMA = this.calculateEMA(prices, slowPeriod);
      const macdLine = fastEMA - slowEMA;
      const signalLine = this.calculateEMA([macdLine], signalPeriod);
      
      return {
        macd: macdLine,
        signal: signalLine,
        histogram: macdLine - signalLine
      };
    } catch (error) {
      logService.log('error', 'Failed to calculate MACD', error, 'TechnicalIndicators');
      throw error;
    }
  }

  private calculateEMA(prices: number[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }
}

export const technicalIndicators = new TechnicalIndicators();