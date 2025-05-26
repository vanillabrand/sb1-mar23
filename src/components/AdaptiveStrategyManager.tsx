import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExperienceMode } from '../hooks/useExperienceMode';
import { StrategyManager } from './StrategyManager';
import { BeginnerStrategyManager } from './BeginnerUI/BeginnerStrategyManager';
import { ExpertStrategyManager } from './ExpertUI/ExpertStrategyManager';

interface AdaptiveStrategyManagerProps {
  className?: string;
}

export function AdaptiveStrategyManager({ className = '' }: AdaptiveStrategyManagerProps) {
  const { mode } = useExperienceMode();

  return (
    <AnimatePresence mode="wait">
      {mode === 'beginner' && (
        <motion.div
          key="beginner-strategy-manager"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <BeginnerStrategyManager className={className} />
        </motion.div>
      )}
      
      {mode === 'intermediate' && (
        <motion.div
          key="intermediate-strategy-manager"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <StrategyManager className={className} />
        </motion.div>
      )}
      
      {mode === 'expert' && (
        <motion.div
          key="expert-strategy-manager"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <ExpertStrategyManager className={className} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
