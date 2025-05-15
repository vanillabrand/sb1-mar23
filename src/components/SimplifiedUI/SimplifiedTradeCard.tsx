import React from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { Trade } from '../../lib/types';
import { formatDistanceToNow } from 'date-fns';

interface SimplifiedTradeCardProps {
  trade: Trade;
  onViewDetails?: () => void;
}

export function SimplifiedTradeCard({ trade, onViewDetails }: SimplifiedTradeCardProps) {
  // Format timestamp
  const formattedTime = trade.timestamp ? 
    formatDistanceToNow(new Date(trade.timestamp), { addSuffix: true }) : 
    'Unknown time';
  
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
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gunmetal-800/30 rounded-lg p-4 border border-gunmetal-700 hover:border-gunmetal-600 transition-all duration-300 cursor-pointer"
      onClick={onViewDetails}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {trade.side === 'buy' ? (
            <div className="p-1.5 rounded-lg bg-neon-turquoise/10 text-neon-turquoise">
              <TrendingUp className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-neon-pink/10 text-neon-pink">
              <TrendingDown className="w-4 h-4" />
            </div>
          )}
          <div>
            <h4 className="font-medium text-gray-200">{trade.symbol.replace('_', '/')}</h4>
            <span className="text-xs text-gray-400">{formattedTime}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor} bg-gunmetal-900 flex items-center gap-1`}>
            <StatusIcon className="w-3 h-3" />
            <span>{trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <p className="text-xs text-gray-400">Amount</p>
          <p className="text-sm font-medium text-gray-200">
            {trade.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Entry Price</p>
          <p className="text-sm font-medium text-gray-200">
            ${trade.entryPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Exit Price</p>
          <p className="text-sm font-medium text-gray-200">
            ${trade.exitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
          </p>
        </div>
      </div>
      
      {trade.status === 'completed' || trade.status === 'closed' ? (
        <div className={`text-right text-sm font-medium ${isProfitable ? 'text-neon-turquoise' : 'text-neon-pink'}`}>
          {isProfitable ? '+' : ''}{profitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
        </div>
      ) : (
        <div className="text-right text-xs text-gray-400">
          {trade.side === 'buy' ? 'Long' : 'Short'} • {trade.marketType || 'spot'}
        </div>
      )}
    </motion.div>
  );
}
