import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Calendar, Settings, BarChart2, TrendingUp, AlertCircle } from 'lucide-react';
import { NetworkStatus, StrategyStatus, AIMarketInsight, PortfolioPerformancePanel, AssetDisplayPanel, AssetDistribution, AnimatedPanel, WorldClock, DefconMonitor, NewsWidget, WebSocketPerformanceMonitor, PerformanceMonitor } from '../index';
import { performanceOptimizer } from '../../lib/performance-optimizer';
import { fontOptimizer } from '../../lib/font-optimizer';
import { useScreenSize } from '../../lib/hooks/useScreenSize';
import type { Strategy, MonitoringStatus } from '../../lib/types';
import { TechnicalAnalysisPanel } from './TechnicalAnalysisPanel';
import { AdvancedRiskMetrics } from './AdvancedRiskMetrics';
import { MarketCorrelationMatrix } from './MarketCorrelationMatrix';
import { PerformanceMetricsTable } from './PerformanceMetricsTable';

// Define props interface
interface ExpertDashboardProps {
  strategies: Strategy[];
  monitoringStatuses: Record<string, MonitoringStatus>;
}

export function ExpertDashboard({ strategies, monitoringStatuses }: ExpertDashboardProps) {
  // We're using the same state management as the regular Dashboard
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
    return strategies.filter(s => s.status === 'active');
  }, [strategies]);

  // Extract all unique assets from strategies
  const allAssets = useMemo(() => {
    const assetSet = new Set<string>();

    strategies.forEach(strategy => {
      if (Array.isArray(strategy.selected_pairs)) {
        strategy.selected_pairs.forEach(pair => {
          const baseCurrency = pair.split('/')[0];
          const quoteCurrency = pair.split('/')[1];

          if (baseCurrency) assetSet.add(baseCurrency);
          if (quoteCurrency) assetSet.add(quoteCurrency);
        });
      }
    });

    return Array.from(assetSet);
  }, [strategies]);

  // Timezone options for the world clock
  const TIMEZONES = [
    { id: 'UTC', name: 'UTC' },
    { id: 'America/New_York', name: 'New York' },
    { id: 'America/Los_Angeles', name: 'Los Angeles' },
    { id: 'Europe/London', name: 'London' },
    { id: 'Asia/Tokyo', name: 'Tokyo' },
    { id: 'Australia/Sydney', name: 'Sydney' }
  ];

  // Placeholder components for expert-level features
  // These would be implemented with actual functionality
  const TechnicalAnalysisPanelPlaceholder = () => (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-neon-turquoise" />
        Technical Analysis
      </h3>
      <p className="text-gray-400 mb-4">Advanced technical indicators and chart patterns for selected assets.</p>
      <div className="h-64 bg-gunmetal-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Technical analysis charts will appear here</p>
      </div>
    </div>
  );

  const AdvancedRiskMetricsPlaceholder = () => (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-neon-raspberry" />
        Advanced Risk Metrics
      </h3>
      <p className="text-gray-400 mb-4">Detailed risk analysis and portfolio exposure metrics.</p>
      <div className="h-64 bg-gunmetal-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Risk metrics will appear here</p>
      </div>
    </div>
  );

  const MarketCorrelationMatrixPlaceholder = () => (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-neon-yellow" />
        Market Correlation Matrix
      </h3>
      <p className="text-gray-400 mb-4">Asset correlation analysis for diversification optimization.</p>
      <div className="h-64 bg-gunmetal-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Correlation matrix will appear here</p>
      </div>
    </div>
  );

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
        <div className="flex items-center gap-4">
          <NetworkStatus />
          {showPerformanceTools && <WebSocketPerformanceMonitor />}
          {showPerformanceTools && <PerformanceMonitor />}
          <button
            onClick={() => setShowPerformanceTools(!showPerformanceTools)}
            className="p-2 rounded-full hover:bg-gunmetal-800 transition-colors"
            aria-label="Toggle performance tools"
          >
            <Settings className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Expert Dashboard Layout - 3 columns on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        {/* Left Column */}
        <div className="lg:col-span-4 space-y-4">
          {activeStrategies.length > 0 && (
            <AnimatedPanel index={0} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
              <StrategyStatus strategies={activeStrategies} />
            </AnimatedPanel>
          )}

          <AnimatedPanel index={1} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <TechnicalAnalysisPanelPlaceholder />
          </AnimatedPanel>

          <AnimatedPanel index={2} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <AIMarketInsight assets={new Set(allAssets)} />
          </AnimatedPanel>
        </div>

        {/* Middle Column */}
        <div className="lg:col-span-4 space-y-4">
          <AnimatedPanel index={3} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <PortfolioPerformancePanel />
          </AnimatedPanel>

          <AnimatedPanel index={4} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <AdvancedRiskMetricsPlaceholder />
          </AnimatedPanel>

          <AnimatedPanel index={5} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <NewsWidget assets={allAssets} limit={4} />
          </AnimatedPanel>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-4">
          <AnimatedPanel index={6} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <MarketCorrelationMatrixPlaceholder />
          </AnimatedPanel>

          <AnimatedPanel index={7} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
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

          <AnimatedPanel index={8} className="panel-metallic rounded-xl p-4 md:p-6 panel-shadow">
            <AssetDisplayPanel />
          </AnimatedPanel>
        </div>
      </div>
    </div>
  );
}
