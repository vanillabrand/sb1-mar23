import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Strategy } from '../../types';
import { StrategyCard } from '../StrategyCard';

interface StrategyGridProps {
  strategies: Strategy[];
  onSelect: (strategy: Strategy) => void;
}

export function StrategyGrid({ strategies, onSelect }: StrategyGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <AnimatePresence mode="sync">
        {strategies.map((strategy) => (
          <motion.div
            key={strategy.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <StrategyCard
              strategy={strategy}
              onSelect={onSelect}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}