import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain,
  Plus,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Edit2,
  Trash2,
  Power,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  BarChart3,
  Tag
} from 'lucide-react';
import { useStrategies } from '../hooks/useStrategies';
import { logService } from '../lib/log-service';
import { aiService } from '../lib/ai-service';
import { StrategyLibrary } from './StrategyLibrary';
import { BudgetModal } from './BudgetModal';
import { tradeService } from '../lib/trade-service';
import { BacktestOffer } from './BacktestOffer';
import { StrategyEditor } from './StrategyEditor';
import { marketService } from '../lib/market-service';
import { PanelWrapper } from './PanelWrapper';
import { tradeManager } from '../lib/trade-manager';
import { CreateStrategyModal } from './CreateStrategyModal';
import { DeleteConfirmation } from './DeleteConfirmation';
import { Combobox } from './ui/Combobox';
import { supabase } from '../lib/supabase';
import type { Strategy } from '../lib/supabase-types';
import type { StrategyBudget } from '../lib/types';

const TOP_PAIRS = [
  'BTC_USDT',  // Bitcoin
  'ETH_USDT',  // Ethereum
  'SOL_USDT',  // Solana
  'BNB_USDT',  // Binance Coin
  'XRP_USDT',  // Ripple
  'ADA_USDT',  // Cardano
  'DOGE_USDT', // Dogecoin
  'MATIC_USDT', // Polygon
  'DOT_USDT',  // Polkadot
  'LINK_USDT'  // Chainlink
];

export default function StrategyManager() {
  const {
    strategies,
    loading,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    refresh,
  } = useStrategies();
  const [isCreating, setIsCreating] = useState(false);
  const [showBacktestOffer, setShowBacktestOffer] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const [isDeletingStrategy, setIsDeletingStrategy] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'performance'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [pendingStrategy, setPendingStrategy] = useState<Strategy | null>(null);
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);
  const [deactivatingStrategy, setDeactivatingStrategy] = useState<string | null>(null);
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const itemsPerPage = 3;

  const handleBudgetConfirm = async (budget: StrategyBudget) => {
    if (!pendingStrategy) return;

    let success = false;
    try {
      setError(null);
      setIsSubmittingBudget(true);
      const strategy = pendingStrategy;
      
      await tradeService.setBudget(strategy.id, budget);
      await updateStrategy(strategy.id, {
        status: 'active',
        updated_at: new Date().toISOString(),
      });
      await marketService.startStrategyMonitoring(strategy);
      success = true;
      refresh();
      
      logService.log('info', `Strategy ${strategy.id} activated with budget`, { budget }, 'StrategyManager');
    } catch (error) {
      logService.log('error', 'Failed to start strategy with budget', error, 'StrategyManager');
      setError('Failed to activate strategy. Please try again.');
      
      if (pendingStrategy) {
        await tradeService.setBudget(pendingStrategy.id, null);
      }
    } finally {
      if (success) {
        setShowBudgetModal(false);
        setPendingStrategy(null);
        setError(null);
      }
      setIsSubmittingBudget(false);
    }
  };

  const handleStrategyActivate = async (strategy: Strategy) => {
    try {
      const budget = tradeService.getBudget(strategy.id);
      if (!budget) {
        setPendingStrategy(strategy);
        setShowBudgetModal(true);
        return;
      }

      await updateStrategy(strategy.id, {
        status: 'active',
        updated_at: new Date().toISOString(),
      });
      await marketService.startStrategyMonitoring(strategy);
      refresh();

    } catch (error) {
      logService.log('error', `Failed to activate strategy ${strategy.id}`, error, 'StrategyManager');
      setError('Failed to activate strategy. Please try again.');
    }
  };

  const handleStrategyDeactivate = async (strategyId: string) => {
    try {
      setDeactivatingStrategy(strategyId);
      const strategy = strategies.find(s => s.id === strategyId);
      if (!strategy) throw new Error('Strategy not found');

      const trades = tradeManager.getActiveTradesForStrategy(strategyId);
      for (const trade of trades) {
        await tradeManager.closeTrade(trade.id);
      }

      await marketService.stopStrategyMonitoring(strategyId);
      await tradeService.setBudget(strategyId, null);
      await updateStrategy(strategyId, {
        status: 'inactive',
        updated_at: new Date().toISOString(),
      });

      refresh();
      logService.log('info', `Strategy ${strategyId} deactivated successfully`, null, 'StrategyManager');
    } catch (error) {
      logService.log('error', `Failed to deactivate strategy ${strategyId}`, error, 'StrategyManager');
      setError('Failed to deactivate strategy. Please try again.');
    } finally {
      setDeactivatingStrategy(null);
    }
  };

  const handleDeleteStrategy = async (strategyId: string) => {
    try {
      setIsDeletingStrategy(true);
      setError(null);
      setShowDeleteConfirm(null); // Close modal immediately

      // Get strategy to check status
      const strategy = strategies.find(s => s.id === strategyId);
      if (!strategy) {
        throw new Error('Strategy not found');
      }

      // Check if strategy is active
      if (strategy.status === 'active') {
        throw new Error('Cannot delete an active strategy. Please deactivate it first.');
      }

      // Delete strategy and all related data
      await deleteStrategy(strategyId);

      // Refresh list after successful deletion
      await refresh();

      logService.log('info', `Strategy ${strategyId} deleted successfully`, null, 'StrategyManager');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete strategy';
      setError(message);
      setShowDeleteConfirm(strategyId); // Re-show modal if deletion failed
      logService.log('error', `Failed to delete strategy ${strategyId}:`, error, 'StrategyManager');
    } finally {
      setIsDeletingStrategy(false);
    }
  };

  // Filter and sort strategies
  const filteredStrategies = useMemo(() => {
    return strategies.filter(strategy => {
      const matchesSearch = strategy.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          strategy.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || strategy.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'performance':
          comparison = (b.performance || 0) - (a.performance || 0);
          break;
        case 'date':
          comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [strategies, searchTerm, statusFilter, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredStrategies.length / itemsPerPage);
  const displayedStrategies = filteredStrategies.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  return (
    <div className="p-8 space-y-6">
      {/* Section Description */}
      <PanelWrapper index={0}>
        <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800/50">
          <div className="space-y-4">
            <h2 className="text-xl font-bold gradient-text">Strategy Manager</h2>
            <p className="text-sm text-gray-400">
              Create and manage your trading strategies. Monitor performance and adjust parameters.
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gunmetal-800 hover:bg-gunmetal-700 text-gray-200 rounded-lg transition-all duration-300"
            >
              <Plus className="w-4 h-4" />
              Create Strategy
            </button>
          </div>
        </div>
      </PanelWrapper>

      {/* Controls */}
      <PanelWrapper index={1}>
        <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800/50">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search strategies..."
                  className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-gunmetal-800 rounded-lg p-1">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 rounded text-sm ${
                    statusFilter === 'all'
                      ? 'bg-neon-raspberry text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1 rounded text-sm ${
                    statusFilter === 'active'
                      ? 'bg-neon-turquoise text-gunmetal-900'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1 rounded text-sm ${
                    statusFilter === 'inactive'
                      ? 'bg-gray-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Inactive
                </button>
              </div>

              <button
                onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
                className="p-2 bg-gunmetal-800 rounded-lg text-gray-400 hover:text-neon-turquoise transition-colors"
              >
                {sortOrder === 'asc' ? (
                  <SortAsc className="w-5 h-5" />
                ) : (
                  <SortDesc className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </PanelWrapper>

      {/* Strategy List */}
      <PanelWrapper index={2}>
        <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800/50">
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
              </div>
            ) : strategies.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-neon-yellow mx-auto mb-4" />
                <p className="text-xl text-gray-200 mb-2">No Strategies Found</p>
                <p className="text-gray-400">Create a strategy to start trading</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {displayedStrategies.map((strategy) => (
                  <motion.div
                    key={strategy.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-gunmetal-800/30 rounded-xl overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-200">{strategy.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-sm px-2 py-0.5 rounded-full ${
                              strategy.status === 'active'
                                ? 'bg-neon-turquoise/20 text-neon-turquoise'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {strategy.status.toUpperCase()}
                            </span>
                            <span className={`text-sm px-2 py-0.5 rounded-full ${
                              strategy.risk_level === 'High' ? 'bg-neon-pink/20 text-neon-pink' :
                              strategy.risk_level === 'Medium' ? 'bg-neon-yellow/20 text-neon-yellow' :
                              'bg-neon-turquoise/20 text-neon-turquoise'
                            }`}>
                              {strategy.risk_level}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingStrategy(strategy);
                              setShowEditModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-neon-yellow transition-colors"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(strategy.id)}
                            disabled={isDeletingStrategy || strategy.status === 'active'}
                            className={`p-2 text-gray-400 transition-colors ${
                              strategy.status === 'active' 
                                ? 'opacity-50 cursor-not-allowed' 
                                : 'hover:text-neon-pink'
                            }`}
                          >
                            {isDeletingStrategy && showDeleteConfirm === strategy.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Trash2 className="w-5 h-5" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              if (strategy.status === 'active') {
                                handleStrategyDeactivate(strategy.id);
                              } else {
                                handleStrategyActivate(strategy);
                              }
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                              strategy.status === 'active'
                                ? 'bg-neon-raspberry text-white hover:bg-opacity-90'
                                : 'bg-gunmetal-800 text-gray-200 hover:text-white'
                            }`}
                          >
                            {strategy.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </div>

                      {strategy.description && (
                        <p className="text-sm text-gray-400 mb-4">{strategy.description}</p>
                      )}

                      {/* Asset Pairs */}
                      {strategy.strategy_config?.assets && (
                        <div className="mb-4">
                          <h5 className="text-sm font-medium text-gray-300 mb-2">Trading Pairs</h5>
                          <div className="flex flex-wrap gap-2">
                            {strategy.strategy_config.assets.map((asset: string) => (
                              <div
                                key={asset}
                                className="px-2 py-1 bg-gunmetal-900/30 rounded-lg text-sm text-neon-turquoise"
                              >
                                {asset.replace('_', '/')}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                          <p className="text-xs text-gray-400">Performance</p>
                          <p className={`text-lg font-medium ${
                            (strategy.performance || 0) >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'
                          }`}>
                            {(strategy.performance || 0).toFixed(2)}%
                          </p>
                        </div>
                        <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                          <p className="text-xs text-gray-400">Win Rate</p>
                          <p className="text-lg font-medium text-neon-yellow">
                            {strategy.win_rate?.toFixed(1) || '0.0'}%
                          </p>
                        </div>
                        <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                          <p className="text-xs text-gray-400">Total Trades</p>
                          <p className="text-lg font-medium text-gray-200">
                            {strategy.total_trades || 0}
                          </p>
                        </div>
                        <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                          <p className="text-xs text-gray-400">Created</p>
                          <p className="text-lg font-medium text-gray-200">
                            {new Date(strategy.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </PanelWrapper>

      {/* Strategy Library */}
      <PanelWrapper index={3}>
        <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800/50">
          <StrategyLibrary 
            onStrategyCreated={refresh}
          />
        </div>
      </PanelWrapper>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmation
          onConfirm={() => handleDeleteStrategy(showDeleteConfirm)}
          onCancel={() => setShowDeleteConfirm(null)}
          name={strategies.find(s => s.id === showDeleteConfirm)?.title || ''}
          isDeleting={isDeletingStrategy}
        />
      )}

      {/* Create Strategy Modal */}
      {isCreating && (
        <CreateStrategyModal
          onClose={() => setIsCreating(false)}
          onCreated={() => {
            setIsCreating(false);
            refresh();
          }}
        />
      )}

      {/* Edit Strategy Modal */}
      {showEditModal && editingStrategy && (
        <StrategyEditor
          strategy={editingStrategy}
          onSave={async (updates) => {
            try {
              await updateStrategy(editingStrategy.id, updates);
              setShowEditModal(false);
              setEditingStrategy(null);
              refresh();
            } catch (error) {
              setError('Failed to update strategy');
            }
          }}
          isEditing={true}
          onClose={() => {
            setShowEditModal(false);
            setEditingStrategy(null);
          }}
        />
      )}

      {/* Budget Modal */}
      {showBudgetModal && pendingStrategy && (
        <BudgetModal
          onConfirm={handleBudgetConfirm}
          onCancel={() => {
            setShowBudgetModal(false);
            setPendingStrategy(null);
          }}
          maxBudget={tradeService.calculateAvailableBudget()}
          riskLevel={pendingStrategy.risk_level}
          isSubmitting={isSubmittingBudget}
        />
      )}
    </div>
  );
}