import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { exchangeService } from './exchange-service';
import { ccxtService } from './ccxt-service';
import { demoService } from './demo-service';
import { eventBus } from './event-bus';
import { supabase } from './supabase';
import type { StrategyBudget } from './types';

/**
 * Service for validating budgets against exchange balances
 */
class BudgetValidationService extends EventEmitter {
  private static instance: BudgetValidationService;
  private validationCache: Map<string, { timestamp: number, result: boolean }> = new Map();
  private readonly CACHE_EXPIRY = 60000; // 1 minute
  private readonly VALIDATION_INTERVAL = 300000; // 5 minutes
  private validationInterval: NodeJS.Timeout | null = null;
  private isDemo: boolean = false;

  private constructor() {
    super();
    this.isDemo = demoService.isInDemoMode();
    this.startPeriodicValidation();
  }

  static getInstance(): BudgetValidationService {
    if (!BudgetValidationService.instance) {
      BudgetValidationService.instance = new BudgetValidationService();
    }
    return BudgetValidationService.instance;
  }

  /**
   * Validate a budget against exchange balances
   * @param strategyId The strategy ID
   * @param budget The budget to validate
   * @param force Force validation even if cached result exists
   */
  async validateBudget(strategyId: string, budget: StrategyBudget, force: boolean = false): Promise<boolean> {
    try {
      // In demo mode, always return true
      if (this.isDemo) {
        return true;
      }

      // Check cache first if not forcing validation
      if (!force) {
        const cached = this.validationCache.get(strategyId);
        if (cached && Date.now() - cached.timestamp < this.CACHE_EXPIRY) {
          return cached.result;
        }
      }

      logService.log('info', `Validating budget for strategy ${strategyId}`, { budget }, 'BudgetValidationService');

      // Get the base currency (usually USDT)
      const baseCurrency = 'USDT';

      // Get exchange balance
      const balance = await exchangeService.fetchBalance(baseCurrency);
      
      if (!balance || !balance.free) {
        throw new Error(`Could not fetch ${baseCurrency} balance from exchange`);
      }

      const availableBalance = balance.free;
      
      // Check if budget is within available balance
      const isValid = budget.total <= availableBalance;

      // Cache the result
      this.validationCache.set(strategyId, {
        timestamp: Date.now(),
        result: isValid
      });

      // Log the validation result
      logService.log(
        isValid ? 'info' : 'warn',
        `Budget validation for strategy ${strategyId}: ${isValid ? 'Valid' : 'Invalid'}`,
        { budget, availableBalance },
        'BudgetValidationService'
      );

      // Emit event for UI updates
      this.emit('budgetValidated', { strategyId, isValid, budget, availableBalance });
      eventBus.emit('budget:validated', { strategyId, isValid, budget, availableBalance });

      // If invalid, also emit an alert
      if (!isValid) {
        this.emit('budgetAlert', {
          strategyId,
          type: 'validation',
          message: `Budget (${budget.total}) exceeds available balance (${availableBalance})`,
          severity: 'error',
          timestamp: Date.now()
        });
        eventBus.emit('budget:alert', {
          strategyId,
          type: 'validation',
          message: `Budget (${budget.total}) exceeds available balance (${availableBalance})`,
          severity: 'error',
          timestamp: Date.now()
        });
      }

      return isValid;
    } catch (error) {
      logService.log('error', `Failed to validate budget for strategy ${strategyId}`, error, 'BudgetValidationService');
      
      // In case of error, be conservative and return false
      this.validationCache.set(strategyId, {
        timestamp: Date.now(),
        result: false
      });
      
      // Emit error event
      this.emit('budgetValidationError', { strategyId, error });
      eventBus.emit('budget:validationError', { strategyId, error });
      
      return false;
    }
  }

  /**
   * Validate all budgets against exchange balances
   */
  async validateAllBudgets(): Promise<Map<string, boolean>> {
    try {
      // Get all strategies with budgets
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('id, status');

      if (error) throw error;

      const results = new Map<string, boolean>();

      // Get the base currency balance once
      const baseCurrency = 'USDT';
      const balance = this.isDemo ? { free: 100000 } : await exchangeService.fetchBalance(baseCurrency);
      
      if (!balance || !balance.free) {
        throw new Error(`Could not fetch ${baseCurrency} balance from exchange`);
      }

      const availableBalance = balance.free;
      let totalBudgetAllocated = 0;

      // Get all budgets
      for (const strategy of strategies) {
        const { data: budgetData } = await supabase
          .from('strategy_budgets')
          .select('*')
          .eq('strategy_id', strategy.id)
          .single();

        if (budgetData) {
          const budget = {
            total: Number(budgetData.total),
            allocated: Number(budgetData.allocated),
            available: Number(budgetData.available),
            maxPositionSize: Number(budgetData.max_position_size)
          };

          totalBudgetAllocated += budget.total;
          
          // Individual budget validation
          const isValid = budget.total <= availableBalance;
          results.set(strategy.id, isValid);
          
          // Cache the result
          this.validationCache.set(strategy.id, {
            timestamp: Date.now(),
            result: isValid
          });
        }
      }

      // Check if total allocated budget exceeds available balance
      const isTotalValid = totalBudgetAllocated <= availableBalance;
      
      if (!isTotalValid) {
        logService.log('warn', 'Total allocated budget exceeds available balance', 
          { totalBudgetAllocated, availableBalance }, 
          'BudgetValidationService');
          
        // Emit global alert
        this.emit('budgetAlert', {
          strategyId: 'all',
          type: 'validation',
          message: `Total allocated budget (${totalBudgetAllocated}) exceeds available balance (${availableBalance})`,
          severity: 'error',
          timestamp: Date.now()
        });
        
        eventBus.emit('budget:alert', {
          strategyId: 'all',
          type: 'validation',
          message: `Total allocated budget (${totalBudgetAllocated}) exceeds available balance (${availableBalance})`,
          severity: 'error',
          timestamp: Date.now()
        });
      }

      return results;
    } catch (error) {
      logService.log('error', 'Failed to validate all budgets', error, 'BudgetValidationService');
      return new Map();
    }
  }

  /**
   * Start periodic validation of all budgets
   */
  private startPeriodicValidation(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
    }

    this.validationInterval = setInterval(() => {
      this.validateAllBudgets().catch(error => {
        logService.log('error', 'Error in periodic budget validation', error, 'BudgetValidationService');
      });
    }, this.VALIDATION_INTERVAL);

    logService.log('info', `Started periodic budget validation every ${this.VALIDATION_INTERVAL / 60000} minutes`, 
      null, 'BudgetValidationService');
  }

  /**
   * Stop periodic validation
   */
  stopPeriodicValidation(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
  }

  /**
   * Set demo mode
   */
  setDemoMode(isDemo: boolean): void {
    this.isDemo = isDemo;
  }
}

export const budgetValidationService = BudgetValidationService.getInstance();
