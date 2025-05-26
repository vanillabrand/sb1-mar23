import { EventEmitter } from './event-emitter';
import { supabase } from './supabase';
import { logService } from './log-service';
import { eventBus } from './event-bus';
import { strategySync } from './strategy-sync';
import { tradeService } from './trade-service';
import { marketService } from './market-service';
import { backendSyncService } from './backend-sync-service';
import type { Strategy, Trade } from './types';

/**
 * Login Synchronization Service
 * Handles synchronization of user data when they log back into the application
 * Ensures frontend is up-to-date with backend changes that occurred while offline
 */
class LoginSyncService extends EventEmitter {
  private isSyncing = false;
  private lastLoginTime = 0;

  constructor() {
    super();
    this.setupEventListeners();
  }

  /**
   * Perform comprehensive synchronization when user logs in
   */
  async syncOnLogin(userId: string): Promise<void> {
    if (this.isSyncing) {
      logService.log('warn', 'Login sync already in progress', null, 'LoginSyncService');
      return;
    }

    try {
      this.isSyncing = true;
      const startTime = Date.now();
      
      logService.log('info', `Starting login synchronization for user ${userId}`, null, 'LoginSyncService');

      // 1. Sync strategies
      await this.syncStrategies(userId);

      // 2. Sync trades
      await this.syncTrades(userId);

      // 3. Sync budgets
      await this.syncBudgets(userId);

      // 4. Sync performance data
      await this.syncPerformanceData(userId);

      // 5. Restore active strategy monitoring
      await this.restoreActiveStrategies(userId);

      // 6. Update market subscriptions
      await this.updateMarketSubscriptions(userId);

      // 7. Start backend sync service if not running
      if (!backendSyncService.getStatus().isRunning) {
        await backendSyncService.start();
      }

      this.lastLoginTime = Date.now();
      const duration = this.lastLoginTime - startTime;

      logService.log('info', `Login synchronization completed in ${duration}ms`, null, 'LoginSyncService');

      // Emit sync completion event
      this.emit('loginSyncCompleted', {
        userId,
        timestamp: this.lastLoginTime,
        duration
      });

      // Notify other components
      eventBus.emit('user:synced', {
        userId,
        timestamp: this.lastLoginTime
      });

    } catch (error) {
      logService.log('error', 'Error during login synchronization', error, 'LoginSyncService');
      this.emit('loginSyncError', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Synchronize user strategies
   */
  private async syncStrategies(userId: string): Promise<void> {
    try {
      logService.log('info', 'Syncing strategies from database', null, 'LoginSyncService');

      // Get all user strategies from database
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!strategies || strategies.length === 0) {
        logService.log('info', 'No strategies found for user', null, 'LoginSyncService');
        return;
      }

      logService.log('info', `Found ${strategies.length} strategies for user`, null, 'LoginSyncService');

      // Update strategy sync cache
      for (const strategy of strategies) {
        try {
          await strategySync.updateStrategy(strategy.id, strategy);
          logService.log('debug', `Synced strategy ${strategy.id}`, null, 'LoginSyncService');
        } catch (strategyError) {
          logService.log('error', `Error syncing strategy ${strategy.id}`, strategyError, 'LoginSyncService');
        }
      }

      // Emit strategies updated event
      eventBus.emit('strategies:synced', {
        strategies,
        count: strategies.length
      });

    } catch (error) {
      logService.log('error', 'Error syncing strategies', error, 'LoginSyncService');
      throw error;
    }
  }

  /**
   * Synchronize user trades
   */
  private async syncTrades(userId: string): Promise<void> {
    try {
      logService.log('info', 'Syncing trades from database', null, 'LoginSyncService');

      // Get all user trades from database (via strategies)
      const { data: trades, error } = await supabase
        .from('trades')
        .select(`
          *,
          strategies!inner(user_id)
        `)
        .eq('strategies.user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!trades || trades.length === 0) {
        logService.log('info', 'No trades found for user', null, 'LoginSyncService');
        return;
      }

      logService.log('info', `Found ${trades.length} trades for user`, null, 'LoginSyncService');

      // Group trades by strategy
      const tradesByStrategy = trades.reduce((acc, trade) => {
        const strategyId = trade.strategy_id;
        if (!acc[strategyId]) {
          acc[strategyId] = [];
        }
        acc[strategyId].push(trade);
        return acc;
      }, {} as Record<string, Trade[]>);

      // Update trade service cache
      for (const [strategyId, strategyTrades] of Object.entries(tradesByStrategy)) {
        try {
          // Update trades for each strategy
          for (const trade of strategyTrades) {
            await tradeService.updateTradeInCache(trade);
          }
          logService.log('debug', `Synced ${strategyTrades.length} trades for strategy ${strategyId}`, null, 'LoginSyncService');
        } catch (tradeError) {
          logService.log('error', `Error syncing trades for strategy ${strategyId}`, tradeError, 'LoginSyncService');
        }
      }

      // Emit trades updated event
      eventBus.emit('trades:synced', {
        trades,
        count: trades.length,
        strategiesCount: Object.keys(tradesByStrategy).length
      });

    } catch (error) {
      logService.log('error', 'Error syncing trades', error, 'LoginSyncService');
      throw error;
    }
  }

  /**
   * Synchronize strategy budgets
   */
  private async syncBudgets(userId: string): Promise<void> {
    try {
      logService.log('info', 'Syncing strategy budgets', null, 'LoginSyncService');

      // Get all strategy budgets for user
      const { data: budgets, error } = await supabase
        .from('strategy_budgets')
        .select(`
          *,
          strategies!inner(user_id)
        `)
        .eq('strategies.user_id', userId);

      if (error) {
        throw error;
      }

      if (!budgets || budgets.length === 0) {
        logService.log('info', 'No budgets found for user', null, 'LoginSyncService');
        return;
      }

      logService.log('info', `Found ${budgets.length} strategy budgets for user`, null, 'LoginSyncService');

      // Update budget cache
      for (const budget of budgets) {
        try {
          await tradeService.updateBudgetCache(budget.strategy_id, budget);
          logService.log('debug', `Synced budget for strategy ${budget.strategy_id}`, null, 'LoginSyncService');
        } catch (budgetError) {
          logService.log('error', `Error syncing budget for strategy ${budget.strategy_id}`, budgetError, 'LoginSyncService');
        }
      }

      // Emit budgets updated event
      eventBus.emit('budgets:synced', {
        budgets,
        count: budgets.length
      });

    } catch (error) {
      logService.log('error', 'Error syncing budgets', error, 'LoginSyncService');
      throw error;
    }
  }

  /**
   * Synchronize performance data
   */
  private async syncPerformanceData(userId: string): Promise<void> {
    try {
      logService.log('info', 'Syncing performance data', null, 'LoginSyncService');

      // Get all performance data for user strategies
      const { data: performanceData, error } = await supabase
        .from('strategy_performance')
        .select(`
          *,
          strategies!inner(user_id)
        `)
        .eq('strategies.user_id', userId);

      if (error) {
        throw error;
      }

      if (!performanceData || performanceData.length === 0) {
        logService.log('info', 'No performance data found for user', null, 'LoginSyncService');
        return;
      }

      logService.log('info', `Found ${performanceData.length} performance records for user`, null, 'LoginSyncService');

      // Emit performance data updated event
      eventBus.emit('performance:synced', {
        performanceData,
        count: performanceData.length
      });

    } catch (error) {
      logService.log('error', 'Error syncing performance data', error, 'LoginSyncService');
      throw error;
    }
  }

  /**
   * Restore active strategy monitoring
   */
  private async restoreActiveStrategies(userId: string): Promise<void> {
    try {
      logService.log('info', 'Restoring active strategy monitoring', null, 'LoginSyncService');

      // Get all active strategies for user
      const { data: activeStrategies, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) {
        throw error;
      }

      if (!activeStrategies || activeStrategies.length === 0) {
        logService.log('info', 'No active strategies found for user', null, 'LoginSyncService');
        return;
      }

      logService.log('info', `Restoring monitoring for ${activeStrategies.length} active strategies`, null, 'LoginSyncService');

      // Restore each active strategy
      for (const strategy of activeStrategies) {
        try {
          // Emit strategy activation event to restore monitoring
          eventBus.emit('strategy:activated', {
            strategyId: strategy.id,
            strategy,
            timestamp: Date.now(),
            source: 'login-sync'
          });

          logService.log('info', `Restored monitoring for strategy ${strategy.id}`, null, 'LoginSyncService');
        } catch (strategyError) {
          logService.log('error', `Error restoring strategy ${strategy.id}`, strategyError, 'LoginSyncService');
        }
      }

    } catch (error) {
      logService.log('error', 'Error restoring active strategies', error, 'LoginSyncService');
      throw error;
    }
  }

  /**
   * Update market data subscriptions
   */
  private async updateMarketSubscriptions(userId: string): Promise<void> {
    try {
      logService.log('info', 'Updating market data subscriptions', null, 'LoginSyncService');

      // Get all unique trading pairs from user's active strategies
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('selected_pairs')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) {
        throw error;
      }

      if (!strategies || strategies.length === 0) {
        logService.log('info', 'No active strategies found for market subscription', null, 'LoginSyncService');
        return;
      }

      // Collect all unique symbols
      const allSymbols = new Set<string>();
      strategies.forEach(strategy => {
        const pairs = strategy.selected_pairs || [];
        pairs.forEach(pair => {
          allSymbols.add(pair.replace('_', '/'));
        });
      });

      logService.log('info', `Subscribing to ${allSymbols.size} market data feeds`, null, 'LoginSyncService');

      // Subscribe to market data for each symbol
      for (const symbol of allSymbols) {
        try {
          await marketService.subscribeToMarket(symbol);
          logService.log('debug', `Subscribed to market data for ${symbol}`, null, 'LoginSyncService');
        } catch (marketError) {
          logService.log('error', `Error subscribing to market data for ${symbol}`, marketError, 'LoginSyncService');
        }
      }

    } catch (error) {
      logService.log('error', 'Error updating market subscriptions', error, 'LoginSyncService');
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for user login events
    eventBus.on('user:login', async (data) => {
      try {
        await this.syncOnLogin(data.userId);
      } catch (error) {
        logService.log('error', 'Error in login sync event handler', error, 'LoginSyncService');
      }
    });

    // Listen for authentication state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        try {
          await this.syncOnLogin(session.user.id);
        } catch (error) {
          logService.log('error', 'Error in auth state change sync', error, 'LoginSyncService');
        }
      }
    });
  }

  /**
   * Get sync status
   */
  getStatus(): {
    isSyncing: boolean;
    lastLoginTime: number;
  } {
    return {
      isSyncing: this.isSyncing,
      lastLoginTime: this.lastLoginTime
    };
  }

  /**
   * Force sync (for manual refresh)
   */
  async forceSync(userId: string): Promise<void> {
    await this.syncOnLogin(userId);
  }
}

// Export singleton instance
export const loginSyncService = new LoginSyncService();
