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
  private pendingRecords: Map<string, NodeJS.Timeout> = new Map(); // For debouncing
  private lastRecordTime: Map<string, number> = new Map(); // For throttling
  private readonly DEBOUNCE_DELAY = 1000; // 1 second debounce
  private readonly THROTTLE_INTERVAL = 5000; // 5 seconds between records for the same strategy
  private processingStrategy: Set<string> = new Set(); // Track strategies being processed

  // Circuit breaker pattern
  private errorCounts: Map<string, number> = new Map(); // Track errors by strategy
  private circuitBroken: Map<string, boolean> = new Map(); // Track broken circuits by strategy
  private circuitResetTimers: Map<string, NodeJS.Timeout> = new Map(); // Timers to reset circuits
  private readonly MAX_ERRORS = 3; // Number of errors before breaking the circuit
  private readonly CIRCUIT_RESET_TIME = 60000; // 1 minute before resetting the circuit

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
    // Use a debounced version of the handlers to prevent excessive calls
    const debouncedBudgetUpdate = this.debounce(this.handleBudgetUpdate.bind(this), 500);
    const debouncedTradeCreated = this.debounce(this.handleTradeCreated.bind(this), 500);
    const debouncedTradeClosed = this.debounce(this.handleTradeClosed.bind(this), 500);

    // Listen for budget updates
    eventBus.subscribe('budget:updated', debouncedBudgetUpdate);

    // Listen for trade events that affect budget
    eventBus.subscribe('trade:created', debouncedTradeCreated);
    eventBus.subscribe('trade:closed', debouncedTradeClosed);

    // Add a cleanup interval to clear any stale processing flags
    setInterval(() => {
      this.processingStrategy.clear();
      logService.log('debug', 'Cleared processing strategy flags', null, 'BudgetHistoryService');
    }, 30000); // Clear every 30 seconds
  }

  /**
   * Create a debounced version of a function
   */
  private debounce(func: Function, wait: number): Function {
    let timeout: NodeJS.Timeout | null = null;
    return function(...args: any[]) {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        func(...args);
        timeout = null;
      }, wait);
    };
  }

  /**
   * Handle budget update events
   */
  private handleBudgetUpdate(data: any): void {
    if (!data || !data.strategyId || !data.budget) return;

    // Don't record history for initial budget setup
    if (data.initialSetup) return;

    // Skip if we've processed this strategy recently
    const strategyId = data.strategyId;
    const now = Date.now();
    const lastTime = this.lastRecordTime.get(strategyId) || 0;

    if (now - lastTime < this.THROTTLE_INTERVAL) {
      logService.log('debug', `Skipping budget update for strategy ${strategyId} (throttled)`,
        null, 'BudgetHistoryService');
      return;
    }

    // Record budget change
    this.recordBudgetChange({
      strategy_id: strategyId,
      total: data.budget.total,
      allocated: data.budget.allocated,
      available: data.budget.available,
      profit: data.profit || 0,
      change_type: data.changeType || 'adjustment',
      change_amount: data.changeAmount || 0,
      trade_id: data.tradeId,
      timestamp: now
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

    // Skip if we've processed this strategy recently
    const now = Date.now();
    const lastTime = this.lastRecordTime.get(strategyId) || 0;

    if (now - lastTime < this.THROTTLE_INTERVAL) {
      logService.log('debug', `Skipping trade created event for strategy ${strategyId} (throttled)`,
        null, 'BudgetHistoryService');
      return;
    }

    // Calculate the trade amount
    const price = trade.entry_price || trade.entryPrice || trade.price || 0;
    const amount = trade.amount || trade.quantity || trade.size || 0;

    if (!price || !amount) {
      logService.log('warn', `Invalid trade data for budget history: price=${price}, amount=${amount}`,
        { trade }, 'BudgetHistoryService');
      return;
    }

    const tradeAmount = price * amount;

    // Record budget allocation for trade
    this.recordBudgetChange({
      strategy_id: strategyId,
      total: 0, // Will be filled in by recordBudgetChange
      allocated: 0, // Will be filled in by recordBudgetChange
      available: 0, // Will be filled in by recordBudgetChange
      change_type: 'trade_allocation',
      change_amount: -tradeAmount, // Negative because it's an allocation
      trade_id: trade.id,
      timestamp: now
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

    // Skip if we've processed this strategy recently
    const now = Date.now();
    const lastTime = this.lastRecordTime.get(strategyId) || 0;

    if (now - lastTime < this.THROTTLE_INTERVAL) {
      logService.log('debug', `Skipping trade closed event for strategy ${strategyId} (throttled)`,
        null, 'BudgetHistoryService');
      return;
    }

    // Calculate the trade amount and profit
    const entryPrice = trade.entry_price || trade.entryPrice || trade.price || 0;
    const exitPrice = trade.exit_price || trade.exitPrice || 0;
    const amount = trade.amount || trade.quantity || trade.size || 0;

    if (!entryPrice || !amount) {
      logService.log('warn', `Invalid trade data for budget history: entryPrice=${entryPrice}, amount=${amount}`,
        { trade }, 'BudgetHistoryService');
      return;
    }

    const tradeAmount = entryPrice * amount;
    let profit = 0;

    if (exitPrice > 0) {
      const exitAmount = amount * exitPrice;
      profit = trade.side === 'buy' ?
        exitAmount - tradeAmount :
        tradeAmount - exitAmount;
    } else if (trade.profit !== undefined) {
      profit = trade.profit;
    }

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
      timestamp: now
    });

    // If there was profit, we'll let the budget update event handle it
    // This prevents duplicate records and reduces API calls
  }

  /**
   * Record a budget change with debouncing and throttling
   */
  async recordBudgetChange(entry: BudgetHistoryEntry): Promise<void> {
    const strategyId = entry.strategy_id;

    // Skip if we're already processing this strategy to prevent recursion
    if (this.processingStrategy.has(strategyId)) {
      logService.log('debug', `Skipping duplicate budget history record for strategy ${strategyId} (already processing)`,
        null, 'BudgetHistoryService');
      return;
    }

    // Check if the circuit is broken for this strategy
    if (this.circuitBroken.get(strategyId)) {
      logService.log('debug', `Circuit broken for strategy ${strategyId}, skipping budget history record`,
        null, 'BudgetHistoryService');

      // Add to local history anyway
      this.addToLocalHistory(strategyId, entry);
      return;
    }

    // Check if we should throttle this request
    const now = Date.now();
    const lastTime = this.lastRecordTime.get(strategyId) || 0;
    if (now - lastTime < this.THROTTLE_INTERVAL) {
      // If we already have a pending record for this strategy, just update it
      if (this.pendingRecords.has(strategyId)) {
        logService.log('debug', `Updating pending budget history record for strategy ${strategyId}`,
          null, 'BudgetHistoryService');
        return;
      }

      // Otherwise, debounce this request
      logService.log('debug', `Debouncing budget history record for strategy ${strategyId}`,
        null, 'BudgetHistoryService');

      // Clear any existing timeout
      const existingTimeout = this.pendingRecords.get(strategyId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set a new timeout
      const timeout = setTimeout(() => {
        this.pendingRecords.delete(strategyId);
        this.recordBudgetChange(entry).catch(error => {
          logService.log('error', `Error in debounced recordBudgetChange for strategy ${strategyId}`,
            error, 'BudgetHistoryService');

          // Increment error count for circuit breaker
          this.incrementErrorCount(strategyId);
        });
      }, this.DEBOUNCE_DELAY);

      this.pendingRecords.set(strategyId, timeout);
      return;
    }

    try {
      // Mark this strategy as being processed
      this.processingStrategy.add(strategyId);

      // Update the last record time
      this.lastRecordTime.set(strategyId, now);

      // Reset error count for this strategy
      this.resetErrorCount(strategyId);

      // Get current budget to fill in missing values - use a cached approach
      let currentBudget = null;

      try {
        // Only fetch from database if we're in live mode
        if (!this.isDemo) {
          const { data, error } = await supabase
            .from('strategy_budgets')
            .select('*')
            .eq('strategy_id', strategyId)
            .single();

          if (!error && data) {
            currentBudget = data;
          }
        }
      } catch (dbError) {
        logService.log('warn', `Failed to fetch current budget for strategy ${strategyId}`,
          dbError, 'BudgetHistoryService');
        // Increment error count for circuit breaker
        this.incrementErrorCount(strategyId);
        // Continue with the process even if we can't get the current budget
      }

      if (currentBudget) {
        entry.total = entry.total || Number(currentBudget.total);
        entry.allocated = entry.allocated || Number(currentBudget.allocated);
        entry.available = entry.available || Number(currentBudget.available);
      }

      // Add to local history
      this.addToLocalHistory(strategyId, entry);

      // Save to database if not in demo mode and circuit is not broken
      if (!this.isDemo && !this.circuitBroken.get(strategyId)) {
        try {
          await this.saveToDatabase(entry);
        } catch (dbError) {
          logService.log('warn', `Failed to save budget history to database for strategy ${strategyId}`,
            dbError, 'BudgetHistoryService');
          // Increment error count for circuit breaker
          this.incrementErrorCount(strategyId);
          // Continue even if database save fails
        }
      }

      // Emit event
      this.emit('budgetHistoryUpdated', { strategyId, entry });

      // Only emit the event bus event if we're not in a recursion and circuit is not broken
      if (!this.pendingRecords.has(strategyId) && !this.circuitBroken.get(strategyId)) {
        eventBus.emit('budget:historyUpdated', { strategyId, entry });
      }

      logService.log('info', `Recorded budget history entry for strategy ${strategyId}`,
        { entry }, 'BudgetHistoryService');
    } catch (error) {
      logService.log('error', `Failed to record budget history for strategy ${strategyId}`,
        error, 'BudgetHistoryService');
      // Increment error count for circuit breaker
      this.incrementErrorCount(strategyId);
    } finally {
      // Remove this strategy from the processing set
      this.processingStrategy.delete(strategyId);
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
   * Increment error count for a strategy and break circuit if needed
   */
  private incrementErrorCount(strategyId: string): void {
    // Get current error count
    const currentCount = this.errorCounts.get(strategyId) || 0;
    const newCount = currentCount + 1;

    // Update error count
    this.errorCounts.set(strategyId, newCount);

    // Check if we should break the circuit
    if (newCount >= this.MAX_ERRORS) {
      this.breakCircuit(strategyId);
    }
  }

  /**
   * Reset error count for a strategy
   */
  private resetErrorCount(strategyId: string): void {
    this.errorCounts.set(strategyId, 0);
  }

  /**
   * Break the circuit for a strategy
   */
  private breakCircuit(strategyId: string): void {
    // Skip if circuit is already broken
    if (this.circuitBroken.get(strategyId)) {
      return;
    }

    // Break the circuit
    this.circuitBroken.set(strategyId, true);

    logService.log('warn', `Breaking circuit for strategy ${strategyId} due to too many errors`,
      null, 'BudgetHistoryService');

    // Set a timer to reset the circuit
    const existingTimer = this.circuitResetTimers.get(strategyId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.resetCircuit(strategyId);
    }, this.CIRCUIT_RESET_TIME);

    this.circuitResetTimers.set(strategyId, timer);
  }

  /**
   * Reset the circuit for a strategy
   */
  private resetCircuit(strategyId: string): void {
    // Reset circuit state
    this.circuitBroken.set(strategyId, false);
    this.errorCounts.set(strategyId, 0);
    this.circuitResetTimers.delete(strategyId);

    logService.log('info', `Reset circuit for strategy ${strategyId}`, null, 'BudgetHistoryService');
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

  /**
   * Reset all circuits
   */
  resetAllCircuits(): void {
    // Clear all circuit breaker state
    this.errorCounts.clear();
    this.circuitBroken.clear();

    // Clear all circuit reset timers
    this.circuitResetTimers.forEach(timer => {
      clearTimeout(timer);
    });
    this.circuitResetTimers.clear();

    logService.log('info', 'Reset all circuits', null, 'BudgetHistoryService');
  }
}

export const budgetHistoryService = BudgetHistoryService.getInstance();
