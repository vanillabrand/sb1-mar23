import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  AlertCircle,
  Plus,
  Loader2
} from 'lucide-react';
import { useStrategies } from '../hooks/useStrategies';
import { BudgetModal } from './BudgetModal';
import { tradeService } from '../lib/trade-service';
import { logService } from '../lib/log-service';
import type { Strategy } from '../lib/supabase-types';
import type { StrategyBudget } from '../lib/types';

const BudgetManager = () => {
  const { strategies } = useStrategies();
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingStrategy, setPendingStrategy] = useState<Strategy | null>(null);
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);

  const handleBudgetConfirm = async (budget: StrategyBudget) => {
    if (!selectedStrategy && !pendingStrategy) return;
    
    try {
      setError(null);
      setIsSubmittingBudget(true);
      const strategy = pendingStrategy || strategies.find(s => s.id === selectedStrategy);
      if (!strategy) throw new Error('Strategy not found');

      // First set the budget
      await tradeService.setBudget(strategy.id, budget);

      setShowBudgetModal(false);
      setSelectedStrategy(null);
      setPendingStrategy(null);

      logService.log('info', `Strategy ${strategy.id} budget set`, { budget }, 'BudgetManager');
    } catch (error) {
      logService.log('error', 'Failed to set strategy budget', error, 'BudgetManager');
      setError('Failed to set budget. Please try again.');
      
      // Clean up on failure
      if (selectedStrategy) {
        await tradeService.setBudget(selectedStrategy, null);
      }
    } finally {
      setIsSubmittingBudget(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Section Description */}
      <div className="bg-gunmetal-800/20 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-neon-raspberry" />
          <div>
            <h2 className="text-xl font-bold gradient-text">Budget Manager</h2>
            <p className="text-sm text-gray-400">
              Allocate and manage trading budgets for your strategies.
            </p>
          </div>
        </div>
      </div>

      {/* Strategy List */}
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold gradient-text">Strategy Budgets</h2>
          <button
            onClick={() => {
              if (strategies.length > 0) {
                setSelectedStrategy(strategies[0].id);
                setShowBudgetModal(true);
              }
            }}
            disabled={strategies.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-neon-raspberry text-white rounded-lg hover:bg-[#FF69B4] transition-all duration-300 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Allocate Budget
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {strategies.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-neon-yellow mx-auto mb-4" />
            <p className="text-xl text-gray-200 mb-2">No Strategies Found</p>
            <p className="text-gray-400">Create a strategy to start managing budgets</p>
          </div>
        ) : (
          <div className="space-y-4">
            {strategies.map((strategy) => {
              const budget = tradeService.getBudget(strategy.id);
              return (
                <motion.div
                  key={strategy.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gunmetal-800/30 rounded-lg p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-200">{strategy.title}</h3>
                      <p className="text-sm text-gray-400">{strategy.description}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedStrategy(strategy.id);
                        setShowBudgetModal(true);
                      }}
                      className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300"
                    >
                      {budget ? 'Update Budget' : 'Set Budget'}
                    </button>
                  </div>

                  {budget && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                        <p className="text-xs text-gray-400">Total Budget</p>
                        <p className="text-lg font-semibold text-gray-200">
                          ${budget.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                        <p className="text-xs text-gray-400">Allocated</p>
                        <p className="text-lg font-semibold text-neon-orange">
                          ${budget.allocated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                        <p className="text-xs text-gray-400">Available</p>
                        <p className="text-lg font-semibold text-neon-turquoise">
                          ${budget.available.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Budget Modal */}
      {showBudgetModal && (
        <BudgetModal
          onConfirm={handleBudgetConfirm}
          onCancel={() => {
            setShowBudgetModal(false);
            setSelectedStrategy(null);
            setPendingStrategy(null);
          }}
          maxBudget={tradeService.calculateAvailableBudget()}
          riskLevel={
            selectedStrategy 
              ? strategies.find(s => s.id === selectedStrategy)?.risk_level || 'Medium'
              : pendingStrategy?.risk_level || 'Medium'
          }
          isSubmitting={isSubmittingBudget}
        />
      )}
    </div>
  );
};

export default BudgetManager;