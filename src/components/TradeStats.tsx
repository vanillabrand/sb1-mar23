import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity 
} from 'lucide-react';

interface TradeStatsProps {
  stats: {
    totalTrades: number;
    profitableTrades: number;
    totalProfit: number;
    averageProfit: number;
  };
}

export function TradeStats({ stats }: TradeStatsProps) {
  const winRate = stats.totalTrades > 0 
    ? (stats.profitableTrades / stats.totalTrades) * 100 
    : 0;

  return (
    <div className="bg-slate-900/50 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
        <Activity className="w-5 h-5" />
        Trading Statistics
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-sm text-gray-400">Total Trades</div>
          <div className="text-xl font-mono text-gray-200">
            {stats.totalTrades}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-sm text-gray-400">Win Rate</div>
          <div className="text-xl font-mono text-gray-200 flex items-center gap-1">
            {winRate.toFixed(1)}%
            {winRate > 50 ? (
              <TrendingUp className="w-4 h-4 text-neon-turquoise" />
            ) : (
              <TrendingDown className="w-4 h-4 text-neon-pink" />
            )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-sm text-gray-400">Total Profit</div>
          <div className="text-xl font-mono text-gray-200 flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            {stats.totalProfit.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-sm text-gray-400">Avg. Profit/Trade</div>
          <div className="text-xl font-mono text-gray-200 flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            {stats.averageProfit.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </div>
        </div>
      </div>
    </div>
  );
}