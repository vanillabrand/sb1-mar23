import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronUp, 
  Activity, 
  DollarSign, 
  BarChart3, 
  Clock, 
  Edit, 
  Trash2, 
  PlusCircle,
  Power,
  Wallet,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { RiskLevelBadge } from './risk/RiskLevelBadge';
import { AssetPriceIndicator } from './AssetPriceIndicator';
import { demoService } from '../lib/demo-service';
import { logService } from '../lib/log-service';
import { tradeService } from '../lib/trade-service';
import type { Strategy, Trade, StrategyBudget } from '../lib/types';

interface StrategyActionCardProps {
  strategy: Strategy;
  trades: Trade[];
  budget?: StrategyBudget;
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
  onActivate?: (strategy: Strategy) => Promise<void>;
  onDeactivate?: (strategy: Strategy) => Promise<void>;
  onCreateTrade?: (strategy: Strategy) => void;
  onEdit?: (strategy: Strategy) => void;
  onDelete?: (strategy: Strategy) => void;
  onAdjustBudget?: (strategy: Strategy) => void;
}

export function StrategyActionCard({
  strategy,
  trades = [],
  budget,
  isExpanded = false,
  onToggleExpand,
  onActivate,
  onDeactivate,
  onCreateTrade,
  onEdit,
  onDelete,
  onAdjustBudget
}: StrategyActionCardProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isDemoMode = demoService.isDemoMode();
  const isActive = strategy.status === 'active';
  
  // Calculate strategy metrics
  const activeTrades = trades.filter(t => t.status === 'open' || t.status === 'pending');
  const closedTrades = trades.filter(t => t.status === 'closed');
  const winningTrades = closedTrades.filter(t => (t.profit || 0) > 0);
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
  
  // Calculate total profit/loss
  const totalPnL = trades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
  const isProfitable = totalPnL > 0;
  
  // Handle activation toggle
  const handleToggleActivation = async () => {
    try {
      if (isActive) {
        setIsDeactivating(true);
        setError(null);
        if (onDeactivate) {
          await onDeactivate(strategy);
        }
      } else {
        setIsActivating(true);
        setError(null);
        if (onActivate) {
          await onActivate(strategy);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setError(errorMessage);
      logService.log('error', `Failed to ${isActive ? 'deactivate' : 'activate'} strategy`, error, 'StrategyActionCard');
    } finally {
      setIsActivating(false);
      setIsDeactivating(false);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`panel-metallic rounded-xl overflow-hidden panel-shadow ${isActive ? 'border-l-4 border-neon-turquoise' : ''}`}
    >
      {/* Card Header */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => onToggleExpand?.(strategy.id)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <RiskLevelBadge riskLevel={strategy.risk_level || 'Medium'} size="sm" />
              {isDemoMode && (
                <span className="px-2 py-0.5 bg-neon-turquoise/20 text-neon-turquoise text-xs rounded-full">
                  Demo
                </span>
              )}
            </div>
            
            <h3 className="text-lg font-semibold text-white mb-1">{strategy.title}</h3>
            
            <p className="text-sm text-gray-400 line-clamp-2 mb-3">
              {strategy.description || 'No description provided'}
            </p>
            
            {/* Asset Pairs */}
            <div className="flex flex-wrap gap-2 mb-3">
              {(strategy.selected_pairs || []).map(pair => (
                <div key={pair} className="flex items-center bg-gunmetal-800 rounded-full px-2 py-1">
                  <AssetPriceIndicator 
                    symbol={pair} 
                    className="text-xs" 
                    showPrice={false}
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex flex-col items-end gap-2">
            {/* Status Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleActivation();
              }}
              disabled={isActivating || isDeactivating}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive 
                  ? 'bg-neon-turquoise text-gunmetal-950 hover:bg-neon-yellow' 
                  : 'bg-gunmetal-800 text-gray-300 hover:bg-neon-turquoise hover:text-gunmetal-950'
              }`}
            >
              <Power className="w-4 h-4" />
              {isActive ? 'Active' : 'Inactive'}
            </button>
            
            {/* Budget */}
            <div className="flex items-center gap-2 text-sm">
              <Wallet className="w-4 h-4 text-neon-yellow" />
              <span className="text-white">
                ${budget?.total.toFixed(2) || '0.00'}
              </span>
              {isActive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdjustBudget?.(strategy);
                  }}
                  className="text-neon-turquoise hover:text-neon-yellow"
                >
                  <Edit className="w-3 h-3" />
                </button>
              )}
            </div>
            
            {/* P/L */}
            {isActive && (
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className={`w-4 h-4 ${isProfitable ? 'text-green-400' : 'text-red-400'}`} />
                <span className={isProfitable ? 'text-green-400' : 'text-red-400'}>
                  {isProfitable ? '+' : ''}{totalPnL.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom Stats Bar */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gunmetal-800">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Activity className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300">{activeTrades.length} active</span>
            </div>
            
            <div className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300">{winRate.toFixed(0)}% win rate</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300">
                {new Date(strategy.updated_at || strategy.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 bg-gunmetal-900/50 border-t border-gunmetal-800">
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {isActive && (
              <button
                onClick={() => onCreateTrade?.(strategy)}
                className="flex items-center gap-2 px-3 py-1.5 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-colors text-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Create Trade
              </button>
            )}
            
            <button
              onClick={() => onEdit?.(strategy)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors text-sm"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
            
            {!isActive && (
              <button
                onClick={() => onDelete?.(strategy)}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
          
          {/* Budget Details */}
          {budget && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-gunmetal-800/50 p-4 rounded-lg">
                <h4 className="text-sm text-gray-400 mb-1">Total Budget</h4>
                <p className="text-xl font-semibold text-white">${budget.total.toFixed(2)}</p>
                <div className="mt-2 text-xs text-gray-400">
                  Last updated: {budget.lastUpdated ? new Date(budget.lastUpdated).toLocaleTimeString() : 'Never'}
                </div>
              </div>
              
              <div className="bg-gunmetal-800/50 p-4 rounded-lg">
                <h4 className="text-sm text-gray-400 mb-1">Available</h4>
                <p className="text-xl font-semibold text-white">${(budget.total - budget.allocated).toFixed(2)}</p>
                <div className="mt-2 text-xs text-gray-400">
                  {((budget.total - budget.allocated) / budget.total * 100).toFixed(0)}% of total budget
                </div>
              </div>
              
              <div className="bg-gunmetal-800/50 p-4 rounded-lg">
                <h4 className="text-sm text-gray-400 mb-1">Profit/Loss</h4>
                <p className={`text-xl font-semibold ${budget.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {budget.profit >= 0 ? '+' : ''}{budget.profit.toFixed(2)} USDT
                </p>
                <div className="mt-2 text-xs text-gray-400">
                  {budget.profitPercentage.toFixed(2)}% return
                </div>
              </div>
            </div>
          )}
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
