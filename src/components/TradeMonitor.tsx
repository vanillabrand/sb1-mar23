import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Search,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  BarChart3,
  ChevronDown
} from 'lucide-react';
import { 
  marketService,
  tradeService, 
  logService 
} from '../lib/services';
import { MonitoringService } from '../lib/monitoring-service';
import { 
  TradeChart,
  TradeStats, 
  TradeList,
  AssetPairMonitor,
  BudgetModal,
  PanelWrapper 
} from './index';
import type { 
  Trade, 
  MarketData, 
  Strategy, 
  StrategyBudget,
  TradeStats as TradeStatsType 
} from '../lib/types';

// Get the singleton instance
const monitoringService = MonitoringService.getInstance();

interface TradeMonitorProps {
  strategies: Strategy[];
  className?: string;
}

export const TradeMonitor: React.FC<TradeMonitorProps> = ({ 
  strategies,
  className = '' 
}) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'profit' | 'loss'>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [pendingStrategy, setPendingStrategy] = useState<Strategy | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [tradeStats, setTradeStats] = useState<TradeStatsType | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  useEffect(() => {
    const subscription = supabase
      .channel('trade_monitor_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'strategies' 
      }, () => {
        refreshTradeData();
      })
      .subscribe();

    // Subscribe to strategy events
    const unsubscribe = eventBus.subscribe('strategy:created', () => {
      refreshTradeData();
    });

    return () => {
      subscription.unsubscribe();
      unsubscribe();
    };
  }, []);

  const refreshTradeData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadActiveStrategies(),
        loadActiveTrades(),
        tradeManager.syncTrades()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const updateTradeStats = (currentTrades: Trade[]) => {
    const stats = {
      totalTrades: currentTrades.length,
      profitableTrades: currentTrades.filter(t => t.profit > 0).length,
      totalProfit: currentTrades.reduce((sum, t) => sum + (t.profit || 0), 0),
      averageProfit: currentTrades.length ? 
        currentTrades.reduce((sum, t) => sum + (t.profit || 0), 0) / currentTrades.length : 
        0
    };
    setTradeStats(stats);
  };

  const refresh = async () => {
    if (refreshing) return;
    
    try {
      setRefreshing(true);
      await Promise.all([
        marketService.refresh(),
        tradeService.refresh()
      ]);
    } catch (error) {
      logService.log('error', 'Failed to refresh data', error, 'TradeMonitor');
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleBudgetConfirm = async (budget: StrategyBudget) => {
    if (!pendingStrategy) return;

    let success = false;
    try {
      setError(null);
      const strategy = pendingStrategy;
      
      await tradeService.setBudget(strategy.id, budget);
      
      await monitoringService.updateStrategy(strategy.id, {
        status: 'active',
        updated_at: new Date().toISOString(),
      });
      
      await marketService.startStrategyMonitoring(strategy);
      success = true;
      refresh();

      logService.log('info', `Strategy ${strategy.id} activated with budget`, { budget }, 'TradeMonitor');
    } catch (error) {
      logService.log('error', 'Failed to start strategy with budget', error, 'TradeMonitor');
      setError('Failed to activate strategy. Please try again.');
      if (pendingStrategy) {
        await tradeService.setBudget(pendingStrategy.id, null);
      }
    } finally {
      if (success) {
        setShowBudgetModal(false);
        setPendingStrategy(null);
      }
    }
  };

  const filteredTrades = trades
    .filter(trade => {
      const matchesSearch = trade.pair.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' ? true :
        statusFilter === 'profit' ? trade.profit > 0 : trade.profit < 0;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="min-h-screen bg-gunmetal-900 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Trade Monitor</h1>
            <p className="text-gray-400 mt-1">Real-time trade monitoring and analysis</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Last update: {new Date(lastUpdate).toLocaleTimeString()}
            </span>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
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

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gunmetal-800 rounded-lg p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <BarChart3 className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Trades</p>
                    <p className="text-2xl font-bold text-gray-100">
                      {tradeStats?.totalTrades || 0}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gunmetal-800 rounded-lg p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Profitable Trades</p>
                    <p className="text-2xl font-bold text-gray-100">
                      {tradeStats?.profitableTrades || 0}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gunmetal-800 rounded-lg p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <DollarSign className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Profit</p>
                    <p className="text-2xl font-bold text-gray-100">
                      ${(tradeStats?.totalProfit || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gunmetal-800 rounded-lg p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/10 rounded-lg">
                    <TrendingDown className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Average Profit</p>
                    <p className="text-2xl font-bold text-gray-100">
                      ${(tradeStats?.averageProfit || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Chart and Filters */}
            <div className="bg-gunmetal-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-100">Trade Performance</h2>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search trades..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-gunmetal-900 rounded-lg border border-gunmetal-700 text-gray-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="px-4 py-2 bg-gunmetal-900 rounded-lg border border-gunmetal-700 text-gray-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All Trades</option>
                    <option value="profit">Profitable</option>
                    <option value="loss">Loss</option>
                  </select>
                </div>
              </div>
              <div className="h-[400px]">
                <TradeChart trades={filteredTrades} />
              </div>
            </div>

            {/* Trade List */}
            <div className="bg-gunmetal-800 rounded-lg p-6">
              <TradeList 
                trades={filteredTrades}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            </div>
          </>
        )}
      </motion.div>

      {/* Modals */}
      {showBudgetModal && pendingStrategy && (
        <BudgetModal
          strategy={pendingStrategy}
          onConfirm={handleBudgetConfirm}
          onClose={() => {
            setShowBudgetModal(false);
            setPendingStrategy(null);
          }}
        />
      )}
    </div>
  );
};
