import { EventEmitter } from './event-emitter';
import { bitmartService } from './bitmart-service';
import { backtestEngine } from './backtest-engine';
import { logService } from './log-service';
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

  private constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    backtestEngine.on('progress', (data) => {
      logService.log('info', 'Backtest progress update', data, 'BacktestService');
      this.emit('progress', {
        status: 'running',
        progress: data.progress,
        currentStep: data.currentStep
      });
    });

    backtestEngine.on('update', (data) => {
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
          data = await bitmartService.getKlines(
            config.symbol,
            Math.floor(config.startDate.getTime() / 1000),
            Math.floor(config.endDate.getTime() / 1000),
            config.timeframe || '1h'
          );
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
      const results = await backtestEngine.runBacktest(config, data);

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
      backtestEngine.cancelBacktest();
      this.isRunning = false;
      logService.log('info', 'Backtest cancelled by user', null, 'BacktestService');
    }
  }
}

export const backtestService = BacktestService.getInstance();
