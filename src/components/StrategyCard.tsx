import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Power, Settings } from 'lucide-react';
import type { Strategy } from '../lib/types';

interface StrategyCardProps {
  strategy: Strategy;
  onActivate: () => void;
  onRefresh: () => void;
}

export function StrategyCard({ strategy, onActivate, onRefresh }: StrategyCardProps) {
  return (
    <motion.div
      className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-6 shadow-lg border border-gunmetal-800/50"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-gunmetal-900/50 text-neon-raspberry">
          <Brain className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-200">{strategy.title}</h3>
          <span className="text-sm text-gray-400">{strategy.riskLevel} Risk</span>
        </div>
      </div>
      
      <p className="text-sm text-gray-400 mb-4">{strategy.description}</p>
      
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm">
          <span className="text-gray-400">Performance: </span>
          <span className="text-neon-turquoise">{strategy.performance}%</span>
        </div>
        {strategy.status !== 'active' && (
          <button
            onClick={onActivate}
            className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300"
          >
            Activate
          </button>
        )}
      </div>
    </motion.div>
  );
}
