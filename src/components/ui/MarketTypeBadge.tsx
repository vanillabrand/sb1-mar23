import React from 'react';
import { motion } from 'framer-motion';

export type MarketType = 'spot' | 'margin' | 'futures';

interface MarketTypeBadgeProps {
  marketType?: MarketType;
  className?: string;
}

export function MarketTypeBadge({ marketType = 'spot', className = '' }: MarketTypeBadgeProps) {
  // Get color based on market type
  const getMarketTypeColor = (type: MarketType): string => {
    switch (type) {
      case 'spot':
        return 'bg-neon-turquoise/20 text-neon-turquoise border-neon-turquoise/30';
      case 'margin':
        return 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/30';
      case 'futures':
        return 'bg-neon-pink/20 text-neon-pink border-neon-pink/30';
      default:
        return 'bg-gray-400/20 text-gray-400 border-gray-400/30';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getMarketTypeColor(marketType)} ${className}`}
    >
      {marketType.charAt(0).toUpperCase() + marketType.slice(1)}
    </motion.div>
  );
}
