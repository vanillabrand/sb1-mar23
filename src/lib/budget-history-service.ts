import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { supabase } from './supabase';
import { demoService } from './demo-service';
import { eventBus } from './event-bus';
import type { StrategyBudget } from './types';

export interface BudgetHistoryEntry {
  id?: string;
  strategy_id: string;
  total: number;
  allocated: number;
  available: number;
  profit?: number;
  change_type: 'initial' | 'trade_allocation' | 'trade_release' | 'adjustment' | 'profit';
  change_amount: number;
  trade_id?: string;
  timestamp: number;
  created_at?: string;
}

/**
 * Service for tracking budget history
 */
class BudgetHistoryService extends EventEmitter {
  private static instance: BudgetHistoryService;
  private localHistory: Map<string, BudgetHistoryEntry[]> = new Map();
  private readonly MAX_LOCAL_HISTORY = 100; // Maximum number of entries to keep in memory per strategy
  private isDemo: boolean = false;

  private constructor() {
    super();
    this.isDemo = demoService.isInDemoMode();
    this.setupEventListeners();
  }

  static getInstance(): BudgetHistoryService {
    if (!BudgetHistoryService.instance) {
      BudgetHistoryService.instance = new BudgetHistoryService();
    }
    return BudgetHistoryService.instance;
  }

  /**
   * Set up event listeners for budget changes
   */
  private setupEventListeners(): void {
    // Listen for budget updates
    eventBus.subscribe('budget:updated', this.handleBudgetUpdate.bind(this));
    
    // Listen for trade events that affect budget
    eventBus.subscribe('trade:created', this.handleTradeCreated.bind(this));
    eventBus.subscribe('trade:closed', this.handleTradeClosed.bind(this));
  }

  /**
   * Handle budget update events
   */
  private handleBudgetUpdate(data: any): void {
    if (!data || !data.strategyId || !data.budget) return;
    
    // Don't record history for initial budget setup
    if (data.initialSetup) return;
    
    // Record budget change
    this.recordBudgetChange({
      strategy_id: data.strategyId,
      total: data.budget.total,
      allocated: data.budget.allocated,
      available: data.budget.available,
      profit: data.profit || 0,
      change_type: data.changeType || 'adjustment',
      change_amount: data.changeAmount || 0,
      trade_id: data.tradeId,
      timestamp: Date.now()
    });
  }

  /**
   * Handle trade created events
   */
  private handleTradeCreated(data: any): void {
    if (!data || !data.trade) return;
    
    const trade = data.trade;
    const strategyId = trade.strategy_id || trade.strategyId;
    
    if (!strategyId) return;
    
    // Calculate the trade amount
    const tradeAmount = trade.amount * (trade.entry_price || trade.entryPrice || 0);
    
    // Record budget allocation for trade
    this.recordBudgetChange({
      strategy_id: strategyId,
      total: 0, // Will be filled in by recordBudgetChange
      allocated: 0, // Will be filled in by recordBudgetChange
      available: 0, // Will be filled in by recordBudgetChange
      change_type: 'trade_allocation',
      change_amount: -tradeAmount, // Negative because it's an allocation
      trade_id: trade.id,
      timestamp: Date.now()
    });
  }

  /**
   * Handle trade closed events
   */
  private handleTradeClosed(data: any): void {
    if (!data || !data.trade) return;
    
    const trade = data.trade;
    const strategyId = trade.strategy_id || trade.strategyId;
    
    if (!strategyId) return;
    
    // Calculate the trade amount and profit
    const tradeAmount = trade.amount * (trade.entry_price || trade.entryPrice || 0);
    const exitAmount = trade.amount * (trade.exit_price || trade.exitPrice || 0);
    const profit = trade.side === 'buy' ? 
      exitAmount - tradeAmount : 
      tradeAmount - exitAmount;
    
    // Record budget release for trade
    this.recordBudgetChange({
      strategy_id: strategyId,
      total: 0, // Will be filled in by recordBudgetChange
      allocated: 0, // Will be filled in by recordBudgetChange
      available: 0, // Will be filled in by recordBudgetChange
      profit: profit,
      change_type: 'trade_release',
      change_amount: tradeAmount, // Positive because it's a release
      trade_id: trade.id,
      timestamp: Date.now()
    });
    
    // If there was profit, record that separately
    if (profit !== 0) {
      this.recordBudgetChange({
        strategy_id: strategyId,
        total: 0, // Will be filled in by recordBudgetChange
        allocated: 0, // Will be filled in by recordBudgetChange
        available: 0, // Will be filled in by recordBudgetChange
        profit: profit,
        change_type: 'profit',
        change_amount: profit,
        trade_id: trade.id,
        timestamp: Date.now() + 1 // +1 to ensure it comes after the release entry
      });
    }
  }

  /**
   * Record a budget change
   */
  async recordBudgetChange(entry: BudgetHistoryEntry): Promise<void> {
    try {
      // Get current budget to fill in missing values
      const { data: currentBudget } = await supabase
        .from('strategy_budgets')
        .select('*')
        .eq('strategy_id', entry.strategy_id)
        .single();
      
      if (currentBudget) {
        entry.total = entry.total || Number(currentBudget.total);
        entry.allocated = entry.allocated || Number(currentBudget.allocated);
        entry.available = entry.available || Number(currentBudget.available);
      }
      
      // Add to local history
      this.addToLocalHistory(entry.strategy_id, entry);
      
      // Save to database if not in demo mode
      if (!this.isDemo) {
        await this.saveToDatabase(entry);
      }
      
      // Emit event
      this.emit('budgetHistoryUpdated', { strategyId: entry.strategy_id, entry });
      eventBus.emit('budget:historyUpdated', { strategyId: entry.strategy_id, entry });
      
      logService.log('info', `Recorded budget history entry for strategy ${entry.strategy_id}`, 
        { entry }, 'BudgetHistoryService');
    } catch (error) {
      logService.log('error', `Failed to record budget history for strategy ${entry.strategy_id}`, 
        error, 'BudgetHistoryService');
    }
  }

  /**
   * Add an entry to local history
   */
  private addToLocalHistory(strategyId: string, entry: BudgetHistoryEntry): void {
    if (!this.localHistory.has(strategyId)) {
      this.localHistory.set(strategyId, []);
    }
    
    const history = this.localHistory.get(strategyId)!;
    history.push(entry);
    
    // Trim if exceeding max size
    if (history.length > this.MAX_LOCAL_HISTORY) {
      history.splice(0, history.length - this.MAX_LOCAL_HISTORY);
    }
    
    this.localHistory.set(strategyId, history);
  }

  /**
   * Save an entry to the database
   */
  private async saveToDatabase(entry: BudgetHistoryEntry): Promise<void> {
    try {
      const { error } = await supabase
        .from('budget_history')
        .insert({
          strategy_id: entry.strategy_id,
          total: entry.total,
          allocated: entry.allocated,
          available: entry.available,
          profit: entry.profit || 0,
          change_type: entry.change_type,
          change_amount: entry.change_amount,
          trade_id: entry.trade_id,
          timestamp: new Date(entry.timestamp).toISOString(),
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
    } catch (error) {
      logService.log('error', 'Failed to save budget history to database', error, 'BudgetHistoryService');
      // Continue even if database save fails
    }
  }

  /**
   * Get budget history for a strategy
   */
  async getBudgetHistory(strategyId: string, limit: number = 50): Promise<BudgetHistoryEntry[]> {
    try {
      // Try to get from database first
      if (!this.isDemo) {
        const { data, error } = await supabase
          .from('budget_history')
          .select('*')
          .eq('strategy_id', strategyId)
          .order('timestamp', { ascending: false })
          .limit(limit);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          return data.map(item => ({
            ...item,
            timestamp: new Date(item.timestamp).getTime()
          }));
        }
      }
      
      // Fall back to local history
      const localHistory = this.localHistory.get(strategyId) || [];
      return [...localHistory].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    } catch (error) {
      logService.log('error', `Failed to get budget history for strategy ${strategyId}`, error, 'BudgetHistoryService');
      
      // Fall back to local history on error
      const localHistory = this.localHistory.get(strategyId) || [];
      return [...localHistory].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    }
  }

  /**
   * Get budget history summary (aggregated by day)
   */
  async getBudgetHistorySummary(strategyId: string, days: number = 30): Promise<any[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Try to get from database first
      if (!this.isDemo) {
        const { data, error } = await supabase
          .from('budget_history')
          .select('*')
          .eq('strategy_id', strategyId)
          .gte('timestamp', startDate.toISOString())
          .lte('timestamp', endDate.toISOString())
          .order('timestamp', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          return this.aggregateHistoryByDay(data.map(item => ({
            ...item,
            timestamp: new Date(item.timestamp).getTime()
          })));
        }
      }
      
      // Fall back to local history
      const localHistory = this.localHistory.get(strategyId) || [];
      const filteredHistory = localHistory.filter(
        entry => entry.timestamp >= startDate.getTime() && entry.timestamp <= endDate.getTime()
      );
      
      return this.aggregateHistoryByDay(filteredHistory);
    } catch (error) {
      logService.log('error', `Failed to get budget history summary for strategy ${strategyId}`, 
        error, 'BudgetHistoryService');
      return [];
    }
  }

  /**
   * Aggregate history entries by day
   */
  private aggregateHistoryByDay(entries: BudgetHistoryEntry[]): any[] {
    const dailyMap = new Map<string, any>();
    
    for (const entry of entries) {
      const date = new Date(entry.timestamp);
      const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          timestamp: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
          total: entry.total,
          allocated: entry.allocated,
          available: entry.available,
          profit: 0,
          trades: 0
        });
      }
      
      const daily = dailyMap.get(dateKey)!;
      
      // Update latest values
      daily.total = entry.total;
      daily.allocated = entry.allocated;
      daily.available = entry.available;
      
      // Accumulate profit
      if (entry.change_type === 'profit') {
        daily.profit += entry.change_amount;
      }
      
      // Count trades
      if (entry.change_type === 'trade_allocation') {
        daily.trades += 1;
      }
      
      dailyMap.set(dateKey, daily);
    }
    
    return Array.from(dailyMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clear local history
   */
  clearLocalHistory(): void {
    this.localHistory.clear();
  }

  /**
   * Set demo mode
   */
  setDemoMode(isDemo: boolean): void {
    this.isDemo = isDemo;
  }
}

export const budgetHistoryService = BudgetHistoryService.getInstance();
