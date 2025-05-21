import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { NetworkStatus, StrategyStatus, AIMarketInsight, PortfolioPerformancePanel, AssetDisplayPanel, AssetDistribution, AnimatedPanel, WorldClock, DefconMonitor, NewsWidget } from './index';
import { useScreenSize } from '../lib/hooks/useScreenSize';
import type { Strategy } from '../lib/types';

// Define MonitoringStatus interface locally to avoid type errors
interface MonitoringStatus {
  strategyId: string;
  strategy_id?: string; // For backward compatibility
  status: string;
  lastUpdated?: string;
  lastUpdate?: Date | string;
  [key: string]: any; // Allow additional properties
}

// Timezone options for the world clock
const TIMEZONES = [
  { id: 'UTC', name: 'UTC' },
  { id: 'America/New_York', name: 'New York' },
  { id: 'America/Los_Angeles', name: 'Los Angeles' },
  { id: 'Europe/London', name: 'London' },
  { id: 'Asia/Tokyo', name: 'Tokyo' },
  { id: 'Australia/Sydney', name: 'Sydney' }
];

interface DashboardProps {
  strategies: Strategy[];
  monitoringStatuses: Record<string, MonitoringStatus>;
}

export function Dashboard({ strategies: initialStrategies }: DashboardProps) {
  // We're not using monitoringStatuses in this simplified version
  const [selectedTimezone, setSelectedTimezone] = useState('UTC');
  const screenSize = useScreenSize();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Update the date every second
  useEffect(() => {
    const dateInterval = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(dateInterval);
  }, []);

  // Use provided strategies or fallback to empty array
  const activeStrategies = useMemo(() => {
    return initialStrategies.filter(s => s.status === 'active');
  }, [initialStrategies]);

  // Extract all assets from strategies
  const allAssets = useMemo(() => {
    const assets = new Set<string>();
    activeStrategies.forEach(strategy => {
      (strategy.selected_pairs || []).forEach(pair => {
        const [base] = pair.split('/');
        assets.add(base);
      });
    });
    return Array.from(assets);
  }, [activeStrategies]);

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

      <div className={`grid grid-cols-12 gap-2 sm:gap-3 md:gap-5 ${screenSize === 'sm' ? 'grid-cols-1' : ''}`}>
        <div className={`${screenSize === 'sm' ? 'col-span-12' : 'col-span-12 lg:col-span-7'} space-y-4`}>
          {activeStrategies.length > 0 && (
            <AnimatedPanel index={0} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6">
              <StrategyStatus strategies={activeStrategies} />
            </AnimatedPanel>
          )}

          <AnimatedPanel index={2} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6">
            <AIMarketInsight assets={new Set(allAssets)} />
          </AnimatedPanel>

          <AnimatedPanel index={3} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6">
            <NewsWidget assets={allAssets} limit={4} />
          </AnimatedPanel>

          <AnimatedPanel index={4} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-5 shadow-lg w-full">
            <PortfolioPerformancePanel />
          </AnimatedPanel>
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

          {/* DEFCON Monitor - Shown on all screens */}
          <AnimatedPanel index={7} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-5 shadow-lg">
            <DefconMonitor
              strategies={activeStrategies}
              className="mb-2 sm:mb-3"
              volatility={5}
            />
          </AnimatedPanel>

          <AnimatedPanel index={8} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
            <AssetDisplayPanel />
          </AnimatedPanel>

          <AnimatedPanel index={9} className="panel-metallic rounded-xl p-3 sm:p-4 md:p-6 shadow-lg">
            <AssetDistribution assets={new Set(allAssets)} />
          </AnimatedPanel>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
