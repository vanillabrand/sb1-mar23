import { EventEmitter } from './event-emitter';
import { BacktestEngine } from './backtest-engine';
import { logService } from './log-service';
import { exchangeService } from './exchange-service';
import { demoService } from './demo-service';
import type { Strategy } from './supabase-types';

export interface BacktestConfig {
  strategy: Strategy;
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  symbol: string;
  timeframe?: string;
  dataSource?: 'synthetic' | 'exchange' | 'file';
  scenario?: 'bull' | 'bear' | 'sideways' | 'volatile';
  data?: any[];
}

export interface BacktestProgress {
  status: 'running' | 'completed' | 'error';
  progress: number;
  currentStep: string;
  results?: BacktestResults;
  error?: string;
}

export interface BacktestResults {
  totalReturns: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
  equity: { date: Date; value: number }[];
}

export interface BacktestTrade {
  date: Date;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  pnl: number;
}

class BacktestService extends EventEmitter {
  private static instance: BacktestService;
  private isRunning = false;
  private engine: BacktestEngine;

  private constructor() {
    super();
    this.engine = new BacktestEngine();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.engine.on('progress', (data) => {
      logService.log('info', 'Backtest progress update', data, 'BacktestService');
      this.emit('progress', {
        status: 'running',
        progress: data.progress,
        currentStep: data.currentStep
      });
    });

    this.engine.on('update', (data) => {
      this.emit('update', data);
    });
  }

  static getInstance(): BacktestService {
    if (!BacktestService.instance) {
      BacktestService.instance = new BacktestService();
    }
    return BacktestService.instance;
  }

  // Generate synthetic data if needed based on scenario
  /**
   * Converts a timeframe string to milliseconds
   * @param timeframe Timeframe string (e.g., '1m', '5m', '1h', '1d')
   * @returns Milliseconds equivalent of the timeframe
   */
  private timeframeToMs(timeframe: string): number {
    const unit = timeframe.slice(-1);
    const value = parseInt(timeframe.slice(0, -1));

    switch (unit) {
      case 'm': return value * 60 * 1000; // minutes
      case 'h': return value * 60 * 60 * 1000; // hours
      case 'd': return value * 24 * 60 * 60 * 1000; // days
      case 'w': return value * 7 * 24 * 60 * 60 * 1000; // weeks
      default: return 60 * 60 * 1000; // default to 1h
    }
  }

  private async generateSyntheticData(
    startDate: Date,
    endDate: Date,
    scenario: string = 'sideways'
  ): Promise<any[]> {
    try {
      logService.log('info', 'Generating synthetic data', { startDate, endDate, scenario }, 'BacktestService');

      const data = [];
      let currentDate = startDate.getTime();
      const endTime = endDate.getTime();
      let price = 100; // Starting price
      let trend = 0; // Track overall trend

      // Determine trend bias and volatility multiplier based on scenario
      const trendBias = scenario === 'bull' ? 0.2 :
                        scenario === 'bear' ? -0.2 :
                        scenario === 'volatile' ? 0 : 0;
      const volatilityMultiplier = scenario === 'volatile' ? 2 : 1;

      while (currentDate <= endTime) {
        // Update trend with mean reversion effect
        trend = trend * 0.95 + (Math.random() - 0.5 + trendBias) * 0.1;

        // Calculate price movement influenced by trend and volatility
        const volatility = (Math.random() * 2 - 1) * volatilityMultiplier;
        const movement = (trend + volatility) * (scenario === 'volatile' ? 2 : 1);
        price = Math.max(price * (1 + movement / 100), 0.01);

        // Generate realistic OHLC data
        const open = price;
        const high = price * (1 + Math.random() * 0.01);
        const low = price * (1 - Math.random() * 0.01);
        const close = price * (1 + (Math.random() - 0.5) * 0.005);

        // Generate volume with potential spikes during significant movements
        const baseVolume = Math.random() * 1000000 + 500000;
        const volumeMultiplier = Math.abs(movement) > 1 ? 2 : 1;
        const volume = baseVolume * volumeMultiplier;

        data.push({
          timestamp: currentDate,
          open,
          high,
          low,
          close,
          volume
        });

        currentDate += 3600000; // Increment by 1 hour
      }

      logService.log('info', `Generated ${data.length} synthetic data points`, null, 'BacktestService');
      return data;
    } catch (error) {
      logService.log('error', 'Error generating synthetic data', error, 'BacktestService');
      throw new Error('Failed to generate synthetic data');
    }
  }

  async runBacktest(config: BacktestConfig): Promise<void> {
    if (this.isRunning) {
      throw new Error('Backtest already running');
    }
    this.isRunning = true;
    logService.log('info', 'Starting backtest', { config }, 'BacktestService');

    try {
      // Validate strategy configuration
      if (!config.strategy.strategy_config) {
        throw new Error('Strategy configuration is missing');
      }

      // Use local variables for data source and scenario defaults
      const dataSource = config.dataSource ?? 'synthetic';
      const scenario = config.scenario ?? 'sideways';

      let data;
      // Retrieve historical data based on the specified source
      switch (dataSource) {
        case 'synthetic':
          data = await this.generateSyntheticData(config.startDate, config.endDate, scenario);
          break;
        case 'exchange':
          try {
            // Get historical data from the appropriate exchange
            // If in demo mode, use the demo exchange (Binance TestNet)
            // Otherwise, use the user's configured exchange
            const isDemo = demoService.isInDemoMode();
            logService.log('info', `Fetching historical data in ${isDemo ? 'demo' : 'real'} mode`, {
              symbol: config.symbol,
              timeframe: config.timeframe || '1h',
              startDate: config.startDate,
              endDate: config.endDate
            }, 'BacktestService');

            // Calculate the number of candles needed based on the date range and timeframe
            const timeframeInMs = this.timeframeToMs(config.timeframe || '1h');
            const dateRangeMs = config.endDate.getTime() - config.startDate.getTime();
            const limit = Math.ceil(dateRangeMs / timeframeInMs) + 10; // Add some buffer

            // Get candles from the exchange service
            const candles = await exchangeService.getCandles(
              config.symbol,
              config.timeframe || '1h',
              limit,
              config.startDate.getTime()
            );

            // Format the candles for the backtest engine
            data = candles.map(candle => ({
              datetime: new Date(candle[0]),
              open: candle[1],
              high: candle[2],
              low: candle[3],
              close: candle[4],
              volume: candle[5]
            }));

            // Filter candles to ensure they're within the date range
            data = data.filter(candle =>
              candle.datetime >= config.startDate &&
              candle.datetime <= config.endDate
            );

            logService.log('info', `Fetched ${data.length} candles for backtesting`, {
              symbol: config.symbol,
              timeframe: config.timeframe || '1h'
            }, 'BacktestService');
          } catch (error) {
            logService.log('error', 'Failed to fetch historical data from exchange', error, 'BacktestService');
            throw new Error(`Failed to fetch historical data: ${error.message}`);
          }
          break;
        case 'file':
          if (!config.data || !Array.isArray(config.data)) {
            throw new Error('No valid data provided for file data source');
          }
          data = config.data;
          break;
        default:
          throw new Error('Invalid data source configuration');
      }

      if (!data || data.length === 0) {
        throw new Error('No historical data available for the selected period');
      }

      logService.log('info', `Running backtest with ${data.length} data points`, {
        startDate: config.startDate,
        endDate: config.endDate,
        initialBalance: config.initialBalance,
        dataPoints: data.length
      }, 'BacktestService');

      // Run the backtest using the backtest engine
      const results = await this.engine.runBacktest(config, data);

      // Format the results for consumption
      const formattedResults: BacktestResults = {
        totalReturns: results.totalReturns,
        totalTrades: results.totalTrades,
        winRate: results.winRate,
        maxDrawdown: results.maxDrawdown,
        sharpeRatio: results.sharpeRatio,
        trades: results.trades.map(trade => ({
          ...trade,
          date: new Date(trade.date)
        })),
        equity: results.equity.map(point => ({
          date: new Date(point.date),
          value: point.value
        }))
      };

      // Emit completion progress with the results
      this.emit('progress', {
        status: 'completed',
        progress: 100,
        currentStep: 'Complete',
        results: formattedResults
      });

      logService.log('info', 'Backtest completed successfully', { results: formattedResults }, 'BacktestService');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backtest failed';
      logService.log('error', 'Backtest failed', error, 'BacktestService');
      this.emit('progress', {
        status: 'error',
        progress: 0,
        currentStep: 'Error',
        error: message
      });
    } finally {
      this.isRunning = false;
    }
  }

  cancelBacktest(): void {
    if (this.isRunning) {
      this.engine.cancelBacktest();
      this.isRunning = false;
      logService.log('info', 'Backtest cancelled by user', null, 'BacktestService');
    }
  }
}

export const backtestService = BacktestService.getInstance();
