import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';

interface SimplifiedPortfolioSummaryProps {
  value: number;
  change: number;
  isDemoMode: boolean;
}

export function SimplifiedPortfolioSummary({ 
  value, 
  change, 
  isDemoMode 
}: SimplifiedPortfolioSummaryProps) {
  const isPositive = change >= 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gunmetal-900/30 rounded-xl p-6 border border-gunmetal-800"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-gunmetal-900/50 text-neon-turquoise">
          <DollarSign className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold gradient-text">Portfolio Summary</h2>
          <p className="text-sm text-gray-400">
            {isDemoMode ? 'Demo portfolio value and performance' : 'Current portfolio value and performance'}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Portfolio Value */}
        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-1">Total Value</p>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-white">
              ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {isDemoMode && (
              <span className="ml-2 text-xs text-neon-yellow">Demo</span>
            )}
          </div>
        </div>
        
        {/* 24h Change */}
        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-1">24h Change</p>
          <div className="flex items-center">
            {isPositive ? (
              <TrendingUp className="w-5 h-5 text-neon-turquoise mr-2" />
            ) : (
              <TrendingDown className="w-5 h-5 text-neon-pink mr-2" />
            )}
            <span className={`text-2xl font-bold ${isPositive ? 'text-neon-turquoise' : 'text-neon-pink'}`}>
              {isPositive ? '+' : ''}{change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`ml-1 text-lg ${isPositive ? 'text-neon-turquoise' : 'text-neon-pink'}`}>
              USD
            </span>
            <span className={`ml-2 text-sm ${isPositive ? 'text-neon-turquoise/70' : 'text-neon-pink/70'}`}>
              ({isPositive ? '+' : ''}{((change / (value - change)) * 100).toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>
      
      {isDemoMode && (
        <div className="mt-4 p-3 bg-neon-yellow/10 border border-neon-yellow/20 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-neon-yellow" />
          <p className="text-sm text-neon-yellow">
            Demo Mode: All trades and values are simulated and do not involve real funds.
          </p>
        </div>
      )}
    </motion.div>
  );
}
