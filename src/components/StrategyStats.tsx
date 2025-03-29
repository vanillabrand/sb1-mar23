import React from 'react';
import { Brain, Power, TrendingUp, BarChart3 } from 'lucide-react';

interface StrategyStatsProps {
  stats: {
    total: number;
    active: number;
    profitable: number;
    avgPerformance: number;
  };
}

export function StrategyStats({ stats }: StrategyStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-gradient-to-br from-gunmetal-900/95 to-gunmetal-800/95 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-700/50 shadow-lg hover:border-gunmetal-600/50 transition-all duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gunmetal-800/50 rounded-xl">
            <Brain className="w-6 h-6 text-neon-turquoise" />
          </div>
          <span className="text-gray-400">Total Strategies</span>
        </div>
        <p className="text-3xl font-bold text-white">{stats.total}</p>
      </div>
      
      <div className="bg-gradient-to-br from-gunmetal-900/95 to-gunmetal-800/95 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-700/50 shadow-lg hover:border-gunmetal-600/50 transition-all duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gunmetal-800/50 rounded-xl">
            <Power className="w-6 h-6 text-neon-yellow" />
          </div>
          <span className="text-gray-400">Active</span>
        </div>
        <p className="text-3xl font-bold text-white">{stats.active}</p>
      </div>

      <div className="bg-gradient-to-br from-gunmetal-900/95 to-gunmetal-800/95 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-700/50 shadow-lg hover:border-gunmetal-600/50 transition-all duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gunmetal-800/50 rounded-xl">
            <TrendingUp className="w-6 h-6 text-neon-orange" />
          </div>
          <span className="text-gray-400">Profitable</span>
        </div>
        <p className="text-3xl font-bold text-white">{stats.profitable}</p>
      </div>

      <div className="bg-gradient-to-br from-gunmetal-900/95 to-gunmetal-800/95 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-700/50 shadow-lg hover:border-gunmetal-600/50 transition-all duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gunmetal-800/50 rounded-xl">
            <BarChart3 className="w-6 h-6 text-neon-raspberry" />
          </div>
          <span className="text-gray-400">Avg Performance</span>
        </div>
        <p className={`text-3xl font-bold ${
          stats.avgPerformance >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'
        }`}>
          {stats.avgPerformance > 0 ? '+' : ''}{stats.avgPerformance}%
        </p>
      </div>
    </div>
  );
}
