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
    trades: Trade[] | number[]
  ): Promise<IndicatorResult> {
    try {
      // Handle both old and new parameter formats
      let processedTrades: Trade[];

      // If trades is an array of numbers, convert to Trade objects
      if (Array.isArray(trades) && trades.length > 0 && typeof trades[0] === 'number') {
        processedTrades = (trades as number[]).map((price, index) => ({
          price,
          timestamp: Date.now() - (trades.length - index) * 60000, // Fake timestamps
          id: `synthetic-${index}`,
          symbol: 'SYNTHETIC',
          side: 'buy',
          amount: 1,
          high: price,
          low: price,
          open: price,
          close: price,
          volume: 1
        }));
      } else {
        processedTrades = trades as Trade[];
      }

      // Handle both old and new config formats
      let processedConfig: IndicatorConfig;
      if (config.name && config.params) {
        // New format
        processedConfig = {
          type: config.name,
          period: config.params.period || 14,
          parameters: config.params
        };
      } else {
        // Old format
        processedConfig = config;
      }

      const cacheKey = this.getCacheKey(processedConfig, processedTrades);
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) return cachedResult;

      const result = await this.compute(processedConfig, processedTrades);
      this.cache.set(cacheKey, {
        ...result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      logService.log('error', 'Failed to calculate indicator',
        { config, error }, 'IndicatorService');

      // Return a default result instead of throwing
      return {
        name: config.name || config.type || 'UNKNOWN',
        value: 0,
        timestamp: Date.now(),
        metadata: { error: error.message }
      };
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
    try {
      // Check if we have enough data
      if (trades.length < 2) {
        return {
          name: config.name || config.type || 'UNKNOWN',
          value: 0,
          timestamp: Date.now(),
          metadata: { insufficient_data: true }
        };
      }

      // Handle EMA with specific periods (like EMA50)
      if (config.type === 'EMA' && config.name && config.name.startsWith('EMA')) {
        const periodMatch = config.name.match(/EMA(\d+)/);
        if (periodMatch && periodMatch[1]) {
          const period = parseInt(periodMatch[1], 10);
          if (!isNaN(period)) {
            return this.calculateEMA(trades, period);
          }
        }
      }

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
        case 'ADX':
          return this.calculateADX(trades, config.period || 14);
        case 'ATR':
          return this.calculateATR(trades, config.period || 14);
        case 'STOCH':
          return this.calculateStochastic(trades, config.period || 14, config.signalPeriod || 3);
        case 'CCI':
          return this.calculateCCI(trades, config.period || 20);
        case 'OBV':
          return this.calculateOBV(trades);
        case 'ICHIMOKU':
          return this.calculateIchimoku(trades);
        case 'PSAR':
          return this.calculateParabolicSAR(trades, config.acceleration || 0.02, config.maximum || 0.2);
        case 'MFI':
          return this.calculateMFI(trades, config.period || 14);
        case 'VWAP':
          return this.calculateVWAP(trades);
        case 'SUPERTREND':
          return this.calculateSuperTrend(trades, config.period || 10, config.multiplier || 3);
        case 'PIVOT':
          return this.calculatePivotPoints(trades);
        default:
          // For unknown indicator types, return a default value instead of throwing
          logService.log('warn', `Unsupported indicator type: ${config.type}`, { config }, 'IndicatorService');
          return {
            name: config.name || config.type || 'UNKNOWN',
            value: 0,
            timestamp: Date.now(),
            metadata: { unsupported_type: true }
          };
      }
    } catch (error) {
      // Catch any errors in the compute method
      logService.log('error', `Error in compute method for ${config.type}`, error, 'IndicatorService');
      return {
        name: config.name || config.type || 'UNKNOWN',
        value: 0,
        timestamp: Date.now(),
        metadata: { compute_error: true, error_message: error.message }
      };
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
    // Check if we have enough data
    if (trades.length < period) {
      return {
        name: 'EMA',
        value: 0,
        timestamp: Date.now(),
        metadata: { period, insufficient_data: true }
      };
    }

    try {
      // Extract prices, ensuring they are valid numbers
      const prices = trades.map(trade => {
        const price = typeof trade.price === 'number' ? trade.price :
                     (trade.close ? parseFloat(trade.close.toString()) :
                     (trade.price ? parseFloat(trade.price.toString()) : null));

        if (price === null || isNaN(price)) {
          throw new Error(`Invalid price data for EMA calculation: ${JSON.stringify(trade)}`);
        }

        return price;
      });

      // Calculate SMA for the first period points as the starting EMA value
      const smaStart = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

      if (isNaN(smaStart)) {
        throw new Error(`Invalid SMA start value: ${smaStart}`);
      }

      // Calculate the multiplier
      const multiplier = 2 / (period + 1);

      // Start with SMA for the first period points
      let ema = smaStart;

      // Calculate EMA for the remaining points
      for (let i = period; i < prices.length; i++) {
        ema = (prices[i] * multiplier) + (ema * (1 - multiplier));

        // Check for NaN after each calculation
        if (isNaN(ema)) {
          throw new Error(`EMA calculation resulted in NaN at index ${i}`);
        }
      }

      return {
        name: 'EMA',
        value: ema,
        timestamp: Date.now(),
        metadata: { period, smaStart }
      };
    } catch (error) {
      logService.log('error', 'Error calculating EMA', error, 'IndicatorService');

      // Return a default value if calculation fails
      return {
        name: 'EMA',
        value: 0,
        timestamp: Date.now(),
        metadata: {
          period,
          calculation_error: true,
          error_message: error.message
        }
      };
    }
  }

  private calculateRSI(trades: Trade[], period: number): IndicatorResult {
    // Check if we have enough data
    if (trades.length < period + 1) {
      return {
        name: 'RSI',
        value: 50, // Default neutral value
        timestamp: Date.now(),
        metadata: { period, insufficient_data: true }
      };
    }

    // Extract prices, ensuring they are valid numbers
    const prices = trades.map(trade => {
      const price = typeof trade.price === 'number' ? trade.price :
                   (trade.close ? parseFloat(trade.close.toString()) :
                   (trade.price ? parseFloat(trade.price.toString()) : null));

      if (price === null || isNaN(price)) {
        throw new Error(`Invalid price data for RSI calculation: ${JSON.stringify(trade)}`);
      }

      return price;
    });

    // Calculate price changes
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    // Calculate gains and losses
    let gains = 0;
    let losses = 0;
    changes.slice(-period).forEach(change => {
      if (change > 0) gains += change;
      else losses -= change;
    });

    const avgGain = gains / period;
    const avgLoss = losses / period;

    // Handle division by zero
    if (avgLoss === 0) {
      return {
        name: 'RSI',
        value: 100, // If no losses, RSI is 100
        timestamp: Date.now(),
        metadata: { period, avgGain, avgLoss: 0 }
      };
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // Ensure the result is a valid number
    if (isNaN(rsi)) {
      return {
        name: 'RSI',
        value: 50, // Default to neutral if calculation fails
        timestamp: Date.now(),
        metadata: { period, calculation_error: true, avgGain, avgLoss }
      };
    }

    return {
      name: 'RSI',
      value: rsi,
      timestamp: Date.now(),
      metadata: { period, avgGain, avgLoss, rs }
    };
  }

  private calculateMACD(trades: Trade[]): IndicatorResult {
    // Check if we have enough data for MACD calculation
    if (trades.length < 26) {
      return {
        name: 'MACD',
        value: 0,
        timestamp: Date.now(),
        metadata: {
          signal: 0,
          histogram: 0,
          insufficient_data: true
        }
      };
    }

    try {
      // Extract prices, ensuring they are valid numbers
      const prices = trades.map(trade => {
        const price = typeof trade.price === 'number' ? trade.price :
                     (trade.close ? parseFloat(trade.close.toString()) :
                     (trade.price ? parseFloat(trade.price.toString()) : null));

        if (price === null || isNaN(price)) {
          throw new Error(`Invalid price data for MACD calculation: ${JSON.stringify(trade)}`);
        }

        return price;
      });

      // Calculate EMAs
      const ema12Result = this.calculateEMA(trades, 12);
      const ema26Result = this.calculateEMA(trades, 26);

      if (isNaN(ema12Result.value) || isNaN(ema26Result.value)) {
        throw new Error(`Invalid EMA values: EMA12=${ema12Result.value}, EMA26=${ema26Result.value}`);
      }

      const ema12 = ema12Result.value;
      const ema26 = ema26Result.value;
      const macd = ema12 - ema26;

      // Create synthetic trades with MACD as price for signal line calculation
      const macdTrades = trades.map((t, i) => ({
        ...t,
        price: i >= trades.length - 9 ? macd : 0 // Only use the last 9 points for signal
      }));

      const signalResult = this.calculateEMA(macdTrades, 9);
      const signal = signalResult.value;

      if (isNaN(signal)) {
        throw new Error(`Invalid signal value: ${signal}`);
      }

      const histogram = macd - signal;

      return {
        name: 'MACD',
        value: macd,
        timestamp: Date.now(),
        metadata: {
          signal,
          histogram,
          ema12,
          ema26
        }
      };
    } catch (error) {
      logService.log('error', 'Error calculating MACD', error, 'IndicatorService');

      // Return a default value if calculation fails
      return {
        name: 'MACD',
        value: 0,
        timestamp: Date.now(),
        metadata: {
          signal: 0,
          histogram: 0,
          calculation_error: true,
          error_message: error.message
        }
      };
    }
  }

  private calculateBollingerBands(
    trades: Trade[],
    period: number
  ): IndicatorResult {
    try {
      // Check if we have enough data
      if (trades.length < period) {
        return {
          name: 'BB',
          value: 0,
          timestamp: Date.now(),
          metadata: {
            period,
            upper: 0,
            lower: 0,
            standardDeviation: 0,
            insufficient_data: true
          }
        };
      }

      // Extract prices, ensuring they are valid numbers
      const prices = trades.map(trade => {
        const price = typeof trade.price === 'number' ? trade.price :
                     (trade.close ? parseFloat(trade.close.toString()) :
                     (trade.price ? parseFloat(trade.price.toString()) : null));

        if (price === null || isNaN(price)) {
          throw new Error(`Invalid price data for Bollinger Bands calculation: ${JSON.stringify(trade)}`);
        }

        return price;
      });

      // Calculate SMA
      const smaResult = this.calculateSMA(trades, period);
      const sma = smaResult.value;

      if (isNaN(sma)) {
        throw new Error(`Invalid SMA value: ${sma}`);
      }

      // Calculate standard deviation
      const squaredDiffs = prices
        .slice(-period)
        .map(price => Math.pow(price - sma, 2));

      const standardDeviation = Math.sqrt(
        squaredDiffs.reduce((a, b) => a + b, 0) / period
      );

      if (isNaN(standardDeviation)) {
        throw new Error(`Invalid standard deviation: ${standardDeviation}`);
      }

      // Calculate upper and lower bands
      const upperBand = sma + (standardDeviation * 2);
      const lowerBand = sma - (standardDeviation * 2);

      return {
        name: 'BB',
        value: sma,
        timestamp: Date.now(),
        metadata: {
          period,
          upper: upperBand,
          lower: lowerBand,
          standardDeviation
        }
      };
    } catch (error) {
      logService.log('error', 'Error calculating Bollinger Bands', error, 'IndicatorService');

      // Return a default value if calculation fails
      return {
        name: 'BB',
        value: 0,
        timestamp: Date.now(),
        metadata: {
          period,
          upper: 0,
          lower: 0,
          standardDeviation: 0,
          calculation_error: true,
          error_message: error.message
        }
      };
    }
  }

  /**
   * Calculate Average True Range (ATR)
   * @param trades Array of trades
   * @param period Period for calculation
   * @returns ATR indicator result
   */
  private calculateATR(trades: Trade[], period: number): IndicatorResult {
    try {
      // Check if we have enough data
      if (trades.length < period + 1) {
        return {
          name: 'ATR',
          value: 0,
          timestamp: Date.now(),
          metadata: { period, insufficient_data: true }
        };
      }

      // We need high, low, close values for ATR calculation
      const trueRanges: number[] = [];

      // For the first element, we can only use high-low
      const firstTrade = trades[0];

      // Handle missing high/low values
      const firstHigh = firstTrade.high !== undefined ? firstTrade.high : firstTrade.price;
      const firstLow = firstTrade.low !== undefined ? firstTrade.low : firstTrade.price;

      if (isNaN(firstHigh) || isNaN(firstLow)) {
        throw new Error(`Invalid high/low values for first trade: high=${firstHigh}, low=${firstLow}`);
      }

      trueRanges.push(Math.abs(firstHigh - firstLow));

      // Calculate true ranges for the rest
      for (let i = 1; i < trades.length; i++) {
        const current = trades[i];
        const previous = trades[i - 1];

        // If high/low are not available, use price as both high and low
        const currentHigh = current.high !== undefined ? current.high : current.price;
        const currentLow = current.low !== undefined ? current.low : current.price;
        const previousClose = previous.price;

        // Validate the values
        if (isNaN(currentHigh) || isNaN(currentLow) || isNaN(previousClose)) {
          throw new Error(`Invalid values for ATR calculation at index ${i}: high=${currentHigh}, low=${currentLow}, prevClose=${previousClose}`);
        }

        // True Range is the greatest of:
        // 1. Current High - Current Low
        // 2. |Current High - Previous Close|
        // 3. |Current Low - Previous Close|
        const tr1 = currentHigh - currentLow;
        const tr2 = Math.abs(currentHigh - previousClose);
        const tr3 = Math.abs(currentLow - previousClose);

        const trueRange = Math.max(tr1, tr2, tr3);

        if (isNaN(trueRange)) {
          throw new Error(`Invalid true range at index ${i}: tr1=${tr1}, tr2=${tr2}, tr3=${tr3}`);
        }

        trueRanges.push(trueRange);
      }

      // Calculate ATR as the average of the last 'period' true ranges
      const lastPeriodRanges = trueRanges.slice(-period);
      const atr = lastPeriodRanges.reduce((sum, tr) => sum + tr, 0) / period;

      if (isNaN(atr)) {
        throw new Error(`Invalid ATR calculation result: ${atr}`);
      }

      return {
        name: 'ATR',
        value: atr,
        timestamp: Date.now(),
        metadata: {
          period,
          trueRanges: lastPeriodRanges
        }
      };
    } catch (error) {
      logService.log('error', 'Error calculating ATR', error, 'IndicatorService');

      // Return a default value if calculation fails
      return {
        name: 'ATR',
        value: 0,
        timestamp: Date.now(),
        metadata: {
          period,
          calculation_error: true,
          error_message: error.message
        }
      };
    }
  }

  /**
   * Calculate Average Directional Index (ADX)
   * @param trades Array of trades
   * @param period Period for calculation
   * @returns ADX indicator result
   */
  private calculateADX(trades: Trade[], period: number): IndicatorResult {
    if (trades.length < period * 2) {
      return {
        name: 'ADX',
        value: 0,
        timestamp: Date.now(),
        metadata: { period, plusDI: 0, minusDI: 0 }
      };
    }

    // Calculate True Range first (needed for DI calculations)
    const atrResult = this.calculateATR(trades, period);
    const trueRanges = atrResult.metadata.trueRanges || [];

    // Calculate +DM and -DM
    const plusDMs: number[] = [];
    const minusDMs: number[] = [];

    for (let i = 1; i < trades.length; i++) {
      const current = trades[i];
      const previous = trades[i - 1];

      // If high/low are not available, use price
      const currentHigh = current.high || current.price;
      const currentLow = current.low || current.price;
      const previousHigh = previous.high || previous.price;
      const previousLow = previous.low || previous.price;

      // +DM = Current High - Previous High (if positive, otherwise 0)
      const upMove = currentHigh - previousHigh;

      // -DM = Previous Low - Current Low (if positive, otherwise 0)
      const downMove = previousLow - currentLow;

      // If upMove > downMove and upMove > 0, +DM = upMove, else +DM = 0
      // If downMove > upMove and downMove > 0, -DM = downMove, else -DM = 0
      if (upMove > downMove && upMove > 0) {
        plusDMs.push(upMove);
        minusDMs.push(0);
      } else if (downMove > upMove && downMove > 0) {
        plusDMs.push(0);
        minusDMs.push(downMove);
      } else {
        plusDMs.push(0);
        minusDMs.push(0);
      }
    }

    // Calculate smoothed +DM, -DM, and TR
    const smoothedPlusDM = this.calculateSmoothedSum(plusDMs.slice(-period * 2), period);
    const smoothedMinusDM = this.calculateSmoothedSum(minusDMs.slice(-period * 2), period);
    const smoothedTR = this.calculateSmoothedSum(trueRanges.slice(-period * 2), period);

    // Calculate +DI and -DI
    const plusDI = (smoothedPlusDM / smoothedTR) * 100;
    const minusDI = (smoothedMinusDM / smoothedTR) * 100;

    // Calculate DX
    const dx = Math.abs((plusDI - minusDI) / (plusDI + minusDI)) * 100;

    // Calculate ADX (smoothed DX)
    // For simplicity, we'll use a simple average of DX values
    // In a real implementation, you would use a Wilder's smoothing method
    const adx = dx; // Simplified for this implementation

    return {
      name: 'ADX',
      value: adx,
      timestamp: Date.now(),
      metadata: {
        period,
        plusDI,
        minusDI,
        dx
      }
    };
  }

  /**
   * Helper method to calculate smoothed sum (Wilder's smoothing)
   * @param values Array of values
   * @param period Period for calculation
   * @returns Smoothed sum
   */
  private calculateSmoothedSum(values: number[], period: number): number {
    if (values.length < period) {
      return values.reduce((sum, value) => sum + value, 0);
    }

    // Initial sum
    let smoothedSum = values.slice(0, period).reduce((sum, value) => sum + value, 0);

    // Apply smoothing for the rest
    for (let i = period; i < values.length; i++) {
      smoothedSum = smoothedSum - (smoothedSum / period) + values[i];
    }

    return smoothedSum;
  }

  /**
   * Calculate Stochastic Oscillator
   * @param trades Array of trades
   * @param period Period for calculation (typically 14)
   * @param signalPeriod Signal period (typically 3)
   * @returns Stochastic indicator result
   */
  private calculateStochastic(trades: Trade[], period: number, signalPeriod: number): IndicatorResult {
    if (trades.length < period) {
      return {
        name: 'STOCH',
        value: 50,
        timestamp: Date.now(),
        metadata: { period, signalPeriod, k: 50, d: 50 }
      };
    }

    // Get the last 'period' candles
    const candles = trades.slice(-period * 2);

    // Calculate %K
    const kValues: number[] = [];

    for (let i = period - 1; i < candles.length; i++) {
      const periodCandles = candles.slice(i - period + 1, i + 1);

      // Find highest high and lowest low in the period
      const highs = periodCandles.map(c => c.high || c.price);
      const lows = periodCandles.map(c => c.low || c.price);

      const highestHigh = Math.max(...highs);
      const lowestLow = Math.min(...lows);

      // Current close price
      const currentClose = candles[i].price;

      // Calculate %K: (Current Close - Lowest Low) / (Highest High - Lowest Low) * 100
      const k = (highestHigh === lowestLow)
        ? 50 // Avoid division by zero
        : ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

      kValues.push(k);
    }

    // Calculate %D (signal line) as SMA of %K values
    const dValues = [];
    for (let i = signalPeriod - 1; i < kValues.length; i++) {
      const sum = kValues.slice(i - signalPeriod + 1, i + 1).reduce((a, b) => a + b, 0);
      dValues.push(sum / signalPeriod);
    }

    // Get the most recent values
    const k = kValues[kValues.length - 1];
    const d = dValues[dValues.length - 1];

    return {
      name: 'STOCH',
      value: k,
      timestamp: Date.now(),
      metadata: {
        period,
        signalPeriod,
        k,
        d,
        kValues: kValues.slice(-5),
        dValues: dValues.slice(-5)
      }
    };
  }

  /**
   * Calculate Commodity Channel Index (CCI)
   * @param trades Array of trades
   * @param period Period for calculation (typically 20)
   * @returns CCI indicator result
   */
  private calculateCCI(trades: Trade[], period: number): IndicatorResult {
    if (trades.length < period) {
      return {
        name: 'CCI',
        value: 0,
        timestamp: Date.now(),
        metadata: { period }
      };
    }

    // Get the last 'period' candles
    const candles = trades.slice(-period);

    // Calculate typical prices: (high + low + close) / 3
    const typicalPrices = candles.map(candle => {
      const high = candle.high || candle.price;
      const low = candle.low || candle.price;
      const close = candle.price;
      return (high + low + close) / 3;
    });

    // Calculate SMA of typical prices
    const sma = typicalPrices.reduce((sum, tp) => sum + tp, 0) / period;

    // Calculate mean deviation
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;

    // Calculate CCI: (Typical Price - SMA) / (0.015 * Mean Deviation)
    const currentTypicalPrice = typicalPrices[typicalPrices.length - 1];
    const cci = meanDeviation === 0
      ? 0 // Avoid division by zero
      : (currentTypicalPrice - sma) / (0.015 * meanDeviation);

    return {
      name: 'CCI',
      value: cci,
      timestamp: Date.now(),
      metadata: {
        period,
        sma,
        meanDeviation,
        typicalPrice: currentTypicalPrice
      }
    };
  }

  /**
   * Calculate On-Balance Volume (OBV)
   * @param trades Array of trades
   * @returns OBV indicator result
   */
  private calculateOBV(trades: Trade[]): IndicatorResult {
    if (trades.length < 2) {
      return {
        name: 'OBV',
        value: 0,
        timestamp: Date.now(),
        metadata: {}
      };
    }

    let obv = 0;
    const obvValues: number[] = [0]; // Start with 0

    // Calculate OBV
    for (let i = 1; i < trades.length; i++) {
      const currentPrice = trades[i].price;
      const previousPrice = trades[i - 1].price;
      const volume = trades[i].volume || 1; // Default to 1 if volume is not available

      if (currentPrice > previousPrice) {
        // Price up, add volume
        obv += volume;
      } else if (currentPrice < previousPrice) {
        // Price down, subtract volume
        obv -= volume;
      }
      // If price is unchanged, OBV remains the same

      obvValues.push(obv);
    }

    return {
      name: 'OBV',
      value: obv,
      timestamp: Date.now(),
      metadata: {
        obvValues: obvValues.slice(-10) // Last 10 OBV values
      }
    };
  }

  /**
   * Calculate Ichimoku Cloud
   * @param trades Array of trades
   * @returns Ichimoku indicator result
   */
  private calculateIchimoku(trades: Trade[]): IndicatorResult {
    // Default periods for Ichimoku
    const tenkanPeriod = 9;
    const kijunPeriod = 26;
    const senkouBPeriod = 52;
    const displacement = 26;

    if (trades.length < senkouBPeriod + displacement) {
      return {
        name: 'ICHIMOKU',
        value: 0,
        timestamp: Date.now(),
        metadata: {
          tenkanSen: 0,
          kijunSen: 0,
          senkouSpanA: 0,
          senkouSpanB: 0,
          chikouSpan: 0
        }
      };
    }

    // Helper function to calculate midpoint of highest high and lowest low
    const calculateMidpoint = (candles: Trade[], period: number): number => {
      const highs = candles.map(c => c.high || c.price);
      const lows = candles.map(c => c.low || c.price);

      const highestHigh = Math.max(...highs);
      const lowestLow = Math.min(...lows);

      return (highestHigh + lowestLow) / 2;
    };

    // Calculate Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
    const tenkanSen = calculateMidpoint(trades.slice(-tenkanPeriod), tenkanPeriod);

    // Calculate Kijun-sen (Base Line): (26-period high + 26-period low) / 2
    const kijunSen = calculateMidpoint(trades.slice(-kijunPeriod), kijunPeriod);

    // Calculate Senkou Span A (Leading Span A): (Tenkan-sen + Kijun-sen) / 2
    const senkouSpanA = (tenkanSen + kijunSen) / 2;

    // Calculate Senkou Span B (Leading Span B): (52-period high + 52-period low) / 2
    const senkouSpanB = calculateMidpoint(trades.slice(-senkouBPeriod), senkouBPeriod);

    // Calculate Chikou Span (Lagging Span): Current closing price plotted 26 periods behind
    const chikouSpan = trades[trades.length - 1].price;

    return {
      name: 'ICHIMOKU',
      value: senkouSpanA, // Use Senkou Span A as the main value
      timestamp: Date.now(),
      metadata: {
        tenkanSen,
        kijunSen,
        senkouSpanA,
        senkouSpanB,
        chikouSpan,
        currentPrice: trades[trades.length - 1].price,
        cloud: senkouSpanA > senkouSpanB ? 'bullish' : 'bearish'
      }
    };
  }

  /**
   * Calculate Parabolic SAR
   * @param trades Array of trades
   * @param acceleration Initial acceleration factor (typically 0.02)
   * @param maximum Maximum acceleration factor (typically 0.2)
   * @returns Parabolic SAR indicator result
   */
  private calculateParabolicSAR(trades: Trade[], acceleration: number, maximum: number): IndicatorResult {
    if (trades.length < 3) {
      return {
        name: 'PSAR',
        value: trades[trades.length - 1]?.price || 0,
        timestamp: Date.now(),
        metadata: { trend: 'neutral' }
      };
    }

    // Initialize variables
    let isUptrend = true; // Start with uptrend assumption
    let sar = trades[0].low || trades[0].price; // Start with first low
    let extremePoint = trades[0].high || trades[0].price; // Start with first high
    let af = acceleration; // Acceleration factor

    const sarValues: number[] = [sar];
    const trends: string[] = ['up'];

    // Calculate PSAR for each period
    for (let i = 1; i < trades.length; i++) {
      const high = trades[i].high || trades[i].price;
      const low = trades[i].low || trades[i].price;
      const prevHigh = trades[i - 1].high || trades[i - 1].price;
      const prevLow = trades[i - 1].low || trades[i - 1].price;

      // Calculate SAR for current period
      sar = sar + af * (extremePoint - sar);

      // Ensure SAR doesn't go beyond the previous two periods' highs/lows
      if (isUptrend) {
        sar = Math.min(sar, prevLow, trades[Math.max(0, i - 2)].low || trades[Math.max(0, i - 2)].price);
      } else {
        sar = Math.max(sar, prevHigh, trades[Math.max(0, i - 2)].high || trades[Math.max(0, i - 2)].price);
      }

      // Check for trend reversal
      if ((isUptrend && low < sar) || (!isUptrend && high > sar)) {
        // Trend reversal
        isUptrend = !isUptrend;
        sar = isUptrend ? Math.min(low, prevLow) : Math.max(high, prevHigh);
        extremePoint = isUptrend ? high : low;
        af = acceleration;
      } else {
        // No reversal, check for new extreme point
        if (isUptrend && high > extremePoint) {
          extremePoint = high;
          af = Math.min(af + acceleration, maximum);
        } else if (!isUptrend && low < extremePoint) {
          extremePoint = low;
          af = Math.min(af + acceleration, maximum);
        }
      }

      sarValues.push(sar);
      trends.push(isUptrend ? 'up' : 'down');
    }

    return {
      name: 'PSAR',
      value: sar,
      timestamp: Date.now(),
      metadata: {
        trend: isUptrend ? 'up' : 'down',
        sarValues: sarValues.slice(-5),
        trends: trends.slice(-5),
        currentPrice: trades[trades.length - 1].price
      }
    };
  }

  /**
   * Calculate Money Flow Index (MFI)
   * @param trades Array of trades
   * @param period Period for calculation (typically 14)
   * @returns MFI indicator result
   */
  private calculateMFI(trades: Trade[], period: number): IndicatorResult {
    if (trades.length < period + 1) {
      return {
        name: 'MFI',
        value: 50,
        timestamp: Date.now(),
        metadata: { period }
      };
    }

    // Calculate typical price and money flow for each period
    const typicalPrices: number[] = [];
    const moneyFlows: number[] = [];

    for (let i = 0; i < trades.length; i++) {
      const high = trades[i].high || trades[i].price;
      const low = trades[i].low || trades[i].price;
      const close = trades[i].price;
      const volume = trades[i].volume || 1; // Default to 1 if volume is not available

      // Typical price: (High + Low + Close) / 3
      const typicalPrice = (high + low + close) / 3;
      typicalPrices.push(typicalPrice);

      // Money flow: Typical Price * Volume
      moneyFlows.push(typicalPrice * volume);
    }

    // Calculate positive and negative money flows
    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let i = 1; i <= period; i++) {
      const currentIndex = typicalPrices.length - i;
      const previousIndex = currentIndex - 1;

      if (typicalPrices[currentIndex] > typicalPrices[previousIndex]) {
        positiveFlow += moneyFlows[currentIndex];
      } else if (typicalPrices[currentIndex] < typicalPrices[previousIndex]) {
        negativeFlow += moneyFlows[currentIndex];
      }
      // If prices are equal, ignore the money flow
    }

    // Calculate money flow ratio and MFI
    const moneyFlowRatio = negativeFlow === 0
      ? 100 // Avoid division by zero
      : positiveFlow / negativeFlow;

    const mfi = 100 - (100 / (1 + moneyFlowRatio));

    return {
      name: 'MFI',
      value: mfi,
      timestamp: Date.now(),
      metadata: {
        period,
        positiveFlow,
        negativeFlow,
        moneyFlowRatio
      }
    };
  }

  /**
   * Calculate Volume Weighted Average Price (VWAP)
   * @param trades Array of trades
   * @returns VWAP indicator result
   */
  private calculateVWAP(trades: Trade[]): IndicatorResult {
    if (trades.length === 0) {
      return {
        name: 'VWAP',
        value: 0,
        timestamp: Date.now(),
        metadata: {}
      };
    }

    let cumulativeTPV = 0; // Cumulative (Typical Price * Volume)
    let cumulativeVolume = 0; // Cumulative Volume

    for (const trade of trades) {
      const high = trade.high || trade.price;
      const low = trade.low || trade.price;
      const close = trade.price;
      const volume = trade.volume || 1; // Default to 1 if volume is not available

      // Typical price: (High + Low + Close) / 3
      const typicalPrice = (high + low + close) / 3;

      cumulativeTPV += typicalPrice * volume;
      cumulativeVolume += volume;
    }

    // Calculate VWAP
    const vwap = cumulativeVolume === 0
      ? trades[trades.length - 1].price // Fallback to last price if no volume
      : cumulativeTPV / cumulativeVolume;

    return {
      name: 'VWAP',
      value: vwap,
      timestamp: Date.now(),
      metadata: {
        cumulativeTPV,
        cumulativeVolume,
        currentPrice: trades[trades.length - 1].price
      }
    };
  }

  /**
   * Calculate SuperTrend indicator
   * @param trades Array of trades
   * @param period ATR period (typically 10)
   * @param multiplier ATR multiplier (typically 3)
   * @returns SuperTrend indicator result
   */
  private calculateSuperTrend(trades: Trade[], period: number, multiplier: number): IndicatorResult {
    if (trades.length < period + 1) {
      return {
        name: 'SUPERTREND',
        value: trades[trades.length - 1]?.price || 0,
        timestamp: Date.now(),
        metadata: { trend: 'neutral', period, multiplier }
      };
    }

    // Calculate ATR
    const atrResult = this.calculateATR(trades, period);
    const atr = atrResult.value;

    // Initialize SuperTrend calculation
    const superTrends: number[] = [];
    const trends: string[] = [];
    let isUptrend = true;

    // Calculate basic bands
    for (let i = period; i < trades.length; i++) {
      const high = trades[i].high || trades[i].price;
      const low = trades[i].low || trades[i].price;
      const close = trades[i].price;

      // Basic upper and lower bands
      const basicUpperBand = ((high + low) / 2) + (multiplier * atr);
      const basicLowerBand = ((high + low) / 2) - (multiplier * atr);

      // Final upper and lower bands (considering previous values)
      let finalUpperBand = basicUpperBand;
      let finalLowerBand = basicLowerBand;

      if (i > period) {
        const prevUpperBand = superTrends[superTrends.length - 2];
        const prevLowerBand = superTrends[superTrends.length - 1];
        const prevClose = trades[i - 1].price;

        finalUpperBand = (basicUpperBand < prevUpperBand || prevClose > prevUpperBand)
          ? basicUpperBand
          : prevUpperBand;

        finalLowerBand = (basicLowerBand > prevLowerBand || prevClose < prevLowerBand)
          ? basicLowerBand
          : prevLowerBand;
      }

      // Determine trend
      if (close > finalUpperBand) {
        isUptrend = false;
      } else if (close < finalLowerBand) {
        isUptrend = true;
      }

      // SuperTrend value
      const superTrend = isUptrend ? finalUpperBand : finalLowerBand;

      superTrends.push(superTrend);
      trends.push(isUptrend ? 'up' : 'down');
    }

    return {
      name: 'SUPERTREND',
      value: superTrends[superTrends.length - 1],
      timestamp: Date.now(),
      metadata: {
        trend: trends[trends.length - 1],
        period,
        multiplier,
        atr,
        currentPrice: trades[trades.length - 1].price,
        superTrends: superTrends.slice(-5),
        trends: trends.slice(-5)
      }
    };
  }

  /**
   * Calculate Pivot Points
   * @param trades Array of trades
   * @returns Pivot Points indicator result
   */
  private calculatePivotPoints(trades: Trade[]): IndicatorResult {
    if (trades.length < 1) {
      return {
        name: 'PIVOT',
        value: 0,
        timestamp: Date.now(),
        metadata: {
          pivot: 0,
          r1: 0,
          r2: 0,
          r3: 0,
          s1: 0,
          s2: 0,
          s3: 0
        }
      };
    }

    // Get high, low, close from the last period (typically a day)
    const high = trades.reduce((max, trade) => Math.max(max, trade.high || trade.price), -Infinity);
    const low = trades.reduce((min, trade) => Math.min(min, trade.low || trade.price), Infinity);
    const close = trades[trades.length - 1].price;

    // Calculate pivot point (standard method)
    const pivot = (high + low + close) / 3;

    // Calculate support and resistance levels
    const r1 = (2 * pivot) - low;
    const s1 = (2 * pivot) - high;

    const r2 = pivot + (high - low);
    const s2 = pivot - (high - low);

    const r3 = high + 2 * (pivot - low);
    const s3 = low - 2 * (high - pivot);

    return {
      name: 'PIVOT',
      value: pivot,
      timestamp: Date.now(),
      metadata: {
        pivot,
        r1,
        r2,
        r3,
        s1,
        s2,
        s3,
        high,
        low,
        close
      }
    };
  }

  clearCache(): void {
    this.cache.clear();
    logService.log('info', 'Indicator cache cleared', null, 'IndicatorService');
  }
}

export const indicatorService = IndicatorService.getInstance();
