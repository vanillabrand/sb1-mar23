import React, { useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, DollarSign, AlertCircle, X } from 'lucide-react';
import type { BacktestProgress as BacktestProgressType } from '../lib/backtest-service';

interface BacktestProgressProps {
  progress: BacktestProgressType;
  latestUpdate?: any;
  onCancel: () => void;
}

export function BacktestProgress({ progress, latestUpdate, onCancel }: BacktestProgressProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const { status, currentStep, error } = progress;
  const progressValue = progress.progress || 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-2xl p-6 w-full max-w-2xl border border-gunmetal-800">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            {status === 'error' ? (
              <AlertCircle className="w-6 h-6 text-neon-pink" />
            ) : (
              <Loader2 className="w-6 h-6 text-neon-turquoise animate-spin" />
            )}
            <h2 className="text-xl font-bold text-gray-200">
              {status === 'error' ? 'Backtest Error' : 'Running Backtest'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-gunmetal-800/50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Error Message */}
          {status === 'error' && error && (
            <div className="bg-neon-pink/10 border border-neon-pink/20 rounded-lg p-4 text-neon-pink">
              {error}
            </div>
          )}

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">{currentStep}</span>
              <span className={`font-medium ${
                status === 'error' ? 'text-neon-pink' : 'text-neon-turquoise'
              }`}>
                {progressValue}%
              </span>
            </div>
            <div className="w-full bg-gunmetal-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  status === 'error' ? 'bg-neon-pink' : 'bg-neon-turquoise'
                }`}
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>

          {/* Live Stats */}
          {status !== 'error' && latestUpdate && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gunmetal-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Current Price</span>
                  <DollarSign className="w-4 h-4 text-neon-turquoise" />
                </div>
                <p className="text-xl font-mono">
                  ${latestUpdate.price ? latestUpdate.price.toFixed(2) : '0.00'}
                </p>
              </div>

              <div className="bg-gunmetal-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Position</span>
                  {latestUpdate.position === 'long' ? (
                    <TrendingUp className="w-4 h-4 text-neon-orange" />
                  ) : latestUpdate.position === 'short' ? (
                    <TrendingDown className="w-4 h-4 text-neon-pink" />
                  ) : (
                    <span className="w-4 h-4" />
                  )}
                </div>
                <p className="text-xl font-medium capitalize">
                  {latestUpdate.position || 'None'}
                </p>
              </div>

              <div className="bg-gunmetal-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Equity</span>
                  <DollarSign className="w-4 h-4 text-neon-yellow" />
                </div>
                <p className="text-xl font-mono">
                  ${latestUpdate.equity ? latestUpdate.equity.toFixed(2) : '0.00'}
                </p>
              </div>

              <div className="bg-gunmetal-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Drawdown</span>
                  <TrendingDown className="w-4 h-4 text-neon-pink" />
                </div>
                <p className="text-xl font-mono text-neon-pink">
                  {latestUpdate.drawdown ? latestUpdate.drawdown.toFixed(2) : '0.00'}%
                </p>
              </div>
            </div>
          )}

          {/* Time Elapsed */}
          <div className="text-center text-sm text-gray-400">
            Time Elapsed: {Math.floor(timeElapsed / 60)}m {timeElapsed % 60}s
          </div>

          <button
            onClick={onCancel}
            className={`w-full px-4 py-2 text-sm font-medium ${
              status === 'error'
                ? 'text-neon-pink hover:text-neon-pink/80'
                : 'text-gray-400 hover:text-gray-200'
            } transition-colors`}
          >
            {status === 'error' ? 'Close' : 'Cancel Backtest'}
          </button>
        </div>
      </div>
    </div>
  );
}