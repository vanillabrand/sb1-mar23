import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import type { StrategyBudget } from './types';

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
    return (
      typeof budget.total === 'number' &&
      typeof budget.allocated === 'number' &&
      typeof budget.available === 'number' &&
      typeof budget.maxPositionSize === 'number' &&
      budget.total > 0 &&
      budget.allocated >= 0 &&
      budget.available >= 0 &&
      budget.maxPositionSize > 0 &&
      Math.abs(budget.allocated + budget.available - budget.total) < 0.01 // Allow small rounding differences
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
  reserveBudgetForTrade(strategyId: string, amount: number): boolean {
    const budget = this.budgets.get(strategyId);
    if (!budget || budget.available < amount) {
      logService.log('warn', `Insufficient budget for trade: ${amount} (available: ${budget?.available || 0})`, null, 'TradeService');
      return false;
    }
    
    const formattedAmount = Number(amount.toFixed(2));
    budget.available = Number((budget.available - formattedAmount).toFixed(2));
    budget.allocated = Number((budget.allocated + formattedAmount).toFixed(2));
    this.budgets.set(strategyId, budget);
    this.saveBudgets();
    logService.log('info', `Reserved ${formattedAmount} for strategy ${strategyId}`, budget, 'TradeService');
    return true;
  }

  // Release reserved budget from a trade, applying any profit gained.
  releaseBudgetFromTrade(strategyId: string, amount: number, profit: number = 0): void {
    const budget = this.budgets.get(strategyId);
    if (!budget) {
      logService.log('warn', `No budget found for strategy ${strategyId}`, null, 'TradeService');
      return;
    }
    
    const formattedAmount = Number(amount.toFixed(2));
    const formattedProfit = Number(profit.toFixed(2));
    
    // Update budget: decrease allocated, increase available and total by profit.
    budget.allocated = Number((budget.allocated - formattedAmount).toFixed(2));
    budget.available = Number((budget.available + formattedAmount + formattedProfit).toFixed(2));
    budget.total = Number((budget.total + formattedProfit).toFixed(2));
    
    this.budgets.set(strategyId, budget);
    this.saveBudgets();
    logService.log('info', `Released ${formattedAmount} (profit: ${formattedProfit}) for strategy ${strategyId}`, budget, 'TradeService');
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
    return {
      total: Number(this.DEFAULT_BUDGET.toFixed(2)),
      allocated: 0,
      available: Number(this.DEFAULT_BUDGET.toFixed(2)),
      maxPositionSize: Number((this.DEFAULT_BUDGET * 0.1).toFixed(2))
    };
  }
}

export const tradeService = TradeService.getInstance();
