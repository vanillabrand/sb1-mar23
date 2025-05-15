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
  Plus
} from 'lucide-react';
import { Strategy, RiskLevel, StrategyBudget } from '../../lib/types';
import { tradeService } from '../../lib/trade-service';
import { strategyService } from '../../lib/strategy-service';
import { logService } from '../../lib/log-service';
import { demoService } from '../../lib/demo-service';
// Import the activation wizard component
import { StrategyActivationWizard } from './StrategyActivationWizard';

interface SimplifiedStrategyCardProps {
  strategy: Strategy;
  compact?: boolean;
  onViewDetails?: () => void;
  onRefresh?: () => void;
}

export function SimplifiedStrategyCard({
  strategy,
  compact = false,
  onViewDetails,
  onRefresh
}: SimplifiedStrategyCardProps) {
  const [budget, setBudget] = useState<StrategyBudget | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActivationWizard, setShowActivationWizard] = useState(false);
  const isDemoMode = demoService.isDemoMode();

  // Load budget on mount
  useEffect(() => {
    loadBudget();
  }, [strategy.id]);

  // Load budget data
  const loadBudget = async () => {
    try {
      const strategyBudget = await tradeService.getBudget(strategy.id);
      setBudget(strategyBudget);
    } catch (err) {
      logService.log('error', `Failed to load budget for strategy ${strategy.id}`, err, 'SimplifiedStrategyCard');
    }
  };

  // Handle strategy activation
  const handleActivate = async () => {
    try {
      setIsActivating(true);
      setError(null);

      // Show activation wizard
      setShowActivationWizard(true);
      setIsActivating(false);
    } catch (err) {
      setError('Failed to prepare strategy activation');
      setIsActivating(false);
      logService.log('error', `Failed to prepare activation for strategy ${strategy.id}`, err, 'SimplifiedStrategyCard');
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
      if (onRefresh) {
        onRefresh();
      }

      setIsDeactivating(false);
    } catch (err) {
      setError('Failed to deactivate strategy');
      setIsDeactivating(false);
      logService.log('error', `Failed to deactivate strategy ${strategy.id}`, err, 'SimplifiedStrategyCard');
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

  // Render compact version
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gunmetal-800/30 rounded-xl p-4 border border-gunmetal-700 hover:border-gunmetal-600 transition-all duration-300 cursor-pointer"
        onClick={onViewDetails}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-gunmetal-900/50 ${riskColor}`}>
              <RiskIcon className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-gray-200">{strategy.name}</h3>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor} bg-gunmetal-900`}>
            {strategy.status === 'active' ? 'Active' : 'Inactive'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gunmetal-900/30 p-2 rounded-lg">
            <p className="text-xs text-gray-400">Budget</p>
            <p className="text-sm font-medium text-white">
              ${budget?.total.toLocaleString() || '0'}
            </p>
          </div>
          <div className="bg-gunmetal-900/30 p-2 rounded-lg">
            <p className="text-xs text-gray-400">Available</p>
            <p className="text-sm font-medium text-neon-turquoise">
              ${budget?.available.toLocaleString() || '0'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400">
          <div>Pairs: {strategy.selected_pairs?.length || 0}</div>
          <div className={riskColor}>{strategy.risk_level}</div>
        </div>
      </motion.div>
    );
  }

  // Render full version
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gunmetal-800/30 rounded-xl p-6 border border-gunmetal-700"
    >
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <p>{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg bg-gunmetal-900/50 ${riskColor}`}>
          <RiskIcon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-200">{strategy.name}</h3>
          <span className={`text-sm ${riskColor}`}>{strategy.risk_level}</span>
        </div>
        <div className={`ml-auto px-2 py-1 rounded-full text-xs font-medium ${statusColor} bg-gunmetal-900`}>
          {strategy.status === 'active' ? 'Active' : 'Inactive'}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-4">{strategy.description}</p>

      {/* Budget and Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gunmetal-900/30 p-3 rounded-lg">
          <p className="text-xs text-gray-400">Total Budget</p>
          <p className="text-lg font-medium text-white">
            ${budget?.total.toLocaleString() || '0'}
          </p>
        </div>
        <div className="bg-gunmetal-900/30 p-3 rounded-lg">
          <p className="text-xs text-gray-400">Available</p>
          <p className="text-lg font-medium text-neon-turquoise">
            ${budget?.available.toLocaleString() || '0'}
          </p>
        </div>
      </div>

      {/* Trading Pairs */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">Trading Pairs</p>
        <div className="flex flex-wrap gap-2">
          {strategy.selected_pairs?.map(pair => (
            <div key={pair} className="px-2 py-1 bg-gunmetal-900 rounded-lg text-xs text-gray-300">
              {pair.replace('_', '/')}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
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
            className="flex items-center gap-2 px-4 py-2 bg-gunmetal-900 text-gray-300 rounded-lg hover:bg-gunmetal-800 transition-all duration-300 disabled:opacity-50"
          >
            {isDeactivating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PowerOff className="w-4 h-4" />
            )}
            Deactivate
          </button>
        )}

        <button
          onClick={onViewDetails}
          className="flex items-center gap-2 px-4 py-2 bg-gunmetal-900 text-gray-300 rounded-lg hover:bg-gunmetal-800 transition-all duration-300"
        >
          View Details
        </button>
      </div>

      {/* Strategy Activation Wizard */}
      {showActivationWizard && (
        <StrategyActivationWizard
          strategy={strategy}
          onComplete={(success) => {
            setShowActivationWizard(false);
            if (success && onRefresh) {
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
