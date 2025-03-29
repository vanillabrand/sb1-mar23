import React, { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, Loader2, Coins, Wallet } from 'lucide-react';
import { exchangeService } from '../lib/exchange-service';
import { logService } from '../lib/log-service';
import type { StrategyBudget } from '../lib/types';

interface BudgetModalProps {
  onConfirm: (budget: StrategyBudget) => Promise<void>;
  onCancel: () => void;
  maxBudget: number;
  riskLevel: string;
  isSubmitting?: boolean;
  initialBudget?: StrategyBudget;
  isEditing?: boolean;
}

export function BudgetModal({
  onConfirm,
  onCancel,
  maxBudget = 0, // Provide default value
  riskLevel,
  isSubmitting = false,
  initialBudget,
  isEditing = false
}: BudgetModalProps) {
  const [totalBudget, setTotalBudget] = useState<number>(
    initialBudget?.total || Math.min((maxBudget || 0) * 0.1, maxBudget || 0)
  );
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [marketBalance, setMarketBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);

  useEffect(() => {
    loadMarketBalance();
  }, []);

  const loadMarketBalance = async () => {
    try {
      setLoadingBalance(true);
      // Determine market type based on risk level
      const marketType =
        riskLevel === 'High' ||
        riskLevel === 'Ultra High' ||
        riskLevel === 'Extreme' ||
        riskLevel === 'God Mode'
          ? 'futures'
          : riskLevel === 'Medium'
          ? 'margin'
          : 'spot';
      // Get balance for market type
      const balance = await exchangeService.fetchBalance(marketType);
      const availableBalance = Number((balance?.available || 0).toFixed(2));
      setMarketBalance(availableBalance);
      // Set initial budget if not editing
      if (!isEditing) {
        setTotalBudget(
          Number(Math.min(availableBalance * 0.1, maxBudget || 0).toFixed(2))
        );
      }
    } catch (error) {
      logService.log(
        'error',
        'Failed to load market balance',
        error,
        'BudgetModal'
      );
      setMarketBalance(maxBudget || 0);
      if (!isEditing) {
        setTotalBudget(Number(((maxBudget || 0) * 0.1).toFixed(2)));
      }
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleBudgetChange = (value: string) => {
    const parsedValue = parseFloat(value);
    if (!isNaN(parsedValue)) {
      setTotalBudget(Number(parsedValue.toFixed(2)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      setIsProcessing(true);
      logService.log('info', 'Submitting budget form', { totalBudget, riskLevel }, 'BudgetModal');

      if (isNaN(totalBudget) || totalBudget <= 0) {
        throw new Error('Budget must be greater than 0');
      }
      if (totalBudget > maxBudget) {
        throw new Error(`Budget cannot exceed ${maxBudget}`);
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
      await onConfirm(budget);
      logService.log('info', 'Budget confirmed successfully', { budget }, 'BudgetModal');
      
      // Close modal after successful confirmation
      onCancel();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid configuration';
      setError(errorMessage);
      logService.log('error', 'Budget confirmation error', error, 'BudgetModal');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-lg p-6 w-full max-w-md border border-gunmetal-800">
        <h2 className="text-xl font-bold gradient-text mb-4">
          {isEditing ? 'Edit Strategy Budget' : 'Set Strategy Budget'}
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
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="w-5 h-5 text-neon-turquoise" />
              <h3 className="text-sm font-medium text-gray-300">
                Available Balance
              </h3>
            </div>
            {loadingBalance ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading balance...
              </div>
            ) : (
              <p className="text-2xl font-bold text-neon-turquoise">
                ${(marketBalance || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
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
                onChange={(e) => handleBudgetChange(e.target.value)}
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
                  {isEditing ? 'Updating Budget...' : 'Starting Strategy...'}
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
