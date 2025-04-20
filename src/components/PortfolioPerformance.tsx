import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Calendar,
  Download,
  Filter,
  Loader2,
  AlertCircle,
  X,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';
import { globalCacheService } from '../lib/global-cache-service';
import { portfolioService } from '../lib/portfolio-service';
import { eventBus } from '../lib/event-bus';
import { walletBalanceService } from '../lib/wallet-balance-service';
import { strategyMetricsService, StrategyMetrics } from '../lib/strategy-metrics-service';
import {
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ComposedChart,
  Cell,
  PieChart,
  Pie
} from 'recharts';

export function PortfolioPerformance() {
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'1h' | '1d' | '1w' | '1m'>('1d');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [downloadingCSV, setDownloadingCSV] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transactionType, setTransactionType] = useState<'all' | 'trade' | 'deposit' | 'withdrawal'>('all');
  const [portfolioSummary, setPortfolioSummary] = useState<any>(null);
  const [strategyMetrics, setStrategyMetrics] = useState<StrategyMetrics[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState<boolean>(false);

  // Separate useEffect for initial data loading
  useEffect(() => {
    loadPerformanceData();
    loadPortfolioSummary();
  }, [timeframe]);

  // Initialize and subscribe to strategy metrics service
  useEffect(() => {
    const initializeMetrics = async () => {
      try {
        setIsLoadingMetrics(true);

        // Initialize the metrics service if not already initialized
        if (!strategyMetricsService.getAllStrategyMetrics().length) {
          await strategyMetricsService.initialize();
        }

        // Get initial metrics
        const initialMetrics = strategyMetricsService.getAllStrategyMetrics();
        setStrategyMetrics(initialMetrics);

        // Update portfolio summary with metrics data
        updatePortfolioSummaryWithMetrics(initialMetrics);

        // Subscribe to metrics updates
        const handleAllMetricsUpdate = (updatedMetrics: StrategyMetrics[]) => {
          setStrategyMetrics(updatedMetrics);
          updatePortfolioSummaryWithMetrics(updatedMetrics);
        };

        strategyMetricsService.on('allMetricsUpdated', handleAllMetricsUpdate);

        return () => {
          strategyMetricsService.off('allMetricsUpdated', handleAllMetricsUpdate);
        };
      } catch (error) {
        logService.log('error', 'Failed to initialize strategy metrics', error, 'PortfolioPerformance');
      } finally {
        setIsLoadingMetrics(false);
      }
    };

    initializeMetrics();
  }, []);

  // Separate useEffect for real-time updates to avoid unnecessary redraws
  useEffect(() => {
    // Initialize the portfolio service
    portfolioService.initialize().catch(error => {
      logService.log('error', 'Failed to initialize portfolio service', error, 'PortfolioPerformance');
    });

    // Throttle function to prevent too many updates
    let updateTimeout: NodeJS.Timeout | null = null;
    const throttledUpdate = () => {
      if (updateTimeout) return; // Skip if an update is already scheduled

      updateTimeout = setTimeout(() => {
        loadPortfolioSummary(); // Only update the summary values
        updateTimeout = null;
      }, 500); // Throttle to max once per 500ms
    };

    // More aggressive throttling for performance data to avoid graph redraws
    let performanceUpdateTimeout: NodeJS.Timeout | null = null;
    const throttledPerformanceUpdate = () => {
      if (performanceUpdateTimeout) return; // Skip if an update is already scheduled

      performanceUpdateTimeout = setTimeout(() => {
        loadPerformanceData(); // Update the graph data
        performanceUpdateTimeout = null;
      }, 2000); // Throttle to max once per 2 seconds
    };

    // Set up polling for portfolio data
    const pollingInterval = setInterval(() => {
      throttledUpdate();
      throttledPerformanceUpdate();
      logService.log('debug', 'Portfolio performance data refreshed via polling', null, 'PortfolioPerformance');
    }, 15000); // Every 15 seconds

    // Subscribe to dashboard updates
    const dashboardUpdatedUnsubscribe = eventBus.subscribe('dashboard:updated', (data: any) => {
      logService.log('info', 'Dashboard updated, refreshing portfolio performance', data.summary, 'PortfolioPerformance');
      throttledUpdate(); // Update summary immediately
      throttledPerformanceUpdate(); // Schedule graph update
    });

    // Set up real-time subscription to trade updates
    const tradeCreatedUnsubscribe = eventBus.subscribe('trade:created', (_data: any) => {
      throttledUpdate(); // Update summary immediately
      throttledPerformanceUpdate(); // Schedule graph update
    });

    const tradeUpdatedUnsubscribe = eventBus.subscribe('trade:update', (_data: any) => {
      throttledUpdate(); // Update summary immediately
      throttledPerformanceUpdate(); // Schedule graph update
    });

    const tradeClosedUnsubscribe = eventBus.subscribe('trade:closed', (_data: any) => {
      logService.log('info', 'Trade closed, updating portfolio performance', null, 'PortfolioPerformance');
      throttledUpdate(); // Update summary immediately
      throttledPerformanceUpdate(); // Schedule graph update
    });

    const budgetUpdatedUnsubscribe = eventBus.subscribe('budget:updated', (_data: any) => {
      throttledUpdate(); // Update summary immediately
      throttledPerformanceUpdate(); // Schedule graph update
    });

    // Subscribe to transaction events
    const transactionUnsubscribe = eventBus.subscribe('transaction', (data: any) => {
      logService.log('info', 'Transaction recorded, updating portfolio performance', {
        type: data.type,
        amount: data.amount,
        strategyId: data.strategyId
      }, 'PortfolioPerformance');
      throttledUpdate(); // Update summary immediately
      throttledPerformanceUpdate(); // Schedule graph update
    });

    // Subscribe to transaction created events
    const transactionCreatedUnsubscribe = eventBus.subscribe('transaction:created', (data: any) => {
      logService.log('info', 'New transaction created, updating portfolio performance', {
        type: data.type,
        amount: data.amount,
        strategyId: data.strategyId
      }, 'PortfolioPerformance');
      throttledUpdate(); // Update summary immediately
      throttledPerformanceUpdate(); // Schedule graph update
    });

    // Subscribe to strategy status changes
    const strategyStatusUnsubscribe = eventBus.subscribe('strategy:status', (_data: any) => {
      logService.log('info', `Strategy status changed to ${_data.status}, updating portfolio performance`, null, 'PortfolioPerformance');
      throttledUpdate(); // Update summary immediately
      throttledPerformanceUpdate(); // Schedule graph update
    });

    // Subscribe to strategy deactivation
    const strategyDeactivatedUnsubscribe = eventBus.subscribe('strategy:deactivated', (_data: any) => {
      logService.log('info', `Strategy ${_data.strategyId} deactivated, updating portfolio performance`, null, 'PortfolioPerformance');
      throttledUpdate(); // Update summary immediately
      throttledPerformanceUpdate(); // Schedule graph update
    });

    // Set up real-time subscription to database changes
    const dbSubscriptions = [];

    // Strategy changes
    const strategySubscription = supabase
      .channel('portfolio_strategies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'strategies' }, (payload) => {
        logService.log('info', `Strategy ${payload.new?.id || payload.old?.id} ${payload.eventType.toLowerCase()}, updating portfolio performance`, null, 'PortfolioPerformance');
        throttledUpdate(); // Update summary immediately
        throttledPerformanceUpdate(); // Schedule graph update
      })
      .subscribe();
    dbSubscriptions.push(strategySubscription);

    // Trade changes
    const tradeSubscription = supabase
      .channel('portfolio_trades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new.status === 'closed' && payload.old.status !== 'closed') {
          logService.log('info', `Trade ${payload.new.id} closed, updating portfolio performance`, null, 'PortfolioPerformance');
          throttledUpdate(); // Update summary immediately
          throttledPerformanceUpdate(); // Schedule graph update
        }
      })
      .subscribe();
    dbSubscriptions.push(tradeSubscription);

    // Transaction changes
    const transactionSubscription = supabase
      .channel('portfolio_transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        logService.log('info', 'Transaction database change, updating portfolio performance', null, 'PortfolioPerformance');
        throttledUpdate(); // Update summary immediately
        throttledPerformanceUpdate(); // Schedule graph update
      })
      .subscribe();
    dbSubscriptions.push(transactionSubscription);

    // Set up real-time subscription to wallet balance updates
    const balanceUpdateHandler = () => {
      throttledUpdate(); // Update summary immediately
      throttledPerformanceUpdate(); // Schedule graph update
    };

    walletBalanceService.on('balancesUpdated', balanceUpdateHandler);

    // Clean up subscriptions and timeouts on unmount
    return () => {
      clearInterval(pollingInterval);

      // Unsubscribe from event bus events
      dashboardUpdatedUnsubscribe();
      tradeCreatedUnsubscribe();
      tradeUpdatedUnsubscribe();
      tradeClosedUnsubscribe();
      budgetUpdatedUnsubscribe();
      transactionUnsubscribe();
      transactionCreatedUnsubscribe();
      strategyStatusUnsubscribe();
      strategyDeactivatedUnsubscribe();

      // Unsubscribe from database subscriptions
      dbSubscriptions.forEach(subscription => subscription.unsubscribe());

      // Unsubscribe from wallet balance updates
      walletBalanceService.off('balancesUpdated', balanceUpdateHandler);

      // Clear any pending timeouts
      if (updateTimeout) clearTimeout(updateTimeout);
      if (performanceUpdateTimeout) clearTimeout(performanceUpdateTimeout);
    };
  }, []);

  /**
   * Handle downloading transactions as CSV
   */
  const handleDownloadCSV = async () => {
    try {
      setDownloadingCSV(true);
      setError(null);

      // If modal is open, use the date range from the modal
      if (showTransactionModal && startDate && endDate) {
        // Validate date range
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > end) {
          throw new Error('Start date must be before end date');
        }

        // Get CSV data from portfolio service
        const csv = await portfolioService.exportTransactionsCSV(start, end, transactionType);

        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `transactions_${startDate}_${endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Close modal after successful download
        setShowTransactionModal(false);
      } else {
        // Use timeframe for date range
        const end = new Date();
        let start = new Date();

        switch (timeframe) {
          case '1h':
            start.setHours(start.getHours() - 1);
            break;
          case '1d':
            start.setDate(start.getDate() - 1);
            break;
          case '1w':
            start.setDate(start.getDate() - 7);
            break;
          case '1m':
            start.setMonth(start.getMonth() - 1);
            break;
        }

        // Get CSV data from portfolio service
        const csv = await portfolioService.exportTransactionsCSV(start, end, 'all');

        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `portfolio_transactions_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to download transactions';
      logService.log('error', 'Failed to download transactions as CSV', error, 'PortfolioPerformance');
      setError(errorMessage);
    } finally {
      setDownloadingCSV(false);
    }
  };

  const loadPerformanceData = async () => {
    try {
      // Only show loading state on initial load, not on updates
      if (performanceData.length === 0) {
        setLoading(true);
      }
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Handle unauthenticated state gracefully
        setPerformanceData([]);
        setLoading(false);
        return;
      }

      // Use the global cache service to get portfolio data
      const data = await globalCacheService.getPortfolioData(timeframe);

      if (data && Array.isArray(data) && data.length > 0) {
        // Get portfolio summary to extract strategy data
        const summary = await globalCacheService.getPortfolioSummary();

        if (summary && summary.strategies && summary.strategies.length > 0) {
          // Enhance performance data with per-strategy values
          const enhancedData = data.map(dataPoint => {
            const enhancedPoint = { ...dataPoint };

            // For each strategy, add its estimated value at this point
            summary.strategies.forEach((strategy: any) => {
              // Calculate the strategy's value at this point based on its current contribution
              // This is an approximation - in a real system, you'd have actual historical data
              const contribution = strategy.contribution / 100;
              const strategyValue = dataPoint.value * contribution;

              // Add strategy data with a prefix to avoid name collisions
              enhancedPoint[`strategy_${strategy.name}`] = strategyValue;
            });

            return enhancedPoint;
          });

          // Only update state if data has actually changed to prevent unnecessary rerenders
          if (JSON.stringify(enhancedData) !== JSON.stringify(performanceData)) {
            setPerformanceData(enhancedData);
            logService.log('info', 'Updated performance chart data', { timeframe, dataPoints: enhancedData.length }, 'PortfolioPerformance');
          }
        } else if (JSON.stringify(data) !== JSON.stringify(performanceData)) {
          setPerformanceData(data);
          logService.log('info', 'Updated performance chart data (no strategies)', { timeframe, dataPoints: data.length }, 'PortfolioPerformance');
        }
      } else if (performanceData.length === 0) {
        // If no data in cache and we don't have data yet, generate sample data for demo purposes
        const sampleData = generateSamplePerformanceData(timeframe);
        setPerformanceData(sampleData);
        logService.log('info', 'Generated sample performance data', { timeframe, dataPoints: sampleData.length }, 'PortfolioPerformance');
      }

      setLoading(false);
    } catch (error) {
      logService.log('error', 'Failed to load performance data', error, 'PortfolioPerformance');
      setError('Failed to load performance data. Please try again later.');
      setLoading(false);
    }
  };

  /**
   * Update portfolio summary with metrics data
   * @param metrics Array of strategy metrics
   */
  const updatePortfolioSummaryWithMetrics = (metrics: StrategyMetrics[]) => {
    if (!metrics || metrics.length === 0) return;

    try {
      // Calculate total portfolio value
      const totalValue = metrics.reduce((sum, metric) => sum + metric.currentValue, 0);

      // Calculate starting value
      const startingValue = metrics.reduce((sum, metric) => sum + metric.startingValue, 0);

      // Skip update if all values are zero
      if (totalValue === 0 && startingValue === 0) {
        // Check if we already have valid data in the portfolio summary
        if (portfolioSummary && portfolioSummary.currentValue > 0) {
          logService.log('info', 'Skipping portfolio summary update - all values are zero and we have existing data', null, 'PortfolioPerformance');
          return;
        }
      }

      // Calculate total change and percent change
      const totalChange = totalValue - startingValue;
      const percentChange = startingValue > 0 ? (totalChange / startingValue) * 100 : 0;

      // Calculate total trades and profitable trades
      const totalTrades = metrics.reduce((sum, metric) => sum + metric.totalTrades, 0);
      const profitableTrades = metrics.reduce((sum, metric) => sum + metric.profitableTrades, 0);

      // Calculate win rate
      const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

      // Update contribution percentages
      const metricsWithContribution = metrics.map(metric => ({
        ...metric,
        contribution: totalValue > 0 ? (metric.currentValue / totalValue) * 100 : 0
      }));

      // Update strategy metrics service with new contribution values
      strategyMetricsService.updateContributions(totalValue);

      // Create portfolio summary object
      const summary = {
        currentValue: totalValue,
        startingValue,
        totalChange,
        percentChange,
        totalTrades,
        profitableTrades,
        winRate,
        strategies: metricsWithContribution.map(metric => ({
          id: metric.id,
          name: metric.name,
          currentValue: metric.currentValue,
          startingValue: metric.startingValue,
          totalChange: metric.totalChange,
          percentChange: metric.percentChange,
          totalTrades: metric.totalTrades,
          profitableTrades: metric.profitableTrades,
          winRate: metric.winRate,
          contribution: metric.contribution,
          status: metric.status
        }))
      };

      // Update portfolio summary state
      setPortfolioSummary(summary);

      // Update global cache
      globalCacheService.setPortfolioSummary(summary);

      logService.log('info', 'Updated portfolio summary with metrics data', {
        strategies: summary.strategies.length,
        currentValue: summary.currentValue,
        totalChange: summary.totalChange
      }, 'PortfolioPerformance');
    } catch (error) {
      logService.log('error', 'Failed to update portfolio summary with metrics', error, 'PortfolioPerformance');
    }
  };

  const loadPortfolioSummary = async () => {
    try {
      logService.log('info', 'Loading portfolio summary data', null, 'PortfolioPerformance');

      // First, try to get data from the global cache
      const summary = await globalCacheService.getPortfolioSummary();

      if (summary) {
        // Skip update if all values are zero and we already have valid data
        if (summary.currentValue === 0 && summary.startingValue === 0 && portfolioSummary && portfolioSummary.currentValue > 0) {
          logService.log('info', 'Skipping portfolio summary update from cache - all values are zero and we have existing data', null, 'PortfolioPerformance');
          return;
        }

        // Only update state if data has actually changed to prevent unnecessary rerenders
        if (JSON.stringify(summary) !== JSON.stringify(portfolioSummary)) {
          setPortfolioSummary(summary);
          logService.log('info', 'Updated portfolio summary data from cache', {
            strategies: summary.strategies?.length || 0,
            currentValue: summary.currentValue,
            totalChange: summary.totalChange,
            totalTrades: summary.totalTrades
          }, 'PortfolioPerformance');
        }
      } else {
        // If not in cache, fetch directly from the database
        // Get all strategies
        const { data: strategies, error: strategiesError } = await supabase
          .from('strategies')
          .select('*');

        if (strategiesError) {
          logService.log('error', 'Failed to load strategies', strategiesError, 'PortfolioPerformance');
        }

        // Get all transactions
        let transactions = [];
        try {
          const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            // Check if the error is because the table doesn't exist
            if (error.code === '42P01') { // PostgreSQL code for 'relation does not exist'
              logService.log('warn', 'Transactions table does not exist yet. This is normal if you haven\'t created it.', null, 'PortfolioPerformance');
            } else {
              logService.log('error', 'Failed to load transactions:', error, 'PortfolioPerformance');
            }
          } else {
            transactions = data || [];
          }
        } catch (err) {
          logService.log('error', 'Exception when loading transactions:', err, 'PortfolioPerformance');
        }

        // Get all trades
        const { data: trades, error: tradesError } = await supabase
          .from('trades')
          .select('*');

        if (tradesError) {
          logService.log('error', 'Failed to load trades', tradesError, 'PortfolioPerformance');
        }

        // Calculate portfolio summary
        const calculatedSummary = {
          currentValue: 0,
          startingValue: 0,
          totalChange: 0,
          percentChange: 0,
          totalTrades: trades?.length || 0,
          profitableTrades: trades?.filter(t => (t.profit || 0) > 0)?.length || 0,
          winRate: 0,
          strategies: []
        };

        // Calculate win rate
        if (calculatedSummary.totalTrades > 0) {
          calculatedSummary.winRate = (calculatedSummary.profitableTrades / calculatedSummary.totalTrades) * 100;
        }

        // Get the most recent transaction to determine current value
        if (transactions && transactions.length > 0) {
          calculatedSummary.currentValue = transactions[0].balance_after || 0;

          // Find the oldest transaction to determine starting value
          const oldestTransaction = transactions[transactions.length - 1];
          calculatedSummary.startingValue = oldestTransaction.balance_before || 0;

          // Calculate total change and percent change
          calculatedSummary.totalChange = calculatedSummary.currentValue - calculatedSummary.startingValue;
          if (calculatedSummary.startingValue > 0) {
            calculatedSummary.percentChange = (calculatedSummary.totalChange / calculatedSummary.startingValue) * 100;
          }
        }

        // Calculate strategy-specific metrics
        if (strategies && strategies.length > 0) {
          calculatedSummary.strategies = strategies.map(strategy => {
            // Get trades for this strategy
            const strategyTrades = trades?.filter(t => t.strategy_id === strategy.id) || [];

            // Calculate strategy metrics
            const totalTrades = strategyTrades.length;
            const profitableTrades = strategyTrades.filter(t => (t.profit || 0) > 0).length;
            const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;
            const totalProfit = strategyTrades.reduce((sum, trade) => sum + (trade.profit || 0), 0);

            // Get strategy transactions
            const strategyTransactions = transactions?.filter(t => t.reference_id === strategy.id) || [];

            // Calculate current value and starting value
            let currentValue = 0;
            let startingValue = 0;

            if (strategyTransactions.length > 0) {
              currentValue = strategyTransactions[0].balance_after || 0;
              startingValue = strategyTransactions[strategyTransactions.length - 1].balance_before || 0;
            }

            // Calculate change and percent change
            const totalChange = currentValue - startingValue;
            const percentChange = startingValue > 0 ? (totalChange / startingValue) * 100 : 0;

            // Calculate contribution to overall portfolio
            const contribution = calculatedSummary.currentValue > 0 ? (currentValue / calculatedSummary.currentValue) * 100 : 0;

            return {
              id: strategy.id,
              name: strategy.name || strategy.title,
              currentValue,
              startingValue,
              totalChange,
              percentChange,
              totalTrades,
              profitableTrades,
              winRate,
              contribution
            };
          });
        }

        // Skip update if all values are zero and we already have valid data
        if (calculatedSummary.currentValue === 0 && calculatedSummary.startingValue === 0 && portfolioSummary && portfolioSummary.currentValue > 0) {
          logService.log('info', 'Skipping portfolio summary update from database - all values are zero and we have existing data', null, 'PortfolioPerformance');
        } else {
          // Update state with calculated summary
          setPortfolioSummary(calculatedSummary);

          // Update global cache
          globalCacheService.setPortfolioSummary(calculatedSummary);

          logService.log('info', 'Updated portfolio summary data from database', {
            strategies: calculatedSummary.strategies?.length || 0,
            currentValue: calculatedSummary.currentValue,
            totalChange: calculatedSummary.totalChange,
            totalTrades: calculatedSummary.totalTrades
          }, 'PortfolioPerformance');
        }

        // If we still don't have portfolio summary data, use sample data
        if (!portfolioSummary && (!calculatedSummary.strategies || calculatedSummary.strategies.length === 0)) {
            // Generate sample summary for demo purposes only if we don't have data yet
            const sampleSummary = {
              currentValue: 12450.75,
              startingValue: 10000,
              totalChange: 2450.75,
              percentChange: 24.51,
              totalTrades: 42,
              profitableTrades: 28,
              winRate: 66.67,
              strategies: [
                {
                  id: 'strategy-1',
                  name: 'Momentum Alpha',
                  currentValue: 4357.76,
                  startingValue: 3500,
                  totalChange: 857.76,
                  percentChange: 24.51,
                  totalTrades: 18,
                  profitableTrades: 12,
                  winRate: 66.67,
                  contribution: 35
                },
                {
                  id: 'strategy-2',
                  name: 'Trend Follower',
                  currentValue: 3112.69,
                  startingValue: 2500,
                  totalChange: 612.69,
                  percentChange: 24.51,
                  totalTrades: 12,
                  profitableTrades: 8,
                  winRate: 66.67,
                  contribution: 25
                },
                {
                  id: 'strategy-3',
                  name: 'Volatility Edge',
                  currentValue: 2490.15,
                  startingValue: 2000,
                  totalChange: 490.15,
                  percentChange: 24.51,
                  totalTrades: 8,
                  profitableTrades: 5,
                  winRate: 62.5,
                  contribution: 20
                },
                {
                  id: 'strategy-4',
                  name: 'Swing Trader',
                  currentValue: 1867.61,
                  startingValue: 1500,
                  totalChange: 367.61,
                  percentChange: 24.51,
                  totalTrades: 4,
                  profitableTrades: 3,
                  winRate: 75.0,
                  contribution: 15
                },
                {
                  id: 'strategy-5',
                  name: 'Market Neutral',
                  currentValue: 622.54,
                  startingValue: 500,
                  totalChange: 122.54,
                  percentChange: 24.51,
                  totalTrades: 0,
                  profitableTrades: 0,
                  winRate: 0,
                  contribution: 5
                }
              ]
            };
            setPortfolioSummary(sampleSummary);
          }
      }
    } catch (error) {
      logService.log('error', 'Failed to load portfolio summary', error, 'PortfolioPerformance');
    }
  };

  // Generate sample performance data for demo purposes
  const generateSamplePerformanceData = (timeframe: string) => {
    const data = [];
    const now = Date.now();
    let interval: number;
    let points: number;

    switch (timeframe) {
      case '1h':
        interval = 5 * 60 * 1000; // 5 minutes
        points = 12;
        break;
      case '1d':
        interval = 60 * 60 * 1000; // 1 hour
        points = 24;
        break;
      case '1w':
        interval = 6 * 60 * 60 * 1000; // 6 hours
        points = 28;
        break;
      case '1m':
        interval = 24 * 60 * 60 * 1000; // 1 day
        points = 30;
        break;
      default:
        interval = 60 * 60 * 1000; // 1 hour
        points = 24;
    }

    // Sample strategies with their contribution percentages
    const sampleStrategies = [
      { name: 'Momentum Alpha', contribution: 35 },
      { name: 'Trend Follower', contribution: 25 },
      { name: 'Volatility Edge', contribution: 20 },
      { name: 'Swing Trader', contribution: 15 },
      { name: 'Market Neutral', contribution: 5 }
    ];

    let value = 10000; // Starting value
    let previousValue = value;

    // Initialize strategy values
    const strategyValues: Record<string, number> = {};
    sampleStrategies.forEach(strategy => {
      strategyValues[strategy.name] = value * (strategy.contribution / 100);
    });

    for (let i = points; i >= 0; i--) {
      // Add some randomness to the value (trending upward)
      const change = (Math.random() * 200) - 50; // Random change between -50 and +150
      value += change;
      value = Math.max(value, 9000); // Ensure value doesn't go below 9000

      const pointChange = value - previousValue;
      const percentChange = previousValue !== 0 ? (pointChange / previousValue) * 100 : 0;

      // Create data point with total portfolio value
      const dataPoint: Record<string, any> = {
        date: now - (i * interval),
        value: value,
        change: pointChange,
        percentChange: percentChange
      };

      // Add strategy-specific values with different growth patterns
      sampleStrategies.forEach(strategy => {
        // Each strategy has slightly different performance characteristics
        const strategyChange = change * (1 + (Math.random() * 0.5 - 0.25)); // +/- 25% variance
        const strategyValue = strategyValues[strategy.name] + (strategyChange * (strategy.contribution / 100));
        strategyValues[strategy.name] = Math.max(strategyValue, 0); // Ensure non-negative

        // Add to data point with strategy_ prefix
        dataPoint[`strategy_${strategy.name}`] = strategyValues[strategy.name];
      });

      data.push(dataPoint);
      previousValue = value;
    }

    return data;
  };



  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-neon-raspberry" />
          <h2 className="text-lg font-bold gradient-text">Portfolio Performance</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-gunmetal-800 rounded-lg p-0.5">
            {(['1h', '1d', '1w', '1m'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-1 py-0.5 rounded text-xs ${
                  timeframe === tf
                    ? 'bg-neon-raspberry text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Download CSV Button */}
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1 px-2 py-1 bg-gunmetal-800 text-gray-200 rounded-lg hover:bg-gunmetal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            disabled={downloadingCSV || performanceData.length === 0}
          >
            {downloadingCSV ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            CSV
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-neon-pink/10 border border-neon-pink/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-neon-pink" />
          <p className="text-neon-pink">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
        </div>
      ) : performanceData.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-300 text-lg mb-2">No Performance Data</p>
          <p className="text-gray-400">Start trading to see your portfolio performance</p>
        </div>
      ) : (
        <>
          {/* Portfolio Summary Stats - Consolidated Panel */}
          <div className="bg-gunmetal-900/50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-gunmetal-800/50 rounded-lg p-2">
              <p className="text-gray-400 text-xs leading-tight mb-0.5 whitespace-normal">Current Value</p>
              <p className="text-base md:text-lg font-bold text-white truncate" key={`value-${portfolioSummary?.currentValue || 0}`}>
                ${portfolioSummary?.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="bg-gunmetal-800/50 rounded-lg p-2">
              <p className="text-gray-400 text-xs leading-tight mb-0.5 whitespace-normal">Profit/Loss</p>
              <div className="flex items-baseline">
                <p
                  className={`text-base md:text-lg font-bold truncate ${(portfolioSummary?.totalChange || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}
                  key={`profit-${portfolioSummary?.totalChange || 0}`}
                >
                  {(portfolioSummary?.totalChange || 0) >= 0 ? '+' : ''}
                  ${Math.abs(portfolioSummary?.totalChange || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-xs ml-1 flex-shrink-0" key={`percent-${portfolioSummary?.percentChange || 0}`}>
                  ({(portfolioSummary?.percentChange || 0).toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="bg-gunmetal-800/50 rounded-lg p-2">
              <p className="text-gray-400 text-xs leading-tight mb-0.5 whitespace-normal">Total Trades</p>
              <p className="text-base md:text-lg font-bold text-white" key={`trades-${portfolioSummary?.totalTrades || 0}`}>
                {portfolioSummary?.totalTrades || 0}
              </p>
            </div>
            <div className="bg-gunmetal-800/50 rounded-lg p-2">
              <p className="text-gray-400 text-xs leading-tight mb-0.5 whitespace-normal">Win Rate</p>
              <p className="text-base md:text-lg font-bold text-white" key={`winrate-${portfolioSummary?.winRate || 0}`}>
                {(portfolioSummary?.winRate || 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

          {/* Performance Chart - Smaller Size */}
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={performanceData}
                // Add key to prevent unnecessary redraws
                key={`chart-${timeframe}`}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#6B7280"
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                  height={20}
                />
                <YAxis
                  stroke="#6B7280"
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(17, 24, 39, 0.8)',
                    border: '1px solid rgba(75, 85, 99, 0.4)',
                    borderRadius: '8px',
                    backdropFilter: 'blur(4px)',
                    fontSize: '12px',
                    padding: '8px'
                  }}
                  labelStyle={{ color: '#9CA3AF', fontSize: '11px' }}
                  formatter={(value: number, name: string) => {
                    // Format based on the data key
                    if (name === 'value') return [`$${value.toLocaleString()}`, 'Total Value'];
                    // For strategy-specific lines
                    if (name.startsWith('strategy_')) {
                      const strategyName = name.replace('strategy_', '');
                      return [`$${value.toLocaleString()}`, strategyName];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  // Use isAnimationActive={false} to prevent animation on updates
                  isAnimationActive={false}
                />
                <Legend
                  verticalAlign="top"
                  height={20}
                  iconSize={8}
                  wrapperStyle={{ fontSize: '10px' }}
                  formatter={(value) => {
                    if (value === 'value') return 'Total Portfolio';
                    if (value.startsWith('strategy_')) {
                      return value.replace('strategy_', '');
                    }
                    return value;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Portfolio Value"
                  stroke="#2dd4bf"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                  // Disable animation for smoother updates
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Strategy Breakdown */}
          {portfolioSummary?.strategies && portfolioSummary.strategies.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-neon-pink mb-3">Strategy Breakdown</h3>

              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {/* Strategy Contribution Pie Chart */}
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <Pie
                          data={portfolioSummary.strategies.map((strategy: any) => ({
                            name: strategy.name,
                            value: strategy.contribution
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={60}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => {
                            // Truncate long strategy names
                            const displayName = name.length > 10 ? name.substring(0, 8) + '...' : name;
                            return `${displayName}: ${(percent * 100).toFixed(0)}%`;
                          }}
                        >
                          {portfolioSummary.strategies.map((_entry: any, index: number) => {
                            const colors = ['#2dd4bf', '#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171'];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`${value.toFixed(1)}%`, 'Contribution']}
                          contentStyle={{
                            backgroundColor: 'rgba(17, 24, 39, 0.8)',
                            border: '1px solid rgba(75, 85, 99, 0.4)',
                            borderRadius: '8px',
                            fontSize: '11px',
                            padding: '6px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Strategy Performance Table */}
                  <div className="lg:col-span-2 table-container">
                    <table className="w-full text-xs text-left">
                      <thead className="text-xs text-gray-400 uppercase bg-gunmetal-800/50">
                        <tr>
                          <th className="px-2 py-1.5">Strategy</th>
                          <th className="px-2 py-1.5">Value</th>
                          <th className="px-2 py-1.5">P/L</th>
                          <th className="px-2 py-1.5">Win Rate</th>
                          <th className="px-2 py-1.5">Trades</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioSummary.strategies.map((strategy: any) => (
                          <tr key={strategy.id} className="border-b border-gunmetal-800/50 hover:bg-gunmetal-800/30">
                            <td className="px-2 py-1.5 font-medium text-white">{strategy.name}</td>
                            <td className="px-2 py-1.5">${strategy.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="px-2 py-1.5">
                              <span className={strategy.totalChange >= 0 ? 'text-green-500' : 'text-red-500'}>
                                {strategy.totalChange >= 0 ? '+' : ''}
                                ${Math.abs(strategy.totalChange).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                <span className="text-xs ml-1">({strategy.percentChange.toFixed(1)}%)</span>
                              </span>
                            </td>
                            <td className="px-2 py-1.5">{strategy.winRate.toFixed(1)}%</td>
                            <td className="px-2 py-1.5">{strategy.totalTrades}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Additional Strategy Metrics */}
                <div className="bg-gunmetal-800/30 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-gray-300 mb-3">Strategy Metrics Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Avg Win Rate</p>
                      <p className="text-sm text-white">
                        {portfolioSummary.strategies.length > 0
                          ? (portfolioSummary.strategies.reduce((sum: number, s: any) => sum + s.winRate, 0) / portfolioSummary.strategies.length).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Active Strategies</p>
                      <p className="text-sm text-white">
                        {portfolioSummary.strategies.filter((s: any) => s.status === 'active').length} / {portfolioSummary.strategies.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Trades</p>
                      <p className="text-sm text-white">
                        {portfolioSummary.strategies.reduce((sum: number, s: any) => sum + s.totalTrades, 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Profitable Trades</p>
                      <p className="text-sm text-white">
                        {portfolioSummary.strategies.reduce((sum: number, s: any) => sum + (s.profitableTrades || 0), 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Export Button - Moved to bottom left */}
      <div className="mt-3">
        <button
          onClick={() => setShowTransactionModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-gunmetal-800 text-gray-200 rounded-lg hover:text-neon-turquoise transition-colors text-xs"
        >
          <Download className="w-3 h-3" />
          Export Transactions
        </button>
      </div>

      {/* Transaction Export Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold gradient-text">Export Transactions</h3>
              <button
                onClick={() => setShowTransactionModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Start Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  End Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Transaction Type
                </label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value as typeof transactionType)}
                    className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent appearance-none"
                  >
                    <option value="all">All Transactions</option>
                    <option value="trade">Trades Only</option>
                    <option value="deposit">Deposits Only</option>
                    <option value="withdrawal">Withdrawals Only</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowTransactionModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownloadCSV}
                  disabled={downloadingCSV || !startDate || !endDate}
                  className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300 disabled:opacity-50"
                >
                  {downloadingCSV ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download CSV
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
