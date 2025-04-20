import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { eventBus } from './event-bus';
import { supabase } from './supabase';
import type { StrategyBudget } from './types';

export interface BudgetAlert {
  id?: string;
  strategy_id: string;
  type: 'low_funds' | 'validation' | 'allocation' | 'profit' | 'loss';
  message: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: number;
  acknowledged?: boolean;
  created_at?: string;
}

/**
 * Service for managing budget alerts
 */
class BudgetAlertService extends EventEmitter {
  private static instance: BudgetAlertService;
  private alerts: Map<string, BudgetAlert[]> = new Map();
  private readonly LOW_FUNDS_THRESHOLD = 0.2; // 20% of total budget
  private readonly CRITICAL_FUNDS_THRESHOLD = 0.1; // 10% of total budget
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 300000; // 5 minutes

  private constructor() {
    super();
    this.setupEventListeners();
    this.startPeriodicChecks();
  }

  static getInstance(): BudgetAlertService {
    if (!BudgetAlertService.instance) {
      BudgetAlertService.instance = new BudgetAlertService();
    }
    return BudgetAlertService.instance;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for budget updates
    eventBus.subscribe('budget:updated', this.handleBudgetUpdate.bind(this));
    
    // Listen for budget validation events
    eventBus.subscribe('budget:validated', this.handleBudgetValidation.bind(this));
    
    // Listen for trade events
    eventBus.subscribe('trade:closed', this.handleTradeClosed.bind(this));
  }

  /**
   * Handle budget update events
   */
  private handleBudgetUpdate(data: any): void {
    if (!data || !data.strategyId || !data.budget) return;
    
    const strategyId = data.strategyId;
    const budget = data.budget;
    
    // Check for low funds
    this.checkLowFunds(strategyId, budget);
  }

  /**
   * Handle budget validation events
   */
  private handleBudgetValidation(data: any): void {
    if (!data || !data.strategyId) return;
    
    // Validation alerts are handled by the validation service
  }

  /**
   * Handle trade closed events
   */
  private handleTradeClosed(data: any): void {
    if (!data || !data.trade) return;
    
    const trade = data.trade;
    const strategyId = trade.strategy_id || trade.strategyId;
    
    if (!strategyId) return;
    
    // Calculate profit/loss
    const entryAmount = trade.amount * (trade.entry_price || trade.entryPrice || 0);
    const exitAmount = trade.amount * (trade.exit_price || trade.exitPrice || 0);
    const pnl = trade.side === 'buy' ? 
      exitAmount - entryAmount : 
      entryAmount - exitAmount;
    
    // Create alert for significant profit or loss
    if (Math.abs(pnl) > 100) { // $100 threshold for significant P&L
      this.createAlert({
        strategy_id: strategyId,
        type: pnl >= 0 ? 'profit' : 'loss',
        message: pnl >= 0 ? 
          `Trade closed with profit of $${pnl.toFixed(2)}` : 
          `Trade closed with loss of $${Math.abs(pnl).toFixed(2)}`,
        severity: pnl >= 0 ? 'info' : 'warning',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Check for low funds
   */
  private checkLowFunds(strategyId: string, budget: StrategyBudget): void {
    if (!budget) return;
    
    const availableRatio = budget.available / budget.total;
    
    // Critical funds alert (less than 10%)
    if (availableRatio < this.CRITICAL_FUNDS_THRESHOLD) {
      this.createAlert({
        strategy_id: strategyId,
        type: 'low_funds',
        message: `Critical: Only ${(availableRatio * 100).toFixed(1)}% of budget available ($${budget.available.toFixed(2)})`,
        severity: 'error',
        timestamp: Date.now()
      });
    }
    // Low funds alert (less than 20%)
    else if (availableRatio < this.LOW_FUNDS_THRESHOLD) {
      this.createAlert({
        strategy_id: strategyId,
        type: 'low_funds',
        message: `Low funds: Only ${(availableRatio * 100).toFixed(1)}% of budget available ($${budget.available.toFixed(2)})`,
        severity: 'warning',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Create a new alert
   */
  async createAlert(alert: BudgetAlert): Promise<void> {
    try {
      // Add to local alerts
      if (!this.alerts.has(alert.strategy_id)) {
        this.alerts.set(alert.strategy_id, []);
      }
      
      const alerts = this.alerts.get(alert.strategy_id)!;
      
      // Check for duplicate alerts (same type within last hour)
      const lastHour = Date.now() - 3600000;
      const hasDuplicate = alerts.some(a => 
        a.type === alert.type && 
        a.timestamp > lastHour &&
        a.severity === alert.severity
      );
      
      if (hasDuplicate) {
        return; // Skip duplicate alerts
      }
      
      // Add to local alerts
      alerts.push(alert);
      this.alerts.set(alert.strategy_id, alerts);
      
      // Save to database
      try {
        const { error } = await supabase
          .from('budget_alerts')
          .insert({
            strategy_id: alert.strategy_id,
            type: alert.type,
            message: alert.message,
            severity: alert.severity,
            timestamp: new Date(alert.timestamp).toISOString(),
            acknowledged: false,
            created_at: new Date().toISOString()
          });
        
        if (error) throw error;
      } catch (dbError) {
        logService.log('warn', 'Failed to save budget alert to database', dbError, 'BudgetAlertService');
        // Continue even if database save fails
      }
      
      // Emit events
      this.emit('alert', alert);
      eventBus.emit('budget:alert', alert);
      
      logService.log(
        alert.severity === 'error' ? 'error' : 
        alert.severity === 'warning' ? 'warn' : 'info',
        `Budget alert for strategy ${alert.strategy_id}: ${alert.message}`,
        { alert },
        'BudgetAlertService'
      );
    } catch (error) {
      logService.log('error', 'Failed to create budget alert', error, 'BudgetAlertService');
    }
  }

  /**
   * Get alerts for a strategy
   */
  async getAlerts(strategyId: string, includeAcknowledged: boolean = false): Promise<BudgetAlert[]> {
    try {
      // Try to get from database first
      const { data, error } = await supabase
        .from('budget_alerts')
        .select('*')
        .eq('strategy_id', strategyId)
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const alerts = data.map(item => ({
          ...item,
          timestamp: new Date(item.timestamp).getTime()
        }));
        
        return includeAcknowledged ? 
          alerts : 
          alerts.filter(a => !a.acknowledged);
      }
      
      // Fall back to local alerts
      const localAlerts = this.alerts.get(strategyId) || [];
      return includeAcknowledged ? 
        localAlerts : 
        localAlerts.filter(a => !a.acknowledged);
    } catch (error) {
      logService.log('error', `Failed to get alerts for strategy ${strategyId}`, error, 'BudgetAlertService');
      
      // Fall back to local alerts on error
      const localAlerts = this.alerts.get(strategyId) || [];
      return includeAcknowledged ? 
        localAlerts : 
        localAlerts.filter(a => !a.acknowledged);
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      // Update in database
      const { error } = await supabase
        .from('budget_alerts')
        .update({ acknowledged: true })
        .eq('id', alertId);
      
      if (error) throw error;
      
      // Update in local alerts
      for (const [strategyId, alerts] of this.alerts.entries()) {
        const updatedAlerts = alerts.map(alert => {
          if (alert.id === alertId) {
            return { ...alert, acknowledged: true };
          }
          return alert;
        });
        
        this.alerts.set(strategyId, updatedAlerts);
      }
      
      // Emit event
      this.emit('alertAcknowledged', { alertId });
      eventBus.emit('budget:alertAcknowledged', { alertId });
      
      logService.log('info', `Budget alert ${alertId} acknowledged`, null, 'BudgetAlertService');
    } catch (error) {
      logService.log('error', `Failed to acknowledge budget alert ${alertId}`, error, 'BudgetAlertService');
    }
  }

  /**
   * Start periodic checks for all strategies
   */
  private startPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = setInterval(async () => {
      try {
        // Get all strategies with budgets
        const { data: strategies, error } = await supabase
          .from('strategies')
          .select('id, status');
        
        if (error) throw error;
        
        // Check each strategy's budget
        for (const strategy of strategies) {
          if (strategy.status === 'active') {
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
              
              this.checkLowFunds(strategy.id, budget);
            }
          }
        }
      } catch (error) {
        logService.log('error', 'Error in periodic budget checks', error, 'BudgetAlertService');
      }
    }, this.CHECK_INTERVAL);
    
    logService.log('info', `Started periodic budget checks every ${this.CHECK_INTERVAL / 60000} minutes`, 
      null, 'BudgetAlertService');
  }

  /**
   * Stop periodic checks
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export const budgetAlertService = BudgetAlertService.getInstance();
