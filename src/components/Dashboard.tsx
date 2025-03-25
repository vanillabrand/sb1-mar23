import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity,
  Clock,
  Globe,
  AlertCircle
} from 'lucide-react';
import { useStrategies } from '../hooks/useStrategies';
import { NewsWidget } from './NewsWidget';
import { WorldClock } from './WorldClock';
import { AIMarketInsight } from './AIMarketInsight';
import { PortfolioPerformance } from './PortfolioPerformance';
import { RiskExposure } from './RiskExposure';
import { NetworkStatus } from './NetworkStatus';
import { StrategyStatus } from './StrategyStatus';
import { useScreenSize } from '../lib/hooks/useScreenSize';
import { AssetDistribution } from './AssetDistribution';
import { DefconMonitor } from './DefconMonitor';
import { EmergencyStopButton } from './EmergencyStopButton';
import { analyticsService } from '../lib/analytics-service';

const TIMEZONES = [
  { id: 'UTC', name: 'UTC', offset: 0 },
  { id: 'America/New_York', name: 'New York', offset: -4 },
  { id: 'Europe/London', name: 'London', offset: 1 },
  { id: 'Asia/Tokyo', name: 'Tokyo', offset: 9 },
  { id: 'Asia/Shanghai', name: 'Shanghai', offset: 8 },
  { id: 'Asia/Singapore', name: 'Singapore', offset: 8 }
];

export default function Dashboard() {
  const { strategies } = useStrategies();
  const [selectedTimezone, setSelectedTimezone] = useState('UTC');
  const screenSize = useScreenSize();
  const [volatility, setVolatility] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Memoize active strategies
  const activeStrategies = React.useMemo(() => 
    strategies.filter(s => s.status === 'active'),
    [strategies]
  );

  // Memoize unique assets
  const allAssets = React.useMemo(() => {
    const assets = new Set<string>();
    activeStrategies.forEach(strategy => {
      if (strategy.strategy_config?.assets) {
        strategy.strategy_config.assets.forEach((asset: string) => assets.add(asset));
      }
    });
    return assets;
  }, [activeStrategies]);

  // Get all unique assets for news widget
  const newsAssets = React.useMemo(() => {
    if (Array.from(allAssets).length > 0) {
      return Array.from(allAssets).map(asset => asset.split('_')[0]);
    }
    return ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];
  }, [allAssets]);

  // Update date and volatility
  useEffect(() => {
    // Update date every second
    const dateInterval = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    // Update volatility based on analytics
    const updateVolatility = () => {
      const metrics = analyticsService.getDashboardMetrics();
      if (metrics?.riskProfile?.current) {
        setVolatility(metrics.riskProfile.current * 10); // Scale to 0-100
      }
    };

    updateVolatility();
    const volatilityInterval = setInterval(updateVolatility, 60000); // Update every minute

    return () => {
      clearInterval(dateInterval);
      clearInterval(volatilityInterval);
    };
  }, []);

  return (
    <div className="p-8 space-y-8">
      {/* Date Display */}
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

      {/* Main Content Grid */}
      <div className={`grid grid-cols-12 gap-8 ${screenSize === 'sm' ? 'grid-cols-1' : ''}`}>
        {/* Left Column - 7 columns wide on desktop, full width on mobile */}
        <div className={`${screenSize === 'sm' ? 'col-span-12' : 'col-span-12 lg:col-span-7'} space-y-8`}>
          {/* Strategy Status */}
          <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
            <StrategyStatus />
          </div>

          {/* AI Market Insight */}
          <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
            <AIMarketInsight assets={allAssets} />
          </div>

          {/* Portfolio Performance */}
          <PortfolioPerformance />

          {/* Risk Exposure and Emergency Stop */}
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

        {/* Right Column - 5 columns wide on desktop, full width on mobile */}
        <div className={`${screenSize === 'sm' ? 'col-span-12' : 'col-span-12 lg:col-span-5'} space-y-8`}>
          {/* World Clock */}
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

          {/* DEFCON Monitor */}
          <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
            <DefconMonitor volatility={volatility} />
          </div>

          {/* News Widget */}
          <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
            <NewsWidget assets={newsAssets} limit={screenSize === 'sm' ? 2 : 4} />
          </div>

          {/* Asset Distribution */}
          <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
            <AssetDistribution assets={allAssets} />
          </div>
        </div>
      </div>
    </div>
  );
}