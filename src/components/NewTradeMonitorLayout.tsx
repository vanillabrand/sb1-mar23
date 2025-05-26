import React, { useState, useEffect } from 'react';
import {
  Loader2,
  RefreshCw,
  Search,
  Clock,
  Activity,
  Filter,
  SlidersHorizontal,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { ErrorDisplay } from './ErrorDisplay';
import { strategyService } from '../lib/strategy-service';
import { tradeService } from '../lib/trade-service';
import { logService } from '../lib/log-service';
import { supabase } from '../lib/enhanced-supabase';
import { eventBus } from '../lib/event-bus';
import { demoService } from '../lib/demo-service';
import { strategySync } from '../lib/strategy-sync';
import { ErrorBoundary } from './ErrorBoundary';
import { MarketTypeBalanceDisplay } from './MarketTypeBalanceDisplay';
import { TradeFlowDiagram } from './TradeFlowDiagram';
import { formatDistanceToNow } from 'date-fns';
import type { Strategy, StrategyBudget, MarketType } from '../lib/types';
import { rustApiService } from '../lib/rust-api-service';
import { useRustApi } from './RustApiProvider';

// Define a more flexible trade type that includes database fields
interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  status: 'pending' | 'open' | 'executed' | 'cancelled' | 'failed' | 'closed';
  amount?: number;
  price?: number;
  strategy_id?: string;
  strategyId?: string;
  created_at?: string;
  createdAt?: string;
  market_type?: MarketType;
  marketType?: MarketType;
  [key: string]: any; // Allow any other properties
}

interface NewTradeMonitorLayoutProps {
  className?: string;
}

export function NewTradeMonitorLayout({ className = '' }: NewTradeMonitorLayoutProps) {
  // Rust API integration
  const { isConnected: isApiConnected } = useRustApi();

  // State for strategies and trades
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategyTrades, setStrategyTrades] = useState<Record<string, Trade[]>>({});
  const [budgets, setBudgets] = useState<Record<string, StrategyBudget>>({});

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state for budget adjustment
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);

  // Fetch strategies and trades on component mount
  useEffect(() => {
    fetchStrategies().then(() => fetchTradeData());

    // Subscribe to strategy events
    const strategyUpdatedUnsubscribe = eventBus.subscribe('strategies:updated', (updatedStrategies) => {
      setStrategies(updatedStrategies);
    });

    // Subscribe to trade events
    const tradeUpdatedUnsubscribe = eventBus.subscribe('trade:updated', () => {
      fetchTradeData();
    });

    return () => {
      strategyUpdatedUnsubscribe();
      tradeUpdatedUnsubscribe();
    };
  }, []);

  // Fetch strategies from the database
  const fetchStrategies = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to get strategies from strategySync cache first for better performance
      const cachedStrategies = strategySync.getAllStrategies();

      if (cachedStrategies && cachedStrategies.length > 0) {
        setStrategies(cachedStrategies);
        setIsLoading(false);
        return cachedStrategies;
      }

      // If no cached strategies, get from database
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setStrategies(data || []);
      return data;
    } catch (error) {
      logService.log('error', 'Failed to fetch strategies', error, 'NewTradeMonitorLayout');
      setError('Failed to load strategies. Please try again.');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch trade data for all strategies
  const fetchTradeData = async () => {
    try {
      setRefreshing(true);

      // Try to use Rust API if connected
      if (isApiConnected) {
        try {
          logService.log('info', 'Fetching trade data via Rust API', null, 'NewTradeMonitorLayout');

          // Get all trades via Rust API
          const allTrades = await rustApiService.getTrades();
          setTrades(allTrades);

          // Group trades by strategy
          const tradesByStrategy: Record<string, Trade[]> = {};
          allTrades.forEach(trade => {
            const strategyId = trade.strategy_id || trade.strategyId;
            if (strategyId) {
              if (!tradesByStrategy[strategyId]) {
                tradesByStrategy[strategyId] = [];
              }
              tradesByStrategy[strategyId].push(trade);
            }
          });

          setStrategyTrades(tradesByStrategy);
          logService.log('info', `Fetched ${allTrades.length} trades via Rust API`, null, 'NewTradeMonitorLayout');
        } catch (apiError) {
          logService.log('warn', 'Failed to fetch trades via Rust API, falling back to trade service', apiError, 'NewTradeMonitorLayout');

          // Fallback to existing trade service
          const allTrades = await tradeService.getAllTrades();
          setTrades(allTrades);

          // Group trades by strategy
          const tradesByStrategy: Record<string, Trade[]> = {};
          allTrades.forEach(trade => {
            if (trade.strategy_id) {
              if (!tradesByStrategy[trade.strategy_id]) {
                tradesByStrategy[trade.strategy_id] = [];
              }
              tradesByStrategy[trade.strategy_id].push(trade);
            }
          });

          setStrategyTrades(tradesByStrategy);
        }
      } else {
        // Use existing trade service when API is not connected
        const allTrades = await tradeService.getAllTrades();
        setTrades(allTrades);

        // Group trades by strategy
        const tradesByStrategy: Record<string, Trade[]> = {};
        allTrades.forEach(trade => {
          if (trade.strategy_id) {
            if (!tradesByStrategy[trade.strategy_id]) {
              tradesByStrategy[trade.strategy_id] = [];
            }
            tradesByStrategy[trade.strategy_id].push(trade);
          }
        });

        setStrategyTrades(tradesByStrategy);
      }

      // Get budgets for all strategies (always use trade service for now)
      const budgetData: Record<string, StrategyBudget> = {};
      for (const strategy of strategies) {
        const budget = await tradeService.getBudget(strategy.id);
        if (budget) {
          budgetData[strategy.id] = {
            ...budget,
            allocationPercentage: budget.total > 0 ? (budget.allocated / budget.total) * 100 : 0,
            profitPercentage: budget.total > 0 && budget.profit ? (budget.profit / budget.total) * 100 : 0,
            profit: budget.profit || 0
          };
        }
      }

      setBudgets(budgetData);
      setLastUpdate(Date.now());
    } catch (error) {
      logService.log('error', 'Failed to fetch trade data', error, 'NewTradeMonitorLayout');
      setError('Failed to fetch trade data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle strategy activation
  const handleActivateStrategy = async (strategy: Strategy) => {
    try {
      setSelectedStrategyId(strategy.id);

      // Get the budget for the strategy
      const budget = tradeService.getBudget(strategy.id);

      if (!budget || budget.allocated <= 0) {
        setShowBudgetModal(true);
        return;
      }

      // Activate the strategy
      await strategyService.activateStrategy(strategy.id);

      // Refresh data
      await fetchStrategies();
      await fetchTradeData();

    } catch (error) {
      logService.log('error', 'Failed to activate strategy', error, 'NewTradeMonitorLayout');
      setError(`Failed to activate strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle strategy deactivation
  const handleDeactivateStrategy = async (strategy: Strategy) => {
    try {
      setSelectedStrategyId(strategy.id);

      // Deactivate the strategy
      await strategyService.deactivateStrategy(strategy.id);

      // Refresh data
      await fetchStrategies();
      await fetchTradeData();

    } catch (error) {
      logService.log('error', 'Failed to deactivate strategy', error, 'NewTradeMonitorLayout');
      setError(`Failed to deactivate strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Filter strategies based on search term and status filter
  const filteredStrategies = strategies.filter(strategy => {
    const matchesSearch = searchTerm === '' ||
      strategy.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (strategy.description && strategy.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && strategy.status === 'active') ||
      (statusFilter === 'inactive' && strategy.status !== 'active');

    return matchesSearch && matchesStatus;
  });

  // Handle trade actions
  const handleCloseTrade = async (trade: any) => {
    try {
      // Update trade status in database
      const { error } = await supabase
        .from('trades')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id);

      if (error) throw error;

      // Release budget for this trade
      if (trade.strategy_id && trade.price && trade.amount) {
        const tradeAmount = trade.amount * trade.price;
        await tradeService.releaseBudgetFromTrade(
          trade.strategy_id,
          tradeAmount,
          0,
          trade.id,
          'closed'
        );
      }

      fetchTradeData();
    } catch (error) {
      logService.log('error', 'Failed to close trade', error, 'NewTradeMonitorLayout');
      setError(`Failed to close trade: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteTrade = async (trade: any) => {
    try {
      // Delete trade from database
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', trade.id);

      if (error) throw error;

      fetchTradeData();
    } catch (error) {
      logService.log('error', 'Failed to delete trade', error, 'NewTradeMonitorLayout');
      setError(`Failed to delete trade: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-neon-turquoise mr-2" />
        <span className="text-lg">Loading trade monitor...</span>
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={<ErrorDisplay message="An error occurred in the Trade Monitor" />}>
      <div className={`min-h-screen bg-black p-4 sm:p-6 md:p-8 overflow-x-hidden pb-24 sm:pb-8 ${className}`}>
        <div className="space-y-6 max-w-[1800px] mx-auto">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-6 h-6 text-neon-pink" />
                <h1 className="text-2xl font-bold gradient-text">Trade Monitor</h1>
              </div>
              <p className="description-text mt-1 text-gray-300">
                Monitor your active trades in real-time. Track positions, P&L, and market conditions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {new Date(lastUpdate).toLocaleTimeString()}
              </span>
              <button
                onClick={() => fetchTradeData()}
                disabled={refreshing}
                className="px-3 py-1.5 bg-neon-turquoise hover:bg-neon-yellow text-gunmetal-950 text-sm rounded-lg transition-colors flex items-center gap-1 shadow-lg"
              >
                {refreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh
              </button>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search strategies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gunmetal-800/50 border border-gunmetal-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-turquoise"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Status:</span>
              <div className="flex bg-gunmetal-800/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 text-xs ${statusFilter === 'all' ? 'bg-neon-turquoise/20 text-neon-turquoise' : 'text-gray-400 hover:bg-gunmetal-700/50'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1.5 text-xs ${statusFilter === 'active' ? 'bg-neon-turquoise/20 text-neon-turquoise' : 'text-gray-400 hover:bg-gunmetal-700/50'}`}
                >
                  Active
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1.5 text-xs ${statusFilter === 'inactive' ? 'bg-neon-turquoise/20 text-neon-turquoise' : 'text-gray-400 hover:bg-gunmetal-700/50'}`}
                >
                  Inactive
                </button>
              </div>
            </div>
          </div>

          {/* Market Type Balance Display */}
          <div className="panel-metallic rounded-xl p-4">
            <h3 className="text-md font-semibold text-white mb-3">Market Type Balances</h3>
            <MarketTypeBalanceDisplay />
          </div>

          {/* Main Content */}
          <div className="panel-metallic rounded-xl p-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg mb-6">
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column - Strategies */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Strategies</h3>
                  <span className="text-sm text-gray-400">{filteredStrategies.length} strategies</span>
                </div>

                {filteredStrategies.length === 0 ? (
                  <div className="bg-gunmetal-800/50 p-4 rounded-lg text-center">
                    <p className="text-gray-400">No strategies found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredStrategies.map(strategy => (
                      <div key={strategy.id} className="bg-gunmetal-800/50 p-4 rounded-lg">
                        <h4 className="text-md font-medium text-white mb-2">{strategy.title}</h4>
                        <p className="text-sm text-gray-400 mb-3">{strategy.description}</p>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <span className="text-xs text-gray-400 block mb-1">Status</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              strategy.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {strategy.status}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 block mb-1">Market Type</span>
                            <span className="text-sm text-white">{strategy.market_type || 'Spot'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 block mb-1">Budget</span>
                            <span className="text-sm text-white">${budgets[strategy.id]?.allocated.toFixed(2) || '0.00'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 block mb-1">P/L</span>
                            <span className={`text-sm ${(budgets[strategy.id]?.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ${(budgets[strategy.id]?.profit || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-3">
                          {strategy.status === 'active' ? (
                            <button
                              onClick={() => handleDeactivateStrategy(strategy)}
                              className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs rounded-lg hover:bg-red-500/30 transition-colors"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivateStrategy(strategy)}
                              className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs rounded-lg hover:bg-green-500/30 transition-colors"
                            >
                              Activate
                            </button>
                          )}

                          <button
                            onClick={() => setExpandedStrategyId(expandedStrategyId === strategy.id ? null : strategy.id)}
                            className="px-3 py-1.5 bg-gunmetal-700/50 text-gray-300 text-xs rounded-lg hover:bg-gunmetal-700 transition-colors"
                          >
                            {expandedStrategyId === strategy.id ? 'Hide Trades' : 'Show Trades'}
                          </button>
                        </div>

                        {/* Expanded Strategy Trades */}
                        {expandedStrategyId === strategy.id && (
                          <div className="mt-4 pt-4 border-t border-gunmetal-700">
                            <h5 className="text-sm font-medium text-white mb-2">Strategy Trades</h5>
                            {strategyTrades[strategy.id]?.length > 0 ? (
                              <div className="space-y-3">
                                {strategyTrades[strategy.id].map(trade => (
                                  <div key={trade.id} className="bg-gunmetal-900/50 p-3 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-sm text-white">{trade.symbol}</span>
                                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                                        trade.status === 'open' ? 'bg-green-500/20 text-green-400' :
                                        trade.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                        trade.status === 'closed' ? 'bg-gray-500/20 text-gray-400' :
                                        'bg-red-500/20 text-red-400'
                                      }`}>
                                        {trade.status}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-gray-400">Side: </span>
                                        <span className={trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                                          {trade.side}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">Amount: </span>
                                        <span className="text-white">{trade.amount}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">Price: </span>
                                        <span className="text-white">${trade.price?.toFixed(2)}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">Created: </span>
                                        <span className="text-white">{formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400">No trades for this strategy</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column - Active Trades */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Active Trades</h3>
                  <span className="text-sm text-gray-400">
                    {trades.filter(t => t.status === 'open' || t.status === 'pending').length} active trades
                  </span>
                </div>

                {trades.filter(t => t.status === 'open' || t.status === 'pending').length === 0 ? (
                  <div className="bg-gunmetal-800/50 p-4 rounded-lg text-center">
                    <p className="text-gray-400">No active trades</p>
                    {strategies.some(s => s.status === 'active') && (
                      <p className="mt-2 text-sm text-gray-500">
                        Trades will appear here when your active strategies generate them
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {trades
                      .filter(t => t.status === 'open' || t.status === 'pending')
                      .map(trade => (
                        <div key={trade.id} className="bg-gunmetal-800/50 p-4 rounded-lg">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                              <h4 className="text-md font-medium text-white">{trade.symbol}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                trade.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {trade.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {trade.status === 'open' && (
                                <button
                                  onClick={() => handleCloseTrade(trade)}
                                  className="p-1.5 bg-gunmetal-700/50 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors"
                                  title="Close Trade"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteTrade(trade)}
                                className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                                title="Delete Trade"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setSelectedTrade(trade)}
                                className="p-1.5 bg-neon-turquoise/20 text-neon-turquoise rounded-lg hover:bg-neon-turquoise/30 transition-colors"
                                title="View Details"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <div>
                              <span className="text-xs text-gray-400 block mb-1">Side</span>
                              <span className={`text-sm flex items-center ${trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                                {trade.side === 'buy' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                                {trade.side.toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-400 block mb-1">Amount</span>
                              <span className="text-sm text-white">{trade.amount}</span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-400 block mb-1">Entry Price</span>
                              <span className="text-sm text-white">${trade.price?.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-400 block mb-1">Strategy</span>
                              <span className="text-sm text-white">
                                {strategies.find(s => s.id === trade.strategy_id)?.title || 'Unknown'}
                              </span>
                            </div>
                          </div>

                          {/* Trade Flow Diagram */}
                          {selectedTrade?.id === trade.id && (
                            <div className="mt-4 pt-4 border-t border-gunmetal-700">
                              <h5 className="text-sm font-medium text-white mb-3">Trade Flow</h5>
                              <TradeFlowDiagram trade={{
                                ...trade,
                                timestamp: new Date(trade.created_at || Date.now()).getTime()
                              }} />
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
