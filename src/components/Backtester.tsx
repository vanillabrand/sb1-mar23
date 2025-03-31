import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Brain,
  Filter,
  Search,
  SortAsc,
  SortDesc,
  Tag,
  AlertTriangle,
  Clock,
  BarChart3,
  Target,
  Shield,
  Loader2,
  Database,
  FileUp,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Upload,
  X
} from 'lucide-react';
import { useStrategies } from '../hooks/useStrategies';
import { backtestService } from '../lib/backtest-service';
import { BacktestConfigModal } from './BacktestConfigModal';
import { BacktestProgress } from './BacktestProgress';
import { BacktestResults } from './BacktestResults';
import { PanelWrapper } from './PanelWrapper';
import { logService } from '../lib/log-service';
import Papa from 'papaparse';
import type { Strategy } from '../lib/supabase-types';
import type { BacktestConfig, BacktestProgress as BacktestProgressType, BacktestResults as BacktestResultsType } from '../lib/backtest-service';

const DATA_SOURCE_OPTIONS = [
  {
    id: 'synthetic',
    name: 'Synthetic Data',
    description: 'Generate artificial market data for testing',
    icon: TrendingUp,
    scenarios: ['bull', 'bear', 'sideways', 'volatile']
  },
  {
    id: 'exchange',
    name: 'Exchange Data',
    description: 'Fetch historical data from BitMart',
    icon: Database
  },
  {
    id: 'file',
    name: 'Upload File',
    description: 'Upload your own OHLCV data file (CSV)',
    icon: FileUp
  }
];

const MARKET_SCENARIOS = [
  {
    id: 'bull',
    name: 'Bullish Market',
    description: 'Simulates an upward trending market',
    color: 'neon-turquoise'
  },
  {
    id: 'bear',
    name: 'Bearish Market',
    description: 'Simulates a downward trending market',
    color: 'neon-pink'
  },
  {
    id: 'sideways',
    name: 'Sideways Market',
    description: 'Simulates a ranging market',
    color: 'neon-yellow'
  },
  {
    id: 'volatile',
    name: 'Volatile Market',
    description: 'Simulates high volatility conditions',
    color: 'neon-orange'
  }
];

type SortField = 'title' | 'performance' | 'risk_level' | 'created_at';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE = 5;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function Backtester() {
  const [showConfig, setShowConfig] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [progress, setProgress] = useState<BacktestProgressType | null>(null);
  const [latestUpdate, setLatestUpdate] = useState<any | null>(null);
  const [results, setResults] = useState<BacktestResultsType | null>(null);
  const [showResults, setShowResults] = useState(false);
  const { strategies } = useStrategies();

  useEffect(() => {
    // Set up event listeners for backtest progress and updates
    const progressHandler = (data: BacktestProgressType) => {
      setProgress(data);

      if (data.status === 'completed' && data.results) {
        setResults(data.results);
        setShowResults(true);
        setProgress(null);
      }
    };

    const updateHandler = (data: any) => {
      setLatestUpdate(data);
    };

    backtestService.on('progress', progressHandler);
    backtestService.on('update', updateHandler);

    return () => {
      backtestService.off('progress', progressHandler);
      backtestService.off('update', updateHandler);
    };
  }, []);

  const handleStartBacktest = async (config: BacktestConfig) => {
    try {
      setShowConfig(false);
      setProgress({
        status: 'running',
        progress: 0,
        currentStep: 'Initializing backtest...'
      });

      await backtestService.runBacktest(config);
    } catch (error) {
      logService.log('error', 'Failed to start backtest', error, 'Backtester');
      setProgress({
        status: 'error',
        progress: 0,
        currentStep: 'Error',
        error: error instanceof Error ? error.message : 'Failed to start backtest'
      });
    }
  };

  const handleCancelBacktest = () => {
    backtestService.cancelBacktest();
    setProgress(null);
  };

  return (
    <PanelWrapper title="Backtester" icon={<BarChart3 className="w-5 h-5" />}>
      <div className="space-y-6">
        {/* Strategy Selection Table */}
        <div className="bg-gunmetal-900/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gunmetal-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Strategy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Market Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Assets
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gunmetal-800">
              {strategies.map((strategy) => (
                <tr key={strategy.id} className="hover:bg-gunmetal-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-200">{strategy.title}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {strategy.market_type}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      {strategy.assets.map((asset) => (
                        <span key={asset} className="px-2 py-1 bg-gunmetal-700 rounded-full text-xs text-gray-300">
                          {asset}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedStrategy(strategy);
                        setShowConfig(true);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all"
                    >
                      <Play className="w-4 h-4" />
                      Run
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Progress Section */}
        {progress && (
          <BacktestProgress
            progress={progress}
            latestUpdate={latestUpdate}
            onCancel={handleCancelBacktest}
          />
        )}
      </div>

      {/* Modals */}
      <BacktestConfigModal
        open={showConfig}
        strategy={selectedStrategy}
        onClose={() => setShowConfig(false)}
        onStart={handleStartBacktest}
      />
    </PanelWrapper>
  );
}
