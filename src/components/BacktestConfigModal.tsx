import React, { useState } from 'react';
import {
  Calendar,
  Info,
  TrendingUp,
  Database,
  FileUp,
  ChevronRight,
  AlertCircle,
  Loader2,
  Clock,
  X
} from 'lucide-react';
import type { Strategy } from '../lib/supabase-types';
import type { BacktestConfig } from '../lib/backtest-service';
import type { CSVValidationError } from '@/lib/types';

interface BacktestConfigModalProps {
  strategy: Strategy;
  open: boolean;
  onStart: (config: BacktestConfig) => void;
  onClose: () => void;
}

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

export function BacktestConfigModal({ strategy, open, onStart, onClose }: BacktestConfigModalProps) {
  const [step, setStep] = useState<'source' | 'scenario' | 'config'>('source');
  const [dataSource, setDataSource] = useState<string | null>(null);
  const [scenario, setScenario] = useState<string>('sideways');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [initialBalance, setInitialBalance] = useState(10000);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<CSVValidationError | null>(null);
  const [uploadedData, setUploadedData] = useState<any[] | null>(null);

  const validateCSV = (headers: string[]): boolean => {
    const requiredColumns = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
    const hasValidHeaders = requiredColumns.every(col => headers.includes(col));

    if (!hasValidHeaders) {
      setUploadError({
        type: 'INVALID_HEADERS',
        message: 'Invalid CSV format. Required columns: timestamp, open, high, low, close, volume'
      });
      return false;
    }

    return true;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',');

        if (!validateCSV(headers)) return;

        // Parse data
        const data = lines.slice(1).map(line => {
          const values = line.split(',');
          return {
            timestamp: new Date(values[0]).getTime(),
            open: parseFloat(values[1]),
            high: parseFloat(values[2]),
            low: parseFloat(values[3]),
            close: parseFloat(values[4]),
            volume: parseFloat(values[5])
          };
        });

        setUploadedData(data);
        setStep('config');
      } catch (error) {
        setUploadError({
          type: 'PARSE_ERROR',
          message: 'Failed to parse CSV file'
        });
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Validate strategy configuration
      if (!strategy.strategy_config) {
        throw new Error('Strategy configuration is missing');
      }

      // Check for trading pairs in selected_pairs (primary) or strategy_config.assets (fallback)
      const tradingPairs = strategy.selected_pairs || (strategy.strategy_config?.assets as string[] || []);

      if (!Array.isArray(tradingPairs) || tradingPairs.length === 0) {
        throw new Error('No trading pairs configured for this strategy');
      }

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      const now = new Date();

      if (start >= end) {
        throw new Error('Start date must be before end date');
      }

      if (end > now) {
        throw new Error('End date cannot be in the future');
      }

      // Validate balance
      if (initialBalance <= 0) {
        throw new Error('Initial balance must be greater than 0');
      }

      // Get first trading pair
      const symbol = tradingPairs[0];

      const config: BacktestConfig = {
        strategy,
        startDate: start,
        endDate: end,
        initialBalance,
        symbol,
        timeframe: '1h',
        dataSource,
        scenario: dataSource === 'synthetic' ? scenario : undefined,
        data: uploadedData || undefined
      };

      // Scroll to the progress section after a short delay
      setTimeout(() => {
        const progressSection = document.getElementById('backtest-progress');
        if (progressSection) {
          progressSection.scrollIntoView({ behavior: 'smooth' });
        } else {
          // Fallback to the results ref if progress section is not found
          const resultsRef = document.getElementById('backtest-results');
          if (resultsRef) {
            resultsRef.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }, 100);

      onStart(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid configuration');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'source':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-6">Choose Data Source</h3>
            <div className="grid grid-cols-1 gap-4">
              {DATA_SOURCE_OPTIONS.map(option => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      setDataSource(option.id);
                      if (option.id === 'synthetic') {
                        setStep('scenario');
                      } else if (option.id === 'file') {
                        // Trigger file input click
                        document.getElementById('file-upload')?.click();
                      } else {
                        setStep('config');
                      }
                    }}
                    className="flex items-center gap-4 p-5 bg-gunmetal-800/50 rounded-lg hover:bg-gunmetal-800/70 transition-all duration-300 border border-gunmetal-700/50 shadow-md hover:shadow-lg hover:border-gunmetal-600/50"
                  >
                    <div className="p-3 rounded-lg bg-neon-turquoise/10 shadow-inner">
                      <Icon className="w-6 h-6 text-neon-turquoise" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-gray-200">{option.name}</h4>
                      <p className="text-sm text-gray-400 mt-1">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'scenario':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-6">Choose Market Scenario</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MARKET_SCENARIOS.map((scenarioOption) => {
                // Map color names to actual Tailwind classes to avoid dynamic class name issues
                const colorMap = {
                  'neon-turquoise': 'bg-neon-turquoise/10 border-neon-turquoise/50 text-neon-turquoise',
                  'neon-pink': 'bg-neon-pink/10 border-neon-pink/50 text-neon-pink',
                  'neon-yellow': 'bg-neon-yellow/10 border-neon-yellow/50 text-neon-yellow',
                  'neon-orange': 'bg-neon-orange/10 border-neon-orange/50 text-neon-orange'
                };

                const isSelected = scenario === scenarioOption.id;
                const colorClass = colorMap[scenarioOption.color] || '';

                return (
                  <button
                    key={scenarioOption.id}
                    onClick={() => {
                      setScenario(scenarioOption.id);
                      setStep('config');
                    }}
                    className={`p-5 rounded-lg border transition-all duration-300 shadow-md hover:shadow-lg ${
                      isSelected
                        ? colorClass
                        : 'bg-gunmetal-900/30 border-gunmetal-800 hover:border-gunmetal-600 text-gray-200'
                    }`}
                  >
                    <h4 className={`text-lg font-medium mb-2`}>
                      {scenarioOption.name}
                    </h4>
                    <p className="text-sm text-gray-400">{scenarioOption.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'config':
        return (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-gunmetal-800/30 p-5 rounded-lg border border-gunmetal-700/50 shadow-inner">
              <h4 className="text-md font-medium text-neon-turquoise mb-4">Backtest Period</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-10 w-full py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg shadow-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    End Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="pl-10 w-full py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg shadow-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Initial Balance (USDT)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(parseFloat(e.target.value))}
                    className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg shadow-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent px-4 py-2"
                    min="0"
                    step="1000"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Strategy Summary */}
            <div className="bg-gunmetal-800/30 p-5 rounded-lg border border-gunmetal-700/50 shadow-inner">
              <h4 className="text-md font-medium text-neon-turquoise mb-4">Strategy Summary</h4>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Name:</span>
                  <span className="text-sm text-gray-200 font-medium">{strategy.title}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Risk Level:</span>
                  <span className={`text-sm font-medium ${strategy.riskLevel === 'High' ? 'text-neon-pink' : strategy.riskLevel === 'Medium' ? 'text-neon-orange' : 'text-neon-turquoise'}`}>
                    {strategy.riskLevel}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Trading Pair:</span>
                  <span className="text-sm text-gray-200 font-medium">
                    {(() => {
                      // Get trading pairs from selected_pairs or strategy_config.assets
                      const pairs = strategy.selected_pairs || (strategy.strategy_config?.assets as string[] || []);
                      return pairs && pairs.length > 0 ? pairs[0] : 'N/A';
                    })()}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Data Source:</span>
                  <span className="text-sm text-gray-200 font-medium">
                    {dataSource === 'synthetic' ? `Synthetic (${scenario})` :
                     dataSource === 'exchange' ? 'Exchange Data' :
                     dataSource === 'file' ? 'Uploaded File' : 'Not Selected'}
                  </span>
                </div>
              </div>
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              id="file-upload"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />

            {uploadError && (
              <div className="p-4 bg-neon-pink/10 border border-neon-pink/30 text-neon-pink rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{uploadError.message}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => step === 'config' ? setStep('source') : onClose()}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border border-gunmetal-700 rounded-lg hover:bg-gunmetal-800/50 transition-all"
              >
                {step === 'config' ? 'Back' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300 font-medium shadow-lg shadow-neon-turquoise/20"
              >
                Start Backtest
              </button>
            </div>
          </form>
        );
    }
  };

  if (!open || !strategy) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-black rounded-xl p-8 w-full max-w-md border border-gunmetal-700 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-neon-turquoise">Configure Backtest</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gunmetal-800/70 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-gray-200" />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-neon-pink/10 border border-neon-pink/30 text-neon-pink rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {renderStep()}
      </div>
    </div>
  );
}
