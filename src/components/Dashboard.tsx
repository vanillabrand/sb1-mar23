import React from 'react';
import { 
  analyticsService,
  monitoringService,
  logService 
} from '../lib/services';
import { 
  StrategyAssetPanel,
  ErrorBoundary,
  WidgetError 
} from './index';
import type { 
  Strategy,
  MonitoringStatus 
} from '../lib/types';

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

interface MonitoringStatus {
  status: 'active' | 'inactive' | 'error';
  lastUpdate: Date;
  strategy_id: string;
}

interface DashboardProps {
  strategies?: Strategy[];
  monitoringStatuses?: Record<string, MonitoringStatus>;
}

export function Dashboard({ 
  strategies: initialStrategies = [], 
  monitoringStatuses: initialStatuses = {} 
}: DashboardProps) {
  const [selectedTimezone, setSelectedTimezone] = useState('UTC');
  const screenSize = useScreenSize();
  const [volatility, setVolatility] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies);
  const [monitoringStatuses, setMonitoringStatuses] = useState<Record<string, MonitoringStatus>>(initialStatuses);
  const [error, setError] = useState<string | null>(null);

  const activeStrategies = useMemo(() => 
    strategies.filter(s => s.status === 'active'),
    [strategies]
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

    updateVolatility();
    const volatilityInterval = setInterval(updateVolatility, 60000);

    return () => {
      clearInterval(dateInterval);
      clearInterval(volatilityInterval);
    };
  }, []);

  useEffect(() => {
    const initializeMonitoring = async () => {
      try {
        await monitoringService.initialize();
        
        const statuses = await monitoringService.getAllMonitoringStatuses();
        const statusMap: Record<string, MonitoringStatus> = {};
        statuses.forEach(status => {
          statusMap[status.strategy_id] = status;
        });
        setMonitoringStatuses(statusMap);

        monitoringService.on('strategyCreated', (strategy: Strategy) => {
          setStrategies(prev => [...prev, strategy]);
        });

        monitoringService.on('strategyUpdated', (strategy: Strategy) => {
          setStrategies(prev => prev.map(s => s.id === strategy.id ? strategy : s));
        });

        monitoringService.on('strategyDeleted', (strategy: Strategy) => {
          setStrategies(prev => prev.filter(s => s.id !== strategy.id));
        });

        monitoringService.on('monitoringStatusUpdated', (status: MonitoringStatus) => {
          setMonitoringStatuses(prev => ({
            ...prev,
            [status.strategy_id]: status
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
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold text-gray-200">
          {currentDate.toLocaleDateString(undefined, { 
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
        <NetworkStatus />
      </div>

      <div className={`grid grid-cols-12 gap-8 ${screenSize === 'sm' ? 'grid-cols-1' : ''}`}>
        <div className={`${screenSize === 'sm' ? 'col-span-12' : 'col-span-12 lg:col-span-7'} space-y-8`}>
          <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
            <StrategyStatus strategies={strategies} monitoringStatuses={monitoringStatuses} />
          </div>

          <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
            <AIMarketInsight assets={allAssets} />
          </div>

          <PortfolioPerformance />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
              <RiskExposure assets={allAssets} />
            </div>
            <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
              <div className="flex flex-col h-full">
                <EmergencyStopButton />
              </div>
            </div>
          </div>
        </div>

        <div className={`${screenSize === 'sm' ? 'col-span-12' : 'col-span-12 lg:col-span-5'} space-y-8`}>
          <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
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
          </div>

          <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
            <DefconMonitor 
              strategies={activeStrategies} 
              className="mb-6"
            />
          </div>

          <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
            <NewsWidget assets={newsAssets} limit={screenSize === 'sm' ? 2 : 4} />
          </div>

          <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
            <AssetDistribution assets={allAssets} />
          </div>
        </div>
      </div>
    </div>
  );
}
