import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Calendar, Activity, TrendingUp, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  analyticsService,
  monitoringService,
  logService
} from '../lib/services';
import { eventBus } from '../lib/event-bus';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  StrategyAssetPanel,
  ErrorBoundary,
  WidgetError,
  NetworkStatus,
  StrategyStatus,
  AIMarketInsight,
  PortfolioPerformance,
  RiskExposure,
  EmergencyStopButton,
  NewsWidget,
  WorldClock,
  DefconMonitor,
  AssetDistribution,
  AnimatedPanel,
  AssetPairIndicators,
  VestaboardDisplay,
  AssetDisplayPanel
} from './index';
import { useScreenSize } from '../lib/hooks/useScreenSize';
import type {
  Strategy
} from '../lib/types';

// Define MonitoringStatus interface locally to avoid type errors
interface MonitoringStatus {
  strategyId: string;
  strategy_id?: string; // For backward compatibility
  status: string;
  lastUpdated?: string;
  lastUpdate?: Date | string;
  [key: string]: any; // Allow additional properties
}

const TIMEZONES = [
  { id: 'UTC', name: 'UTC' },
  { id: 'America/New_York', name: 'New York (EST)' },
  { id: 'America/Los_Angeles', name: 'Los Angeles (PST)' },
  { id: 'Europe/London', name: 'London (GMT)' },
  { id: 'Asia/Tokyo', name: 'Tokyo (JST)' },
  { id: 'Asia/Shanghai', name: 'Shanghai (CST)' },
  { id: 'Asia/Singapore', name: 'Singapore (SGT)' },
  { id: 'Australia/Sydney', name: 'Sydney (AEST)' },
  { id: 'Europe/Frankfurt', name: 'Frankfurt (CET)' },
  { id: 'Asia/Dubai', name: 'Dubai (GST)' }
];

interface DashboardProps {
  strategies: Strategy[];
  monitoringStatuses: Record<string, MonitoringStatus>;
}

export function Dashboard({ strategies: initialStrategies, monitoringStatuses: initialStatuses }: DashboardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedTimezone, setSelectedTimezone] = useState('UTC');
  const screenSize = useScreenSize();
  const [volatility, setVolatility] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [localStrategies, setLocalStrategies] = useState<Strategy[]>(initialStrategies);
  const [localMonitoringStatuses, setLocalMonitoringStatuses] = useState<Record<string, MonitoringStatus>>(initialStatuses);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const activeStrategies = useMemo(() =>
    localStrategies.filter(s => s.status === 'active'),
    [localStrategies]
  );

  const allAssets = useMemo(() => {
    const assets = new Set<string>();
    activeStrategies.forEach(strategy => {
      if (strategy.strategy_config?.assets) {
        strategy.strategy_config.assets.forEach((asset: string) => {
          if (asset) assets.add(asset);
        });
      }
    });
    return Array.from(assets);
  }, [activeStrategies]);

  const newsAssets = React.useMemo(() => {
    if (Array.from(allAssets).length > 0) {
      return Array.from(allAssets).map(asset => asset.split('_')[0]);
    }
    return ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];
  }, [allAssets]);

  useEffect(() => {
    const dateInterval = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    const updateVolatility = () => {
      const metrics = analyticsService.getDashboardMetrics();
      if (metrics?.riskProfile?.current) {
        setVolatility(metrics.riskProfile.current * 10);
      }
    };

    // Initial update
    updateVolatility();

    // Subscribe to real-time analytics updates
    const analyticsUpdateHandler = (data: any) => {
      // Update volatility when analytics are updated
      updateVolatility();

      // Force refresh of strategy components
      if (data && data.strategyId) {
        // This will trigger updates in child components that use this data
        eventBus.emit(`strategy:analytics:${data.strategyId}`, data);
      }
    };

    analyticsService.on('analyticsUpdate', analyticsUpdateHandler);

    // Fallback interval update (in case real-time updates fail)
    const volatilityInterval = setInterval(updateVolatility, 60000);

    return () => {
      clearInterval(dateInterval);
      clearInterval(volatilityInterval);
      analyticsService.off('analyticsUpdate', analyticsUpdateHandler);
    };
  }, []);

  useEffect(() => {
    const initializeMonitoring = async () => {
      try {
        await monitoringService.initialize();

        const statuses = await monitoringService.getAllMonitoringStatuses();
        const statusMap: Record<string, MonitoringStatus> = {};
        statuses.forEach(status => {
          // Use type assertion to handle property name differences
          const statusWithId = status as any;
          statusMap[statusWithId.strategyId || statusWithId.strategy_id] = statusWithId as unknown as MonitoringStatus;
        });
        setLocalMonitoringStatuses(statusMap);

        monitoringService.on('strategyCreated', (strategy: Strategy) => {
          setLocalStrategies(prev => [...prev, strategy]);
        });

        monitoringService.on('strategyUpdated', (strategy: Strategy) => {
          setLocalStrategies(prev => prev.map(s => s.id === strategy.id ? strategy : s));
        });

        monitoringService.on('strategyDeleted', (strategy: Strategy) => {
          setLocalStrategies(prev => prev.filter(s => s.id !== strategy.id));
        });

        monitoringService.on('monitoringStatusUpdated', (status: any) => {
          setLocalMonitoringStatuses(prev => ({
            ...prev,
            [status.strategyId || status.strategy_id]: status
          }));
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize monitoring';
        setError(errorMessage);
        logService.log('error', 'Failed to initialize monitoring:', error, 'Dashboard');
      }
    };

    initializeMonitoring();

    return () => {
      monitoringService.removeAllListeners();
    };
  }, []);

  const loadStrategies = async () => {
    if (!user) return;

    try {
      logService.log('info', 'Loading strategies and performance data', null, 'Dashboard');

      // Get strategies from the database
      const { data: strategiesData, error: strategiesError } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (strategiesError) {
        logService.log('error', 'Failed to load strategies:', strategiesError, 'Dashboard');
        throw strategiesError;
      }

      if (!strategiesData || strategiesData.length === 0) {
        setLocalStrategies([]);
        logService.log('info', 'No strategies found for user', null, 'Dashboard');
        return;
      }

      // Get trades for each strategy to calculate performance metrics
      const strategyIds = strategiesData.map(s => s.id);

      // Get all trades for these strategies
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .in('strategy_id', strategyIds);

      if (tradesError) {
        logService.log('error', 'Failed to load trades:', tradesError, 'Dashboard');
      }

      // Get all transactions for these strategies
      let transactionsData = [];
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .in('reference_id', strategyIds)
          .order('created_at', { ascending: false });

        if (error) {
          // Check if the error is because the table doesn't exist
          if (error.code === '42P01') { // PostgreSQL code for 'relation does not exist'
            logService.log('warn', 'Transactions table does not exist yet. This is normal if you haven\'t created it.', null, 'Dashboard');
          } else {
            logService.log('error', 'Failed to load transactions:', error, 'Dashboard');
          }
        } else {
          transactionsData = data || [];
        }
      } catch (err) {
        logService.log('error', 'Exception when loading transactions:', err, 'Dashboard');
      }

      // Get all strategy budgets
      let budgetsData = [];
      try {
        const { data, error } = await supabase
          .from('strategy_budgets')
          .select('*')
          .in('strategy_id', strategyIds);

        if (error) {
          // Check if the error is because the table doesn't exist
          if (error.code === '42P01') { // PostgreSQL code for 'relation does not exist'
            logService.log('warn', 'Strategy budgets table does not exist yet. This is normal if you haven\'t created it.', null, 'Dashboard');
          } else {
            logService.log('error', 'Failed to load strategy budgets:', error, 'Dashboard');
          }
        } else {
          budgetsData = data || [];
        }
      } catch (err) {
        logService.log('error', 'Exception when loading strategy budgets:', err, 'Dashboard');
      }

      // Calculate performance metrics for each strategy
      const updatedStrategies = strategiesData.map(strategy => {
        // Get trades for this strategy
        const strategyTrades = tradesData?.filter(t => t.strategy_id === strategy.id) || [];

        // Get transactions for this strategy
        const strategyTransactions = transactionsData?.filter(t => t.reference_id === strategy.id) || [];

        // Get budget for this strategy
        const strategyBudget = budgetsData?.find(b => b.strategy_id === strategy.id);

        // Calculate performance metrics
        let performance = 0;
        let totalTrades = strategyTrades.length;
        let winRate = 0;
        let activeTrades = 0;
        let closedTrades = 0;
        let totalProfit = 0;

        // Calculate trade statistics
        if (strategyTrades.length > 0) {
          // Count active and closed trades
          activeTrades = strategyTrades.filter(t => t.status === 'active' || t.status === 'pending' || t.status === 'executed').length;
          closedTrades = strategyTrades.filter(t => t.status === 'closed').length;

          // Calculate total profit from closed trades
          const closedTradesProfit = strategyTrades
            .filter(t => t.status === 'closed')
            .reduce((sum, trade) => sum + (trade.profit || 0), 0);

          // Calculate win rate
          const profitableTrades = strategyTrades
            .filter(t => t.status === 'closed' && (t.profit || 0) > 0)
            .length;

          winRate = closedTrades > 0 ? (profitableTrades / closedTrades) * 100 : 0;

          // Set performance based on closed trades profit
          totalProfit = closedTradesProfit;
        }

        // If we have transactions, use the most recent transaction's balance_after as the performance
        if (strategyTransactions.length > 0) {
          // Get the most recent transaction
          const latestTransaction = strategyTransactions[0];

          // Use the balance_after as the performance
          performance = latestTransaction.balance_after || totalProfit;
        } else {
          performance = totalProfit;
        }

        // Get budget information
        let budget = {
          total: 0,
          allocated: 0,
          available: 0
        };

        if (strategyBudget) {
          budget = {
            total: strategyBudget.total || 0,
            allocated: strategyBudget.allocated || 0,
            available: strategyBudget.available || 0
          };
        }

        // Update strategy with performance metrics
        return {
          ...strategy,
          performance: Number(performance.toFixed(2)),
          totalTrades: totalTrades,
          activeTrades: activeTrades,
          closedTrades: closedTrades,
          winRate: Number(winRate.toFixed(1)),
          budget: budget,
          profit: Number(totalProfit.toFixed(2))
        };
      });

      // Update local strategies state
      setLocalStrategies(updatedStrategies);

      // Calculate and log summary statistics
      const activeStrategies = updatedStrategies.filter(s => s.status === 'active').length;
      const totalPerformance = updatedStrategies.reduce((sum, s) => sum + (s.performance || 0), 0);
      const totalTrades = updatedStrategies.reduce((sum, s) => sum + (s.totalTrades || 0), 0);

      logService.log('info', `Loaded ${updatedStrategies.length} strategies with performance metrics`, {
        activeStrategies,
        totalPerformance: totalPerformance.toFixed(2),
        totalTrades
      }, 'Dashboard');

      // Emit event to notify other components
      eventBus.emit('dashboard:updated', {
        strategies: updatedStrategies,
        summary: {
          activeStrategies,
          totalPerformance,
          totalTrades
        }
      });
    } catch (error) {
      logService.log('error', 'Failed to load strategies:', error, 'Dashboard');
    }
  };

  const loadPerformanceMetrics = async () => {
    // This function would normally load performance metrics from the backend
    // For now, we'll just use a placeholder
    return Promise.resolve();
  };

  const loadActiveTrades = async () => {
    // This function would normally load active trades from the backend
    // For now, we'll just use a placeholder
    return Promise.resolve();
  };

  // Set up polling for dashboard data
  useEffect(() => {
    if (!user) return;

    // Initial load
    loadStrategies();

    // Set up polling interval (every 10 seconds)
    const pollingInterval = setInterval(() => {
      loadStrategies();
      logService.log('debug', 'Dashboard data refreshed via polling', null, 'Dashboard');
    }, 10000);

    return () => {
      clearInterval(pollingInterval);
    };
  }, [user]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    logService.log('info', 'Setting up real-time subscriptions for Dashboard', null, 'Dashboard');

    // Subscribe to strategy changes in the database
    const strategySubscription = supabase
      .channel('dashboard_strategies')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'strategies',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Handle real-time strategy updates
          if (payload.eventType === 'UPDATE') {
            logService.log('info', `Strategy ${payload.new.id} updated in database`, { status: payload.new.status }, 'Dashboard');

            // Force reload to ensure we have the latest data
            loadStrategies();
          } else if (payload.eventType === 'INSERT') {
            logService.log('info', 'New strategy created', null, 'Dashboard');
            loadStrategies();
          } else if (payload.eventType === 'DELETE') {
            logService.log('info', `Strategy ${payload.old.id} deleted`, null, 'Dashboard');
            loadStrategies();
          }
        }
      )
      .subscribe();

    // Subscribe to trade changes in the database
    const tradeSubscription = supabase
      .channel('dashboard_trades')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades'
        },
        (payload) => {
          const tradeId = payload.new?.id || payload.old?.id;
          if (tradeId) {
            logService.log('info', `Trade ${tradeId} ${payload.eventType.toLowerCase()}`, null, 'Dashboard');
          } else {
            logService.log('debug', `Received trade update with undefined ID, eventType: ${payload.eventType}`, payload, 'Dashboard');
          }
          loadStrategies();
        }
      )
      .subscribe();

    // Subscribe to transaction changes in the database
    const transactionSubscription = supabase
      .channel('dashboard_transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions'
        },
        (payload) => {
          logService.log('info', `Transaction ${payload.new?.id || payload.old?.id} ${payload.eventType.toLowerCase()}`, null, 'Dashboard');
          loadStrategies();
        }
      )
      .subscribe();

    // Subscribe to strategy budget changes in the database
    const budgetSubscription = supabase
      .channel('dashboard_budgets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'strategy_budgets'
        },
        (payload) => {
          logService.log('info', `Budget for strategy ${payload.new?.strategy_id || payload.old?.strategy_id} ${payload.eventType.toLowerCase()}`, null, 'Dashboard');
          loadStrategies();
        }
      )
      .subscribe();

    // Subscribe to event bus events
    const eventHandlers = [
      // Trade events
      { event: 'trade:created', handler: (data: any) => {
        logService.log('info', `Trade created for strategy ${data.strategyId || data.strategy?.id}`, null, 'Dashboard');
        loadStrategies();
      }},
      { event: 'trade:update', handler: (data: any) => {
        const tradeId = data.tradeId || data.trade?.id;
        if (tradeId) {
          logService.log('info', `Trade ${tradeId} updated`, null, 'Dashboard');
        } else {
          logService.log('debug', 'Received trade update event with undefined ID', data, 'Dashboard');
        }
        loadStrategies();
      }},
      { event: 'trade:closed', handler: (data: any) => {
        const tradeId = data.tradeId || data.trade?.id;
        if (tradeId) {
          logService.log('info', `Trade ${tradeId} closed`, null, 'Dashboard');
        } else {
          logService.log('debug', 'Received trade closed event with undefined ID', data, 'Dashboard');
        }
        loadStrategies();
      }},
      { event: 'trades:closed', handler: (data: any) => {
        logService.log('info', `Multiple trades closed for strategy ${data.strategyId}`, { count: data.tradeIds?.length }, 'Dashboard');
        loadStrategies();
      }},

      // Budget events
      { event: 'budget:updated', handler: (data: any) => {
        logService.log('info', `Budget updated for strategy ${data.strategyId}`, { newBudget: data.newBudget }, 'Dashboard');
        loadStrategies();
      }},

      // Strategy events
      { event: 'strategy:status', handler: (data: any) => {
        logService.log('info', `Strategy ${data.strategyId} status changed to ${data.status}`, null, 'Dashboard');
        loadStrategies();
      }},
      { event: 'strategy:deactivated', handler: (data: any) => {
        logService.log('info', `Strategy ${data.strategyId} deactivated`, { profitLoss: data.totalProfitLoss }, 'Dashboard');
        // Force immediate reload
        loadStrategies();
      }},
      { event: 'strategy:activated', handler: (data: any) => {
        logService.log('info', `Strategy ${data.strategyId} activated`, null, 'Dashboard');
        loadStrategies();
      }},

      // Dashboard specific events
      { event: 'dashboard:refresh', handler: (data: any) => {
        logService.log('info', `Dashboard refresh requested for strategy ${data.strategyId}`, null, 'Dashboard');
        // Force immediate reload
        loadStrategies();
      }},

      // Portfolio events
      { event: 'portfolio:updated', handler: (data: any) => {
        logService.log('info', `Portfolio updated for strategy ${data.strategyId}`, { action: data.action }, 'Dashboard');
        loadStrategies();
      }},

      // Transaction events
      { event: 'transaction:created', handler: (data: any) => {
        logService.log('info', `Transaction created for strategy ${data.strategyId}`, { type: data.type }, 'Dashboard');
        loadStrategies();
      }},

      // Global state update
      { event: 'app:state:updated', handler: (data: any) => {
        if (data.component === 'strategy' || data.component === 'trade' || data.component === 'portfolio') {
          logService.log('info', `App state updated: ${data.component} ${data.action}`, null, 'Dashboard');
          loadStrategies();
        }
      }}
    ];

    // Subscribe to all events
    const unsubscribers = eventHandlers.map(({ event, handler }) => {
      return eventBus.subscribe(event, handler);
    });

    return () => {
      // Unsubscribe from all subscriptions
      strategySubscription.unsubscribe();
      tradeSubscription.unsubscribe();
      transactionSubscription.unsubscribe();
      budgetSubscription.unsubscribe();

      // Unsubscribe from all event bus events
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadStrategies(),
        loadPerformanceMetrics(),
        loadActiveTrades()
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 pb-24 sm:pb-8 mobile-p-4">
      {/* Desktop Header with Date and Network Status */}
      <div className="hidden sm:flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="w-6 h-6 text-neon-yellow" />
            <h1 className="text-2xl font-bold gradient-text">
              {currentDate.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h1>
          </div>
        </div>
        <NetworkStatus />
      </div>

      {/* Mobile Header - Simplified */}
      <div className="sm:hidden mb-4">
        <h1 className="text-xl font-bold gradient-text text-center">Your Strategies</h1>
      </div>

      <div className={`grid grid-cols-12 gap-2 sm:gap-3 md:gap-5 ${screenSize === 'sm' ? 'grid-cols-1' : ''}`}>
        {/* DEFCON Monitor removed from mobile */}

        <div className={`${screenSize === 'sm' ? 'col-span-12' : 'col-span-12 lg:col-span-7'} space-y-4`}>
          {activeStrategies.length > 0 && (
            <AnimatedPanel index={0} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6">
              <StrategyStatus strategies={activeStrategies} />
            </AnimatedPanel>
          )}

          <AnimatedPanel index={2} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6">
            <AIMarketInsight assets={new Set(allAssets)} />
          </AnimatedPanel>

          <AnimatedPanel index={3} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-5 shadow-lg w-full">
            <PortfolioPerformance />
          </AnimatedPanel>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
            <AnimatedPanel index={4} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
              <RiskExposure assets={new Set(allAssets)} />
            </AnimatedPanel>
            <AnimatedPanel index={5} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
              <div className="flex flex-col h-full">
                <EmergencyStopButton />
              </div>
            </AnimatedPanel>
          </div>
        </div>

        <div className={`${screenSize === 'sm' ? 'col-span-12' : 'col-span-12 lg:col-span-5'} space-y-4`}>
          <AnimatedPanel index={6} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-neon-turquoise" />
                <select
                  value={selectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  className="bg-transparent text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-neon-turquoise rounded-lg"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.id} value={tz.id} className="bg-gunmetal-900">
                      {tz.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <WorldClock timezone={selectedTimezone} />
          </AnimatedPanel>

          {/* DEFCON Monitor - Only shown in sidebar on non-mobile */}
          {screenSize !== 'sm' && (
            <AnimatedPanel index={7} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-5 shadow-lg">
              <DefconMonitor
                strategies={activeStrategies}
                className="mb-2 sm:mb-3"
                volatility={volatility}
              />
            </AnimatedPanel>
          )}

          <AnimatedPanel index={8} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
            <ErrorBoundary fallback={
              <div className="p-4 text-center">
                <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-neon-turquoise via-neon-yellow to-neon-raspberry mb-2">
                  Asset Pair Indicators
                </h3>
                <p className="text-gray-400 text-sm">Unable to load asset data</p>
              </div>
            }>
              <AssetDisplayPanel />
            </ErrorBoundary>
          </AnimatedPanel>

          <AnimatedPanel index={9} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
            <NewsWidget assets={newsAssets} limit={screenSize === 'sm' ? 2 : 4} />
          </AnimatedPanel>

          <AnimatedPanel index={10} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
            <AssetDistribution assets={new Set(allAssets)} />
          </AnimatedPanel>
        </div>
      </div>
    </div>
  );
}
