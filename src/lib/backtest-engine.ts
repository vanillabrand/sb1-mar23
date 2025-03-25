import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { Decimal } from 'decimal.js';
import type { Strategy } from './supabase-types';

interface BacktestConfig {
  strategy: Strategy;
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  symbol: string;
  timeframe?: string;
}

interface BacktestResult {
  timestamp: number;
  price: number;
  position: 'long' | 'short' | null;
  equity: number;
  pnl: number;
}

interface Trade {
  date: Date;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  pnl: number;
}

class BacktestEngine extends EventEmitter {
  private static instance: BacktestEngine;
  private running: boolean = false;
  private lastProgress: number = 0;
  private readonly PROGRESS_THRESHOLD = 5; // Only emit progress updates when change is >= 5%

  private constructor() {
    super();
  }

  static getInstance(): BacktestEngine {
    if (!BacktestEngine.instance) {
      BacktestEngine.instance = new BacktestEngine();
    }
    return BacktestEngine.instance;
  }

  async runBacktest(config: BacktestConfig, data: any[]): Promise<any> {
    if (this.running) {
      throw new Error('Backtest already running');
    }

    this.running = true;
    let progress = 0;

    try {
      logService.log('info', 'Starting backtest', { config }, 'BacktestEngine');

      if (!config.strategy.strategy_config?.indicators) {
        throw new Error('Strategy indicators not configured');
      }

      if (!data || data.length < 50) {
        throw new Error('Insufficient historical data for backtesting');
      }

      const results: BacktestResult[] = [];
      const trades: Trade[] = [];
      let equity = new Decimal(config.initialBalance);
      let position: 'long' | 'short' | null = null;
      let entryPrice = new Decimal(0);
      let positionSize = new Decimal(0);
      let peakEquity = new Decimal(config.initialBalance);
      let maxDrawdown = new Decimal(0);

      // Process each candle (starting from index 50)
      for (let i = 50; i < data.length; i++) {
        if (!this.running) break;

        const candle = data[i];
        const price = new Decimal(candle.close);
        
        // Calculate indicators for candles up to the current index
        const indicatorValues = this.calculateIndicators(
          config.strategy.strategy_config.indicators,
          data.slice(0, i + 1)
        );

        // Check entry conditions if no open position exists
        if (!position) {
          if (this.checkEntryConditions(config.strategy, indicatorValues, price)) {
            // Calculate position size based on risk
            const riskMultiplier = this.getRiskMultiplier(config.strategy.risk_level);
            positionSize = equity.mul(riskMultiplier).div(100);
            
            position = 'long';
            entryPrice = price;
            
            trades.push({
              date: new Date(candle.timestamp),
              type: 'buy',
              price: price.toNumber(),
              amount: positionSize.toNumber(),
              pnl: 0
            });

            logService.log('debug', 'Opened position', {
              price: price.toNumber(),
              positionSize: positionSize.toNumber(),
              equity: equity.toNumber()
            }, 'BacktestEngine');
          }
        } else {
          // Calculate PnL percentage based on position type
          const pnlPercent = position === 'long'
            ? price.minus(entryPrice).div(entryPrice).mul(100)
            : entryPrice.minus(price).div(entryPrice).mul(100);

          const stopLoss = new Decimal(config.strategy.strategy_config.risk_management.stop_loss);
          const takeProfit = new Decimal(config.strategy.strategy_config.risk_management.take_profit);

          if (pnlPercent.lte(stopLoss.neg()) || pnlPercent.gte(takeProfit) || 
              this.checkExitConditions(config.strategy, indicatorValues, price, entryPrice)) {
            
            // Calculate realized PnL
            const pnl = position === 'long'
              ? positionSize.mul(price.minus(entryPrice).div(entryPrice))
              : positionSize.mul(entryPrice.minus(price).div(entryPrice));

            equity = equity.plus(pnl);
            
            trades.push({
              date: new Date(candle.timestamp),
              type: 'sell',
              price: price.toNumber(),
              amount: positionSize.toNumber(),
              pnl: pnl.toNumber()
            });

            logService.log('debug', 'Closed position', {
              price: price.toNumber(),
              pnl: pnl.toNumber(),
              equity: equity.toNumber()
            }, 'BacktestEngine');

            position = null;
            positionSize = new Decimal(0);
          }
        }

        // Update equity if position is open (using unrealized PnL)
        if (position) {
          const unrealizedPnl = position === 'long'
            ? positionSize.mul(price.minus(entryPrice).div(entryPrice))
            : positionSize.mul(entryPrice.minus(price).div(entryPrice));
          
          equity = new Decimal(config.initialBalance).plus(
            trades.reduce((sum, t) => sum.plus(t.pnl), new Decimal(0))
          ).plus(unrealizedPnl);
        }

        if (equity.gt(peakEquity)) {
          peakEquity = equity;
        }
        
        const currentDrawdown = peakEquity.minus(equity).div(peakEquity).mul(100);
        if (currentDrawdown.gt(maxDrawdown)) {
          maxDrawdown = currentDrawdown;
        }

        // Store current backtest result
        results.push({
          timestamp: candle.timestamp,
          price: price.toNumber(),
          position,
          equity: equity.toNumber(),
          pnl: equity.minus(config.initialBalance).toNumber()
        });

        // Update progress if change exceeds threshold
        const newProgress = Math.round((i / data.length) * 100);
        if (newProgress - this.lastProgress >= this.PROGRESS_THRESHOLD) {
          this.lastProgress = newProgress;
          this.emit('progress', {
            progress: newProgress,
            currentStep: `Processing data point ${i + 1}/${data.length}`
          });
        }

        // Emit periodic update events every 10 candles
        if (i % 10 === 0) {
          this.emit('update', {
            timestamp: candle.timestamp,
            price: price.toNumber(),
            position,
            equity: equity.toNumber(),
            pnl: equity.minus(config.initialBalance).toNumber(),
            drawdown: currentDrawdown.toNumber()
          });
        }
      }

      // Calculate performance statistics
      const totalReturn = equity.minus(config.initialBalance).div(config.initialBalance).mul(100);
      const winningTrades = trades.filter(t => t.pnl > 0);
      const winRate = trades.length ? (winningTrades.length / trades.length) * 100 : 0;
      const sharpeRatio = this.calculateSharpeRatio(results);

      // Format the equity curve for display
      const equityCurve = results.map(r => ({
        date: new Date(r.timestamp),
        value: r.equity
      }));

      logService.log('info', 'Backtest completed successfully', {
        totalReturn: totalReturn.toNumber(),
        totalTrades: trades.length,
        winRate,
        maxDrawdown: maxDrawdown.toNumber()
      }, 'BacktestEngine');

      return {
        totalReturns: totalReturn.toNumber(),
        totalTrades: trades.length,
        winRate,
        maxDrawdown: maxDrawdown.toNumber(),
        sharpeRatio,
        trades,
        equity: equityCurve
      };
    } catch (error) {
      logService.log('error', 'Backtest failed', error, 'BacktestEngine');
      throw error;
    } finally {
      this.running = false;
      this.lastProgress = 0;
    }
  }

  private getRiskMultiplier(riskLevel: string): number {
    switch (riskLevel) {
      case 'Ultra Low': return 1;
      case 'Low': return 2;
      case 'Medium': return 3;
      case 'High': return 5;
      case 'Ultra High': return 7;
      case 'Extreme': return 10;
      case 'God Mode': return 15;
      default: return 3;
    }
  }

  private calculateIndicators(indicators: any[], data: any[]): Record<string, number> {
    const values: Record<string, number> = {};
    const prices = data.map(d => parseFloat(d.close));

    try {
      indicators.forEach(indicator => {
        const name = indicator.name.toLowerCase();
        switch (name) {
          case 'rsi':
            values.rsi = this.calculateRSI(prices, indicator.parameters.period);
            break;
          case 'macd':
            const macdResult = this.calculateMACD(
              prices,
              indicator.parameters.fastPeriod,
              indicator.parameters.slowPeriod,
              indicator.parameters.signalPeriod
            );
            values.macd = macdResult.macd;
            values.signal = macdResult.signal;
            break;
          case 'sma':
            values.sma = this.calculateSMA(prices, indicator.parameters.period);
            break;
          case 'ema':
            values.ema = this.calculateEMA(prices, indicator.parameters.period);
            break;
        }
      });

      return values;
    } catch (error) {
      logService.log('error', 'Error calculating indicators', error, 'BacktestEngine');
      return values;
    }
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[prices.length - i] - prices[prices.length - i - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // Adjusted MACD calculation: Build a MACD series and compute signal as the EMA of that series.
  private calculateMACD(
    prices: number[],
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number
  ): { macd: number; signal: number } {
    if (prices.length < slowPeriod) {
      return { macd: 0, signal: 0 };
    }
    const macdSeries: number[] = [];
    for (let i = slowPeriod - 1; i < prices.length; i++) {
      const fastEMA = this.calculateEMA(prices.slice(0, i + 1), fastPeriod);
      const slowEMA = this.calculateEMA(prices.slice(0, i + 1), slowPeriod);
      macdSeries.push(fastEMA - slowEMA);
    }
    const currentMACD = macdSeries[macdSeries.length - 1];
    const signal = this.calculateEMA(macdSeries, signalPeriod);
    return { macd: currentMACD, signal };
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  private checkEntryConditions(
    strategy: Strategy,
    indicators: Record<string, number>,
    price: Decimal
  ): boolean {
    if (!strategy.strategy_config?.conditions?.entry) return false;
    
    try {
      return strategy.strategy_config.conditions.entry.every(condition => {
        const indicatorName = condition.indicator.toLowerCase();
        const value = indicators[indicatorName] ?? price.toNumber();
        const threshold = typeof condition.value === 'string' 
          ? indicators[condition.value.toLowerCase()] || 0
          : condition.value;

        return this.evaluateCondition(value, condition.operator, threshold);
      });
    } catch (error) {
      logService.log('error', 'Error checking entry conditions', error, 'BacktestEngine');
      return false;
    }
  }

  private checkExitConditions(
    strategy: Strategy,
    indicators: Record<string, number>,
    price: Decimal,
    entryPrice: Decimal
  ): boolean {
    if (!strategy.strategy_config?.conditions?.exit) return false;

    try {
      const pnl = price.minus(entryPrice).div(entryPrice).mul(100);
      
      // Check stop loss and take profit if defined in risk management
      if (strategy.strategy_config.risk_management) {
        if (pnl.lte(new Decimal(-strategy.strategy_config.risk_management.stop_loss))) return true;
        if (pnl.gte(new Decimal(strategy.strategy_config.risk_management.take_profit))) return true;
      }

      return strategy.strategy_config.conditions.exit.some(condition => {
        const indicatorName = condition.indicator.toLowerCase();
        const value = indicators[indicatorName] ?? price.toNumber();
        const threshold = typeof condition.value === 'string'
          ? indicators[condition.value.toLowerCase()] || 0
          : condition.value;

        return this.evaluateCondition(value, condition.operator, threshold);
      });
    } catch (error) {
      logService.log('error', 'Error checking exit conditions', error, 'BacktestEngine');
      return false;
    }
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case 'crosses_above': return value > threshold;
      case 'crosses_below': return value < threshold;
      default: return false;
    }
  }

  private calculateSharpeRatio(results: BacktestResult[]): number {
    try {
      const returns = results.map((r, i) => 
        i === 0 ? 0 : (r.equity - results[i - 1].equity) / results[i - 1].equity
      );
      
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const riskFreeRate = 0.02 / 252; // Assuming 2% annual risk-free rate
      
      const stdDev = Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      );
      
      return stdDev === 0 ? 0 : (avgReturn - riskFreeRate) / stdDev * Math.sqrt(252);
    } catch (error) {
      logService.log('error', 'Error calculating Sharpe ratio', error, 'BacktestEngine');
      return 0;
    }
  }

  cancelBacktest(): void {
    if (this.running) {
      this.running = false;
      this.lastProgress = 0;
      logService.log('info', 'Backtest cancelled', null, 'BacktestEngine');
    }
  }
}

export const backtestEngine = BacktestEngine.getInstance();
