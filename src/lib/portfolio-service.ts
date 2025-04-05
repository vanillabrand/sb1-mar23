import { supabase } from './supabase';
import { logService } from './log-service';
import { transactionService } from './transaction-service';
import { EventEmitter } from './event-emitter';
import type { Transaction } from './transaction-service';

export interface PerformanceDataPoint {
  date: number; // timestamp
  value: number; // portfolio value
  change: number; // change since previous point
  percentChange: number; // percent change
}

export interface StrategyPerformance {
  id: string;
  name: string;
  currentValue: number;
  startingValue: number;
  totalChange: number;
  percentChange: number;
  totalTrades: number;
  profitableTrades: number;
  winRate: number;
  contribution: number; // Percentage contribution to overall portfolio
}

export interface PortfolioSummary {
  currentValue: number;
  startingValue: number;
  totalChange: number;
  percentChange: number;
  totalTrades: number;
  profitableTrades: number;
  winRate: number;
  strategies: StrategyPerformance[]; // Performance breakdown by strategy
}

class PortfolioService extends EventEmitter {
  private static instance: PortfolioService;
  private initialized: boolean = false;

  // Cache for performance data
  private performanceCache: Map<string, PerformanceDataPoint[]> = new Map();
  private lastCacheUpdate: Map<string, number> = new Map();

  // Cache TTL in milliseconds (15 minutes)
  private readonly CACHE_TTL = 15 * 60 * 1000;

  private constructor() {
    super();
  }

  static getInstance(): PortfolioService {
    if (!PortfolioService.instance) {
      PortfolioService.instance = new PortfolioService();
    }
    return PortfolioService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logService.log('info', 'Initializing portfolio service', null, 'PortfolioService');

      // Subscribe to transaction events to update performance data
      transactionService.on('transaction', this.handleTransactionEvent.bind(this));

      this.initialized = true;
      logService.log('info', 'Portfolio service initialized', null, 'PortfolioService');
    } catch (error) {
      logService.log('error', 'Failed to initialize portfolio service', error, 'PortfolioService');
      throw error;
    }
  }

  private handleTransactionEvent(transaction: Transaction): void {
    // Clear cache when new transactions occur to force refresh
    this.clearCache();

    // Emit event for subscribers
    this.emit('performanceUpdate', transaction);
  }

  private clearCache(): void {
    this.performanceCache.clear();
    this.lastCacheUpdate.clear();
  }

  /**
   * Get portfolio performance data for a specific timeframe
   * @param timeframe The timeframe to get data for ('1h', '1d', '1w', '1m')
   * @returns Array of performance data points
   */
  async getPerformanceData(timeframe: '1h' | '1d' | '1w' | '1m' = '1d'): Promise<PerformanceDataPoint[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Check if we have cached data that's still valid
      const cacheKey = `performance_${timeframe}`;
      const lastUpdate = this.lastCacheUpdate.get(cacheKey) || 0;
      const now = Date.now();

      if (this.performanceCache.has(cacheKey) && (now - lastUpdate) < this.CACHE_TTL) {
        return this.performanceCache.get(cacheKey) || [];
      }

      // Calculate date range based on timeframe
      const endDate = new Date();
      let startDate: Date;

      switch (timeframe) {
        case '1h':
          startDate = new Date(endDate.getTime() - (60 * 60 * 1000));
          break;
        case '1d':
          startDate = new Date(endDate.getTime() - (24 * 60 * 60 * 1000));
          break;
        case '1w':
          startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000));
          break;
        case '1m':
          startDate = new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000));
          break;
        default:
          startDate = new Date(endDate.getTime() - (24 * 60 * 60 * 1000));
      }

      // Get all transactions within the date range
      const transactions = await transactionService.getTransactionsForUser(startDate, endDate);

      if (transactions.length === 0) {
        return [];
      }

      // Sort transactions by date (oldest first)
      transactions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Generate performance data points
      const performanceData = this.generatePerformanceData(transactions, timeframe);

      // Cache the results
      this.performanceCache.set(cacheKey, performanceData);
      this.lastCacheUpdate.set(cacheKey, now);

      return performanceData;
    } catch (error) {
      logService.log('error', 'Failed to get performance data', error, 'PortfolioService');
      throw error;
    }
  }

  /**
   * Generate performance data points from transactions
   * @param transactions Array of transactions
   * @param timeframe The timeframe to generate data for
   * @returns Array of performance data points
   */
  private generatePerformanceData(transactions: Transaction[], timeframe: string): PerformanceDataPoint[] {
    if (transactions.length === 0) {
      return [];
    }

    // Get the first and last transaction dates
    const firstTxDate = new Date(transactions[0].created_at).getTime();
    const lastTxDate = new Date(transactions[transactions.length - 1].created_at).getTime();

    // Determine the interval between data points based on timeframe
    let interval: number;
    let timeWindow: number;
    switch (timeframe) {
      case '1h':
        interval = 5 * 60 * 1000; // 5 minutes
        timeWindow = 60 * 60 * 1000; // 1 hour
        break;
      case '1d':
        interval = 60 * 60 * 1000; // 1 hour
        timeWindow = 24 * 60 * 60 * 1000; // 24 hours
        break;
      case '1w':
        interval = 6 * 60 * 60 * 1000; // 6 hours
        timeWindow = 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      case '1m':
        interval = 24 * 60 * 60 * 1000; // 1 day
        timeWindow = 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
      default:
        interval = 60 * 60 * 1000; // 1 hour
        timeWindow = 24 * 60 * 60 * 1000; // 24 hours
    }

    // Filter transactions to only include those within the time window
    const now = Date.now();
    const startTime = now - timeWindow;
    const filteredTransactions = transactions.filter(tx =>
      new Date(tx.created_at).getTime() >= startTime
    );

    // If no transactions in the time window, use the most recent transaction as starting point
    if (filteredTransactions.length === 0 && transactions.length > 0) {
      filteredTransactions.push(transactions[transactions.length - 1]);
    }

    // Group transactions by strategy
    const strategyTransactions: Record<string, Transaction[]> = {};

    // Include all transactions, but also track by strategy
    for (const tx of filteredTransactions) {
      // Add to all transactions
      const strategyId = tx.reference_id || 'unknown';
      if (!strategyTransactions[strategyId]) {
        strategyTransactions[strategyId] = [];
      }
      strategyTransactions[strategyId].push(tx);
    }

    // Create data points at regular intervals
    const dataPoints: PerformanceDataPoint[] = [];
    let currentDate = Math.max(startTime, firstTxDate);
    let previousValue = filteredTransactions.length > 0 ?
      filteredTransactions[0].balance_before :
      (transactions.length > 0 ? transactions[transactions.length - 1].balance_after : 0);

    // Track the last known value for each strategy
    const strategyValues: Record<string, number> = {};

    while (currentDate <= now) {
      // Calculate total portfolio value at this point in time
      let totalValue = 0;
      let hasUpdates = false;

      // Process each strategy's transactions up to this point
      Object.keys(strategyTransactions).forEach(strategyId => {
        const txs = strategyTransactions[strategyId];
        let latestValue = strategyValues[strategyId] || 0;

        // Find all transactions for this strategy that occurred before or at the current date
        for (let i = 0; i < txs.length; i++) {
          const txDate = new Date(txs[i].created_at).getTime();
          if (txDate <= currentDate) {
            latestValue = txs[i].balance_after;
            hasUpdates = true;
          } else {
            break;
          }
        }

        // Update the strategy's latest value
        strategyValues[strategyId] = latestValue;
        totalValue += latestValue;
      });

      // Only add data points when we have updates or it's the first/last point
      if (hasUpdates || dataPoints.length === 0 || currentDate === now) {
        // Calculate change since previous data point
        const change = totalValue - previousValue;
        const percentChange = previousValue !== 0 ? (change / previousValue) * 100 : 0;

        // Add data point
        dataPoints.push({
          date: currentDate,
          value: totalValue,
          change,
          percentChange
        });

        // Update for next iteration
        previousValue = totalValue;
      }

      // Move to next interval
      currentDate += interval;
    }

    // Ensure we include the latest value
    if (dataPoints.length > 0 && dataPoints[dataPoints.length - 1].date < now) {
      // Calculate the final portfolio value
      const finalValue = Object.values(strategyValues).reduce((sum, val) => sum + val, 0);
      const change = finalValue - previousValue;
      const percentChange = previousValue !== 0 ? (change / previousValue) * 100 : 0;

      dataPoints.push({
        date: now,
        value: finalValue,
        change,
        percentChange
      });
    }

    return dataPoints;
  }

  /**
   * Get portfolio summary statistics
   * @returns Portfolio summary
   */
  async getPortfolioSummary(): Promise<PortfolioSummary | null> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Get all transactions
      const transactions = await transactionService.getTransactionsForUser();

      if (transactions.length === 0) {
        return null;
      }

      // Sort transactions by date (oldest first)
      transactions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Overall portfolio metrics
      const startingValue = transactions[0].balance_before;
      const currentValue = transactions[transactions.length - 1].balance_after;
      const totalChange = currentValue - startingValue;
      const percentChange = startingValue !== 0 ? (totalChange / startingValue) * 100 : 0;

      // Count trades
      const trades = transactions.filter(tx => tx.type === 'trade');
      const profitableTrades = trades.filter(tx => tx.amount > 0);
      const winRate = trades.length > 0 ? (profitableTrades.length / trades.length) * 100 : 0;

      // Group transactions by strategy
      const strategyTransactions: Record<string, Transaction[]> = {};
      const strategyNames: Record<string, string> = {};

      for (const tx of transactions) {
        const strategyId = tx.reference_id || 'unknown';
        const strategyName = tx.metadata?.strategy_name || tx.metadata?.name || 'Unknown Strategy';

        if (!strategyTransactions[strategyId]) {
          strategyTransactions[strategyId] = [];
          strategyNames[strategyId] = strategyName;
        }

        strategyTransactions[strategyId].push(tx);
      }

      // Calculate per-strategy performance
      const strategyPerformance: StrategyPerformance[] = [];

      for (const [strategyId, txs] of Object.entries(strategyTransactions)) {
        // Sort strategy transactions by date
        txs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const strategyStartingValue = txs[0].balance_before;
        const strategyCurrentValue = txs[txs.length - 1].balance_after;
        const strategyTotalChange = strategyCurrentValue - strategyStartingValue;
        const strategyPercentChange = strategyStartingValue !== 0 ?
          (strategyTotalChange / strategyStartingValue) * 100 : 0;

        // Count strategy trades
        const strategyTrades = txs.filter(tx => tx.type === 'trade');
        const strategyProfitableTrades = strategyTrades.filter(tx => tx.amount > 0);
        const strategyWinRate = strategyTrades.length > 0 ?
          (strategyProfitableTrades.length / strategyTrades.length) * 100 : 0;

        // Calculate contribution to overall portfolio
        const contribution = currentValue > 0 ? (strategyCurrentValue / currentValue) * 100 : 0;

        strategyPerformance.push({
          id: strategyId,
          name: strategyNames[strategyId],
          currentValue: strategyCurrentValue,
          startingValue: strategyStartingValue,
          totalChange: strategyTotalChange,
          percentChange: strategyPercentChange,
          totalTrades: strategyTrades.length,
          profitableTrades: strategyProfitableTrades.length,
          winRate: strategyWinRate,
          contribution
        });
      }

      // Sort strategies by contribution (highest first)
      strategyPerformance.sort((a, b) => b.contribution - a.contribution);

      return {
        currentValue,
        startingValue,
        totalChange,
        percentChange,
        totalTrades: trades.length,
        profitableTrades: profitableTrades.length,
        winRate,
        strategies: strategyPerformance
      };
    } catch (error) {
      logService.log('error', 'Failed to get portfolio summary', error, 'PortfolioService');
      return null;
    }
  }

  /**
   * Export transactions as CSV
   * @param startDate Start date for transactions
   * @param endDate End date for transactions
   * @param type Transaction type filter
   * @returns CSV string
   */
  async exportTransactionsCSV(
    startDate: Date,
    endDate: Date,
    type: 'all' | 'trade' | 'deposit' | 'withdrawal' = 'all'
  ): Promise<string> {
    try {
      // Get transactions for the date range
      let transactions = await transactionService.getTransactionsForUser(startDate, endDate);

      // Filter by type if needed
      if (type !== 'all') {
        transactions = transactions.filter(tx => tx.type === type);
      }

      if (transactions.length === 0) {
        throw new Error('No transactions found for the selected period');
      }

      // Format transactions for CSV
      const csvData = transactions.map(tx => ({
        Date: new Date(tx.created_at).toLocaleString(),
        Type: tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
        Amount: tx.amount.toFixed(2),
        'Balance Before': tx.balance_before.toFixed(2),
        'Balance After': tx.balance_after.toFixed(2),
        Status: tx.status.charAt(0).toUpperCase() + tx.status.slice(1),
        Description: tx.description || ''
      }));

      // Generate CSV
      const headers = Object.keys(csvData[0]);
      const csv = [
        headers.join(','),
        ...csvData.map(row => headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in values
          return /[,"]/.test(value)
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(','))
      ].join('\n');

      return csv;
    } catch (error) {
      logService.log('error', 'Failed to export transactions as CSV', error, 'PortfolioService');
      throw error;
    }
  }

  cleanup(): void {
    this.performanceCache.clear();
    this.lastCacheUpdate.clear();
    this.initialized = false;
  }
}

export const portfolioService = PortfolioService.getInstance();
