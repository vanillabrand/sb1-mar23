import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Activity, DollarSign, BarChart3, Clock, Edit, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { RiskLevelBadge } from './risk/RiskLevelBadge';
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
import { strategyMetricsService, StrategyMetrics } from '../lib/strategy-metrics-service';
import { directDeleteStrategy } from '../lib/direct-delete';
import { BudgetModal } from './BudgetModal';
import { BudgetAdjustmentModal } from './BudgetAdjustmentModal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { MarketTypeBadge } from './ui/MarketTypeBadge';
import AvailableBalanceDisplay from './AvailableBalanceDisplay';
import { BudgetDebugger } from './BudgetDebugger';
import BudgetHistoryChart from './BudgetHistoryChart';
import BudgetAlertsList from './BudgetAlertsList';
import { TradeBudgetPanel } from './TradeBudgetPanel';
import BudgetValidationStatus from './BudgetValidationStatus';
import TradeExecutionMetrics from './TradeExecutionMetrics';
import { StrategyActivationWizard } from './StrategyActivationWizard';
import { ErrorDisplay } from './ErrorDisplay';
import { TradeList } from './TradeList';
import { SimplifiedTradeCreator } from './SimplifiedTradeCreator';
import { TradeFlowDiagram } from './TradeFlowDiagram';
import { RealTimeTradeAnalytics } from './RealTimeTradeAnalytics';
import type { RiskLevel, Strategy, StrategyBudget, Trade, MarketType } from '../lib/types';
import { standardizeAssetPairFormat } from '../lib/format-utils';

// Extended Trade type with additional properties for timestamps
interface ExtendedTrade extends Trade {
  createdAt?: string;
  executedAt?: string | null;
}

// Helper function is now replaced by RiskLevelBadge component

// Helper function to get risk level from strategy (handles both riskLevel and risk_level properties)
const getStrategyRiskLevel = (strategy: Strategy): RiskLevel => {
  // Check for riskLevel property first
  if (strategy.riskLevel) {
    return strategy.riskLevel;
  }

  // Then check for risk_level property (used in some AI-generated strategies)
  if ((strategy as any).risk_level) {
    return (strategy as any).risk_level as RiskLevel;
  }

  // Default to Medium if no risk level is found
  return 'Medium';
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
  const [showActivationWizard, setShowActivationWizard] = useState(false);
  const [showTradeCreator, setShowTradeCreator] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [strategyBudget, setStrategyBudget] = useState<number>(0);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [strategyTrades, setStrategyTrades] = useState<ExtendedTrade[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<StrategyMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState<boolean>(false);

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

  // Initialize and subscribe to strategy metrics service
  useEffect(() => {
    const initializeMetrics = async () => {
      try {
        setIsLoadingMetrics(true);

        // Initialize the metrics service if not already initialized
        if (!strategyMetricsService.getAllStrategyMetrics().length) {
          await strategyMetricsService.initialize();
        }

        // Get initial metrics
        const initialMetrics = strategyMetricsService.getStrategyMetrics(strategy.id);
        if (initialMetrics) {
          setMetrics(initialMetrics);
        } else {
          // If no metrics exist yet, refresh them
          const refreshedMetrics = await strategyMetricsService.refreshStrategyMetrics(strategy.id);
          if (refreshedMetrics) {
            setMetrics(refreshedMetrics);
          }
        }

        // Subscribe to metrics updates for this strategy
        const handleMetricsUpdate = (strategyId: string, updatedMetrics: StrategyMetrics) => {
          if (strategyId === strategy.id) {
            setMetrics(updatedMetrics);
          }
        };

        strategyMetricsService.on('metricsUpdated', handleMetricsUpdate);

        return () => {
          strategyMetricsService.off('metricsUpdated', handleMetricsUpdate);
        };
      } catch (error) {
        logService.log('error', `Failed to initialize metrics for strategy ${strategy.id}`, error, 'StrategyCard');
      } finally {
        setIsLoadingMetrics(false);
      }
    };

    initializeMetrics();
  }, [strategy.id]);

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

    // Create a debounced function to update the budget state
    const debounceBudgetUpdate = (total: number) => {
      // Use a timestamp to prevent multiple updates in the same render cycle
      const now = Date.now();
      const lastUpdate = (window as any).lastBudgetUpdate?.[strategy.id] || 0;

      if (now - lastUpdate < 500) {
        // Skip this update if we've updated recently
        return;
      }

      // Store the last update time
      if (!(window as any).lastBudgetUpdate) {
        (window as any).lastBudgetUpdate = {};
      }
      (window as any).lastBudgetUpdate[strategy.id] = now;

      // Update the state
      setStrategyBudget(total);
    };

    // Subscribe to budget updates with debouncing
    const handleBudgetUpdate = (event: any) => {
      // Handle direct budget updates from trade service
      if (event.strategyId === strategy.id) {
        const budget = tradeService.getBudget(strategy.id);
        if (budget) {
          debounceBudgetUpdate(budget.total);

          // Only log occasionally to reduce spam
          if (Date.now() % 10 === 0) {
            logService.log('info', `Budget updated via event for strategy ${strategy.id}`, { budget }, 'StrategyCard');
          }
        }
      }

      // Handle global budget updates from TradeMonitor
      if (event.budgets && event.budgets[strategy.id]) {
        // Only log occasionally to reduce spam
        if (Date.now() % 10 === 0) {
          logService.log('info', `Budget updated from global event for strategy ${strategy.id}`, { budget: event.budgets[strategy.id] }, 'StrategyCard');
        }
      }
    };

    // Subscribe to global budget updates with debouncing
    const handleGlobalBudgetUpdate = (event: any) => {
      if (event.strategyId === strategy.id && event.budget) {
        debounceBudgetUpdate(event.budget.total);

        // Only log occasionally to reduce spam
        if (Date.now() % 10 === 0) {
          logService.log('info', `Budget updated via global event for strategy ${strategy.id}`, { budget: event.budget }, 'StrategyCard');
        }
      }
    };

    // Subscribe to trade updates - no longer needed as trades come from props
    const handleTradeUpdate = () => {
      // Trades are now provided via props
    };

    walletBalanceService.on('balancesUpdated', handleBalanceUpdate);
    tradeService.on('budgetUpdated', handleBudgetUpdate);
    eventBus.subscribe('budgetUpdated', handleBudgetUpdate);
    eventBus.subscribe('budget:global:updated', handleGlobalBudgetUpdate);
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
      eventBus.unsubscribe('budget:global:updated', handleGlobalBudgetUpdate);
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
          // Create a stable ID that won't change on re-renders
          // Use a hash of the strategy ID to ensure uniqueness
          const strategyHash = strategy.id.split('-')[0] || 'unknown';
          const stableId = `placeholder-${strategyHash}-${Date.now()}`;

          const pendingTrade: ExtendedTrade = {
            id: stableId,
            symbol: (strategy as any).selected_pairs?.[0] || 'BTC/USDT',
            side: 'buy',
            status: 'pending',
            entryPrice: 50000, // Fixed value to avoid constant changes
            timestamp: Date.now(),
            createdAt: new Date().toISOString(),
            executedAt: null,
            strategyId: strategy.id,
            // Add amount field with a reasonable default value
            amount: 0.1
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
      // Format the trades with proper normalization of all fields
      const formattedTrades = trades.map((trade, index) => {
        // Create a stable ID if one doesn't exist
        let tradeId = trade.id;
        if (!tradeId) {
          // Use a combination of strategy ID, symbol, and index to create a stable ID
          const symbol = trade.symbol || trade.pair || 'BTC/USDT';
          const symbolKey = symbol.replace(/[^a-zA-Z0-9]/g, '');
          const strategyHash = strategy.id.split('-')[0] || 'unknown';

          // Include timestamp in the ID to ensure uniqueness
          const timestamp = trade.timestamp || Date.now();

          // Create a stable ID that includes enough unique information
          tradeId = `${trade.status || 'unknown'}-${symbolKey}-${index}-${strategyHash}-${timestamp}`;
        }

        return {
          ...trade,
          id: tradeId,
          createdAt: trade.created_at || trade.datetime || trade.createdAt || new Date(trade.timestamp).toISOString(),
          executedAt: trade.executed_at || trade.executedAt || (trade.status === 'executed' ? new Date().toISOString() : null),
          entryPrice: trade.entry_price || trade.entryPrice || trade.price || 0,
          exitPrice: trade.exit_price || trade.exitPrice || 0,
          stopLoss: trade.stop_loss || trade.stopLoss,
          takeProfit: trade.take_profit || trade.takeProfit,
          strategyId: strategy.id,
          // Ensure amount is properly set
          amount: trade.amount || trade.entry_amount || trade.quantity || trade.size || 0.1,
          // Ensure symbol is set
          symbol: trade.symbol || trade.pair || 'BTC/USDT',
          // Ensure side is set
          side: trade.side || 'buy',
          // Ensure status is set
          status: trade.status || 'pending'
        };
      });

      // Remove duplicates by ID
      const uniqueTrades = [];
      const tradeIds = new Set();

      for (const trade of formattedTrades) {
        if (!tradeIds.has(trade.id)) {
          tradeIds.add(trade.id);
          uniqueTrades.push(trade);
        }
      }

      // Use the unique trades instead of all formatted trades
      const processedTrades = uniqueTrades;

      // Create a map of existing trades for faster lookup
      const existingTradesMap = strategyTrades.reduce((map, trade) => {
        map[trade.id] = trade;
        return map;
      }, {} as Record<string, ExtendedTrade>);

      // Create a map of new trades for faster lookup
      const newTradesMap = processedTrades.reduce((map, trade) => {
        map[trade.id] = trade;
        return map;
      }, {} as Record<string, ExtendedTrade>);

      // Determine which trades are new, updated, or removed
      const newTradeIds = new Set(processedTrades.map(t => t.id));
      const existingTradeIds = new Set(strategyTrades.map(t => t.id));

      // Find trades that are new (in new set but not in existing)
      const addedTrades = processedTrades.filter(t => !existingTradeIds.has(t.id));

      // Find trades that are updated (in both sets but with changes)
      const updatedTrades = processedTrades.filter(t => {
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

      // Show the new activation wizard instead of the budget modal
      logService.log('info', `Showing activation wizard for strategy ${strategy.id}`, null, 'StrategyCard');
      setShowActivationWizard(true);
      setIsActivating(false);
      return;

      // The wizard will handle the activation process
      // The code below is kept for reference but will not be executed

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
        // 1. Get all trades for this strategy (not just active ones)
        const isDemo = demoService.isInDemoMode();

        // First get active trades from trade manager
        const activeTrades = tradeManager.getActiveTradesForStrategy(strategy.id);

        // Then get all trades from database to ensure we don't miss any
        const { data: dbTrades, error: fetchError } = await supabase
          .from('trades')
          .select('*')
          .eq('strategy_id', strategy.id)
          .in('status', ['pending', 'open', 'executed']);

        if (fetchError) {
          logService.log('warn', `Error fetching trades from database: ${fetchError.message}`, null, 'StrategyCard');
        }

        // Combine trades from both sources, removing duplicates
        const allTradeIds = new Set();
        const allTrades = [];

        // Add trades from trade manager
        for (const trade of activeTrades) {
          if (!allTradeIds.has(trade.id)) {
            allTradeIds.add(trade.id);
            allTrades.push(trade);
          }
        }

        // Add trades from database
        if (dbTrades) {
          for (const trade of dbTrades) {
            if (!allTradeIds.has(trade.id)) {
              allTradeIds.add(trade.id);
              allTrades.push(trade);
            }
          }
        }

        logService.log('info', `Found ${allTrades.length} trades to close for strategy ${strategy.id} in ${isDemo ? 'demo' : 'live'} mode`, null, 'StrategyCard');

        // 2. Close all trades
        if (allTrades.length > 0) {
          try {
            // Close each trade
            for (const trade of allTrades) {
              try {
                // First try to close the trade through the trade engine
                try {
                  await tradeEngine.closeTrade(trade.id, 'Strategy deactivated');
                  logService.log('info', `Closed trade ${trade.id} for strategy ${strategy.id} through trade engine`, null, 'StrategyCard');
                } catch (engineError) {
                  logService.log('warn', `Failed to close trade ${trade.id} through trade engine, trying direct database update`, engineError, 'StrategyCard');

                  // If trade engine fails, update the trade directly in the database
                  const { error: updateError } = await supabase
                    .from('trades')
                    .update({
                      status: 'closed',
                      close_reason: 'Strategy deactivated',
                      closed_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', trade.id);

                  if (updateError) {
                    throw new Error(`Failed to update trade in database: ${updateError.message}`);
                  }

                  // Release budget for this trade
                  const tradeCost = trade.quantity * trade.price;
                  await tradeService.releaseBudgetFromTrade(strategy.id, tradeCost, 0, trade.id, 'closed');

                  logService.log('info', `Closed trade ${trade.id} for strategy ${strategy.id} through direct database update`, null, 'StrategyCard');
                }
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

        // 5. Remove from appropriate trade generator based on mode
        try {
          if (isDemo) {
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

        // 6. Remove from strategy monitor
        try {
          strategyMonitor.removeStrategy(strategy.id);
        } catch (monitorError) {
          logService.log('warn', 'Error removing from strategy monitor, continuing with deactivation', monitorError, 'StrategyCard');
        }

        // 7. Remove from trade engine
        try {
          await tradeEngine.removeStrategy(strategy.id);
        } catch (engineError) {
          logService.log('warn', 'Error removing from trade engine, continuing with deactivation', engineError, 'StrategyCard');
        }

        // 8. In demo mode, ensure all trades are removed from the database
        if (isDemo) {
          try {
            // Remove all trades for this strategy
            await tradeService.removeTradesByStrategy(strategy.id);
            logService.log('info', `Removed all trades for strategy ${strategy.id} in demo mode`, null, 'StrategyCard');
          } catch (removeError) {
            logService.log('warn', `Error removing trades for strategy ${strategy.id} in demo mode`, removeError, 'StrategyCard');
          }
        }
      }

      // 9. Refresh data
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

      // Determine the selected pairs
      let selectedPairs = enhancedStrategy.selected_pairs || [];

      // If selected_pairs is empty, try to get from strategy_config.assets
      if (selectedPairs.length === 0 && enhancedStrategy.strategy_config.assets) {
        selectedPairs = enhancedStrategy.strategy_config.assets;
      }

      // If still empty, use default
      if (selectedPairs.length === 0) {
        selectedPairs = ['BTC/USDT'];
      }

      // Ensure pairs are in the correct format (BTC/USDT instead of BTC_USDT)
      selectedPairs = selectedPairs.map(pair =>
        pair.includes('_') ? pair.replace('_', '/') : pair
      );

      // Set all pair-related fields
      enhancedStrategy.selected_pairs = selectedPairs;
      enhancedStrategy.strategy_config.assets = selectedPairs;

      // Ensure config.pairs exists for strategy-monitor
      if (!enhancedStrategy.strategy_config.config) {
        enhancedStrategy.strategy_config.config = {};
      }

      enhancedStrategy.strategy_config.config.pairs = selectedPairs;

      // Ensure market_type and marketType are both set
      if (enhancedStrategy.market_type && !enhancedStrategy.marketType) {
        enhancedStrategy.marketType = enhancedStrategy.market_type;
      } else if (enhancedStrategy.marketType && !enhancedStrategy.market_type) {
        enhancedStrategy.market_type = enhancedStrategy.marketType;
      } else if (!enhancedStrategy.market_type && !enhancedStrategy.marketType) {
        enhancedStrategy.market_type = 'spot';
        enhancedStrategy.marketType = 'spot';
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
                <RiskLevelBadge level={getStrategyRiskLevel(strategy)} size="sm" />
              </div>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{strategy.description || 'No description available'}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 max-w-full overflow-hidden">
                <span className={`text-xs px-2 py-0.5 rounded-full ${strategy.status === 'active' ? 'bg-neon-turquoise/10 text-neon-turquoise' : 'bg-gunmetal-700 text-gray-400'}`}>
                  {strategy.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                </span>
                <MarketTypeBadge marketType={strategy.market_type || strategy.marketType || 'spot'} />
                {strategy.status === 'active' && (
                  <AvailableBalanceDisplay
                    marketType={strategy.market_type || strategy.marketType || 'spot'}
                    compact
                    showLabel={false}
                    className="px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400 flex items-center"
                  />
                )}
                {/* Trading pairs as lozenges with price indicators */}
                {(strategy.selected_pairs && strategy.selected_pairs.length > 0) ? (
                  <>
                    {strategy.selected_pairs.slice(0, 3).map((pair, index) => (
                      <div key={index} className="flex items-center text-xs px-3 py-0.5 bg-gunmetal-800 text-gray-300 rounded-full whitespace-nowrap mobile-truncate min-w-[110px] md:min-w-[110px] justify-between">
                        <span className="mr-2">{standardizeAssetPairFormat(pair)}</span>
                        <div className="border-l border-gunmetal-700 pl-2">
                          <AssetPriceIndicator symbol={pair} compact={true} />
                        </div>
                      </div>
                    ))}
                    {strategy.selected_pairs.length > 3 && (
                      <span className="text-xs px-3 py-0.5 bg-gunmetal-800 text-gray-300 rounded-full whitespace-nowrap min-w-[90px] text-center">
                        +{strategy.selected_pairs.length - 3} more
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs px-3 py-0.5 bg-gunmetal-800 text-gray-300 rounded-full whitespace-nowrap">
                    No trading pairs
                  </span>
                )}
                {strategy.status !== 'active' && (
                  <span className="text-xs text-gray-400 ml-auto">
                    Potential profit: <span className="text-neon-yellow">
                      +{getPotentialProfit(strategy)}%
                    </span>
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
              <h4 className="text-sm font-medium text-neon-turquoise mb-4 flex items-center gap-2 uppercase tracking-wider">
                <BarChart3 className="w-4 h-4" />
                Trading Parameters
              </h4>
              {/* Always show trading parameters */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
                  <div>
                    <p className="text-xs text-gray-500">Leverage</p>
                    <p className="text-sm text-white">
                      {(() => {
                        // Get leverage from various possible locations in the strategy config
                        const leverage = (strategy as any).strategy_config?.trade_parameters?.leverage ||
                                        (strategy as any).strategy_config?.leverage ||
                                        1;
                        // Ensure it's a valid number
                        return isNaN(leverage) ? '1x' : `${leverage}x`;
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Position Size</p>
                    <p className="text-sm text-white">
                      {(() => {
                        // Get position size from various possible locations in the strategy config
                        const positionSize = (strategy as any).strategy_config?.trade_parameters?.position_size ||
                                            (strategy as any).strategy_config?.riskManagement?.maxPositionSize ||
                                            (strategy as any).strategy_config?.positionSize ||
                                            0.1;
                        // Convert to percentage and ensure it's a valid number
                        const positionSizePercent = positionSize * 100;
                        return isNaN(positionSizePercent) ? '10%' : `${positionSizePercent.toFixed(0)}%`;
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Confidence Threshold</p>
                    <p className="text-sm text-white">
                      {(() => {
                        // Get confidence threshold from various possible locations in the strategy config
                        const confidenceThreshold = (strategy as any).strategy_config?.trade_parameters?.confidence_factor ||
                                                   (strategy as any).strategy_config?.validation?.minConfidence ||
                                                   (strategy as any).strategy_config?.confidenceThreshold ||
                                                   0.7;
                        // Convert to percentage and ensure it's a valid number
                        const confidenceThresholdPercent = confidenceThreshold * 100;
                        return isNaN(confidenceThresholdPercent) ? '70%' : `${confidenceThresholdPercent.toFixed(0)}%`;
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Timeframe</p>
                    <p className="text-sm text-white">
                      {(() => {
                        // Get timeframe from various possible locations in the strategy config
                        const timeframe = (strategy as any).strategy_config?.timeframes?.execution ||
                                         (strategy as any).strategy_config?.timeframe ||
                                         '1h';
                        // Ensure it's a valid timeframe
                        return timeframe || '1h';
                      })()}
                    </p>
                  </div>
                </div>
            </div>

            {/* Risk Management */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-neon-turquoise mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Activity className="w-4 h-4" />
                Risk Management
              </h4>
              {/* Always show risk management */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
                  <div>
                    <p className="text-xs text-gray-500">Stop Loss</p>
                    <p className="text-sm text-white">
                      {(() => {
                        // Get stop loss from various possible locations in the strategy config
                        const stopLoss = (strategy as any).strategy_config?.risk_management?.stop_loss ||
                                        (strategy as any).strategy_config?.stopLoss ||
                                        0.03;
                        // Convert to percentage and ensure it's a valid number
                        const stopLossPercent = stopLoss * 100;
                        return isNaN(stopLossPercent) ? '3.0%' : `${stopLossPercent.toFixed(1)}%`;
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Take Profit</p>
                    <p className="text-sm text-white">
                      {(() => {
                        // Get take profit from various possible locations in the strategy config
                        const takeProfit = (strategy as any).strategy_config?.risk_management?.take_profit ||
                                          (strategy as any).strategy_config?.takeProfit ||
                                          0.09;
                        // Convert to percentage and ensure it's a valid number
                        const takeProfitPercent = takeProfit * 100;
                        return isNaN(takeProfitPercent) ? '9.0%' : `${takeProfitPercent.toFixed(1)}%`;
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Trailing Stop</p>
                    <p className="text-sm text-white">
                      {(() => {
                        // Get trailing stop from various possible locations in the strategy config
                        const trailingStop = (strategy as any).strategy_config?.risk_management?.trailing_stop_loss ||
                                            (strategy as any).strategy_config?.trailingStop ||
                                            0.02;
                        // Convert to percentage and ensure it's a valid number
                        const trailingStopPercent = trailingStop * 100;
                        return isNaN(trailingStopPercent) ? '2.0%' : `${trailingStopPercent.toFixed(1)}%`;
                      })()}
                    </p>
                  </div>
                </div>
            </div>

            {/* Performance Metrics */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-neon-pink mb-4 flex items-center gap-2 uppercase tracking-wider">
                <BarChart3 className="w-4 h-4" />
                Performance Metrics
              </h4>
              {isLoadingMetrics ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-neon-pink"></div>
                </div>
              ) : metrics ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
                  <div>
                    <p className="text-xs text-gray-500">Current Value</p>
                    <p className="text-sm text-white">
                      {(() => {
                        // Get current value from metrics or strategy
                        const currentValue = metrics?.currentValue || (strategy as any).metrics?.equity || 0;
                        // Format with 2 decimal places and handle NaN
                        return `$${isNaN(currentValue) ? '0.00' : Number(currentValue).toFixed(2)}`;
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Profit/Loss</p>
                    <p className={`text-sm ${(() => {
                      // Determine if profit is positive or negative
                      const totalChange = metrics?.totalChange || (strategy as any).metrics?.pnl || 0;
                      return isNaN(totalChange) || totalChange >= 0 ? 'text-green-400' : 'text-red-400';
                    })()}`}>
                      {(() => {
                        // Get total change from metrics or strategy
                        const totalChange = metrics?.totalChange || (strategy as any).metrics?.pnl || 0;
                        // Format with sign and 2 decimal places, handle NaN
                        const formattedChange = isNaN(totalChange) ? '+0.00' :
                          (totalChange >= 0 ? '+' : '') + Number(totalChange).toFixed(2);

                        // Get percent change from metrics or strategy
                        const percentChange = metrics?.percentChange || (strategy as any).performance || 0;
                        // Format with 2 decimal places, handle NaN
                        const formattedPercent = isNaN(percentChange) ? '0.00' : Number(percentChange).toFixed(2);

                        return `${formattedChange} (${formattedPercent}%)`;
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Win Rate</p>
                    <p className="text-sm text-white">
                      {(() => {
                        // Get win rate from metrics or strategy
                        let winRate = metrics?.winRate;
                        if (winRate === undefined && (strategy as any).metrics?.winRate !== undefined) {
                          // Convert from decimal to percentage if needed
                          winRate = (strategy as any).metrics.winRate * 100;
                        } else {
                          winRate = winRate || 0;
                        }
                        // Format with 1 decimal place and handle NaN
                        return `${isNaN(winRate) ? '0.0' : Number(winRate).toFixed(1)}%`;
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Trades</p>
                    <p className="text-sm text-white">
                      {(() => {
                        // Get total trades from metrics or strategy
                        const totalTrades = metrics?.totalTrades || (strategy as any).trades?.total || 0;
                        // Handle NaN
                        return isNaN(totalTrades) ? '0' : totalTrades;
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Active Trades</p>
                    <p className="text-sm text-white">
                      {(() => {
                        // Get active trades from metrics or strategy
                        const activeTrades = metrics?.activeTrades || (strategy as any).trades?.active || 0;
                        // Handle NaN
                        return isNaN(activeTrades) ? '0' : activeTrades;
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Trade Profit</p>
                    <p className={`text-sm ${(() => {
                      // Determine if avg profit is positive or negative
                      const avgProfit = metrics?.avgTradeProfit || (strategy as any).metrics?.averageProfit || 0;
                      return isNaN(avgProfit) || avgProfit >= 0 ? 'text-green-400' : 'text-red-400';
                    })()}`}>
                      {(() => {
                        // Get avg trade profit from metrics or strategy
                        const avgProfit = metrics?.avgTradeProfit || (strategy as any).metrics?.averageProfit || 0;
                        // Format with sign and 2 decimal places, handle NaN
                        return isNaN(avgProfit) ? '+0.00' :
                          (avgProfit >= 0 ? '+' : '') + Number(avgProfit).toFixed(2);
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Duration</p>
                    <p className="text-sm text-white">
                      {(() => {
                        // Get avg duration from metrics or strategy
                        let avgDuration = metrics?.avgTradeDuration;
                        if (avgDuration === undefined && (strategy as any).trades?.avgDuration !== undefined) {
                          avgDuration = (strategy as any).trades.avgDuration;
                        } else {
                          avgDuration = avgDuration || 0;
                        }

                        // Handle NaN
                        if (isNaN(avgDuration)) return '0m';

                        // Format as hours or minutes
                        if (avgDuration > 60) {
                          return `${(avgDuration / 60).toFixed(1)}h`;
                        } else {
                          return `${Math.floor(avgDuration)}m`;
                        }
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Portfolio Contribution</p>
                    <p className="text-sm text-white">
                      {(() => {
                        // Get portfolio contribution from metrics or strategy
                        const contribution = metrics?.contribution || (strategy as any).metrics?.contribution || 0;
                        // Format with 1 decimal place and handle NaN
                        return `${isNaN(contribution) ? '0.0' : Number(contribution).toFixed(1)}%`;
                      })()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400">
                  No performance data available yet
                </div>
              )}
            </div>

            {/* Risk Limits */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-neon-yellow mb-4 flex items-center gap-2 uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                Risk Limits
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
                <div>
                  <p className="text-xs text-gray-500">Max Drawdown</p>
                  <p className="text-sm text-white">
                    {(() => {
                      // Get max drawdown from various possible locations in the strategy config
                      const maxDrawdown = (strategy as any).strategy_config?.risk_management?.max_drawdown ||
                                         (strategy as any).strategy_config?.maxDrawdown ||
                                         0.15;
                      // Convert to percentage and ensure it's a valid number
                      const maxDrawdownPercent = maxDrawdown * 100;
                      return isNaN(maxDrawdownPercent) ? '15.0%' : `${maxDrawdownPercent.toFixed(1)}%`;
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Max Open Trades</p>
                  <p className="text-sm text-white">
                    {(() => {
                      // Get max open trades from strategy config
                      const maxOpenTrades = (strategy as any).strategy_config?.risk_management?.max_open_trades ||
                                           (strategy as any).strategy_config?.maxOpenTrades;
                      // Return "Unlimited" if not set or invalid
                      return maxOpenTrades && !isNaN(maxOpenTrades) ? maxOpenTrades : 'Unlimited';
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Trade Frequency</p>
                  <p className="text-sm text-white">
                    {(() => {
                      // Get trade frequency from strategy config
                      const tradeFrequency = (strategy as any).strategy_config?.risk_management?.trade_frequency ||
                                            (strategy as any).strategy_config?.tradeFrequency;
                      // Return "Unlimited" if not set or invalid
                      return tradeFrequency && !isNaN(tradeFrequency) ? tradeFrequency : 'Unlimited';
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Budget Allocation</p>
                  <p className="text-sm text-white">
                    {(() => {
                      // Get budget allocation from metrics or strategy
                      const budgetAllocation = metrics?.budget?.allocated || (strategy as any).metrics?.equity || 0;
                      // Format with 2 decimal places and handle NaN
                      return `$${isNaN(budgetAllocation) ? '0.00' : Number(budgetAllocation).toFixed(2)}`;
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {/* Trading Pairs */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-neon-turquoise mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                Trading Pairs
              </h4>
              {/* Always show trading pairs */}
                <div className="flex flex-wrap gap-2 animate-fadeIn">
                  {(strategy.selected_pairs && strategy.selected_pairs.length > 0) ? (
                    strategy.selected_pairs.map((pair: string) => (
                      <div
                        key={pair}
                        className="flex items-center px-3 py-1 bg-gunmetal-800 rounded-md text-xs border border-gunmetal-700/50 min-w-[130px] md:min-w-[130px] mobile-truncate justify-between"
                      >
                        <span className="text-neon-turquoise mr-2">{standardizeAssetPairFormat(pair)}</span>
                        <div className="border-l border-gunmetal-700 pl-2">
                          <AssetPriceIndicator symbol={pair} compact={true} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">No trading pairs selected</span>
                  )}
                </div>
            </div>

            {/* Trading Budget */}
            <div>
              <h4 className="text-sm font-medium text-neon-turquoise mb-4 flex items-center gap-2 uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                Trading Budget
              </h4>

              {/* Use the new TradeBudgetPanel component */}
              <TradeBudgetPanel
                strategyId={strategy.id}
                trades={strategyTrades}
                className="animate-fadeIn"
              />

              {/* Additional budget information */}
              <div className="mt-4 space-y-4">
                {/* Budget Validation Status */}
                <div className="p-3 bg-gunmetal-800 rounded-lg">
                  <BudgetValidationStatus strategyId={strategy.id} />
                </div>

                {/* Trade Execution Metrics */}
                <div>
                  <TradeExecutionMetrics strategyId={strategy.id} />
                </div>

                {/* Budget History Chart */}
                <div>
                  <div className="text-sm font-medium text-gray-300 mb-2">Budget History</div>
                  <BudgetHistoryChart strategyId={strategy.id} days={7} height={150} showLegend={false} />
                </div>

                {/* Budget Alerts */}
                <div>
                  <div className="text-sm font-medium text-gray-300 mb-2">Budget Alerts</div>
                  <BudgetAlertsList strategyId={strategy.id} limit={3} />
                </div>

                {/* Add Budget Debugger in development mode */}
                {import.meta.env.DEV && (
                  <div>
                    <BudgetDebugger strategyId={strategy.id} />
                  </div>
                )}
              </div>
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
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-gray-300">{tradeGenerationStatus.message}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-gunmetal-700 text-neon-turquoise">
                      {strategyTrades.length} trade{strategyTrades.length !== 1 ? 's' : ''}
                    </span>
                  </div>

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

            {/* Real-Time Analytics Dashboard */}
            {strategy.status === 'active' && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-neon-turquoise mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <Activity className="w-4 h-4" />
                  Real-Time Analytics
                </h4>

                {/* Add the RealTimeTradeAnalytics component */}
                <RealTimeTradeAnalytics
                  strategy={strategy}
                  trades={strategyTrades}
                  budget={budget}
                  className="mb-6"
                />

                <h4 className="text-sm font-medium text-neon-turquoise mb-4 flex items-center gap-2 uppercase tracking-wider mt-6">
                  <Activity className="w-4 h-4" />
                  Live Trades
                </h4>
                {/* Use the TradeList component */}
                {isLoadingTrades ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-turquoise"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Trade Flow Diagram - Only show when a trade is selected */}
                    {selectedTrade && (
                      <div className="bg-gunmetal-800/50 rounded-lg p-4 mb-4">
                        <TradeFlowDiagram trade={selectedTrade} />
                      </div>
                    )}

                    {/* Trade List */}
                    <TradeList
                      trades={strategyTrades}
                      strategy={strategy}
                      onCreateTrade={(strategy) => {
                        setSelectedStrategy(strategy);
                        setShowTradeCreator(true);
                      }}
                      onSelectTrade={(trade) => setSelectedTrade(trade)}
                      selectedTradeId={selectedTrade?.id}
                      itemsPerPage={5}
                    />
                  </div>
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

      {/* Strategy Activation Wizard */}
      {showActivationWizard && (
        <StrategyActivationWizard
          strategy={strategy}
          onComplete={(success) => {
            setShowActivationWizard(false);
            if (success && onRefresh) {
              onRefresh();
            }
          }}
          onCancel={() => {
            setShowActivationWizard(false);
          }}
          maxBudget={availableBalance}
        />
      )}

      {/* Simplified Trade Creator */}
      {showTradeCreator && selectedStrategy && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <SimplifiedTradeCreator
            strategy={selectedStrategy}
            onSuccess={() => {
              setShowTradeCreator(false);
              setSelectedStrategy(null);
              // Refresh trades
              fetchTrades();
            }}
            onCancel={() => {
              setShowTradeCreator(false);
              setSelectedStrategy(null);
            }}
          />
        </div>
      )}

      {/* Add Budget Modal (legacy) */}
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
          riskLevel={getStrategyRiskLevel(selectedStrategy)}
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

// Helper function to get the potential profit from a strategy
function getPotentialProfit(strategy: any): number {
  // Check all possible locations for potential profit
  const potentialProfit =
    // Check in metrics
    (strategy.metrics?.potentialProfit) ||
    (strategy.metrics?.averageProfit) ||
    // Check in strategy_config
    (strategy.strategy_config?.metrics?.potentialProfit) ||
    (strategy.strategy_config?.metrics?.averageProfit) ||
    // Check in takeProfit fields
    (strategy.strategy_config?.takeProfit) ||
    (strategy.strategy_config?.riskManagement?.takeProfit) ||
    // Parse from string if needed
    (typeof strategy.strategy_config?.riskManagement?.takeProfit === 'string' ?
      parseFloat(strategy.strategy_config.riskManagement.takeProfit) : 0) ||
    // Default value
    5;

  // If it's a string with a percentage sign, parse it
  if (typeof potentialProfit === 'string' && potentialProfit.includes('%')) {
    return parseFloat(potentialProfit.replace('%', ''));
  }

  // If it's a decimal (e.g., 0.05 for 5%), multiply by 100
  if (typeof potentialProfit === 'number' && potentialProfit < 1) {
    return potentialProfit * 100;
  }

  return potentialProfit;
}
