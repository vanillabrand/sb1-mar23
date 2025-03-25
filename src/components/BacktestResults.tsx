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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-2xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-gunmetal-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold gradient-text">Backtest Results</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gunmetal-800/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Return</p>
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
              {results.totalReturns >= 0 ? (
                <TrendingUp className="w-8 h-8 text-neon-orange" />
              ) : (
                <TrendingDown className="w-8 h-8 text-neon-pink" />
              )}
            </div>
          </div>

          <div className="bg-gunmetal-800/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Win Rate</p>
                <p className="text-2xl font-bold text-neon-turquoise">
                  {results.winRate.toFixed(2)}%
                </p>
              </div>
              <Target className="w-8 h-8 text-neon-turquoise" />
            </div>
          </div>

          <div className="bg-gunmetal-800/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Trades</p>
                <p className="text-2xl font-bold text-gray-200">
                  {results.totalTrades}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-neon-yellow" />
            </div>
          </div>

          <div className="bg-gunmetal-800/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Sharpe Ratio</p>
                <p className="text-2xl font-bold text-neon-turquoise">
                  {results.sharpeRatio.toFixed(2)}
                </p>
              </div>
              <Scale className="w-8 h-8 text-neon-turquoise" />
            </div>
          </div>
        </div>

        {/* Equity Curve */}
        <div className="bg-gunmetal-800/30 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">
            Equity Curve
          </h3>
          <div className="h-[250px]">
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
                    backgroundColor: 'rgba(17, 24, 39, 0.8)',
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
        <div className="bg-gunmetal-800/30 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gunmetal-700">
            <h3 className="text-lg font-semibold text-gray-200">
              Trade History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gunmetal-700">
              <thead className="bg-gunmetal-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    P&L
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gunmetal-700">
                {results.trades.map((trade, index) => (
                  <tr
                    key={index}
                    className="hover:bg-gunmetal-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-200">
                      {trade.date.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          trade.type === 'buy'
                            ? 'bg-neon-orange/20 text-neon-orange'
                            : 'bg-neon-pink/20 text-neon-pink'
                        }`}
                      >
                        {trade.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-200">
                      ${trade.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-200">
                      {trade.amount.toFixed(4)}
                    </td>
                    <td
                      className={`px-4 py-3 whitespace-nowrap text-sm ${
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
      </div>
    </div>
  );
}
