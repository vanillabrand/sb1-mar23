import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  RefreshCw, 
  Search, 
  Filter, 
  ChevronDown,
  HelpCircle,
  AlertTriangle,
  Info,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { tradeService } from '../../lib/trade-service';
import { strategyService } from '../../lib/strategy-service';
import { logService } from '../../lib/log-service';
import { demoService } from '../../lib/demo-service';
import { BeginnerTradeCard } from './BeginnerTradeCard';
import { BeginnerTradeDetails } from './BeginnerTradeDetails';
import { BeginnerTradeGuide } from './BeginnerTradeGuide';
import { Strategy, Trade } from '../../lib/types';
import { formatCurrency } from '../../lib/format-utils';

interface BeginnerTradeMonitorProps {
  strategies?: Strategy[];
  className?: string;
}

export function BeginnerTradeMonitor({ strategies = [], className = '' }: BeginnerTradeMonitorProps) {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(demoService.isDemoMode());
  const [allStrategies, setAllStrategies] = useState<Strategy[]>(strategies);
  const [totalProfit, setTotalProfit] = useState(0);
  const [openTradesCount, setOpenTradesCount] = useState(0);
  const [closedTradesCount, setClosedTradesCount] = useState(0);

  // Load trades and strategies
  useEffect(() => {
    loadData();

    // Listen for trade updates
    document.addEventListener('trades:updated', handleTradesUpdated);
    document.addEventListener('demo:changed', handleDemoModeChanged);

    return () => {
      document.removeEventListener('trades:updated', handleTradesUpdated);
      document.removeEventListener('demo:changed', handleDemoModeChanged);
    };
  }, []);

  // Filter trades based on search term, status filter, and strategy filter
  useEffect(() => {
    if (!trades) return;

    let filtered = [...trades];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(trade => 
        (trade.symbol?.toLowerCase().includes(term) || 
         trade.strategy_name?.toLowerCase().includes(term) ||
         trade.id.toLowerCase().includes(term))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(trade => {
        if (statusFilter === 'open') {
          return trade.status === 'open' || trade.status === 'pending';
        } else {
          return trade.status === 'closed' || trade.status === 'canceled';
        }
      });
    }

    // Apply strategy filter
    if (strategyFilter !== 'all') {
      filtered = filtered.filter(trade => trade.strategy_id === strategyFilter);
    }

    // Sort trades by date (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at || a.timestamp || 0).getTime();
      const dateB = new Date(b.created_at || b.timestamp || 0).getTime();
      return dateB - dateA;
    });

    setFilteredTrades(filtered);
  }, [trades, searchTerm, statusFilter, strategyFilter]);

  // Calculate statistics
  useEffect(() => {
    if (!trades) return;

    // Calculate total profit
    const profit = trades.reduce((total, trade) => {
      if (trade.status === 'closed' && trade.profit) {
        return total + (typeof trade.profit === 'number' ? trade.profit : parseFloat(trade.profit));
      }
      return total;
    }, 0);
    setTotalProfit(profit);

    // Count open and closed trades
    const openCount = trades.filter(trade => trade.status === 'open' || trade.status === 'pending').length;
    const closedCount = trades.filter(trade => trade.status === 'closed' || trade.status === 'canceled').length;
    setOpenTradesCount(openCount);
    setClosedTradesCount(closedCount);
  }, [trades]);

  // Handle trades updated event
  const handleTradesUpdated = () => {
    loadTrades();
  };

  // Handle demo mode changed event
  const handleDemoModeChanged = () => {
    setIsDemoMode(demoService.isDemoMode());
    loadData();
  };

  // Load all data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        loadTrades(),
        loadStrategies()
      ]);
    } catch (err) {
      logService.log('error', 'Failed to load trade monitor data', err, 'BeginnerTradeMonitor');
      setError('Failed to load trade data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load trades
  const loadTrades = async () => {
    try {
      const loadedTrades = await tradeService.getTrades();
      setTrades(loadedTrades);
    } catch (err) {
      logService.log('error', 'Failed to load trades', err, 'BeginnerTradeMonitor');
      throw err;
    }
  };

  // Load strategies
  const loadStrategies = async () => {
    try {
      if (strategies && strategies.length > 0) {
        setAllStrategies(strategies);
      } else {
        const loadedStrategies = await strategyService.getStrategies();
        setAllStrategies(loadedStrategies);
      }
    } catch (err) {
      logService.log('error', 'Failed to load strategies', err, 'BeginnerTradeMonitor');
      throw err;
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      await loadData();
    } catch (err) {
      logService.log('error', 'Failed to refresh trade data', err, 'BeginnerTradeMonitor');
      setError('Failed to refresh trade data. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle trade selection
  const handleSelectTrade = (trade: Trade) => {
    setSelectedTrade(trade);
    setShowGuide(false);
  };

  // Handle back to list
  const handleBackToList = () => {
    setSelectedTrade(null);
  };

  // Handle show guide
  const handleShowGuide = () => {
    setShowGuide(true);
    setSelectedTrade(null);
  };

  // If a trade is selected, show its details
  if (selectedTrade) {
    return (
      <div className={`min-h-screen bg-black p-4 sm:p-6 md:p-8 pb-24 sm:pb-8 ${className}`}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-6xl mx-auto"
        >
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 mb-6 text-gray-400 hover:text-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Trades
          </button>

          <BeginnerTradeDetails 
            trade={selectedTrade} 
            onRefresh={handleRefresh}
          />
        </motion.div>
      </div>
    );
  }

  // If guide is shown, display the trade guide
  if (showGuide) {
    return (
      <div className={`min-h-screen bg-black p-4 sm:p-6 md:p-8 pb-24 sm:pb-8 ${className}`}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-6xl mx-auto"
        >
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 mb-6 text-gray-400 hover:text-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Trades
          </button>

          <BeginnerTradeGuide onClose={handleBackToList} />
        </motion.div>
      </div>
    );
  }

  // Main trade list view
  return (
    <div className={`min-h-screen bg-black p-4 sm:p-6 md:p-8 pb-24 sm:pb-8 ${className}`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl mx-auto"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-6 h-6 text-neon-turquoise" />
              <h1 className="text-2xl font-bold gradient-text">Trade Monitor</h1>
            </div>
            <p className="text-gray-400">
              Monitor and manage your trading activity
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg bg-gunmetal-800 hover:bg-gunmetal-700 transition-colors"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              isDemoMode ? 'bg-neon-yellow/20 text-neon-yellow' : 'bg-neon-green/20 text-neon-green'
            }`}>
              {isDemoMode ? 'Demo Mode' : 'Live Mode'}
            </div>
          </div>
        </div>

        {/* Beginner Guide Banner */}
        <div className="bg-gunmetal-900/50 border border-gunmetal-800 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-4">
            <div className="bg-gunmetal-800 rounded-full p-2 mt-1">
              <HelpCircle className="w-5 h-5 text-neon-yellow" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium mb-1">New to Trading?</h3>
              <p className="text-gray-400 text-sm mb-3">
                Learn how to understand and manage your trades with our beginner-friendly guide.
              </p>
              <button
                onClick={handleShowGuide}
                className="px-3 py-1.5 bg-neon-yellow/20 text-neon-yellow rounded-lg text-sm hover:bg-neon-yellow/30 transition-colors"
              >
                Trading Guide
              </button>
            </div>
          </div>
        </div>

        {/* Trade Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gunmetal-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-neon-green" />
              <h3 className="font-medium">Total Profit/Loss</h3>
            </div>
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-neon-green' : 'text-neon-raspberry'}`}>
              {formatCurrency(totalProfit)}
            </div>
          </div>
          
          <div className="bg-gunmetal-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-neon-yellow" />
              <h3 className="font-medium">Open Trades</h3>
            </div>
            <div className="text-2xl font-bold">
              {openTradesCount}
            </div>
          </div>
          
          <div className="bg-gunmetal-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-neon-turquoise" />
              <h3 className="font-medium">Closed Trades</h3>
            </div>
            <div className="text-2xl font-bold">
              {closedTradesCount}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search trades..."
              className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-2">
            <div className="relative">
              <div className="flex items-center">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent appearance-none pr-8"
                >
                  <option value="all">All Trades</option>
                  <option value="open">Open Trades</option>
                  <option value="closed">Closed Trades</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 pointer-events-none" />
              </div>
            </div>
            
            <div className="relative">
              <div className="flex items-center">
                <select
                  value={strategyFilter}
                  onChange={(e) => setStrategyFilter(e.target.value)}
                  className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent appearance-none pr-8"
                >
                  <option value="all">All Strategies</option>
                  {allStrategies.map(strategy => (
                    <option key={strategy.id} value={strategy.id}>
                      {strategy.title || strategy.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Trades List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-turquoise"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <div>
              <h3 className="font-medium mb-1">Error Loading Trades</h3>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="bg-gunmetal-900/50 rounded-lg p-8 text-center">
            <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Trades Found</h3>
            <p className="text-gray-400 mb-4">
              {trades.length === 0 
                ? "You don't have any trades yet" 
                : "No trades match your filters"}
            </p>
            <p className="text-sm text-gray-500">
              Trades will appear here once your strategies start trading
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTrades.map(trade => (
              <BeginnerTradeCard
                key={trade.id}
                trade={trade}
                onViewDetails={() => handleSelectTrade(trade)}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
