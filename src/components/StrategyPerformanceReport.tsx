import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Activity,
  X,
  DollarSign,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

interface StrategyPerformanceReportProps {
  performance?: {
    totalPnl: number;
    totalTrades: number;
    winRate: number;
    maxDrawdown: number;
    duration: string;
    equityCurve: Array<{ date: string; value: number }>;
  };
  onClose: () => void;
  onConfirm: () => Promise<void>;
  strategyName: string;
}

export function StrategyPerformanceReport({ performance, onClose, onConfirm, strategyName }: StrategyPerformanceReportProps) {
  const [isDeactivating, setIsDeactivating] = useState(false);

  const handleDeactivate = async () => {
    try {
      setIsDeactivating(true);
      await onConfirm();
      onClose(); // Close the modal after successful deactivation
    } catch (error) {
      console.error('Error deactivating strategy:', error);
    } finally {
      setIsDeactivating(false);
    }
  };

  // If no performance data, show simple confirmation
  if (!performance || !performance.totalTrades) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-gunmetal-800">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-neon-orange" />
            <h2 className="text-xl font-bold">Deactivate Strategy</h2>
          </div>

          <p className="text-gray-300 mb-6">
            Are you sure you want to deactivate <span className="text-neon-turquoise font-semibold">{strategyName}</span>? 
            This will close all active trades and stop monitoring market conditions.
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isDeactivating}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDeactivate}
              disabled={isDeactivating}
              className="px-4 py-2 bg-neon-pink text-white rounded-lg hover:bg-red-500 transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
            >
              {isDeactivating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deactivating...
                </>
              ) : (
                'Deactivate Strategy'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-2xl border border-gunmetal-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold gradient-text">Strategy Performance Report</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <DollarSign className="w-4 h-4" />
              Total P&L
            </div>
            <p className={`text-xl font-bold ${
              performance.totalPnl >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'
            }`}>
              {performance.totalPnl >= 0 ? '+' : ''}{performance.totalPnl.toFixed(2)}%
            </p>
          </div>

          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <Activity className="w-4 h-4" />
              Win Rate
            </div>
            <p className="text-xl font-bold text-neon-yellow">
              {performance.winRate.toFixed(1)}%
            </p>
          </div>

          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <BarChart3 className="w-4 h-4" />
              Total Trades
            </div>
            <p className="text-xl font-bold text-gray-200">
              {performance.totalTrades}
            </p>
          </div>

          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <Clock className="w-4 h-4" />
              Duration
            </div>
            <p className="text-xl font-bold text-gray-200">
              {performance.duration}
            </p>
          </div>
        </div>

        {/* Equity Curve */}
        {performance.equityCurve?.length > 0 && (
          <div className="bg-gunmetal-800/30 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-4">Equity Curve</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performance.equityCurve}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF' }}
                  />
                  <YAxis 
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF' }}
                    domain={['auto', 'auto']}
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
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeactivating}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDeactivate}
            disabled={isDeactivating}
            className="px-4 py-2 bg-neon-pink text-white rounded-lg hover:bg-red-500 transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
          >
            {isDeactivating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deactivating...
              </>
            ) : (
              'Deactivate Strategy'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}