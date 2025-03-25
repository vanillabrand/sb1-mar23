import React, { useState, useEffect } from 'react';
import { DollarSign, Save, X, AlertCircle, Loader2 } from 'lucide-react';
import { tradeService } from '../lib/trade-service';
import { exchangeService } from '../lib/exchange-service';
import { logService } from '../lib/log-service';
import type { Strategy } from '../lib/supabase-types';
import type { StrategyBudget } from '../lib/types';

interface BudgetControlProps {
  strategy: Strategy;
  onSave: () => void;
}

export function BudgetControl({ strategy, onSave }: BudgetControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [budget, setBudget] = useState<number>(0);
  const [maxBudget, setMaxBudget] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBudgetData();
  }, [strategy.id]);

  const loadBudgetData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current budget
      const currentBudget = tradeService.getBudget(strategy.id);
      
      // Get available balance based on market type
      const balance = await exchangeService.fetchBalance();
      const availableBalance = balance.available;

      setBudget(currentBudget?.total || availableBalance);
      setMaxBudget(availableBalance);
    } catch (error) {
      logService.log('error', `Error loading budget data for strategy ${strategy.id}`, error, 'BudgetControl');
      setError('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (budget <= 0) {
        throw new Error('Budget must be greater than 0');
      }

      if (budget > maxBudget) {
        throw new Error(`Budget cannot exceed ${maxBudget}`);
      }

      // Calculate position sizing based on risk level
      const positionSizeMultiplier = {
        'Ultra Low': 0.05,
        'Low': 0.1,
        'Medium': 0.15,
        'High': 0.2,
        'Ultra High': 0.25,
        'Extreme': 0.3,
        'God Mode': 0.5
      }[strategy.risk_level] || 0.15;

      const newBudget: StrategyBudget = {
        total: budget,
        allocated: 0,
        available: budget,
        maxPositionSize: budget * positionSizeMultiplier
      };

      await tradeService.setBudget(strategy.id, newBudget);
      setIsEditing(false);
      onSave();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-12">
        <Loader2 className="w-5 h-5 text-neon-turquoise animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative">
      {isEditing ? (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(parseFloat(e.target.value))}
              className="w-full pl-9 pr-4 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
              placeholder="Enter budget amount"
              min="0"
              max={maxBudget}
              step="0.01"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-2 text-neon-turquoise hover:text-neon-yellow transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="p-2 text-gray-400 hover:text-neon-pink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Budget</p>
            <p className="text-lg font-mono">
              ${budget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="text-gray-400 hover:text-neon-turquoise transition-colors"
          >
            <DollarSign className="w-5 h-5" />
          </button>
        </div>
      )}

      {error && (
        <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-neon-pink/10 border border-neon-pink/20 rounded-lg text-sm text-neon-pink flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}