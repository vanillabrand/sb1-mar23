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
  AnimatedPanel
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
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocalStrategies(data || []);
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

  useEffect(() => {
    loadStrategies();

    if (!user) return;

    const subscription = supabase
      .channel('dashboard_strategies')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'strategies',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadStrategies();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
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
          <AnimatedPanel index={0} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
            <StrategyStatus strategies={activeStrategies} />
          </AnimatedPanel>

          <AnimatedPanel index={0} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
            <AIMarketInsight assets={new Set(allAssets)} />
          </AnimatedPanel>

          <AnimatedPanel index={0} className="w-full">
            <PortfolioPerformance />
          </AnimatedPanel>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
            <AnimatedPanel index={0} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
              <RiskExposure assets={new Set(allAssets)} />
            </AnimatedPanel>
            <AnimatedPanel index={0} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
              <div className="flex flex-col h-full">
                <EmergencyStopButton />
              </div>
            </AnimatedPanel>
          </div>
        </div>

        <div className={`${screenSize === 'sm' ? 'col-span-12' : 'col-span-12 lg:col-span-5'} space-y-4`}>
          <AnimatedPanel index={0} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
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
            <AnimatedPanel index={0} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-5 shadow-lg">
              <DefconMonitor
                strategies={activeStrategies}
                className="mb-2 sm:mb-3"
                volatility={volatility}
              />
            </AnimatedPanel>
          )}

          <AnimatedPanel index={0} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
            <NewsWidget assets={newsAssets} limit={screenSize === 'sm' ? 2 : 4} />
          </AnimatedPanel>

          <AnimatedPanel index={0} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
            <AssetDistribution assets={new Set(allAssets)} />
          </AnimatedPanel>
        </div>
      </div>
    </div>
  );
}
