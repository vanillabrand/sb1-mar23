import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { CircularProgress } from './CircularProgress';
import type { Strategy } from '../lib/types';

export interface DeactivationStep {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  progress: number;
  message?: string;
}

interface DeactivationProgressModalProps {
  strategy: Strategy;
  steps: DeactivationStep[];
  totalProgress: number;
  isOpen: boolean;
  onClose: () => void;
}

export function DeactivationProgressModal({
  strategy,
  steps,
  totalProgress,
  isOpen,
  onClose
}: DeactivationProgressModalProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      // Reset time when modal closes
      setTimeElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Format time elapsed as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get the appropriate icon for a step based on its status
  const getStepIcon = (step: DeactivationStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-neon-turquoise" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-neon-pink" />;
      case 'in-progress':
        return <Loader2 className="w-5 h-5 text-neon-yellow animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 mobile-modal-container">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="modal-dark-metal rounded-xl p-5 w-full max-w-md relative"
      >
        {/* Close button in the top-right corner */}
        <button
          onClick={onClose}
          disabled={totalProgress < 100 && !steps.some(s => s.status === 'error')}
          className={`absolute right-4 top-4 p-1 rounded-full ${
            totalProgress < 100 && !steps.some(s => s.status === 'error')
              ? 'text-gray-500 cursor-not-allowed'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gunmetal-800/50'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with title and progress */}
        <div className="flex items-center mb-4">
          <h2 className="text-lg font-bold gradient-text">Deactivating Strategy</h2>
          <div className="ml-auto flex items-center gap-2">
            <CircularProgress
              value={totalProgress}
              size={36}
              color="#2dd4bf"
              backgroundColor="rgba(45, 212, 191, 0.1)"
            />
            <div className="text-xs text-gray-400">
              {formatTime(timeElapsed)}
            </div>
          </div>
        </div>

        {/* Strategy info */}
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <div className="text-gray-400">Strategy: <span className="text-gray-200">{strategy.name}</span></div>
          <div className="text-gray-400">Market: <span className="text-gray-200">{strategy.market_type || 'spot'}</span></div>
          <div className="text-gray-400">Exchange: <span className="text-gray-200">{strategy.exchange || 'Binance'}</span></div>
        </div>

        {/* Overall Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Overall Progress</span>
            <span className="text-neon-turquoise font-medium">{totalProgress}%</span>
          </div>
          <div className="h-1.5 bg-gunmetal-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-neon-turquoise"
              initial={{ width: 0 }}
              animate={{ width: `${totalProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Steps - in a scrollable container */}
        <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
          <div className="space-y-3">
            {steps.map((step) => (
              <div key={step.id} className="bg-gunmetal-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {getStepIcon(step)}
                    <span className="text-xs font-medium text-gray-200">{step.name}</span>
                  </div>
                  <span className="text-xs font-mono text-gray-400">{step.progress}%</span>
                </div>
                {step.message && (
                  <p className={`text-xs mt-1 ${
                    step.status === 'error' ? 'text-neon-pink' : 'text-gray-400'
                  }`}>
                    {step.message}
                  </p>
                )}
                <div className="mt-1.5 h-1 bg-gunmetal-800 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${
                      step.status === 'completed' ? 'bg-neon-turquoise' :
                      step.status === 'error' ? 'bg-neon-pink' :
                      'bg-neon-yellow'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${step.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Close button at the bottom */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            disabled={totalProgress < 100 && !steps.some(s => s.status === 'error')}
            className={`px-4 py-2 rounded-lg text-sm ${
              totalProgress < 100 && !steps.some(s => s.status === 'error')
                ? 'bg-gunmetal-800 text-gray-500 cursor-not-allowed'
                : 'bg-neon-pink text-white hover:bg-neon-pink/90'
            }`}
          >
            {totalProgress >= 100 ? 'Close' : 'Please wait...'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
