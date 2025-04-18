import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
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

  // Track if we should show the close button (after 10 seconds)
  const [showCloseButton, setShowCloseButton] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset time and close button state when modal closes
      setTimeElapsed(0);
      setShowCloseButton(false);
      return;
    }

    const interval = setInterval(() => {
      setTimeElapsed(prev => {
        const newTime = prev + 1;
        // Show close button after 10 seconds
        if (newTime >= 10 && !showCloseButton) {
          setShowCloseButton(true);
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, showCloseButton]);

  // Auto-close the modal when process completes
  useEffect(() => {
    if (totalProgress >= 100 || steps.some(s => s.status === 'error')) {
      // Add a small delay before closing to show the completed state
      const closeTimer = setTimeout(() => {
        onClose();
      }, 1500);

      return () => clearTimeout(closeTimer);
    }
  }, [totalProgress, steps, onClose]);

  // Format time elapsed as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  // Get current step name
  const currentStep = steps.find(s => s.status === 'in-progress')?.name || 'Processing...';
  const hasError = steps.some(s => s.status === 'error');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 mobile-modal-container">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="modal-dark-metal rounded-xl p-5 w-full max-w-md relative"
      >
        {/* Close button in the top-right corner - only shown after 10 seconds */}
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 rounded-full text-gray-400 hover:text-gray-200 hover:bg-gunmetal-800/50"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header with title */}
        <div className="mb-4">
          <h2 className="text-lg font-bold gradient-text">Deactivating Strategy</h2>
        </div>

        {/* Strategy info */}
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <div className="text-gray-400">Strategy: <span className="text-gray-200">{strategy.name}</span></div>
          <div className="text-gray-400">Market: <span className="text-gray-200">{strategy.market_type || 'spot'}</span></div>
          <div className="text-gray-400">Exchange: <span className="text-gray-200">{strategy.exchange || 'Binance'}</span></div>
        </div>

        {/* Current step and time */}
        <div className="flex justify-between items-center mb-2 text-xs">
          <span className="text-gray-400">{currentStep}</span>
          <span className="text-gray-400">{formatTime(timeElapsed)}</span>
        </div>

        {/* Progress bar with gradient */}
        <div className="mb-6">
          <div className="h-2 bg-gunmetal-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500"
              initial={{ width: 0 }}
              animate={{ width: `${totalProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-xs font-medium text-gray-300">{totalProgress}%</span>
          </div>
        </div>

        {/* Close button at the bottom - only shown after 10 seconds */}
        {showCloseButton && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm bg-neon-pink text-white hover:bg-neon-pink/90"
            >
              Close
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
