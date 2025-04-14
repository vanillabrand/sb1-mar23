import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Zap,
  XCircle,
  Clock,
  ToggleLeft,
  ToggleRight,
  Wallet
} from 'lucide-react';
import { tradeService } from '../lib/trade-service';
import { strategyService } from '../lib/strategy-service';
import { logService } from '../lib/log-service';
import { demoService } from '../lib/demo-service';
import { supabase } from '../lib/supabase';
import { websocketService } from '../lib/websocket-service';
import { walletBalanceService } from '../lib/wallet-balance-service';
import { eventBus } from '../lib/event-bus';
import { BudgetConfirmModal } from './BudgetConfirmModal';
import { getBasePrice, standardizeSymbolFormat } from '../lib/format-utils';
import type { Strategy, Trade, StrategyBudget } from '../lib/types';

interface TradeMonitorProps {
  strategies: Strategy[];
  className?: string;
}

export const NewTradeMonitor: React.FC<TradeMonitorProps> = ({
  strategies: initialStrategies,
  className = ''
}) => {
  // Core state
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies || []);
  const [activeTrades, setActiveTrades] = useState<Record<string, Trade[]>>({});
  const [closedTrades, setClosedTrades] = useState<Record<string, Trade[]>>({});
  const [budgets, setBudgets] = useState<Record<string, StrategyBudget>>({});

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);
  const [isGeneratingTrades, setIsGeneratingTrades] = useState<Record<string, boolean>>({});

  // WebSocket state
  const [wsConnected, setWsConnected] = useState(false);
  const [subscribedStrategies, setSubscribedStrategies] = useState<string[]>([]);

  // Auto-generation state
  const [autoGenerationEnabled, setAutoGenerationEnabled] = useState<Record<string, boolean>>({});
  const [lastGenerationTime, setLastGenerationTime] = useState<Record<string, number>>({});
  const [marketConditions, setMarketConditions] = useState<Record<string, any>>({});

  // Modal state
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [pendingStrategy, setPendingStrategy] = useState<Strategy | null>(null);
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);

  // Interval refs
  const autoGenerationIntervalRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Connect to WebSocket
  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        // Set up WebSocket connection
        await websocketService.connect({
          onOpen: () => {
            setWsConnected(true);
            logService.log('info', 'WebSocket connected', null, 'TradeMonitor');
          },
          onClose: () => {
            setWsConnected(false);
            logService.log('info', 'WebSocket disconnected', null, 'TradeMonitor');
          },
          onError: (error: Error) => {
            logService.log('error', 'WebSocket error', error, 'TradeMonitor');
          },
          onMessage: (message: any) => {
            handleWebSocketMessage(message);
          }
        });
      } catch (error) {
        logService.log('error', 'Failed to connect to WebSocket', error, 'TradeMonitor');
      }
    };

    connectWebSocket();

    return () => {
      // Disconnect from WebSocket server
      websocketService.disconnect();

      // Clear all auto-generation intervals
      Object.values(autoGenerationIntervalRef.current).forEach(interval => {
        clearInterval(interval);
      });
      autoGenerationIntervalRef.current = {};
    };
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = (message: any) => {
    try {
      if (!message || !message.type) return;

      switch (message.type) {
        case 'trade_update':
          handleTradeUpdate(message.data);
          break;
        case 'strategy_update':
          handleStrategyUpdate(message.data);
          break;
        case 'market_data':
          // Handle market data updates
          break;
        default:
          // Ignore unknown message types
          break;
      }
    } catch (error) {
      logService.log('error', 'Error handling WebSocket message', error, 'TradeMonitor');
    }
  };

  // Handle trade updates from WebSocket
  const handleTradeUpdate = (data: any) => {
    if (!data || !data.trade) return;

    // Map database fields to our application fields
    const trade = data.trade;
    const strategyId = trade.strategy_id || trade.strategyId;

    if (!strategyId) return;

    // Create a properly formatted trade object
    const formattedTrade: Trade = {
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      status: trade.status,
      amount: trade.quantity || trade.amount,
      entryPrice: trade.entry_price || trade.price || trade.entryPrice,
      exitPrice: trade.exit_price || trade.close_price || trade.exitPrice,
      profit: trade.profit,
      timestamp: trade.timestamp || new Date(trade.created_at || Date.now()).getTime(),
      strategyId: strategyId,
      createdAt: trade.created_at || trade.createdAt || new Date().toISOString(),
      executedAt: trade.executed_at || trade.executedAt
    };

    // Update active trades if the trade is active
    if (formattedTrade.status === 'pending' || formattedTrade.status === 'executed') {
      setActiveTrades(prev => {
        const existingTrades = prev[strategyId] || [];
        const tradeIndex = existingTrades.findIndex(t => t.id === formattedTrade.id);

        if (tradeIndex >= 0) {
          // Update existing trade
          const updatedTrades = [...existingTrades];
          updatedTrades[tradeIndex] = { ...updatedTrades[tradeIndex], ...formattedTrade };
          return { ...prev, [strategyId]: updatedTrades };
        } else {
          // Add new trade
          return { ...prev, [strategyId]: [formattedTrade, ...existingTrades] };
        }
      });
    }
    // Update closed trades if the trade is closed
    else if (formattedTrade.status === 'closed') {
      // First remove from active trades if it exists there
      setActiveTrades(prev => {
        const existingTrades = prev[strategyId] || [];
        const filteredTrades = existingTrades.filter(t => t.id !== formattedTrade.id);
        return { ...prev, [strategyId]: filteredTrades };
      });

      // Then add to closed trades
      setClosedTrades(prev => {
        const existingTrades = prev[strategyId] || [];
        const tradeIndex = existingTrades.findIndex(t => t.id === formattedTrade.id);

        if (tradeIndex >= 0) {
          // Update existing trade
          const updatedTrades = [...existingTrades];
          updatedTrades[tradeIndex] = { ...updatedTrades[tradeIndex], ...formattedTrade };
          return { ...prev, [strategyId]: updatedTrades };
        } else {
          // Add new trade
          return { ...prev, [strategyId]: [formattedTrade, ...existingTrades] };
        }
      });

      // Update budget with trade value and profit/loss
      updateBudgetAfterTrade(strategyId, formattedTrade);

      // Emit event to update other components
      eventBus.emit('budget:updated', { strategyId, trade: formattedTrade });
    }
  };

  // Handle strategy updates from WebSocket
  const handleStrategyUpdate = (data: any) => {
    if (!data || !data.strategy) return;

    const { strategy } = data;

    // Update strategies list
    setStrategies(prev => {
      const strategyIndex = prev.findIndex(s => s.id === strategy.id);

      if (strategyIndex >= 0) {
        // Update existing strategy
        const updatedStrategies = [...prev];
        updatedStrategies[strategyIndex] = { ...updatedStrategies[strategyIndex], ...strategy };
        return updatedStrategies;
      } else {
        // Add new strategy
        return [...prev, strategy];
      }
    });
  };

  // Update budget after a trade is closed
  const updateBudgetAfterTrade = (strategyId: string, trade: Trade) => {
    const currentBudget = budgets[strategyId];
    if (!currentBudget) return;

    // Calculate trade value in USDT
    const tradeValue = trade.amount && trade.entryPrice ? trade.amount * trade.entryPrice : 0;

    // Calculate profit/loss
    const profitLoss = trade.profit || 0;

    logService.log('info', `Updating budget after trade closure for strategy ${strategyId}`,
      { tradeId: trade.id, tradeValue, profitLoss }, 'TradeMonitor');

    // Update budget
    const updatedBudget: StrategyBudget = {
      ...currentBudget,
      available: currentBudget.available + tradeValue + profitLoss,
      allocated: Math.max(0, currentBudget.allocated - tradeValue),
      lastUpdated: Date.now()
    };

    // Update budgets state
    setBudgets(prev => ({
      ...prev,
      [strategyId]: updatedBudget
    }));

    // Update trade service budget
    tradeService.setBudget(strategyId, updatedBudget);
  };

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);

        // Initialize wallet balance service
        await walletBalanceService.initialize();

        // Load strategies if none were provided
        if (strategies.length === 0) {
          const { data, error } = await supabase
            .from('strategies')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            throw error;
          }

          if (data) {
            setStrategies(data);
          }
        }

        // Load trades for active strategies
        const activeStrategies = strategies.filter(s => s.status === 'active');
        for (const strategy of activeStrategies) {
          await loadTradesForStrategy(strategy.id);

          // Subscribe to WebSocket updates for active strategies
          if (wsConnected && !subscribedStrategies.includes(strategy.id)) {
            subscribeToStrategy(strategy.id);
          }

          // Initialize auto-generation state for active strategies
          setAutoGenerationEnabled(prev => ({
            ...prev,
            [strategy.id]: false // Default to disabled
          }));
        }

        setIsLoading(false);
      } catch (error) {
        logService.log('error', 'Failed to load initial data', error, 'TradeMonitor');
        setError('Failed to load data. Please refresh the page.');
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [wsConnected]);

  // Subscribe to a strategy's updates
  const subscribeToStrategy = (strategyId: string) => {
    if (!wsConnected) return;

    try {
      // Subscribe to strategy updates
      websocketService.send({
        type: 'subscribe',
        data: {
          channel: 'strategy',
          strategyId
        }
      });

      // Subscribe to trade updates
      websocketService.send({
        type: 'subscribe',
        data: {
          channel: 'trades',
          strategyId
        }
      });

      // Add to subscribed strategies
      setSubscribedStrategies(prev => {
        if (prev.includes(strategyId)) return prev;
        return [...prev, strategyId];
      });

      logService.log('info', `Subscribed to updates for strategy ${strategyId}`, null, 'TradeMonitor');
    } catch (error) {
      logService.log('error', `Failed to subscribe to strategy ${strategyId}`, error, 'TradeMonitor');
    }
  };

  // Toggle automatic trade generation for a strategy
  const toggleAutoGeneration = (strategyId: string) => {
    const isCurrentlyEnabled = autoGenerationEnabled[strategyId] || false;

    // If we're turning it off, clear the interval
    if (isCurrentlyEnabled && autoGenerationIntervalRef.current[strategyId]) {
      clearInterval(autoGenerationIntervalRef.current[strategyId]);
      delete autoGenerationIntervalRef.current[strategyId];

      setAutoGenerationEnabled(prev => ({
        ...prev,
        [strategyId]: false
      }));

      logService.log('info', `Automatic trade generation disabled for strategy ${strategyId}`, null, 'TradeMonitor');
    }
    // If we're turning it on, set up the interval
    else {
      // Generate trades immediately
      generateTradesForStrategy(strategyId);

      // Set up interval for automatic generation (every 15 minutes)
      const intervalId = setInterval(() => {
        // Only generate if the strategy is still active
        const strategy = strategies.find(s => s.id === strategyId);
        if (strategy && strategy.status === 'active') {
          generateTradesForStrategy(strategyId);
        } else {
          // If strategy is no longer active, clear the interval
          clearInterval(autoGenerationIntervalRef.current[strategyId]);
          delete autoGenerationIntervalRef.current[strategyId];

          setAutoGenerationEnabled(prev => ({
            ...prev,
            [strategyId]: false
          }));
        }
      }, 15 * 60 * 1000); // 15 minutes

      // Store the interval ID
      autoGenerationIntervalRef.current[strategyId] = intervalId;

      // Update state
      setAutoGenerationEnabled(prev => ({
        ...prev,
        [strategyId]: true
      }));

      logService.log('info', `Automatic trade generation enabled for strategy ${strategyId}`, null, 'TradeMonitor');
    }
  };

  // Activate a strategy
  const activateStrategy = async (strategy: Strategy, budget: StrategyBudget) => {
    try {
      setIsSubmittingBudget(true);

      // 1. Set the budget in the trade service
      await tradeService.setBudget(strategy.id, budget);

      // 2. Update the strategy status in the database
      const updatedStrategy = await strategyService.activateStrategy(strategy.id);

      // 3. Update local state
      setStrategies(prev => {
        return prev.map(s => {
          if (s.id === strategy.id) {
            return { ...s, status: 'active' };
          }
          return s;
        });
      });

      // 4. Update budgets state
      setBudgets(prev => ({
        ...prev,
        [strategy.id]: budget
      }));

      // 5. Subscribe to WebSocket updates
      subscribeToStrategy(strategy.id);

      // 6. Generate initial trades
      generateTradesForStrategy(strategy.id);

      // 7. Close modal
      setShowBudgetModal(false);
      setPendingStrategy(null);

      logService.log('info', `Strategy ${strategy.id} activated with budget ${budget.total}`, null, 'TradeMonitor');
      return true;
    } catch (error) {
      logService.log('error', `Failed to activate strategy ${strategy.id}`, error, 'TradeMonitor');
      setError(`Failed to activate strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsSubmittingBudget(false);
    }
  };

  // Deactivate a strategy
  const deactivateStrategy = async (strategyId: string) => {
    try {
      // 1. Update the strategy status in the database
      await strategyService.deactivateStrategy(strategyId);

      // 2. Update local state
      setStrategies(prev => {
        return prev.map(s => {
          if (s.id === strategyId) {
            return { ...s, status: 'inactive' };
          }
          return s;
        });
      });

      // 3. Unsubscribe from WebSocket updates
      websocketService.send({
        type: 'unsubscribe',
        data: {
          channel: 'strategy',
          strategyId
        }
      });

      websocketService.send({
        type: 'unsubscribe',
        data: {
          channel: 'trades',
          strategyId
        }
      });

      // 4. Update subscribed strategies
      setSubscribedStrategies(prev => prev.filter(id => id !== strategyId));

      // 5. Clear any auto-generation interval
      if (autoGenerationIntervalRef.current[strategyId]) {
        clearInterval(autoGenerationIntervalRef.current[strategyId]);
        delete autoGenerationIntervalRef.current[strategyId];

        setAutoGenerationEnabled(prev => ({
          ...prev,
          [strategyId]: false
        }));
      }

      logService.log('info', `Strategy ${strategyId} deactivated`, null, 'TradeMonitor');
      return true;
    } catch (error) {
      logService.log('error', `Failed to deactivate strategy ${strategyId}`, error, 'TradeMonitor');
      setError(`Failed to deactivate strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  // Analyze market conditions for a strategy
  const analyzeMarketConditions = async (strategyId: string) => {
    try {
      // Get the strategy
      const strategy = strategies.find(s => s.id === strategyId);
      if (!strategy) throw new Error(`Strategy ${strategyId} not found`);

      // Check if we have trading pairs
      if (!strategy.selected_pairs || strategy.selected_pairs.length === 0) {
        return {
          favorable: false,
          reason: 'No trading pairs selected for this strategy'
        };
      }

      // In a real implementation, we would fetch actual market data here
      // For now, we'll simulate market analysis with some randomness
      const isDemo = demoService.isDemoMode();
      const randomFactor = Math.random();

      // Simulate market conditions based on strategy risk level
      const riskFactor = getRiskFactor(strategy.riskLevel || 'Medium');
      const volatility = 0.2 + (Math.random() * 0.8); // 0.2 to 1.0
      const trend = Math.random() > 0.5 ? 'up' : 'down';
      const volume = 500000 + (Math.random() * 1000000); // Simulated volume

      // Determine if conditions are favorable for trading
      // Higher risk strategies are more likely to trade in any condition
      const favorable = randomFactor < (0.3 + (riskFactor * 0.4));

      // Update market conditions state
      const conditions = {
        timestamp: Date.now(),
        favorable,
        volatility,
        trend,
        volume,
        reason: favorable
          ? `Market conditions are favorable for ${strategy.riskLevel} strategy`
          : `Market conditions are not optimal for trading with ${strategy.riskLevel} strategy`
      };

      setMarketConditions(prev => ({
        ...prev,
        [strategyId]: conditions
      }));

      return conditions;
    } catch (error) {
      logService.log('error', `Error analyzing market conditions for strategy ${strategyId}`, error, 'TradeMonitor');
      return {
        favorable: false,
        reason: 'Error analyzing market conditions'
      };
    }
  };

  // Helper function to get risk factor from risk level
  const getRiskFactor = (riskLevel: string): number => {
    switch (riskLevel) {
      case 'Ultra Low': return 0.1;
      case 'Low': return 0.3;
      case 'Medium': return 0.5;
      case 'High': return 0.7;
      case 'Ultra High': return 0.8;
      case 'Extreme': return 0.9;
      case 'God Mode': return 1.0;
      default: return 0.5;
    }
  };

  // Generate trades for a strategy
  const generateTradesForStrategy = async (strategyId: string) => {
    try {
      // Check if we're already generating trades for this strategy
      if (isGeneratingTrades[strategyId]) return;

      // Set generating flag
      setIsGeneratingTrades(prev => ({ ...prev, [strategyId]: true }));

      // Get the strategy
      const strategy = strategies.find(s => s.id === strategyId);
      if (!strategy) throw new Error(`Strategy ${strategyId} not found`);

      // Get the budget
      const budget = budgets[strategyId];
      if (!budget) throw new Error(`Budget for strategy ${strategyId} not found`);

      // Check if we have enough available budget
      if (budget.available < 10) {
        logService.log('info', `Not enough available budget for strategy ${strategyId}`, { available: budget.available }, 'TradeMonitor');
        setIsGeneratingTrades(prev => ({ ...prev, [strategyId]: false }));
        return;
      }

      // Analyze market conditions first
      const conditions = await analyzeMarketConditions(strategyId);

      // Only generate trades if market conditions are favorable
      // or if we're forcing trade generation (not auto-generated)
      if (!conditions.favorable) {
        logService.log('info', `Skipping trade generation due to unfavorable market conditions: ${conditions.reason}`, null, 'TradeMonitor');
        setIsGeneratingTrades(prev => ({ ...prev, [strategyId]: false }));
        return;
      }

      // Generate trades using the trade service
      const isDemo = demoService.isDemoMode();
      const result = await tradeService.generateTradesForStrategy(strategy, budget, isDemo);

      if (result.success) {
        logService.log('info', `Generated ${result.trades?.length || 0} trades for strategy ${strategyId}`, null, 'TradeMonitor');

        // If in demo mode, create some placeholder trades
        if (isDemo && (!result.trades || result.trades.length === 0)) {
          createDemoTrades(strategy);
        }

        // Update last generation time
        setLastGenerationTime(prev => ({
          ...prev,
          [strategyId]: Date.now()
        }));
      } else {
        logService.log('warn', `Failed to generate trades for strategy ${strategyId}`, result.error, 'TradeMonitor');
      }
    } catch (error) {
      logService.log('error', `Error generating trades for strategy ${strategyId}`, error, 'TradeMonitor');
    } finally {
      // Clear generating flag
      setIsGeneratingTrades(prev => ({ ...prev, [strategyId]: false }));
    }
  };

  // Create demo trades for testing
  const createDemoTrades = (strategy: Strategy) => {
    if (!strategy.selected_pairs || strategy.selected_pairs.length === 0) return;

    const budget = budgets[strategy.id];
    if (!budget || budget.available < 10) return;

    // Create 1-3 random trades
    const numTrades = Math.floor(Math.random() * 3) + 1;
    const maxAmount = budget.available * 0.2; // Max 20% of available budget per trade

    // Track total amount allocated to ensure we don't exceed budget
    let totalAllocated = 0;
    const availableBudget = budget.available;

    for (let i = 0; i < numTrades; i++) {
      // Check if we still have budget available - minimum $5 per trade
      if (availableBudget - totalAllocated < 5) {
        logService.log('info', `Stopping demo trade generation due to insufficient remaining budget`,
          { remaining: availableBudget - totalAllocated }, 'TradeMonitor');
        break;
      }

      // Pick a random pair
      const pair = strategy.selected_pairs[Math.floor(Math.random() * strategy.selected_pairs.length)];
      const standardizedPair = standardizeSymbolFormat(pair);

      // Get base price with validation
      let basePrice = getBasePrice(standardizedPair);
      if (!basePrice || basePrice <= 0) {
        basePrice = 100; // Default fallback price
        logService.log('warn', `Invalid base price for ${standardizedPair}, using fallback price`, null, 'TradeMonitor');
      }

      // Calculate amount (between 5% and 15% of available budget)
      const percentage = 0.05 + (Math.random() * 0.1);
      const remainingBudget = availableBudget - totalAllocated;
      const calculatedAmount = Math.min(remainingBudget * percentage, maxAmount);

      // Ensure amount is reasonable based on price
      let amount;
      if (basePrice > 10000) { // BTC
        amount = Math.min(calculatedAmount / basePrice, 0.01); // Max 0.01 BTC
      } else if (basePrice > 1000) { // ETH
        amount = Math.min(calculatedAmount / basePrice, 0.1); // Max 0.1 ETH
      } else if (basePrice > 100) { // Mid-priced assets
        amount = Math.min(calculatedAmount / basePrice, 1.0); // Max 1.0 units
      } else {
        amount = Math.min(calculatedAmount / basePrice, 10.0); // Max 10 units
      }

      // Round to 6 decimal places for crypto
      amount = Math.round(amount * 1000000) / 1000000;

      // Calculate the trade value in USD
      const tradeValue = amount * basePrice;
      const MIN_TRADE_VALUE = 5; // Minimum $5 trade as per exchange requirements

      // Ensure trade meets minimum value requirement
      if (tradeValue < MIN_TRADE_VALUE) {
        // Adjust amount to meet minimum trade value
        amount = MIN_TRADE_VALUE / basePrice;
        // Round to 6 decimal places for crypto
        amount = Math.round(amount * 1000000) / 1000000;
        logService.log('info', `Adjusted trade amount to meet minimum $5 requirement: ${amount} ${standardizedPair}`,
          { originalValue: tradeValue, newValue: MIN_TRADE_VALUE }, 'TradeMonitor');
      }

      // Skip if amount is still too small after adjustment
      if (amount < 0.000001) {
        logService.log('info', `Skipping trade with too small amount: ${amount}`, null, 'TradeMonitor');
        continue;
      }

      // Update total allocated
      totalAllocated += amount * basePrice;

      // Create unique ID to prevent duplicates
      const uniqueId = `demo-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 11)}`;

      // Create trade
      const trade: Trade = {
        id: uniqueId,
        symbol: standardizedPair,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        status: 'pending',
        amount,
        entryPrice: basePrice * (1 + (Math.random() * 0.02 - 0.01)),
        timestamp: Date.now(),
        strategyId: strategy.id,
        createdAt: new Date().toISOString(),
        executedAt: null,
        marketType: strategy.marketType || 'spot'
      };

      // Add to active trades
      setActiveTrades(prev => {
        const existingTrades = prev[strategy.id] || [];
        return { ...prev, [strategy.id]: [trade, ...existingTrades] };
      });

      // Update budget
      if (budget) {
        const updatedBudget: StrategyBudget = {
          ...budget,
          available: budget.available - amount,
          allocated: budget.allocated + amount,
          lastUpdated: Date.now()
        };

        setBudgets(prev => ({
          ...prev,
          [strategy.id]: updatedBudget
        }));

        // Update trade service budget
        tradeService.setBudget(strategy.id, updatedBudget);
      }

      // Simulate trade execution after a random delay
      setTimeout(() => {
        const executedTrade: Trade = {
          ...trade,
          status: 'executed',
          executedAt: new Date().toISOString()
        };

        setActiveTrades(prev => {
          const existingTrades = prev[strategy.id] || [];
          const tradeIndex = existingTrades.findIndex(t => t.id === trade.id);

          if (tradeIndex >= 0) {
            const updatedTrades = [...existingTrades];
            updatedTrades[tradeIndex] = executedTrade;
            return { ...prev, [strategy.id]: updatedTrades };
          }
          return prev;
        });
      }, 2000 + Math.random() * 8000); // 2-10 seconds

      // Simulate trade closure after a longer delay
      setTimeout(() => {
        // Calculate profit/loss (between -5% and +10%)
        const profitPercentage = -0.05 + (Math.random() * 0.15);
        const profit = amount * profitPercentage;

        const closedTrade: Trade = {
          ...trade,
          status: 'closed',
          exitPrice: trade.entryPrice ? trade.entryPrice * (1 + profitPercentage) : undefined,
          profit,
          executedAt: new Date().toISOString()
        };

        // Remove from active trades
        setActiveTrades(prev => {
          const existingTrades = prev[strategy.id] || [];
          return { ...prev, [strategy.id]: existingTrades.filter(t => t.id !== trade.id) };
        });

        // Add to closed trades
        setClosedTrades(prev => {
          const existingTrades = prev[strategy.id] || [];
          return { ...prev, [strategy.id]: [closedTrade, ...existingTrades] };
        });

        // Calculate trade value in USDT
        const tradeValue = closedTrade.amount && closedTrade.entryPrice ?
          closedTrade.amount * closedTrade.entryPrice : 0;

        // Update budget with trade value and profit/loss
        updateBudgetAfterTrade(strategy.id, closedTrade);

        // Emit event to update other components
        eventBus.emit('budget:updated', {
          strategyId: strategy.id,
          trade: closedTrade,
          tradeValue: tradeValue
        });
      }, 15000 + Math.random() * 30000); // 15-45 seconds
    }
  };

  // Load trades for a specific strategy
  const loadTradesForStrategy = async (strategyId: string) => {
    try {
      // Get active trades
      const { data: activeTradesData, error: activeError } = await supabase
        .from('trades')
        .select('*')
        .eq('strategy_id', strategyId) // Using strategy_id instead of strategyId
        .in('status', ['pending', 'executed'])
        .order('timestamp', { ascending: false });

      if (activeError) {
        throw activeError;
      }

      // Get closed trades
      const { data: closedTradesData, error: closedError } = await supabase
        .from('trades')
        .select('*')
        .eq('strategy_id', strategyId) // Using strategy_id instead of strategyId
        .eq('status', 'closed')
        .order('timestamp', { ascending: false });

      if (closedError) {
        throw closedError;
      }

      // Map database fields to our application fields
      const mapTrade = (trade: any): Trade => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        status: trade.status,
        amount: trade.quantity || trade.amount,
        entryPrice: trade.entry_price || trade.price,
        exitPrice: trade.exit_price || trade.close_price,
        profit: trade.profit,
        timestamp: new Date(trade.created_at).getTime(),
        strategyId: trade.strategy_id,
        createdAt: trade.created_at,
        executedAt: trade.executed_at
      });

      // Update state
      if (activeTradesData) {
        const mappedActiveTrades = activeTradesData.map(mapTrade);
        setActiveTrades(prev => ({
          ...prev,
          [strategyId]: mappedActiveTrades
        }));
      }

      if (closedTradesData) {
        const mappedClosedTrades = closedTradesData.map(mapTrade);
        setClosedTrades(prev => ({
          ...prev,
          [strategyId]: mappedClosedTrades
        }));
      }

      // Get budget for this strategy
      const budget = tradeService.getBudget(strategyId);
      if (budget) {
        setBudgets(prev => ({
          ...prev,
          [strategyId]: budget
        }));
      }
    } catch (error) {
      logService.log('error', `Failed to load trades for strategy ${strategyId}`, error, 'TradeMonitor');
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
        <span className="ml-2 text-lg">Loading trade monitor...</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <AlertCircle className="w-8 h-8 text-red-500" />
        <span className="ml-2 text-lg text-red-500">{error}</span>
        <button
          className="ml-4 px-4 py-2 bg-pink-500 text-white rounded-md"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-4 h-4 mr-2 inline" />
          Refresh
        </button>
      </div>
    );
  }

  // Render empty state
  if (strategies.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full ${className}`}>
        <DollarSign className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Strategies Found</h3>
        <p className="text-gray-400 mb-4">Create or activate a strategy to start trading</p>
        <button
          className="px-6 py-2 bg-pink-500 text-white rounded-md"
          onClick={() => window.location.href = '/strategy-manager'}
        >
          Go to Strategy Manager
        </button>
      </div>
    );
  }

  // Render main content
  return (
    <div className={`trade-monitor ${className}`}>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
          Trade Monitor
        </h2>
        <div className="flex items-center space-x-3">
          <div className={`flex items-center px-3 py-1 rounded-full text-sm ${wsConnected ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            {wsConnected ? 'Connected' : 'Disconnected'}
          </div>
          <button
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 transition-colors text-white rounded-md flex items-center"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      <div className="strategies-list space-y-6">
        {strategies.map(strategy => (
          <div
            key={strategy.id}
            className="strategy-card bg-gray-800/80 backdrop-blur-sm rounded-lg overflow-hidden shadow-lg transition-all duration-300"
          >
            <div
              className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-700/30 transition-colors"
              onClick={() => setExpandedStrategyId(expandedStrategyId === strategy.id ? null : strategy.id)}
            >
              <div>
                <div className="flex items-center flex-wrap gap-2">
                  <h3 className="text-xl font-semibold">{strategy.title}</h3>
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-700">
                    {strategy.market_type || 'spot'}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    strategy.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {strategy.status.toUpperCase()}
                  </span>
                  {strategy.status === 'active' && budgets[strategy.id] && (
                    <span className="px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400 flex items-center">
                      <Wallet className="w-3 h-3 mr-1" />
                      <span className="font-medium">${budgets[strategy.id]?.available.toFixed(2)}</span>
                      <span className="ml-1 opacity-70">USDT</span>
                    </span>
                  )}
                </div>
                <p className="text-gray-400 mt-1 text-sm">{strategy.description}</p>
              </div>
              <div className="flex items-center">
                {isGeneratingTrades[strategy.id] && (
                  <span className="mr-3 flex items-center text-yellow-500 text-sm">
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Generating...
                  </span>
                )}
                {expandedStrategyId === strategy.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>

            {expandedStrategyId === strategy.id && (
              <div className="border-t border-gray-700/50">
                {/* Strategy details */}
                <div className="p-4 bg-gray-800/50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-700/30 p-4 rounded-lg">
                      <h4 className="text-sm text-gray-400 mb-1">Trading Budget</h4>
                      <p className="text-2xl font-semibold">
                        ${budgets[strategy.id]?.total.toFixed(2) || '0.00'}
                      </p>
                      <div className="mt-2 text-xs text-gray-400">
                        Last updated: {budgets[strategy.id]?.lastUpdated ? new Date(budgets[strategy.id]?.lastUpdated).toLocaleTimeString() : 'Never'}
                      </div>
                    </div>
                    <div className="bg-gray-700/30 p-4 rounded-lg">
                      <h4 className="text-sm text-gray-400 mb-1">Available Balance</h4>
                      <p className="text-2xl font-semibold">
                        ${budgets[strategy.id]?.available.toFixed(2) || '0.00'}
                      </p>
                      <div className="mt-2 h-2 bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-pink-500"
                          style={{
                            width: `${budgets[strategy.id] ?
                              Math.min(100, (budgets[strategy.id].available / budgets[strategy.id].total) * 100) : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="bg-gray-700/30 p-4 rounded-lg">
                      <h4 className="text-sm text-gray-400 mb-1">Risk Level</h4>
                      <p className="text-2xl font-semibold">
                        {strategy.riskLevel || 'Medium'}
                      </p>
                      <div className="mt-2 text-xs text-gray-400">
                        {strategy.selected_pairs?.length || 0} trading pairs
                      </div>
                    </div>
                  </div>

                  {/* Market conditions display */}
                  {marketConditions[strategy.id] && (
                    <div className="mb-4 p-3 rounded-lg bg-gray-700/20 border border-gray-700/50">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium">Market Conditions</h4>
                        <span className="text-xs text-gray-400">
                          Last analyzed: {new Date(marketConditions[strategy.id].timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center">
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${marketConditions[strategy.id].favorable ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                        <span className="text-sm">{marketConditions[strategy.id].reason}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-400">
                        <div>Trend: <span className="text-white">{marketConditions[strategy.id].trend}</span></div>
                        <div>Volatility: <span className="text-white">{(marketConditions[strategy.id].volatility * 100).toFixed(1)}%</span></div>
                        <div>Volume: <span className="text-white">${Math.round(marketConditions[strategy.id].volume).toLocaleString()}</span></div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mb-4">
                    {strategy.status === 'inactive' ? (
                      <button
                        className="px-4 py-2 bg-pink-500 hover:bg-pink-600 transition-colors text-white rounded-md flex items-center"
                        onClick={() => {
                          setPendingStrategy(strategy);
                          setShowBudgetModal(true);
                        }}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Activate Strategy
                      </button>
                    ) : (
                      <button
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 transition-colors text-white rounded-md flex items-center"
                        onClick={() => deactivateStrategy(strategy.id)}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Deactivate Strategy
                      </button>
                    )}

                    {strategy.status === 'active' && (
                      <>
                        <button
                          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 transition-colors text-white rounded-md flex items-center"
                          onClick={() => generateTradesForStrategy(strategy.id)}
                          disabled={isGeneratingTrades[strategy.id]}
                        >
                          {isGeneratingTrades[strategy.id] ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-2" />
                              Generate Trades
                            </>
                          )}
                        </button>

                        <button
                          className={`px-4 py-2 ${autoGenerationEnabled[strategy.id] ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} transition-colors text-white rounded-md flex items-center`}
                          onClick={() => toggleAutoGeneration(strategy.id)}
                        >
                          {autoGenerationEnabled[strategy.id] ? (
                            <>
                              <ToggleRight className="w-4 h-4 mr-2" />
                              Auto-Generate: ON
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4 mr-2" />
                              Auto-Generate: OFF
                            </>
                          )}
                        </button>
                      </>
                    )}

                    <button
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 transition-colors text-white rounded-md flex items-center"
                      onClick={() => loadTradesForStrategy(strategy.id)}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh Trades
                    </button>
                  </div>

                  {/* Last generation time */}
                  {lastGenerationTime[strategy.id] && (
                    <div className="mb-4 text-xs text-gray-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      Last trade generation: {new Date(lastGenerationTime[strategy.id]).toLocaleTimeString()}
                      {autoGenerationEnabled[strategy.id] && (
                        <span className="ml-2">(Next: {new Date(lastGenerationTime[strategy.id] + 15 * 60 * 1000).toLocaleTimeString()})</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Trades tabs */}
                <div className="px-4 pt-2 bg-gray-800/80">
                  <div className="flex border-b border-gray-700">
                    <button
                      className={`px-4 py-2 font-medium text-sm ${
                        activeTrades[strategy.id]?.length > 0 ? 'text-pink-500' : 'text-gray-400'
                      } ${
                        expandedStrategyId === strategy.id && 'border-b-2 border-pink-500'
                      }`}
                      onClick={() => setExpandedStrategyId(strategy.id)}
                    >
                      Active Trades ({activeTrades[strategy.id]?.length || 0})
                    </button>
                    <button
                      className={`px-4 py-2 font-medium text-sm ${closedTrades[strategy.id]?.length > 0 ? 'text-gray-300' : 'text-gray-500'}`}
                      onClick={() => setExpandedStrategyId(strategy.id)}
                    >
                      Closed Trades ({closedTrades[strategy.id]?.length || 0})
                    </button>
                  </div>
                </div>

                {/* Active trades section */}
                <div className="p-4">
                  {activeTrades[strategy.id]?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Symbol</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Side</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Entry Price</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Value</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {activeTrades[strategy.id]?.map(trade => (
                            <tr key={trade.id} className="hover:bg-gray-700/20 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">{trade.symbol}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  trade.side === 'buy' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                                }`}>
                                  {trade.side.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">{trade.amount?.toFixed(6)}</td>
                              <td className="px-4 py-3 whitespace-nowrap">${trade.entryPrice?.toFixed(2)}</td>
                              <td className="px-4 py-3 whitespace-nowrap">${(trade.amount && trade.entryPrice) ? (trade.amount * trade.entryPrice).toFixed(2) : '0.00'} USDT</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  trade.status === 'executed' ? 'bg-blue-500/20 text-blue-500' : 'bg-yellow-500/20 text-yellow-500'
                                }`}>
                                  {trade.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-sm">
                                {new Date(trade.createdAt).toLocaleTimeString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-400 mb-4">No active trades for this strategy</p>
                      {strategy.status === 'active' && (
                        <div className="flex flex-col items-center gap-3">
                          <button
                            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 transition-colors text-white rounded-md inline-flex items-center"
                            onClick={() => generateTradesForStrategy(strategy.id)}
                            disabled={isGeneratingTrades[strategy.id]}
                          >
                            {isGeneratingTrades[strategy.id] ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Zap className="w-4 h-4 mr-2" />
                                Generate Trades Now
                              </>
                            )}
                          </button>

                          <div className="flex items-center gap-2 mt-2">
                            <button
                              className={`px-4 py-2 ${autoGenerationEnabled[strategy.id] ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} transition-colors text-white rounded-md flex items-center`}
                              onClick={() => toggleAutoGeneration(strategy.id)}
                            >
                              {autoGenerationEnabled[strategy.id] ? (
                                <>
                                  <ToggleRight className="w-4 h-4 mr-2" />
                                  Auto-Generate: ON
                                </>
                              ) : (
                                <>
                                  <ToggleLeft className="w-4 h-4 mr-2" />
                                  Auto-Generate: OFF
                                </>
                              )}
                            </button>
                          </div>

                          {autoGenerationEnabled[strategy.id] && (
                            <p className="text-xs text-gray-400 mt-2">
                              Trades will be automatically generated based on market conditions every 15 minutes
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Closed trades section */}
                {closedTrades[strategy.id]?.length > 0 && (
                  <div className="p-4 border-t border-gray-700/50">
                    <h4 className="text-sm font-medium mb-3">Closed Trades</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Symbol</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Side</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Entry Price</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Value</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Exit Price</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Profit</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Closed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {closedTrades[strategy.id]?.map(trade => (
                            <tr key={trade.id} className="hover:bg-gray-700/20 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">{trade.symbol}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  trade.side === 'buy' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                                }`}>
                                  {trade.side.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">{trade.amount?.toFixed(6)}</td>
                              <td className="px-4 py-3 whitespace-nowrap">${trade.entryPrice?.toFixed(2)}</td>
                              <td className="px-4 py-3 whitespace-nowrap">${(trade.amount && trade.entryPrice) ? (trade.amount * trade.entryPrice).toFixed(2) : '0.00'} USDT</td>
                              <td className="px-4 py-3 whitespace-nowrap">${trade.exitPrice?.toFixed(2) || '0.00'}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`${(trade.profit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  {(trade.profit || 0) >= 0 ? '+' : ''}{(trade.profit || 0).toFixed(2)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-sm">
                                {trade.executedAt ? new Date(trade.executedAt).toLocaleTimeString() : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Budget Confirmation Modal */}
      {showBudgetModal && pendingStrategy && (
        <BudgetConfirmModal
          strategy={pendingStrategy}
          isOpen={showBudgetModal}
          onClose={() => {
            setShowBudgetModal(false);
            setPendingStrategy(null);
          }}
          onConfirm={(budget) => activateStrategy(pendingStrategy, budget)}
        />
      )}
    </div>
  );
};
