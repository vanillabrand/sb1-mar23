import React, { useState, useEffect } from 'react';
import { tradeService } from '../lib/trade-service';
import { demoService } from '../lib/demo-service';
import { logService } from '../lib/log-service';
import { eventBus } from '../lib/event-bus';
import type { StrategyBudget } from '../lib/types';

interface BudgetDebuggerProps {
  strategyId: string;
}

export const BudgetDebugger: React.FC<BudgetDebuggerProps> = ({ strategyId }) => {
  const [budget, setBudget] = useState<StrategyBudget | null>(null);
  const [customBudget, setCustomBudget] = useState<number>(1000);
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Check if we're in demo mode
    setIsDemo(demoService.isInDemoMode());

    // Get the current budget
    const currentBudget = tradeService.getBudget(strategyId);

    if (currentBudget) {
      // Ensure all required budget properties exist
      const safetyBudget = {
        total: currentBudget.total || 0,
        allocated: currentBudget.allocated || 0,
        available: currentBudget.available || 0,
        maxPositionSize: currentBudget.maxPositionSize || 0,
        profit: currentBudget.profit || 0,
        allocationPercentage: currentBudget.allocationPercentage || 0,
        profitPercentage: currentBudget.profitPercentage || 0
      };
      setBudget(safetyBudget);
    } else {
      setBudget(null);
    }

    // Log for debugging
    logService.log('info', `BudgetDebugger initialized for strategy ${strategyId}`,
      { budget: currentBudget, isDemo: demoService.isInDemoMode() },
      'BudgetDebugger');

    // Subscribe to budget updates
    const handleBudgetUpdate = (data: any) => {
      if (data.strategyId === strategyId && data.budget) {
        // Ensure all required budget properties exist
        const safetyBudget = {
          total: data.budget.total || 0,
          allocated: data.budget.allocated || 0,
          available: data.budget.available || 0,
          maxPositionSize: data.budget.maxPositionSize || 0,
          profit: data.budget.profit || 0,
          allocationPercentage: data.budget.allocationPercentage || 0,
          profitPercentage: data.budget.profitPercentage || 0
        };

        setBudget(safetyBudget);
        logService.log('info', `Budget updated for strategy ${strategyId}`,
          { budget: safetyBudget },
          'BudgetDebugger');
      }
    };

    // Subscribe to both regular and global budget updates
    tradeService.on('budgetUpdated', handleBudgetUpdate);

    // Also subscribe to global budget updates
    const handleGlobalBudgetUpdate = (data: any) => {
      if (data.strategyId === strategyId && data.budget) {
        // Ensure all required budget properties exist
        const safetyBudget = {
          total: data.budget.total || 0,
          allocated: data.budget.allocated || 0,
          available: data.budget.available || 0,
          maxPositionSize: data.budget.maxPositionSize || 0,
          profit: data.budget.profit || 0,
          allocationPercentage: data.budget.allocationPercentage || 0,
          profitPercentage: data.budget.profitPercentage || 0
        };

        setBudget(safetyBudget);
        logService.log('info', `Budget updated via global event for strategy ${strategyId}`,
          { budget: safetyBudget },
          'BudgetDebugger');
      }
    };

    // Subscribe to the global budget update event
    eventBus.subscribe('budget:global:updated', handleGlobalBudgetUpdate);

    return () => {
      // Clean up event listeners
      tradeService.off('budgetUpdated', handleBudgetUpdate);
      eventBus.unsubscribe('budget:global:updated', handleGlobalBudgetUpdate);

      // Log cleanup
      logService.log('debug', `BudgetDebugger cleanup for strategy ${strategyId}`, null, 'BudgetDebugger');
    };
  }, [strategyId]);

  const handleSetBudget = async () => {
    try {
      setError(null);
      setSuccess(null);

      // Create a new budget object
      const newBudget: StrategyBudget = {
        total: customBudget,
        allocated: 0,
        available: customBudget,
        maxPositionSize: customBudget * 0.2 // 20% max position size
      };

      // Log the attempt
      logService.log('info', `Attempting to set budget for strategy ${strategyId}`,
        { budget: newBudget, isDemo: demoService.isInDemoMode() },
        'BudgetDebugger');

      // Set the budget
      await tradeService.setBudget(strategyId, newBudget);

      // Verify the budget was set
      const verifiedBudget = tradeService.getBudget(strategyId);

      if (verifiedBudget) {
        setBudget(verifiedBudget);
        setSuccess(`Budget successfully set to $${verifiedBudget.total}`);
        logService.log('info', `Budget successfully set for strategy ${strategyId}`,
          { budget: verifiedBudget },
          'BudgetDebugger');
      } else {
        setError('Budget was not set properly');
        logService.log('error', `Budget was not set properly for strategy ${strategyId}`,
          null,
          'BudgetDebugger');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error setting budget';
      setError(errorMessage);
      logService.log('error', `Error setting budget for strategy ${strategyId}`,
        err,
        'BudgetDebugger');
    }
  };

  const handleClearBudget = async () => {
    try {
      setError(null);
      setSuccess(null);

      // Log the attempt
      logService.log('info', `Attempting to clear budget for strategy ${strategyId}`,
        null,
        'BudgetDebugger');

      // Clear the budget
      await tradeService.setBudget(strategyId, null);

      // Verify the budget was cleared
      const verifiedBudget = tradeService.getBudget(strategyId);

      if (!verifiedBudget) {
        setBudget(null);
        setSuccess('Budget successfully cleared');
        logService.log('info', `Budget successfully cleared for strategy ${strategyId}`,
          null,
          'BudgetDebugger');
      } else {
        setError('Budget was not cleared properly');
        logService.log('error', `Budget was not cleared properly for strategy ${strategyId}`,
          { budget: verifiedBudget },
          'BudgetDebugger');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error clearing budget';
      setError(errorMessage);
      logService.log('error', `Error clearing budget for strategy ${strategyId}`,
        err,
        'BudgetDebugger');
    }
  };

  return (
    <div className="bg-gunmetal-900 border border-gunmetal-700 rounded-lg p-4 mb-4">
      <h3 className="text-neon-turquoise text-sm font-medium mb-2">Budget Debugger</h3>

      <div className="mb-4">
        <p className="text-gray-400 text-xs mb-1">Demo Mode: <span className="font-medium text-white">{isDemo ? 'Yes' : 'No'}</span></p>
        <p className="text-gray-400 text-xs mb-1">Strategy ID: <span className="font-medium text-white">{strategyId}</span></p>
      </div>

      <div className="mb-4 p-3 bg-gunmetal-800 rounded-lg">
        <h4 className="text-xs font-medium text-gray-300 mb-2">Current Budget:</h4>
        {budget ? (
          <div className="space-y-1 text-xs">
            <p>Total: <span className="text-neon-yellow">${(budget.total || 0).toLocaleString()}</span></p>
            <p>Allocated: <span className="text-neon-raspberry">${(budget.allocated || 0).toLocaleString()}</span></p>
            <p>Available: <span className="text-neon-turquoise">${(budget.available || 0).toLocaleString()}</span></p>
            <p>Max Position Size: <span className="text-neon-green">${(budget.maxPositionSize || 0).toLocaleString()}</span></p>
          </div>
        ) : (
          <p className="text-gray-500 text-xs">No budget set</p>
        )}
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-2 bg-green-900/20 border border-green-500/30 rounded text-green-400 text-xs">
          {success}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <input
          type="number"
          value={customBudget}
          onChange={(e) => setCustomBudget(Number(e.target.value))}
          className="flex-1 bg-gunmetal-800 border border-gunmetal-700 rounded px-3 py-1 text-sm text-white"
          min="1"
          step="100"
        />
        <button
          onClick={handleSetBudget}
          className="px-3 py-1 bg-neon-turquoise text-black rounded text-xs font-medium hover:bg-neon-turquoise/80"
        >
          Set Budget
        </button>
      </div>

      <button
        onClick={handleClearBudget}
        className="w-full px-3 py-1 bg-gunmetal-800 text-neon-raspberry border border-neon-raspberry/30 rounded text-xs font-medium hover:bg-gunmetal-700"
      >
        Clear Budget
      </button>
    </div>
  );
};
