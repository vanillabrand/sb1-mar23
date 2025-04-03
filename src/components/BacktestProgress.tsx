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
    <div className="bg-gunmetal-800/30 rounded-xl p-6 border border-gunmetal-700/50 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          {status === 'error' ? (
            <div className="p-2 rounded-full bg-neon-pink/10">
              <AlertCircle className="w-6 h-6 text-neon-pink" />
            </div>
          ) : (
            <div className="p-2 rounded-full bg-neon-turquoise/10">
              <Loader2 className="w-6 h-6 text-neon-turquoise animate-spin" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-neon-turquoise">
              {status === 'error' ? 'Backtest Error' : 'Running Backtest'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {status === 'error' ? 'An error occurred during backtesting' : 'Processing historical market data'}
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-2 rounded-full hover:bg-gunmetal-800/70 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-400 hover:text-gray-200" />
        </button>
      </div>

      <div className="space-y-6">
        {/* Error Message */}
        {status === 'error' && error && (
          <div className="bg-neon-pink/10 border border-neon-pink/30 rounded-lg p-5 text-neon-pink flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="bg-gunmetal-900/50 p-5 rounded-lg border border-gunmetal-800/70 shadow-inner">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-gray-300 font-medium">{currentStep}</span>
            <span className={`font-medium ${
              status === 'error' ? 'text-neon-pink' : 'text-neon-turquoise'
            }`}>
              {progressValue}%
            </span>
          </div>
          <div className="w-full bg-gunmetal-800 rounded-full h-3 shadow-inner">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                status === 'error' ? 'bg-neon-pink' : 'bg-neon-turquoise'
              }`}
              style={{ width: `${progressValue}%` }}
            />
          </div>

          {/* Time Elapsed */}
          <div className="text-right text-sm text-gray-400 mt-3">
            Time Elapsed: {Math.floor(timeElapsed / 60)}m {timeElapsed % 60}s
          </div>
        </div>

        {/* Live Stats */}
        {status !== 'error' && latestUpdate && (
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-gunmetal-900/50 rounded-lg p-5 border border-gunmetal-800/70 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-300">Current Price</span>
                <div className="p-1.5 rounded-full bg-neon-turquoise/10">
                  <DollarSign className="w-4 h-4 text-neon-turquoise" />
                </div>
              </div>
              <p className="text-xl font-mono text-neon-turquoise">
                ${latestUpdate.price ? latestUpdate.price.toFixed(2) : '0.00'}
              </p>
            </div>

            <div className="bg-gunmetal-900/50 rounded-lg p-5 border border-gunmetal-800/70 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-300">Position</span>
                {latestUpdate.position === 'long' ? (
                  <div className="p-1.5 rounded-full bg-neon-orange/10">
                    <TrendingUp className="w-4 h-4 text-neon-orange" />
                  </div>
                ) : latestUpdate.position === 'short' ? (
                  <div className="p-1.5 rounded-full bg-neon-pink/10">
                    <TrendingDown className="w-4 h-4 text-neon-pink" />
                  </div>
                ) : (
                  <div className="p-1.5 rounded-full bg-gray-700/10">
                    <span className="w-4 h-4" />
                  </div>
                )}
              </div>
              <p className="text-xl font-medium capitalize">
                {latestUpdate.position === 'long' ? (
                  <span className="text-neon-orange">Long</span>
                ) : latestUpdate.position === 'short' ? (
                  <span className="text-neon-pink">Short</span>
                ) : (
                  <span className="text-gray-400">None</span>
                )}
              </p>
            </div>

            <div className="bg-gunmetal-900/50 rounded-lg p-5 border border-gunmetal-800/70 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-300">Equity</span>
                <div className="p-1.5 rounded-full bg-neon-yellow/10">
                  <DollarSign className="w-4 h-4 text-neon-yellow" />
                </div>
              </div>
              <p className="text-xl font-mono text-neon-yellow">
                ${latestUpdate.equity ? latestUpdate.equity.toFixed(2) : '0.00'}
              </p>
            </div>

            <div className="bg-gunmetal-900/50 rounded-lg p-5 border border-gunmetal-800/70 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-300">Drawdown</span>
                <div className="p-1.5 rounded-full bg-neon-pink/10">
                  <TrendingDown className="w-4 h-4 text-neon-pink" />
                </div>
              </div>
              <p className="text-xl font-mono text-neon-pink">
                {latestUpdate.drawdown ? latestUpdate.drawdown.toFixed(2) : '0.00'}%
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className={`px-6 py-2 rounded-lg border transition-all ${
              status === 'error'
                ? 'bg-neon-pink/10 text-neon-pink border-neon-pink/30 hover:bg-neon-pink/20'
                : 'bg-gunmetal-800/50 text-gray-300 border-gunmetal-700 hover:bg-gunmetal-800/70'
            }`}
          >
            {status === 'error' ? 'Close' : 'Cancel Backtest'}
          </button>
        </div>
      </div>
    </div>
  );
}