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
import type { Strategy } from '../lib/types';
import type { BacktestConfig, BacktestProgress as BacktestProgressType, BacktestResults as BacktestResultsType } from '../lib/backtest-service';

type SortField = 'title' | 'created_at' | 'performance' | 'risk_level';
type SortOrder = 'asc' | 'desc';

// Number of strategies to show per page

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

const ITEMS_PER_PAGE = 6; // Number of strategies to show per page

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function Backtester() {
  const [showConfig, setShowConfig] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [progress, setProgress] = useState<BacktestProgressType | null>(null);
  const [latestUpdate, setLatestUpdate] = useState<any | null>(null);
  const [results, setResults] = useState<BacktestResultsType | null>(null);
  const [showResults, setShowResults] = useState(false);
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const { strategies } = useStrategies();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterRiskLevel, setFilterRiskLevel] = useState<string | null>(null);

  useEffect(() => {
    // Set up event listeners for backtest progress and updates
    const progressHandler = (data: BacktestProgressType) => {
      setProgress(data);

      if (data.status === 'completed' && data.results) {
        setResults(data.results);
        setShowResults(true);
        setProgress(null);

        // Scroll to results section after a short delay to ensure it's rendered
        setTimeout(() => {
          if (resultsRef.current) {
            resultsRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 300);
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

      // Scroll to the progress section after a short delay to ensure it's rendered
      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);

      await backtestService.runBacktest(config);
    } catch (error) {
      logService.log('error', 'Failed to start backtest', error, 'Backtester');
      setProgress({
        status: 'error',
        progress: 0,
        currentStep: 'Error',
        error: error instanceof Error ? error.message : 'Failed to start backtest'
      });

      // Also scroll to the error message
      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    }
  };

  const handleCancelBacktest = () => {
    backtestService.cancelBacktest();
    setProgress(null);
  };

  // Filter and sort strategies
  const filteredStrategies = useMemo(() => {
    return strategies
      .filter(strategy => {
        // Filter by search term
        const matchesSearch = searchTerm === '' ||
          strategy.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (strategy.description && strategy.description.toLowerCase().includes(searchTerm.toLowerCase()));

        // Filter by risk level
        const matchesRiskLevel = !filterRiskLevel ||
          strategy.risk_level === filterRiskLevel;

        return matchesSearch && matchesRiskLevel;
      })
      .sort((a, b) => {
        // Sort by selected field
        let aValue = a[sortField];
        let bValue = b[sortField];

        // Handle special cases
        if (sortField === 'performance') {
          aValue = parseFloat(aValue) || 0;
          bValue = parseFloat(bValue) || 0;
        }

        // Apply sort order
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
  }, [strategies, searchTerm, filterRiskLevel, sortField, sortOrder]);

  // Paginate strategies
  const paginatedStrategies = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStrategies.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStrategies, currentPage]);

  // Calculate total pages
  const totalPages = Math.ceil(filteredStrategies.length / ITEMS_PER_PAGE);

  // Handle sort toggle
  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <PanelWrapper title="Backtester" icon={<BarChart3 className="w-5 h-5" />} className="bg-black">
      <div className="space-y-8 p-2 max-w-[1800px] mx-auto">
        {/* Introduction Section */}
        <div className="bg-gunmetal-800/30 rounded-xl p-6 border border-gunmetal-700/50 shadow-lg">
          <h2 className="gradient-text mb-3">Strategy Backtesting</h2>
          <p className="description-text mb-4">Test your trading strategies against historical market data to evaluate performance before deploying with real assets.</p>
        </div>

        {/* Search and Filter Controls */}
        <div className="bg-gunmetal-800/30 rounded-xl p-6 border border-gunmetal-700/50 shadow-lg">
          <h3 className="gradient-text mb-4">Select a Strategy to Test</h3>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search strategies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gunmetal-800/50 border border-gunmetal-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neon-turquoise/50 focus:border-neon-turquoise/50"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <button
                  className="px-3 py-2 bg-gunmetal-800/50 border border-gunmetal-700 rounded-lg text-sm text-gray-300 hover:bg-gunmetal-700/50 transition-colors flex items-center gap-2"
                  onClick={() => setFilterRiskLevel(filterRiskLevel ? null : 'Low')}
                >
                  <Filter className="w-4 h-4" />
                  {filterRiskLevel || 'Risk Level'}
                  {filterRiskLevel && <X className="w-3 h-3" />}
                </button>
              </div>

              <button
                className="px-3 py-2 bg-gunmetal-800/50 border border-gunmetal-700 rounded-lg text-sm text-gray-300 hover:bg-gunmetal-700/50 transition-colors flex items-center gap-2"
                onClick={() => handleSortToggle('title')}
              >
                {sortField === 'title' ? (
                  sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
                ) : (
                  <Tag className="w-4 h-4" />
                )}
                Name
              </button>

              <button
                className="px-3 py-2 bg-gunmetal-800/50 border border-gunmetal-700 rounded-lg text-sm text-gray-300 hover:bg-gunmetal-700/50 transition-colors flex items-center gap-2"
                onClick={() => handleSortToggle('performance')}
              >
                {sortField === 'performance' ? (
                  sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
                ) : (
                  <Target className="w-4 h-4" />
                )}
                Performance
              </button>
            </div>
          </div>

          {/* Strategy Selection Table */}
          <div className="bg-gunmetal-900/50 rounded-xl overflow-hidden border border-gunmetal-800/70 shadow-inner">
            <table className="w-full">
              <thead className="bg-gunmetal-800/70">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Strategy
                  </th>
                  <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Risk Level
                  </th>
                  <th className="hidden sm:table-cell px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Assets
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gunmetal-800">
                {paginatedStrategies.length > 0 ? (
                  paginatedStrategies.map((strategy) => (
                    <tr key={strategy.id} className="hover:bg-gunmetal-800/30 transition-colors">
                      <td className="px-6 py-5">
                        <div className="text-sm font-medium text-gray-200">{strategy.title}</div>
                        <div className="text-xs text-gray-400 mt-1 line-clamp-1">{strategy.description}</div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${strategy.risk_level === 'High' ? 'bg-neon-pink/10 text-neon-pink' : strategy.risk_level === 'Medium' ? 'bg-neon-orange/10 text-neon-orange' : 'bg-neon-turquoise/10 text-neon-turquoise'}`}>
                          {strategy.risk_level}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-6 py-5">
                        <div className="flex flex-wrap gap-1">
                          {strategy.selected_pairs && strategy.selected_pairs.map((asset) => (
                            <span key={asset} className="px-2 py-1 bg-gunmetal-700 rounded-full text-xs text-gray-300">
                              {asset}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => {
                            setSelectedStrategy(strategy);
                            setShowConfig(true);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all font-medium shadow-lg shadow-neon-turquoise/20 btn-text-small"
                        >
                          <Play className="w-4 h-4" />
                          Run Backtest
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertTriangle className="w-6 h-6 text-neon-orange" />
                        <p>No strategies found matching your filters.</p>
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm('')}
                            className="text-neon-turquoise hover:text-neon-yellow transition-colors text-sm"
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <nav className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg ${currentPage === 1 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-gray-200 hover:bg-gunmetal-800/50'}`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-8 h-8 rounded-lg btn-text-small ${currentPage === page ? 'bg-neon-turquoise text-gunmetal-950' : 'text-gray-400 hover:text-gray-200 hover:bg-gunmetal-800/50'}`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg ${currentPage === totalPages ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-gray-200 hover:bg-gunmetal-800/50'}`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </nav>
            </div>
          )}
        </div>

        {/* Progress Section */}
        {progress && (
          <div className="bg-gunmetal-800/30 rounded-xl p-6 border border-gunmetal-700/50 shadow-lg">
            <BacktestProgress
              progress={progress}
              latestUpdate={latestUpdate}
              onCancel={handleCancelBacktest}
            />
          </div>
        )}

        {/* Results Section Reference */}
        <div ref={resultsRef} id="backtest-results"></div>
      </div>

      {/* Modals */}
      <BacktestConfigModal
        open={showConfig}
        strategy={selectedStrategy || {} as Strategy}
        onClose={() => setShowConfig(false)}
        onStart={handleStartBacktest}
      />

      {/* Results Modal */}
      {showResults && results && (
        <BacktestResults
          results={results}
          onClose={() => setShowResults(false)}
        />
      )}
    </PanelWrapper>
  );
}
