import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Strategy, StrategyBudget } from '../lib/types';
import { walletBalanceService } from '../lib/wallet-balance-service';

interface BudgetConfirmModalProps {
  strategy: Strategy;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (budget: StrategyBudget) => void;
}

export const BudgetConfirmModal: React.FC<BudgetConfirmModalProps> = ({
  strategy,
  isOpen,
  onClose,
  onConfirm
}) => {
  const [budgetAmount, setBudgetAmount] = useState<number>(100);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Get available balance when modal opens
  useEffect(() => {
    if (isOpen) {
      const balance = walletBalanceService.getAvailableBalance();
      setAvailableBalance(balance);

      // Set default budget to 10% of available balance or $100, whichever is lower
      const defaultBudget = Math.min(balance * 0.1, 100);
      setBudgetAmount(defaultBudget);
    }
  }, [isOpen]);

  // Handle budget change
  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setBudgetAmount(value);

    // Validate budget
    if (value <= 0) {
      setError('Budget must be greater than 0');
    } else if (value > availableBalance) {
      setError('Budget cannot exceed available balance');
    } else {
      setError(null);
    }
  };

  // Calculate position sizing based on risk level
  // Handle both riskLevel and risk_level properties
  const riskLevel = strategy?.riskLevel || (strategy as any)?.risk_level || 'Medium';

  // Define position size multipliers for each risk level
  const riskMultipliers = {
    'Ultra Low': 0.05,
    'Low': 0.1,
    'Medium': 0.15,
    'High': 0.2,
    'Ultra High': 0.25,
    'Extreme': 0.3,
    'God Mode': 0.5
  };

  // Get the multiplier for the current risk level, with a fallback to Medium (0.15)
  const positionSizeMultiplier = riskMultipliers[riskLevel as keyof typeof riskMultipliers] || 0.15;

  // Handle confirm
  const handleConfirm = () => {
    if (error) return;

    // Log for debugging
    console.log('Budget confirmation:', {
      strategy,
      riskLevel,
      positionSizeMultiplier,
      budgetAmount
    });

    // Create a budget object with the position size multiplier
    const budget: StrategyBudget = {
      total: budgetAmount,
      allocated: 0,
      available: budgetAmount,
      maxPositionSize: budgetAmount * positionSizeMultiplier,
      lastUpdated: Date.now()
    };

    // Pass the budget object to the onConfirm function
    onConfirm(budget);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Set Trading Budget</h3>
          <button
            className="text-gray-400 hover:text-white"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-300 mb-4">
            Set the budget for <span className="font-semibold">{strategy.title}</span>
          </p>

          <div className="bg-gray-700/50 p-3 rounded-lg mb-4">
            <h4 className="text-sm text-gray-400">Available Balance</h4>
            <p className="text-lg font-semibold">${availableBalance.toFixed(2)}</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">
              Trading Budget
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                value={budgetAmount}
                onChange={handleBudgetChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 pl-8 pr-3 text-white"
                min={0}
                max={availableBalance}
                step={1}
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm mt-1">{error}</p>
            )}
          </div>

          <div className="bg-gray-700/50 p-3 rounded-lg">
            <h4 className="text-sm text-gray-400">Risk Level</h4>
            <p className="text-lg font-semibold">{riskLevel}</p>
            <p className="text-xs text-gray-400 mt-1">
              {getRiskDescription(riskLevel)}
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            className="px-4 py-2 bg-gray-700 text-white rounded-md"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-pink-500 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleConfirm}
            disabled={!!error || budgetAmount <= 0}
          >
            Confirm Budget
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function to get risk description
function getRiskDescription(riskLevel: string): string {
  switch (riskLevel) {
    case 'Ultra Low':
      return 'Very conservative approach with minimal risk';
    case 'Low':
      return 'Conservative approach with low risk';
    case 'Medium':
      return 'Balanced approach with moderate risk';
    case 'High':
      return 'Aggressive approach with significant risk';
    case 'Ultra High':
      return 'Very aggressive approach with high risk';
    case 'Extreme':
      return 'Extremely aggressive approach with very high risk';
    case 'God Mode':
      return 'Maximum risk with potential for extreme volatility';
    default:
      return 'Unknown risk level';
  }
}
