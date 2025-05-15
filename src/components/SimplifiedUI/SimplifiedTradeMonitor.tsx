import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { 
  TrendingUp, 
  AlertCircle, 
  Loader2, 
  Search,
  Filter,
  ArrowLeft,
  RefreshCw,
  Plus
} from 'lucide-react';
import { tradeService } from '../../lib/trade-service';
import { strategySync } from '../../lib/strategy-sync';
import { logService } from '../../lib/log-service';
import { Trade, Strategy } from '../../lib/types';
import { SimplifiedTradeCard } from './SimplifiedTradeCard';
import { SimplifiedTradeDetails } from './SimplifiedTradeDetails';
import { SimplifiedTradeCreator } from './SimplifiedTradeCreator';

export function SimplifiedTradeMonitor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'pending'>('all');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [showTradeCreator, setShowTradeCreator] = useState(false);
  
  // Get trade ID from URL params
  const tradeId = searchParams.get('id');
  const action = searchParams.get('action');
  
  // Load data on component mount
  useEffect(() => {
    loadData();
    
    // Listen for trade updates
    document.addEventListener('trades:updated', handleTradesUpdated);
    
    return () => {
      document.removeEventListener('trades:updated', handleTradesUpdated);
    };
  }, []);
  
  // Handle URL params
  useEffect(() => {
    if (action === 'create') {
      setShowTradeCreator(true);
    } else if (tradeId) {
      const trade = trades.find(t => t.id === tradeId);
      if (trade) {
        setSelectedTrade(trade);
      }
    }
  }, [tradeId, action, trades]);
  
  // Apply filters when trades or filter criteria change
  useEffect(() => {
    applyFilters();
  }, [trades, searchTerm, statusFilter, strategyFilter]);
  
  // Handle trades updated event
  const handleTradesUpdated = () => {
    loadTrades();
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
      
      setLoading(false);
    } catch (err) {
      setError('Failed to load trade data');
      setLoading(false);
      logService.log('error', 'Failed to load trade data', err, 'SimplifiedTradeMonitor');
    }
  };
  
  // Load trades
  const loadTrades = async () => {
    try {
      const allTrades = await tradeService.getAllTrades();
      setTrades(allTrades);
    } catch (err) {
      logService.log('error', 'Failed to load trades', err, 'SimplifiedTradeMonitor');
    }
  };
  
  // Load strategies
  const loadStrategies = async () => {
    try {
      const allStrategies = strategySync.getAllStrategies();
      setStrategies(allStrategies);
    } catch (err) {
      logService.log('error', 'Failed to load strategies', err, 'SimplifiedTradeMonitor');
    }
  };
  
  // Apply filters to trades
  const applyFilters = () => {
    let filtered = [...trades];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(trade => 
        trade.symbol.toLowerCase().includes(term)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(trade => {
        if (statusFilter === 'open') {
          return trade.status === 'open' || trade.status === 'active';
        } else if (statusFilter === 'closed') {
          return trade.status === 'closed' || trade.status === 'completed';
        } else if (statusFilter === 'pending') {
          return trade.status === 'pending';
        }
        return true;
      });
    }
    
    // Apply strategy filter
    if (strategyFilter !== 'all') {
      filtered = filtered.filter(trade => 
        trade.strategyId === strategyFilter || trade.strategy_id === strategyFilter
      );
    }
    
    setFilteredTrades(filtered);
  };
  
  // Refresh trades
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadTrades();
      setRefreshing(false);
    } catch (err) {
      setRefreshing(false);
      logService.log('error', 'Failed to refresh trades', err, 'SimplifiedTradeMonitor');
    }
  };
  
  // Handle view trade details
  const handleViewTradeDetails = (trade: Trade) => {
    setSelectedTrade(trade);
    setSearchParams({ id: trade.id });
  };
  
  // Handle back to list
  const handleBackToList = () => {
    setSelectedTrade(null);
    setSearchParams({});
  };
  
  // Handle create trade
  const handleCreateTrade = () => {
    setShowTradeCreator(true);
    setSearchParams({ action: 'create' });
  };
  
  // Handle trade created
  const handleTradeCreated = () => {
    setShowTradeCreator(false);
    loadTrades();
    setSearchParams({});
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
      </div>
    );
  }
  
  // Render trade details view
  if (selectedTrade) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 mb-4 text-gray-400 hover:text-neon-turquoise transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Trades
        </button>
        
        <SimplifiedTradeDetails 
          trade={selectedTrade} 
          onRefresh={loadTrades}
        />
      </motion.div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Trade Monitor</h1>
          <p className="text-gray-400">Monitor and manage your active and historical trades</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-gunmetal-800 rounded-lg text-gray-400 hover:text-neon-turquoise transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
          {strategies.some(s => s.status === 'active') && (
            <button
              onClick={handleCreateTrade}
              className="flex items-center gap-2 px-4 py-2 bg-neon-raspberry text-white rounded-lg hover:bg-opacity-90 transition-all duration-300"
            >
              <Plus className="w-4 h-4" />
              New Trade
            </button>
          )}
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by symbol..."
            className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'open' | 'closed' | 'pending')}
          className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="closed">Closed</option>
        </select>
        
        <select
          value={strategyFilter}
          onChange={(e) => setStrategyFilter(e.target.value)}
          className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
        >
          <option value="all">All Strategies</option>
          {strategies.map(strategy => (
            <option key={strategy.id} value={strategy.id}>
              {strategy.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* Trades List */}
      {filteredTrades.length === 0 ? (
        <div className="bg-gunmetal-800/50 rounded-lg p-8 text-center">
          <TrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Trades Found</h3>
          <p className="text-gray-400 mb-4">
            {trades.length === 0 
              ? "You haven't created any trades yet" 
              : "No trades match your filters"}
          </p>
          {strategies.some(s => s.status === 'active') && (
            <button
              onClick={handleCreateTrade}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-all duration-300"
            >
              <Plus className="w-4 h-4" />
              Create Trade
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTrades.map(trade => (
            <SimplifiedTradeCard 
              key={trade.id} 
              trade={trade} 
              onViewDetails={() => handleViewTradeDetails(trade)}
            />
          ))}
        </div>
      )}
      
      {/* Trade Creator */}
      {showTradeCreator && (
        <SimplifiedTradeCreator
          strategies={strategies.filter(s => s.status === 'active')}
          onComplete={handleTradeCreated}
          onCancel={() => {
            setShowTradeCreator(false);
            setSearchParams({});
          }}
        />
      )}
    </motion.div>
  );
}
