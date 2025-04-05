import { useMemo } from 'react';
import { Brain, Power, TrendingUp, BarChart3 } from 'lucide-react';
import type { Strategy } from '../lib/types';

interface StrategyStatsProps {
  strategies: Strategy[];
  className?: string;
}

export function StrategyStats({ strategies = [], className = '' }: StrategyStatsProps) {
  // Calculate statistics from strategies array
  const stats = useMemo(() => {
    if (!strategies || strategies.length === 0) {
      return {
        total: 0,
        active: 0,
        profitable: 0,
        avgPerformance: 0
      };
    }

    const total = strategies.length;
    const active = strategies.filter(s => s.status === 'active').length;

    // Count strategies with positive performance
    const profitable = strategies.filter(s => {
      const performance = typeof s.performance === 'number'
        ? s.performance
        : parseFloat(String(s.performance || '0'));
      return performance > 0;
    }).length;

    // Calculate average performance
    const totalPerformance = strategies.reduce((sum, s) => {
      const performance = typeof s.performance === 'number'
        ? s.performance
        : parseFloat(String(s.performance || '0'));
      return sum + (isNaN(performance) ? 0 : performance);
    }, 0);

    const avgPerformance = total > 0
      ? parseFloat((totalPerformance / total).toFixed(2))
      : 0;

    return {
      total,
      active,
      profitable,
      avgPerformance
    };
  }, [strategies]);
  return (
    <div className={`${className}`}>
      <div className="bg-gradient-to-br from-gunmetal-900/95 to-gunmetal-800/95 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-700/50 shadow-lg hover:border-gunmetal-600/50 transition-all duration-200">
        <h3 className="text-lg font-semibold mb-4 text-gray-200">Strategy Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-neon-turquoise" />
              <span className="text-sm text-gray-400">Total Strategies</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Power className="w-5 h-5 text-neon-yellow" />
              <span className="text-sm text-gray-400">Active</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.active}</p>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-neon-orange" />
              <span className="text-sm text-gray-400">Profitable</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.profitable}</p>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-neon-raspberry" />
              <span className="text-sm text-gray-400">Avg Performance</span>
            </div>
            <p className={`text-2xl font-bold ${
              stats.avgPerformance >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'
            }`}>
              {stats.avgPerformance > 0 ? '+' : ''}{stats.avgPerformance}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
