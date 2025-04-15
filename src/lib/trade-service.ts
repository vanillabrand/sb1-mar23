import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import type { StrategyBudget } from './types';
import { eventBus } from './event-bus';

class TradeService extends EventEmitter {
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
          // Ensure all budget properties are properly formatted as numbers
          const formattedBudget = {
            ...budget as StrategyBudget,
            total: Number(((budget as StrategyBudget).total || 0).toFixed(2)),
            allocated: Number(((budget as StrategyBudget).allocated || 0).toFixed(2)),
            available: Number(((budget as StrategyBudget).available || 0).toFixed(2)),
            maxPositionSize: Number(((budget as StrategyBudget).maxPositionSize || 0).toFixed(2)),
            profit: Number(((budget as StrategyBudget).profit || 0).toFixed(2)),
            lastUpdated: (budget as StrategyBudget).lastUpdated || Date.now()
          };
          this.budgets.set(strategyId, formattedBudget);
          logService.log('info', `Loaded budget from localStorage for strategy ${strategyId}`, formattedBudget, 'TradeService');
        });
      } else {
        logService.log('info', 'No saved budgets found in localStorage', null, 'TradeService');
      }
      this.initialized = true;
    } catch (error) {
      console.warn('Failed to load saved budgets:', error);
      logService.log('error', 'Failed to load saved budgets from localStorage', error, 'TradeService');
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
    } else {
      // Format budget values to 2 decimal places.
      const formattedBudget = {
        ...budget,
        total: Number(budget.total.toFixed(2)),
        allocated: Number(budget.allocated.toFixed(2)),
        available: Number(budget.available.toFixed(2)),
        maxPositionSize: Number(budget.maxPositionSize.toFixed(2))
      };

      // Validate the budget configuration.
      if (!this.validateBudget(formattedBudget)) {
        throw new Error('Invalid budget configuration');
      }
      this.budgets.set(strategyId, formattedBudget);
    }

    this.saveBudgets();
    this.emit('budgetUpdated', { strategyId, budget });
    logService.log('info', `Budget ${budget ? 'set' : 'removed'} for strategy ${strategyId}`, budget, 'TradeService');
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
  releaseBudgetFromTrade(strategyId: string, amount: number, profit: number = 0, tradeId?: string): void {
    const budget = this.budgets.get(strategyId);
    if (!budget) {
      logService.log('warn', `No budget found for strategy ${strategyId}`, { tradeId }, 'TradeService');
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

    // Update budget: decrease allocated, increase available and total by profit.
    budget.allocated = Number((budget.allocated - formattedAmount).toFixed(2));
    budget.available = Number((budget.available + formattedAmount + formattedProfit).toFixed(2));
    budget.total = Number((budget.total + formattedProfit).toFixed(2));

    // Ensure we don't have negative values due to rounding or calculation errors
    if (budget.allocated < 0) budget.allocated = 0;

    // Update the last updated timestamp
    budget.lastUpdated = Date.now();

    this.budgets.set(strategyId, budget);
    this.saveBudgets();

    // Emit budget updated event
    this.emit('budgetUpdated', { strategyId, budget, tradeId });

    logService.log('info', `Released ${formattedAmount} (profit: ${formattedProfit}) for strategy ${strategyId}${tradeId ? ` (trade: ${tradeId})` : ''}`,
      { budget, tradeId }, 'TradeService');
  }

  /**
   * Release budget for a trade when closing it
   * @param strategyId The ID of the strategy
   * @param amount The amount to release
   */
  releaseBudget(strategyId: string, amount: number): void {
    // Just call releaseBudgetFromTrade with 0 profit
    this.releaseBudgetFromTrade(strategyId, amount, 0);
  }

  clearAllBudgets(): void {
    this.budgets.clear();
    this.saveBudgets();
    logService.log('info', 'All budgets cleared', null, 'TradeService');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // Create and return a default budget for a new strategy.
  createDefaultBudget(): StrategyBudget {
    // In demo mode, use a larger budget to allow for multiple trades
    const isDemoMode = this.isDemo;
    const budgetAmount = isDemoMode ? 50000 : this.DEFAULT_BUDGET;

    // Ensure values are properly formatted as numbers
    const total = Number(budgetAmount.toFixed(2));
    const allocated = 0;
    const available = Number(budgetAmount.toFixed(2));
    const maxPositionSize = Number((isDemoMode ? 0.2 : 0.1).toFixed(2)); // 20% max position in demo mode vs 10% in live
    const profit = 0;
    const lastUpdated = Date.now();

    // Log the budget creation
    logService.log('info', `Creating default budget in ${isDemoMode ? 'demo' : 'live'} mode: ${budgetAmount}`, null, 'TradeService');

    // Create the budget object with all required properties
    const budget: StrategyBudget = {
      total,
      allocated,
      available,
      maxPositionSize,
      profit,
      lastUpdated
    };

    return budget;
  }

  // Connect a strategy to the trading engine to start generating trades
  async connectStrategyToTradingEngine(strategyId: string): Promise<boolean> {
    try {
      // Import dynamically to avoid circular dependencies
      const { tradeEngine } = await import('./trade-engine');
      const { tradeGenerator } = await import('./trade-generator');

      // Get the strategy from the database first
      const { data: strategy, error: fetchError } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', strategyId)
        .single();

      if (fetchError || !strategy) {
        throw new Error(`Strategy ${strategyId} not found: ${fetchError?.message || 'No data returned'}`);
      }

      // Ensure the strategy is active
      if (strategy.status !== 'active') {
        logService.log('warn', `Strategy ${strategyId} is not active, updating status`, { currentStatus: strategy.status }, 'TradeService');

        // Update the strategy status to active
        const { data: updatedStrategy, error: updateError } = await supabase
          .from('strategies')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', strategyId)
          .select()
          .single();

        if (updateError || !updatedStrategy) {
          throw new Error(`Failed to update strategy status: ${updateError?.message || 'No data returned'}`);
        }

        // Use the updated strategy
        Object.assign(strategy, updatedStrategy);
      }

      // Add strategy to trade engine
      await tradeEngine.addStrategy(strategy);

      // Add strategy to trade generator
      await tradeGenerator.addStrategy(strategy);

      logService.log('info', `Strategy ${strategyId} connected to trading engine`, null, 'TradeService');
      return true;
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
      console.log(`TradeService: Removing trades for strategy ${strategyId}`);

      // First let's cleanup any active trades
      const { data: activeTrades, error: fetchError } = await supabase
        .from('trades')
        .select('*')
        .eq('strategy_id', strategyId)
        .in('status', ['pending', 'open']);

      if (fetchError) {
        throw new Error(`Error fetching active trades: ${fetchError.message}`);
      }

      // Close any active trades first
      if (activeTrades?.length > 0) {
        for (const trade of activeTrades) {
          try {
            // Update trade status to closed
            await supabase
              .from('trades')
              .update({
                status: 'closed',
                close_reason: 'Strategy deleted',
                closed_at: new Date().toISOString()
              })
              .eq('id', trade.id);
          } catch (error) {
            console.error(`Error closing trade ${trade.id}:`, error);
          }
        }
      }

      // Call the database function to handle deletion
      const { error } = await supabase
        .rpc('delete_strategy', { strategy_id: strategyId });

      if (error) {
        throw error;
      }

      logService.log('info', `Successfully removed strategy ${strategyId} and all related data`, null, 'TradeService');
      return true;
    } catch (error) {
      console.error(`Failed to remove strategy ${strategyId}:`, error);
      logService.log('error', `Failed to remove strategy ${strategyId}`, error, 'TradeService');
      return false;
    }
  }

  async updateBudgetAfterTrade(strategyId: string, amount: number, profit: number = 0, tradeId?: string): Promise<void> {
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

      const formattedAmount = Number(amount.toFixed(2));
      const formattedProfit = Number(profit.toFixed(2));

      // Update local budget
      const updatedBudget = {
        ...budget,
        allocated: Number((budget.allocated - formattedAmount).toFixed(2)),
        available: Number((budget.available + formattedAmount + formattedProfit).toFixed(2)),
        total: Number((budget.total + formattedProfit).toFixed(2)),
        lastUpdated: Date.now()
      };

      // Ensure we don't have negative values due to rounding or calculation errors
      if (updatedBudget.allocated < 0) updatedBudget.allocated = 0;

      // Update database
      try {
        const { error } = await supabase
          .from('strategy_budgets')
          .update({
            total: updatedBudget.total,
            allocated: updatedBudget.allocated,
            available: updatedBudget.available,
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

      // Update local cache
      this.budgets.set(strategyId, updatedBudget);

      // Emit update event
      this.emit('budgetUpdated', { strategyId, budget: updatedBudget });
      eventBus.emit('budget:updated', { strategyId, budget: updatedBudget });

      logService.log('info', `Updated budget after trade for strategy ${strategyId}`, {
        amount: formattedAmount,
        profit: formattedProfit,
        budget: updatedBudget
      }, 'TradeService');
    } catch (error) {
      logService.log('error', `Failed to update budget after trade for strategy ${strategyId}`, error, 'TradeService');
      throw error;
    }
  }

  async initializeBudget(strategyId: string): Promise<void> {
    try {
      // Check if we already have a budget for this strategy in memory
      if (this.budgets.has(strategyId)) {
        const existingBudget = this.budgets.get(strategyId);
        // Validate the budget to ensure it has all required properties
        if (existingBudget &&
            existingBudget.total !== undefined &&
            existingBudget.allocated !== undefined &&
            existingBudget.available !== undefined &&
            existingBudget.maxPositionSize !== undefined) {
          logService.log('info', `Budget already exists in memory for strategy ${strategyId}`, existingBudget, 'TradeService');
          return;
        } else {
          // Budget exists but is invalid, remove it and create a new one
          logService.log('warn', `Invalid budget found for strategy ${strategyId}, creating a new one`, existingBudget, 'TradeService');
          this.budgets.delete(strategyId);
        }
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
        const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
        logService.log('warn', `Error accessing strategy_budgets table: ${errorMessage}`, null, 'TradeService');
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
