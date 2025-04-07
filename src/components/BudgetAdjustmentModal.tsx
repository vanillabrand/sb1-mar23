import React, { useState } from 'react';
import { AlertCircle, DollarSign, Wallet, Loader2 } from 'lucide-react';
import { logService } from '../lib/log-service';
import { demoService } from '../lib/demo-service';
import type { StrategyBudget, Strategy, RiskLevel } from '../lib/types';

interface BudgetAdjustmentModalProps {
  strategy: Strategy;
  requestedBudget: number;
  availableBalance: number;
  onConfirm: (budget: StrategyBudget) => Promise<void>;
  onCancel: () => void;
  riskLevel?: RiskLevel;
}

export function BudgetAdjustmentModal({
  strategy,
  requestedBudget,
  availableBalance,
  onConfirm,
  onCancel,
  riskLevel = 'Medium'
}: BudgetAdjustmentModalProps) {
  const [adjustedBudget, setAdjustedBudget] = useState<number>(availableBalance);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsedValue = parseFloat(e.target.value);
    if (!isNaN(parsedValue)) {
      setAdjustedBudget(Number(parsedValue.toFixed(2)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError(null);
      setIsSubmitting(true);

      if (isNaN(adjustedBudget) || adjustedBudget <= 0) {
        throw new Error('Please enter a valid budget amount');
      }

      if (adjustedBudget > availableBalance) {
        throw new Error('Budget cannot exceed available balance');
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
        total: Number(adjustedBudget.toFixed(2)),
        allocated: 0,
        available: Number(adjustedBudget.toFixed(2)),
        maxPositionSize: Number((adjustedBudget * positionSizeMultiplier).toFixed(2))
      };

      logService.log('info', 'Confirming adjusted budget', { budget, strategy: strategy.id }, 'BudgetAdjustmentModal');
      await onConfirm(budget);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to set budget');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-lg p-6 w-full max-w-md border border-gunmetal-800">
        <h2 className="text-xl font-bold gradient-text mb-4">
          Insufficient Balance
        </h2>

        <div className="mb-6 p-4 bg-gunmetal-800/50 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-neon-orange mt-0.5" />
          <div>
            <p className="text-gray-300">
              {demoService.isInDemoMode()
                ? "Your TestNet balance is too low for the requested budget."
                : "Your wallet balance is insufficient for the requested budget."}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Requested: <span className="text-neon-yellow">${requestedBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <br />
              Available: <span className="text-neon-turquoise">${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Adjust Budget Amount
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="number"
                value={adjustedBudget}
                onChange={handleBudgetChange}
                className="pl-10 w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                min={0.01}
                max={availableBalance}
                step={0.01}
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Quick select buttons */}
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setAdjustedBudget(Number((availableBalance * 0.05).toFixed(2)))}
                className="flex-1 py-1 px-2 text-xs bg-gunmetal-800 hover:bg-gunmetal-700 text-neon-green border border-neon-green/30 rounded transition-colors"
                disabled={isSubmitting}
              >
                5%
              </button>
              <button
                type="button"
                onClick={() => setAdjustedBudget(Number((availableBalance * 0.1).toFixed(2)))}
                className="flex-1 py-1 px-2 text-xs bg-gunmetal-800 hover:bg-gunmetal-700 text-neon-yellow border border-neon-yellow/30 rounded transition-colors"
                disabled={isSubmitting}
              >
                10%
              </button>
              <button
                type="button"
                onClick={() => setAdjustedBudget(Number((availableBalance * 0.2).toFixed(2)))}
                className="flex-1 py-1 px-2 text-xs bg-gunmetal-800 hover:bg-gunmetal-700 text-neon-orange border border-neon-orange/30 rounded transition-colors"
                disabled={isSubmitting}
              >
                20%
              </button>
              <button
                type="button"
                onClick={() => setAdjustedBudget(Number((availableBalance * 0.5).toFixed(2)))}
                className="flex-1 py-1 px-2 text-xs bg-gunmetal-800 hover:bg-gunmetal-700 text-neon-raspberry border border-neon-raspberry/30 rounded transition-colors"
                disabled={isSubmitting}
              >
                50%
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-400">
              Maximum allowed: ${availableBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>

          <div className="flex justify-between gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdjustedBudget(availableBalance)}
                className="px-4 py-2 bg-gunmetal-800 text-neon-turquoise border border-neon-turquoise/30 rounded-lg hover:bg-gunmetal-700 transition-colors text-sm font-medium"
                disabled={isSubmitting}
              >
                Use Maximum
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Budget'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
