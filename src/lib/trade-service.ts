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

  /**
   * Validate that the budget object has correct numeric values.
   * @param budget The budget to validate
   * @returns True if the budget is valid, false otherwise
   */
  private validateBudget(budget: StrategyBudget): boolean {
    if (!budget) return false;

    try {
      // Special case for deactivation - allow zero budget
      if (budget.total === 0 && budget.allocated === 0 && budget.available === 0 && budget.maxPositionSize === 0) {
        return true;
      }

      // Check required fields
      if (typeof budget.total !== 'number' || isNaN(budget.total)) return false;
      if (typeof budget.allocated !== 'number' || isNaN(budget.allocated)) return false;
      if (typeof budget.available !== 'number' || isNaN(budget.available)) return false;

      // Check for NaN values
      if (isNaN(budget.total) || isNaN(budget.allocated) || isNaN(budget.available) || isNaN(budget.maxPositionSize)) {
        logService.log('error', 'Budget contains NaN values', { budget }, 'TradeService');
        return false;
      }

      // Check for negative values
      if (budget.total < 0 || budget.allocated < 0 || budget.available < 0 || budget.maxPositionSize < 0) {
        logService.log('error', 'Budget contains negative values', { budget }, 'TradeService');
        return false;
      }

      // Check that available + allocated = total (with small rounding error tolerance)
      const sum = budget.available + budget.allocated;
      const diff = Math.abs(sum - budget.total);
      if (diff > 0.01) {
        logService.log('warn', `Budget validation failed: available (${budget.available}) + allocated (${budget.allocated}) != total (${budget.total})`,
          { diff, budget }, 'TradeService');
        return false;
      }

      // Normal budget validation
      const isValid = (
        budget.total > 0 &&
        budget.allocated >= 0 &&
        budget.available >= 0 &&
        budget.maxPositionSize > 0 &&
        budget.allocated + budget.available <= budget.total
      );

      if (!isValid) {
        logService.log('error', 'Budget validation failed', {
          budget,
          totalPositive: budget.total > 0,
          allocatedNonNegative: budget.allocated >= 0,
          availableNonNegative: budget.available >= 0,
          maxPositionSizePositive: budget.maxPositionSize > 0,
          sumCheck: budget.allocated + budget.available <= budget.total
        }, 'TradeService');
      }

      return isValid;
    } catch (error) {
      logService.log('error', 'Error validating budget', error, 'TradeService');
      return false;
    }
  }

  // Retrieve the budget for a given strategy.
  getBudget(strategyId: string): StrategyBudget | null {
    return this.budgets.get(strategyId) || null;
  }

  // Returns a copy of all budgets.
  getAllBudgets(): Map<string, StrategyBudget> {
    return new Map(this.budgets);
  }

  /**
   * Get all trades from the database
   * @param strategyId Optional strategy ID to filter trades
   * @param status Optional status to filter trades
   * @returns Promise<any[]> Array of trades
   */
  async getAllTrades(strategyId?: string, status?: string): Promise<any[]> {
    try {
      logService.log('info', 'Fetching all trades', { strategyId, status }, 'TradeService');

      // Build the query
      let query = supabase.from('trades').select('*');

      // Add filters if provided
      if (strategyId) {
        query = query.eq('strategy_id', strategyId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      // Order by created_at descending (newest first)
      query = query.order('created_at', { ascending: false });

      // Execute the query
      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logService.log('error', 'Failed to fetch trades', error, 'TradeService');
      return [];
    }
  }



  /**
   * Simple version of updateBudgetCache for basic updates
   * @param strategyId The strategy ID
   * @param budget The updated budget
   */
  updateBudgetCache(strategyId: string, budget: StrategyBudget): void {
    // Call the more comprehensive version with default parameters
    this.updateBudgetCacheWithOptions(strategyId, budget, false);
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
  reserveBudgetForTrade(strategyId: string, amount: number, tradeId?: string, marketType: string = 'spot'): boolean {
    // Get the budget for this strategy
    const budget = this.budgets.get(strategyId);
    if (!budget) {
      logService.log('warn', `No budget found for strategy ${strategyId}`, null, 'TradeService');
      return false;
    }

    // Validate the amount is positive and reasonable
    if (isNaN(amount) || !amount || amount <= 0) {
      logService.log('warn', `Invalid amount for budget reservation: ${amount}`, { tradeId, strategyId }, 'TradeService');

      // In demo mode, we can use a small default amount
      if (this.isDemo) {
        amount = 10; // Use a small default amount in demo mode
        logService.log('info', `Using default amount ${amount} for budget reservation in demo mode`, { tradeId, strategyId }, 'TradeService');
      } else {
        return false;
      }
    }

    // Format the amount to 2 decimal places to avoid floating point issues
    const formattedAmount = Number(amount.toFixed(2));

    // Ensure budget values are valid numbers
    if (isNaN(budget.available) || isNaN(budget.allocated) || isNaN(budget.total)) {
      logService.log('error', `Invalid budget values for strategy ${strategyId}`,
        { budget, tradeId, strategyId }, 'TradeService');

      // Try to fix the budget
      budget.available = Number((budget.available || 0).toFixed(2));
      budget.allocated = Number((budget.allocated || 0).toFixed(2));
      budget.total = Number((budget.total || 0).toFixed(2));

      // If we still have invalid values, fail the reservation
      if (isNaN(budget.available) || isNaN(budget.allocated) || isNaN(budget.total)) {
        return false;
      }
    }

    // Check if we have enough available budget
    if (budget.available < formattedAmount) {
      logService.log('warn', `Insufficient budget for trade: ${formattedAmount} (available: ${budget.available})`,
        { tradeId, strategyId, amount: formattedAmount, available: budget.available }, 'TradeService');
      return false;
    }

    // Update the overall budget
    budget.available = Number((budget.available - formattedAmount).toFixed(2));
    budget.allocated = Number((budget.allocated + formattedAmount).toFixed(2));

    // Ensure we don't have negative values due to rounding
    if (budget.available < 0) budget.available = 0;

    // Ensure allocated doesn't exceed total
    if (budget.allocated > budget.total) {
      logService.log('warn', `Allocated budget (${budget.allocated}) exceeds total (${budget.total}) for strategy ${strategyId}`,
        { budget, tradeId, strategyId }, 'TradeService');
      budget.allocated = budget.total;
    }

    // Initialize market type balances if they don't exist
    if (!budget.marketTypeBalances) {
      budget.marketTypeBalances = {
        spot: { total: 0, allocated: 0, available: 0, profit: 0, trades: 0 },
        margin: { total: 0, allocated: 0, available: 0, profit: 0, trades: 0 },
        futures: { total: 0, allocated: 0, available: 0, profit: 0, trades: 0 }
      };

      // Set the current market type to have the full budget
      const currentMarketType = budget.marketType || marketType || 'spot';
      budget.marketTypeBalances[currentMarketType] = {
        total: budget.total,
        allocated: 0,
        available: budget.total,
        profit: 0,
        trades: 0
      };
    }

    // Ensure the market type exists in the balances
    if (!budget.marketTypeBalances[marketType]) {
      budget.marketTypeBalances[marketType] = {
        total: 0,
        allocated: 0,
        available: 0,
        profit: 0,
        trades: 0
      };
    }

    // Update the market type specific balance
    const marketTypeBalance = budget.marketTypeBalances[marketType];

    // If this is the first trade for this market type, allocate some budget to it
    if (marketTypeBalance.total === 0) {
      // Allocate a portion of the total budget to this market type
      const marketTypeTotal = Math.min(budget.total * 0.3, formattedAmount * 2); // 30% of total or 2x the trade amount, whichever is smaller
      marketTypeBalance.total = Number(marketTypeTotal.toFixed(2));
      marketTypeBalance.available = Number((marketTypeTotal - formattedAmount).toFixed(2));
    } else {
      // Update existing market type balance
      marketTypeBalance.available = Number((marketTypeBalance.available - formattedAmount).toFixed(2));

      // Ensure we don't have negative values
      if (marketTypeBalance.available < 0) {
        // If available goes negative, increase the total for this market type
        const additionalFunds = Math.abs(marketTypeBalance.available) + formattedAmount;
        marketTypeBalance.total = Number((marketTypeBalance.total + additionalFunds).toFixed(2));
        marketTypeBalance.available = Number(formattedAmount.toFixed(2));
      }
    }

    marketTypeBalance.allocated = Number((marketTypeBalance.allocated + formattedAmount).toFixed(2));
    marketTypeBalance.trades++;

    // Save the updated budget
    this.budgets.set(strategyId, budget);
    this.saveBudgets();

    // Emit budget updated event
    this.emit('budgetUpdated', { strategyId, budget, tradeId, marketType });
    logService.log('info', `Reserved ${formattedAmount} for strategy ${strategyId} in ${marketType} market${tradeId ? ` (trade: ${tradeId})` : ''}`,
      { budget, tradeId, marketType }, 'TradeService');
    return true;
  }

  // Release reserved budget from a trade, applying any profit gained.
  async releaseBudgetFromTrade(strategyId: string, amount: number, profit: number = 0, tradeId?: string, tradeStatus?: string, marketType: string = 'spot'): Promise<void> {
    try {
      // Validate inputs
      if (!strategyId) {
        logService.log('error', 'Missing strategy ID for budget release', { tradeId }, 'TradeService');
        return;
      }

      // Validate amount and profit
      if (isNaN(amount)) {
        logService.log('warn', `Invalid amount for budget release: ${amount} (NaN)`, { tradeId, strategyId }, 'TradeService');
        amount = 0; // Use 0 as fallback to avoid NaN propagation
      }

      if (isNaN(profit)) {
        logService.log('warn', `Invalid profit for budget release: ${profit} (NaN)`, { tradeId, strategyId }, 'TradeService');
        profit = 0; // Use 0 as fallback to avoid NaN propagation
      }

      // Get the budget
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

      // Ensure budget values are valid numbers
      if (isNaN(updatedBudget.available) || isNaN(updatedBudget.allocated) || isNaN(updatedBudget.total)) {
        logService.log('error', `Invalid budget values for strategy ${strategyId}`,
          { budget: updatedBudget, tradeId, strategyId }, 'TradeService');

        // Try to fix the budget
        updatedBudget.available = Number((updatedBudget.available || 0).toFixed(2));
        updatedBudget.allocated = Number((updatedBudget.allocated || 0).toFixed(2));
        updatedBudget.total = Number((updatedBudget.total || 0).toFixed(2));

        // If we still have invalid values, fail the release
        if (isNaN(updatedBudget.available) || isNaN(updatedBudget.allocated) || isNaN(updatedBudget.total)) {
          logService.log('error', `Cannot fix invalid budget values for strategy ${strategyId}`,
            { budget: updatedBudget, tradeId, strategyId }, 'TradeService');
          return;
        }
      }

      // Validate the amount is positive and reasonable
      if (amount <= 0) {
        logService.log('warn', `Invalid amount for budget release: ${amount}`, { tradeId, strategyId }, 'TradeService');
        amount = 0; // Use 0 to avoid negative values
      }

      // Format the values to 2 decimal places to avoid floating point issues
      const formattedAmount = Number(amount.toFixed(2));
      const formattedProfit = Number(profit.toFixed(2));

      // If tradeId is provided but tradeStatus is not, try to get the status and market type from the database
      if (tradeId && (!tradeStatus || !marketType)) {
        try {
          const { data: trade, error } = await supabase
            .from('trades')
            .select('status, market_type, metadata')
            .eq('id', tradeId)
            .single();

          if (!error && trade) {
            if (!tradeStatus) {
              tradeStatus = trade.status;
              logService.log('info', `Retrieved trade status for ${tradeId}: ${tradeStatus}`, null, 'TradeService');
            }

            // Get market type from trade data
            if (!marketType || marketType === 'spot') {
              if (trade.market_type) {
                marketType = trade.market_type;
              } else if (trade.metadata?.marketType) {
                marketType = trade.metadata.marketType;
              }
              logService.log('info', `Retrieved market type for ${tradeId}: ${marketType}`, null, 'TradeService');
            }
          }
        } catch (fetchError) {
          logService.log('warn', `Failed to fetch trade data: ${fetchError.message}`, { tradeId }, 'TradeService');
          // Continue with default behavior
        }
      }

      // Initialize market type balances if they don't exist
      if (!updatedBudget.marketTypeBalances) {
        updatedBudget.marketTypeBalances = {
          spot: { total: 0, allocated: 0, available: 0, profit: 0, trades: 0 },
          margin: { total: 0, allocated: 0, available: 0, profit: 0, trades: 0 },
          futures: { total: 0, allocated: 0, available: 0, profit: 0, trades: 0 }
        };

        // Set the current market type to have the full budget
        const currentMarketType = updatedBudget.marketType || marketType || 'spot';
        updatedBudget.marketTypeBalances[currentMarketType] = {
          total: updatedBudget.total,
          allocated: updatedBudget.allocated,
          available: updatedBudget.available,
          profit: updatedBudget.profit || 0,
          trades: 1
        };
      }

      // Ensure the market type exists in the balances
      if (!updatedBudget.marketTypeBalances[marketType]) {
        updatedBudget.marketTypeBalances[marketType] = {
          total: formattedAmount,
          allocated: formattedAmount,
          available: 0,
          profit: 0,
          trades: 1
        };
      }

      // Log the budget before update for debugging
      logService.log('debug', `Budget before release for strategy ${strategyId}`,
        {
          budget: updatedBudget,
          tradeId,
          amount: formattedAmount,
          profit: formattedProfit,
          tradeStatus,
          marketType
        }, 'TradeService');

      // Update budget based on trade status
      if (tradeStatus === 'cancelled' || tradeStatus === 'rejected') {
        // For cancelled/rejected trades, just return the allocated amount to available
        // Ensure we don't subtract more than what's allocated
        const amountToRelease = Math.min(formattedAmount, updatedBudget.allocated);
        updatedBudget.allocated = Number((updatedBudget.allocated - amountToRelease).toFixed(2));
        updatedBudget.available = Number((updatedBudget.available + amountToRelease).toFixed(2));
        // No change to total budget

        // Update market type balance
        const marketTypeBalance = updatedBudget.marketTypeBalances[marketType];
        const marketTypeAmountToRelease = Math.min(formattedAmount, marketTypeBalance.allocated);
        marketTypeBalance.allocated = Number((marketTypeBalance.allocated - marketTypeAmountToRelease).toFixed(2));
        marketTypeBalance.available = Number((marketTypeBalance.available + marketTypeAmountToRelease).toFixed(2));
        if (marketTypeBalance.trades > 0) marketTypeBalance.trades--;

        logService.log('info', `Released ${amountToRelease} for cancelled/rejected trade ${tradeId} in ${marketType} market`,
          { allocated: updatedBudget.allocated, available: updatedBudget.available, marketTypeBalance }, 'TradeService');
      } else if (tradeStatus === 'closed') {
        // For closed trades, return allocated amount plus profit
        // Ensure we don't subtract more than what's allocated
        const amountToRelease = Math.min(formattedAmount, updatedBudget.allocated);
        updatedBudget.allocated = Number((updatedBudget.allocated - amountToRelease).toFixed(2));
        updatedBudget.available = Number((updatedBudget.available + amountToRelease + formattedProfit).toFixed(2));
        updatedBudget.total = Number((updatedBudget.total + formattedProfit).toFixed(2));
        updatedBudget.profit = Number(((updatedBudget.profit || 0) + formattedProfit).toFixed(2));

        // Update market type balance
        const marketTypeBalance = updatedBudget.marketTypeBalances[marketType];
        const marketTypeAmountToRelease = Math.min(formattedAmount, marketTypeBalance.allocated);
        marketTypeBalance.allocated = Number((marketTypeBalance.allocated - marketTypeAmountToRelease).toFixed(2));
        marketTypeBalance.available = Number((marketTypeBalance.available + marketTypeAmountToRelease + formattedProfit).toFixed(2));
        marketTypeBalance.total = Number((marketTypeBalance.total + formattedProfit).toFixed(2));
        marketTypeBalance.profit = Number((marketTypeBalance.profit + formattedProfit).toFixed(2));
        if (marketTypeBalance.trades > 0) marketTypeBalance.trades--;

        logService.log('info', `Released ${amountToRelease} with profit ${formattedProfit} for closed trade ${tradeId} in ${marketType} market`,
          { allocated: updatedBudget.allocated, available: updatedBudget.available, total: updatedBudget.total, marketTypeBalance }, 'TradeService');
      } else {
        // Default behavior for other statuses
        // Ensure we don't subtract more than what's allocated
        const amountToRelease = Math.min(formattedAmount, updatedBudget.allocated);
        updatedBudget.allocated = Number((updatedBudget.allocated - amountToRelease).toFixed(2));
        updatedBudget.available = Number((updatedBudget.available + amountToRelease + formattedProfit).toFixed(2));
        updatedBudget.total = Number((updatedBudget.total + formattedProfit).toFixed(2));
        updatedBudget.profit = Number(((updatedBudget.profit || 0) + formattedProfit).toFixed(2));

        // Update market type balance
        const marketTypeBalance = updatedBudget.marketTypeBalances[marketType];
        const marketTypeAmountToRelease = Math.min(formattedAmount, marketTypeBalance.allocated);
        marketTypeBalance.allocated = Number((marketTypeBalance.allocated - marketTypeAmountToRelease).toFixed(2));
        marketTypeBalance.available = Number((marketTypeBalance.available + marketTypeAmountToRelease + formattedProfit).toFixed(2));
        marketTypeBalance.total = Number((marketTypeBalance.total + formattedProfit).toFixed(2));
        marketTypeBalance.profit = Number((marketTypeBalance.profit + formattedProfit).toFixed(2));
        if (marketTypeBalance.trades > 0) marketTypeBalance.trades--;

        logService.log('info', `Released ${amountToRelease} with profit ${formattedProfit} for trade ${tradeId} with status ${tradeStatus || 'unknown'} in ${marketType} market`,
          { allocated: updatedBudget.allocated, available: updatedBudget.available, total: updatedBudget.total, marketTypeBalance }, 'TradeService');
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
   * Update budget with profit/loss from a trade with status
   * @param strategyId The ID of the strategy
   * @param profit The profit/loss amount
   * @param tradeId The ID of the trade
   * @param status The status of the trade
   * @returns True if successful, false otherwise
   */
  async updateBudgetWithProfitAndStatus(
    strategyId: string,
    profit: number,
    tradeId: string,
    status: string = 'closed'
  ): Promise<boolean> {
    try {
      // Format the profit to 2 decimal places
      const formattedProfit = Number(profit.toFixed(2));

      // Call releaseBudgetFromTrade with 0 amount and the profit
      await this.releaseBudgetFromTrade(strategyId, 0, formattedProfit, tradeId, status);

      logService.log('info', `Updated budget for strategy ${strategyId} with profit ${formattedProfit}`,
        { tradeId, status }, 'TradeService');
      return true;
    } catch (error) {
      logService.log('error', `Failed to update budget with profit for strategy ${strategyId}`, error, 'TradeService');
      return false;
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
   * Update the budget cache for a strategy with advanced options
   * This method is used to ensure consistency across all components
   * @param strategyId The strategy ID
   * @param budget The updated budget
   * @param skipEvents Optional flag to skip emitting events (to prevent loops)
   */
  updateBudgetCacheWithOptions(strategyId: string, budget: StrategyBudget, skipEvents: boolean = false): void {
    if (!strategyId || !budget) {
      logService.log('warn', 'Invalid parameters for updateBudgetCache', { strategyId, budget }, 'TradeService');
      return;
    }

    try {
      // Check if we're already processing a budget update for this strategy
      const lastUpdate = this.budgetUpdatesInProgress.get(strategyId) || 0;
      const now = Date.now();

      // If we've updated this budget recently, throttle the update to prevent loops
      if (now - lastUpdate < this.BUDGET_UPDATE_THROTTLE_MS) {
        // Only log this occasionally to avoid log spam
        if (now % 10 === 0) {
          logService.log('debug', `Throttling budget update for strategy ${strategyId} to prevent loops`, null, 'TradeService');
        }
        return;
      }

      // Mark this strategy as having a budget update in progress
      this.budgetUpdatesInProgress.set(strategyId, now);

      // Validate and fix budget values if needed
      const validatedBudget = this.validateAndFixBudget(budget);

      // Get the current budget to check if anything has actually changed
      const currentBudget = this.budgets.get(strategyId);

      // Only proceed with the update if the budget has actually changed
      const hasChanged = !currentBudget ||
        currentBudget.total !== validatedBudget.total ||
        currentBudget.allocated !== validatedBudget.allocated ||
        currentBudget.available !== validatedBudget.available ||
        currentBudget.maxPositionSize !== validatedBudget.maxPositionSize;

      if (!hasChanged) {
        // Budget hasn't changed, no need to update or emit events
        return;
      }

      // Update the budget in memory
      this.budgets.set(strategyId, validatedBudget);

      // Save to localStorage
      this.saveBudgets();

      // Log the update
      logService.log('info', `Budget cache updated for strategy ${strategyId}`, {
        budget: validatedBudget,
        available: validatedBudget.available,
        allocated: validatedBudget.allocated,
        total: validatedBudget.total,
        profit: validatedBudget.profit || 0
      }, 'TradeService');

      // Update the budget in the database if not in demo mode
      if (!this.isDemo) {
        this.saveBudgetToDatabase(strategyId, validatedBudget)
          .catch(error => {
            logService.log('warn', `Failed to save updated budget to database for strategy ${strategyId}`, error, 'TradeService');
          });
      }

      // Only emit events if not explicitly skipped
      if (!skipEvents) {
        // Emit budget updated event
        this.emit('budgetUpdated', { strategyId, budget: validatedBudget });
        eventBus.emit('budget:updated', { strategyId, budget: validatedBudget });
        eventBus.emit(`budget:updated:${strategyId}`, {
          strategyId,
          budget: validatedBudget,
          timestamp: now
        });
      }
    } catch (error) {
      logService.log('error', `Error updating budget cache for strategy ${strategyId}`, error, 'TradeService');
    } finally {
      // Clear the in-progress flag after a delay to allow other updates to be throttled
      setTimeout(() => {
        this.budgetUpdatesInProgress.delete(strategyId);
      }, this.BUDGET_UPDATE_THROTTLE_MS);
    }
  }

  // Pending budget updates for throttled updates
  private pendingBudgetUpdates: Map<string, { budget: StrategyBudget, timestamp: number }> = new Map();
  private throttledUpdateTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Throttled version of updateBudgetCache that batches updates
   * This is useful for components that need to update budgets frequently
   * @param strategyId The strategy ID
   * @param budget The updated budget
   * @param skipEvents Optional flag to skip emitting events
   */
  throttledUpdateBudgetCache(strategyId: string, budget: StrategyBudget, skipEvents: boolean = false): void {
    if (!strategyId || !budget) {
      return;
    }

    // Store the latest budget update
    this.pendingBudgetUpdates.set(strategyId, {
      budget,
      timestamp: Date.now()
    });

    // Clear any existing timeout
    const existingTimeout = this.throttledUpdateTimeouts.get(strategyId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set a new timeout to process the update
    const timeout = setTimeout(() => {
      try {
        // Get the latest pending update
        const pendingUpdate = this.pendingBudgetUpdates.get(strategyId);
        if (pendingUpdate) {
          // Process the update
          this.updateBudgetCache(strategyId, pendingUpdate.budget, skipEvents);

          // Clear the pending update
          this.pendingBudgetUpdates.delete(strategyId);
        }
      } catch (error) {
        logService.log('error', `Error in throttled budget update for strategy ${strategyId}`, error, 'TradeService');
      } finally {
        // Clear the timeout reference
        this.throttledUpdateTimeouts.delete(strategyId);
      }
    }, 2000); // 2 second throttle

    // Store the timeout reference
    this.throttledUpdateTimeouts.set(strategyId, timeout);
  }

  // Track budget updates in progress to prevent infinite loops
  private budgetUpdatesInProgress: Map<string, number> = new Map();
  private readonly BUDGET_UPDATE_THROTTLE_MS = 500; // Throttle budget updates to once per 500ms per strategy

  /**
   * Validate and fix budget values to ensure they are consistent
   * @param budget The budget to validate and fix
   * @returns The validated and fixed budget
   */
  private validateAndFixBudget(budget: StrategyBudget): StrategyBudget {
    try {
      // Create a deep copy to avoid modifying the original
      const fixedBudget = JSON.parse(JSON.stringify(budget));

      // Only log at debug level if we're not in a loop
      const strategyId = budget.strategy_id || '';
      const lastUpdate = this.budgetUpdatesInProgress.get(strategyId) || 0;
      const now = Date.now();

      if (now - lastUpdate > this.BUDGET_UPDATE_THROTTLE_MS) {
        logService.log('debug', 'Validating and fixing budget', {
          original: budget,
          hasNaN: {
            total: isNaN(budget.total),
            allocated: isNaN(budget.allocated),
            available: isNaN(budget.available),
            maxPositionSize: isNaN(budget.maxPositionSize)
          }
        }, 'TradeService');
      }

      // Fix NaN and undefined values
      if (isNaN(fixedBudget.total) || fixedBudget.total === undefined) fixedBudget.total = 0;
      if (isNaN(fixedBudget.allocated) || fixedBudget.allocated === undefined) fixedBudget.allocated = 0;
      if (isNaN(fixedBudget.available) || fixedBudget.available === undefined) fixedBudget.available = 0;
      if (isNaN(fixedBudget.maxPositionSize) || fixedBudget.maxPositionSize === undefined) fixedBudget.maxPositionSize = 0.1;

      // Convert string values to numbers if needed
      fixedBudget.total = typeof fixedBudget.total === 'string' ? parseFloat(fixedBudget.total) : fixedBudget.total;
      fixedBudget.allocated = typeof fixedBudget.allocated === 'string' ? parseFloat(fixedBudget.allocated) : fixedBudget.allocated;
      fixedBudget.available = typeof fixedBudget.available === 'string' ? parseFloat(fixedBudget.available) : fixedBudget.available;
      fixedBudget.maxPositionSize = typeof fixedBudget.maxPositionSize === 'string' ? parseFloat(fixedBudget.maxPositionSize) : fixedBudget.maxPositionSize;

      // Check again for NaN after conversion
      if (isNaN(fixedBudget.total)) fixedBudget.total = 0;
      if (isNaN(fixedBudget.allocated)) fixedBudget.allocated = 0;
      if (isNaN(fixedBudget.available)) fixedBudget.available = 0;
      if (isNaN(fixedBudget.maxPositionSize)) fixedBudget.maxPositionSize = 0.1;

      // Format to 2 decimal places
      fixedBudget.total = Number(Number(fixedBudget.total).toFixed(2));
      fixedBudget.allocated = Number(Number(fixedBudget.allocated).toFixed(2));
      fixedBudget.available = Number(Number(fixedBudget.available).toFixed(2));
      fixedBudget.maxPositionSize = Number(Number(fixedBudget.maxPositionSize).toFixed(2));

      // Ensure non-negative values
      if (fixedBudget.total < 0) fixedBudget.total = 0;
      if (fixedBudget.allocated < 0) fixedBudget.allocated = 0;
      if (fixedBudget.available < 0) fixedBudget.available = 0;
      if (fixedBudget.maxPositionSize < 0) fixedBudget.maxPositionSize = 0.1;

      // Ensure consistency between total, allocated, and available
      const sum = fixedBudget.allocated + fixedBudget.available;

      // If total is 0 but we have allocated funds, set a reasonable total
      if (fixedBudget.total === 0 && fixedBudget.allocated > 0) {
        fixedBudget.total = fixedBudget.allocated;
        fixedBudget.available = 0;
        logService.log('warn', 'Fixed budget inconsistency: total was 0 but allocated funds exist',
          { original: budget, fixed: fixedBudget }, 'TradeService');
      }
      // If sum exceeds total, adjust available to maintain consistency
      else if (sum > fixedBudget.total) {
        fixedBudget.available = Math.max(0, fixedBudget.total - fixedBudget.allocated);
        logService.log('warn', 'Fixed budget inconsistency: sum of allocated and available exceeded total',
          { original: budget, fixed: fixedBudget }, 'TradeService');
      }
      // If sum is less than total and total is positive, adjust available to match total
      else if (sum < fixedBudget.total && fixedBudget.total > 0) {
        fixedBudget.available = Number((fixedBudget.total - fixedBudget.allocated).toFixed(2));
        logService.log('warn', 'Fixed budget inconsistency: sum of allocated and available was less than total',
          { original: budget, fixed: fixedBudget }, 'TradeService');
      }

      // If we have a demo mode with no budget, set a default
      if (this.isDemo && fixedBudget.total === 0) {
        fixedBudget.total = 10000;
        fixedBudget.available = 10000;
        fixedBudget.allocated = 0;
        fixedBudget.maxPositionSize = 0.2;
        logService.log('info', 'Created default demo budget', { fixed: fixedBudget }, 'TradeService');
      }

      // Update timestamp
      fixedBudget.lastUpdated = Date.now();

      // Log the fixed budget
      logService.log('debug', 'Budget validation complete', {
        original: budget,
        fixed: fixedBudget,
        changes: {
          total: budget.total !== fixedBudget.total,
          allocated: budget.allocated !== fixedBudget.allocated,
          available: budget.available !== fixedBudget.available,
          maxPositionSize: budget.maxPositionSize !== fixedBudget.maxPositionSize
        }
      }, 'TradeService');

      return fixedBudget;
    } catch (error) {
      // If anything goes wrong, return a safe default budget
      logService.log('error', 'Error validating budget, returning safe default', { error, budget }, 'TradeService');

      return {
        total: 10000,
        allocated: 0,
        available: 10000,
        maxPositionSize: 0.1,
        lastUpdated: Date.now(),
        marketType: budget.marketType || 'spot',
        market_type: budget.market_type || 'spot',
        marketTypeBalances: {
          spot: { allocated: 0, available: 10000, trades: 0 },
          margin: { allocated: 0, available: 0, trades: 0 },
          futures: { allocated: 0, available: 0, trades: 0 }
        }
      };
    }
  }

  // Create and return a default budget for a new strategy.
  createDefaultBudget(marketType: string = 'spot'): StrategyBudget {
    // In demo mode, use a larger budget to allow for multiple trades
    const isDemoMode = this.isDemo;
    const budgetAmount = isDemoMode ? 50000 : this.DEFAULT_BUDGET;

    // Log the budget creation
    logService.log('info', `Creating default budget in ${isDemoMode ? 'demo' : 'live'} mode: ${budgetAmount} for market type ${marketType}`,
      { marketType }, 'TradeService');

    // Create default market type balances
    const marketTypeBalances: any = {
      spot: {
        total: 0,
        allocated: 0,
        available: 0,
        profit: 0,
        trades: 0
      },
      margin: {
        total: 0,
        allocated: 0,
        available: 0,
        profit: 0,
        trades: 0
      },
      futures: {
        total: 0,
        allocated: 0,
        available: 0,
        profit: 0,
        trades: 0
      }
    };

    // Set the specified market type to have the full budget
    marketTypeBalances[marketType] = {
      total: Number(budgetAmount.toFixed(2)),
      allocated: 0,
      available: Number(budgetAmount.toFixed(2)),
      profit: 0,
      trades: 0
    };

    return {
      total: Number(budgetAmount.toFixed(2)),
      allocated: 0,
      available: Number(budgetAmount.toFixed(2)),
      maxPositionSize: Number((isDemoMode ? 0.2 : 0.1).toFixed(2)), // 20% max position in demo mode vs 10% in live
      lastUpdated: Date.now(),
      marketType: marketType as MarketType,
      market_type: marketType as MarketType,
      marketTypeBalances
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
  async resetActiveStrategiesWithResult(): Promise<boolean> {
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

  /**
   * Generate trades for a strategy using DeepSeek AI
   * @param strategy The strategy to generate trades for
   * @returns Array of generated trades
   */
  async generateTradesForStrategy(strategy: any): Promise<any[]> {
    try {
      if (!strategy || !strategy.id) {
        logService.log('error', 'Invalid strategy provided for trade generation', { strategy }, 'TradeService');
        return [];
      }

      logService.log('info', `Generating trades for strategy ${strategy.id}`, {
        strategyName: strategy.name || strategy.title,
        marketType: strategy.market_type || strategy.marketType,
        status: strategy.status
      }, 'TradeService');

      // Check if strategy is active
      if (strategy.status !== 'active') {
        logService.log('info', `Strategy ${strategy.id} is not active, skipping trade generation`, null, 'TradeService');
        return [];
      }

      // Get budget for this strategy
      const budget = this.getBudget(strategy.id);
      if (!budget || budget.available <= 0) {
        logService.log('info', `No available budget for strategy ${strategy.id}, skipping trade generation`, { budget }, 'TradeService');
        return [];
      }

      // Import AI service dynamically to avoid circular dependencies
      const { AIService } = await import('./ai-service');
      const aiService = new AIService();

      // Generate trades using DeepSeek AI
      const trades = await aiService.generateTradesForStrategy(strategy, budget);

      if (!trades || trades.length === 0) {
        logService.log('info', `No trades generated for strategy ${strategy.id}`, null, 'TradeService');
        return [];
      }

      logService.log('info', `Generated ${trades.length} trades for strategy ${strategy.id}`, null, 'TradeService');

      // Process and save each trade
      const savedTrades = [];
      for (const trade of trades) {
        try {
          // Ensure trade has all required fields
          const completeTrade = {
            id: uuidv4(),
            strategy_id: strategy.id,
            user_id: strategy.user_id,
            symbol: trade.symbol || trade.pair,
            side: trade.side || 'buy',
            type: trade.type || 'market',
            amount: trade.amount || 0,
            price: trade.price || 0,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            market_type: strategy.market_type || strategy.marketType || 'spot',
            metadata: {
              ...trade,
              entry_conditions: trade.entry_conditions || trade.entryConditions || [],
              exit_conditions: trade.exit_conditions || trade.exitConditions || [],
              stop_loss: trade.stop_loss || trade.stopLoss,
              take_profit: trade.take_profit || trade.takeProfit,
              timeframe: trade.timeframe || '1h',
              reason: trade.reason || 'AI generated trade'
            }
          };

          // Reserve budget for this trade
          const budgetReserved = this.reserveBudgetForTrade(
            strategy.id,
            completeTrade.amount * completeTrade.price,
            completeTrade.id,
            completeTrade.market_type
          );

          if (!budgetReserved) {
            logService.log('warn', `Failed to reserve budget for trade ${completeTrade.id}`, {
              trade: completeTrade,
              budget: this.getBudget(strategy.id)
            }, 'TradeService');
            continue;
          }

          // Save trade to database
          const { data: savedTrade, error } = await supabase
            .from('trades')
            .insert(completeTrade)
            .select()
            .single();

          if (error) {
            logService.log('error', `Failed to save trade ${completeTrade.id}`, { error, trade: completeTrade }, 'TradeService');
            // Release the budget since we couldn't save the trade
            await this.releaseBudgetFromTrade(
              strategy.id,
              completeTrade.amount * completeTrade.price,
              0,
              completeTrade.id,
              'cancelled',
              completeTrade.market_type
            );
            continue;
          }

          // Emit events
          this.emit('tradeCreated', savedTrade);
          eventBus.emit('trade:created', savedTrade);

          savedTrades.push(savedTrade);

          logService.log('info', `Trade ${savedTrade.id} created for strategy ${strategy.id}`, {
            symbol: savedTrade.symbol,
            amount: savedTrade.amount,
            price: savedTrade.price
          }, 'TradeService');
        } catch (tradeError) {
          logService.log('error', `Error processing trade for strategy ${strategy.id}`, tradeError, 'TradeService');
        }
      }

      return savedTrades;
    } catch (error) {
      logService.log('error', `Failed to generate trades for strategy ${strategy?.id}`, error, 'TradeService');
      return [];
    }
  }

  /**
   * Update the status of a trade
   * @param tradeId The ID of the trade to update
   * @returns The updated trade
   */
  async updateTradeStatus(tradeId: string): Promise<any> {
    try {
      if (!tradeId) {
        logService.log('error', 'Invalid trade ID provided for status update', null, 'TradeService');
        return null;
      }

      // Get the trade from the database
      const { data: trade, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (error) {
        logService.log('error', `Failed to get trade ${tradeId}`, error, 'TradeService');
        return null;
      }

      if (!trade) {
        logService.log('warn', `Trade ${tradeId} not found`, null, 'TradeService');
        return null;
      }

      // Check if trade is already closed
      if (trade.status === 'closed') {
        logService.log('info', `Trade ${tradeId} is already closed`, null, 'TradeService');
        return trade;
      }

      // Import AI service dynamically to avoid circular dependencies
      const { AIService } = await import('./ai-service');
      const aiService = new AIService();

      // Check if trade should be closed
      const shouldClose = await aiService.shouldCloseTrade(trade);

      if (shouldClose) {
        // Calculate profit/loss
        const entryValue = trade.amount * trade.price;
        const currentPrice = await this.getCurrentPrice(trade.symbol);
        const exitValue = trade.amount * currentPrice;
        const profit = trade.side === 'buy' ? exitValue - entryValue : entryValue - exitValue;

        // Update trade status
        const { data: updatedTrade, error: updateError } = await supabase
          .from('trades')
          .update({
            status: 'closed',
            exit_price: currentPrice,
            exit_time: new Date().toISOString(),
            profit: profit,
            updated_at: new Date().toISOString()
          })
          .eq('id', tradeId)
          .select()
          .single();

        if (updateError) {
          logService.log('error', `Failed to update trade ${tradeId}`, updateError, 'TradeService');
          return trade;
        }

        // Release budget with profit/loss
        await this.releaseBudgetFromTrade(
          trade.strategy_id,
          entryValue,
          profit,
          tradeId,
          'closed',
          trade.market_type
        );

        // Emit events
        this.emit('tradeClosed', updatedTrade);
        eventBus.emit('trade:closed', updatedTrade);

        logService.log('info', `Trade ${tradeId} closed with profit ${profit}`, {
          symbol: trade.symbol,
          entryPrice: trade.price,
          exitPrice: currentPrice,
          profit
        }, 'TradeService');

        return updatedTrade;
      }

      return trade;
    } catch (error) {
      logService.log('error', `Failed to update trade status for ${tradeId}`, error, 'TradeService');
      return null;
    }
  }

  /**
   * Get the current price for a symbol
   * @param symbol The symbol to get the price for
   * @returns The current price
   */
  private async getCurrentPrice(symbol: string): Promise<number> {
    try {
      // Import exchange service dynamically to avoid circular dependencies
      const { exchangeService } = await import('./exchange-service');

      // Get the current price from the exchange
      const price = await exchangeService.fetchMarketPrice(symbol);
      return price.price;
    } catch (error) {
      logService.log('error', `Failed to get current price for ${symbol}`, error, 'TradeService');
      return 0;
    }
  }

  /**
   * Reset active strategies
   * This is called when the exchange is changed
   */
  async resetActiveStrategies(): Promise<void> {
    try {
      // Call the more comprehensive version that returns a result
      const result = await this.resetActiveStrategiesWithResult();

      if (result) {
        logService.log('info', 'Successfully reset active strategies', null, 'TradeService');
      } else {
        logService.log('warn', 'Failed to reset active strategies', null, 'TradeService');
      }
    } catch (error) {
      logService.log('error', 'Error in resetActiveStrategies', error, 'TradeService');
    }
  }
}

export const tradeService = TradeService.getInstance();
