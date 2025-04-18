import { EventEmitter } from './event-emitter';
import { tradeService } from './trade-service';
import { walletBalanceService } from './wallet-balance-service';
import { websocketService } from './websocket-service';
import { eventBus } from './event-bus';
import { logService } from './log-service';
import { demoService } from './demo-service';
import type { StrategyBudget, Trade, MarketType } from './types';

/**
 * Service for streaming real-time budget updates
 * Centralizes budget calculations and provides real-time updates to all components
 */
class BudgetStreamingService extends EventEmitter {
  private static instance: BudgetStreamingService;
  private budgetStreams: Map<string, {
    budget: StrategyBudget;
    trades: Trade[];
    profit: number;
    profitPercentage: number;
    allocationPercentage: number;
    lastUpdated: number;
  }> = new Map();
  private isInitialized: boolean = false;
  private updateIntervals: Map<string, number> = new Map();
  private DEFAULT_UPDATE_INTERVAL = 1000; // 1 second in demo mode
  private LIVE_UPDATE_INTERVAL = 2000; // 2 seconds in live mode

  private constructor() {
    super();
    this.initialize();
  }

  public static getInstance(): BudgetStreamingService {
    if (!BudgetStreamingService.instance) {
      BudgetStreamingService.instance = new BudgetStreamingService();
    }
    return BudgetStreamingService.instance;
  }

  /**
   * Initialize the budget streaming service
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Subscribe to trade service events
      tradeService.on('budgetUpdated', this.handleBudgetUpdate);
      tradeService.on('tradeCreated', this.handleTradeUpdate);
      tradeService.on('tradeUpdated', this.handleTradeUpdate);
      tradeService.on('tradeExecuted', this.handleTradeUpdate);
      tradeService.on('tradeClosed', this.handleTradeUpdate);

      // Subscribe to wallet balance updates
      walletBalanceService.on('balancesUpdated', this.handleBalanceUpdate);

      // Subscribe to websocket events for real-time price updates
      websocketService.on('message', this.handleWebsocketMessage);

      // Subscribe to event bus events
      eventBus.subscribe('trade:created', this.handleTradeEvent);
      eventBus.subscribe('trade:updated', this.handleTradeEvent);
      eventBus.subscribe('trade:executed', this.handleTradeEvent);
      eventBus.subscribe('trade:closed', this.handleTradeEvent);
      eventBus.subscribe('tradesUpdated', this.handleTradeEvent);
      eventBus.subscribe('budgetUpdated', this.handleBudgetEvent);
      eventBus.subscribe('strategy:activated', this.handleStrategyEvent);
      eventBus.subscribe('strategy:deactivated', this.handleStrategyEvent);
      eventBus.subscribe('strategy:status', this.handleStrategyEvent);

      // Demo-specific events
      if (demoService.isInDemoMode()) {
        eventBus.subscribe('demo:trade:created', this.handleDemoTradeEvent);
        eventBus.subscribe('demo:trade:updated', this.handleDemoTradeEvent);
        eventBus.subscribe('demo:trade:executed', this.handleDemoTradeEvent);
        eventBus.subscribe('ticker', this.handleTickerUpdate);
      }

      this.isInitialized = true;
      logService.log('info', 'Budget streaming service initialized', null, 'BudgetStreamingService');
    } catch (error) {
      logService.log('error', 'Failed to initialize budget streaming service', error, 'BudgetStreamingService');
    }
  }

  /**
   * Start streaming budget updates for a strategy
   * @param strategyId The strategy ID
   * @param initialTrades Initial trades for the strategy
   */
  public startBudgetStream(strategyId: string, initialTrades: Trade[] = []): void {
    // Get the current budget from trade service
    const budget = tradeService.getBudget(strategyId);
    if (!budget) {
      logService.log('warn', `No budget found for strategy ${strategyId}`, null, 'BudgetStreamingService');
      return;
    }

    // Calculate initial budget metrics
    const { profit, profitPercentage, allocationPercentage } = this.calculateBudgetMetrics(budget, initialTrades);

    // Create budget stream
    this.budgetStreams.set(strategyId, {
      budget: { ...budget },
      trades: [...initialTrades],
      profit,
      profitPercentage,
      allocationPercentage,
      lastUpdated: Date.now()
    });

    // Set up periodic updates
    const updateInterval = demoService.isInDemoMode() 
      ? this.DEFAULT_UPDATE_INTERVAL 
      : this.LIVE_UPDATE_INTERVAL;

    // Clear any existing interval
    if (this.updateIntervals.has(strategyId)) {
      window.clearInterval(this.updateIntervals.get(strategyId));
    }

    // Set new interval
    const intervalId = window.setInterval(() => {
      this.updateBudgetStream(strategyId);
    }, updateInterval);

    this.updateIntervals.set(strategyId, intervalId);

    // Emit initial budget stream
    this.emitBudgetUpdate(strategyId);

    logService.log('info', `Started budget stream for strategy ${strategyId}`, {
      budget,
      tradesCount: initialTrades.length,
      updateInterval
    }, 'BudgetStreamingService');
  }

  /**
   * Stop streaming budget updates for a strategy
   * @param strategyId The strategy ID
   */
  public stopBudgetStream(strategyId: string): void {
    // Clear update interval
    if (this.updateIntervals.has(strategyId)) {
      window.clearInterval(this.updateIntervals.get(strategyId));
      this.updateIntervals.delete(strategyId);
    }

    // Remove budget stream
    this.budgetStreams.delete(strategyId);

    logService.log('info', `Stopped budget stream for strategy ${strategyId}`, null, 'BudgetStreamingService');
  }

  /**
   * Update trades for a strategy's budget stream
   * @param strategyId The strategy ID
   * @param trades The updated trades
   */
  public updateTrades(strategyId: string, trades: Trade[]): void {
    const budgetStream = this.budgetStreams.get(strategyId);
    if (!budgetStream) {
      // Start a new budget stream if one doesn't exist
      this.startBudgetStream(strategyId, trades);
      return;
    }

    // Update trades
    budgetStream.trades = [...trades];
    
    // Update budget metrics
    this.updateBudgetStream(strategyId);
  }

  /**
   * Update budget for a strategy's budget stream
   * @param strategyId The strategy ID
   * @param budget The updated budget
   */
  public updateBudget(strategyId: string, budget: StrategyBudget): void {
    const budgetStream = this.budgetStreams.get(strategyId);
    if (!budgetStream) {
      // Start a new budget stream if one doesn't exist
      this.startBudgetStream(strategyId, []);
      return;
    }

    // Update budget
    budgetStream.budget = { ...budget };
    
    // Update budget metrics
    const { profit, profitPercentage, allocationPercentage } = this.calculateBudgetMetrics(
      budget, 
      budgetStream.trades
    );

    budgetStream.profit = profit;
    budgetStream.profitPercentage = profitPercentage;
    budgetStream.allocationPercentage = allocationPercentage;
    budgetStream.lastUpdated = Date.now();

    // Emit budget update
    this.emitBudgetUpdate(strategyId);
  }

  /**
   * Get the current budget stream for a strategy
   * @param strategyId The strategy ID
   */
  public getBudgetStream(strategyId: string): {
    budget: StrategyBudget;
    trades: Trade[];
    profit: number;
    profitPercentage: number;
    allocationPercentage: number;
    lastUpdated: number;
  } | null {
    return this.budgetStreams.get(strategyId) || null;
  }

  /**
   * Get all budget streams
   */
  public getAllBudgetStreams(): Map<string, {
    budget: StrategyBudget;
    trades: Trade[];
    profit: number;
    profitPercentage: number;
    allocationPercentage: number;
    lastUpdated: number;
  }> {
    return new Map(this.budgetStreams);
  }

  /**
   * Update a budget stream with the latest data
   * @param strategyId The strategy ID
   */
  private updateBudgetStream(strategyId: string): void {
    const budgetStream = this.budgetStreams.get(strategyId);
    if (!budgetStream) return;

    try {
      // Get the latest budget from trade service
      const latestBudget = tradeService.getBudget(strategyId);
      if (!latestBudget) {
        logService.log('warn', `No budget found for strategy ${strategyId} during update`, null, 'BudgetStreamingService');
        return;
      }

      // Calculate allocated budget from active trades
      let allocatedFromTrades = 0;
      let totalProfit = 0;

      // Process each trade to calculate allocated budget and profit
      budgetStream.trades.forEach(trade => {
        // Only count open or pending trades for allocation
        if (trade.status === 'open' || trade.status === 'pending' || trade.status === 'executed') {
          // Calculate the trade cost (amount * entry price)
          const entryPrice = trade.entryPrice || trade.entry_price || 0;
          const amount = trade.amount || trade.quantity || 0;
          const tradeCost = entryPrice * amount;

          // Add to allocated budget
          if (tradeCost > 0) {
            allocatedFromTrades += tradeCost;
          }
        }

        // Add profit/loss from all trades
        const tradeProfit = trade.profit || 0;
        totalProfit += tradeProfit;
      });

      // In demo mode, we need to be more aggressive about updating the budget
      const isDemo = demoService.isInDemoMode();
      const allocated = isDemo ?
        allocatedFromTrades : // In demo mode, use our calculation
        Math.max(allocatedFromTrades, latestBudget.allocated); // In live mode, use the higher value

      // Calculate available budget (total - allocated)
      const available = latestBudget.total - allocated;

      // Calculate percentages
      const profitPercentage = latestBudget.total > 0 ? (totalProfit / latestBudget.total) * 100 : 0;
      const allocationPercentage = latestBudget.total > 0 ? (allocated / latestBudget.total) * 100 : 0;

      // Create the updated budget
      const updatedBudget = {
        ...latestBudget,
        allocated: Number(allocated.toFixed(2)),
        available: Number(available.toFixed(2))
      };

      // Update the budget stream
      budgetStream.budget = updatedBudget;
      budgetStream.profit = Number(totalProfit.toFixed(2));
      budgetStream.profitPercentage = Number(profitPercentage.toFixed(2));
      budgetStream.allocationPercentage = Number(allocationPercentage.toFixed(2));
      budgetStream.lastUpdated = Date.now();

      // If our calculation is different from the service, update the service
      if (isDemo || Math.abs(allocated - latestBudget.allocated) > 0.01 ||
          Math.abs(available - latestBudget.available) > 0.01) {
        // Update the trade service budget
        tradeService.setBudget(strategyId, updatedBudget);
      }

      // Emit budget update
      this.emitBudgetUpdate(strategyId);
    } catch (error) {
      logService.log('error', `Failed to update budget stream for strategy ${strategyId}`, error, 'BudgetStreamingService');
    }
  }

  /**
   * Calculate budget metrics
   * @param budget The budget
   * @param trades The trades
   */
  private calculateBudgetMetrics(budget: StrategyBudget, trades: Trade[]): {
    profit: number;
    profitPercentage: number;
    allocationPercentage: number;
  } {
    let allocatedFromTrades = 0;
    let totalProfit = 0;

    // Process each trade to calculate allocated budget and profit
    trades.forEach(trade => {
      // Only count open or pending trades for allocation
      if (trade.status === 'open' || trade.status === 'pending' || trade.status === 'executed') {
        // Calculate the trade cost (amount * entry price)
        const entryPrice = trade.entryPrice || trade.entry_price || 0;
        const amount = trade.amount || trade.quantity || 0;
        const tradeCost = entryPrice * amount;

        // Add to allocated budget
        if (tradeCost > 0) {
          allocatedFromTrades += tradeCost;
        }
      }

      // Add profit/loss from all trades
      const tradeProfit = trade.profit || 0;
      totalProfit += tradeProfit;
    });

    // In demo mode, we need to be more aggressive about updating the budget
    const isDemo = demoService.isInDemoMode();
    const allocated = isDemo ?
      allocatedFromTrades : // In demo mode, use our calculation
      Math.max(allocatedFromTrades, budget.allocated); // In live mode, use the higher value

    // Calculate percentages
    const profitPercentage = budget.total > 0 ? (totalProfit / budget.total) * 100 : 0;
    const allocationPercentage = budget.total > 0 ? (allocated / budget.total) * 100 : 0;

    return {
      profit: Number(totalProfit.toFixed(2)),
      profitPercentage: Number(profitPercentage.toFixed(2)),
      allocationPercentage: Number(allocationPercentage.toFixed(2))
    };
  }

  /**
   * Emit a budget update event
   * @param strategyId The strategy ID
   */
  private emitBudgetUpdate(strategyId: string): void {
    const budgetStream = this.budgetStreams.get(strategyId);
    if (!budgetStream) return;

    // Emit event with budget stream data
    this.emit('budgetStreamUpdated', {
      strategyId,
      budget: budgetStream.budget,
      profit: budgetStream.profit,
      profitPercentage: budgetStream.profitPercentage,
      allocationPercentage: budgetStream.allocationPercentage,
      lastUpdated: budgetStream.lastUpdated
    });

    // Also emit strategy-specific event
    this.emit(`budgetStreamUpdated:${strategyId}`, {
      strategyId,
      budget: budgetStream.budget,
      profit: budgetStream.profit,
      profitPercentage: budgetStream.profitPercentage,
      allocationPercentage: budgetStream.allocationPercentage,
      lastUpdated: budgetStream.lastUpdated
    });

    // Emit event to event bus for other components
    eventBus.emit('budgetStream:updated', {
      strategyId,
      budget: budgetStream.budget,
      profit: budgetStream.profit,
      profitPercentage: budgetStream.profitPercentage,
      allocationPercentage: budgetStream.allocationPercentage,
      lastUpdated: budgetStream.lastUpdated
    });
  }

  /**
   * Handle budget update from trade service
   */
  private handleBudgetUpdate = (data: any): void => {
    const { strategyId, budget } = data;
    if (!strategyId || !budget) return;

    // Update budget stream
    this.updateBudget(strategyId, budget);
  };

  /**
   * Handle trade update from trade service
   */
  private handleTradeUpdate = (data: any): void => {
    const strategyId = data.strategyId || data.trade?.strategyId;
    if (!strategyId) return;

    // Get all trades for this strategy
    const trades = tradeService.getTradesByStrategy(strategyId);
    
    // Update trades in budget stream
    this.updateTrades(strategyId, trades);
  };

  /**
   * Handle balance update from wallet balance service
   */
  private handleBalanceUpdate = (): void => {
    // Update all budget streams
    this.budgetStreams.forEach((_, strategyId) => {
      this.updateBudgetStream(strategyId);
    });
  };

  /**
   * Handle websocket message
   */
  private handleWebsocketMessage = (data: any): void => {
    // Only process relevant messages
    if (data.type === 'trade' || data.type === 'ticker') {
      // Update all budget streams
      this.budgetStreams.forEach((_, strategyId) => {
        this.updateBudgetStream(strategyId);
      });
    }
  };

  /**
   * Handle trade event from event bus
   */
  private handleTradeEvent = (data: any): void => {
    const strategyId = data.strategyId || data.trade?.strategyId;
    if (!strategyId) return;

    // Get all trades for this strategy
    const trades = tradeService.getTradesByStrategy(strategyId);
    
    // Update trades in budget stream
    this.updateTrades(strategyId, trades);
  };

  /**
   * Handle budget event from event bus
   */
  private handleBudgetEvent = (data: any): void => {
    const strategyId = data.strategyId;
    if (!strategyId) return;

    // Update budget stream
    this.updateBudgetStream(strategyId);
  };

  /**
   * Handle strategy event from event bus
   */
  private handleStrategyEvent = (data: any): void => {
    const strategyId = data.strategyId || data.strategy?.id;
    if (!strategyId) return;

    // Update budget stream
    this.updateBudgetStream(strategyId);
  };

  /**
   * Handle demo trade event from event bus
   */
  private handleDemoTradeEvent = (data: any): void => {
    const strategyId = data.strategyId || data.trade?.strategyId;
    if (!strategyId) return;

    // Update budget stream
    this.updateBudgetStream(strategyId);
  };

  /**
   * Handle ticker update from event bus
   */
  private handleTickerUpdate = (): void => {
    // Update all budget streams in demo mode
    if (demoService.isInDemoMode()) {
      this.budgetStreams.forEach((_, strategyId) => {
        this.updateBudgetStream(strategyId);
      });
    }
  };
}

// Export singleton instance
export const budgetStreamingService = BudgetStreamingService.getInstance();
