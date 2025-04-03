import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Scale,
  Clock,
  X,
} from 'lucide-react';
import type { BacktestResults as BacktestResultsType } from '../lib/backtest-service';

interface BacktestResultsProps {
  results: BacktestResultsType;
  onClose: () => void;
}

export function BacktestResults({ results, onClose }: BacktestResultsProps) {
  if (!results || !results.trades || !results.equity) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-black rounded-2xl p-8 w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-gunmetal-700 shadow-2xl">
        <div className="relative mb-8">
          <div>
            <h2 className="text-2xl font-bold text-neon-turquoise">Backtest Results</h2>
            <p className="text-gray-400 mt-1">Analysis of strategy performance against historical data</p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-0 right-0 p-3 rounded-full bg-gunmetal-800/50 hover:bg-gunmetal-700/70 transition-colors border border-gunmetal-700"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-neon-turquoise hover:text-neon-yellow" />
          </button>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gunmetal-800/30 rounded-xl p-5 border border-gunmetal-700/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Return</p>
                <p
                  className={`text-2xl font-bold ${
                    results.totalReturns >= 0
                      ? 'text-neon-orange'
                      : 'text-neon-pink'
                  }`}
                >
                  {results.totalReturns >= 0 ? '+' : ''}
                  {results.totalReturns.toFixed(1)}%
                </p>
              </div>
              <div className={`p-3 rounded-full ${results.totalReturns >= 0 ? 'bg-neon-orange/10' : 'bg-neon-pink/10'}`}>
                {results.totalReturns >= 0 ? (
                  <TrendingUp className="w-8 h-8 text-neon-orange" />
                ) : (
                  <TrendingDown className="w-8 h-8 text-neon-pink" />
                )}
              </div>
            </div>
          </div>

          <div className="bg-gunmetal-800/30 rounded-xl p-5 border border-gunmetal-700/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Win Rate</p>
                <p className="text-2xl font-bold text-neon-turquoise">
                  {results.winRate.toFixed(2)}%
                </p>
              </div>
              <div className="p-3 rounded-full bg-neon-turquoise/10">
                <Target className="w-8 h-8 text-neon-turquoise" />
              </div>
            </div>
          </div>

          <div className="bg-gunmetal-800/30 rounded-xl p-5 border border-gunmetal-700/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Trades</p>
                <p className="text-2xl font-bold text-neon-yellow">
                  {results.totalTrades}
                </p>
              </div>
              <div className="p-3 rounded-full bg-neon-yellow/10">
                <BarChart3 className="w-8 h-8 text-neon-yellow" />
              </div>
            </div>
          </div>

          <div className="bg-gunmetal-800/30 rounded-xl p-5 border border-gunmetal-700/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Sharpe Ratio</p>
                <p className="text-2xl font-bold text-neon-turquoise">
                  {results.sharpeRatio.toFixed(2)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-neon-turquoise/10">
                <Scale className="w-8 h-8 text-neon-turquoise" />
              </div>
            </div>
          </div>
        </div>

        {/* Equity Curve */}
        <div className="bg-gunmetal-800/30 rounded-xl p-6 mb-8 border border-gunmetal-700/50 shadow-lg">
          <h3 className="text-lg font-semibold text-neon-turquoise mb-4">
            Equity Curve
          </h3>
          <div className="h-[300px] bg-gunmetal-900/50 p-4 rounded-lg border border-gunmetal-800/70 shadow-inner">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={results.equity}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#6B7280"
                  tick={{ fill: '#9CA3AF' }}
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString()
                  }
                />
                <YAxis
                  stroke="#6B7280"
                  tick={{ fill: '#9CA3AF' }}
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#000000',
                    border: '1px solid rgba(75, 85, 99, 0.4)',
                    borderRadius: '8px',
                    backdropFilter: 'blur(4px)',
                  }}
                  labelStyle={{ color: '#9CA3AF' }}
                  itemStyle={{ color: '#2dd4bf' }}
                  formatter={(value: number) => [
                    `$${value.toLocaleString()}`,
                    'Value',
                  ]}
                  labelFormatter={(label) =>
                    new Date(label).toLocaleDateString()
                  }
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#2dd4bf"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trade List */}
        <div className="bg-gunmetal-800/30 rounded-xl border border-gunmetal-700/50 shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gunmetal-700">
            <h3 className="text-lg font-semibold text-neon-turquoise">
              Trade History
            </h3>
            <p className="text-sm text-gray-400 mt-1">Detailed record of all executed trades during the backtest period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gunmetal-700">
              <thead className="bg-gunmetal-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    P&L
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gunmetal-700 bg-gunmetal-900/30">
                {results.trades.map((trade, index) => (
                  <tr
                    key={index}
                    className="hover:bg-gunmetal-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {trade.date.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          trade.type === 'buy'
                            ? 'bg-neon-orange/20 text-neon-orange'
                            : 'bg-neon-pink/20 text-neon-pink'
                        }`}
                      >
                        {trade.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      ${trade.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {trade.amount.toFixed(4)}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        trade.pnl >= 0 ? 'text-neon-orange' : 'text-neon-pink'
                      }`}
                    >
                      {trade.pnl >= 0 ? '+' : ''}
                      {trade.pnl.toFixed(2)} USDT
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sticky Close Button */}
        <div className="sticky bottom-0 left-0 right-0 pt-4 pb-2 bg-black border-t border-gunmetal-800 mt-8 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gunmetal-800 hover:bg-gunmetal-700 text-neon-turquoise hover:text-neon-yellow rounded-lg transition-colors border border-gunmetal-700 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Close Results
          </button>
        </div>
      </div>
    </div>
  );
}
