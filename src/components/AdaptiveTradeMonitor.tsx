import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExperienceMode } from '../hooks/useExperienceMode';
import { TradeMonitor } from './TradeMonitor';
import { BeginnerTradeMonitor } from './BeginnerUI/BeginnerTradeMonitor';
import { ExpertTradeMonitor } from './ExpertUI/ExpertTradeMonitor';
import { Strategy } from '../lib/types';

interface AdaptiveTradeMonitorProps {
  strategies?: Strategy[];
  className?: string;
}

export function AdaptiveTradeMonitor({ strategies = [], className = '' }: AdaptiveTradeMonitorProps) {
  const { mode } = useExperienceMode();

  return (
    <AnimatePresence mode="wait">
      {mode === 'beginner' && (
        <motion.div
          key="beginner-trade-monitor"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <BeginnerTradeMonitor strategies={strategies} className={className} />
        </motion.div>
      )}
      
      {mode === 'intermediate' && (
        <motion.div
          key="intermediate-trade-monitor"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <TradeMonitor strategies={strategies} className={className} />
        </motion.div>
      )}
      
      {mode === 'expert' && (
        <motion.div
          key="expert-trade-monitor"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <ExpertTradeMonitor strategies={strategies} className={className} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
