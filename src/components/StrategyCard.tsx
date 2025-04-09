import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Activity, DollarSign, BarChart3, Clock, Edit, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AssetPriceIndicator } from './AssetPriceIndicator';
import { strategyService } from '../lib/strategy-service';
import { tradeService } from '../lib/trade-service';
import { marketService } from '../lib/market-service';
import { tradeGenerator } from '../lib/trade-generator';
import { demoTradeGenerator } from '../lib/demo-trade-generator';
import { tradeEngine } from '../lib/trade-engine';
import { tradeManager } from '../lib/trade-manager';
import { logService } from '../lib/log-service';
import { strategyMonitor } from '../lib/strategy-monitor';
import { demoService } from '../lib/demo-service';
import { walletBalanceService } from '../lib/wallet-balance-service';
import { eventBus } from '../lib/event-bus';
import { supabase } from '../lib/supabase';
import { directDeleteStrategy } from '../lib/direct-delete';
import { BudgetModal } from './BudgetModal';
import { BudgetAdjustmentModal } from './BudgetAdjustmentModal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import type { RiskLevel, Strategy, StrategyBudget, Trade } from '../lib/types';

// Extended Trade type with additional properties for timestamps
interface ExtendedTrade extends Trade {
  createdAt?: string;
  executedAt?: string | null;
}

// Helper function to get color based on risk level
const getRiskLevelColor = (riskLevel?: RiskLevel): string => {
  switch (riskLevel) {
    case 'Ultra Low':
      return 'bg-emerald-400/20 text-emerald-400';
    case 'Low':
      return 'bg-neon-turquoise/20 text-neon-turquoise';
    case 'Medium':
      return 'bg-neon-yellow/20 text-neon-yellow';
    case 'High':
      return 'bg-neon-orange/20 text-neon-orange';
    case 'Ultra High':
      return 'bg-neon-pink/20 text-neon-pink';
    case 'Extreme':
      return 'bg-purple-400/20 text-purple-400';
    case 'God Mode':
      return 'bg-red-500/20 text-red-500';
    default:
      return 'bg-gray-400/20 text-gray-400';
  }
};

// Helper function to format time ago
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

interface StrategyCardProps {
  strategy: Strategy;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onRefresh?: () => Promise<void> | void;
  onEdit?: (strategy: Strategy) => void;
  onDelete?: (strategy: Strategy) => void;
  onActivate?: (strategy: Strategy) => Promise<boolean>;
  onDeactivate?: (strategy: Strategy) => Promise<void> | void;
  trades?: Trade[];
  hideExpandArrow?: boolean; // New prop to hide the expand arrow
  budget?: {
    total: number;
    allocated: number;
    available: number;
    profit: number;
    profitPercentage?: number;
    allocationPercentage?: number;
  };
}

export function StrategyCard({ strategy, isExpanded, onToggleExpand, onRefresh, onEdit, onDelete, onActivate, onDeactivate, trades = [], hideExpandArrow = false, budget }: StrategyCardProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showBudgetAdjustmentModal, setShowBudgetAdjustmentModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [strategyBudget, setStrategyBudget] = useState<number>(0);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [strategyTrades, setStrategyTrades] = useState<ExtendedTrade[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState<boolean>(false);

  // Section visibility states
  const [showTradingParameters, setShowTradingParameters] = useState(false);
  const [showRiskManagement, setShowRiskManagement] = useState(false);
  const [showTradingPairs, setShowTradingPairs] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [showTrades, setShowTrades] = useState(true); // Trades section is expanded by default

  // State for trade generation status
  const [tradeGenerationStatus, setTradeGenerationStatus] = useState<{
    status: 'idle' | 'checking' | 'generating' | 'error';
    lastChecked: number | null;
    lastGenerated: number | null;
    message: string;
  }>({
    status: 'idle',
    lastChecked: null,
    lastGenerated: null,
    message: 'Waiting for market conditions...'
  });

  // Fetch the budget, available balance, and trades when the component mounts or when the strategy changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch budget
        const budget = tradeService.getBudget(strategy.id);
        if (budget) {
          setStrategyBudget(budget.total);
        } else {
          setStrategyBudget(0);
        }

        // Initialize wallet balance service if needed
        if (!walletBalanceService.getLastUpdated()) {
          await walletBalanceService.initialize();
        }

        // Get available balance
        setAvailableBalance(walletBalanceService.getAvailableBalance());

        // Get trade generation status
        if (strategy.status === 'active') {
          // Check if the strategy is being monitored by the trade generator
          const isMonitored = tradeGenerator.isStrategyMonitored(strategy.id);
          const lastChecked = tradeGenerator.getLastCheckTime(strategy.id);
          const lastGenerated = tradeGenerator.getLastGeneratedTime(strategy.id);

          // If the strategy is not being monitored, try to add it to the trade generator
          if (!isMonitored) {
            try {
              // Force the strategy to be added to the trade generator
              tradeGenerator.addStrategy(strategy).catch(error => {
                console.error(`Error adding strategy ${strategy.id} to trade generator:`, error);
              });

              // Also try to add it to the strategy monitor
              strategyMonitor.addStrategy(strategy).catch(error => {
                console.error(`Error adding strategy ${strategy.id} to strategy monitor:`, error);
              });

              logService.log('info', `Forced strategy ${strategy.id} to be added to monitoring`, null, 'StrategyCard');
            } catch (error) {
              logService.log('error', `Failed to force strategy ${strategy.id} into monitoring`, error, 'StrategyCard');
            }
          }

          setTradeGenerationStatus({
            status: isMonitored ? 'checking' : 'idle',
            lastChecked,
            lastGenerated,
            message: isMonitored
              ? 'Monitoring market conditions for trade opportunities...'
              : 'Waiting to start monitoring...'
          });

          // Subscribe to trade generation events for this strategy
          eventBus.subscribe(`trade:checking:${strategy.id}`, () => {
            setTradeGenerationStatus(prev => ({
              ...prev,
              status: 'checking',
              lastChecked: Date.now(),
              message: 'Checking market conditions for trade opportunities...'
            }));
          });

          eventBus.subscribe(`trade:generating:${strategy.id}`, () => {
            setTradeGenerationStatus(prev => ({
              ...prev,
              status: 'generating',
              lastGenerated: Date.now(),
              message: 'Generating trade based on current market conditions...'
            }));
          });

          eventBus.subscribe(`trade:created:${strategy.id}`, () => {
            setTradeGenerationStatus(prev => ({
              ...prev,
              status: 'idle',
              lastGenerated: Date.now(),
              message: 'Trade successfully generated! Waiting for next opportunity...'
            }));

            // Update budget after trade is created
            const updateBudget = async () => {
              const updatedBudget = tradeService.getBudget(strategy.id);
              if (updatedBudget) {
                setStrategyBudget(updatedBudget.total);
              }
            };
            updateBudget();
          });

          eventBus.subscribe(`trade:error:${strategy.id}`, (error) => {
            setTradeGenerationStatus(prev => ({
              ...prev,
              status: 'error',
              message: `Error generating trade: ${error?.message || 'Unknown error'}`
            }));
          });

          // Subscribe to budget updates
          tradeService.on('budgetUpdated', (data) => {
            if (data.strategyId === strategy.id && data.budget) {
              setStrategyBudget(data.budget.total);

              // Log budget update for debugging
              logService.log('info', `Budget updated for strategy ${strategy.id}`, { budget: data.budget }, 'StrategyCard');
            }
          });
        }

        // Trades are now provided via props
      } catch (error) {
        logService.log('error', `Failed to fetch data for strategy ${strategy.id}`, error, 'StrategyCard');
        setStrategyBudget(0);
      }
    };

    fetchData();

    // Subscribe to balance updates
    const handleBalanceUpdate = () => {
      setAvailableBalance(walletBalanceService.getAvailableBalance());
    };

    // Subscribe to budget updates
    const handleBudgetUpdate = (event: any) => {
      // Handle direct budget updates from trade service
      if (event.strategyId === strategy.id) {
        const budget = tradeService.getBudget(strategy.id);
        if (budget) {
          setStrategyBudget(budget.total);
          logService.log('info', `Budget updated via event for strategy ${strategy.id}`, { budget }, 'StrategyCard');
        }
      }

      // Handle global budget updates from TradeMonitor
      if (event.budgets && event.budgets[strategy.id]) {
        logService.log('info', `Budget updated from global event for strategy ${strategy.id}`, { budget: event.budgets[strategy.id] }, 'StrategyCard');
      }
    };

    // Subscribe to trade updates - no longer needed as trades come from props
    const handleTradeUpdate = () => {
      // Trades are now provided via props
    };

    walletBalanceService.on('balancesUpdated', handleBalanceUpdate);
    tradeService.on('budgetUpdated', handleBudgetUpdate);
    eventBus.subscribe('budgetUpdated', handleBudgetUpdate);
    tradeManager.on('tradesUpdated', handleTradeUpdate);

    // No need for interval to refresh trades as they come from props

    // Create unsubscribe functions for event bus subscriptions
    let unsubscribeChecking = () => {};
    let unsubscribeGenerating = () => {};
    let unsubscribeCreated = () => {};
    let unsubscribeError = () => {};

    if (strategy.status === 'active') {
      unsubscribeChecking = eventBus.subscribe(`trade:checking:${strategy.id}`, () => {});
      unsubscribeGenerating = eventBus.subscribe(`trade:generating:${strategy.id}`, () => {});
      unsubscribeCreated = eventBus.subscribe(`trade:created:${strategy.id}`, () => {});
      unsubscribeError = eventBus.subscribe(`trade:error:${strategy.id}`, () => {});
    }

    return () => {
      // Unsubscribe from service events
      walletBalanceService.off('balancesUpdated', handleBalanceUpdate);
      tradeService.off('budgetUpdated', handleBudgetUpdate);
      eventBus.unsubscribe('budgetUpdated', handleBudgetUpdate);
      tradeManager.off('tradesUpdated', handleTradeUpdate);

      // Unsubscribe from event bus
      unsubscribeChecking();
      unsubscribeGenerating();
      unsubscribeCreated();
      unsubscribeError();
    };
  }, [strategy.id, isExpanded]);

  // Process trades from props
  useEffect(() => {
    if (!strategy.id) return;

    try {
      setIsLoadingTrades(true);

      // If we have trades from props, use them
      if (trades && trades.length > 0) {
        // Format the trades - use a stable reference to avoid unnecessary re-renders
        const formattedTrades = trades.map(trade => ({
          ...trade,
          createdAt: trade.created_at || trade.datetime || new Date(trade.timestamp).toISOString(),
          executedAt: trade.executed_at || (trade.status === 'executed' ? new Date().toISOString() : null),
          entryPrice: trade.entry_price || trade.price,
          stopLoss: trade.stop_loss,
          takeProfit: trade.take_profit,
          strategyId: strategy.id
        }));

        // Use a functional update to avoid dependency on previous state
        setStrategyTrades(formattedTrades);
      } else {
        // Get active trades for this strategy from tradeManager as fallback
        const activeTrades = tradeManager.getActiveTradesForStrategy(strategy.id);

        // If we have active trades, use them directly
        if (activeTrades.length > 0) {
          // Add timestamps to trades if they don't have them
          const tradesWithTimestamps = activeTrades.map(trade => ({
            ...trade,
            createdAt: trade.createdAt || new Date(trade.timestamp).toISOString(),
            executedAt: trade.executedAt || (trade.status === 'executed' ? new Date().toISOString() : null),
            strategyId: strategy.id
          }));

          // Use a functional update to avoid dependency on previous state
          setStrategyTrades(tradesWithTimestamps);
        } else if (strategy.status === 'active') {
          // If strategy is active but no trades yet, create a pending trade to show activity
          const pendingTrade: ExtendedTrade = {
            id: `pending-${strategy.id}`, // Remove Date.now() to avoid constant changes
            symbol: (strategy as any).selected_pairs?.[0] || 'BTC/USDT',
            side: 'buy',
            status: 'pending',
            entryPrice: 50000, // Remove random value to avoid constant changes
            timestamp: Date.now(),
            createdAt: new Date().toISOString(),
            executedAt: null,
            strategyId: strategy.id
          };

          // Use a functional update to avoid dependency on previous state
          setStrategyTrades([pendingTrade]);
        } else {
          // Strategy is not active, no trades to show
          setStrategyTrades([]);
        }
      }
    } catch (error) {
      logService.log('error', `Failed to process trades for strategy ${strategy.id}`, error, 'StrategyCard');
      // Set empty array on error
      setStrategyTrades([]);
    } finally {
      setIsLoadingTrades(false);
    }
  }, [strategy.id, strategy.status]); // Remove trades from dependency array to prevent infinite loop

  // Handle changes to the trades prop separately with a deep comparison
  useEffect(() => {
    // Only process trades from props if we have them and the component is mounted
    if (trades && trades.length > 0 && strategy.id) {
      // Format the trades
      const formattedTrades = trades.map(trade => ({
        ...trade,
        createdAt: trade.created_at || trade.datetime || new Date(trade.timestamp).toISOString(),
        executedAt: trade.executed_at || (trade.status === 'executed' ? new Date().toISOString() : null),
        entryPrice: trade.entry_price || trade.price,
        stopLoss: trade.stop_loss,
        takeProfit: trade.take_profit,
        strategyId: strategy.id
      }));

      // Create a map of existing trades for faster lookup
      const existingTradesMap = strategyTrades.reduce((map, trade) => {
        map[trade.id] = trade;
        return map;
      }, {} as Record<string, ExtendedTrade>);

      // Create a map of new trades for faster lookup
      const newTradesMap = formattedTrades.reduce((map, trade) => {
        map[trade.id] = trade;
        return map;
      }, {} as Record<string, ExtendedTrade>);

      // Determine which trades are new, updated, or removed
      const newTradeIds = new Set(formattedTrades.map(t => t.id));
      const existingTradeIds = new Set(strategyTrades.map(t => t.id));

      // Find trades that are new (in new set but not in existing)
      const addedTrades = formattedTrades.filter(t => !existingTradeIds.has(t.id));

      // Find trades that are updated (in both sets but with changes)
      const updatedTrades = formattedTrades.filter(t => {
        const existingTrade = existingTradesMap[t.id];
        if (!existingTrade) return false; // Not an update if it's new

        // Check if any important properties have changed
        return (
          existingTrade.status !== t.status ||
          existingTrade.profit !== t.profit ||
          existingTrade.exitPrice !== t.exitPrice
        );
      });

      // Find trades that are removed (in existing set but not in new)
      const removedTradeIds = [...existingTradeIds].filter(id => !newTradeIds.has(id));

      // Only update if there are changes
      const hasChanges = addedTrades.length > 0 || updatedTrades.length > 0 || removedTradeIds.length > 0;

      if (hasChanges) {
        // Use a functional update to avoid race conditions
        setStrategyTrades(prevTrades => {
          // Start with the previous trades
          let result = [...prevTrades];

          // Remove trades that no longer exist
          if (removedTradeIds.length > 0) {
            result = result.filter(t => !removedTradeIds.includes(t.id));
          }

          // Update existing trades
          if (updatedTrades.length > 0) {
            result = result.map(trade => {
              const updatedTrade = newTradesMap[trade.id];
              if (updatedTrade) {
                return { ...trade, ...updatedTrade };
              }
              return trade;
            });
          }

          // Add new trades
          if (addedTrades.length > 0) {
            result = [...result, ...addedTrades];
          }

          // Sort by timestamp, newest first
          result.sort((a, b) => {
            const aTime = a.timestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const bTime = b.timestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return bTime - aTime;
          });

          return result;
        });
      }
    }
  }, [trades, strategy.id]); // Only depend on trades and strategy.id

  const handleActivate = async () => {
    try {
      setIsActivating(true);
      setError(null);

      if (onActivate) {
        // Use the provided onActivate callback
        const activationResult = await onActivate(strategy);

        // If activation failed or was cancelled (e.g., budget modal shown), don't update UI
        if (activationResult === false) {
          logService.log('info', `Strategy ${strategy.id} activation not completed`, null, 'StrategyCard');
          setIsActivating(false);
          return;
        }
      } else {
        // Fallback to the original implementation
        // Check if budget is already set
        const budget = tradeService.getBudget(strategy.id);

        if (!budget || budget.total <= 0) {
          // If no budget or budget is zero, show budget modal
          logService.log('info', `No budget set for strategy ${strategy.id}, showing budget modal`, null, 'StrategyCard');
          setSelectedStrategy(strategy);
          setShowBudgetModal(true);
          setIsActivating(false);
          return;
        }

        // Check if budget exceeds available balance
        if (budget.total > availableBalance) {
          logService.log('info', `Budget exceeds available balance: ${budget.total} > ${availableBalance}`, null, 'StrategyCard');
          setSelectedStrategy(strategy);
          setShowBudgetAdjustmentModal(true);
          setIsActivating(false);
          return;
        }

        // If budget exists, proceed with activation directly without resetting the budget
        try {
          // Activate the strategy
          const updatedStrategy = await strategyService.activateStrategy(strategy.id);
          logService.log('info', `Strategy ${strategy.id} activated in database`, null, 'StrategyCard');

          // Start monitoring the strategy
          await marketService.startStrategyMonitoring(updatedStrategy);
          logService.log('info', `Started monitoring for strategy ${strategy.id}`, null, 'StrategyCard');

          // Add strategy to trade generator
          if (demoService.isInDemoMode()) {
            // Use demo trade generator in demo mode
            await demoTradeGenerator.addStrategy(updatedStrategy as any);
            logService.log('info', `Added strategy ${strategy.id} to demo trade generator`, null, 'StrategyCard');
          } else {
            // Use regular trade generator in normal mode
            await tradeGenerator.addStrategy(updatedStrategy as any);
            logService.log('info', `Added strategy ${strategy.id} to trade generator`, null, 'StrategyCard');
          }

          // Initialize strategy monitoring
          await strategyMonitor.addStrategy(updatedStrategy as any);
          logService.log('info', `Added strategy ${strategy.id} to monitor`, null, 'StrategyCard');

          // Start trade engine monitoring
          await tradeEngine.addStrategy(updatedStrategy as any);
          logService.log('info', `Added strategy ${strategy.id} to trade engine`, null, 'StrategyCard');

          // Connect to trading engine to start generating trades
          await tradeService.connectStrategyToTradingEngine(strategy.id);
          logService.log('info', `Connected strategy ${strategy.id} to trading engine`, null, 'StrategyCard');

          // Refresh data
          if (onRefresh) {
            await onRefresh();
          }

          logService.log('info', `Strategy ${strategy.id} successfully activated with existing budget`, { budget }, 'StrategyCard');
        } catch (activationError) {
          logService.log('error', 'Failed to activate strategy with existing budget', activationError, 'StrategyCard');
          throw activationError;
        }
      }

      // Refresh data
      if (onRefresh) {
        await onRefresh();
      } else {
        // Force a re-render if no refresh callback is provided
        setIsActivating(false);
        setIsActivating(true);
        setTimeout(() => setIsActivating(false), 10);
      }

      logService.log('info', `Strategy ${strategy.id} activated successfully`, null, 'StrategyCard');
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

      if (onDeactivate) {
        // Use the provided onDeactivate callback
        await onDeactivate(strategy);
      } else {
        // Fallback to the original implementation
        // 1. Get active trades for this strategy
        const activeTrades = tradeManager.getActiveTradesForStrategy(strategy.id);
        logService.log('info', `Found ${activeTrades.length} active trades to close for strategy ${strategy.id}`, null, 'StrategyCard');

        // 2. Close any active trades
        if (activeTrades.length > 0) {
          try {
            // Close each active trade
            for (const trade of activeTrades) {
              try {
                // Close the trade and release the budget
                await tradeEngine.closeTrade(trade.id, 'Strategy deactivated');
                logService.log('info', `Closed trade ${trade.id} for strategy ${strategy.id}`, null, 'StrategyCard');
              } catch (tradeError) {
                logService.log('warn', `Failed to close trade ${trade.id}, continuing with deactivation`, tradeError, 'StrategyCard');
              }
            }
          } catch (tradesError) {
            logService.log('warn', 'Error closing trades, continuing with deactivation', tradesError, 'StrategyCard');
          }
        }

        // 3. Deactivate strategy in database
        await strategyService.deactivateStrategy(strategy.id);

        // 4. Remove from monitoring services
        try {
          await marketService.stopStrategyMonitoring(strategy.id);
        } catch (marketError) {
          logService.log('warn', 'Error stopping market monitoring, continuing with deactivation', marketError, 'StrategyCard');
        }

        try {
          if (demoService.isInDemoMode()) {
            // Remove from demo trade generator in demo mode
            demoTradeGenerator.removeStrategy(strategy.id);
            logService.log('info', `Removed strategy ${strategy.id} from demo trade generator`, null, 'StrategyCard');
          } else {
            // Remove from regular trade generator in normal mode
            tradeGenerator.removeStrategy(strategy.id);
            logService.log('info', `Removed strategy ${strategy.id} from trade generator`, null, 'StrategyCard');
          }
        } catch (generatorError) {
          logService.log('warn', 'Error removing from trade generator, continuing with deactivation', generatorError, 'StrategyCard');
        }

        try {
          strategyMonitor.removeStrategy(strategy.id);
        } catch (monitorError) {
          logService.log('warn', 'Error removing from strategy monitor, continuing with deactivation', monitorError, 'StrategyCard');
        }

        try {
          await tradeEngine.removeStrategy(strategy.id);
        } catch (engineError) {
          logService.log('warn', 'Error removing from trade engine, continuing with deactivation', engineError, 'StrategyCard');
        }

        // Don't manually update the strategy status - wait for the refresh
        // to get the updated status from the database
      }

      // 6. Refresh data
      if (onRefresh) {
        await onRefresh();
      } else {
        // Force a re-render if no refresh callback is provided
        setIsDeactivating(false);
        setIsDeactivating(true);
        setTimeout(() => setIsDeactivating(false), 10);
      }

      logService.log('info', `Strategy ${strategy.id} deactivated successfully`, null, 'StrategyCard');
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

      // Ensure strategy has required configuration
      const enhancedStrategy = await ensureStrategyConfiguration(strategy);

      // 1. Activate strategy in database
      const updatedStrategy = await strategyService.activateStrategy(enhancedStrategy.id);

      try {
        // 2. Start market monitoring - wrapped in try/catch to prevent errors
        await marketService.startStrategyMonitoring(updatedStrategy);
      } catch (marketError) {
        logService.log('warn', 'Error starting market monitoring, continuing with activation',
          marketError, 'StrategyCard');
      }

      try {
        // 3. Add strategy to trade generator
        await tradeGenerator.addStrategy(updatedStrategy as any);
      } catch (generatorError) {
        logService.log('warn', 'Error adding strategy to trade generator, continuing with activation',
          generatorError, 'StrategyCard');
      }

      try {
        // 4. Initialize strategy monitoring
        await strategyMonitor.addStrategy(updatedStrategy as any);
      } catch (monitorError) {
        logService.log('warn', 'Error adding strategy to monitor, continuing with activation',
          monitorError, 'StrategyCard');
      }

      try {
        // 5. Start trade engine monitoring
        await tradeEngine.addStrategy(updatedStrategy as any);
      } catch (engineError) {
        logService.log('warn', 'Error adding strategy to trade engine, continuing with activation',
          engineError, 'StrategyCard');
      }

      // 6. Refresh data
      if (onRefresh) {
        await onRefresh();
      } else {
        // Force a re-render if no refresh callback is provided
        setIsActivating(false);
        setIsActivating(true);
        setTimeout(() => setIsActivating(false), 10);
      }

      logService.log('info', `Strategy ${strategy.id} activated with budget`,
        { strategyId: strategy.id, budgetAmount: budget.total }, 'StrategyCard');

      return updatedStrategy;
    } catch (error) {
      logService.log('error', 'Failed to activate strategy with budget', error, 'StrategyCard');
      throw error;
    }
  };

  /**
   * Ensures a strategy has all required configuration for activation
   * @param strategy The strategy to enhance with default configuration
   * @returns The enhanced strategy with all required configuration
   */
  const ensureStrategyConfiguration = async (strategy: Strategy): Promise<Strategy> => {
    try {
      // Create a deep copy of the strategy to avoid modifying the original
      const enhancedStrategy = JSON.parse(JSON.stringify(strategy)) as Strategy;

      // Ensure strategy_config exists
      if (!enhancedStrategy.strategy_config) {
        enhancedStrategy.strategy_config = {};
      }

      // Ensure assets are configured
      if (!enhancedStrategy.strategy_config.assets) {
        enhancedStrategy.strategy_config.assets = ['BTC/USDT'];
      }

      // Ensure selected_pairs exists
      if (!enhancedStrategy.selected_pairs || enhancedStrategy.selected_pairs.length === 0) {
        enhancedStrategy.selected_pairs = ['BTC/USDT'];
      }

      // Ensure config.pairs exists for strategy-monitor
      if (!enhancedStrategy.strategy_config.config) {
        enhancedStrategy.strategy_config.config = {};
      }

      if (!enhancedStrategy.strategy_config.config.pairs || enhancedStrategy.strategy_config.config.pairs.length === 0) {
        enhancedStrategy.strategy_config.config.pairs = enhancedStrategy.selected_pairs;
      }

      // Update the strategy in the database with the enhanced configuration
      const updatedStrategy = await strategyService.updateStrategy(enhancedStrategy.id, {
        strategy_config: enhancedStrategy.strategy_config,
        selected_pairs: enhancedStrategy.selected_pairs
      });

      logService.log('info', `Enhanced strategy configuration for ${strategy.id}`, {
        original: strategy,
        enhanced: updatedStrategy
      }, 'StrategyCard');

      return updatedStrategy;
    } catch (error) {
      logService.log('error', `Failed to enhance strategy configuration for ${strategy.id}`, error, 'StrategyCard');
      // Return the original strategy if enhancement fails
      return strategy;
    }
  };

  const handleBudgetSubmit = async (budget: StrategyBudget) => {
    if (!selectedStrategy) return;

    try {
      setIsSubmittingBudget(true);
      setError(null);

      // Check if budget exceeds available balance
      if (budget.total > availableBalance) {
        logService.log('info', `Budget exceeds available balance: ${budget.total} > ${availableBalance}`, null, 'StrategyCard');
        setShowBudgetModal(false);
        setShowBudgetAdjustmentModal(true);
        return;
      }

      // 1. First, ensure the budget is set and confirmed
      try {
        // Set budget for the strategy
        await tradeService.setBudget(selectedStrategy.id, budget);
        logService.log('info', `Budget set for strategy ${selectedStrategy.id}`, { budget }, 'StrategyCard');
      } catch (budgetError) {
        logService.log('error', 'Failed to set budget', budgetError, 'StrategyCard');
        throw new Error('Failed to set budget. Please try again.');
      }

      // 2. Verify the budget was set correctly
      const confirmedBudget = tradeService.getBudget(selectedStrategy.id);
      if (!confirmedBudget) {
        throw new Error('Budget could not be confirmed. Please try again.');
      }

      // 3. Now proceed with activation
      await activateStrategyWithBudget(selectedStrategy, budget);

      // Important: Close the modal first before any potential errors in the refresh
      setShowBudgetModal(false);
      setShowBudgetAdjustmentModal(false);
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

  /**
   * Handle strategy deletion with direct database access
   */
  const handleDelete = async () => {
    try {
      setShowDeleteConfirm(false);
      setError(null);

      // 1. If strategy is active, deactivate it first
      if (strategy.status === 'active') {
        setError('Cannot delete an active strategy. Please deactivate it first.');
        return;
      }

      console.log('DIRECT DELETION - Strategy ID:', strategy.id);

      // 2. Store the strategy ID for later use
      const strategyId = strategy.id;

      // 3. Call the onDelete callback IMMEDIATELY to update parent component
      // This ensures the UI updates before the database operation
      if (onDelete) {
        console.log('StrategyCard: Calling onDelete callback');
        onDelete(strategy);
      }

      // 4. Use the direct deletion function
      console.log(`Using direct deletion function for strategy ${strategyId}...`);
      const success = await directDeleteStrategy(strategyId);

      if (success) {
        console.log(`Strategy ${strategyId} successfully deleted from database`);
      } else {
        console.error(`Failed to delete strategy ${strategyId} from database`);

        // Try one more time with a direct SQL query
        try {
          console.log(`Attempting direct SQL query as last resort...`);
          await supabase.rpc('execute_sql', {
            query: `
              DELETE FROM trades WHERE strategy_id = '${strategyId}';
              DELETE FROM strategies WHERE id = '${strategyId}';
            `
          });
          console.log(`Direct SQL query executed for strategy ${strategyId}`);
        } catch (sqlError) {
          console.error(`Final SQL attempt failed: ${sqlError}`);
        }
      }

      // Verify deletion
      try {
        const { data: checkData } = await supabase
          .from('strategies')
          .select('id')
          .eq('id', strategyId);

        if (!checkData || checkData.length === 0) {
          console.log(`VERIFICATION: Strategy ${strategyId} is confirmed deleted`);
        } else {
          console.error(`VERIFICATION FAILED: Strategy ${strategyId} still exists in database`);
          console.log(`Strategy data:`, checkData);
        }
      } catch (verifyError) {
        console.error(`Error verifying deletion: ${verifyError}`);
      }

      // 6. Force refresh the list in the background
      if (onRefresh) {
        setTimeout(() => {
          console.log('StrategyCard: Refreshing strategy list');
          onRefresh().catch(refreshError => {
            console.warn('Failed to refresh strategies after deletion:', refreshError);
          });
        }, 1000);
      }
    } catch (error) {
      console.error('Unexpected error in delete handler:', error);
      // Don't show error to user since UI is already updated
    }
  };

  return (
    <>
      <motion.div
        className={`panel-metallic rounded-xl p-4 sm:p-6 shadow-lg cursor-pointer strategy-card border-0`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onClick={() => onToggleExpand(strategy.id)}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${strategy.status === 'active' ? 'bg-neon-turquoise/10' : 'bg-gunmetal-800'}`}>
              <Activity className={`w-5 h-5 ${strategy.status === 'active' ? 'text-neon-turquoise' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-200 truncate">{(strategy as any).name || (strategy as any).title || 'Unnamed Strategy'}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskLevelColor(strategy.riskLevel)}`}>
                  {strategy.riskLevel}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{strategy.description || 'No description available'}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 max-w-full overflow-hidden">
                <span className={`text-xs px-2 py-0.5 rounded-full ${strategy.status === 'active' ? 'bg-neon-turquoise/10 text-neon-turquoise' : 'bg-gunmetal-700 text-gray-400'}`}>
                  {strategy.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                </span>
                {/* Trading pairs as lozenges with price indicators */}
                {(strategy.selected_pairs || []).slice(0, 3).map((pair, index) => (
                  <div key={index} className="flex items-center text-xs px-3 py-0.5 bg-gunmetal-800 text-gray-300 rounded-full whitespace-nowrap mobile-truncate min-w-[110px] md:min-w-[110px] justify-between">
                    <span className="mr-2">{pair}</span>
                    <div className="border-l border-gunmetal-700 pl-2">
                      <AssetPriceIndicator symbol={pair} compact={true} />
                    </div>
                  </div>
                ))}
                {(strategy.selected_pairs || []).length > 3 && (
                  <span className="text-xs px-3 py-0.5 bg-gunmetal-800 text-gray-300 rounded-full whitespace-nowrap min-w-[90px] text-center">
                    +{(strategy.selected_pairs || []).length - 3} more
                  </span>
                )}
                {strategy.status !== 'active' && (
                  <span className="text-xs text-gray-400 ml-auto">
                    Potential profit: <span className="text-neon-yellow">+{((strategy as any).strategy_config?.takeProfit || 0.05) * 100}%</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Only show activate/deactivate buttons if the callbacks are provided */}
            {onActivate && onDeactivate && strategy.status === 'active' ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeactivate();
                }}
                disabled={isDeactivating}
                className="px-3 py-1.5 bg-gunmetal-800 text-neon-turquoise border border-neon-turquoise/30 rounded-lg hover:bg-gunmetal-700 transition-colors btn-text-small font-medium"
              >
                {isDeactivating ? 'Deactivating...' : 'Deactivate'}
              </button>
            ) : onActivate && onDeactivate ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleActivate();
                }}
                disabled={isActivating}
                className="px-3 py-1.5 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-colors btn-text-small font-medium"
              >
                {isActivating ? 'Activating...' : 'Activate'}
              </button>
            ) : null}
            {/* Delete button - only show if strategy is not active and onDelete is provided */}
            {onDelete && strategy.status !== 'active' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="px-3 py-1.5 bg-gunmetal-800 text-red-400 border border-red-400/30 rounded-lg hover:bg-gunmetal-700 transition-colors btn-text-small font-medium"
              >
                Delete
              </button>
            )}
            {!hideExpandArrow && (
              <div className="flex items-center justify-center px-3 py-1 rounded-lg bg-gunmetal-800 hover:bg-gunmetal-700 transition-colors border border-gunmetal-700 shadow-inner">
                <span className="text-xs text-neon-turquoise">
                  {isExpanded ? 'Less' : 'More'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Strategy Details (Expanded) */}
        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-gunmetal-700/50 space-y-6">
            {/* Trading Parameters */}
            <div className="mb-6">
              <h4
                className="text-sm font-medium text-neon-turquoise mb-4 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTradingParameters(!showTradingParameters);
                }}
              >
                <div className="flex items-center gap-2 uppercase tracking-wider">
                  <BarChart3 className="w-4 h-4" />
                  Trading Parameters
                </div>
                <span className="text-xs text-gray-400">
                  {showTradingParameters ? 'Hide' : 'Show'}
                </span>
              </h4>
              {showTradingParameters && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
                  <div>
                    <p className="text-xs text-gray-500">Leverage</p>
                    <p className="text-sm text-white">{((strategy as any).strategy_config?.leverage || 1)}x</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Position Size</p>
                    <p className="text-sm text-white">{(((strategy as any).strategy_config?.positionSize || 0.1) * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Confidence Threshold</p>
                    <p className="text-sm text-white">{(((strategy as any).strategy_config?.confidenceThreshold || 0.7) * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Timeframe</p>
                    <p className="text-sm text-white">{(strategy as any).strategy_config?.timeframe || '1h'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Risk Management */}
            <div className="mb-6">
              <h4
                className="text-sm font-medium text-neon-turquoise mb-4 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRiskManagement(!showRiskManagement);
                }}
              >
                <div className="flex items-center gap-2 uppercase tracking-wider">
                  <Activity className="w-4 h-4" />
                  Risk Management
                </div>
                {showRiskManagement ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </h4>
              {showRiskManagement && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
                  <div>
                    <p className="text-xs text-gray-500">Stop Loss</p>
                    <p className="text-sm text-white">{(((strategy as any).strategy_config?.stopLoss || 0.03) * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Take Profit</p>
                    <p className="text-sm text-white">{(((strategy as any).strategy_config?.takeProfit || 0.09) * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Trailing Stop</p>
                    <p className="text-sm text-white">{(((strategy as any).strategy_config?.trailingStop || 0.02) * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Max Drawdown</p>
                    <p className="text-sm text-white">{(((strategy as any).strategy_config?.maxDrawdown || 0.15) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              )}
            </div>

            {/* Trading Pairs */}
            <div className="mb-6">
              <h4
                className="text-sm font-medium text-neon-turquoise mb-4 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTradingPairs(!showTradingPairs);
                }}
              >
                <div className="flex items-center gap-2 uppercase tracking-wider">
                  <Clock className="w-4 h-4" />
                  Trading Pairs
                </div>
                {showTradingPairs ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </h4>
              {showTradingPairs && (
                <div className="flex flex-wrap gap-2 animate-fadeIn">
                  {(strategy as any).selected_pairs?.map((pair: string) => (
                    <div
                      key={pair}
                      className="flex items-center px-3 py-1 bg-gunmetal-800 rounded-md text-xs border border-gunmetal-700/50 min-w-[130px] md:min-w-[130px] mobile-truncate justify-between"
                    >
                      <span className="text-neon-turquoise mr-2">{pair}</span>
                      <div className="border-l border-gunmetal-700 pl-2">
                        <AssetPriceIndicator symbol={pair} compact={true} />
                      </div>
                    </div>
                  )) || (
                    <span className="text-sm text-gray-500">No trading pairs selected</span>
                  )}
                </div>
              )}
            </div>

            {/* Trading Budget */}
            <div>
              <h4
                className="text-sm font-medium text-neon-turquoise mb-4 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBudget(!showBudget);
                }}
              >
                <div className="flex items-center gap-2 uppercase tracking-wider">
                  <DollarSign className="w-4 h-4" />
                  Trading Budget
                </div>
                <span className="text-xs text-gray-400">
                  {showBudget ? 'Hide' : 'Show'}
                </span>
              </h4>
              {showBudget && (
                <div className="bg-gradient-to-r from-gunmetal-800 to-gunmetal-900 p-4 rounded-lg border border-gunmetal-700/50 shadow-inner animate-fadeIn">
                  {budget ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-400">Total Budget</span>
                            <span className="text-md font-bold text-neon-yellow">${budget.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">Available</span>
                            <div className="flex items-center">
                              <span className="text-md font-bold text-neon-turquoise">${budget.available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                              <span className="text-md font-bold text-neon-orange">${budget.allocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              {budget.allocationPercentage !== undefined && (
                                <span className="text-xs text-gray-400 ml-1">({budget.allocationPercentage.toFixed(1)}%)</span>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">Profit/Loss</span>
                            <div className="flex items-center">
                              <span className={`text-md font-bold ${budget.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                ${budget.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              {budget.profitPercentage !== undefined && (
                                <span className={`text-xs ml-1 ${budget.profit >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                                  ({budget.profit >= 0 ? '+' : ''}{budget.profitPercentage.toFixed(2)}%)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Budget progress bar */}
                      {budget.total > 0 && (
                        <div className="mt-2">
                          <div className="h-2 w-full bg-gunmetal-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-neon-orange to-neon-yellow rounded-full"
                              style={{ width: `${Math.min(100, budget.allocationPercentage || 0)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>Allocation</span>
                            <span>{budget.allocationPercentage?.toFixed(1) || 0}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Budget</span>
                      <span className="text-lg font-bold text-neon-yellow">${strategyBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Trade Generation Status */}
            {strategy.status === 'active' && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-neon-turquoise mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <Activity className={`w-4 h-4 ${tradeGenerationStatus.status === 'checking' ? 'text-yellow-400' : tradeGenerationStatus.status === 'generating' ? 'text-green-400' : tradeGenerationStatus.status === 'error' ? 'text-red-400' : 'text-neon-turquoise'}`} />
                  Trade Generation Status
                  {tradeGenerationStatus.status === 'checking' && (
                    <span className="inline-block animate-pulse bg-yellow-400/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full">Checking</span>
                  )}
                  {tradeGenerationStatus.status === 'generating' && (
                    <span className="inline-block animate-pulse bg-green-400/20 text-green-400 text-xs px-2 py-0.5 rounded-full">Generating</span>
                  )}
                </h4>

                <div className={`rounded-lg p-4 ${tradeGenerationStatus.status === 'error' ? 'bg-red-900/20 border border-red-900/30' : 'bg-gunmetal-800/50'}`}>
                  <p className="text-sm text-gray-300">{tradeGenerationStatus.message}</p>

                  {/* Last checked time */}
                  {tradeGenerationStatus.lastChecked && (
                    <p className="text-xs text-gray-400 mt-2">
                      Last checked: {formatTimeAgo(new Date(tradeGenerationStatus.lastChecked))}
                    </p>
                  )}

                  {/* Last generated time */}
                  {tradeGenerationStatus.lastGenerated && (
                    <p className="text-xs text-gray-400">
                      Last trade generated: {formatTimeAgo(new Date(tradeGenerationStatus.lastGenerated))}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Live Trades */}
            {strategy.status === 'active' && (
              <div className="mt-6">
                <h4
                  className="text-sm font-medium text-neon-turquoise mb-4 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTrades(!showTrades);
                  }}
                >
                  <div className="flex items-center gap-2 uppercase tracking-wider">
                    <Activity className="w-4 h-4" />
                    Live Trades
                  </div>
                  <span className="text-xs text-gray-400">
                    {showTrades ? 'Hide' : 'Show'}
                  </span>
                </h4>
                {showTrades && (
                  isLoadingTrades ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-turquoise"></div>
                    </div>
                  ) : strategyTrades.length === 0 ? (
                    <div className="bg-gunmetal-800/50 rounded-lg p-4 text-center">
                      <p className="text-gray-400">No active trades for this strategy</p>
                    </div>
                  ) : (
                    <div className="bg-black border border-gunmetal-800/50 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gunmetal-900/50">
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Symbol</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Side</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Amount</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Entry</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {strategyTrades.map((trade) => (
                            <tr key={trade.id} className="border-t border-gunmetal-700/50 hover:bg-gunmetal-800/50">
                              <td className="px-3 py-2 text-xs text-white">{trade.symbol || '-'}</td>
                              <td className="px-3 py-2 text-xs">
                                <span className={`flex items-center gap-1 ${trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                                  {trade.side === 'buy' ? (
                                    <ArrowUpRight className="w-3 h-3" />
                                  ) : (
                                    <ArrowDownRight className="w-3 h-3" />
                                  )}
                                  {trade.side}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-white">
                                {trade.amount !== undefined ? trade.amount.toFixed(6) : '-'}
                              </td>
                              <td className="px-3 py-2 text-xs text-white">
                                {trade.entryPrice !== undefined ? `$${trade.entryPrice.toFixed(2)}` : '-'}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs ${trade.status === 'executed' ? 'bg-green-500/20 text-green-400' : trade.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}
                                  title={trade.status === 'executed' ? `Executed: ${trade.executedAt ? new Date(trade.executedAt).toLocaleString() : 'Unknown'}` : ''}
                                >
                                  {trade.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-400" title={`Created: ${trade.createdAt ? new Date(trade.createdAt).toLocaleString() : 'Unknown'}`}>
                                {trade.createdAt ? formatTimeAgo(new Date(trade.createdAt)) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            )}

            {error && (
              <div className="mt-4 text-red-400 text-sm">{error}</div>
            )}

            <div className="flex justify-end mt-4 pt-4 border-t border-gunmetal-800/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(strategy);
                  }}
                  className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                  title="Edit Strategy"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No pulsing animation */}
      </motion.div>

      {/* Add Budget Modal */}
      {showBudgetModal && selectedStrategy && (
        <BudgetModal
          onConfirm={handleBudgetSubmit}
          onCancel={() => {
            setShowBudgetModal(false);
            setSelectedStrategy(null);
          }}
          maxBudget={availableBalance} // Use actual available balance
          isSubmitting={isSubmittingBudget}
        />
      )}

      {/* Budget Adjustment Modal */}
      {showBudgetAdjustmentModal && selectedStrategy && (
        <BudgetAdjustmentModal
          strategy={selectedStrategy}
          requestedBudget={strategyBudget}
          availableBalance={availableBalance}
          onConfirm={async (budget) => {
            try {
              setIsSubmittingBudget(true);
              setError(null);

              await tradeService.setBudget(selectedStrategy.id, budget);
              setStrategyBudget(budget.total); // Update the local budget state
              await activateStrategyWithBudget(selectedStrategy, budget);

              setShowBudgetAdjustmentModal(false);
              setSelectedStrategy(null);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to activate strategy';
              setError(errorMessage);
              logService.log('error', 'Failed to activate strategy with adjusted budget', error, 'StrategyCard');
            } finally {
              setIsSubmittingBudget(false);
            }
          }}
          onCancel={() => {
            setShowBudgetAdjustmentModal(false);
            setSelectedStrategy(null);
          }}
          riskLevel={selectedStrategy.riskLevel}
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
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
