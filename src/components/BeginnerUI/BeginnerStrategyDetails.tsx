import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Trash2, 
  Edit, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Wallet,
  Layers,
  Shield,
  HelpCircle,
  Info
} from 'lucide-react';
import { Strategy, Trade } from '../../lib/types';
import { strategyService } from '../../lib/strategy-service';
import { tradeService } from '../../lib/trade-service';
import { logService } from '../../lib/log-service';
import { formatCurrency, formatDate } from '../../lib/format-utils';
import { BeginnerStrategyEditModal } from './BeginnerStrategyEditModal';
import { BeginnerStrategyDeleteModal } from './BeginnerStrategyDeleteModal';
import { BeginnerBudgetModal } from './BeginnerBudgetModal';
import { BeginnerTradeCard } from './BeginnerTradeCard';

interface BeginnerStrategyDetailsProps {
  strategy: Strategy;
  onRefresh: () => Promise<void>;
}

export function BeginnerStrategyDetails({ strategy, onRefresh }: BeginnerStrategyDetailsProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const [budget, setBudget] = useState<any>(null);
  const [isLoadingBudget, setIsLoadingBudget] = useState(false);
  
  // Load trades and budget for this strategy
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoadingTrades(true);
        setIsLoadingBudget(true);
        
        // Load trades
        const strategyTrades = await tradeService.getTradesByStrategy(strategy.id);
        setTrades(strategyTrades);
        
        // Load budget
        const strategyBudget = await strategyService.getBudget(strategy.id);
        setBudget(strategyBudget);
      } catch (error) {
        logService.log('error', 'Failed to load strategy data', error, 'BeginnerStrategyDetails');
        setError('Failed to load strategy data. Please try again.');
      } finally {
        setIsLoadingTrades(false);
        setIsLoadingBudget(false);
      }
    };
    
    loadData();
  }, [strategy.id]);
  
  // Handle activate strategy
  const handleActivateStrategy = async () => {
    try {
      setIsActivating(true);
      setError(null);
      setSuccess(null);
      
      // Check if budget is set
      if (!budget || !budget.allocated || budget.allocated <= 0) {
        setShowBudgetModal(true);
        setIsActivating(false);
        return;
      }
      
      // Activate the strategy
      await strategyService.activateStrategy(strategy.id);
      
      // Show success message
      setSuccess('Strategy activated successfully');
      
      // Refresh the strategy data
      await onRefresh();
    } catch (error) {
      logService.log('error', 'Failed to activate strategy', error, 'BeginnerStrategyDetails');
      setError('Failed to activate strategy. Please try again.');
    } finally {
      setIsActivating(false);
    }
  };
  
  // Handle deactivate strategy
  const handleDeactivateStrategy = async () => {
    try {
      setIsDeactivating(true);
      setError(null);
      setSuccess(null);
      
      // Deactivate the strategy
      await strategyService.deactivateStrategy(strategy.id);
      
      // Show success message
      setSuccess('Strategy deactivated successfully');
      
      // Refresh the strategy data
      await onRefresh();
    } catch (error) {
      logService.log('error', 'Failed to deactivate strategy', error, 'BeginnerStrategyDetails');
      setError('Failed to deactivate strategy. Please try again.');
    } finally {
      setIsDeactivating(false);
    }
  };
  
  // Handle delete strategy
  const handleDeleteStrategy = async () => {
    setShowDeleteModal(true);
  };
  
  // Handle edit strategy
  const handleEditStrategy = () => {
    setShowEditModal(true);
  };
  
  // Handle refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      
      // Refresh the strategy data
      await onRefresh();
      
      // Reload trades
      const strategyTrades = await tradeService.getTradesByStrategy(strategy.id);
      setTrades(strategyTrades);
      
      // Reload budget
      const strategyBudget = await strategyService.getBudget(strategy.id);
      setBudget(strategyBudget);
    } catch (error) {
      logService.log('error', 'Failed to refresh strategy data', error, 'BeginnerStrategyDetails');
      setError('Failed to refresh strategy data. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Format the strategy data for display
  const isActive = strategy.status === 'active';
  const riskLevel = strategy.riskLevel || strategy.risk_level || 'Medium';
  const marketType = strategy.marketType || strategy.market_type || 'spot';
  const performance = typeof strategy.performance === 'number' 
    ? strategy.performance 
    : typeof strategy.performance === 'string' 
      ? parseFloat(strategy.performance) 
      : 0;
  
  // Get the performance color based on the value
  const getPerformanceColor = () => {
    if (performance > 0) return 'text-neon-green';
    if (performance < 0) return 'text-neon-raspberry';
    return 'text-gray-400';
  };
  
  // Get the risk level color
  const getRiskLevelColor = () => {
    switch (riskLevel.toLowerCase()) {
      case 'low':
        return 'text-neon-green';
      case 'medium':
        return 'text-neon-yellow';
      case 'high':
        return 'text-neon-raspberry';
      default:
        return 'text-gray-400';
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Strategy Header */}
      <div className="panel-metallic rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {isActive ? (
                <div className="flex items-center gap-1.5 text-neon-green">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Active</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm font-medium">Inactive</span>
                </div>
              )}
              
              <div className="h-4 border-l border-gunmetal-700 mx-1"></div>
              
              <div className={`text-sm font-medium ${getRiskLevelColor()}`}>
                {riskLevel} Risk
              </div>
              
              <div className="h-4 border-l border-gunmetal-700 mx-1"></div>
              
              <div className="text-sm font-medium text-gray-400">
                {marketType.charAt(0).toUpperCase() + marketType.slice(1)}
              </div>
            </div>
            
            <h1 className="text-2xl font-bold mb-1">{strategy.title || strategy.name}</h1>
            
            <p className="text-gray-400 text-sm">
              {strategy.description || 'No description provided'}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg bg-gunmetal-800 hover:bg-gunmetal-700 transition-colors"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={handleEditStrategy}
              className="p-2 rounded-lg bg-gunmetal-800 hover:bg-gunmetal-700 transition-colors"
              disabled={isActive}
            >
              <Edit className="w-5 h-5 text-gray-400" />
            </button>
            
            {isActive ? (
              <button
                onClick={handleDeactivateStrategy}
                className="px-4 py-2 bg-gunmetal-800 text-white rounded-lg hover:bg-gunmetal-700 transition-colors flex items-center gap-2"
                disabled={isDeactivating}
              >
                {isDeactivating ? (
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                ) : (
                  <Pause className="w-4 h-4" />
                )}
                <span>Deactivate</span>
              </button>
            ) : (
              <button
                onClick={handleActivateStrategy}
                className="px-4 py-2 bg-neon-green text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2"
                disabled={isActivating}
              >
                {isActivating ? (
                  <span className="animate-spin h-4 w-4 border-2 border-gunmetal-950 border-t-transparent rounded-full"></span>
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>Activate</span>
              </button>
            )}
            
            {!isActive && (
              <button
                onClick={handleDeleteStrategy}
                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <span className="animate-spin h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full"></span>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Status Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
        
        {success && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-lg flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <p>{success}</p>
          </div>
        )}
        
        {/* Strategy Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-5 h-5 text-neon-yellow" />
              <h3 className="font-medium">Budget</h3>
            </div>
            
            {isLoadingBudget ? (
              <div className="animate-pulse h-6 bg-gunmetal-700 rounded w-24 mt-2"></div>
            ) : budget ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Allocated:</span>
                  <span className="font-medium">{formatCurrency(budget.allocated || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Available:</span>
                  <span className="font-medium">{formatCurrency(budget.available || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">In Use:</span>
                  <span className="font-medium">{formatCurrency((budget.allocated || 0) - (budget.available || 0))}</span>
                </div>
                
                <button
                  onClick={() => setShowBudgetModal(true)}
                  className="w-full mt-2 px-3 py-1.5 bg-neon-yellow/20 text-neon-yellow rounded-lg text-sm hover:bg-neon-yellow/30 transition-colors"
                >
                  Adjust Budget
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-2">
                <p className="text-sm text-gray-400 mb-2">No budget set</p>
                <button
                  onClick={() => setShowBudgetModal(true)}
                  className="px-3 py-1.5 bg-neon-yellow/20 text-neon-yellow rounded-lg text-sm hover:bg-neon-yellow/30 transition-colors"
                >
                  Set Budget
                </button>
              </div>
            )}
          </div>
          
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-5 h-5 text-neon-turquoise" />
              <h3 className="font-medium">Trading Pairs</h3>
            </div>
            
            {strategy.selected_pairs && strategy.selected_pairs.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {strategy.selected_pairs.map(pair => (
                  <div key={pair} className="bg-gunmetal-700 rounded-lg px-2 py-1 text-sm">
                    {pair.replace('_', '/')}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-2">No trading pairs selected</p>
            )}
          </div>
          
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-neon-green" />
              <h3 className="font-medium">Performance</h3>
            </div>
            
            <div className="flex items-center gap-3 mt-2">
              <div className={`text-2xl font-bold ${getPerformanceColor()}`}>
                {performance > 0 ? '+' : ''}{performance.toFixed(2)}%
              </div>
              
              {performance > 0 ? (
                <TrendingUp className={`w-5 h-5 ${getPerformanceColor()}`} />
              ) : performance < 0 ? (
                <TrendingDown className={`w-5 h-5 ${getPerformanceColor()}`} />
              ) : (
                <div className="w-5 h-5"></div>
              )}
            </div>
            
            <div className="text-xs text-gray-400 mt-1">
              Created: {formatDate(strategy.created_at)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Strategy Trades */}
      <div className="panel-metallic rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Trades</h2>
          
          {isActive && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Info className="w-4 h-4" />
              <span>Trades are automatically generated based on your strategy settings</span>
            </div>
          )}
        </div>
        
        {isLoadingTrades ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-turquoise"></div>
          </div>
        ) : trades.length === 0 ? (
          <div className="bg-gunmetal-900/50 rounded-lg p-6 text-center">
            <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No Trades Yet</h3>
            <p className="text-gray-400 mb-4">
              {isActive 
                ? "Trades will appear here once they're generated" 
                : "Activate your strategy to start generating trades"}
            </p>
            
            {!isActive && (
              <button
                onClick={handleActivateStrategy}
                className="px-4 py-2 bg-neon-green text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors inline-flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Activate Strategy
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {trades.map(trade => (
              <BeginnerTradeCard key={trade.id} trade={trade} />
            ))}
          </div>
        )}
      </div>
      
      {/* Beginner Guide */}
      <div className="bg-gunmetal-900/50 border border-gunmetal-800 rounded-xl p-4">
        <div className="flex items-start gap-4">
          <div className="bg-gunmetal-800 rounded-full p-2 mt-1">
            <HelpCircle className="w-5 h-5 text-neon-yellow" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium mb-1">Strategy Management Tips</h3>
            <p className="text-gray-400 text-sm mb-3">
              Monitor your strategy's performance regularly and make adjustments as needed. 
              Consider deactivating your strategy during highly volatile market conditions.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => window.open('https://www.investopedia.com/terms/t/trading-strategy.asp', '_blank')}
                className="px-3 py-1.5 bg-neon-yellow/20 text-neon-yellow rounded-lg text-sm hover:bg-neon-yellow/30 transition-colors"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modals */}
      {showEditModal && (
        <BeginnerStrategyEditModal
          strategy={strategy}
          onClose={() => setShowEditModal(false)}
          onSave={handleRefresh}
        />
      )}
      
      {showDeleteModal && (
        <BeginnerStrategyDeleteModal
          strategy={strategy}
          onClose={() => setShowDeleteModal(false)}
          onDelete={onRefresh}
        />
      )}
      
      {showBudgetModal && (
        <BeginnerBudgetModal
          strategy={strategy}
          currentBudget={budget?.allocated || 0}
          onClose={() => setShowBudgetModal(false)}
          onSave={handleRefresh}
        />
      )}
    </div>
  );
}
