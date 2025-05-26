import React from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronRight, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  AlertCircle
} from 'lucide-react';
import { Trade } from '../../lib/types';
import { formatCurrency, formatDate } from '../../lib/format-utils';

interface BeginnerTradeCardProps {
  trade: Trade;
  onViewDetails: () => void;
}

export function BeginnerTradeCard({ trade, onViewDetails }: BeginnerTradeCardProps) {
  // Format the trade data for display
  const symbol = trade.symbol?.replace('_', '/') || '';
  const side = trade.side || 'buy';
  const status = trade.status || 'pending';
  const amount = typeof trade.amount === 'number' ? trade.amount : parseFloat(trade.amount || '0');
  const price = typeof trade.price === 'number' ? trade.price : parseFloat(trade.price || '0');
  const profit = typeof trade.profit === 'number' ? trade.profit : parseFloat(trade.profit || '0');
  const createdAt = trade.created_at || trade.timestamp || new Date().toISOString();
  const strategyName = trade.strategy_name || 'Unknown Strategy';
  
  // Get status display information
  const getStatusInfo = () => {
    switch (status.toLowerCase()) {
      case 'open':
        return {
          icon: <Clock className="w-5 h-5" />,
          label: 'Open',
          color: 'text-neon-yellow'
        };
      case 'closed':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          label: 'Closed',
          color: 'text-neon-green'
        };
      case 'canceled':
        return {
          icon: <XCircle className="w-5 h-5" />,
          label: 'Canceled',
          color: 'text-gray-400'
        };
      case 'pending':
      default:
        return {
          icon: <Clock className="w-5 h-5" />,
          label: 'Pending',
          color: 'text-neon-turquoise'
        };
    }
  };
  
  // Get side display information
  const getSideInfo = () => {
    switch (side.toLowerCase()) {
      case 'buy':
      case 'long':
        return {
          label: side.toUpperCase(),
          color: 'text-neon-green'
        };
      case 'sell':
      case 'short':
        return {
          label: side.toUpperCase(),
          color: 'text-neon-raspberry'
        };
      default:
        return {
          label: side.toUpperCase(),
          color: 'text-gray-400'
        };
    }
  };
  
  // Get profit display information
  const getProfitInfo = () => {
    if (status.toLowerCase() !== 'closed') {
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        value: 'N/A',
        color: 'text-gray-400'
      };
    }
    
    if (profit > 0) {
      return {
        icon: <TrendingUp className="w-4 h-4" />,
        value: formatCurrency(profit),
        color: 'text-neon-green'
      };
    } else if (profit < 0) {
      return {
        icon: <TrendingDown className="w-4 h-4" />,
        value: formatCurrency(profit),
        color: 'text-neon-raspberry'
      };
    } else {
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        value: formatCurrency(0),
        color: 'text-gray-400'
      };
    }
  };
  
  const statusInfo = getStatusInfo();
  const sideInfo = getSideInfo();
  const profitInfo = getProfitInfo();
  
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="panel-metallic rounded-xl overflow-hidden cursor-pointer transition-all duration-300"
      onClick={onViewDetails}
    >
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className={`flex items-center gap-1.5 ${statusInfo.color}`}>
                {statusInfo.icon}
                <span className="text-sm font-medium">{statusInfo.label}</span>
              </div>
              
              <div className="h-4 border-l border-gunmetal-700 mx-1"></div>
              
              <div className={`text-sm font-medium ${sideInfo.color}`}>
                {sideInfo.label}
              </div>
              
              <div className="h-4 border-l border-gunmetal-700 mx-1"></div>
              
              <div className="text-sm font-medium text-gray-400">
                {formatDate(createdAt)}
              </div>
            </div>
            
            <h3 className="text-xl font-bold mb-1">{symbol}</h3>
            
            <p className="text-gray-400 text-sm mb-3">
              Strategy: {strategyName}
            </p>
            
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5 bg-gunmetal-800 rounded-lg px-3 py-1.5">
                <span className="text-sm">Amount: {amount.toFixed(6)}</span>
              </div>
              
              <div className="flex items-center gap-1.5 bg-gunmetal-800 rounded-lg px-3 py-1.5">
                <span className="text-sm">Price: {formatCurrency(price)}</span>
              </div>
              
              <div className={`flex items-center gap-1.5 bg-gunmetal-800 rounded-lg px-3 py-1.5 ${profitInfo.color}`}>
                {profitInfo.icon}
                <span className="text-sm">
                  Profit: {profitInfo.value}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-end">
            <ChevronRight className="w-6 h-6 text-gray-400" />
          </div>
        </div>
      </div>
      
      {/* Visual indicator for trade status */}
      <div className={`h-1 w-full ${
        status.toLowerCase() === 'open' ? 'bg-neon-yellow' : 
        status.toLowerCase() === 'closed' ? 'bg-neon-green' : 
        status.toLowerCase() === 'canceled' ? 'bg-gray-600' : 
        'bg-neon-turquoise'
      }`}></div>
    </motion.div>
  );
}
