import React, { useEffect, useState, useRef } from 'react';
import { DollarSign, RefreshCw } from 'lucide-react';
import { tradeService } from '../lib/trade-service';
import { eventBus } from '../lib/event-bus';
import { logService } from '../lib/log-service';
import { demoService } from '../lib/demo-service';
import { budgetStreamingService } from '../lib/budget-streaming-service';
import { motion, AnimatePresence } from 'framer-motion';
import { Trade } from '../lib/types';

interface BudgetPanelProps {
  strategyId: string;
  trades: Trade[];
}

export function BudgetPanel({ strategyId, trades }: BudgetPanelProps) {
  // State for budget values
  const [budget, setBudget] = useState<{
    total: number;
    allocated: number;
    available: number;
    profit: number;
    profitPercentage: number;
    allocationPercentage: number;
    remaining: number;
    lastUpdated?: number;
  } | null>(null);

  // State for tracking value changes for animations
  const [prevBudget, setPrevBudget] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [changedFields, setChangedFields] = useState<Record<string, boolean>>({});

  // Refs for tracking animation timeouts
  const animationTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // Function to manually refresh budget
  const refreshBudget = () => {
    setIsRefreshing(true);
    // Force budget streaming service to update
    budgetStreamingService.updateTrades(strategyId, trades);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Initialize budget streaming on component mount
  useEffect(() => {
    // Start budget streaming for this strategy
    budgetStreamingService.startBudgetStream(strategyId, trades);

    // Handler for budget stream updates
    const handleBudgetStreamUpdate = (data: any) => {
      if (data.strategyId !== strategyId) return;

      // Track which values have changed for animations
      const newChangedFields: Record<string, boolean> = {};

      if (budget) {
        // Check which fields have changed
        if (budget.total !== data.budget.total) newChangedFields.total = true;
        if (budget.allocated !== data.budget.allocated) newChangedFields.allocated = true;
        if (budget.available !== data.budget.available) newChangedFields.available = true;
        if (budget.profit !== data.profit) newChangedFields.profit = true;
      }

      // Save previous budget for comparison
      setPrevBudget(budget);

      // Update budget state with new values
      setBudget({
        total: data.budget.total,
        allocated: data.budget.allocated,
        available: data.budget.available,
        profit: data.profit,
        profitPercentage: data.profitPercentage,
        allocationPercentage: data.allocationPercentage,
        remaining: data.budget.available,
        lastUpdated: data.lastUpdated
      });

      // Set changed fields for animations
      setChangedFields(newChangedFields);

      // Clear animation after 1 second
      Object.keys(newChangedFields).forEach(field => {
        // Clear any existing timeout for this field
        if (animationTimeouts.current[field]) {
          clearTimeout(animationTimeouts.current[field]);
        }

        // Set new timeout
        animationTimeouts.current[field] = setTimeout(() => {
          setChangedFields(prev => ({
            ...prev,
            [field]: false
          }));
        }, 1000);
      });
    };

    // Subscribe to budget stream updates
    budgetStreamingService.on(`budgetStreamUpdated:${strategyId}`, handleBudgetStreamUpdate);

    // Also subscribe to event bus for broader coverage
    eventBus.subscribe('budgetStream:updated', (data: any) => {
      if (data.strategyId === strategyId) {
        handleBudgetStreamUpdate(data);
      }
    });

    // Return cleanup function
    return () => {
      // Stop budget streaming for this strategy
      budgetStreamingService.stopBudgetStream(strategyId);

      // Unsubscribe from budget stream updates
      budgetStreamingService.off(`budgetStreamUpdated:${strategyId}`, handleBudgetStreamUpdate);

      // Unsubscribe from event bus
      eventBus.unsubscribe('budgetStream:updated', handleBudgetStreamUpdate);

      // Clear any remaining animation timeouts
      Object.values(animationTimeouts.current).forEach(timeout => clearTimeout(timeout));
    };
  }, [strategyId]);

  // Update trades in budget streaming service when they change
  useEffect(() => {
    budgetStreamingService.updateTrades(strategyId, trades);
    logService.log('info', `Trades changed for strategy ${strategyId}, updating budget stream`, { tradesCount: trades.length }, 'BudgetPanel');
  }, [trades]);

  // If no budget is available, show loading state
  if (!budget) {
    return (
      <div>
        <h4 className="text-sm font-medium text-neon-turquoise mb-4 flex items-center gap-2 uppercase tracking-wider">
          <DollarSign className="w-4 h-4" />
          Trading Budget
        </h4>
        <div className="bg-gradient-to-r from-gunmetal-800 to-gunmetal-900 p-4 rounded-lg border border-gunmetal-700/50 shadow-inner animate-fadeIn">
          <div className="flex justify-center items-center h-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCw className="w-6 h-6 text-neon-turquoise" />
            </motion.div>
            <span className="text-gray-400 ml-3">Loading budget information...</span>
          </div>
        </div>
      </div>
    );
  }

  // Check if we're in demo mode
  const isDemo = demoService.isInDemoMode();

  // Helper function to render animated values
  const AnimatedValue = ({ value, prefix = "$", suffix = "", className = "", isChanged = false }) => {
    return (
      <AnimatePresence mode="wait">
        <motion.span
          key={value}
          initial={{ opacity: 0.7, y: isChanged ? -20 : 0 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${className} ${isChanged ? 'relative' : ''}`}
        >
          {prefix}{typeof value === 'number'
            ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : value
          }{suffix}
          {isChanged && (
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

  return (
    <div>
      <h4 className="text-sm font-medium text-neon-turquoise mb-4 flex items-center justify-between uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Trading Budget
          {isDemo && (
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full ml-2">DEMO</span>
          )}
        </div>
        <motion.button
          onClick={refreshBudget}
          disabled={isRefreshing}
          className="p-1.5 bg-gunmetal-800/70 rounded-full text-gray-400 hover:text-neon-turquoise transition-colors disabled:opacity-50"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-neon-turquoise' : ''}`} />
        </motion.button>
      </h4>
      <motion.div
        className="bg-gradient-to-r from-gunmetal-800 to-gunmetal-900 p-4 rounded-lg border border-gunmetal-700/50 shadow-inner"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Total Budget</span>
                <AnimatedValue
                  value={budget.total}
                  className="text-md font-bold text-neon-yellow"
                  isChanged={changedFields.total}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Available</span>
                <div className="flex items-center">
                  <AnimatedValue
                    value={budget.available}
                    className="text-md font-bold text-neon-turquoise"
                    isChanged={changedFields.available}
                  />
                  {budget.allocationPercentage !== undefined && (
                    <span className="text-xs text-gray-400 ml-1">({(100 - budget.allocationPercentage).toFixed(1)}%)</span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Allocated</span>
                <div className="flex items-center">
                  <AnimatedValue
                    value={budget.allocated}
                    className="text-md font-bold text-neon-orange"
                    isChanged={changedFields.allocated}
                  />
                  {budget.allocationPercentage !== undefined && (
                    <span className="text-xs text-gray-400 ml-1">({budget.allocationPercentage.toFixed(1)}%)</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Profit/Loss</span>
                <div className="flex items-center">
                  <AnimatedValue
                    value={budget.profit}
                    className={`text-md font-bold ${budget.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}
                    isChanged={changedFields.profit}
                  />
                  {budget.profitPercentage !== undefined && (
                    <span className={`text-xs ml-1 ${budget.profit >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                      ({budget.profit >= 0 ? '+' : ''}{budget.profitPercentage.toFixed(2)}%)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Remaining Budget</span>
                <div className="flex items-center">
                  <AnimatedValue
                    value={budget.remaining}
                    className={`text-md font-bold ${budget.remaining && budget.remaining < 100 ? 'text-red-400' : 'text-neon-yellow'}`}
                    isChanged={changedFields.available}
                  />
                  {budget.remaining && budget.remaining < 100 && (
                    <span className="text-xs text-red-400 ml-2">(Low)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Budget warning if too low */}
          <AnimatePresence>
            {budget.remaining && budget.remaining < 100 && (
              <motion.div
                className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-md"
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
              >
                <p className="text-xs text-red-400">
                  <span className="font-bold">Warning:</span> Budget is too low to generate new trades. Add more funds to continue trading.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Budget progress bar */}
          {budget.total > 0 && (
            <div className="mt-2">
              <div className="h-2 w-full bg-gunmetal-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-neon-orange to-neon-yellow rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, budget.allocationPercentage || 0)}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Allocation</span>
                <AnimatedValue
                  value={budget.allocationPercentage?.toFixed(1) || 0}
                  prefix=""
                  suffix="%"
                  className="text-xs text-gray-400"
                />
              </div>
            </div>
          )}

          {/* Demo mode indicator and last updated timestamp */}
          <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
            {isDemo && (
              <span className="text-blue-400">Demo Mode</span>
            )}
            {budget.lastUpdated && (
              <span>Last updated: {new Date(budget.lastUpdated).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
