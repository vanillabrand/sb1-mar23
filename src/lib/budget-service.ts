import { supabase } from './supabase';
import { logService } from './log-service';
import { EventEmitter } from './event-emitter';
import { eventBus } from './event-bus';

export interface StrategyBudget {
  id?: string;
  strategy_id: string;
  total: number;
  allocated: number;
  available: number;
  max_position_size?: number;
  profit?: number;
  last_updated?: string;
}

class BudgetService extends EventEmitter {
  private static instance: BudgetService;
  private initialized: boolean = false;
  private budgetCache: Map<string, StrategyBudget> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private subscriptions: any[] = [];

  // Update interval in milliseconds (10 seconds)
  private readonly UPDATE_INTERVAL = 10000;

  private constructor() {
    super();
  }

  static getInstance(): BudgetService {
    if (!BudgetService.instance) {
      BudgetService.instance = new BudgetService();
    }
    return BudgetService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logService.log('info', 'Initializing budget service', null, 'BudgetService');

      // Check if the strategy_budgets table exists, create it if it doesn't
      await this.ensureStrategyBudgetsTableExists();

      // Set up real-time subscriptions
      this.setupSubscriptions();

      // Start periodic updates
      this.startPeriodicUpdates();

      // Initial data load
      await this.refreshAllBudgets();

      this.initialized = true;
      logService.log('info', 'Budget service initialized', null, 'BudgetService');
    } catch (error) {
      logService.log('error', 'Failed to initialize budget service', error, 'BudgetService');
      throw error;
    }
  }

  private async ensureStrategyBudgetsTableExists(): Promise<void> {
    try {
      // Try a simple query to check if the table exists
      const { error: tableCheckError } = await supabase
        .from('strategy_budgets')
        .select('count(*)')
        .limit(1);
        
      if (tableCheckError) {
        if (tableCheckError.code === '42P01') { // PostgreSQL code for 'relation does not exist'
          logService.log('warn', 'Strategy budgets table does not exist, creating it now', null, 'BudgetService');
          
          // Try to create the table
          try {
            // Use RPC to create the table if it doesn't exist
            await supabase.rpc('create_strategy_budgets_table_if_not_exists');
            logService.log('info', 'Created strategy_budgets table', null, 'BudgetService');
          } catch (createError) {
            logService.log('error', 'Failed to create strategy_budgets table', createError, 'BudgetService');
          }
        } else if (tableCheckError.status === 406) {
          logService.log('warn', 'Authentication issue when checking strategy_budgets table', tableCheckError, 'BudgetService');
          
          // Try to refresh the session
          try {
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              logService.log('error', 'Failed to refresh session', refreshError, 'BudgetService');
            } else {
              logService.log('info', 'Session refreshed successfully', null, 'BudgetService');
            }
          } catch (refreshError) {
            logService.log('error', 'Exception when refreshing session', refreshError, 'BudgetService');
          }
        } else {
          logService.log('error', 'Error checking strategy_budgets table', tableCheckError, 'BudgetService');
        }
      } else {
        logService.log('info', 'Strategy budgets table exists', null, 'BudgetService');
      }
    } catch (tableCheckError) {
      logService.log('error', 'Exception when checking strategy_budgets table', tableCheckError, 'BudgetService');
    }
  }

  private setupSubscriptions(): void {
    try {
      // Subscribe to budget changes
      const budgetSubscription = supabase
        .channel('budget_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'strategy_budgets' }, (payload) => {
          this.handleBudgetChange(payload);
        })
        .subscribe();

      this.subscriptions.push(budgetSubscription);

      logService.log('info', 'Budget subscriptions set up', null, 'BudgetService');
    } catch (error) {
      logService.log('error', 'Failed to set up budget subscriptions', error, 'BudgetService');
    }
  }

  private startPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.refreshAllBudgets().catch(error => {
        logService.log('error', 'Failed to refresh budgets', error, 'BudgetService');
      });
    }, this.UPDATE_INTERVAL);

    logService.log('info', 'Budget periodic updates started', null, 'BudgetService');
  }

  private async handleBudgetChange(payload: any): Promise<void> {
    try {
      const strategyId = payload.new?.strategy_id || payload.old?.strategy_id;
      if (!strategyId) return;

      logService.log('info', `Budget change detected for strategy ID: ${strategyId}`, null, 'BudgetService');

      // Refresh budget for this strategy
      await this.refreshBudget(strategyId);
    } catch (error) {
      logService.log('error', 'Failed to handle budget change', error, 'BudgetService');
    }
  }

  async refreshAllBudgets(): Promise<void> {
    try {
      // Get all strategies
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('id');

      if (error) {
        throw error;
      }

      if (!strategies || strategies.length === 0) {
        return;
      }

      // Process each strategy
      for (const strategy of strategies) {
        await this.refreshBudget(strategy.id);
      }

      // Emit event for all budgets updated
      this.emit('allBudgetsUpdated', Array.from(this.budgetCache.values()));
      eventBus.emit('budgets:allUpdated', Array.from(this.budgetCache.values()));

    } catch (error) {
      logService.log('error', 'Failed to refresh all budgets', error, 'BudgetService');
      throw error;
    }
  }

  async refreshBudget(strategyId: string): Promise<StrategyBudget | null> {
    try {
      // First check if we have an active session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logService.log('warn', 'No active session found when refreshing budget', { strategyId }, 'BudgetService');
        
        // Try to refresh the session
        try {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            logService.log('error', 'Failed to refresh session', refreshError, 'BudgetService');
            return null;
          }
        } catch (refreshError) {
          logService.log('error', 'Exception when refreshing session', refreshError, 'BudgetService');
          return null;
        }
      }

      // Get budget for this strategy
      let budgetData = null;
      try {
        const { data, error } = await supabase
          .from('strategy_budgets')
          .select('*')
          .eq('strategy_id', strategyId)
          .maybeSingle(); // Use maybeSingle instead of single to avoid 406 errors

        if (error) {
          // Handle other errors that might still occur
          logService.log('error', `Error fetching budget for strategy ${strategyId}`, error, 'BudgetService');
          return null;
        } else if (data) {
          // We have budget data
          budgetData = data;
        } else {
          // No budget found, create a default one
          const defaultBudget: StrategyBudget = {
            strategy_id: strategyId,
            total: 1000, // Default total budget
            allocated: 0,
            available: 1000,
            max_position_size: 0.1, // Default max position size (10%)
            profit: 0,
            last_updated: new Date().toISOString()
          };

          // Try to insert the default budget
          const { data: insertedBudget, error: insertError } = await supabase
            .from('strategy_budgets')
            .insert(defaultBudget)
            .select()
            .single();

          if (insertError) {
            logService.log('error', `Error creating default budget for strategy ${strategyId}`, insertError, 'BudgetService');
          } else if (insertedBudget) {
            budgetData = insertedBudget;
            logService.log('info', `Created default budget for strategy ${strategyId}`, null, 'BudgetService');
          }
        }
      } catch (budgetError) {
        logService.log('error', `Exception fetching budget for strategy ${strategyId}`, budgetError, 'BudgetService');
        return null;
      }

      if (!budgetData) {
        logService.log('warn', `No budget data available for strategy ${strategyId}`, null, 'BudgetService');
        return null;
      }

      // Create budget object
      const budget: StrategyBudget = {
        id: budgetData.id,
        strategy_id: strategyId,
        total: budgetData.total || 0,
        allocated: budgetData.allocated || 0,
        available: budgetData.available || 0,
        max_position_size: budgetData.max_position_size || 0.1,
        profit: budgetData.profit || 0,
        last_updated: budgetData.last_updated || new Date().toISOString()
      };

      // Update cache
      this.budgetCache.set(strategyId, budget);

      // Emit event for this strategy
      this.emit('budgetUpdated', strategyId, budget);
      eventBus.emit('budget:updated', {
        strategyId,
        budget,
        timestamp: Date.now()
      });
      eventBus.emit(`budget:updated:${strategyId}`, {
        strategyId,
        budget,
        timestamp: Date.now()
      });

      return budget;
    } catch (error) {
      logService.log('error', `Failed to refresh budget for strategy ${strategyId}`, error, 'BudgetService');
      return null;
    }
  }

  /**
   * Get budget for a specific strategy
   * @param strategyId The strategy ID
   * @returns The strategy budget or null if not found
   */
  async getBudget(strategyId: string): Promise<StrategyBudget | null> {
    // Check if we have it in cache
    const cachedBudget = this.budgetCache.get(strategyId);
    if (cachedBudget) {
      return cachedBudget;
    }

    // If not in cache, refresh from database
    return await this.refreshBudget(strategyId);
  }

  /**
   * Update budget for a strategy
   * @param strategyId The strategy ID
   * @param budget The updated budget
   */
  async updateBudget(strategyId: string, budget: Partial<StrategyBudget>): Promise<StrategyBudget | null> {
    try {
      // Get current budget
      const currentBudget = await this.getBudget(strategyId);
      if (!currentBudget) {
        logService.log('warn', `No budget found for strategy ${strategyId} to update`, null, 'BudgetService');
        return null;
      }

      // Merge current budget with updates
      const updatedBudget: StrategyBudget = {
        ...currentBudget,
        ...budget,
        strategy_id: strategyId, // Ensure strategy_id is not changed
        last_updated: new Date().toISOString()
      };

      // Update in database
      const { data, error } = await supabase
        .from('strategy_budgets')
        .update(updatedBudget)
        .eq('strategy_id', strategyId)
        .select()
        .single();

      if (error) {
        logService.log('error', `Error updating budget for strategy ${strategyId}`, error, 'BudgetService');
        return null;
      }

      // Update cache
      this.budgetCache.set(strategyId, data);

      // Emit event for this strategy
      this.emit('budgetUpdated', strategyId, data);
      eventBus.emit('budget:updated', {
        strategyId,
        budget: data,
        timestamp: Date.now()
      });
      eventBus.emit(`budget:updated:${strategyId}`, {
        strategyId,
        budget: data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      logService.log('error', `Failed to update budget for strategy ${strategyId}`, error, 'BudgetService');
      return null;
    }
  }

  /**
   * Reserve budget for a trade
   * @param strategyId The strategy ID
   * @param amount The amount to reserve
   * @param tradeId Optional trade ID
   */
  async reserveBudget(strategyId: string, amount: number, tradeId?: string): Promise<boolean> {
    try {
      // Get current budget
      const budget = await this.getBudget(strategyId);
      if (!budget) {
        logService.log('warn', `No budget found for strategy ${strategyId} to reserve`, { tradeId }, 'BudgetService');
        return false;
      }

      // Check if we have enough available budget
      if (budget.available < amount) {
        logService.log('warn', `Not enough available budget for strategy ${strategyId}`, { 
          available: budget.available, 
          requested: amount,
          tradeId 
        }, 'BudgetService');
        return false;
      }

      // Update budget
      const updatedBudget = await this.updateBudget(strategyId, {
        allocated: budget.allocated + amount,
        available: budget.available - amount
      });

      if (!updatedBudget) {
        logService.log('error', `Failed to update budget for strategy ${strategyId} after reservation`, { tradeId }, 'BudgetService');
        return false;
      }

      logService.log('info', `Reserved ${amount} for strategy ${strategyId}${tradeId ? ` (trade: ${tradeId})` : ''}`, null, 'BudgetService');
      return true;
    } catch (error) {
      logService.log('error', `Failed to reserve budget for strategy ${strategyId}`, error, 'BudgetService');
      return false;
    }
  }

  /**
   * Release budget for a trade
   * @param strategyId The strategy ID
   * @param amount The amount to release
   * @param profit Optional profit to add
   * @param tradeId Optional trade ID
   * @param tradeStatus Optional trade status
   */
  async releaseBudget(strategyId: string, amount: number, profit: number = 0, tradeId?: string, tradeStatus?: string): Promise<boolean> {
    try {
      // Get current budget
      const budget = await this.getBudget(strategyId);
      if (!budget) {
        logService.log('warn', `No budget found for strategy ${strategyId} to release`, { tradeId }, 'BudgetService');
        return false;
      }

      // Format the values to 2 decimal places to avoid floating point issues
      const formattedAmount = Number(amount.toFixed(2));
      const formattedProfit = Number(profit.toFixed(2));

      let allocatedChange = -formattedAmount;
      let availableChange = formattedAmount;
      let totalChange = 0;

      // Update budget based on trade status
      if (tradeStatus === 'cancelled' || tradeStatus === 'rejected') {
        // For cancelled/rejected trades, just return the allocated amount to available
        // No change to total budget
      } else if (tradeStatus === 'closed') {
        // For closed trades, return allocated amount plus profit
        availableChange += formattedProfit;
        totalChange = formattedProfit;
      } else {
        // Default behavior for other statuses
        availableChange += formattedProfit;
        totalChange = formattedProfit;
      }

      // Update budget
      const updatedBudget = await this.updateBudget(strategyId, {
        allocated: Math.max(0, budget.allocated + allocatedChange),
        available: Math.max(0, budget.available + availableChange),
        total: Math.max(0, budget.total + totalChange),
        profit: (budget.profit || 0) + formattedProfit
      });

      if (!updatedBudget) {
        logService.log('error', `Failed to update budget for strategy ${strategyId} after release`, { tradeId }, 'BudgetService');
        return false;
      }

      logService.log('info', `Released ${formattedAmount} (profit: ${formattedProfit}) for strategy ${strategyId}${tradeId ? ` (trade: ${tradeId})` : ''} with status ${tradeStatus || 'unknown'}`, null, 'BudgetService');
      return true;
    } catch (error) {
      logService.log('error', `Failed to release budget for strategy ${strategyId}`, error, 'BudgetService');
      return false;
    }
  }

  /**
   * Reset budget for a strategy
   * @param strategyId The strategy ID
   * @param initialAmount Optional initial amount (default: 1000)
   */
  async resetBudget(strategyId: string, initialAmount: number = 1000): Promise<StrategyBudget | null> {
    try {
      const resetBudget: StrategyBudget = {
        strategy_id: strategyId,
        total: initialAmount,
        allocated: 0,
        available: initialAmount,
        max_position_size: 0.1,
        profit: 0,
        last_updated: new Date().toISOString()
      };

      // Delete existing budget if any
      await supabase
        .from('strategy_budgets')
        .delete()
        .eq('strategy_id', strategyId);

      // Insert new budget
      const { data, error } = await supabase
        .from('strategy_budgets')
        .insert(resetBudget)
        .select()
        .single();

      if (error) {
        logService.log('error', `Error resetting budget for strategy ${strategyId}`, error, 'BudgetService');
        return null;
      }

      // Update cache
      this.budgetCache.set(strategyId, data);

      // Emit event for this strategy
      this.emit('budgetUpdated', strategyId, data);
      eventBus.emit('budget:updated', {
        strategyId,
        budget: data,
        timestamp: Date.now()
      });
      eventBus.emit(`budget:updated:${strategyId}`, {
        strategyId,
        budget: data,
        timestamp: Date.now()
      });

      logService.log('info', `Reset budget for strategy ${strategyId} to ${initialAmount}`, null, 'BudgetService');
      return data;
    } catch (error) {
      logService.log('error', `Failed to reset budget for strategy ${strategyId}`, error, 'BudgetService');
      return null;
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Unsubscribe from all channels
    this.subscriptions.forEach(subscription => {
      subscription.unsubscribe();
    });

    this.subscriptions = [];
    this.budgetCache.clear();
    this.initialized = false;

    logService.log('info', 'Budget service cleaned up', null, 'BudgetService');
  }
}

export const budgetService = BudgetService.getInstance();
