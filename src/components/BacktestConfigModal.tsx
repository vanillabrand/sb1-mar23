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
  Clock
} from 'lucide-react';
import type { Strategy } from '../lib/supabase-types';
import type { BacktestConfig } from '../lib/backtest-service';

interface BacktestConfigModalProps {
  strategy: Strategy;
  onConfirm: (config: BacktestConfig) => void;
  onCancel: () => void;
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

export function BacktestConfigModal({ strategy, onConfirm, onCancel }: BacktestConfigModalProps) {
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedData, setUploadedData] = useState<any[] | null>(null);

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
        
        // Validate headers
        const requiredColumns = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
        const hasValidHeaders = requiredColumns.every(col => headers.includes(col));
        
        if (!hasValidHeaders) {
          setUploadError('Invalid CSV format. Required columns: timestamp, open, high, low, close, volume');
          return;
        }

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
        setUploadError('Error parsing CSV file');
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

      if (!Array.isArray(strategy.strategy_config.assets) || strategy.strategy_config.assets.length === 0) {
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

      // Get first asset from strategy config
      const symbol = strategy.strategy_config.assets[0];

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

      onConfirm(config);
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
                    className="flex items-center gap-4 p-4 bg-gunmetal-800/50 rounded-lg hover:bg-gunmetal-800/70 transition-all duration-300"
                  >
                    <div className="p-2 rounded-lg bg-neon-raspberry/10">
                      <Icon className="w-6 h-6 text-neon-raspberry" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-gray-200">{option.name}</h4>
                      <p className="text-sm text-gray-400">{option.description}</p>
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
              {MARKET_SCENARIOS.map((scenarioOption) => (
                <button
                  key={scenarioOption.id}
                  onClick={() => {
                    setScenario(scenarioOption.id);
                    setStep('config');
                  }}
                  className={`p-4 rounded-lg border transition-all duration-300 ${
                    scenario === scenarioOption.id
                      ? `bg-${scenarioOption.color}/10 border-${scenarioOption.color}/50`
                      : 'bg-gunmetal-900/30 border-gunmetal-800 hover:border-gunmetal-700'
                  }`}
                >
                  <h4 className={`text-lg font-medium ${
                    scenario === scenarioOption.id ? `text-${scenarioOption.color}` : 'text-gray-200'
                  } mb-2`}>
                    {scenarioOption.name}
                  </h4>
                  <p className="text-sm text-gray-400">{scenarioOption.description}</p>
                </button>
              ))}
            </div>
          </div>
        );

      case 'config':
        return (
          <form onSubmit={handleSubmit} className="space-y-6">
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
                  className="pl-10 w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg shadow-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
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
                  className="pl-10 w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg shadow-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Initial Balance (USDT)
              </label>
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

            {/* Hidden file input */}
            <input
              type="file"
              id="file-upload"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />

            {uploadError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {uploadError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setStep('source')}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300"
              >
                Start Backtest
              </button>
            </div>
          </form>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-lg p-6 w-full max-w-md border border-gunmetal-800">
        <h2 className="text-xl font-bold gradient-text mb-4">Configure Backtest</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {renderStep()}
      </div>
    </div>
  );
}