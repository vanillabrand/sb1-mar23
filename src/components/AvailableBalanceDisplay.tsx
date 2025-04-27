import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, DollarSign } from 'lucide-react';
import { walletBalanceService } from '../lib/wallet-balance-service';
import { exchangeService } from '../lib/exchange-service';
import { WalletBalance, MarketType } from '../lib/types';
import { logService } from '../lib/log-service';
import { motion, AnimatePresence } from 'framer-motion';
import { demoService } from '../lib/demo-service';

interface AvailableBalanceDisplayProps {
  marketType?: MarketType;
  compact?: boolean;
  showRefreshButton?: boolean;
  className?: string;
  showLabel?: boolean;
}

const AvailableBalanceDisplay: React.FC<AvailableBalanceDisplayProps> = ({
  marketType = 'spot',
  compact = false,
  showRefreshButton = true,
  className = '',
  showLabel = true
}) => {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [prevBalance, setPrevBalance] = useState<WalletBalance | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isValueChanged, setIsValueChanged] = useState(false);
  const animationTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Fetch balance on component mount
    fetchBalance();

    // Set up polling for real-time updates (every 5 seconds)
    const pollingInterval = setInterval(() => {
      fetchBalance(false); // Silent update (no loading indicator)
    }, 5000);

    // Subscribe to balance updates
    const handleBalanceUpdate = () => {
      fetchBalance(false); // Silent update (no loading indicator)
    };

    walletBalanceService.on('balancesUpdated', handleBalanceUpdate);

    return () => {
      walletBalanceService.off('balancesUpdated', handleBalanceUpdate);
      clearInterval(pollingInterval);
      if (animationTimeout.current) {
        clearTimeout(animationTimeout.current);
      }
    };
  }, [marketType]);

  // Effect to handle value change animations
  useEffect(() => {
    if (prevBalance && balance) {
      // Check if free balance has changed
      if (prevBalance.free !== balance.free) {
        setIsValueChanged(true);

        // Clear any existing timeout
        if (animationTimeout.current) {
          clearTimeout(animationTimeout.current);
        }

        // Set timeout to clear the animation
        animationTimeout.current = setTimeout(() => {
          setIsValueChanged(false);
        }, 1000);
      }
    }
  }, [balance, prevBalance]);

  const fetchBalance = async (showLoading = true) => {
    try {
      if (showLoading) setIsRefreshing(true);

      // Check if we're in demo mode
      const isDemo = demoService.isInDemoMode();

      if (isDemo) {
        // Use demo balances
        const demoBalance = {
          free: 10000,
          used: 2000,
          total: 12000,
          currency: 'USDT'
        };

        // Save previous balance for comparison
        setPrevBalance(balance);
        setBalance(demoBalance);

        logService.log('info', `Using demo ${marketType} balance`, demoBalance, 'AvailableBalanceDisplay');
        return;
      }

      try {
        // Try to get real exchange balances
        const marketBalances = await exchangeService.fetchAllWalletBalances();
        const marketBalance = marketBalances[marketType];

        // Save previous balance for comparison
        setPrevBalance(balance);

        if (marketBalance) {
          setBalance(marketBalance);

          // Safely create the balance object to log
          logService.log('info', `Fetched ${marketType} balance`, marketBalance, 'AvailableBalanceDisplay');
          return;
        }
      } catch (exchangeError) {
        // Just log the error and continue to fallback
        logService.log('error', 'Failed to fetch exchange balance', exchangeError, 'AvailableBalanceDisplay');
      }

      // Fallback to general available balance
      try {
        // Get the general balance safely
        const generalBalance = walletBalanceService.getBalance();

        // Save previous balance for comparison
        setPrevBalance(balance);

        if (generalBalance) {
          setBalance(generalBalance);
          logService.log('info', 'Using general balance as fallback', generalBalance, 'AvailableBalanceDisplay');
        } else {
          // If no general balance, create a default balance object
          const defaultBalance = { free: 10000, used: 2000, total: 12000, currency: 'USDT' };
          setBalance(defaultBalance);
          logService.log('info', 'Using default balance as fallback', defaultBalance, 'AvailableBalanceDisplay');
        }
      } catch (balanceError) {
        logService.log('error', 'Failed to get general balance', balanceError, 'AvailableBalanceDisplay');
        // Set a default balance object if all else fails
        const defaultBalance = { free: 10000, used: 2000, total: 12000, currency: 'USDT' };
        setBalance(defaultBalance);
        logService.log('info', 'Using default balance after error', defaultBalance, 'AvailableBalanceDisplay');
      }
    } finally {
      if (showLoading) setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await fetchBalance(true);
  };

  // Helper function to render animated values
  const AnimatedValue = ({ value, prefix = "$", suffix = "", className = "" }: { value: any, prefix?: string, suffix?: string, className?: string }) => {
    return (
      <AnimatePresence mode="wait">
        <motion.span
          key={value}
          initial={{ opacity: 0.7, y: isValueChanged ? -10 : 0 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${className} ${isValueChanged ? 'relative' : ''}`}
        >
          {prefix}{typeof value === 'number'
            ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : value
          }{suffix}
          {isValueChanged && (
            <motion.span
              className="absolute inset-0 bg-neon-turquoise/20 rounded-md -z-10"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1 }}
            />
          )}
        </motion.span>
      </AnimatePresence>
    );
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showLabel && (
          <span className="text-xs text-gray-400 capitalize">{marketType}:</span>
        )}
        <AnimatedValue
          value={balance?.free || 0}
          className="text-sm font-medium text-white"
        />
        {showRefreshButton && (
          <motion.button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 rounded-full hover:bg-gunmetal-700 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <RefreshCw className={`w-3 h-3 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      className={`bg-gunmetal-800 rounded-lg p-4 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-neon-turquoise" />
          <h3 className="text-sm font-medium text-white">
            {showLabel ? `Available Balance (${marketType.charAt(0).toUpperCase() + marketType.slice(1)})` : 'Available Balance'}
          </h3>
        </div>
        {showRefreshButton && (
          <motion.button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 rounded-full hover:bg-gunmetal-700 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        )}
      </div>

      <div className="flex items-center">
        <AnimatedValue
          value={balance?.free || 0}
          className="text-2xl font-bold text-neon-turquoise"
        />
        <span className="ml-2 text-xs text-gray-400">
          USDT
        </span>
      </div>

      {balance && (
        <div className="mt-2">
          <div className="w-full bg-gunmetal-700 h-1 rounded-full">
            <motion.div
              className="bg-gradient-to-r from-neon-turquoise to-neon-yellow h-1 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (balance.free / balance.total) * 100)}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-0.5">
            <span>Used: <AnimatedValue value={balance.used} className="text-xs text-gray-500" /></span>
            <span>Total: <AnimatedValue value={balance.total} className="text-xs text-gray-500" /></span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default AvailableBalanceDisplay;
