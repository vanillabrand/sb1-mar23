import React from 'react';
import { Activity, TrendingUp, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Strategy } from '../lib/types';

interface StrategyStatusProps {
  strategies?: Strategy[];
}

export function StrategyStatus({ strategies = [] }: StrategyStatusProps) {
  const navigate = useNavigate();

  // Function to handle strategy click and navigate to trade monitor
  const handleStrategyClick = (strategyId: string) => {
    navigate(`/trade-monitor?strategy=${strategyId}`);
  };

  // Generate random analytics data for demo purposes
  const getRandomAnalytics = (strategyId: string) => {
    // Use the strategy ID as a seed for consistent random values
    const seed = strategyId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rand = (min: number, max: number) => {
      const x = Math.sin(seed) * 10000;
      const r = x - Math.floor(x);
      return min + r * (max - min);
    };

    return {
      performance: (rand(-5, 15)).toFixed(2),
      trades: Math.floor(rand(5, 30)),
      winRate: (rand(40, 85)).toFixed(1),
      lastTrade: Math.floor(rand(5, 120))
    };
  };

  if (!strategies || strategies.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-400">No active strategies</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {strategies.map(strategy => {
        const analytics = getRandomAnalytics(strategy.id);
        const isPositive = parseFloat(analytics.performance) >= 0;

        return (
          <div
            key={strategy.id}
            className="p-4 panel-metallic rounded-lg cursor-pointer hover:shadow-lg transition-all duration-300"
            onClick={() => handleStrategyClick(strategy.id)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${strategy.status === 'active' ? 'bg-neon-turquoise/10' : 'bg-gunmetal-800'}`}>
                  <Activity className={`w-4 h-4 ${strategy.status === 'active' ? 'text-neon-turquoise' : 'text-gray-400'}`} />
                </div>
                <h3 className="text-lg font-medium">{strategy.title || 'Unnamed Strategy'}</h3>
              </div>
              <span className={`px-2 py-1 rounded text-sm ${
                strategy.status === 'active' ? 'bg-green-500/20 text-green-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {strategy.status}
              </span>
            </div>

            {/* Analytics Section */}
            <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gunmetal-700/30">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className={`w-3 h-3 ${isPositive ? 'text-green-400' : 'text-red-400'}`} />
                  <span className="text-xs text-gray-400">Performance</span>
                </div>
                <p className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{analytics.performance}%
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Activity className="w-3 h-3 text-neon-yellow" />
                  <span className="text-xs text-gray-400">Trades</span>
                </div>
                <p className="text-sm font-medium text-white">{analytics.trades}</p>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1">
                  <BarChart3 className="w-3 h-3 text-neon-turquoise" />
                  <span className="text-xs text-gray-400">Win Rate</span>
                </div>
                <p className="text-sm font-medium text-white">{analytics.winRate}%</p>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Activity className="w-3 h-3 text-neon-orange" />
                  <span className="text-xs text-gray-400">Last Trade</span>
                </div>
                <p className="text-sm font-medium text-white">{analytics.lastTrade}m ago</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
