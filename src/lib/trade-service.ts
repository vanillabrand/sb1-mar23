import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import type { StrategyBudget, TradeService as TradeServiceInterface } from './types';
import { eventBus } from './event-bus';

class TradeService extends EventEmitter implements TradeServiceInterface {
  private static instance: TradeService;
  private budgets: Map<string, StrategyBudget> = new Map();
  private isDemo = true;
  private initialized = false;
  private readonly DEFAULT_BUDGET = 10000; // Default budget in USDT

  private constructor() {
    super();
    this.loadSavedBudgets();
  }

  static getInstance(): TradeService {
    if (!TradeService.instance) {
      TradeService.instance = new TradeService();
    }
    return TradeService.instance;
  }

  // Load saved budgets from localStorage into the budgets Map.
  private loadSavedBudgets() {
    try {
      const savedBudgets = localStorage.getItem('strategy_budgets');
      if (savedBudgets) {
        const parsed = JSON.parse(savedBudgets);
        Object.entries(parsed).forEach(([strategyId, budget]) => {
          this.budgets.set(strategyId, budget as StrategyBudget);
        });
      }
      this.initialized = true;
    } catch (error) {
      console.warn('Failed to load saved budgets:', error);
      this.initialized = true;
    }
  }

  // Save the current budgets Map to localStorage.
  private saveBudgets() {
    try {
      const budgetsObj = Object.fromEntries(this.budgets.entries());
      localStorage.setItem('strategy_budgets', JSON.stringify(budgetsObj));
    } catch (error) {
      console.warn('Failed to save budgets:', error);
    }
  }

  // Set or remove a budget for a given strategy. Waits until the service is initialized.
  async setBudget(strategyId: string, budget: StrategyBudget | null): Promise<void> {
    // Ensure service is initialized by polling.
    if (!this.initialized) {
      await new Promise<void>((resolve) => {
        const checkInit = () => {
          if (this.initialized) {
            resolve();
          } else {
            setTimeout(checkInit, 100);
          }
        };
        checkInit();
      });
    }

    if (budget === null) {
      this.budgets.delete(strategyId);
      logService.log('info', `Budget removed for strategy ${strategyId}`, null, 'TradeService');
    } else {
      // Format budget values to 2 decimal places.
      const formattedBudget = {
        ...budget,
        total: Number(budget.total.toFixed(2)),
        allocated: Number(budget.allocated.toFixed(2)),
        available: Number(budget.available.toFixed(2)),
        maxPositionSize: Number(budget.maxPositionSize.toFixed(2)),
        lastUpdated: Date.now() // Add timestamp
      };

      // Validate the budget configuration.
      if (!this.validateBudget(formattedBudget)) {
        throw new Error('Invalid budget configuration');
      }

      // Set the budget in memory
      this.budgets.set(strategyId, formattedBudget);

      // Log detailed information for debugging
      logService.log('info', `Budget set for strategy ${strategyId}`, {
        budget: formattedBudget,
        isDemoMode: this.isDemo,
        budgetsSize: this.budgets.size
      }, 'TradeService');

      // Try to save to database if not in demo mode
      if (!this.isDemo) {
        try {
          await this.saveBudgetToDatabase(strategyId, formattedBudget);
        } catch (dbError) {
          logService.log('warn', `Failed to save budget to database: ${dbError.message}`, { strategyId }, 'TradeService');
          // Continue even if database save fails
        }
      }
    }

    // Save to localStorage
    this.saveBudgets();

    // Emit events
    this.emit('budgetUpdated', { strategyId, budget });
    eventBus.emit('budget:updated', { strategyId, budget });
  }

  // Validate that the budget object has correct numeric values.
  private validateBudget(budget: StrategyBudget): boolean {
    // Special case for deactivation - allow zero budget
    if (budget.total === 0 && budget.allocated === 0 && budget.available === 0 && budget.maxPositionSize === 0) {
      return true;
    }

    // Normal budget validation
    return (
      budget.total > 0 &&
      budget.allocated >= 0 &&
      budget.available >= 0 &&
      budget.maxPositionSize > 0 &&
      budget.allocated + budget.available <= budget.total
    );
  }

  // Retrieve the budget for a given strategy.
  getBudget(strategyId: string): StrategyBudget | null {
    return this.budgets.get(strategyId) || null;
  }

  // Returns a copy of all budgets.
  getAllBudgets(): Map<string, StrategyBudget> {
    return new Map(this.budgets);
  }

  // Calculate the total available budget after subtracting allocated funds.
  calculateAvailableBudget(): number {
    // Sum the total budgets of all strategies.
    const totalAllocated = Array.from(this.budgets.values())
      .reduce((sum, budget) => sum + budget.total, 0);

    // In demo mode, use a fixed total balance.
    const totalBalance = this.isDemo ? 100000 : this.DEFAULT_BUDGET;
    return Number((Math.max(0, totalBalance - totalAllocated)).toFixed(2));
  }

  setDemoMode(isDemo: boolean): void {
    this.isDemo = isDemo;
  }

  isDemoMode(): boolean {
    return this.isDemo;
  }

  // Reserve a portion of the available budget for a trade.
  reserveBudgetForTrade(strategyId: string, amount: number, tradeId?: string): boolean {
    const budget = this.budgets.get(strategyId);
    if (!budget) {
      logService.log('warn', `No budget found for strategy ${strategyId}`, null, 'TradeService');
      return false;
    }

    // Validate the amount is positive and reasonable
    if (!amount || amount <= 0) {
      logService.log('warn', `Invalid amount for budget reservation: ${amount}`, null, 'TradeService');
      return false;
    }

    // Check if we have enough available budget
    if (budget.available < amount) {
      logService.log('warn', `Insufficient budget for trade: ${amount} (available: ${budget.available})`,
        { tradeId, strategyId, amount, available: budget.available }, 'TradeService');
      return false;
    }

    // Format the amount to 2 decimal places to avoid floating point issues
    const formattedAmount = Number(amount.toFixed(2));

    // Update the budget
    budget.available = Number((budget.available - formattedAmount).toFixed(2));
    budget.allocated = Number((budget.allocated + formattedAmount).toFixed(2));

    // Ensure we don't have negative values due to rounding
    if (budget.available < 0) budget.available = 0;

    // Save the updated budget
    this.budgets.set(strategyId, budget);
    this.saveBudgets();

    // Emit budget updated event
    this.emit('budgetUpdated', { strategyId, budget, tradeId });
    logService.log('info', `Reserved ${formattedAmount} for strategy ${strategyId}${tradeId ? ` (trade: ${tradeId})` : ''}`,
      { budget, tradeId }, 'TradeService');
    return true;
  }

  // Release reserved budget from a trade, applying any profit gained.
  async releaseBudgetFromTrade(strategyId: string, amount: number, profit: number = 0, tradeId?: string, tradeStatus?: string): Promise<void> {
    try {
      const budget = this.budgets.get(strategyId);
      if (!budget) {
        // If budget doesn't exist in memory, try to load it from database
        try {
          await this.initializeBudget(strategyId);
          const reloadedBudget = this.budgets.get(strategyId);
          if (!reloadedBudget) {
            logService.log('warn', `No budget found for strategy ${strategyId} even after initialization`, { tradeId }, 'TradeService');
            return;
          }
        } catch (initError) {
          logService.log('error', `Failed to initialize budget for strategy ${strategyId}`, initError, 'TradeService');
          return;
        }
      }

      // Get the budget again after potential initialization
      const updatedBudget = this.budgets.get(strategyId);
      if (!updatedBudget) {
        logService.log('warn', `Still no budget found for strategy ${strategyId} after initialization attempt`, { tradeId }, 'TradeService');
        return;
      }

      // Validate the amount is positive and reasonable
      if (!amount || amount <= 0) {
        logService.log('warn', `Invalid amount for budget release: ${amount}`, { tradeId, strategyId }, 'TradeService');
        return;
      }

      // Format the values to 2 decimal places to avoid floating point issues
      const formattedAmount = Number(amount.toFixed(2));
      const formattedProfit = Number(profit.toFixed(2));

      // If tradeId is provided but tradeStatus is not, try to get the status from the database
      if (tradeId && !tradeStatus) {
        try {
          const { data: trade, error } = await supabase
            .from('trades')
            .select('status')
            .eq('id', tradeId)
            .single();

          if (!error && trade) {
            tradeStatus = trade.status;
            logService.log('info', `Retrieved trade status for ${tradeId}: ${tradeStatus}`, null, 'TradeService');
          }
        } catch (fetchError) {
          logService.log('warn', `Failed to fetch trade status: ${fetchError.message}`, { tradeId }, 'TradeService');
          // Continue with default behavior
        }
      }

      // Update budget based on trade status
      if (tradeStatus === 'cancelled' || tradeStatus === 'rejected') {
        // For cancelled/rejected trades, just return the allocated amount to available
        updatedBudget.allocated = Number((updatedBudget.allocated - formattedAmount).toFixed(2));
        updatedBudget.available = Number((updatedBudget.available + formattedAmount).toFixed(2));
        // No change to total budget
      } else if (tradeStatus === 'closed') {
        // For closed trades, return allocated amount plus profit
        updatedBudget.allocated = Number((updatedBudget.allocated - formattedAmount).toFixed(2));
        updatedBudget.available = Number((updatedBudget.available + formattedAmount + formattedProfit).toFixed(2));
        updatedBudget.total = Number((updatedBudget.total + formattedProfit).toFixed(2));
      } else {
        // Default behavior for other statuses
        updatedBudget.allocated = Number((updatedBudget.allocated - formattedAmount).toFixed(2));
        updatedBudget.available = Number((updatedBudget.available + formattedAmount + formattedProfit).toFixed(2));
        updatedBudget.total = Number((updatedBudget.total + formattedProfit).toFixed(2));
      }

      // Ensure we don't have negative values due to rounding or calculation errors
      if (updatedBudget.allocated < 0) updatedBudget.allocated = 0;
      if (updatedBudget.available < 0) updatedBudget.available = 0;

      // Ensure total is at least the sum of allocated and available
      const minTotal = updatedBudget.allocated + updatedBudget.available;
      if (updatedBudget.total < minTotal) {
        updatedBudget.total = Number(minTotal.toFixed(2));
      }

      // Update the last updated timestamp
      updatedBudget.lastUpdated = Date.now();

      this.budgets.set(strategyId, updatedBudget);
      this.saveBudgets();

      // Update the budget in the database if not in demo mode
      if (!this.isDemo) {
        try {
          await this.saveBudgetToDatabase(strategyId, updatedBudget);
        } catch (dbError) {
          logService.log('warn', `Failed to save budget to database for strategy ${strategyId}`, dbError, 'TradeService');
          // Continue even if database update fails
        }
      }

      // Emit budget updated event with more details
      const eventData = {
        strategyId,
        budget: updatedBudget,
        tradeId,
        tradeStatus,
        amount: formattedAmount,
        profit: formattedProfit,
        timestamp: Date.now()
      };

      this.emit('budgetUpdated', eventData);
      eventBus.emit('budget:updated', eventData);
      eventBus.emit(`budget:updated:${strategyId}`, eventData);

      // Broadcast to all components that need to know about budget changes
      eventBus.emit('app:state:updated', {
        component: 'budget',
        action: 'updated',
        strategyId,
        budget: updatedBudget
      });

      logService.log('info', `Released ${formattedAmount} (profit: ${formattedProfit}) for strategy ${strategyId}${tradeId ? ` (trade: ${tradeId})` : ''} with status ${tradeStatus || 'unknown'}`,
        { budget: updatedBudget, tradeId, tradeStatus }, 'TradeService');
    } catch (error) {
      logService.log('error', `Error in releaseBudgetFromTrade for strategy ${strategyId}`, error, 'TradeService');
    }
  }

  /**
   * Release budget for a trade when closing it
   * @param strategyId The ID of the strategy
   * @param amount The amount to release
   * @param tradeId Optional trade ID
   * @param tradeStatus Optional trade status
   */
  async releaseBudget(strategyId: string, amount: number, tradeId?: string, tradeStatus?: string): Promise<void> {
    // Call releaseBudgetFromTrade with 0 profit and pass along trade status
    await this.releaseBudgetFromTrade(strategyId, amount, 0, tradeId, tradeStatus);
  }

  clearAllBudgets(): void {
    this.budgets.clear();
    this.saveBudgets();
    logService.log('info', 'All budgets cleared', null, 'TradeService');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Update the budget cache for a strategy
   * This method is used to ensure consistency across all components
   * @param strategyId The strategy ID
   * @param budget The updated budget
   */
  updateBudgetCache(strategyId: string, budget: StrategyBudget): void {
    if (!strategyId || !budget) {
      logService.log('warn', 'Invalid parameters for updateBudgetCache', { strategyId, budget }, 'TradeService');
      return;
    }

    try {
      // Update the budget in memory
      this.budgets.set(strategyId, budget);

      // Save to localStorage
      this.saveBudgets();

      // Log the update
      logService.log('info', `Budget cache updated for strategy ${strategyId}`, {
        budget,
        available: budget.available,
        allocated: budget.allocated,
        total: budget.total,
        profit: budget.profit || 0
      }, 'TradeService');

      // Update the budget in the database if not in demo mode
      if (!this.isDemo) {
        this.saveBudgetToDatabase(strategyId, budget)
          .catch(error => {
            logService.log('warn', `Failed to save updated budget to database for strategy ${strategyId}`, error, 'TradeService');
          });
      }
    } catch (error) {
      logService.log('error', `Error updating budget cache for strategy ${strategyId}`, error, 'TradeService');
    }
  }

  // Create and return a default budget for a new strategy.
  createDefaultBudget(): StrategyBudget {
    // In demo mode, use a larger budget to allow for multiple trades
    const isDemoMode = this.isDemo;
    const budgetAmount = isDemoMode ? 50000 : this.DEFAULT_BUDGET;

    // Log the budget creation
    logService.log('info', `Creating default budget in ${isDemoMode ? 'demo' : 'live'} mode: ${budgetAmount}`, null, 'TradeService');

    return {
      total: Number(budgetAmount.toFixed(2)),
      allocated: 0,
      available: Number(budgetAmount.toFixed(2)),
      maxPositionSize: Number((isDemoMode ? 0.2 : 0.1).toFixed(2)), // 20% max position in demo mode vs 10% in live
      lastUpdated: Date.now()
    };
  }

  /**
   * Save a budget to the database
   * @param strategyId The strategy ID
   * @param budget The budget to save
   */
  private async saveBudgetToDatabase(strategyId: string, budget: StrategyBudget): Promise<void> {
    try {
      // First, check if we have an active session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logService.log('warn', 'No active session found when saving budget to database', { strategyId }, 'TradeService');

        // Try to refresh the session
        try {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            logService.log('error', 'Failed to refresh session', refreshError, 'TradeService');
            // Continue anyway - we'll try to save the budget in memory
            return;
          }
        } catch (refreshError) {
          logService.log('error', 'Exception when refreshing session', refreshError, 'TradeService');
          return;
        }
      }

      // Check if the strategy_budgets table exists
      try {
        // Try a simple query to check if the table exists
        const { error: tableCheckError } = await supabase
          .from('strategy_budgets')
          .select('count(*)')
          .limit(1);

        if (tableCheckError) {
          if (tableCheckError.code === '42P01') { // PostgreSQL code for 'relation does not exist'
            logService.log('warn', 'Strategy budgets table does not exist, creating it now', null, 'TradeService');

            // Try to create the table
            try {
              // Use RPC to create the table if it doesn't exist
              await supabase.rpc('create_strategy_budgets_table_if_not_exists');
              logService.log('info', 'Created strategy_budgets table', null, 'TradeService');
            } catch (createError) {
              logService.log('error', 'Failed to create strategy_budgets table', createError, 'TradeService');
              return; // Exit early, we can't save to the database
            }
          } else if (tableCheckError.status === 406) {
            logService.log('warn', 'Authentication issue when checking strategy_budgets table', tableCheckError, 'TradeService');
            return; // Exit early, we can't save to the database
          } else {
            logService.log('error', 'Error checking strategy_budgets table', tableCheckError, 'TradeService');
            return; // Exit early, we can't save to the database
          }
        }
      } catch (tableCheckError) {
        logService.log('error', 'Exception when checking strategy_budgets table', tableCheckError, 'TradeService');
        return; // Exit early, we can't save to the database
      }

      // Check if the budget already exists in the database
      const { data, error: fetchError } = await supabase
        .from('strategy_budgets')
        .select('*')
        .eq('strategy_id', strategyId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid 406 errors

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No rows returned - this is fine, we'll create a new budget
          logService.log('info', `No existing budget found for strategy ${strategyId}`, null, 'TradeService');
        } else if (fetchError.status === 406) {
          // Not Acceptable - likely auth issue
          logService.log('warn', `Authentication issue when fetching budget for strategy ${strategyId}`, fetchError, 'TradeService');
          return; // Exit early, we can't save to the database
        } else {
          // Other error
          logService.log('error', `Error fetching budget for strategy ${strategyId}`, fetchError, 'TradeService');
          return; // Exit early, we can't save to the database
        }
      }

      if (data) {
        // Update existing budget
        const { error: updateError } = await supabase
          .from('strategy_budgets')
          .update({
            total: budget.total,
            allocated: budget.allocated,
            available: budget.available,
            max_position_size: budget.maxPositionSize,
            profit: budget.profit || 0,
            last_updated: new Date().toISOString()
          })
          .eq('strategy_id', strategyId);

        if (updateError) {
          if (updateError.status === 406) {
            logService.log('warn', `Authentication issue when updating budget for strategy ${strategyId}`, updateError, 'TradeService');
            return; // Exit early, we can't save to the database
          } else {
            logService.log('error', `Error updating budget for strategy ${strategyId}`, updateError, 'TradeService');
            return; // Exit early, we can't save to the database
          }
        }

        logService.log('info', `Updated budget in database for strategy ${strategyId}`, budget, 'TradeService');
      } else {
        // Insert new budget
        const { error: insertError } = await supabase
          .from('strategy_budgets')
          .insert({
            strategy_id: strategyId,
            total: budget.total,
            allocated: budget.allocated,
            available: budget.available,
            max_position_size: budget.maxPositionSize,
            profit: budget.profit || 0,
            last_updated: new Date().toISOString()
          });

        if (insertError) {
          if (insertError.status === 406) {
            logService.log('warn', `Authentication issue when inserting budget for strategy ${strategyId}`, insertError, 'TradeService');
            return; // Exit early, we can't save to the database
          } else {
            logService.log('error', `Error inserting budget for strategy ${strategyId}`, insertError, 'TradeService');
            return; // Exit early, we can't save to the database
          }
        }

        logService.log('info', `Inserted new budget in database for strategy ${strategyId}`, budget, 'TradeService');
      }
    } catch (error) {
      // Handle any unexpected errors
      logService.log('error', `Unexpected error saving budget to database for strategy ${strategyId}`, error, 'TradeService');
      // Don't throw the error, just log it and continue
    }
  }

  // Connect a strategy to the trading engine to start generating trades
  async connectStrategyToTradingEngine(strategyId: string): Promise<boolean> {
    try {
      // Initialize budget for this strategy first
      await this.initializeBudget(strategyId);

      // Import dynamically to avoid circular dependencies
      const { tradeEngine } = await import('./trade-engine');
      const { tradeGenerator } = await import('./trade-generator');

      // Get the strategy from the database first
      try {
        const { data: strategy, error: fetchError } = await supabase
          .from('strategies')
          .select('*')
          .eq('id', strategyId)
          .single();

        if (fetchError) {
          if (fetchError.status === 406) {
            logService.log('warn', `Authentication issue when fetching strategy ${strategyId}`, fetchError, 'TradeService');
            throw new Error(`Authentication issue when fetching strategy: ${fetchError.message}`);
          } else {
            throw fetchError;
          }
        }

        if (!strategy) {
          throw new Error(`Strategy ${strategyId} not found: No data returned`);
        }

        // Ensure the strategy is active
        if (strategy.status !== 'active') {
          logService.log('warn', `Strategy ${strategyId} is not active, updating status`, { currentStatus: strategy.status }, 'TradeService');

          try {
            // Update the strategy status to active
            const { data: updatedStrategy, error: updateError } = await supabase
              .from('strategies')
              .update({ status: 'active', updated_at: new Date().toISOString() })
              .eq('id', strategyId)
              .select()
              .single();

            if (updateError) {
              if (updateError.status === 406) {
                logService.log('warn', `Authentication issue when updating strategy status for ${strategyId}`, updateError, 'TradeService');
                throw new Error(`Authentication issue when updating strategy status: ${updateError.message}`);
              } else {
                throw updateError;
              }
            }

            if (!updatedStrategy) {
              throw new Error(`Failed to update strategy status: No data returned`);
            }

            // Use the updated strategy
            Object.assign(strategy, updatedStrategy);
          } catch (updateError) {
            logService.log('error', `Failed to update strategy status for ${strategyId}`, updateError, 'TradeService');
            throw updateError;
          }
        }

        // Add strategy to trade engine
        try {
          await tradeEngine.addStrategy(strategy);
        } catch (engineError) {
          logService.log('error', `Failed to add strategy ${strategyId} to trade engine`, engineError, 'TradeService');
          // Continue to try adding to trade generator even if trade engine fails
        }

        // Add strategy to trade generator
        try {
          await tradeGenerator.addStrategy(strategy);
        } catch (generatorError) {
          logService.log('error', `Failed to add strategy ${strategyId} to trade generator`, generatorError, 'TradeService');
          // Continue even if trade generator fails
        }

        logService.log('info', `Strategy ${strategyId} connected to trading engine`, null, 'TradeService');
        return true;
      } catch (dbError) {
        logService.log('error', `Database error when connecting strategy ${strategyId} to trading engine`, dbError, 'TradeService');
        throw dbError;
      }
    } catch (error) {
      logService.log('error', `Failed to connect strategy ${strategyId} to trading engine`, error, 'TradeService');
      return false;
    }
  }

  /**
   * Remove all trades for a specific strategy
   * @param strategyId The ID of the strategy to remove trades for
   */
  async removeTradesByStrategy(strategyId: string): Promise<boolean> {
    try {
      logService.log('info', `Removing trades for strategy ${strategyId}`, null, 'TradeService');

      // First let's cleanup any active trades
      const { data: activeTrades, error: fetchError } = await supabase
        .from('trades')
        .select('*')
        .eq('strategy_id', strategyId)
        .in('status', ['pending', 'open', 'executed']);

      if (fetchError) {
        throw new Error(`Error fetching active trades: ${fetchError.message}`);
      }

      // Close any active trades first and release budget
      if (activeTrades?.length > 0) {
        logService.log('info', `Found ${activeTrades.length} active trades to close for strategy ${strategyId}`, null, 'TradeService');

        for (const trade of activeTrades) {
          try {
            // Update trade status to closed
            const { error: updateError } = await supabase
              .from('trades')
              .update({
                status: 'closed',
                close_reason: 'Strategy deactivated',
                closed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', trade.id);

            if (updateError) {
              logService.log('warn', `Error updating trade ${trade.id}: ${updateError.message}`, null, 'TradeService');
              continue;
            }

            // Release budget for this trade
            if (trade.quantity && trade.price) {
              const tradeCost = trade.quantity * trade.price;
              this.releaseBudgetFromTrade(strategyId, tradeCost, 0, trade.id, 'closed');
              logService.log('info', `Released budget for trade ${trade.id}`, { tradeCost }, 'TradeService');
            }

            logService.log('info', `Closed trade ${trade.id} for strategy ${strategyId}`, null, 'TradeService');
          } catch (error) {
            logService.log('error', `Error closing trade ${trade.id}:`, error, 'TradeService');
          }
        }
      }

      // Now delete all trades for this strategy
      try {
        // First try using the database function if it exists
        const { error } = await supabase
          .rpc('delete_strategy_trades', { strategy_id: strategyId });

        if (error) {
          // If the function doesn't exist, fall back to direct deletion
          if (error.message && error.message.includes('does not exist')) {
            logService.log('info', 'delete_strategy_trades function not found, using direct deletion', null, 'TradeService');

            // Delete trades directly
            const { error: deleteError } = await supabase
              .from('trades')
              .delete()
              .eq('strategy_id', strategyId);

            if (deleteError) {
              throw new Error(`Error deleting trades: ${deleteError.message}`);
            }
          } else {
            throw error;
          }
        }

        logService.log('info', `Successfully deleted all trades for strategy ${strategyId}`, null, 'TradeService');
      } catch (deleteError) {
        logService.log('error', `Failed to delete trades for strategy ${strategyId}`, deleteError, 'TradeService');

        // Try one more time with a direct SQL query as a last resort
        try {
          const { error: sqlError } = await supabase.rpc('execute_sql', {
            query: `DELETE FROM trades WHERE strategy_id = '${strategyId}';`
          });

          if (sqlError) {
            throw sqlError;
          }

          logService.log('info', `Successfully deleted trades using SQL query for strategy ${strategyId}`, null, 'TradeService');
        } catch (sqlError) {
          logService.log('error', `Failed to delete trades using SQL query for strategy ${strategyId}`, sqlError, 'TradeService');
          // Continue even if this fails
        }
      }

      // Reset budget for this strategy
      try {
        // Clear the budget in memory
        this.budgets.delete(strategyId);
        this.saveBudgets();

        // Also try to delete from database if it exists
        await supabase
          .from('strategy_budgets')
          .delete()
          .eq('strategy_id', strategyId);

        logService.log('info', `Reset budget for strategy ${strategyId}`, null, 'TradeService');
      } catch (budgetError) {
        logService.log('warn', `Failed to reset budget for strategy ${strategyId}`, budgetError, 'TradeService');
        // Continue even if this fails
      }

      logService.log('info', `Successfully removed all trades for strategy ${strategyId}`, null, 'TradeService');
      return true;
    } catch (error) {
      logService.log('error', `Failed to remove trades for strategy ${strategyId}`, error, 'TradeService');
      return false;
    }
  }

  async updateBudgetAfterTrade(strategyId: string, amount: number, profit: number = 0, tradeId?: string, tradeStatus?: string): Promise<void> {
    try {
      const budget = this.budgets.get(strategyId);
      if (!budget) {
        throw new Error('Budget not found for strategy');
      }

      // Validate the amount is positive and reasonable
      if (!amount || amount <= 0) {
        logService.log('warn', `Invalid amount for budget update: ${amount}`, { tradeId, strategyId }, 'TradeService');
        return;
      }

      // Get trade details if tradeId is provided but tradeStatus is not
      if (tradeId && !tradeStatus) {
        try {
          const { data: trade, error } = await supabase
            .from('trades')
            .select('status')
            .eq('id', tradeId)
            .single();

          if (!error && trade) {
            tradeStatus = trade.status;
          }
        } catch (fetchError) {
          logService.log('warn', `Failed to fetch trade status: ${fetchError.message}`, { tradeId }, 'TradeService');
          // Continue with default behavior
        }
      }

      // Use the enhanced releaseBudgetFromTrade method which handles different trade statuses
      this.releaseBudgetFromTrade(strategyId, amount, profit, tradeId, tradeStatus);

      // Update database if not in demo mode
      if (!this.isDemo) {
        try {
          const currentBudget = this.budgets.get(strategyId);
          if (!currentBudget) return;

          const { error } = await supabase
            .from('strategy_budgets')
            .update({
              total: currentBudget.total,
              allocated: currentBudget.allocated,
              available: currentBudget.available,
              last_updated: new Date().toISOString()
            })
            .eq('strategy_id', strategyId);

          if (error) {
            // Check if the error is because the table doesn't exist
            if (error.code === '42P01') { // PostgreSQL code for 'relation does not exist'
              logService.log('warn', 'Strategy budgets table does not exist yet. This is normal if you haven\'t created it.', null, 'TradeService');
            } else {
              throw error;
            }
          }
        } catch (dbError) {
          logService.log('warn', `Error updating strategy_budgets table: ${dbError instanceof Error ? dbError.message : String(dbError)}`, null, 'TradeService');
        }
      }

      logService.log('info', `Updated budget after trade for strategy ${strategyId}${tradeId ? ` (trade: ${tradeId})` : ''} with status ${tradeStatus || 'unknown'}`,
        { budget: this.budgets.get(strategyId), amount, profit, tradeStatus }, 'TradeService');
    } catch (error) {
      logService.log('error', `Failed to update budget after trade for strategy ${strategyId}`, error, 'TradeService');
    }
  }

  /**
   * Update budget with profit/loss from a trade
   * This is a specialized method for handling profit/loss updates
   * @param strategyId The strategy ID
   * @param profit The profit/loss amount (positive for profit, negative for loss)
   * @param tradeId Optional trade ID for logging
   * @param tradeStatus Optional trade status
   */
  async updateBudgetWithProfit(strategyId: string, profit: number, tradeId?: string, tradeStatus?: string): Promise<void> {
    try {
      const budget = this.budgets.get(strategyId);
      if (!budget) {
        throw new Error(`Budget not found for strategy ${strategyId}`);
      }

      // Format the profit to 2 decimal places to avoid floating point issues
      const formattedProfit = Number(profit.toFixed(2));

      logService.log('info', `Updating budget with ${formattedProfit >= 0 ? 'profit' : 'loss'} for strategy ${strategyId}`, {
        profit: formattedProfit,
        tradeId,
        tradeStatus
      }, 'TradeService');

      // Create a copy of the budget to avoid direct mutation
      const updatedBudget = { ...budget };

      // Add profit to the budget
      updatedBudget.profit = (updatedBudget.profit || 0) + formattedProfit;

      // If the trade is closed or completed, also update the total and available budget
      if (tradeStatus === 'closed' || tradeStatus === 'completed') {
        // For closed trades, we add the profit to the total and available budget
        updatedBudget.total = Number((updatedBudget.total + formattedProfit).toFixed(2));
        updatedBudget.available = Number((updatedBudget.available + formattedProfit).toFixed(2));

        logService.log('info', `Updated total and available budget for closed trade`, {
          strategyId,
          tradeId,
          oldTotal: budget.total,
          newTotal: updatedBudget.total,
          oldAvailable: budget.available,
          newAvailable: updatedBudget.available,
          profit: formattedProfit
        }, 'TradeService');
      }

      // Update the budget in memory
      this.budgets.set(strategyId, updatedBudget);

      // Save to localStorage
      this.saveBudgets();

      // Emit budget updated event
      this.emit('budgetUpdated', {
        strategyId,
        budget: updatedBudget
      });

      // Also emit to the event bus for UI components
      eventBus.emit('budgetUpdated', {
        budgets: { [strategyId]: updatedBudget },
        availableBalance: this.calculateAvailableBudget()
      });

      // Emit global budget update event
      eventBus.emit('budget:global:updated', {
        strategyId,
        budget: updatedBudget,
        timestamp: Date.now()
      });

      // Update database if not in demo mode
      if (!this.isDemo) {
        try {
          const { error } = await supabase
            .from('strategy_budgets')
            .update({
              total: updatedBudget.total,
              allocated: updatedBudget.allocated,
              available: updatedBudget.available,
              profit: updatedBudget.profit || 0,
              last_updated: new Date().toISOString()
            })
            .eq('strategy_id', strategyId);

          if (error) {
            if (error.code === '42P01') { // PostgreSQL code for 'relation does not exist'
              logService.log('warn', 'Strategy budgets table does not exist yet', null, 'TradeService');
            } else {
              throw error;
            }
          }
        } catch (dbError) {
          logService.log('warn', `Error updating strategy_budgets table with profit`, dbError, 'TradeService');
        }
      }

      logService.log('info', `Successfully updated budget with ${formattedProfit >= 0 ? 'profit' : 'loss'} for strategy ${strategyId}`, {
        strategyId,
        tradeId,
        profit: formattedProfit,
        updatedBudget
      }, 'TradeService');
    } catch (error) {
      logService.log('error', `Failed to update budget with profit for strategy ${strategyId}`, error, 'TradeService');
    }
  }

  /**
   * Reset all active strategies when changing exchanges
   * This will deactivate all active strategies and close any open trades
   * @returns Promise<boolean> True if successful, false otherwise
   */
  async resetActiveStrategies(): Promise<boolean> {
    try {
      logService.log('info', 'Resetting all active strategies', null, 'TradeService');

      // Get all active strategies
      const { data: activeStrategies, error: fetchError } = await supabase
        .from('strategies')
        .select('*')
        .eq('status', 'active');

      if (fetchError) {
        throw new Error(`Error fetching active strategies: ${fetchError.message}`);
      }

      if (!activeStrategies || activeStrategies.length === 0) {
        logService.log('info', 'No active strategies found to reset', null, 'TradeService');
        return true;
      }

      // Import dynamically to avoid circular dependencies
      const { tradeEngine } = await import('./trade-engine');
      const { tradeGenerator } = await import('./trade-generator');

      // Process each active strategy
      for (const strategy of activeStrategies) {
        try {
          // Get all open trades for this strategy
          const { data: openTrades, error: tradesError } = await supabase
            .from('trades')
            .select('*')
            .eq('strategy_id', strategy.id)
            .in('status', ['pending', 'open']);

          if (tradesError) {
            throw new Error(`Error fetching open trades for strategy ${strategy.id}: ${tradesError.message}`);
          }

          // Close all open trades
          if (openTrades && openTrades.length > 0) {
            for (const trade of openTrades) {
              try {
                // Update trade status to closed
                await supabase
                  .from('trades')
                  .update({
                    status: 'closed',
                    close_reason: 'Exchange disconnected',
                    closed_at: new Date().toISOString()
                  })
                  .eq('id', trade.id);

                // Release budget for this trade
                const budget = this.getBudget(strategy.id);
                if (budget && trade.quantity && trade.price) {
                  const tradeAmount = trade.quantity * trade.price;
                  this.releaseBudgetFromTrade(strategy.id, tradeAmount, 0, trade.id, 'closed');
                }

                logService.log('info', `Closed trade ${trade.id} for strategy ${strategy.id}`, null, 'TradeService');
              } catch (closeError) {
                logService.log('error', `Error closing trade ${trade.id}`, closeError, 'TradeService');
              }
            }
          }

          // Update strategy status to inactive
          await supabase
            .from('strategies')
            .update({
              status: 'inactive',
              updated_at: new Date().toISOString()
            })
            .eq('id', strategy.id);

          // Remove strategy from trade engine and generator
          await tradeEngine.removeStrategy(strategy.id);
          await tradeGenerator.removeStrategy(strategy.id);

          logService.log('info', `Reset strategy ${strategy.id}`, null, 'TradeService');
        } catch (strategyError) {
          logService.log('error', `Error resetting strategy ${strategy.id}`, strategyError, 'TradeService');
        }
      }

      // Emit event for UI updates
      this.emit('strategies:reset');
      eventBus.emit('strategies:reset');

      return true;
    } catch (error) {
      logService.log('error', 'Failed to reset active strategies', error, 'TradeService');
      return false;
    }
  }

  /**
   * Create a trade directly in the database
   * @param tradeData The trade data to create
   * @returns The created trade
   */
  async createTrade(tradeData: any): Promise<any> {
    try {
      // Generate a UUID for the trade if not provided
      const tradeId = tradeData.id || uuidv4();

      // Prepare the trade data
      const trade = {
        id: tradeId,
        strategy_id: tradeData.strategy_id || tradeData.strategyId,
        symbol: tradeData.symbol,
        side: tradeData.side,
        quantity: tradeData.amount || tradeData.quantity,
        price: tradeData.price || tradeData.entry_price || tradeData.entryPrice,
        status: tradeData.status || 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          demo: this.isDemo,
          source: tradeData.source || 'trade-service',
          entry_price: tradeData.entry_price || tradeData.entryPrice || tradeData.price,
          stop_loss: tradeData.stop_loss || tradeData.stopLoss,
          take_profit: tradeData.take_profit || tradeData.takeProfit,
          trailing_stop: tradeData.trailing_stop || tradeData.trailingStop,
          entry_conditions: tradeData.entry_conditions || tradeData.entryConditions || [],
          exit_conditions: tradeData.exit_conditions || tradeData.exitConditions || [],
          rationale: tradeData.rationale || 'Trade created by trade service'
        }
      };

      // Insert the trade into the database
      const { data, error } = await supabase
        .from('trades')
        .insert(trade)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Reserve budget for this trade
      const tradeCost = trade.quantity * trade.price;
      this.reserveBudgetForTrade(trade.strategy_id, tradeCost, tradeId);

      // Emit trade created event
      eventBus.emit('trade:created', {
        trade: data
      });

      // Also emit to strategy-specific event
      eventBus.emit(`trade:created:${trade.strategy_id}`, {
        strategyId: trade.strategy_id,
        trade: data
      });

      logService.log('info', `Created trade for ${trade.symbol}`, { trade: data }, 'TradeService');
      return data;
    } catch (error) {
      logService.log('error', `Failed to create trade`, error, 'TradeService');
      throw error;
    }
  }

  async initializeBudget(strategyId: string): Promise<void> {
    try {
      // Check if we already have a budget for this strategy in memory
      if (this.budgets.has(strategyId)) {
        logService.log('info', `Budget already exists in memory for strategy ${strategyId}`, null, 'TradeService');
        return;
      }

      // Try to get the budget from the database
      try {
        const { data, error } = await supabase
          .from('strategy_budgets')
          .select('*')
          .eq('strategy_id', strategyId)
          .single();

        if (error) {
          // Check if the error is because the table doesn't exist
          if (error.code === '42P01') { // PostgreSQL code for 'relation does not exist'
            logService.log('warn', 'Strategy budgets table does not exist yet. This is normal if you haven\'t created it.', null, 'TradeService');
            throw new Error('Strategy budgets table does not exist');
          } else if (error.status === 406) { // Not Acceptable - likely auth issue
            logService.log('warn', `Authentication issue when fetching budget for strategy ${strategyId}`, error, 'TradeService');
            // Check auth status to help debug
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              logService.log('warn', 'No active session found when fetching budget', null, 'TradeService');
            } else {
              logService.log('info', 'Session exists but still got 406 error', {
                userId: session.user.id,
                expires: new Date(session.expires_at * 1000).toISOString()
              }, 'TradeService');
            }
            // Continue with default budget
            throw new Error('Authentication issue when accessing strategy_budgets table');
          } else if (error.code !== 'PGRST116') { // Not a 'no rows returned' error
            throw error;
          }
        }

        if (data) {
          // Budget exists in database, load it
          const budget = {
            total: Number(data.total),
            allocated: Number(data.allocated),
            available: Number(data.available),
            maxPositionSize: Number(data.max_position_size),
            profit: Number(data.profit || 0),
            lastUpdated: data.last_updated
          };

          this.budgets.set(strategyId, budget);
          logService.log('info', `Loaded budget from database for strategy ${strategyId}`, budget, 'TradeService');
          return;
        }
      } catch (dbError) {
        logService.log('warn', `Error accessing strategy_budgets table: ${dbError.message}`, null, 'TradeService');
      }

      // No budget in database or table doesn't exist, create a default one
      const defaultBudget = this.createDefaultBudget();

      // Try to save to database
      try {
        const { error: insertError } = await supabase
          .from('strategy_budgets')
          .insert({
            strategy_id: strategyId,
            total: defaultBudget.total,
            allocated: defaultBudget.allocated,
            available: defaultBudget.available,
            max_position_size: defaultBudget.maxPositionSize,
            profit: 0,
            last_updated: new Date().toISOString()
          });

        if (insertError) {
          // Check if the error is because the table doesn't exist
          if (insertError.code === '42P01') { // PostgreSQL code for 'relation does not exist'
            logService.log('warn', 'Strategy budgets table does not exist yet. This is normal if you haven\'t created it.', null, 'TradeService');
          } else {
            logService.log('warn', `Failed to save default budget to database for strategy ${strategyId}`, insertError, 'TradeService');
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logService.log('warn', `Exception when saving default budget to database for strategy ${strategyId}`, errorMessage, 'TradeService');
      }

      // Set in memory regardless of database success
      this.budgets.set(strategyId, defaultBudget);
      logService.log('info', `Created default budget for strategy ${strategyId}`, defaultBudget, 'TradeService');

      // Save to local storage
      this.saveBudgets();
    } catch (error) {
      logService.log('error', `Failed to initialize budget for strategy ${strategyId}`, error, 'TradeService');
      // Create a default budget even if there was an error
      const defaultBudget = this.createDefaultBudget();
      this.budgets.set(strategyId, defaultBudget);
      this.saveBudgets();
    }
  }
}

export const tradeService = TradeService.getInstance();
