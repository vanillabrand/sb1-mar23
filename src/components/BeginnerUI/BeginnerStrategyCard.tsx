import React from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronRight, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Wallet,
  Layers
} from 'lucide-react';
import { Strategy } from '../../lib/types';
import { formatCurrency } from '../../lib/format-utils';

interface BeginnerStrategyCardProps {
  strategy: Strategy;
  onSelect: () => void;
}

export function BeginnerStrategyCard({ strategy, onSelect }: BeginnerStrategyCardProps) {
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

  // Get the market type display name
  const getMarketTypeDisplay = () => {
    switch (marketType.toLowerCase()) {
      case 'spot':
        return 'Spot';
      case 'margin':
        return 'Margin';
      case 'futures':
        return 'Futures';
      default:
        return marketType;
    }
  };

  // Get the selected pairs display
  const getSelectedPairsDisplay = () => {
    if (!strategy.selected_pairs || strategy.selected_pairs.length === 0) {
      return 'No pairs selected';
    }
    
    if (strategy.selected_pairs.length === 1) {
      return strategy.selected_pairs[0];
    }
    
    return `${strategy.selected_pairs[0]} +${strategy.selected_pairs.length - 1} more`;
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="panel-metallic rounded-xl overflow-hidden cursor-pointer transition-all duration-300"
      onClick={onSelect}
    >
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
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
                {getMarketTypeDisplay()}
              </div>
            </div>
            
            <h3 className="text-xl font-bold mb-1">{strategy.title || strategy.name}</h3>
            
            <p className="text-gray-400 text-sm mb-3 line-clamp-2">
              {strategy.description || 'No description provided'}
            </p>
            
            <div className="flex flex-wrap gap-3 mb-3">
              <div className="flex items-center gap-1.5 bg-gunmetal-800 rounded-lg px-3 py-1.5">
                <Layers className="w-4 h-4 text-neon-turquoise" />
                <span className="text-sm">{getSelectedPairsDisplay()}</span>
              </div>
              
              {strategy.budget && (
                <div className="flex items-center gap-1.5 bg-gunmetal-800 rounded-lg px-3 py-1.5">
                  <Wallet className="w-4 h-4 text-neon-yellow" />
                  <span className="text-sm">{formatCurrency(strategy.budget.allocated || 0)}</span>
                </div>
              )}
              
              <div className={`flex items-center gap-1.5 bg-gunmetal-800 rounded-lg px-3 py-1.5 ${getPerformanceColor()}`}>
                {performance > 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : performance < 0 ? (
                  <TrendingDown className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span className="text-sm">
                  {performance > 0 ? '+' : ''}{performance.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-end">
            <ChevronRight className="w-6 h-6 text-gray-400" />
          </div>
        </div>
      </div>
      
      {/* Visual indicator for active/inactive status */}
      <div className={`h-1 w-full ${isActive ? 'bg-neon-green' : 'bg-gray-600'}`}></div>
    </motion.div>
  );
}
