import { EventEmitter } from './event-emitter';
import { supabase } from './supabase';
import { marketService } from './market-service';
import { tradeManager } from './trade-manager';
import { tradeGenerator } from './trade-generator';
import { logService } from './log-service';
import type { Strategy } from './supabase-types';

class StrategyMonitor extends EventEmitter {
  private static instance: StrategyMonitor;
  private activeStrategies = new Map<string, Strategy>();
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 5000; // 5 seconds
  private initialized = false;

  private constructor() {
    super();
    this.setupRealtimeSubscription();
  }

  static getInstance(): StrategyMonitor {
    if (!StrategyMonitor.instance) {
      StrategyMonitor.instance = new StrategyMonitor();
    }
    return StrategyMonitor.instance;
  }

  private setupRealtimeSubscription() {
    supabase
      .channel('strategy_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'strategies' },
        this.handleStrategyChange.bind(this)
      )
      .subscribe();
  }

  private async handleStrategyChange(payload: any) {
    try {
      const strategy = payload.new as Strategy;
      const oldStrategy = payload.old as Strategy;

      if (!strategy || !strategy.id) return;

      // Handle status changes
      if (oldStrategy?.status !== strategy.status) {
        if (strategy.status === 'active') {
          await this.handleStrategyActivation(strategy);
        } else if (strategy.status === 'inactive') {
          await this.handleStrategyDeactivation(strategy);
        }
      }

      // Update active strategies map
      if (strategy.status === 'active') {
        this.activeStrategies.set(strategy.id, strategy);
      } else {
        this.activeStrategies.delete(strategy.id);
      }

      this.emit('strategyUpdate', strategy);
    } catch (error) {
      logService.log('error', 'Error handling strategy change', error, 'StrategyMonitor');
    }
  }

  private async handleStrategyActivation(strategy: Strategy) {
    try {
      logService.log('info', `Strategy ${strategy.id} activated`, strategy, 'StrategyMonitor');
      
      // Add to active strategies
      this.activeStrategies.set(strategy.id, strategy);

      // Start market monitoring
      await marketService.startStrategyMonitoring(strategy);

      // Generate initial trades if none exist
      const existingTrades = tradeManager.getActiveTradesForStrategy(strategy.id);
      if (existingTrades.length === 0) {
        await this.generateTradesForStrategy(strategy);
      }
    } catch (error) {
      logService.log('error', `Error activating strategy ${strategy.id}`, error, 'StrategyMonitor');
      throw error;
    }
  }

  private async handleStrategyDeactivation(strategy: Strategy) {
    try {
      logService.log('info', `Strategy ${strategy.id} deactivated`, strategy, 'StrategyMonitor');
      
      // Remove from active strategies
      this.activeStrategies.delete(strategy.id);

      // Close all open trades
      const trades = tradeManager.getActiveTradesForStrategy(strategy.id);
      for (const trade of trades) {
        await tradeManager.closeTrade(trade.id);
      }

      // Stop market monitoring
      await marketService.stopStrategyMonitoring(strategy.id);
    } catch (error) {
      logService.log('error', `Error deactivating strategy ${strategy.id}`, error, 'StrategyMonitor');
      throw error;
    }
  }

  private async generateTradesForStrategy(strategy: Strategy) {
    try {
      logService.log('info', `Generating trades for strategy ${strategy.id}`, strategy, 'StrategyMonitor');
      
      // Get historical data for strategy assets
      const historicalData = await this.getHistoricalData(strategy);
      
      // Calculate available budget
      const budget = await tradeManager.getAvailableBudget(strategy.id);
      
      if (!budget || budget <= 0) {
        logService.log('warn', `No budget available for strategy ${strategy.id}`, null, 'StrategyMonitor');
        return;
      }

      // Generate trades using AI
      const trades = await tradeGenerator.generateTrades(strategy, historicalData, budget);
      
      // Execute generated trades
      for (const trade of trades) {
        try {
          await tradeManager.executeTrade(strategy, trade);
        } catch (error) {
          logService.log('error', `Failed to execute trade for strategy ${strategy.id}`, error, 'StrategyMonitor');
        }
      }

      logService.log('info', `Generated ${trades.length} trades for strategy ${strategy.id}`, null, 'StrategyMonitor');
    } catch (error) {
      logService.log('error', `Error generating trades for strategy ${strategy.id}`, error, 'StrategyMonitor');
    }
  }

  private async getHistoricalData(strategy: Strategy) {
    // Get historical data for each asset in the strategy
    const assets = strategy.strategy_config?.assets || [];
    const data: Record<string, any[]> = {};
    
    for (const asset of assets) {
      try {
        const history = await marketService.getHistoricalData(asset, '1h', 100);
        data[asset] = history;
      } catch (error) {
        logService.log('warn', `Failed to get historical data for ${asset}`, error, 'StrategyMonitor');
      }
    }
    
    return data;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logService.log('info', 'Initializing strategy monitor', null, 'StrategyMonitor');

      // Load active strategies from database
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;

      // Initialize active strategies
      if (strategies) {
        for (const strategy of strategies) {
          await this.handleStrategyActivation(strategy);
        }
      }

      // Start polling
      this.startPolling();

      this.initialized = true;
      logService.log('info', 'Strategy monitor initialized successfully', null, 'StrategyMonitor');
    } catch (error) {
      logService.log('error', 'Failed to initialize strategy monitor', error, 'StrategyMonitor');
      throw error;
    }
  }

  private startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      try {
        // Check each active strategy
        for (const [strategyId, strategy] of this.activeStrategies) {
          // Verify strategy is still active in database
          const { data } = await supabase
            .from('strategies')
            .select('status')
            .eq('id', strategyId)
            .single();

          if (!data || data.status !== 'active') {
            await this.handleStrategyDeactivation(strategy);
          }

          // Check for trade opportunities
          const trades = tradeManager.getActiveTradesForStrategy(strategyId);
          if (trades.length === 0) {
            await this.generateTradesForStrategy(strategy);
          }
        }
      } catch (error) {
        logService.log('error', 'Error in strategy monitor polling', error, 'StrategyMonitor');
      }
    }, this.POLL_INTERVAL);

    logService.log('info', `Started strategy polling (${this.POLL_INTERVAL}ms interval)`, null, 'StrategyMonitor');
  }

  getActiveStrategies(): Strategy[] {
    return Array.from(this.activeStrategies.values());
  }

  isStrategyActive(strategyId: string): boolean {
    return this.activeStrategies.has(strategyId);
  }

  cleanup() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.activeStrategies.clear();
    this.initialized = false;
  }
}

export const strategyMonitor = StrategyMonitor.getInstance();