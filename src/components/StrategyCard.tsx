import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, Power, Settings, Loader2, Edit, Trash2, AlertCircle } from 'lucide-react';
import { strategyService } from '../lib/strategy-service';
import { tradeService } from '../lib/trade-service';
import { marketService } from '../lib/market-service';
import { tradeGenerator } from '../lib/trade-generator';
import { tradeEngine } from '../lib/trade-engine';
import { logService } from '../lib/log-service';
import { strategyMonitor } from '../lib/strategy-monitor';
import { demoService } from '../lib/demo-service';
import { BudgetModal } from './BudgetModal';
import { EditStrategyModal } from './EditStrategyModal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import type { Strategy, StrategyBudget } from '../lib/types';

interface StrategyCardProps {
  strategy: Strategy;
  onRefresh?: () => void;
  onEdit?: (strategy: Strategy) => void;
  onDelete?: (strategy: Strategy) => void;
}

export function StrategyCard({ strategy, onRefresh, onEdit, onDelete }: StrategyCardProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

  const handleActivate = async () => {
    try {
      setIsActivating(true);
      setError(null);

      // Check if budget is already set
      const budget = await tradeService.getBudget(strategy.id);

      if (!budget) {
        // If no budget, show budget modal
        setSelectedStrategy(strategy);
        setShowBudgetModal(true);
        return;
      }

      // If budget exists, proceed with full activation
      await activateStrategyWithBudget(strategy, budget);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to activate strategy';
      setError(errorMessage);
      logService.log('error', 'Failed to activate strategy', error, 'StrategyCard');
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      setIsDeactivating(true);
      setError(null);

      // Deactivate strategy in database
      await strategyService.deactivateStrategy(strategy.id);

      // Remove from monitoring services
      await marketService.stopStrategyMonitoring(strategy.id);
      tradeGenerator.removeStrategy(strategy.id);
      strategyMonitor.removeStrategy(strategy.id);
      await tradeEngine.removeStrategy(strategy.id);

      // Refresh data
      onRefresh?.();

      logService.log('info', `Strategy ${strategy.id} deactivated`, null, 'StrategyCard');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate strategy';
      setError(errorMessage);
      logService.log('error', 'Failed to deactivate strategy', error, 'StrategyCard');
    } finally {
      setIsDeactivating(false);
    }
  };

  const activateStrategyWithBudget = async (strategy: Strategy, budget: StrategyBudget) => {
    try {
      // Initialize demo mode first to ensure ccxtService is ready
      if (demoService.isInDemoMode()) {
        logService.log('info', 'Using demo mode for strategy activation', { strategyId: strategy.id }, 'StrategyCard');
      }

      // 1. Activate strategy in database
      await strategyService.activateStrategy(strategy.id);

      try {
        // 2. Start market monitoring - wrapped in try/catch to prevent errors
        await marketService.startStrategyMonitoring(strategy);
      } catch (marketError) {
        logService.log('warn', 'Error starting market monitoring, continuing with activation',
          marketError, 'StrategyCard');
      }

      try {
        // 3. Add strategy to trade generator
        await tradeGenerator.addStrategy(strategy);
      } catch (generatorError) {
        logService.log('warn', 'Error adding strategy to trade generator, continuing with activation',
          generatorError, 'StrategyCard');
      }

      try {
        // 4. Initialize strategy monitoring
        await strategyMonitor.addStrategy(strategy);
      } catch (monitorError) {
        logService.log('warn', 'Error adding strategy to monitor, continuing with activation',
          monitorError, 'StrategyCard');
      }

      try {
        // 5. Start trade engine monitoring
        await tradeEngine.addStrategy(strategy);
      } catch (engineError) {
        logService.log('warn', 'Error adding strategy to trade engine, continuing with activation',
          engineError, 'StrategyCard');
      }

      // 6. Refresh data
      onRefresh?.();

      logService.log('info', `Strategy ${strategy.id} activated with budget`,
        { strategyId: strategy.id, budgetAmount: budget.total }, 'StrategyCard');

    } catch (error) {
      logService.log('error', 'Failed to activate strategy with budget', error, 'StrategyCard');
      throw error;
    }
  };

  const handleBudgetSubmit = async (budgetAmount: number) => {
    if (!selectedStrategy) return;

    try {
      setIsSubmittingBudget(true);
      setError(null);

      const budget: StrategyBudget = {
        total: budgetAmount,
        allocated: 0,
        available: budgetAmount,
        maxPositionSize: budgetAmount * 0.1 // Default to 10% of total budget
      };

      await tradeService.setBudget(selectedStrategy.id, budget);
      await activateStrategyWithBudget(selectedStrategy, budget);

      // Important: Close the modal first before any potential errors in the refresh
      setShowBudgetModal(false);
      setSelectedStrategy(null);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to activate strategy';
      setError(errorMessage);
      logService.log('error', 'Failed to activate strategy with budget', error, 'StrategyCard');

      if (selectedStrategy) {
        try {
          await tradeService.setBudget(selectedStrategy.id, null);
        } catch (cleanupError) {
          logService.log('error', 'Failed to clean up budget after activation failure',
            cleanupError, 'StrategyCard');
        }
      }
    } finally {
      setIsSubmittingBudget(false);
    }
  };

  return (
    <>
      <motion.div
        className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-6 shadow-lg border border-gunmetal-800/50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gunmetal-900/50 text-neon-raspberry">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-200">{strategy.title}</h3>
            <span className="text-sm text-gray-400">{strategy.riskLevel} Risk</span>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-4">{strategy.description}</p>

        <div className="flex items-center justify-between mt-4">
          <div className="text-sm">
            <span className="text-gray-400">Performance: </span>
            <span className="text-neon-turquoise">{strategy.performance}%</span>
          </div>

          {error && (
            <div className="text-red-400 text-sm mb-2">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gunmetal-800/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit?.(strategy)}
              className="p-2 text-gray-400 hover:text-neon-turquoise transition-colors"
              title="Edit Strategy"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Delete Strategy"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div>
            {strategy.status === 'active' ? (
              <button
                onClick={handleDeactivate}
                disabled={isDeactivating}
                className="px-4 py-2 bg-gunmetal-800 text-gray-300 rounded-lg hover:bg-gunmetal-700 transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeactivating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deactivating...
                  </>
                ) : (
                  'Deactivate'
                )}
              </button>
            ) : (
              <button
                onClick={handleActivate}
                disabled={isActivating}
                className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Activating...
                  </>
                ) : (
                  'Activate'
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Add Budget Modal */}
      {showBudgetModal && selectedStrategy && (
        <BudgetModal
          onConfirm={handleBudgetSubmit}
          onCancel={() => {
            setShowBudgetModal(false);
            setSelectedStrategy(null);
          }}
          maxBudget={10000} // Replace with actual max budget calculation
          isSubmitting={isSubmittingBudget}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Strategy"
          message={`Are you sure you want to delete the strategy "${strategy.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          confirmVariant="destructive"
          onConfirm={() => {
            setShowDeleteConfirm(false);
            onDelete?.(strategy);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
