import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Power, Zap } from 'lucide-react';
import { demoService } from '../lib/demo-service';
import { exchangeService } from '../lib/exchange-service';
import { eventBus } from '../lib/event-bus';
import { logService } from '../lib/log-service';

interface TradingModeIndicatorProps {
  className?: string;
  showToggle?: boolean;
}

export function TradingModeIndicator({
  className = '',
  showToggle = false
}: TradingModeIndicatorProps) {
  const [isDemoMode, setIsDemoMode] = useState(demoService.isDemoMode());
  const [isToggling, setIsToggling] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user has exchange credentials
  useEffect(() => {
    const checkCredentials = async () => {
      try {
        const exchanges = await exchangeService.getUserExchanges();
        setHasCredentials(exchanges.length > 0);
      } catch (error) {
        logService.log('error', 'Failed to check exchange credentials', error, 'TradingModeIndicator');
        setHasCredentials(false);
      }
    };

    checkCredentials();
  }, []);

  // Listen for mode changes
  useEffect(() => {
    const handleModeChange = ({ isLive }: { isLive: boolean }) => {
      setIsDemoMode(!isLive);
    };

    eventBus.on('exchange:modeChanged', handleModeChange);

    return () => {
      eventBus.off('exchange:modeChanged', handleModeChange);
    };
  }, []);

  // Handle mode toggle
  const handleModeToggle = async () => {
    if (!hasCredentials && !isDemoMode) {
      setError('Please set up your wallet credentials first in the Wallet Manager.');
      setTimeout(() => setError(null), 5000);
      return;
    }

    try {
      setIsToggling(true);
      await exchangeService.switchMode(!isDemoMode);
      setIsDemoMode(demoService.isDemoMode());
    } catch (error) {
      logService.log('error', 'Error toggling mode', error, 'TradingModeIndicator');
      setError(error instanceof Error ? error.message : 'Failed to switch mode');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer ${
          isDemoMode
            ? 'bg-neon-turquoise/10 text-neon-turquoise border border-neon-turquoise/30 hover:bg-neon-turquoise/20'
            : 'bg-neon-raspberry/10 text-neon-raspberry border border-neon-raspberry/30 hover:bg-neon-raspberry/20'
        }`}
        onClick={showToggle ? handleModeToggle : undefined}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {isDemoMode ? (
          <>
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">Demo Mode</span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Live Trading</span>
          </>
        )}

        {showToggle && (
          <button
            onClick={handleModeToggle}
            disabled={isToggling}
            className={`ml-2 relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
              !isDemoMode ? 'bg-neon-raspberry' : 'bg-gunmetal-700'
            } ${!hasCredentials && !isDemoMode ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={isDemoMode ? "Switch to Live Mode" : "Switch to Demo Mode"}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                !isDemoMode ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        )}
      </motion.div>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full mt-2 left-0 z-50 w-64 p-3 bg-gunmetal-900 border border-gunmetal-700 rounded-lg shadow-xl"
          >
            <p className="text-sm text-gray-300 mb-2">
              {isDemoMode
                ? 'Demo Mode: Trading with simulated funds on TestNet.'
                : 'Live Trading: Trading with real funds on exchanges.'}
            </p>
            {showToggle && (
              <button
                onClick={handleModeToggle}
                disabled={isToggling || (!hasCredentials && !isDemoMode)}
                className={`w-full mt-2 py-1.5 rounded-md text-sm cursor-pointer ${
                  isDemoMode
                    ? 'bg-neon-raspberry text-white hover:bg-neon-raspberry/90'
                    : 'bg-neon-turquoise text-gunmetal-950 hover:bg-neon-turquoise/90'
                } transition-colors ${isToggling ? 'opacity-70' : ''} ${(!hasCredentials && !isDemoMode) ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label={isDemoMode ? "Switch to Live Trading" : "Switch to Demo Mode"}
              >
                {isToggling
                  ? 'Switching...'
                  : isDemoMode
                  ? 'Switch to Live Trading'
                  : 'Switch to Demo Mode'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full mt-2 left-0 z-50 w-64 p-3 bg-red-500/10 border border-red-500/30 rounded-lg shadow-xl"
          >
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
