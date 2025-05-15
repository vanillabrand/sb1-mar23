import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Target,
  Gauge,
  Crown,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Loader2,
  Power,
  PowerOff,
  Edit,
  Trash2,
  DollarSign,
  Plus,
  RefreshCw,
  X
} from 'lucide-react';
import { Strategy, RiskLevel, StrategyBudget, Trade } from '../../lib/types';
import { tradeService } from '../../lib/trade-service';
import { strategyService } from '../../lib/strategy-service';
import { logService } from '../../lib/log-service';
import { demoService } from '../../lib/demo-service';
import { SimplifiedTradeCard } from './SimplifiedTradeCard';
import { SimplifiedTradeCreator } from './SimplifiedTradeCreator';
import { StrategyActivationWizard } from './StrategyActivationWizard';

interface SimplifiedStrategyDetailsProps {
  strategy: Strategy;
  onRefresh: () => void;
}

export function SimplifiedStrategyDetails({
  strategy,
  onRefresh
}: SimplifiedStrategyDetailsProps) {
  const [budget, setBudget] = useState<StrategyBudget | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showTradeCreator, setShowTradeCreator] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showActivationWizard, setShowActivationWizard] = useState(false);
  const isDemoMode = demoService.isDemoMode();

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [strategy.id]);

  // Load all data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        loadBudget(),
        loadTrades()
      ]);

      setLoading(false);
    } catch (err) {
      setError('Failed to load strategy data');
      setLoading(false);
      logService.log('error', `Failed to load data for strategy ${strategy.id}`, err, 'SimplifiedStrategyDetails');
    }
  };

  // Load budget
  const loadBudget = async () => {
    try {
      const strategyBudget = await tradeService.getBudget(strategy.id);
      setBudget(strategyBudget);
    } catch (err) {
      logService.log('error', `Failed to load budget for strategy ${strategy.id}`, err, 'SimplifiedStrategyDetails');
    }
  };

  // Load trades
  const loadTrades = async () => {
    try {
      const strategyTrades = await tradeService.getTradesByStrategy(strategy.id);
      setTrades(strategyTrades);
    } catch (err) {
      logService.log('error', `Failed to load trades for strategy ${strategy.id}`, err, 'SimplifiedStrategyDetails');
    }
  };

  // Handle strategy activation
  const handleActivate = async () => {
    try {
      setIsActivating(true);
      setError(null);

      // Show activation wizard instead of directly activating
      setShowActivationWizard(true);

      setIsActivating(false);
    } catch (err) {
      setError('Failed to prepare strategy activation');
      setIsActivating(false);
      logService.log('error', `Failed to prepare activation for strategy ${strategy.id}`, err, 'SimplifiedStrategyDetails');
    }
  };

  // Handle strategy deactivation
  const handleDeactivate = async () => {
    try {
      setIsDeactivating(true);
      setError(null);

      // Deactivate the strategy
      await strategyService.deactivateStrategy(strategy.id);

      // Refresh data
      onRefresh();

      setIsDeactivating(false);
    } catch (err) {
      setError('Failed to deactivate strategy');
      setIsDeactivating(false);
      logService.log('error', `Failed to deactivate strategy ${strategy.id}`, err, 'SimplifiedStrategyDetails');
    }
  };

  // Handle strategy deletion
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      // Delete the strategy
      await strategyService.deleteStrategy(strategy.id);

      // Refresh data
      onRefresh();

      setIsDeleting(false);
      setShowDeleteConfirm(false);
    } catch (err) {
      setError('Failed to delete strategy');
      setIsDeleting(false);
      logService.log('error', `Failed to delete strategy ${strategy.id}`, err, 'SimplifiedStrategyDetails');
    }
  };

  // Get risk icon based on risk level
  const getRiskIcon = (risk: RiskLevel) => {
    switch (risk) {
      case 'Ultra Low': return Shield;
      case 'Low': return Shield;
      case 'Medium': return Target;
      case 'High': return Gauge;
      case 'Ultra High': return Crown;
      case 'Extreme': return Crown;
      case 'God Mode': return Crown;
      default: return Target;
    }
  };

  // Get risk color based on risk level
  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case 'Ultra Low': return 'text-emerald-400';
      case 'Low': return 'text-neon-turquoise';
      case 'Medium': return 'text-neon-yellow';
      case 'High': return 'text-neon-orange';
      case 'Ultra High': return 'text-neon-pink';
      case 'Extreme': return 'text-purple-400';
      case 'God Mode': return 'text-amber-400';
      default: return 'text-gray-400';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-neon-turquoise';
      case 'inactive': return 'text-gray-400';
      case 'error': return 'text-neon-pink';
      default: return 'text-gray-400';
    }
  };

  const RiskIcon = getRiskIcon(strategy.risk_level);
  const riskColor = getRiskColor(strategy.risk_level);
  const statusColor = getStatusColor(strategy.status);

  // Calculate performance metrics
  const calculatePerformance = () => {
    const closedTrades = trades.filter(t => t.status === 'closed' || t.status === 'completed');

    if (closedTrades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalProfit: 0
      };
    }

    const winningTrades = closedTrades.filter(t => {
      if (!t.exitPrice || !t.entryPrice) return false;

      return t.side === 'buy'
        ? t.exitPrice > t.entryPrice
        : t.exitPrice < t.entryPrice;
    });

    const losingTrades = closedTrades.filter(t => {
      if (!t.exitPrice || !t.entryPrice) return false;

      return t.side === 'buy'
        ? t.exitPrice <= t.entryPrice
        : t.exitPrice >= t.entryPrice;
    });

    const totalProfit = closedTrades.reduce((sum, trade) => {
      if (!trade.exitPrice || !trade.entryPrice || !trade.amount) return sum;

      const entryValue = trade.entryPrice * trade.amount;
      const exitValue = trade.exitPrice * trade.amount;

      const profit = trade.side === 'buy'
        ? exitValue - entryValue
        : entryValue - exitValue;

      return sum + profit;
    }, 0);

    return {
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / closedTrades.length) * 100,
      totalProfit
    };
  };

  const performance = calculatePerformance();

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
      </div>
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
          <h1 className="text-2xl font-bold gradient-text">Strategy Details</h1>
          <p className="text-gray-400">View and manage your trading strategy</p>
        </div>

        <button
          onClick={loadData}
          className="p-2 bg-gunmetal-800 rounded-lg text-gray-400 hover:text-neon-turquoise transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Strategy Overview */}
      <div className="bg-gunmetal-900/30 rounded-xl p-6 border border-gunmetal-800">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg bg-gunmetal-900/50 ${riskColor}`}>
            <RiskIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-200">{strategy.name}</h2>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${riskColor}`}>{strategy.risk_level}</span>
              <span className="text-sm text-gray-400">•</span>
              <span className="text-sm text-gray-400 capitalize">{strategy.market_type || strategy.marketType || 'spot'}</span>
              <span className="text-sm text-gray-400">•</span>
              <span className={`text-sm ${statusColor}`}>
                {strategy.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {strategy.description && (
          <p className="text-gray-400 mb-6">{strategy.description}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Total Budget</p>
            <p className="text-xl font-medium text-white">
              ${budget?.total.toLocaleString() || '0'}
            </p>
          </div>

          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Available Budget</p>
            <p className="text-xl font-medium text-neon-turquoise">
              ${budget?.available.toLocaleString() || '0'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Total Trades</p>
            <p className="text-lg font-medium text-white">
              {performance.totalTrades}
            </p>
          </div>

          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Win Rate</p>
            <p className="text-lg font-medium text-neon-turquoise">
              {performance.winRate.toFixed(1)}%
            </p>
          </div>

          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Total Profit</p>
            <p className={`text-lg font-medium ${performance.totalProfit >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'}`}>
              ${performance.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Trading Pairs</p>
            <p className="text-lg font-medium text-white">
              {strategy.selected_pairs?.length || 0}
            </p>
          </div>
        </div>

        {/* Trading Pairs */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-300 mb-2">Trading Pairs</p>
          <div className="flex flex-wrap gap-2">
            {strategy.selected_pairs?.map(pair => (
              <div key={pair} className="px-2 py-1 bg-gunmetal-800 rounded-lg text-xs text-gray-300">
                {pair.replace('_', '/')}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {strategy.status === 'inactive' ? (
            <button
              onClick={handleActivate}
              disabled={isActivating}
              className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-all duration-300 disabled:opacity-50"
            >
              {isActivating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
              Activate
            </button>
          ) : (
            <button
              onClick={handleDeactivate}
              disabled={isDeactivating}
              className="flex items-center gap-2 px-4 py-2 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-all duration-300 disabled:opacity-50"
            >
              {isDeactivating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PowerOff className="w-4 h-4" />
              )}
              Deactivate
            </button>
          )}

          {strategy.status === 'active' && (
            <button
              onClick={() => setShowTradeCreator(true)}
              className="flex items-center gap-2 px-4 py-2 bg-neon-raspberry text-white rounded-lg hover:bg-opacity-90 transition-all duration-300"
            >
              <Plus className="w-4 h-4" />
              Create Trade
            </button>
          )}

          {strategy.status === 'inactive' && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gunmetal-800 text-neon-pink rounded-lg hover:bg-gunmetal-700 transition-all duration-300"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Recent Trades */}
      <div className="bg-gunmetal-900/30 rounded-xl p-6 border border-gunmetal-800">
        <h2 className="text-xl font-bold gradient-text mb-4">Recent Trades</h2>

        {trades.length === 0 ? (
          <div className="bg-gunmetal-800/50 rounded-lg p-6 text-center">
            <TrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Trades Yet</h3>
            <p className="text-gray-400 mb-4">
              This strategy hasn't made any trades yet
            </p>
            {strategy.status === 'active' && (
              <button
                onClick={() => setShowTradeCreator(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-all duration-300"
              >
                <Plus className="w-4 h-4" />
                Create Trade
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {trades.slice(0, 5).map(trade => (
              <SimplifiedTradeCard
                key={trade.id}
                trade={trade}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-gunmetal-900 border border-gunmetal-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Delete Strategy?</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete this strategy? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-neon-pink text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trade Creator */}
      {showTradeCreator && (
        <SimplifiedTradeCreator
          strategies={[strategy]}
          onComplete={() => {
            setShowTradeCreator(false);
            loadTrades();
          }}
          onCancel={() => {
            setShowTradeCreator(false);
          }}
        />
      )}

      {/* Strategy Activation Wizard */}
      {showActivationWizard && (
        <StrategyActivationWizard
          strategy={strategy}
          onComplete={(success) => {
            setShowActivationWizard(false);
            if (success) {
              onRefresh();
            }
          }}
          onCancel={() => {
            setShowActivationWizard(false);
          }}
          maxBudget={budget?.available || 10000}
        />
      )}
    </motion.div>
  );
}
