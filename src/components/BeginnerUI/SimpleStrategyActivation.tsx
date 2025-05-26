import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Shield, DollarSign, Check, AlertTriangle, X } from 'lucide-react';
import { strategyService } from '../../lib/strategy-service';
import { tradeService } from '../../lib/trade-service';
import { logService } from '../../lib/log-service';
import { supabase } from '../../lib/enhanced-supabase';
import type { Strategy } from '../../lib/types';

interface SimpleStrategyActivationProps {
  strategy: Strategy;
  onComplete: (success: boolean) => void;
  onCancel: () => void;
  onActivated?: (activatedStrategy: Strategy) => void;
  maxBudget?: number;
}

export function SimpleStrategyActivation({
  strategy,
  onComplete,
  onCancel,
  onActivated,
  maxBudget = 10000
}: SimpleStrategyActivationProps) {
  const [budget, setBudget] = useState<number>(250); // Default budget
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Predefined budget options for beginners
  const budgetOptions = [
    { amount: 100, label: 'Conservative', description: 'Start small and safe' },
    { amount: 250, label: 'Recommended', description: 'Balanced approach' },
    { amount: 500, label: 'Aggressive', description: 'Higher potential returns' }
  ];

  const handleActivate = async () => {
    try {
      setIsActivating(true);
      setError(null);

      logService.log('info', `Starting simple strategy activation for ${strategy.id}`, {
        budget,
        strategyName: strategy.name
      }, 'SimpleStrategyActivation');

      // Set budget with automated settings
      const strategyBudget = {
        total: budget,
        allocated: 0,
        available: budget,
        maxPositionSize: budget * 0.2, // 20% max position size for beginners
        lastUpdated: Date.now(),
        profit: 0,
        marketType: 'spot' as const
      };

      await tradeService.setBudget(strategy.id, strategyBudget);

      // Activate the strategy using direct database update
      const { data: activatedStrategy, error: activationError } = await supabase
        .from('strategies')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', strategy.id)
        .select()
        .single();

      if (activationError) {
        throw activationError;
      }

      if (!activatedStrategy) {
        throw new Error('Failed to activate strategy - no data returned');
      }

      logService.log('info', 'Simple strategy activation completed successfully', {
        strategyId: strategy.id,
        budget,
        status: activatedStrategy.status
      }, 'SimpleStrategyActivation');

      // Call the onActivated callback with the updated strategy
      if (onActivated) {
        onActivated(activatedStrategy as Strategy);
      }

      setIsActivating(false);
      onComplete(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to activate strategy';
      setError(errorMessage);
      setIsActivating(false);
      logService.log('error', `Simple strategy activation failed: ${errorMessage}`, error, 'SimpleStrategyActivation');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-gunmetal-900 border border-gunmetal-700 rounded-xl p-6 w-full max-w-md shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold gradient-text">
              Activate Strategy
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {strategy.name}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isActivating}
            className="p-2 hover:bg-gunmetal-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Budget Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-3">Choose Your Budget</h3>
          <p className="text-sm text-gray-400 mb-4">
            How much would you like to allocate to this strategy?
          </p>

          <div className="grid grid-cols-1 gap-3 mb-4">
            {budgetOptions.map((option) => (
              <button
                key={option.amount}
                onClick={() => setBudget(option.amount)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  budget === option.amount
                    ? 'border-neon-turquoise bg-neon-turquoise/10'
                    : 'border-gunmetal-700 hover:border-gunmetal-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg">${option.amount}</div>
                    <div className="text-sm text-gray-400">{option.description}</div>
                  </div>
                  <div className="text-xs text-neon-turquoise font-medium">
                    {option.label}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label htmlFor="custom-budget" className="block text-sm font-medium text-gray-300">
              Or enter a custom amount
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                id="custom-budget"
                type="number"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="pl-10 w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                min={50}
                max={maxBudget}
                step={10}
                disabled={isActivating}
              />
            </div>
            <p className="text-xs text-gray-500">
              Minimum: $50 • Maximum: ${maxBudget.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Protection Features */}
        <div className="mb-6 p-4 bg-gunmetal-800 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-neon-green" />
            <h4 className="font-bold text-neon-green">Your Investment is Protected</h4>
          </div>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-neon-green" />
              <span>Automatic stop-losses limit your risk</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-neon-green" />
              <span>Smart position sizing (max 20% per trade)</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-neon-green" />
              <span>You can pause or stop anytime</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isActivating}
            className="flex-1 px-4 py-2 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleActivate}
            disabled={isActivating || budget < 50}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-neon-turquoise text-white rounded-lg hover:bg-neon-yellow transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {isActivating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Activating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Start Trading
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
