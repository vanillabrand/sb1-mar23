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
  Upload
} from 'lucide-react';
import { useStrategies } from '../hooks/useStrategies';
import { backtestService } from '../lib/backtest-service';
import { BacktestConfigModal } from './BacktestConfigModal';
import { BacktestProgress } from './BacktestProgress';
import { BacktestResults } from './BacktestResults';
import { PanelWrapper } from './PanelWrapper';
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

export default function Backtester() {
  const { strategies } = useStrategies();
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [progress, setProgress] = useState<BacktestProgressType | null>(null);
  const [results, setResults] = useState<BacktestResultsType | null>(null);
  const [latestUpdate, setLatestUpdate] = useState<any>(null);
  const [dataSource, setDataSource] = useState<string | null>(null);
  const [scenario, setScenario] = useState('sideways');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [riskFilter, setRiskFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const strategy = strategies.find(s => s.id === selectedStrategy);

  const filteredStrategies = useMemo(() => {
    return strategies
      .filter(s => {
        const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            s.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRisk = !riskFilter || s.risk_level === riskFilter;
        return matchesSearch && matchesRisk;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case 'title':
            comparison = a.title.localeCompare(b.title);
            break;
          case 'performance':
            comparison = (a.performance || 0) - (b.performance || 0);
            break;
          case 'risk_level':
            comparison = a.risk_level.localeCompare(b.risk_level);
            break;
          case 'created_at':
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [strategies, searchTerm, sortField, sortOrder, riskFilter]);

  const totalPages = Math.ceil(filteredStrategies.length / ITEMS_PER_PAGE);
  const paginatedStrategies = filteredStrategies.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    try {
      const text = await file.text();
      Papa.parse(text, {
        complete: (results) => {
          const headers = results.data[0];
          const requiredColumns = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
          const hasValidHeaders = requiredColumns.every(col => 
            headers.includes(col)
          );

          if (!hasValidHeaders) {
            setUploadError('Invalid CSV format. Required columns: timestamp, open, high, low, close, volume');
            return;
          }

          const data = results.data.slice(1).map(row => ({
            timestamp: new Date(row[0]).getTime(),
            open: parseFloat(row[1]),
            high: parseFloat(row[2]),
            low: parseFloat(row[3]),
            close: parseFloat(row[4]),
            volume: parseFloat(row[5])
          }));

          handleStartBacktest({
            ...config,
            data,
            dataSource: 'file'
          });
        },
        error: (error) => {
          setUploadError(`Error parsing CSV: ${error.message}`);
        }
      });
    } catch (error) {
      setUploadError('Error reading file');
    }
  };

  const handleStartBacktest = async (config: BacktestConfig) => {
    setShowConfig(false);
    setProgress({ 
      status: 'running', 
      progress: 0, 
      currentStep: 'Initializing backtest...' 
    });

    try {
      backtestService.on('progress', setProgress);
      backtestService.on('update', setLatestUpdate);
      await backtestService.runBacktest(config);
    } catch (error) {
      setProgress({
        status: 'error',
        progress: 0,
        currentStep: 'Backtest failed',
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
    }
  };

  const handleCancelBacktest = () => {
    backtestService.cancelBacktest();
    setProgress(null);
    setLatestUpdate(null);
  };

  useEffect(() => {
    if (progress?.status === 'completed' && progress.results) {
      setResults(progress.results);
      setProgress(null);
      setLatestUpdate(null);
    }
  }, [progress]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="p-8 space-y-6">
      <PanelWrapper index={0}>
        <div className="bg-gunmetal-800/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-6 h-6 text-neon-raspberry" />
            <h2 className="text-xl font-bold gradient-text">Strategy Backtester</h2>
          </div>
          <p className="text-sm text-gray-400">
            Test your trading strategies against historical market data to evaluate performance and optimize parameters before going live.
          </p>
        </div>
      </PanelWrapper>

      <PanelWrapper index={1}>
        <div className="bg-gunmetal-800/20 rounded-xl p-4">
          <div className="flex flex-col gap-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-200">Select Strategy</h3>
            
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search strategies..."
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={riskFilter || ''}
                  onChange={(e) => setRiskFilter(e.target.value || null)}
                  className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                >
                  <option value="">All Risk Levels</option>
                  <option value="Ultra Low">Ultra Low</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Ultra High">Ultra High</option>
                  <option value="Extreme">Extreme</option>
                  <option value="God Mode">God Mode</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-gunmetal-900/30 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gunmetal-800/50">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-neon-turquoise w-1/3"
                      onClick={() => toggleSort('title')}
                    >
                      <div className="flex items-center gap-2">
                        Strategy
                        {sortField === 'title' && (
                          sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-neon-turquoise w-32"
                      onClick={() => toggleSort('risk_level')}
                    >
                      <div className="flex items-center gap-2">
                        Risk Level
                        {sortField === 'risk_level' && (
                          sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-32">
                      Market Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-48">
                      Assets
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider w-32">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gunmetal-800">
                  {paginatedStrategies.map((s) => (
                    <tr 
                      key={s.id}
                      className={`hover:bg-gunmetal-800/30 transition-colors ${
                        selectedStrategy === s.id ? 'bg-gunmetal-800/50' : ''
                      }`}
                    >
                      <td className="px-6 py-3">
                        <div>
                          <div className="text-sm font-medium text-gray-200">{s.title}</div>
                          <div className="text-sm text-gray-400 break-words line-clamp-2 max-w-xs">{s.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {s.risk_level === 'High' ? (
                            <Target className="w-4 h-4 text-neon-pink" />
                          ) : s.risk_level === 'Medium' ? (
                            <BarChart3 className="w-4 h-4 text-neon-yellow" />
                          ) : (
                            <Shield className="w-4 h-4 text-neon-turquoise" />
                          )}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            s.risk_level === 'High' ? 'bg-neon-pink/20 text-neon-pink' :
                            s.risk_level === 'Medium' ? 'bg-neon-yellow/20 text-neon-yellow' :
                            'bg-neon-turquoise/20 text-neon-turquoise'
                          }`}>
                            {s.risk_level}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          s.strategy_config?.market_type === 'futures' 
                            ? 'bg-neon-orange/20 text-neon-orange'
                            : 'bg-neon-turquoise/20 text-neon-turquoise'
                        }`}>
                          <Tag className="w-3 h-3 mr-1" />
                          {s.strategy_config?.market_type || 'spot'}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {s.strategy_config?.assets?.slice(0, 3).map((asset: string, index: number) => (
                            <span 
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gunmetal-800 text-gray-300"
                            >
                              {asset.replace('_', '/')}
                            </span>
                          ))}
                          {(s.strategy_config?.assets?.length || 0) > 3 && (
                            <span className="text-xs text-gray-400">
                              +{(s.strategy_config?.assets?.length || 0) - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => {
                            setSelectedStrategy(s.id);
                            setShowConfig(true);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-gunmetal-800 text-gray-200 rounded-lg hover:bg-gunmetal-700 transition-all duration-300 text-sm"
                        >
                          Backtest
                          <Play className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 bg-gunmetal-800/30">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">
                    Showing {currentPage * ITEMS_PER_PAGE + 1} to {Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredStrategies.length)} of {filteredStrategies.length} strategies
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className="p-2 rounded-lg bg-gunmetal-800 text-gray-400 hover:text-neon-turquoise transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex gap-2">
                    {Array.from({ length: totalPages }).map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentPage(index)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentPage
                            ? 'bg-neon-raspberry w-8'
                            : 'bg-gunmetal-700 hover:bg-gunmetal-600'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage === totalPages - 1}
                    className="p-2 rounded-lg bg-gunmetal-800 text-gray-400 hover:text-neon-turquoise transition-colors disabled:opacity-50"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </PanelWrapper>

      {selectedStrategy && !dataSource && !progress && !results && (
        <PanelWrapper index={2}>
          <div className="bg-gunmetal-800/20 rounded-xl p-4 md:p-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-6">Choose Data Source</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {DATA_SOURCE_OPTIONS.map(option => {
                const Icon = option.icon;
                return (
                  <motion.button
                    key={option.id}
                    onClick={() => setDataSource(option.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-gunmetal-900/50 backdrop-blur-xl rounded-xl p-4 md:p-6 border border-gunmetal-800 hover:border-neon-raspberry/50 transition-all duration-300 text-left"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-neon-raspberry/10">
                        <Icon className="w-6 h-6 text-neon-raspberry" />
                      </div>
                      <h3 className="text-lg font-semibold">{option.name}</h3>
                    </div>
                    <p className="text-sm text-gray-400">{option.description}</p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </PanelWrapper>
      )}

      {dataSource === 'synthetic' && (
        <PanelWrapper index={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gunmetal-800/20 rounded-xl p-4 md:p-6"
          >
            <h3 className="text-lg font-semibold text-gray-200 mb-6">Market Scenario</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {MARKET_SCENARIOS.map((scenarioOption) => (
                <button
                  key={scenarioOption.id}
                  onClick={() => setScenario(scenarioOption.id)}
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

            <div className="flex flex-col md:flex-row justify-end gap-3 mt-6">
              <button
                onClick={() => setDataSource(null)}
                className="w-full md:w-auto px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
              >
                Back
              </button>
              <button
                onClick={() => setShowConfig(true)}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-neon-raspberry text-white rounded-lg hover:bg-[#FF69B4] transition-all duration-300"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </PanelWrapper>
      )}

      {dataSource === 'file' && (
        <PanelWrapper index={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gunmetal-800/20 rounded-xl p-4 md:p-6"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-6">
              <FileUp className="w-6 h-6 text-neon-raspberry" />
              <h3 className="text-lg font-semibold text-gray-200">Upload OHLCV Data</h3>
            </div>
            
            {uploadError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {uploadError}
              </div>
            )}

            <div className="space-y-6">
              <div className="border-2 border-dashed border-gunmetal-700 rounded-xl p-4 md:p-8 text-center">
                <FileUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-300 mb-2">
                  Upload a CSV file with OHLCV data
                </p>
                <p className="text-sm text-gray-400 mb-4">
                  Required columns: timestamp, open, high, low, close, volume
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-neon-raspberry text-white rounded-lg hover:bg-[#FF69B4] transition-all duration-300 cursor-pointer"
                >
                  <FileUp className="w-5 h-5" />
                  Select File
                </label>
              </div>

              <div className="bg-gunmetal-900/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <Clock className="w-4 h-4" />
                  CSV Format Example
                </div>
                <div className="overflow-x-auto">
                  <pre className="text-sm font-mono text-gray-300 p-2">
                    timestamp,open,high,low,close,volume{'\n'}
                    1625097600000,35000.00,35500.00,34800.00,35200.00,1250.50{'\n'}
                    1625184000000,35200.00,35800.00,35100.00,35600.00,1100.25
                  </pre>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-end gap-3">
                <button
                  onClick={() => setDataSource(null)}
                  className="w-full md:w-auto px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
                >
                  Back
                </button>
              </div>
            </div>
          </motion.div>
        </PanelWrapper>
      )}

      {showConfig && strategy && (
        <BacktestConfigModal
          strategy={strategy}
          onConfirm={(config) => handleStartBacktest({ ...config, dataSource, scenario })}
          onCancel={() => setShowConfig(false)}
        />
      )}

      {progress && (
        <BacktestProgress
          progress={progress.progress}
          currentStep={progress.currentStep}
          status={progress.status}
          error={progress.error}
          latestUpdate={latestUpdate}
          onCancel={handleCancelBacktest}
        />
      )}

      {results && (
        <BacktestResults
          results={results}
          onClose={() => setResults(null)}
        />
      )}
    </div>
  );
}