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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File size exceeds 10MB limit');
      return;
    }

    setUploadError(null);

    try {
      const text = await file.text();
      Papa.parse<string[]>(text, {
        complete: (results) => {
          const headers = results.data[0] as string[];
          const requiredColumns = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
          const hasValidHeaders = requiredColumns.every(col => 
            headers.includes(col)
          );

          if (!hasValidHeaders) {
            setUploadError('Invalid CSV format. Required columns: timestamp, open, high, low, close, volume');
            return;
          }

          const data = results.data.slice(1).map(row => {
            const parsedRow = {
              timestamp: new Date(row[0]).getTime(),
              open: parseFloat(row[1]) || 0,
              high: parseFloat(row[2]) || 0,
              low: parseFloat(row[3]) || 0,
              close: parseFloat(row[4]) || 0,
              volume: parseFloat(row[5]) || 0
            };

            if (isNaN(parsedRow.timestamp)) {
              throw new Error('Invalid timestamp format');
            }

            return parsedRow;
          });

          handleStartBacktest({
            ...config,
            data,
            dataSource: 'file'
          });
        },
        error: (error: Papa.ParseError) => {
          setUploadError(`CSV parsing error: ${error.message}`);
        }
      });
    } catch (error) {
      setUploadError('Error reading file');
      console.error('File reading error:', error);
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
    <motion.div layout className="min-h-[600px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <table>
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
        </motion.div>
      </AnimatePresence>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        showPageNumbers={true}
        itemsPerPage={ITEMS_PER_PAGE}
        totalItems={filteredStrategies.length}
        className="mt-4"
      />
    </motion.div>
  );
}
