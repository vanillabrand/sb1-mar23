import { EventEmitter } from './event-emitter';
import { supabase } from './supabase';
import { marketService } from './market-service';
import { logService } from './log-service';

class StrategyMonitor extends EventEmitter {
  private activeStrategies: Map<string, any> = new Map();
  private monitoringInterval: NodeJS.Timer | null = null;

  async initialize(): Promise<void> {
    try {
      // Load active strategies
      await this.loadActiveStrategies();

      // Start monitoring
      this.startMonitoring();

      // Setup realtime updates
      this.setupRealtimeUpdates();

      logService.log('info', 'Strategy monitor initialized successfully', null, 'StrategyMonitor');
    } catch (error) {
      logService.log('error', 'Failed to initialize strategy monitor', error, 'StrategyMonitor');
      throw error;
    }
  }

  private async loadActiveStrategies(): Promise<void> {
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('status', 'active');

    if (error) throw error;

    strategies?.forEach(strategy => {
      this.activeStrategies.set(strategy.id, strategy);
      this.subscribeToMarkets(strategy);
    });
  }

  private async subscribeToMarkets(strategy: any): Promise<void> {
    const symbols = this.extractSymbols(strategy);
    for (const symbol of symbols) {
      await marketService.subscribeToMarket(symbol);
    }
  }

  private extractSymbols(strategy: any): string[] {
    // Extract trading pairs from strategy config
    return strategy.config.pairs || [];
  }

  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      for (const strategy of this.activeStrategies.values()) {
        try {
          await this.evaluateStrategy(strategy);
        } catch (error) {
          logService.log('error', `Failed to evaluate strategy ${strategy.id}`, error, 'StrategyMonitor');
        }
      }
    }, 60000); // Evaluate every minute
  }

  private async evaluateStrategy(strategy: any): Promise<void> {
    const symbols = this.extractSymbols(strategy);
    const marketData = await Promise.all(
      symbols.map(symbol => marketService.getMarketData(symbol))
    );

    const evaluation = {
      timestamp: Date.now(),
      marketData,
      conditions: this.evaluateConditions(strategy, marketData)
    };

    this.emit('strategyEvaluation', {
      strategyId: strategy.id,
      evaluation
    });
  }

  private evaluateConditions(strategy: any, marketData: any[]): any {
    // Implement strategy-specific condition evaluation
    return {
      marketConditions: true,
      riskConditions: true,
      technicalConditions: true
    };
  }

  private setupRealtimeUpdates(): void {
    supabase
      .channel('strategy_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'strategies' },
        async (payload) => {
          try {
            switch (payload.eventType) {
              case 'INSERT':
              case 'UPDATE':
                if (payload.new.status === 'active') {
                  this.activeStrategies.set(payload.new.id, payload.new);
                  await this.subscribeToMarkets(payload.new);
                } else {
                  this.activeStrategies.delete(payload.new.id);
                }
                break;
              case 'DELETE':
                this.activeStrategies.delete(payload.old.id);
                break;
            }
          } catch (error) {
            logService.log('error', 'Error handling strategy update', error, 'StrategyMonitor');
          }
        }
      )
      .subscribe();
  }

  async addStrategy(strategy: any): Promise<void> {
    try {
      logService.log('info', `Adding strategy ${strategy.id} to monitor`, null, 'StrategyMonitor');

      // Add to active strategies
      this.activeStrategies.set(strategy.id, strategy);

      // Subscribe to markets for this strategy
      await this.subscribeToMarkets(strategy);

      // Immediately evaluate the strategy
      await this.evaluateStrategy(strategy);

      logService.log('info', `Strategy ${strategy.id} added to monitor successfully`, null, 'StrategyMonitor');
    } catch (error) {
      logService.log('error', `Failed to add strategy ${strategy.id} to monitor`, error, 'StrategyMonitor');
      throw error;
    }
  }

  async removeStrategy(strategyId: string): Promise<void> {
    try {
      if (!this.activeStrategies.has(strategyId)) {
        return;
      }

      logService.log('info', `Removing strategy ${strategyId} from monitor`, null, 'StrategyMonitor');

      // Remove from active strategies
      this.activeStrategies.delete(strategyId);

      logService.log('info', `Strategy ${strategyId} removed from monitor successfully`, null, 'StrategyMonitor');
    } catch (error) {
      logService.log('error', `Failed to remove strategy ${strategyId} from monitor`, error, 'StrategyMonitor');
      throw error;
    }
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

export const strategyMonitor = new StrategyMonitor();
