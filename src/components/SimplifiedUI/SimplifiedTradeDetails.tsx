import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  AlertCircle,
  Loader2,
  RefreshCw,
  X
} from 'lucide-react';
import { Trade, Strategy } from '../../lib/types';
import { tradeService } from '../../lib/trade-service';
import { strategySync } from '../../lib/strategy-sync';
import { logService } from '../../lib/log-service';
import { formatDistanceToNow, format } from 'date-fns';

interface SimplifiedTradeDetailsProps {
  trade: Trade;
  onRefresh: () => void;
}

export function SimplifiedTradeDetails({ trade, onRefresh }: SimplifiedTradeDetailsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  
  // Load strategy on mount
  useEffect(() => {
    loadStrategy();
  }, [trade.strategyId, trade.strategy_id]);
  
  // Load strategy
  const loadStrategy = () => {
    try {
      const strategyId = trade.strategyId || trade.strategy_id;
      if (!strategyId) return;
      
      const allStrategies = strategySync.getAllStrategies();
      const foundStrategy = allStrategies.find(s => s.id === strategyId);
      
      if (foundStrategy) {
        setStrategy(foundStrategy);
      }
    } catch (err) {
      logService.log('error', 'Failed to load strategy for trade', err, 'SimplifiedTradeDetails');
    }
  };
  
  // Format timestamp
  const formattedTime = trade.timestamp ? 
    format(new Date(trade.timestamp), 'PPpp') : 
    'Unknown time';
  
  // Format execution time
  const formattedExecutionTime = trade.executedAt ? 
    format(new Date(trade.executedAt), 'PPpp') : 
    'Not executed yet';
  
  // Calculate profit/loss
  const calculateProfitLoss = () => {
    if (!trade.exitPrice || !trade.entryPrice || !trade.amount) {
      return 0;
    }
    
    const entryValue = trade.entryPrice * trade.amount;
    const exitValue = trade.exitPrice * trade.amount;
    
    return trade.side === 'buy' ? 
      exitValue - entryValue : 
      entryValue - exitValue;
  };
  
  const profitLoss = calculateProfitLoss();
  const isProfitable = profitLoss > 0;
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'closed':
        return 'text-neon-turquoise';
      case 'pending':
      case 'open':
        return 'text-neon-yellow';
      case 'cancelled':
        return 'text-gray-400';
      case 'error':
        return 'text-neon-pink';
      default:
        return 'text-gray-400';
    }
  };
  
  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'closed':
        return CheckCircle;
      case 'pending':
      case 'open':
        return Clock;
      case 'cancelled':
        return XCircle;
      case 'error':
        return AlertTriangle;
      default:
        return Clock;
    }
  };
  
  const StatusIcon = getStatusIcon(trade.status);
  const statusColor = getStatusColor(trade.status);
  
  // Handle close trade
  const handleCloseTrade = async () => {
    try {
      setIsClosing(true);
      setError(null);
      
      // Close the trade
      await tradeService.closeTrade(trade.id);
      
      // Refresh trades
      onRefresh();
      
      setIsClosing(false);
    } catch (err) {
      setError('Failed to close trade');
      setIsClosing(false);
      logService.log('error', `Failed to close trade ${trade.id}`, err, 'SimplifiedTradeDetails');
    }
  };
  
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
          <h1 className="text-2xl font-bold gradient-text">Trade Details</h1>
          <p className="text-gray-400">View detailed information about this trade</p>
        </div>
        
        <button
          onClick={onRefresh}
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
      
      {/* Trade Overview */}
      <div className="bg-gunmetal-900/30 rounded-xl p-6 border border-gunmetal-800">
        <div className="flex items-center gap-3 mb-4">
          {trade.side === 'buy' ? (
            <div className="p-2 rounded-lg bg-neon-turquoise/10 text-neon-turquoise">
              <TrendingUp className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-neon-pink/10 text-neon-pink">
              <TrendingDown className="w-5 h-5" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-gray-200">{trade.symbol.replace('_', '/')}</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">{trade.side === 'buy' ? 'Long' : 'Short'}</span>
              <span className="text-sm text-gray-400">•</span>
              <span className="text-sm text-gray-400 capitalize">{trade.marketType || 'spot'}</span>
              <span className="text-sm text-gray-400">•</span>
              <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor} bg-gunmetal-900 flex items-center gap-1`}>
                <StatusIcon className="w-3 h-3" />
                <span>{trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Amount</p>
            <p className="text-lg font-medium text-gray-200">
              {trade.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
            </p>
          </div>
          
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Total Value</p>
            <p className="text-lg font-medium text-gray-200">
              ${(trade.amount * (trade.entryPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Entry Price</p>
            <p className="text-lg font-medium text-gray-200">
              ${trade.entryPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
            </p>
          </div>
          
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Exit Price</p>
            <p className="text-lg font-medium text-gray-200">
              ${trade.exitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
            </p>
          </div>
          
          {(trade.status === 'completed' || trade.status === 'closed') && (
            <div className="bg-gunmetal-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Profit/Loss</p>
              <p className={`text-lg font-medium ${isProfitable ? 'text-neon-turquoise' : 'text-neon-pink'}`}>
                {isProfitable ? '+' : ''}{profitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </p>
            </div>
          )}
        </div>
        
        {/* Risk Management */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Stop Loss</p>
            <p className="text-lg font-medium text-gray-200">
              ${trade.stopLoss?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
            </p>
          </div>
          
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Take Profit</p>
            <p className="text-lg font-medium text-gray-200">
              ${trade.takeProfit?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
            </p>
          </div>
          
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Trailing Stop</p>
            <p className="text-lg font-medium text-gray-200">
              {trade.trailingStop ? `${trade.trailingStop}%` : 'N/A'}
            </p>
          </div>
        </div>
        
        {/* Timestamps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Created</p>
            <p className="text-lg font-medium text-gray-200">
              {formattedTime}
            </p>
          </div>
          
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Executed</p>
            <p className="text-lg font-medium text-gray-200">
              {formattedExecutionTime}
            </p>
          </div>
        </div>
        
        {/* Strategy */}
        {strategy && (
          <div className="bg-gunmetal-800/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-400 mb-1">Strategy</p>
            <p className="text-lg font-medium text-gray-200">
              {strategy.name}
            </p>
          </div>
        )}
        
        {/* Actions */}
        {(trade.status === 'open' || trade.status === 'pending') && (
          <button
            onClick={handleCloseTrade}
            disabled={isClosing}
            className="flex items-center gap-2 px-4 py-2 bg-neon-pink text-white rounded-lg hover:bg-opacity-90 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isClosing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Closing...
              </>
            ) : (
              <>
                <X className="w-4 h-4" />
                Close Trade
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}
