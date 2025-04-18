import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, AlertCircle, Loader2, Wallet, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logService } from '../lib/log-service';
import { walletBalanceService } from '../lib/wallet-balance-service';
import { exchangeService } from '../lib/exchange-service';
import { budgetStreamingService } from '../lib/budget-streaming-service';
import type { StrategyBudget, Strategy, RiskLevel, MarketType, WalletBalance } from '../lib/types';

interface BudgetModalProps {
  onConfirm: (budget: StrategyBudget) => Promise<void>;
  onCancel?: () => void;
  onClose?: () => void;
  maxBudget?: number;
  isSubmitting?: boolean;
  initialBudget?: StrategyBudget;
  strategy?: Strategy;
  riskLevel?: RiskLevel;
  marketType?: MarketType; // Added market type
}

export function BudgetModal({ onConfirm, onCancel, onClose, maxBudget = 10000, isSubmitting = false, initialBudget, strategy, riskLevel = 'Medium', marketType = 'spot' }: BudgetModalProps) {
  const [totalBudget, setTotalBudget] = useState<number>(
    initialBudget?.total || Math.min((maxBudget || 0) * 0.1, maxBudget || 0)
  );
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [availableBalance, setAvailableBalance] = useState<number>(maxBudget);
  const [prevAvailableBalance, setPrevAvailableBalance] = useState<number | null>(null);
  const [isBalanceChanged, setIsBalanceChanged] = useState(false);
  const [marketBalances, setMarketBalances] = useState<{
    spot?: WalletBalance;
    margin?: WalletBalance;
    futures?: WalletBalance;
  }>({});
  const animationTimeout = useRef<NodeJS.Timeout | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    return () => {
      setTotalBudget(initialBudget?.total || Math.min((maxBudget || 0) * 0.1, maxBudget || 0));
      setError(null);
      setIsProcessing(false);
      setIsLoadingBalance(false);
    };
  }, [maxBudget, initialBudget]);

  // Initialize wallet balance service and fetch balances
  useEffect(() => {
    const initializeBalances = async () => {
      try {
        setIsLoadingBalance(true);
        // Initialize wallet balance service if not already initialized
        if (!walletBalanceService.getLastUpdated()) {
          await walletBalanceService.initialize();
        }

        // Get the available balance for all market types
        try {
          const balances = await exchangeService.fetchAllWalletBalances();
          setMarketBalances(balances);

          // Set the available balance based on the selected market type
          const marketTypeBalance = balances[marketType];
          if (marketTypeBalance) {
            setAvailableBalance(marketTypeBalance.free);

            // If initial budget is not set, use 10% of available balance
            if (!initialBudget) {
              setTotalBudget(Math.min(marketTypeBalance.free * 0.1, marketTypeBalance.free));
            }
          } else {
            // Fallback to general available balance
            const balance = walletBalanceService.getAvailableBalance();
            setAvailableBalance(balance);

            // If initial budget is not set, use 10% of available balance
            if (!initialBudget) {
              setTotalBudget(Math.min(balance * 0.1, balance));
            }
          }
        } catch (balanceError) {
          logService.log('error', 'Failed to fetch market type balances', balanceError, 'BudgetModal');
          // Fallback to general available balance
          const balance = walletBalanceService.getAvailableBalance();
          setAvailableBalance(balance);

          // If initial budget is not set, use 10% of available balance
          if (!initialBudget) {
            setTotalBudget(Math.min(balance * 0.1, balance));
          }
        }
      } catch (error) {
        logService.log('error', 'Failed to initialize wallet balances', error, 'BudgetModal');
        // Fall back to maxBudget if balance fetch fails
        setAvailableBalance(maxBudget);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    initializeBalances();

    // Subscribe to balance updates
    const handleBalanceUpdate = () => {
      // Refresh all market type balances
      exchangeService.fetchAllWalletBalances().then(balances => {
        setMarketBalances(balances);

        // Save previous balance for comparison
        setPrevAvailableBalance(availableBalance);

        // Update the available balance based on the selected market type
        const marketTypeBalance = balances[marketType];
        if (marketTypeBalance) {
          setAvailableBalance(marketTypeBalance.free);
        } else {
          // Fallback to general available balance
          const balance = walletBalanceService.getAvailableBalance();
          setAvailableBalance(balance);
        }
      }).catch(error => {
        logService.log('error', 'Failed to update market type balances', error, 'BudgetModal');
        // Fallback to general available balance
        const balance = walletBalanceService.getAvailableBalance();
        setPrevAvailableBalance(availableBalance);
        setAvailableBalance(balance);
      });
    };

    // Set up polling for real-time updates (every 5 seconds)
    const pollingInterval = setInterval(() => {
      handleBalanceUpdate();
    }, 5000);

    walletBalanceService.on('balancesUpdated', handleBalanceUpdate);

    return () => {
      walletBalanceService.off('balancesUpdated', handleBalanceUpdate);
      clearInterval(pollingInterval);
      if (animationTimeout.current) {
        clearTimeout(animationTimeout.current);
      }
    };
  }, [initialBudget, maxBudget, marketType]);

  // Effect to handle value change animations
  useEffect(() => {
    if (prevAvailableBalance !== null && availableBalance !== prevAvailableBalance) {
      setIsBalanceChanged(true);

      // Clear any existing timeout
      if (animationTimeout.current) {
        clearTimeout(animationTimeout.current);
      }

      // Set timeout to clear the animation
      animationTimeout.current = setTimeout(() => {
        setIsBalanceChanged(false);
      }, 1000);
    }
  }, [availableBalance, prevAvailableBalance]);

  // Use the fetched available balance for the selected market type
  const marketBalance = availableBalance;

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsedValue = parseFloat(e.target.value);
    if (!isNaN(parsedValue)) {
      setTotalBudget(Number(parsedValue.toFixed(2)));
    }
  };

  const refreshBalance = async () => {
    try {
      setIsLoadingBalance(true);

      // Refresh all balances
      await walletBalanceService.refreshBalances();

      // Get the available balance for all market types
      try {
        const balances = await exchangeService.fetchAllWalletBalances();
        setMarketBalances(balances);

        // Save previous balance for comparison
        setPrevAvailableBalance(availableBalance);

        // Set the available balance based on the selected market type
        const marketTypeBalance = balances[marketType];
        if (marketTypeBalance) {
          setAvailableBalance(marketTypeBalance.free);
        } else {
          // Fallback to general available balance
          const balance = walletBalanceService.getAvailableBalance();
          setAvailableBalance(balance);
        }
      } catch (balanceError) {
        logService.log('error', 'Failed to fetch market type balances', balanceError, 'BudgetModal');
        // Fallback to general available balance
        const balance = walletBalanceService.getAvailableBalance();
        setPrevAvailableBalance(availableBalance);
        setAvailableBalance(balance);
      }
    } catch (error) {
      logService.log('error', 'Failed to refresh wallet balance', error, 'BudgetModal');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  // Helper function to render animated values
  const AnimatedValue = ({ value, prefix = "$", suffix = "", className = "" }) => {
    return (
      <AnimatePresence mode="wait">
        <motion.span
          key={value}
          initial={{ opacity: 0.7, y: isBalanceChanged ? -10 : 0 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${className} ${isBalanceChanged ? 'relative' : ''}`}
        >
          {prefix}{typeof value === 'number'
            ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : value
          }{suffix}
          {isBalanceChanged && (
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

  // Calculate position sizing based on risk level
  const effectiveRiskLevel = strategy?.riskLevel || strategy?.risk_level || riskLevel || 'Medium';
  const positionSizeMultiplier = {
    'Ultra Low': 0.05,
    'Low': 0.1,
    'Medium': 0.15,
    'High': 0.2,
    'Ultra High': 0.25,
    'Extreme': 0.3,
    'God Mode': 0.5
  }[effectiveRiskLevel] || 0.15;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsProcessing(true);
      setError(null);

      // Log for debugging
      console.log('Budget submission:', {
        strategy,
        effectiveRiskLevel,
        positionSizeMultiplier,
        totalBudget
      });

      const budget: StrategyBudget = {
        total: Number(totalBudget.toFixed(2)),
        allocated: 0,
        available: Number(totalBudget.toFixed(2)),
        maxPositionSize: Number((totalBudget * positionSizeMultiplier).toFixed(2)),
        marketType: marketType // Include the market type in the budget
      };

      await onConfirm(budget);

      // Reset state after successful submission
      setIsProcessing(false);
      setError(null);

      // Close modal
      if (onCancel) onCancel();
      else if (onClose) onClose();

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to set budget');
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto mobile-modal-container"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget && onCancel) {
          onCancel();
        }
      }}
    >
      <div
        className="bg-black border border-gunmetal-700 rounded-lg p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        <h2 className="text-xl font-bold gradient-text mb-4">
          Set Strategy Budget
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Market Balance Info */}
          <div className="bg-gunmetal-800/50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-neon-turquoise" />
                <h3 className="text-sm font-medium text-gray-300">
                  Available Balance ({marketType.charAt(0).toUpperCase() + marketType.slice(1)})
                </h3>
              </div>
              <motion.button
                onClick={refreshBalance}
                disabled={isLoadingBalance}
                className="p-1 rounded-full hover:bg-gunmetal-700 transition-colors"
                title="Refresh balance"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoadingBalance ? 'animate-spin' : ''}`} />
              </motion.button>
            </div>

            <AnimatedValue
              value={marketBalance || 0}
              className="text-2xl font-bold text-neon-turquoise"
            />

            {/* Show all market type balances */}
            <div className="mt-3 pt-3 border-t border-gunmetal-700">
              <h4 className="text-xs text-gray-400 mb-2">All Market Type Balances:</h4>
              <div className="space-y-1">
                {Object.entries(marketBalances).map(([type, balance]) => (
                  balance && (
                    <div key={type} className="flex justify-between items-center">
                      <span className="text-xs text-gray-400 capitalize">{type}:</span>
                      <AnimatedValue
                        value={balance.free}
                        className={`text-xs font-medium ${type === marketType ? 'text-neon-turquoise' : 'text-white'}`}
                      />
                    </div>
                  )
                ))}
                {Object.keys(marketBalances).length === 0 && (
                  <div className="text-xs text-gray-500 text-center">No market balances available</div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Total Budget
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="number"
                value={totalBudget}
                onChange={handleBudgetChange}
                className="pl-10 w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                min={0}
                max={maxBudget || 0}
                step={0.01}
                required
                disabled={isSubmitting || isProcessing}
              />
            </div>
            <p className="mt-1 text-sm text-gray-400">
              Maximum allowed: ${(maxBudget || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
              disabled={isSubmitting || isProcessing}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300 disabled:opacity-50"
            >
              {isSubmitting || isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting Strategy...
                </>
              ) : (
                'Confirm Budget'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
