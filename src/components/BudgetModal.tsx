import React, { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, Loader2, Wallet, RefreshCw } from 'lucide-react';
import { logService } from '../lib/log-service';
import { walletBalanceService } from '../lib/wallet-balance-service';
import { MultiWalletBalanceDisplay } from './MultiWalletBalanceDisplay';
import type { StrategyBudget, Strategy, RiskLevel } from '../lib/types';

interface BudgetModalProps {
  onConfirm: (budget: StrategyBudget) => Promise<void>;
  onCancel?: () => void;
  onClose?: () => void;
  maxBudget?: number;
  isSubmitting?: boolean;
  initialBudget?: StrategyBudget;
  strategy?: Strategy;
  riskLevel?: RiskLevel;
}

export function BudgetModal({ onConfirm, onCancel, onClose, maxBudget = 10000, isSubmitting = false, initialBudget, strategy, riskLevel = 'Medium' }: BudgetModalProps) {
  const [totalBudget, setTotalBudget] = useState<number>(
    initialBudget?.total || Math.min((maxBudget || 0) * 0.1, maxBudget || 0)
  );
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [availableBalance, setAvailableBalance] = useState<number>(maxBudget);

  // Initialize wallet balance service and fetch balances
  useEffect(() => {
    const initializeBalances = async () => {
      try {
        setIsLoadingBalance(true);
        // Initialize wallet balance service if not already initialized
        if (!walletBalanceService.getLastUpdated()) {
          await walletBalanceService.initialize();
        }

        // Get the available balance
        const balance = walletBalanceService.getAvailableBalance();
        setAvailableBalance(balance);

        // If initial budget is not set, use 10% of available balance
        if (!initialBudget) {
          setTotalBudget(Math.min(balance * 0.1, balance));
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
      const balance = walletBalanceService.getAvailableBalance();
      setAvailableBalance(balance);
    };

    walletBalanceService.on('balancesUpdated', handleBalanceUpdate);

    return () => {
      walletBalanceService.off('balancesUpdated', handleBalanceUpdate);
    };
  }, [initialBudget, maxBudget]);

  // Use the fetched available balance
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
      await walletBalanceService.refreshBalances();
      const balance = walletBalanceService.getAvailableBalance();
      setAvailableBalance(balance);
    } catch (error) {
      logService.log('error', 'Failed to refresh wallet balance', error, 'BudgetModal');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError(null);
      setIsProcessing(true);

      const budgetAmount = totalBudget;
      if (isNaN(budgetAmount) || budgetAmount <= 0) {
        throw new Error('Please enter a valid budget amount');
      }

      // Validate budget against available balance
      if (budgetAmount > availableBalance) {
        throw new Error(`Budget exceeds available balance of $${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
      }

      // Calculate position sizing based on risk level
      const positionSizeMultiplier =
        {
          'Ultra Low': 0.05,
          'Low': 0.1,
          'Medium': 0.15,
          'High': 0.2,
          'Ultra High': 0.25,
          'Extreme': 0.3,
          'God Mode': 0.5,
        }[riskLevel] || 0.15;

      const budget: StrategyBudget = {
        total: Number(totalBudget.toFixed(2)),
        allocated: 0,
        available: Number(totalBudget.toFixed(2)),
        maxPositionSize: Number((totalBudget * positionSizeMultiplier).toFixed(2))
      };

      logService.log('info', 'Confirming budget', { budget }, 'BudgetModal');

      // Call onConfirm but don't wait for it to complete
      // This allows the modal to close even if the activation process takes a long time or fails
      onConfirm(budget).catch(error => {
        logService.log('error', 'Error in budget confirmation (caught in modal)', error, 'BudgetModal');
      });

      // Close the modal immediately
      if (onCancel) onCancel();
      else if (onClose) onClose();

      logService.log('info', 'Budget confirmed successfully', { budget }, 'BudgetModal');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to set budget');
      setIsProcessing(false);
    }
  };

  const getRiskBadgeColor = (risk: RiskLevel) => {
    switch (risk) {
      case 'Low':
        return 'bg-neon-green/20 text-neon-green';
      case 'Medium':
        return 'bg-neon-yellow/20 text-neon-yellow';
      case 'High':
        return 'bg-neon-orange/20 text-neon-orange';
      case 'Very High':
        return 'bg-neon-raspberry/20 text-neon-raspberry';
      default:
        return 'bg-neon-yellow/20 text-neon-yellow';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto"
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
          {/* Multi-Wallet Balance Display */}
          <div className="mb-4">
            <MultiWalletBalanceDisplay compact={true} showRefreshButton={true} />
          </div>

          {/* Recommended budget based on available balance */}
          <div className="mt-3 pt-3 border-t border-gunmetal-700">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-400">Recommended (10%):</p>
              <p className="text-sm font-medium text-neon-yellow">
                ${(marketBalance * 0.1).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="flex justify-between items-center mt-1">
              <p className="text-sm text-gray-400">Conservative (5%):</p>
              <p className="text-sm font-medium text-neon-green">
                ${(marketBalance * 0.05).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="flex justify-between items-center mt-1">
              <p className="text-sm text-gray-400">Aggressive (20%):</p>
              <p className="text-sm font-medium text-neon-orange">
                ${(marketBalance * 0.2).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
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

            {/* Quick select buttons */}
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setTotalBudget(Number((marketBalance * 0.05).toFixed(2)))}
                className="flex-1 py-1 px-2 text-xs bg-gunmetal-800 hover:bg-gunmetal-700 text-neon-green border border-neon-green/30 rounded transition-colors"
                disabled={isSubmitting || isProcessing}
              >
                5%
              </button>
              <button
                type="button"
                onClick={() => setTotalBudget(Number((marketBalance * 0.1).toFixed(2)))}
                className="flex-1 py-1 px-2 text-xs bg-gunmetal-800 hover:bg-gunmetal-700 text-neon-yellow border border-neon-yellow/30 rounded transition-colors"
                disabled={isSubmitting || isProcessing}
              >
                10%
              </button>
              <button
                type="button"
                onClick={() => setTotalBudget(Number((marketBalance * 0.2).toFixed(2)))}
                className="flex-1 py-1 px-2 text-xs bg-gunmetal-800 hover:bg-gunmetal-700 text-neon-orange border border-neon-orange/30 rounded transition-colors"
                disabled={isSubmitting || isProcessing}
              >
                20%
              </button>
              <button
                type="button"
                onClick={() => setTotalBudget(Number((marketBalance * 0.5).toFixed(2)))}
                className="flex-1 py-1 px-2 text-xs bg-gunmetal-800 hover:bg-gunmetal-700 text-neon-raspberry border border-neon-raspberry/30 rounded transition-colors"
                disabled={isSubmitting || isProcessing}
              >
                50%
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-400">
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
