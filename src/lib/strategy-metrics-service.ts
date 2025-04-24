import { supabase } from './supabase';
import { logService } from './log-service';
import { EventEmitter } from './event-emitter';
import { walletBalanceService } from './wallet-balance-service';

export interface StrategyMetrics {
  id: string;
  name: string;
  currentValue: number;
  startingValue: number;
  totalChange: number;
  percentChange: number;
  totalTrades: number;
  activeTrades: number;
  completedTrades: number;
  profitableTrades: number;
  winRate: number;
  avgTradeProfit: number;
  avgTradeDuration: number; // in minutes
  lastTradeTime: number | null; // timestamp
  lastTradeProfit: number | null;
  status: 'active' | 'inactive';
  riskLevel: 'low' | 'medium' | 'high';
  marketType: string;
  budget: {
    allocated: number;
    total: number;
    allocationPercentage: number;
    profit: number;
    profitPercentage: number;
  };
  contribution: number; // Percentage contribution to overall portfolio
  updatedAt: number; // timestamp
}

class StrategyMetricsService extends EventEmitter {
  private static instance: StrategyMetricsService;
  private initialized: boolean = false;
  private metricsCache: Map<string, StrategyMetrics> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private subscriptions: any[] = [];

  // Update interval in milliseconds (5 seconds)
  private readonly UPDATE_INTERVAL = 5000;

  private constructor() {
    super();
  }

  static getInstance(): StrategyMetricsService {
    if (!StrategyMetricsService.instance) {
      StrategyMetricsService.instance = new StrategyMetricsService();
    }
    return StrategyMetricsService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logService.log('info', 'Initializing strategy metrics service', null, 'StrategyMetricsService');

      // Set up real-time subscriptions
      this.setupSubscriptions();

      // Start periodic updates
      this.startPeriodicUpdates();

      // Initial data load
      await this.refreshAllMetrics();

      this.initialized = true;
      logService.log('info', 'Strategy metrics service initialized', null, 'StrategyMetricsService');
    } catch (error) {
      logService.log('error', 'Failed to initialize strategy metrics service', error, 'StrategyMetricsService');
      throw error;
    }
  }

  private setupSubscriptions(): void {
    try {
      // Subscribe to strategy changes
      const strategySubscription = supabase
        .channel('strategy_metrics_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'strategies' }, (payload) => {
          this.handleStrategyChange(payload);
        })
        .subscribe();

      // Subscribe to trade changes
      const tradeSubscription = supabase
        .channel('strategy_metrics_trades')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, (payload) => {
          this.handleTradeChange(payload);
        })
        .subscribe();

      // Subscribe to budget changes
      const budgetSubscription = supabase
        .channel('strategy_metrics_budgets')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'strategy_budgets' }, (payload) => {
          this.handleBudgetChange(payload);
        })
        .subscribe();

      this.subscriptions.push(strategySubscription, tradeSubscription, budgetSubscription);

      // Subscribe to wallet balance updates
      walletBalanceService.on('balancesUpdated', () => {
        this.refreshAllMetrics();
      });

      logService.log('info', 'Strategy metrics subscriptions set up', null, 'StrategyMetricsService');
    } catch (error) {
      logService.log('error', 'Failed to set up strategy metrics subscriptions', error, 'StrategyMetricsService');
    }
  }

  private startPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.refreshAllMetrics().catch(error => {
        logService.log('error', 'Failed to refresh strategy metrics', error, 'StrategyMetricsService');
      });
    }, this.UPDATE_INTERVAL);

    logService.log('info', 'Strategy metrics periodic updates started', null, 'StrategyMetricsService');
  }

  private async handleStrategyChange(payload: any): Promise<void> {
    try {
      const strategyId = payload.new?.id || payload.old?.id;
      if (!strategyId) return;

      logService.log('info', `Strategy change detected for ID: ${strategyId}`, null, 'StrategyMetricsService');

      // Refresh metrics for this strategy
      await this.refreshStrategyMetrics(strategyId);
    } catch (error) {
      logService.log('error', 'Failed to handle strategy change', error, 'StrategyMetricsService');
    }
  }

  private async handleTradeChange(payload: any): Promise<void> {
    try {
      const strategyId = payload.new?.strategy_id || payload.old?.strategy_id;
      if (!strategyId) return;

      logService.log('info', `Trade change detected for strategy ID: ${strategyId}`, null, 'StrategyMetricsService');

      // Refresh metrics for this strategy
      await this.refreshStrategyMetrics(strategyId);
    } catch (error) {
      logService.log('error', 'Failed to handle trade change', error, 'StrategyMetricsService');
    }
  }

  private async handleBudgetChange(payload: any): Promise<void> {
    try {
      const strategyId = payload.new?.strategy_id || payload.old?.strategy_id;
      if (!strategyId) return;

      logService.log('info', `Budget change detected for strategy ID: ${strategyId}`, null, 'StrategyMetricsService');

      // Refresh metrics for this strategy
      await this.refreshStrategyMetrics(strategyId);
    } catch (error) {
      logService.log('error', 'Failed to handle budget change', error, 'StrategyMetricsService');
    }
  }

  async refreshAllMetrics(): Promise<void> {
    try {
      // Get all strategies
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('*');

      if (error) {
        throw error;
      }

      if (!strategies || strategies.length === 0) {
        return;
      }

      // Process each strategy
      for (const strategy of strategies) {
        await this.refreshStrategyMetrics(strategy.id);
      }

      // Emit event for all metrics updated
      this.emit('allMetricsUpdated', Array.from(this.metricsCache.values()));

    } catch (error) {
      logService.log('error', 'Failed to refresh all strategy metrics', error, 'StrategyMetricsService');
      throw error;
    }
  }

  async refreshStrategyMetrics(strategyId: string): Promise<StrategyMetrics | null> {
    try {
      // Get strategy details
      const { data: strategy, error: strategyError } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', strategyId)
        .single();

      if (strategyError || !strategy) {
        throw strategyError || new Error(`Strategy not found: ${strategyId}`);
      }

      // Get trades for this strategy
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('strategy_id', strategyId);

      if (tradesError) {
        throw tradesError;
      }

      // Get budget for this strategy
      let budgetData = null;
      try {
        const { data, error } = await supabase
          .from('strategy_budgets')
          .select('*')
          .eq('strategy_id', strategyId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') { // "no rows returned" - this is fine
            logService.log('info', `No budget found for strategy ${strategyId}`, null, 'StrategyMetricsService');
          } else if (error.status === 406) { // Not Acceptable - likely auth issue
            logService.log('warn', `Authentication issue when fetching budget for strategy ${strategyId}`, error, 'StrategyMetricsService');
            // Check auth status to help debug
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              logService.log('warn', 'No active session found when fetching budget', null, 'StrategyMetricsService');
            } else {
              logService.log('info', 'Session exists but still got 406 error', {
                userId: session.user.id,
                expires: new Date(session.expires_at * 1000).toISOString()
              }, 'StrategyMetricsService');
            }
          } else {
            logService.log('error', `Error fetching budget for strategy ${strategyId}`, error, 'StrategyMetricsService');
          }
        } else {
          budgetData = data;
        }
      } catch (budgetError) {
        logService.log('error', `Exception fetching budget for strategy ${strategyId}`, budgetError, 'StrategyMetricsService');
      }

      // Calculate metrics
      const activeTrades = trades?.filter(t => t.status === 'open' || t.status === 'pending') || [];
      const completedTrades = trades?.filter(t => t.status === 'closed') || [];
      const profitableTrades = completedTrades.filter(t => (t.profit || 0) > 0);

      // Calculate win rate
      const winRate = completedTrades.length > 0
        ? (profitableTrades.length / completedTrades.length) * 100
        : 0;

      // Calculate average trade profit
      const avgTradeProfit = completedTrades.length > 0
        ? completedTrades.reduce((sum, trade) => sum + (trade.profit || 0), 0) / completedTrades.length
        : 0;

      // Calculate average trade duration
      const avgTradeDuration = completedTrades.length > 0
        ? completedTrades.reduce((sum, trade) => {
            const openTime = new Date(trade.open_time || trade.created_at).getTime();
            const closeTime = new Date(trade.close_time || trade.updated_at).getTime();
            return sum + (closeTime - openTime) / (1000 * 60); // Convert to minutes
          }, 0) / completedTrades.length
        : 0;

      // Get last trade info
      const lastTrade = completedTrades.sort((a, b) => {
        const aTime = new Date(a.close_time || a.updated_at).getTime();
        const bTime = new Date(b.close_time || b.updated_at).getTime();
        return bTime - aTime; // Sort descending
      })[0];

      const lastTradeTime = lastTrade
        ? new Date(lastTrade.close_time || lastTrade.updated_at).getTime()
        : null;

      const lastTradeProfit = lastTrade ? lastTrade.profit : null;

      // Calculate budget metrics
      const budget = budgetData ? {
        allocated: budgetData.allocated || 0,
        total: budgetData.total || 0,
        allocationPercentage: budgetData.total > 0
          ? (budgetData.allocated / budgetData.total) * 100
          : 0,
        profit: budgetData.profit || 0,
        profitPercentage: budgetData.allocated > 0
          ? (budgetData.profit || 0) / budgetData.allocated * 100
          : 0
      } : {
        allocated: 0,
        total: 0,
        allocationPercentage: 0,
        profit: 0,
        profitPercentage: 0
      };

      // Calculate value metrics
      const startingValue = budget.allocated;
      const currentValue = budget.allocated + budget.profit;
      const totalChange = budget.profit;
      const percentChange = startingValue > 0
        ? (totalChange / startingValue) * 100
        : 0;

      // Calculate contribution to portfolio
      // This is a placeholder - we'll update it when we have the total portfolio value
      const contribution = 0;

      // Create metrics object
      const metrics: StrategyMetrics = {
        id: strategyId,
        name: strategy.name || strategy.title || 'Unnamed Strategy',
        currentValue,
        startingValue,
        totalChange,
        percentChange,
        totalTrades: trades?.length || 0,
        activeTrades: activeTrades.length,
        completedTrades: completedTrades.length,
        profitableTrades: profitableTrades.length,
        winRate,
        avgTradeProfit,
        avgTradeDuration,
        lastTradeTime,
        lastTradeProfit,
        status: strategy.status || 'inactive',
        riskLevel: strategy.risk_level || 'medium',
        marketType: strategy.market_type || 'spot',
        budget,
        contribution,
        updatedAt: Date.now()
      };

      // Update cache
      this.metricsCache.set(strategyId, metrics);

      // Emit event for this strategy
      this.emit('metricsUpdated', strategyId, metrics);

      return metrics;
    } catch (error) {
      logService.log('error', `Failed to refresh metrics for strategy ${strategyId}`, error, 'StrategyMetricsService');
      return null;
    }
  }

  /**
   * Update contribution percentages based on total portfolio value
   * @param totalPortfolioValue The total portfolio value
   */
  updateContributions(totalPortfolioValue: number): void {
    if (totalPortfolioValue <= 0) return;

    // Update contribution for each strategy
    for (const [strategyId, metrics] of this.metricsCache.entries()) {
      const contribution = totalPortfolioValue > 0
        ? (metrics.currentValue / totalPortfolioValue) * 100
        : 0;

      // Update the metrics
      const updatedMetrics = {
        ...metrics,
        contribution
      };

      // Update cache
      this.metricsCache.set(strategyId, updatedMetrics);

      // Emit event for this strategy
      this.emit('metricsUpdated', strategyId, updatedMetrics);
    }

    // Emit event for all metrics updated
    this.emit('allMetricsUpdated', Array.from(this.metricsCache.values()));
  }

  /**
   * Get metrics for a specific strategy
   * @param strategyId The strategy ID
   * @returns The strategy metrics or null if not found
   */
  getStrategyMetrics(strategyId: string): StrategyMetrics | null {
    return this.metricsCache.get(strategyId) || null;
  }

  /**
   * Get metrics for all strategies
   * @returns Array of strategy metrics
   */
  getAllStrategyMetrics(): StrategyMetrics[] {
    return Array.from(this.metricsCache.values());
  }

  /**
   * Get active strategy metrics
   * @returns Array of active strategy metrics
   */
  getActiveStrategyMetrics(): StrategyMetrics[] {
    return Array.from(this.metricsCache.values())
      .filter(metrics => metrics.status === 'active');
  }

  /**
   * Calculate total portfolio value from all strategies
   * @returns The total portfolio value
   */
  getTotalPortfolioValue(): number {
    return Array.from(this.metricsCache.values())
      .reduce((sum, metrics) => sum + metrics.currentValue, 0);
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
    this.metricsCache.clear();
    this.initialized = false;

    logService.log('info', 'Strategy metrics service cleaned up', null, 'StrategyMetricsService');
  }
}

export const strategyMetricsService = StrategyMetricsService.getInstance();
