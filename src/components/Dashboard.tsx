import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Calendar, Settings } from 'lucide-react';
import { NetworkStatus, StrategyStatus, AIMarketInsight, PortfolioPerformancePanel, AssetDisplayPanel, AssetDistribution, AnimatedPanel, WorldClock, DefconMonitor, NewsWidget, WebSocketPerformanceMonitor, PerformanceMonitor } from './index';
import { performanceOptimizer } from '../lib/performance-optimizer';
import { fontOptimizer } from '../lib/font-optimizer';
import { useScreenSize } from '../lib/hooks/useScreenSize';
import type { Strategy } from '../lib/types';
import { RustApiStatus } from './RustApiProvider';

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
  strategies?: Strategy[];
  monitoringStatuses?: Record<string, MonitoringStatus>;
}

export function Dashboard({ strategies: initialStrategies = [] }: DashboardProps = {}) {
  // We're not using monitoringStatuses in this simplified version
  const [selectedTimezone, setSelectedTimezone] = useState('UTC');
  const screenSize = useScreenSize();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showPerformanceTools, setShowPerformanceTools] = useState(false);

  // Update the date every second
  useEffect(() => {
    const dateInterval = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(dateInterval);
  }, []);

  // Use provided strategies or fallback to empty array
  const activeStrategies = useMemo(() => {
    return (initialStrategies || []).filter(s => s.status === 'active');
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
    <div className="p-4 sm:p-6 md:p-8 space-y-6 pb-24 sm:pb-8">
      {/* Header with Logo, Date and Network Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          {/* Logo */}
          <div className="mr-4">
            <img src="/logo.svg" alt="Logo" className="h-10 w-auto" />
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Calendar className="w-5 h-5 text-neon-yellow" />
            <h1 className="text-xl md:text-2xl font-bold gradient-text">
              {currentDate.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RustApiStatus />
          <button
            onClick={() => setShowPerformanceTools(!showPerformanceTools)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gunmetal-800 hover:bg-gunmetal-700 rounded-lg transition-colors shadow-lg"
            aria-label="Toggle performance tools"
          >
            <Settings className="w-4 h-4 text-neon-turquoise" />
            <span className="text-sm text-gray-300 hidden sm:inline">Performance Tools</span>
          </button>
          <NetworkStatus />
        </div>
      </div>

      {/* Performance Tools */}
      {showPerformanceTools && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <AnimatedPanel index={0} className="col-span-1 panel-shadow">
            <PerformanceMonitor />
          </AnimatedPanel>
          <AnimatedPanel index={1} className="col-span-1 panel-shadow">
            <WebSocketPerformanceMonitor />
          </AnimatedPanel>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        <div className="lg:col-span-7 space-y-4">
          {activeStrategies.length > 0 && (
            <AnimatedPanel index={0} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
              <StrategyStatus strategies={activeStrategies} />
            </AnimatedPanel>
          )}

          <AnimatedPanel index={2} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <AIMarketInsight assets={new Set(allAssets)} />
          </AnimatedPanel>

          <AnimatedPanel index={3} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <NewsWidget assets={allAssets} limit={4} />
          </AnimatedPanel>

          <AnimatedPanel index={4} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <PortfolioPerformancePanel />
          </AnimatedPanel>
        </div>

        <div className="lg:col-span-5 space-y-4">
          {/* DEFCON Monitor - Shown on all screens */}
          <AnimatedPanel index={5} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <DefconMonitor
              strategies={activeStrategies}
              className="mb-2 sm:mb-3"
              volatility={5}
            />
          </AnimatedPanel>

          <AnimatedPanel index={6} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <div className="flex items-center justify-between mb-4">
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

          <AnimatedPanel index={7} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <AssetDisplayPanel />
          </AnimatedPanel>

          <AnimatedPanel index={8} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <AssetDistribution assets={new Set(allAssets)} />
          </AnimatedPanel>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
