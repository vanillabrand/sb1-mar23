import { EventEmitter } from './event-emitter';
import { supabase } from './supabase';
import { logService } from './log-service';
import { strategyMonitor } from './strategy-monitor';
import { tradeGenerator } from './trade-generator';
import { tradeManager } from './trade-manager';
import { marketService } from './market-service';
import { eventBus } from './event-bus';
import type { Strategy, Trade } from './types';

/**
 * Backend Synchronization Service
 * Ensures continuous operation of trading strategies, monitoring, and trade generation
 * even when users are not logged into the frontend
 */
class BackendSyncService extends EventEmitter {
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastSyncTime = 0;
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private readonly MONITORING_INTERVAL = 60000; // 1 minute
  private readonly MAX_RETRY_ATTEMPTS = 3;

  constructor() {
    super();
    this.setupEventListeners();
  }

  /**
   * Start the backend synchronization service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logService.log('warn', 'Backend sync service already running', null, 'BackendSyncService');
      return;
    }

    try {
      this.isRunning = true;
      logService.log('info', 'Starting backend synchronization service', null, 'BackendSyncService');

      // Start periodic synchronization
      this.syncInterval = setInterval(() => {
        this.performSync().catch(error => {
          logService.log('error', 'Error in periodic sync', error, 'BackendSyncService');
        });
      }, this.SYNC_INTERVAL);

      // Start strategy monitoring
      this.monitoringInterval = setInterval(() => {
        this.monitorActiveStrategies().catch(error => {
          logService.log('error', 'Error in strategy monitoring', error, 'BackendSyncService');
        });
      }, this.MONITORING_INTERVAL);

      // Perform initial sync
      await this.performSync();

      logService.log('info', 'Backend synchronization service started successfully', null, 'BackendSyncService');
    } catch (error) {
      this.isRunning = false;
      logService.log('error', 'Failed to start backend sync service', error, 'BackendSyncService');
      throw error;
    }
  }

  /**
   * Stop the backend synchronization service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logService.log('info', 'Backend synchronization service stopped', null, 'BackendSyncService');
  }

  /**
   * Perform comprehensive synchronization
   */
  private async performSync(): Promise<void> {
    try {
      const startTime = Date.now();
      logService.log('debug', 'Starting backend sync cycle', null, 'BackendSyncService');

      // 1. Sync active strategies
      await this.syncActiveStrategies();

      // 2. Process pending trades
      await this.processPendingTrades();

      // 3. Update strategy performance
      await this.updateStrategyPerformance();

      // 4. Clean up stale data
      await this.cleanupStaleData();

      this.lastSyncTime = Date.now();
      const duration = this.lastSyncTime - startTime;

      logService.log('debug', `Backend sync cycle completed in ${duration}ms`, null, 'BackendSyncService');
      
      // Emit sync completion event
      this.emit('syncCompleted', {
        timestamp: this.lastSyncTime,
        duration
      });

    } catch (error) {
      logService.log('error', 'Error during backend sync', error, 'BackendSyncService');
      this.emit('syncError', error);
    }
  }

  /**
   * Synchronize active strategies with backend services
   */
  private async syncActiveStrategies(): Promise<void> {
    try {
      // Get all active strategies from database
      const { data: activeStrategies, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('status', 'active');

      if (error) {
        throw error;
      }

      if (!activeStrategies || activeStrategies.length === 0) {
        logService.log('debug', 'No active strategies found', null, 'BackendSyncService');
        return;
      }

      logService.log('info', `Syncing ${activeStrategies.length} active strategies`, null, 'BackendSyncService');

      // Ensure all active strategies are being monitored
      for (const strategy of activeStrategies) {
        try {
          // Add to strategy monitor if not already monitored
          if (!strategyMonitor.isMonitoring(strategy.id)) {
            await strategyMonitor.addStrategy(strategy);
            logService.log('info', `Added strategy ${strategy.id} to monitor`, null, 'BackendSyncService');
          }

          // Add to trade generator if not already added
          if (!tradeGenerator.hasStrategy(strategy.id)) {
            await tradeGenerator.addStrategy(strategy);
            logService.log('info', `Added strategy ${strategy.id} to trade generator`, null, 'BackendSyncService');
          }

          // Ensure market data subscription
          await this.ensureMarketDataSubscription(strategy);

        } catch (strategyError) {
          logService.log('error', `Error syncing strategy ${strategy.id}`, strategyError, 'BackendSyncService');
        }
      }

    } catch (error) {
      logService.log('error', 'Error syncing active strategies', error, 'BackendSyncService');
    }
  }

  /**
   * Process pending trades
   */
  private async processPendingTrades(): Promise<void> {
    try {
      const { data: pendingTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      if (!pendingTrades || pendingTrades.length === 0) {
        return;
      }

      logService.log('info', `Processing ${pendingTrades.length} pending trades`, null, 'BackendSyncService');

      for (const trade of pendingTrades) {
        try {
          await tradeManager.executeTrade(trade);
          logService.log('info', `Executed pending trade ${trade.id}`, null, 'BackendSyncService');
        } catch (tradeError) {
          logService.log('error', `Error executing trade ${trade.id}`, tradeError, 'BackendSyncService');
        }
      }

    } catch (error) {
      logService.log('error', 'Error processing pending trades', error, 'BackendSyncService');
    }
  }

  /**
   * Update strategy performance metrics
   */
  private async updateStrategyPerformance(): Promise<void> {
    try {
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('id, status')
        .eq('status', 'active');

      if (error || !strategies) {
        return;
      }

      for (const strategy of strategies) {
        try {
          // Calculate performance metrics
          const performance = await this.calculateStrategyPerformance(strategy.id);
          
          // Update in database
          await supabase
            .from('strategy_performance')
            .upsert({
              strategy_id: strategy.id,
              ...performance,
              updated_at: new Date().toISOString()
            });

        } catch (perfError) {
          logService.log('error', `Error updating performance for strategy ${strategy.id}`, perfError, 'BackendSyncService');
        }
      }

    } catch (error) {
      logService.log('error', 'Error updating strategy performance', error, 'BackendSyncService');
    }
  }

  /**
   * Calculate strategy performance metrics
   */
  private async calculateStrategyPerformance(strategyId: string): Promise<any> {
    const { data: trades } = await supabase
      .from('trades')
      .select('*')
      .eq('strategy_id', strategyId)
      .eq('status', 'closed');

    if (!trades || trades.length === 0) {
      return {
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        total_profit: 0,
        win_rate: 0,
        average_profit: 0
      };
    }

    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => (t.profit || 0) > 0).length;
    const losingTrades = totalTrades - winningTrades;
    const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const averageProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;

    return {
      total_trades: totalTrades,
      winning_trades: winningTrades,
      losing_trades: losingTrades,
      total_profit: totalProfit,
      win_rate: winRate,
      average_profit: averageProfit
    };
  }

  /**
   * Ensure market data subscription for strategy
   */
  private async ensureMarketDataSubscription(strategy: Strategy): Promise<void> {
    try {
      const symbols = strategy.selectedPairs || strategy.selected_pairs || [];
      
      for (const symbol of symbols) {
        const normalizedSymbol = symbol.replace('_', '/');
        
        if (!marketService.isSubscribed(normalizedSymbol)) {
          await marketService.subscribeToMarket(normalizedSymbol);
          logService.log('debug', `Subscribed to market data for ${normalizedSymbol}`, null, 'BackendSyncService');
        }
      }
    } catch (error) {
      logService.log('error', `Error ensuring market data subscription for strategy ${strategy.id}`, error, 'BackendSyncService');
    }
  }

  /**
   * Clean up stale data
   */
  private async cleanupStaleData(): Promise<void> {
    try {
      // Remove old completed trades (older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await supabase
        .from('trades')
        .delete()
        .eq('status', 'closed')
        .lt('created_at', thirtyDaysAgo.toISOString());

      logService.log('debug', 'Cleaned up stale trade data', null, 'BackendSyncService');

    } catch (error) {
      logService.log('error', 'Error cleaning up stale data', error, 'BackendSyncService');
    }
  }

  /**
   * Monitor active strategies for adaptation needs
   */
  private async monitorActiveStrategies(): Promise<void> {
    try {
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('status', 'active');

      if (error || !strategies) {
        return;
      }

      for (const strategy of strategies) {
        try {
          // Check if strategy needs adaptation
          const needsAdaptation = await this.checkAdaptationNeeds(strategy);
          
          if (needsAdaptation) {
            await this.adaptStrategy(strategy);
          }

        } catch (adaptError) {
          logService.log('error', `Error monitoring strategy ${strategy.id}`, adaptError, 'BackendSyncService');
        }
      }

    } catch (error) {
      logService.log('error', 'Error monitoring active strategies', error, 'BackendSyncService');
    }
  }

  /**
   * Check if strategy needs adaptation
   */
  private async checkAdaptationNeeds(strategy: any): Promise<boolean> {
    // Check if strategy was last adapted more than 1 hour ago
    const lastAdapted = strategy.last_adapted_at ? new Date(strategy.last_adapted_at) : new Date(0);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    return lastAdapted < oneHourAgo;
  }

  /**
   * Adapt strategy based on market conditions
   */
  private async adaptStrategy(strategy: any): Promise<void> {
    try {
      logService.log('info', `Adapting strategy ${strategy.id}`, null, 'BackendSyncService');

      // Get current market data for strategy symbols
      const symbols = strategy.selected_pairs || [];
      const marketData = await Promise.all(
        symbols.map(symbol => marketService.getMarketData(symbol.replace('_', '/')))
      );

      // Call adaptation service (this would integrate with Deepseek)
      // For now, just update the last_adapted_at timestamp
      await supabase
        .from('strategies')
        .update({
          last_adapted_at: new Date().toISOString()
        })
        .eq('id', strategy.id);

      logService.log('info', `Strategy ${strategy.id} adapted successfully`, null, 'BackendSyncService');

    } catch (error) {
      logService.log('error', `Error adapting strategy ${strategy.id}`, error, 'BackendSyncService');
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for user login events to trigger sync
    eventBus.on('user:login', () => {
      this.performSync().catch(error => {
        logService.log('error', 'Error syncing on user login', error, 'BackendSyncService');
      });
    });

    // Listen for strategy activation/deactivation
    eventBus.on('strategy:activated', (data) => {
      this.handleStrategyActivation(data.strategyId).catch(error => {
        logService.log('error', 'Error handling strategy activation', error, 'BackendSyncService');
      });
    });

    eventBus.on('strategy:deactivated', (data) => {
      this.handleStrategyDeactivation(data.strategyId);
    });
  }

  /**
   * Handle strategy activation
   */
  private async handleStrategyActivation(strategyId: string): Promise<void> {
    try {
      const { data: strategy, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', strategyId)
        .single();

      if (error || !strategy) {
        throw new Error(`Strategy ${strategyId} not found`);
      }

      // Add to monitoring services
      await strategyMonitor.addStrategy(strategy);
      await tradeGenerator.addStrategy(strategy);
      await this.ensureMarketDataSubscription(strategy);

      logService.log('info', `Strategy ${strategyId} activated in backend services`, null, 'BackendSyncService');

    } catch (error) {
      logService.log('error', `Error activating strategy ${strategyId} in backend`, error, 'BackendSyncService');
    }
  }

  /**
   * Handle strategy deactivation
   */
  private handleStrategyDeactivation(strategyId: string): void {
    try {
      // Remove from monitoring services
      strategyMonitor.removeStrategy(strategyId);
      tradeGenerator.removeStrategy(strategyId);

      logService.log('info', `Strategy ${strategyId} deactivated in backend services`, null, 'BackendSyncService');

    } catch (error) {
      logService.log('error', `Error deactivating strategy ${strategyId} in backend`, error, 'BackendSyncService');
    }
  }

  /**
   * Get sync status
   */
  getStatus(): {
    isRunning: boolean;
    lastSyncTime: number;
    nextSyncIn: number;
  } {
    const nextSyncIn = this.isRunning ? 
      Math.max(0, this.SYNC_INTERVAL - (Date.now() - this.lastSyncTime)) : 0;

    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      nextSyncIn
    };
  }
}

// Export singleton instance
export const backendSyncService = new BackendSyncService();
