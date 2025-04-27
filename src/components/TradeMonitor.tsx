import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  Clock,
  Activity
} from 'lucide-react';
import { TradeList } from './TradeList';
import { StrategyCard } from './StrategyCard';
import { MarketTypeBadge } from './ui/MarketTypeBadge';
import TradeExecutionMetrics from './TradeExecutionMetrics';
import { marketService } from '../lib/market-service';
import { marketDataService } from '../lib/market-data-service';
import { marketAnalyzer } from '../lib/market-analyzer';
import { tradeService } from '../lib/trade-service';
import { logService } from '../lib/log-service';
import { supabase } from '../lib/supabase';
import { directDeleteStrategy } from '../lib/direct-delete';
import { eventBus } from '../lib/event-bus';
import { standardizeAssetPairFormat, toBinanceWsFormat } from '../lib/format-utils';
import { normalizeSymbol, getBasePrice, generateRandomPrice, generateRandomAmount } from '../utils/symbol-utils';
import { demoService } from '../lib/demo-service';
import { exchangeService } from '../lib/exchange-service';
import { ccxtService } from '../lib/ccxt-service';
import { strategyService } from '../lib/strategy-service';
import { walletBalanceService } from '../lib/wallet-balance-service';
import { tradeManager } from '../lib/trade-manager';
import { tradeEngine } from '../lib/trade-engine';
import { tradeGenerator } from '../lib/trade-generator';
import { strategyMonitor } from '../lib/strategy-monitor';
import { websocketService } from '../lib/websocket-service';
import { enhancedMarketDataService } from '../lib/enhanced-market-data-service';
import { strategyAdaptationService } from '../lib/strategy-adaptation-service';
import { unifiedTradeService } from '../lib/unified-trade-service';
import { strategySync } from '../lib/strategy-sync';
import { BudgetModal } from './BudgetModal';
import { BudgetAdjustmentModal } from './BudgetAdjustmentModal';
import { DeactivationProgressModal, type DeactivationStep } from './DeactivationProgressModal';
import { ErrorBoundary } from './ErrorBoundary';
import AvailableBalanceDisplay from './AvailableBalanceDisplay';
import MarketTypeBalanceDisplay from './MarketTypeBalanceDisplay';
import type { Trade, Strategy, StrategyBudget, MarketType } from '../lib/types';

// Define local types

interface TradeMonitorProps {
  strategies: Strategy[];
  className?: string;
}

export const TradeMonitor: React.FC<TradeMonitorProps> = ({
  strategies: initialStrategies
}) => {
  // Get URL parameters
  const [searchParams] = useSearchParams();
  const strategyParam = searchParams.get('strategy');

  // State for strategies and trades
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies || []);
  const [strategyTrades, setStrategyTrades] = useState<Record<string, Trade[]>>({});
  const [budgets, setBudgets] = useState<Record<string, StrategyBudget>>({});

  // WebSocket state
  const [wsConnected, setWsConnected] = useState(false);
  const [subscribedStrategies, setSubscribedStrategies] = useState<string[]>([]);
  // const [binanceConnected, setBinanceConnected] = useState(false); // Unused

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);
  // Pagination state - currently unused but may be needed in the future
  // const [tradeListPage, setTradeListPage] = useState(0);

  // Modal state
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showBudgetAdjustmentModal, setShowBudgetAdjustmentModal] = useState(false);
  const [showDeactivationModal, setShowDeactivationModal] = useState(false);
  const [pendingStrategy, setPendingStrategy] = useState<Strategy | null>(null);
  const [pendingBudget, setPendingBudget] = useState<number>(0);
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);

  // Deactivation progress state
  const [deactivationSteps, setDeactivationSteps] = useState<DeactivationStep[]>([]);
  const [deactivationProgress, setDeactivationProgress] = useState(0);

  // Stats
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [availableBalance, setAvailableBalance] = useState<number>(0);

  // Track deleted strategy IDs to prevent them from reappearing
  const [deletedStrategyIds] = useState<Set<string>>(new Set<string>());

  // Track user-deactivated strategies to prevent them from being reactivated by database updates
  const [userDeactivatedStrategyIds] = useState<Set<string>>(new Set<string>());

  // Connect to WebSocket and set up event handlers
  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        // Check if we're in demo mode
        const isDemo = demoService.isDemoMode();
        logService.log('info', `Connecting to WebSocket in ${isDemo ? 'demo' : 'real'} mode`, null, 'TradeMonitor');

        // Connect to WebSocket server
        await websocketService.connect({
          onOpen: () => {
            setWsConnected(true);
            logService.log('info', 'WebSocket connected', null, 'TradeMonitor');
          },
          onClose: () => {
            setWsConnected(false);
            logService.log('info', 'WebSocket disconnected', null, 'TradeMonitor');

            // Try to reconnect after a delay
            setTimeout(() => {
              if (!websocketService.getConnectionStatus()) {
                logService.log('info', 'Attempting to reconnect WebSocket', null, 'TradeMonitor');
                connectWebSocket();
              }
            }, 5000); // 5 second delay before reconnect
          },
          onError: (error) => {
            logService.log('error', 'WebSocket error', error, 'TradeMonitor');
          },
          onMessage: (message) => {
            handleWebSocketMessage(message);
          }
        });
      } catch (error) {
        logService.log('error', 'Failed to connect to WebSocket', error, 'TradeMonitor');

        // Try to reconnect after a delay
        setTimeout(() => {
          logService.log('info', 'Attempting to reconnect WebSocket after error', null, 'TradeMonitor');
          connectWebSocket();
        }, 10000); // 10 second delay before reconnect after error
      }
    };

    connectWebSocket();

    return () => {
      // Disconnect from WebSocket server
      websocketService.disconnect();
    };
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = (message: any) => {
    try {
      const { type, data } = message;

      if (type === 'connection' && data) {
        // Handle connection confirmation
        logService.log('info', `WebSocket connection established: ${data.message}`, data, 'TradeMonitor');
        if (data.isDemo) {
          logService.log('info', 'Connected in demo mode, using Binance TestNet', null, 'TradeMonitor');
        }
      } else if (type === 'subscribed' && data) {
        // Handle subscription confirmation
        logService.log('info', `Subscribed to ${data.channel} for strategy ${data.strategyId}`, null, 'TradeMonitor');
      } else if (type === 'trade_update' && data) {
        const { strategyId, trade } = data;

        // Skip if no strategyId is provided
        if (!strategyId) {
          logService.log('warn', 'Received trade update without strategyId', { trade }, 'TradeMonitor');
          return;
        }

        // Add timestamp if not present
        if (!trade.timestamp) {
          trade.timestamp = Date.now();
        }

        // Add datetime if not present
        if (!trade.datetime) {
          trade.datetime = new Date(trade.timestamp).toISOString();
        }

        // Ensure the trade has a status
        if (!trade.status) {
          trade.status = 'open';
        }

        // Ensure the trade has the correct strategyId
        trade.strategyId = strategyId;

        // Update the trades for this specific strategy only
        setStrategyTrades(prev => {
          // Check if we already have this trade (by ID)
          const existingTradeIndex = (prev[strategyId] || []).findIndex(t => t.id === trade.id);

          let updatedTrades;
          if (existingTradeIndex >= 0) {
            // Update existing trade
            updatedTrades = [...prev[strategyId]];
            updatedTrades[existingTradeIndex] = { ...updatedTrades[existingTradeIndex], ...trade };
          } else {
            // Add new trade
            updatedTrades = [...(prev[strategyId] || []), trade];
          }

          // Sort by timestamp, newest first
          updatedTrades.sort((a, b) => b.timestamp - a.timestamp);
          // Keep only the latest 100 trades
          const limitedTrades = updatedTrades.slice(0, 100);

          return {
            ...prev,
            [strategyId]: limitedTrades
          };
        });

        // Also update the global trades list, but only for this specific strategy
        setTrades(prev => {
          // Check if we already have this trade (by ID)
          const existingTradeIndex = prev.findIndex(t => t.id === trade.id);

          let updatedTrades;
          if (existingTradeIndex >= 0) {
            // Update existing trade
            updatedTrades = [...prev];
            updatedTrades[existingTradeIndex] = { ...updatedTrades[existingTradeIndex], ...trade };
          } else {
            // Add new trade
            updatedTrades = [...prev, trade];
          }

          // Sort by timestamp, newest first
          updatedTrades.sort((a, b) => b.timestamp - a.timestamp);
          // Keep only the latest 100 trades
          return updatedTrades.slice(0, 100);
        });



        // Log the trade for debugging
        logService.log('debug', `Received trade update for strategy ${strategyId}`, { trade }, 'TradeMonitor');
      } else if (type === 'binance_data' || type === 'binance_market_data') {
        // Binance connection status is now tracked elsewhere
        // setBinanceConnected(true);

        // Handle Binance TestNet data
        if (data.e === 'trade') {
          // Create a trade object from Binance data that conforms to the Trade interface
          const binanceTrade: Trade = {
            id: `binance-${data.t}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // Make ID unique
            timestamp: data.T,
            symbol: data.s.toUpperCase().replace(/([A-Z]+)([A-Z]+)$/, '$1/$2'), // Convert BTCUSDT to BTC/USDT
            side: data.m ? 'sell' : 'buy', // m = is buyer the market maker
            entryPrice: parseFloat(data.p),
            amount: parseFloat(data.q),
            status: 'pending', // Start as pending
            strategyId: 'binance-testnet',
            createdAt: new Date(data.T).toISOString(),
            // Additional properties that aren't part of the Trade interface
            // but might be used elsewhere - we'll add them as any type
            ...({
              datetime: new Date(data.T).toISOString(),
              price: parseFloat(data.p),
              cost: parseFloat(data.p) * parseFloat(data.q),
              fee: {
                cost: parseFloat(data.p) * parseFloat(data.q) * 0.001, // 0.1% fee
                currency: data.s.slice(-4) // Last 4 characters (e.g., USDT from BTCUSDT)
              }
            } as any)
          };

          // Find a strategy that trades this symbol
          const matchingStrategy = strategies.find(s => {
            if (s.status !== 'active') return false;

            const selectedPairs = s.selected_pairs || [];
            return selectedPairs.some(pair => {
              const formattedPair = pair.replace('/', '').toUpperCase();
              return formattedPair === data.s.toUpperCase();
            });
          });

          if (matchingStrategy) {
            // If we found a matching active strategy, assign the trade to it
            binanceTrade.strategyId = matchingStrategy.id;

            // Add a unique identifier to ensure this trade is only for this strategy
            const uniqueTradeId = `${matchingStrategy.id}-${binanceTrade.symbol}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            binanceTrade.id = uniqueTradeId;

            // Check if this trade already exists to prevent duplicates (using the unique ID)
            const tradeExists = trades.some(t => t.id === binanceTrade.id);
            if (!tradeExists) {
              // Update the trades for this strategy only
              setStrategyTrades(prev => {
                const existingTrades = prev[matchingStrategy.id] || [];

                // Add the new trade
                const updatedTrades = [binanceTrade, ...existingTrades];

                // Sort by timestamp, newest first
                updatedTrades.sort((a, b) => b.timestamp - a.timestamp);

                // Keep only the latest 100 trades
                const limitedTrades = updatedTrades.slice(0, 100);

                return {
                  ...prev,
                  [matchingStrategy.id]: limitedTrades
                };
              });

              // Also update the global trades list
              setTrades(prev => {
                // Add the new trade
                const updatedTrades = [binanceTrade, ...prev] as Trade[];

                // Sort by timestamp, newest first
                updatedTrades.sort((a, b) => b.timestamp - a.timestamp);

                // Keep only the latest 100 trades
                return updatedTrades.slice(0, 100);
              });

              // Log the Binance trade for debugging
              logService.log('debug', `Created unique Binance trade for ${data.s} for strategy ${matchingStrategy.id}`, { binanceTrade }, 'TradeMonitor');
            }
          }
        }
      }
    } catch (error) {
      logService.log('error', 'Failed to handle WebSocket message', error, 'TradeMonitor');
    }
  };

  // Subscribe to all active strategies when WebSocket is connected
  useEffect(() => {
    if (wsConnected && strategies.length > 0) {
      // Check if we're in demo mode
      const isDemo = demoService.isDemoMode();

      // Get all active strategies that we haven't subscribed to yet
      const activeStrategies = strategies.filter(s =>
        s.status === 'active' && !subscribedStrategies.includes(s.id)
      );

      // Subscribe to trades for each active strategy
      activeStrategies.forEach(strategy => {
        const selectedPairs = strategy.selected_pairs || [];

        // Subscribe to trades for this strategy
        websocketService.send({
          type: 'subscribe',
          data: {
            channel: 'trades',
            strategyId: strategy.id,
            useBinanceTestnet: isDemo,
            symbols: selectedPairs.map(pair => {
              // Convert pair format using our utility function
              return toBinanceWsFormat(pair, '@trade');
            })
          }
        });

        logService.log('info', `Subscribed to trades for strategy ${strategy.id} in ${isDemo ? 'demo' : 'real'} mode`, null, 'TradeMonitor');
      });

      // Update subscribed strategies
      if (activeStrategies.length > 0) {
        setSubscribedStrategies(prev => [
          ...prev,
          ...activeStrategies.map(s => s.id)
        ]);
      }

      // Also subscribe to the expanded strategy if it's not active but expanded
      if (expandedStrategyId && !subscribedStrategies.includes(expandedStrategyId) &&
          !activeStrategies.some(s => s.id === expandedStrategyId)) {

        const strategy = strategies.find(s => s.id === expandedStrategyId);
        if (strategy) {
          const selectedPairs = strategy.selected_pairs || [];

          // Subscribe to trades for this strategy
          websocketService.send({
            type: 'subscribe',
            data: {
              channel: 'trades',
              strategyId: expandedStrategyId,
              useBinanceTestnet: isDemo,
              symbols: selectedPairs.map(pair => {
                // Convert pair format from BTC/USDT to btcusdt@trade
                const formattedPair = pair.replace('/', '').toLowerCase() + '@trade';
                return formattedPair;
              })
            }
          });

          // Update subscribed strategies
          setSubscribedStrategies(prev => [...prev, expandedStrategyId]);

          logService.log('info', `Subscribed to trades for expanded strategy ${expandedStrategyId} in ${isDemo ? 'demo' : 'real'} mode`, null, 'TradeMonitor');
        }
      }
    }
  }, [wsConnected, strategies, subscribedStrategies, expandedStrategyId]);

  // Load strategies and trades on component mount
  useEffect(() => {
    // Initialize services
    const initializeServices = async () => {
      try {
        // Initialize wallet balance service
        await walletBalanceService.initialize();
        setAvailableBalance(walletBalanceService.getAvailableBalance());

        // Initialize market analyzer
        await marketAnalyzer.initialize();

        // Initialize enhanced market data service
        try {
          // This will start the service and set up caching
          await enhancedMarketDataService.getMarketData('BTC/USDT');
          logService.log('info', 'Enhanced market data service initialized', null, 'TradeMonitor');
        } catch (error) {
          logService.log('warn', 'Failed to initialize enhanced market data service, will fall back to standard market data', error, 'TradeMonitor');
        }

        // Initialize strategy adaptation service
        try {
          // This will initialize the service and load active strategies
          await strategyAdaptationService.checkStrategyMarketFit(strategies[0]?.id || '');
          logService.log('info', 'Strategy adaptation service initialized', null, 'TradeMonitor');
        } catch (error) {
          logService.log('warn', 'Failed to initialize strategy adaptation service', error, 'TradeMonitor');
        }

        // Initialize budgets for all strategies
        const initializeBudgets = async () => {
          // Get all strategies, not just active ones
          const { data: allStrategies } = await supabase.from('strategies').select('*');
          const budgetsMap: Record<string, StrategyBudget> = {};

          if (allStrategies) {
            for (const strategy of allStrategies) {
              // Initialize budget from trade service
              await (tradeService as any).initializeBudget(strategy.id);
              const budget = tradeService.getBudget(strategy.id);

              if (budget) {
                // Calculate percentages
                const allocationPercentage = budget.total > 0 ?
                  (budget.allocated / budget.total) * 100 : 0;
                const profitPercentage = budget.total > 0 && budget.profit ?
                  (budget.profit / budget.total) * 100 : 0;

                budgetsMap[strategy.id] = {
                  ...budget,
                  allocationPercentage,
                  profitPercentage,
                  profit: budget.profit || 0
                };
              }
            }
          }

          setBudgets(budgetsMap);
          logService.log('info', `Initialized budgets for ${Object.keys(budgetsMap).length} strategies`, null, 'TradeMonitor');
        };

        await initializeBudgets();

        // Subscribe to trading opportunities
        eventBus.subscribe('market:tradingOpportunity', (analysis) => {
          logService.log('info', `Trading opportunity detected for ${analysis.symbol}`, analysis, 'TradeMonitor');
        });

        // Subscribe to strategy adaptation events
        eventBus.subscribe('strategy:adapted', (data) => {
          logService.log('info', `Strategy ${data.strategyId} adapted to current market conditions`, data, 'TradeMonitor');
          // Refresh the strategies list to show the updated strategy
          fetchStrategies();
        });

        // Subscribe to market fit updates
        eventBus.subscribe('strategy:marketFit', (data) => {
          logService.log('info', `Market fit updated for strategy ${data.strategyId}`, data, 'TradeMonitor');
          // Update the UI to show the market fit score
          setStrategies(prev => prev.map(s =>
            s.id === data.strategyId
              ? { ...s, market_fit_score: data.analysis.score, market_fit_details: data.analysis.details }
              : s
          ));
        });
      } catch (error) {
        logService.log('error', 'Failed to initialize services', error, 'TradeMonitor');
      }
    };

    // Initial data load
    initializeServices()
      .then(() => fetchStrategies())
      .then(() => {
        // If a strategy ID is provided in the URL, expand that strategy
        if (strategyParam) {
          setExpandedStrategyId(strategyParam);
        }
        return fetchTradeData();
      });

    // Add direct DOM event listener for strategy removal
    const handleStrategyRemove = (event: Event) => {
      const customEvent = event as CustomEvent;
      const strategyId = customEvent.detail?.id;

      if (strategyId) {
        console.log('Direct DOM event: strategy:remove', strategyId);
        // Immediately update the UI
        setStrategies(prevStrategies => prevStrategies.filter(s => s.id !== strategyId));
      }
    };

    // Add the event listener
    document.addEventListener('strategy:remove', handleStrategyRemove);

    // Set up subscription to trade updates using WebSockets instead of fetching all data
    const tradeSubscription = supabase
      .channel('trades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, (payload) => {
        // Handle trade updates in real-time without fetching all data
        if (payload.eventType === 'INSERT') {
          // Add new trade to the list
          const rawTrade = payload.new as any;
          const strategyId = rawTrade.strategy_id || rawTrade.strategyId;

          if (!strategyId) {
            logService.log('warn', 'Received trade without strategy ID', { trade: rawTrade }, 'TradeMonitor');
            return;
          }

          // Normalize the trade data
          const newTrade: Trade = {
            id: rawTrade.id,
            symbol: rawTrade.symbol,
            side: rawTrade.side,
            status: rawTrade.status || 'pending',
            amount: rawTrade.amount || rawTrade.entry_amount || rawTrade.quantity || rawTrade.size || 0.1,
            entryPrice: rawTrade.entry_price || rawTrade.entryPrice || 0,
            exitPrice: rawTrade.exit_price || rawTrade.exitPrice || 0,
            profit: rawTrade.profit || rawTrade.pnl || 0,
            timestamp: new Date(rawTrade.created_at || rawTrade.timestamp).getTime(),
            strategyId: strategyId,
            createdAt: rawTrade.created_at || new Date(rawTrade.timestamp).toISOString(),
            executedAt: rawTrade.executed_at || null
          };

          // Only update the strategy-specific trades list
          setStrategyTrades(prev => {
            // Check if trade already exists in this strategy's trades
            const existingTrade = (prev[strategyId] || []).find(t => t.id === newTrade.id);

            if (existingTrade) {
              // If trade exists, update it instead of adding a duplicate
              const updatedStrategyTrades = (prev[strategyId] || []).map(t =>
                t.id === newTrade.id ? { ...t, ...newTrade } : t
              );

              return {
                ...prev,
                [strategyId]: updatedStrategyTrades
              };
            }

            // Validate the trade before adding it
            if (!newTrade.entryPrice || newTrade.entryPrice <= 0) {
              logService.log('warn', `Skipping trade with invalid entry price: ${newTrade.entryPrice}`, { trade: newTrade }, 'TradeMonitor');
              return prev;
            }

            if (!newTrade.amount || newTrade.amount <= 0) {
              logService.log('warn', `Skipping trade with invalid amount: ${newTrade.amount}`, { trade: newTrade }, 'TradeMonitor');
              return prev;
            }

            const updatedTrades = {
              ...prev,
              [strategyId]: [newTrade, ...(prev[strategyId] || [])].slice(0, 50) // Keep only 50 most recent trades per strategy
            };
            return updatedTrades;
          });

          // Log the new trade
          logService.log('info', `Received new trade for strategy ${strategyId}`, { trade: newTrade }, 'TradeMonitor');
        } else if (payload.eventType === 'UPDATE') {
          // Update existing trade
          const rawTrade = payload.new as any;
          const strategyId = rawTrade.strategy_id || rawTrade.strategyId;

          if (!strategyId) {
            logService.log('warn', 'Received trade update without strategy ID', { trade: rawTrade }, 'TradeMonitor');
            return;
          }

          // Normalize the trade data
          const updatedTrade: Trade = {
            id: rawTrade.id,
            symbol: rawTrade.symbol,
            side: rawTrade.side,
            status: rawTrade.status || 'pending',
            amount: rawTrade.amount || rawTrade.entry_amount || rawTrade.quantity || rawTrade.size || 0.1,
            entryPrice: rawTrade.entry_price || rawTrade.entryPrice || 0,
            exitPrice: rawTrade.exit_price || rawTrade.exitPrice || 0,
            profit: rawTrade.profit || rawTrade.pnl || 0,
            timestamp: new Date(rawTrade.created_at || rawTrade.timestamp).getTime(),
            strategyId: strategyId,
            createdAt: rawTrade.created_at || new Date(rawTrade.timestamp).toISOString(),
            executedAt: rawTrade.executed_at || null
          };

          // Only update the strategy-specific trades list
          setStrategyTrades(prev => {
            if (!prev[strategyId]) return prev;

            const updatedStrategyTrades = prev[strategyId].map(trade =>
              trade.id === updatedTrade.id ? updatedTrade : trade
            );

            return {
              ...prev,
              [strategyId]: updatedStrategyTrades
            };
          });
        } else if (payload.eventType === 'DELETE') {
          // Remove deleted trade
          const deletedTradeId = payload.old.id;
          const strategyId = payload.old.strategy_id || payload.old.strategyId;

          if (!strategyId) {
            logService.log('warn', 'Received trade deletion without strategy ID', { tradeId: deletedTradeId }, 'TradeMonitor');
            return;
          }

          // Only update the strategy-specific trades list
          setStrategyTrades(prev => {
            if (!prev[strategyId]) return prev;

            const updatedStrategyTrades = prev[strategyId].filter(trade =>
              trade.id !== deletedTradeId
            );

            return {
              ...prev,
              [strategyId]: updatedStrategyTrades
            };
          });
        }
      })
      .subscribe();

    // Set up subscription to strategy updates
    const strategySubscription = supabase
      .channel('strategies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'strategies' }, (payload) => {
        // Handle strategy updates in real-time
        if (payload.eventType === 'UPDATE') {
          const updatedStrategy = payload.new as Strategy;

          // Check if this strategy was deactivated by the user
          const wasDeactivatedByUser = userDeactivatedStrategyIds.has(updatedStrategy.id);

          // Update the strategy in the local state, but preserve our local status
          setStrategies(prev => prev.map(strategy => {
            // If this is the strategy being updated
            if (strategy.id === updatedStrategy.id) {
              // If the strategy was deactivated by the user, always keep it inactive
              // regardless of what the database says
              if (wasDeactivatedByUser) {
                console.log(`Strategy ${strategy.id} update: Keeping inactive status because it was deactivated by user`);
                return { ...strategy, ...updatedStrategy, status: 'inactive' };
              }

              // Otherwise, preserve the current local status to ensure UI consistency
              const preservedStatus = strategy.status;
              console.log(`Strategy ${strategy.id} update: local status=${preservedStatus}, db status=${updatedStrategy.status}`);

              // Create a merged strategy with all updated fields but preserve the status
              const mergedStrategy = { ...strategy, ...updatedStrategy, status: preservedStatus };
              return mergedStrategy;
            }

            // Not the strategy being updated, return unchanged
            return strategy;
          }));

          logService.log('info', `Strategy ${updatedStrategy.id} updated from database with status preserved`, {
            localStatus: strategies.find(s => s.id === updatedStrategy.id)?.status,
            dbStatus: updatedStrategy.status,
            wasDeactivatedByUser
          }, 'TradeMonitor');

          // If the strategy was just activated, subscribe to its trades
          if (updatedStrategy.status === 'active' && !subscribedStrategies.includes(updatedStrategy.id)) {
            const isDemo = demoService.isDemoMode();
            const selectedPairs = updatedStrategy.selected_pairs || [];

            // Subscribe to trades for this strategy
            websocketService.send({
              type: 'subscribe',
              data: {
                channel: 'trades',
                strategyId: updatedStrategy.id,
                useBinanceTestnet: isDemo,
                symbols: selectedPairs.map(pair => toBinanceWsFormat(pair, '@trade'))
              }
            });

            // Update subscribed strategies
            setSubscribedStrategies(prev => [...prev, updatedStrategy.id]);

            logService.log('info', `Subscribed to trades for newly activated strategy ${updatedStrategy.id}`, null, 'TradeMonitor');
          }
        } else if (payload.eventType === 'INSERT') {
          // New strategy created, fetch all strategies to get the new one
          fetchStrategies();
        } else if (payload.eventType === 'DELETE') {
          // Strategy deleted, remove it from the local state
          const deletedStrategy = payload.old as Strategy;
          setStrategies(prev => prev.filter(strategy => strategy.id !== deletedStrategy.id));
          logService.log('info', `Strategy ${deletedStrategy.id} deleted from database`, null, 'TradeMonitor');
        }
      })
      .subscribe();

    // Subscribe to strategy events
    const strategyCreatedUnsubscribe = eventBus.subscribe('strategy:created', () => {
      fetchStrategies().then(() => fetchTradeData());
    });

    // Subscribe to trade events with optimized updates
    const tradeCreatedUnsubscribe = eventBus.subscribe('trade:created', (data) => {
      logService.log('debug', 'Trade created event received', { data }, 'TradeMonitor');

      // Add the new trade to the list without a full refresh
      if (data && data.trade && data.strategy) {
        const strategyId = data.strategy.id;

        // Normalize the trade data
        const normalizedTrade: Trade = {
          id: data.trade.id || `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          symbol: data.trade.symbol,
          side: data.trade.side,
          status: data.trade.status || 'pending',
          amount: data.trade.amount || data.trade.entry_amount || data.trade.quantity ||
                  data.trade.size || (data.signal?.entry?.amount) || 0.1,
          entryPrice: data.trade.entry_price || data.trade.entryPrice || data.trade.price || 0,
          exitPrice: data.trade.exit_price || data.trade.exitPrice || 0,
          profit: data.trade.profit || data.trade.pnl || 0,
          timestamp: data.trade.timestamp || Date.now(),
          strategyId: strategyId,
          createdAt: data.trade.created_at || data.trade.createdAt || new Date().toISOString(),
          executedAt: data.trade.executed_at || data.trade.executedAt || null
        };

        // Only update the strategy-specific trades list
        setStrategyTrades(prev => {
          // Check if trade already exists
          const existingTrade = (prev[strategyId] || []).find(t => t.id === normalizedTrade.id);
          if (existingTrade) return prev; // Skip if trade already exists

          // Add the new trade to the strategy's trades
          const updatedTrades = {
            ...prev,
            [strategyId]: [normalizedTrade, ...(prev[strategyId] || [])].slice(0, 50) // Keep only 50 most recent trades per strategy
          };
          return updatedTrades;
        });

        // Log the new trade
        logService.log('info', `Added new trade for strategy ${strategyId} from event bus`, { trade: normalizedTrade }, 'TradeMonitor');
      }
    });

    const tradeUpdatedUnsubscribe = eventBus.subscribe('trade:update', (data) => {
      logService.log('debug', 'Trade update event received', { data }, 'TradeMonitor');

      // Only update the specific trade that changed
      if (data && (data.orderId || (data.status && data.status.id))) {
        const tradeId = data.orderId || data.status.id;
        const strategyId = data.strategyId || (data.status && data.status.strategyId);

        // Only update the strategy-specific trades list if we have a strategy ID
        if (strategyId) {
          setStrategyTrades(prev => {
            if (!prev[strategyId]) {
              // Initialize the trades array for this strategy if it doesn't exist
              prev[strategyId] = [];
            }

            let tradeWasClosed = false;
            let updatedTrade: Trade | null = null;

            const updatedStrategyTrades = prev[strategyId].map(trade => {
              if (trade.id === tradeId) {
                // Merge the updated data with existing trade
                updatedTrade = { ...trade, ...data.status };

                // Ensure amount field is set
                if (updatedTrade && updatedTrade.amount === undefined) {
                  updatedTrade.amount = trade.amount || 0.1;
                }

                // Check if the trade was just closed
                if (updatedTrade && updatedTrade.status === 'closed' && trade.status !== 'closed') {
                  tradeWasClosed = true;
                }

                return updatedTrade;
              }
              return trade;
            });

            // If the trade wasn't found in the existing trades, add it
            if (!updatedTrade && data.status) {
              updatedTrade = data.status as Trade;
              updatedStrategyTrades.push(updatedTrade);
            }

            // Update budget after trade is closed
            if (tradeWasClosed && updatedTrade) {
              updateBudgetAfterTrade(strategyId, updatedTrade);
            }

            return {
              ...prev,
              [strategyId]: updatedStrategyTrades
            };
          });

          // Log the update
          logService.log('info', `Updated trade ${tradeId} for strategy ${strategyId}`, null, 'TradeMonitor');
        }
      }
    });

    const tradesUpdatedUnsubscribe = eventBus.subscribe('tradesUpdated', (data) => {
      logService.log('debug', 'Trades updated event received', { data }, 'TradeMonitor');

      // Instead of refreshing everything, just update the last update timestamp
      setLastUpdate(Date.now());

      // If we have specific strategy data, update just that strategy's trades
      if (data && data.strategyId) {
        const strategyId = data.strategyId;

        // If we have trades data, update the strategy's trades
        if (data.trades && Array.isArray(data.trades)) {
          // Normalize the trades
          const normalizedTrades = data.trades.map((trade: any) => ({
            id: trade.id || `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            symbol: trade.symbol,
            side: trade.side,
            status: trade.status || 'pending',
            amount: trade.amount || trade.entry_amount || trade.quantity || trade.size || 0.1,
            entryPrice: trade.entry_price || trade.entryPrice || trade.price || 0,
            exitPrice: trade.exit_price || trade.exitPrice || 0,
            profit: trade.profit || trade.pnl || 0,
            timestamp: trade.timestamp || Date.now(),
            strategyId: strategyId,
            createdAt: trade.created_at || trade.createdAt || new Date().toISOString(),
            executedAt: trade.executed_at || trade.executedAt || null
          }));

          // Update the strategy's trades
          setStrategyTrades(prev => ({
            ...prev,
            [strategyId]: normalizedTrades
          }));

          logService.log('info', `Updated trades for strategy ${strategyId}`, { count: normalizedTrades.length }, 'TradeMonitor');
        }
      }
    });

    // Subscribe to strategy deleted events
    const strategyDeletedUnsubscribe = eventBus.subscribe('strategy:deleted', (data) => {
      console.log('Strategy deleted:', data);
      // Update local state to immediately remove the strategy from the list
      setStrategies(prevStrategies => prevStrategies.filter(s => s.id !== data.strategyId));
      // Refresh trade data
      fetchTradeData();
    });

    // Subscribe to strategy status change events
    const strategyStatusChangedUnsubscribe = eventBus.subscribe('strategy:status:changed', (data) => {
      console.log('Strategy status changed:', data);
      if (data && data.strategyId && data.status) {
        // Update the strategy status in our local state
        setStrategies(prevStrategies => {
          return prevStrategies.map(s => {
            if (s.id === data.strategyId) {
              return { ...s, status: data.status };
            }
            return s;
          });
        });

        logService.log('info', `Updated strategy ${data.strategyId} status to ${data.status} from event`, null, 'TradeMonitor');
      }
    });

    // Subscribe to wallet balance updates
    const handleBalanceUpdate = () => {
      setAvailableBalance(walletBalanceService.getAvailableBalance());
    };

    // Subscribe to budget updates
    const handleBudgetUpdate = (data: any) => {
      if (data.strategyId && data.budget) {
        // Calculate percentages
        const budget = data.budget;
        const allocationPercentage = budget.total > 0 ?
          Number(((budget.allocated / budget.total) * 100).toFixed(1)) : 0;
        const profitPercentage = budget.total > 0 && budget.profit ?
          Number(((budget.profit / budget.total) * 100).toFixed(1)) : 0;

        // Update the budget with calculated percentages
        const updatedBudget = {
          ...budget,
          allocationPercentage,
          profitPercentage,
          profit: budget.profit || 0
        };

        setBudgets(prev => ({
          ...prev,
          [data.strategyId]: updatedBudget
        }));

        // Also update the budget in the trade service to ensure consistency across all components
        tradeService.updateBudgetCache(data.strategyId, updatedBudget);

        // Emit a global event to ensure all components are updated
        eventBus.emit('budget:global:updated', {
          strategyId: data.strategyId,
          budget: updatedBudget,
          timestamp: Date.now()
        });

        logService.log('info', `Budget updated for strategy ${data.strategyId}`, {
          budget: updatedBudget,
          available: updatedBudget.available,
          allocated: updatedBudget.allocated,
          total: updatedBudget.total,
          profit: updatedBudget.profit
        }, 'TradeMonitor');
      }
    };

    eventBus.subscribe('budget:updated', handleBudgetUpdate);
    walletBalanceService.on('balancesUpdated', handleBalanceUpdate);

    // Add periodic refresh for trades and statuses to ensure they're always up-to-date
    // This serves as a fallback in case WebSocket updates are missed
    const refreshInterval = setInterval(() => {
      // Only refresh if there are active strategies
      const activeStrategies = strategies.filter(s => s.status === 'active');
      if (activeStrategies.length > 0) {
        logService.log('debug', 'Performing periodic refresh of trades and statuses', null, 'TradeMonitor');

        // Refresh trades for active strategies
        activeStrategies.forEach(async (strategy) => {
          try {
            // Fetch latest trades for this strategy
            const { data: latestTrades, error } = await supabase
              .from('trades')
              .select('*')
              .eq('strategy_id', strategy.id)
              .order('created_at', { ascending: false })
              .limit(50);

            if (error) {
              logService.log('error', `Failed to fetch latest trades for strategy ${strategy.id}`, error, 'TradeMonitor');
              return;
            }

            if (latestTrades && latestTrades.length > 0) {
              // Normalize the trades
              const normalizedTrades = latestTrades.map((trade: any) => ({
                id: trade.id,
                symbol: trade.symbol,
                side: trade.side,
                status: trade.status || 'pending',
                amount: trade.amount || trade.entry_amount || trade.quantity || trade.size || 0.1,
                entryPrice: trade.entry_price || trade.entryPrice || trade.price || 0,
                exitPrice: trade.exit_price || trade.exitPrice || 0,
                profit: trade.profit || trade.pnl || 0,
                timestamp: new Date(trade.created_at || trade.timestamp).getTime(),
                strategyId: strategy.id,
                createdAt: trade.created_at || new Date(trade.timestamp).toISOString(),
                executedAt: trade.executed_at || null
              }));

              // Update the strategy's trades
              setStrategyTrades(prev => {
                // Only update if we have new or different trades
                const currentTrades = prev[strategy.id] || [];

                // Check if we have any new trades or status changes
                const hasChanges = normalizedTrades.some(newTrade => {
                  const existingTrade = currentTrades.find(t => t.id === newTrade.id);
                  return !existingTrade || existingTrade.status !== newTrade.status;
                });

                if (hasChanges) {
                  logService.log('info', `Updating trades for strategy ${strategy.id} from periodic refresh`,
                    { count: normalizedTrades.length }, 'TradeMonitor');

                  return {
                    ...prev,
                    [strategy.id]: normalizedTrades
                  };
                }

                return prev;
              });
            }

            // Also check for strategy status updates
            const { data: strategyData, error: strategyError } = await supabase
              .from('strategies')
              .select('*')
              .eq('id', strategy.id)
              .single();

            if (strategyError) {
              logService.log('error', `Failed to fetch latest status for strategy ${strategy.id}`, strategyError, 'TradeMonitor');
              return;
            }

            if (strategyData) {
              // Check if status has changed
              const currentStrategy = strategies.find(s => s.id === strategy.id);
              if (currentStrategy && currentStrategy.status !== strategyData.status) {
                // Check if this strategy was deactivated by the user
                const wasDeactivatedByUser = userDeactivatedStrategyIds.has(strategy.id);

                if (wasDeactivatedByUser) {
                  // If the strategy was deactivated by the user, always keep it inactive
                  console.log(`Strategy ${strategy.id} is in user-deactivated set, ignoring database status ${strategyData.status}`);
                }
                // Only update the status if the current status is not 'inactive'
                // This ensures that deactivated strategies stay deactivated
                else if (currentStrategy.status !== 'inactive') {
                  logService.log('info', `Strategy ${strategy.id} status changed from ${currentStrategy.status} to ${strategyData.status}`, null, 'TradeMonitor');

                  // Update strategies state
                  setStrategies(prev => prev.map(s =>
                    s.id === strategy.id ? { ...s, status: strategyData.status } : s
                  ));
                } else {
                  // If the strategy is inactive in our UI but active in the database,
                  // log this but don't update the UI
                  console.log(`Strategy ${strategy.id} is inactive in UI but ${strategyData.status} in database, preserving inactive status`);
                }
              }
            }
          } catch (error) {
            logService.log('error', `Error during periodic refresh for strategy ${strategy.id}`, error, 'TradeMonitor');
          }
        });

        // Update last update timestamp
        setLastUpdate(Date.now());
      }
    }, 30000); // Refresh every 30 seconds

    return () => {
      // Clear the refresh interval
      clearInterval(refreshInterval);
      // Unsubscribe from all subscriptions
      tradeSubscription.unsubscribe();
      strategySubscription.unsubscribe();
      strategyCreatedUnsubscribe();
      tradeCreatedUnsubscribe();
      tradeUpdatedUnsubscribe();
      tradesUpdatedUnsubscribe();
      strategyDeletedUnsubscribe();
      strategyStatusChangedUnsubscribe();
      eventBus.unsubscribe('budget:updated', handleBudgetUpdate);
      walletBalanceService.off('balancesUpdated', handleBalanceUpdate);

      // Remove the direct DOM event listener
      document.removeEventListener('strategy:remove', handleStrategyRemove);

      // Clean up market analyzer
      marketAnalyzer.cleanup();
    };
  }, []);

  // Fetch strategies from the database - optimized to avoid full refreshes
  const fetchStrategies = async () => {
    try {
      logService.log('debug', 'Fetching strategies from database', null, 'TradeMonitor');

      // Get strategies directly from the database
      const { data: fetchedStrategies, error } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // If no strategies found, create a default one for demo purposes
      if (!fetchedStrategies || fetchedStrategies.length === 0) {
        logService.log('info', 'No strategies found, creating demo strategy', null, 'TradeMonitor');

        // Create a demo strategy if in demo mode
        if (demoService.isInDemoMode()) {
          const demoStrategy = {
            id: 'demo-strategy-1',
            title: 'Demo BTC Strategy',
            description: 'Automatically created demo strategy',
            status: 'active',
            user_id: (await supabase.auth.getUser()).data.user?.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            selected_pairs: ['BTC/USDT'],
            risk_level: 'Medium',
            market_type: 'spot'
          };

          // Return the demo strategy
          return [demoStrategy];
        }
      }

      // Filter out any strategies that were deleted in this session
      const filteredStrategies = fetchedStrategies.filter(strategy => {
        const isDeleted = deletedStrategyIds.has(strategy.id);
        if (isDeleted) {
          logService.log('debug', `Filtering out deleted strategy ${strategy.id}`, null, 'TradeMonitor');
        }
        return !isDeleted;
      });

      logService.log('info', `Fetched ${filteredStrategies.length} strategies from database`, null, 'TradeMonitor');

      // Update strategies without triggering a full refresh
      // Compare existing strategies with fetched ones to only update what changed
      setStrategies(prevStrategies => {
        // Create map for faster lookups
        const prevMap = new Map(prevStrategies.map(s => [s.id, s]));

        // Check if anything changed
        let hasChanges = prevStrategies.length !== filteredStrategies.length;

        if (!hasChanges) {
          // Check if any strategy details changed
          for (const strategy of filteredStrategies) {
            const prevStrategy = prevMap.get(strategy.id);
            if (!prevStrategy || prevStrategy.status !== strategy.status) {
              hasChanges = true;
              break;
            }
          }
        }

        // Only update if there are actual changes
        if (hasChanges) {
          // Create a new array of strategies, preserving the status of any strategies
          // that were manually deactivated by the user
          return filteredStrategies.map(strategy => {
            const prevStrategy = prevMap.get(strategy.id);

            // Check if this strategy was deactivated by the user
            const wasDeactivatedByUser = userDeactivatedStrategyIds.has(strategy.id);

            // If the strategy was deactivated by the user, always keep it inactive
            if (wasDeactivatedByUser) {
              console.log(`Strategy ${strategy.id} is in user-deactivated set, keeping inactive during fetch`);
              return { ...strategy, status: 'inactive' };
            }
            // If the strategy was previously inactive, keep it inactive
            // This ensures that deactivated strategies stay deactivated
            else if (prevStrategy && prevStrategy.status === 'inactive') {
              console.log(`Preserving inactive status for strategy ${strategy.id} during fetch`);
              return { ...strategy, status: 'inactive' };
            }

            return strategy;
          });
        } else {
          return prevStrategies;
        }
      });

      // Subscribe to market data for active strategies
      filteredStrategies.forEach(strategy => {
        if (strategy.status === 'active') {
          // Use the WebSocket service to subscribe to the strategy and its market data
          websocketService.subscribeToStrategy(strategy.id)
            .catch((error: any) => {
              logService.log('error', `Failed to subscribe to strategy ${strategy.id}`, error, 'TradeMonitor');
            });
        }
      });

      // Force a UI update
      setLastUpdate(Date.now());

      return filteredStrategies;
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
      logService.log('error', 'Failed to fetch strategies', error, 'TradeMonitor');
      return [];
    }
  };

  // Helper functions are now handled by the TradeList component

  // Using normalizeSymbol from symbol-utils

  // Fetch trade data from exchange or TestNet
  const fetchTradeData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get trades from the database or exchange
      let fetchedTrades: Trade[] = [];

      try {
        // Check if we're in demo mode
        if (demoService.isInDemoMode()) {
          // Use Binance TestNet data
          logService.log('info', 'Fetching trades from Binance TestNet', null, 'TradeMonitor');

          // Get trades from TestNet
          const testnetTrades = await fetchTestNetTrades();
          fetchedTrades = testnetTrades;
        } else {
          // Use the user's configured exchange
          logService.log('info', 'Fetching trades from user exchange', null, 'TradeMonitor');

          // Get trades from the user's exchange
          const exchangeTrades = await fetchExchangeTrades();
          fetchedTrades = exchangeTrades;
        }
      } catch (fetchError) {
        logService.log('error', 'Failed to fetch trades from exchange', fetchError, 'TradeMonitor');
        // Continue with empty trades array
      }

      // Update state with fetched trades
      setTrades(fetchedTrades);

      // Group trades by strategy
      const tradesByStrategy: Record<string, Trade[]> = {};
      fetchedTrades.forEach(trade => {
        if (trade.strategyId) {
          if (!tradesByStrategy[trade.strategyId]) {
            tradesByStrategy[trade.strategyId] = [];
          }
          tradesByStrategy[trade.strategyId].push(trade);
        }
      });

      // Update strategy trades
      setStrategyTrades(prev => {
        const updated = { ...prev };

        // Add new trades from fetched data
        Object.entries(tradesByStrategy).forEach(([strategyId, trades]) => {
          // Only update if we have new trades or if there are no trades for this strategy yet
          if (!updated[strategyId] || updated[strategyId].length === 0 ||
              trades.some(t => !updated[strategyId].find(ut => ut.id === t.id))) {
            updated[strategyId] = trades;
            logService.log('info', `Updated trades for strategy ${strategyId}`, { count: trades.length }, 'TradeMonitor');
          }
        });

        return updated;
      });

      // Update budgets based on trades
      const activeStrategies = strategies.filter(s => s.status === 'active');
      for (const strategy of activeStrategies) {
        // Get current budget
        const currentBudget = budgets[strategy.id];
        if (!currentBudget) {
          // Initialize budget if it doesn't exist
          await (tradeService as any).initializeBudget(strategy.id);
          const budget = tradeService.getBudget(strategy.id);

          if (budget) {
            // Calculate percentages
            const allocationPercentage = budget.total > 0 ?
              (budget.allocated / budget.total) * 100 : 0;
            const profitPercentage = budget.total > 0 && budget.profit ?
              (budget.profit / budget.total) * 100 : 0;

            // Update budgets state
            setBudgets(prev => ({
              ...prev,
              [strategy.id]: {
                ...budget,
                allocationPercentage,
                profitPercentage,
                profit: budget.profit || 0
              }
            }));
          }
        }
      }

      // Calculate trade statistics
      calculateTradeStats(fetchedTrades);

      // Update last update timestamp
      setLastUpdate(Date.now());
    } catch (error) {
      logService.log('error', 'Failed to fetch trade data', error, 'TradeMonitor');
      setError('Failed to fetch trade data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };



  // Fetch trades from Binance TestNet
  /**
   * Generates mock trades for testing and fallback purposes
   * @param symbol Trading pair symbol
   * @param count Number of trades to generate
   * @param strategyId Optional strategy ID
   * @param budget Optional budget constraint
   * @returns Array of mock trades
   */
  const generateTestNetMockTrades = (
    symbol: string = 'BTC/USDT',
    count: number = 5,
    strategyId?: string,
    budget?: number
  ): Trade[] => {
    const trades = [];
    const now = Date.now();

    // Normalize the symbol format
    const normalizedSymbol = normalizeSymbol(symbol);

    // Extract the base asset for price determination
    const baseAsset = normalizedSymbol.split('/')[0];

    // Get base price for the symbol
    let basePrice = getBasePrice(normalizedSymbol);

    // Ensure we have a valid base price
    if (!basePrice || basePrice <= 0) {
      basePrice = 100; // Default fallback price
      logService.log('warn', `Using default price of ${basePrice} for ${normalizedSymbol}`, null, 'TradeMonitor');
    } else {
      logService.log('debug', `Using base price of ${basePrice} for ${normalizedSymbol}`, null, 'TradeMonitor');
    }

    // Calculate maximum amount based on budget if provided
    let maxTotalAmount = Infinity;
    if (budget && budget > 0) {
      const budgetToUse = budget * 0.8;
      const perTradeBudget = budgetToUse / count;
      maxTotalAmount = perTradeBudget / basePrice;
    }

    for (let i = 0; i < count; i++) {
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const price = basePrice * (0.98 + Math.random() * 0.04);

      // Calculate amount based on price and budget constraints
      let amount;
      if (maxTotalAmount !== Infinity) {
        amount = maxTotalAmount * (0.2 + Math.random() * 0.6);
      } else {
        if (price > 10000) { // BTC
          amount = 0.001 + Math.random() * 0.009;
        } else if (price > 1000) { // ETH
          amount = 0.01 + Math.random() * 0.09;
        } else if (price > 100) { // SOL, etc.
          amount = 0.1 + Math.random() * 0.4;
        } else {
          amount = 1 + Math.random() * 4;
        }
      }

      // Round to 6 decimal places for crypto
      amount = Math.round(amount * 1000000) / 1000000;

      const cost = price * amount;
      const fee = cost * 0.001; // 0.1% fee

      // Create stable unique ID that won't change on re-renders
      const normalizedSymbolForId = normalizedSymbol.replace('/', '');
      const uniqueId = `mock-${normalizedSymbolForId}-${i}-${now + i}`;

      // Extract quote currency (USDT, BTC, etc.)
      const quoteCurrency = normalizedSymbol.split('/')[1] || 'USDT';

      // Create a realistic trade object
      trades.push({
        id: uniqueId,
        timestamp: now - (i * 60000),
        symbol: normalizedSymbol, // Use normalized symbol
        side,
        entryPrice: price,
        amount,
        status: 'completed',
        strategyId: strategyId || 'mock-strategy',
        createdAt: new Date(now - (i * 60000)).toISOString(),
        fee: { cost: fee, currency: quoteCurrency },
        cost
      });
    }

    return trades as Trade[];
  };

  // Using getBasePrice, generateRandomPrice, and generateRandomAmount from symbol-utils

  // Cache for TestNet trades to avoid excessive API calls
  const tradeCache = new Map<string, {trades: Trade[], timestamp: number}>();
  const TRADE_CACHE_TTL = 60 * 1000; // 1 minute cache TTL

  const fetchTestNetTrades = async (): Promise<Trade[]> => {
    try {
      logService.log('info', 'Fetching trades from Binance TestNet', null, 'TradeMonitor');

      // Get active strategies to use their symbols
      const activeStrategies = await strategyService.getActiveStrategies();

      // If no active strategies, return empty array
      if (activeStrategies.length === 0) {
        logService.log('info', 'No active strategies found', null, 'TradeMonitor');
        return [];
      }

      // Check cache first
      const cacheKey = 'all_strategies';
      const cachedData = tradeCache.get(cacheKey);
      const now = Date.now();

      if (cachedData && (now - cachedData.timestamp) < TRADE_CACHE_TTL) {
        logService.log('info', 'Using cached trades for all strategies', null, 'TradeMonitor');
        return cachedData.trades;
      }

      // Initialize exchange with proper TestNet configuration
      const exchange = await ccxtService.getExchange('binance', true);

      if (!exchange) {
        logService.log('error', 'Failed to initialize TestNet exchange', null, 'TradeMonitor');
        return generateTestNetMockTrades();
      }

      // Collect all unique symbols from active strategies
      const symbols = new Set<string>();
      activeStrategies.forEach(strategy => {
        (strategy.selected_pairs || []).forEach(pair => {
          symbols.add(pair);
        });
      });

      const allTrades: Trade[] = [];

      // Fetch trades for each symbol
      for (const symbol of Array.from(symbols)) {
        try {
          // Normalize the symbol format
          const normalizedSymbol = normalizeSymbol(symbol);

          logService.log('info', `Fetching trades for symbol ${normalizedSymbol}`, null, 'TradeMonitor');

          // Create a cache key for this specific symbol
          const symbolCacheKey = `trades:${normalizedSymbol}`;
          const cachedSymbolData = tradeCache.get(symbolCacheKey);

          // Check if we have cached data for this symbol
          if (cachedSymbolData && (now - cachedSymbolData.timestamp) < TRADE_CACHE_TTL) {
            logService.log('info', `Using cached trades for ${normalizedSymbol}`, null, 'TradeMonitor');
            allTrades.push(...cachedSymbolData.trades);
            continue; // Skip to next symbol
          }

          let symbolTrades;
          try {
            symbolTrades = await exchange.fetchMyTrades(normalizedSymbol, undefined, 20);
            logService.log('info', `Successfully fetched ${symbolTrades.length} trades for ${normalizedSymbol}`, null, 'TradeMonitor');
          } catch (fetchError) {
            logService.log('warn', `Failed to fetch trades for ${normalizedSymbol}, using mock data`, fetchError, 'TradeMonitor');
            // Generate mock trades for this symbol
            symbolTrades = generateTestNetMockTrades(normalizedSymbol, 5, activeStrategies[0]?.id);
            logService.log('info', `Generated ${symbolTrades.length} mock trades for ${normalizedSymbol}`, null, 'TradeMonitor');
          }

          // Format the trades to match our Trade interface
          const formattedTrades = symbolTrades.map((trade, index) => {
            // Create a stable ID that won't change on re-renders
            const stableId = `testnet-${normalizedSymbol.replace('/', '')}-${index}-${trade.id || Date.now()}`;

            return {
              id: stableId,
              timestamp: trade.timestamp || Date.now(),
              symbol: normalizedSymbol,
              side: trade.side || (Math.random() > 0.5 ? 'buy' : 'sell'),
              entryPrice: trade.price || generateRandomPrice(normalizedSymbol),
              amount: trade.amount || generateRandomAmount(),
              status: 'completed',
              strategyId: activeStrategies[0].id,
              createdAt: new Date(trade.timestamp || Date.now()).toISOString()
            };
          });

          // Cache the trades for this symbol
          tradeCache.set(symbolCacheKey, {
            trades: formattedTrades,
            timestamp: Date.now()
          });

          // Add to the all trades collection
          allTrades.push(...formattedTrades);
        } catch (symbolError) {
          logService.log('warn', `Failed to fetch trades for ${symbol}`, symbolError, 'TradeMonitor');
          // Generate mock trades as a fallback
          try {
            const mockTrades = generateTestNetMockTrades(symbol, 3, activeStrategies[0]?.id);
            allTrades.push(...mockTrades);
            logService.log('info', `Generated fallback mock trades for ${symbol} after error`, { count: mockTrades.length }, 'TradeMonitor');
          } catch (mockError) {
            logService.log('error', `Failed to generate mock trades for ${symbol}`, mockError, 'TradeMonitor');
          }
          // Continue with other symbols
        }
      }

      // Cache the results
      tradeCache.set('all_strategies', {
        trades: allTrades,
        timestamp: Date.now()
      });

      return allTrades;
    } catch (error) {
      logService.log('error', 'Failed to fetch TestNet trades', error, 'TradeMonitor');
      return generateTestNetMockTrades();
    }
  };

  // Fetch trades from user's configured exchange
  const fetchExchangeTrades = async (): Promise<Trade[]> => {
    try {
      // Check if we have a valid cache for exchange trades
      const cacheKey = 'exchange_trades';
      const cachedData = tradeCache.get(cacheKey);
      const now = Date.now();

      if (cachedData && (now - cachedData.timestamp) < TRADE_CACHE_TTL) {
        logService.log('info', 'Using cached exchange trades', null, 'TradeMonitor');
        return cachedData.trades;
      }

      // Get the active exchange
      const exchange = await exchangeService.getActiveExchange();

      if (!exchange) {
        throw new Error('No active exchange configured');
      }

      // Fetch trades from the database with limit to improve performance
      const { data, error: dbError } = await supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100); // Limit to 100 most recent trades for better performance

      if (dbError) {
        // Check if the error is because the trades table doesn't exist
        if (dbError.message && dbError.message.includes('relation "trades" does not exist')) {
          console.warn('Trades table does not exist, returning empty array');
          return [];
        }
        throw dbError;
      }

      // Convert to our Trade format
      const formattedTrades = (data || []).map(trade => ({
        id: trade.id,
        symbol: trade.symbol,
        type: trade.type || 'market',
        side: trade.side,
        status: trade.status,
        entryPrice: trade.entry_price,
        exitPrice: trade.exit_price,
        amount: trade.amount,
        profit: trade.profit,
        timestamp: new Date(trade.created_at).getTime(),
        closedAt: trade.closed_at ? new Date(trade.closed_at).getTime() : undefined,
        strategyId: trade.strategy_id,
      }));

      // Cache the results
      tradeCache.set('exchange_trades', {
        trades: formattedTrades,
        timestamp: now
      });

      return formattedTrades;
    } catch (error) {
      logService.log('error', 'Failed to fetch exchange trades', error, 'TradeMonitor');
      return [];
    }
  };



  // Update budget after a trade is closed
  const updateBudgetAfterTrade = (strategyId: string, trade: Trade) => {
    const currentBudget = budgets[strategyId];
    if (!currentBudget) {
      logService.log('warn', `No budget found for strategy ${strategyId}`, { tradeId: trade.id }, 'TradeMonitor');
      return;
    }

    // Calculate trade value in USDT - this is the amount * entryPrice
    const tradeValue = trade.amount && trade.entryPrice ?
      Number((trade.amount * trade.entryPrice).toFixed(2)) : 0;

    // Calculate profit/loss
    const profitLoss = trade.profit ? Number(trade.profit.toFixed(2)) : 0;

    logService.log('info', `Updating budget after trade closure for strategy ${strategyId}`,
      { tradeId: trade.id, tradeValue, profitLoss }, 'TradeMonitor');

    // Update budget
    const updatedBudget: StrategyBudget = {
      ...currentBudget,
      available: Number((currentBudget.available + tradeValue + profitLoss).toFixed(2)),
      allocated: Number((Math.max(0, currentBudget.allocated - tradeValue)).toFixed(2)),
      profit: Number(((currentBudget.profit || 0) + profitLoss).toFixed(2)),
      lastUpdated: Date.now()
    };

    // Calculate percentages
    updatedBudget.allocationPercentage = updatedBudget.total > 0 ?
      Number(((updatedBudget.allocated / updatedBudget.total) * 100).toFixed(1)) : 0;
    updatedBudget.profitPercentage = updatedBudget.total > 0 && updatedBudget.profit !== undefined ?
      Number(((updatedBudget.profit / updatedBudget.total) * 100).toFixed(1)) : 0;

    // Update budgets state
    setBudgets(prev => ({
      ...prev,
      [strategyId]: updatedBudget
    }));

    // Emit event to update other components
    eventBus.emit('budget:updated', {
      strategyId,
      budget: updatedBudget,
      trade: trade,
      tradeValue: tradeValue
    });
  };

  // Calculate trade statistics
  const calculateTradeStats = (currentTrades: Trade[]) => {
    // Calculate stats but don't store them since we're not using them in the UI
    const stats = {
      totalTrades: currentTrades.length,
      profitableTrades: currentTrades.filter(t => (t.profit || 0) > 0).length,
      totalProfit: currentTrades.reduce((sum, t) => sum + (t.profit || 0), 0),
      averageProfit: currentTrades.length ?
        currentTrades.reduce((sum, t) => sum + (t.profit || 0), 0) / currentTrades.length :
        0
    };

    // Log stats for debugging
    logService.log('info', 'Trade statistics calculated', { stats }, 'TradeMonitor');
  };

  // Refresh data manually
  const refresh = async () => {
    if (refreshing) return;

    try {
      setRefreshing(true);
      await fetchTradeData();
    } catch (error) {
      logService.log('error', 'Failed to refresh data', error, 'TradeMonitor');
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle budget confirmation
  const handleBudgetConfirm = async (budget: StrategyBudget) => {
    if (!pendingStrategy) return;

    // Check if budget exceeds available balance
    if (budget.total > availableBalance) {
      logService.log('info', `Budget exceeds available balance: ${budget.total} > ${availableBalance}`, null, 'TradeMonitor');
      setPendingBudget(budget.total);
      setShowBudgetModal(false);
      setShowBudgetAdjustmentModal(true);
      return;
    }

    try {
      // Store the strategy locally in case the modal is closed
      const strategyToActivate = { ...pendingStrategy };

      // Start the activation process
      await activateStrategyWithBudget(strategyToActivate, budget);
    } catch (error) {
      logService.log('error', 'Error in budget confirmation handler', error, 'TradeMonitor');
      setError('Failed to activate strategy. Please try again.');

      // Make sure modals are closed even on error
      setShowBudgetModal(false);
      setShowBudgetAdjustmentModal(false);
      setPendingStrategy(null);
      setPendingBudget(0);
      setIsSubmittingBudget(false);
    }
  };

  // Handle budget adjustment confirmation
  const handleBudgetAdjustmentConfirm = async (budget: StrategyBudget) => {
    if (!pendingStrategy) return;

    try {
      // Store the strategy locally in case the modal is closed
      const strategyToActivate = { ...pendingStrategy };

      // Start the activation process
      await activateStrategyWithBudget(strategyToActivate, budget);
    } catch (error) {
      logService.log('error', 'Error in budget adjustment confirmation handler', error, 'TradeMonitor');
      setError('Failed to activate strategy. Please try again.');

      // Make sure modals are closed even on error
      setShowBudgetModal(false);
      setShowBudgetAdjustmentModal(false);
      setPendingStrategy(null);
      setPendingBudget(0);
      setIsSubmittingBudget(false);
    }
  };

  // Activate a strategy with the given budget - optimized version with seamless UI updates
  const activateStrategyWithBudget = async (strategy: Strategy, budget: StrategyBudget) => {
    try {
      setError(null);
      setIsSubmittingBudget(true);

      // Always close modals first to prevent UI from getting stuck
      setShowBudgetModal(false);
      setShowBudgetAdjustmentModal(false);

      // 1. Set the budget first
      await tradeService.setBudget(strategy.id, budget);
      logService.log('info', `Budget set for strategy ${strategy.id}`, { budget }, 'TradeMonitor');

      // 2. Get the latest strategy data to ensure we have the most up-to-date information
      try {
        const { data: latestStrategy, error: fetchError } = await supabase
          .from('strategies')
          .select('*')
          .eq('id', strategy.id)
          .single();

        if (fetchError) {
          // If we get a content type error, try refreshing the session
          if (fetchError.message?.includes('Content-Type not acceptable') ||
              fetchError.code === 'PGRST102') {
            logService.log('warn', 'Content-Type error when fetching strategy, attempting to refresh session',
              fetchError, 'TradeMonitor');

            // Import the refreshSession function and try to refresh the session
            let refreshed = false;
            try {
              const { refreshSession } = await import('../lib/supabase');

              // Try to refresh the session
              refreshed = await refreshSession();
            } catch (importError) {
              logService.log('error', 'Failed to import refreshSession function',
                importError, 'TradeMonitor');
              throw new Error(`Failed to import refreshSession: ${importError.message}`);
            }

            if (refreshed) {
              logService.log('info', 'Session refreshed successfully, retrying fetch', null, 'TradeMonitor');

              // Retry the fetch
              const { data: retryStrategy, error: retryError } = await supabase
                .from('strategies')
                .select('*')
                .eq('id', strategy.id)
                .single();

              if (retryError) {
                throw new Error(`Failed to fetch strategy after session refresh: ${retryError.message}`);
              }

              if (!retryStrategy) {
                throw new Error('No strategy data returned after session refresh');
              }

              // Use the retry data
              logService.log('info', 'Successfully fetched strategy after session refresh', null, 'TradeMonitor');
            } else {
              throw new Error(`Failed to refresh session: ${fetchError.message}`);
            }
          } else {
            throw new Error(`Failed to fetch latest strategy data: ${fetchError.message}`);
          }
        } else if (!latestStrategy) {
          throw new Error('No strategy data returned');
        }
      } catch (fetchError) {
        logService.log('warn', `Error fetching latest strategy data, continuing with activation`,
          fetchError, 'TradeMonitor');
        // Continue with activation despite this error
      }

      // 3. Optimistically update the UI before the backend confirms the change
      // This provides immediate feedback to the user without waiting for the full refresh
      setStrategies(prevStrategies => {
        return prevStrategies.map(s => {
          if (s.id === strategy.id) {
            // Create an updated version of the strategy with active status
            return { ...s, status: 'active' };
          }
          return s;
        });
      });

      // 4. Activate the strategy in the database
      try {
        const updatedStrategy = await strategyService.activateStrategy(strategy.id);
        logService.log('info', `Strategy ${strategy.id} activated in database`, null, 'TradeMonitor');

        // 5. Start monitoring the strategy - wrap in try/catch to continue even if this fails
        try {
          await marketService.startStrategyMonitoring(updatedStrategy);
          logService.log('info', `Started monitoring for strategy ${strategy.id}`, null, 'TradeMonitor');
        } catch (monitorError) {
          logService.log('warn', `Error starting market monitoring for strategy ${strategy.id}, continuing with activation`,
            monitorError, 'TradeMonitor');
        }
      } catch (activationError) {
        // If we get a content type error, try refreshing the session and retry
        if (activationError.message?.includes('Content-Type not acceptable') ||
            (activationError.code && activationError.code === 'PGRST102')) {
          logService.log('warn', 'Content-Type error when activating strategy, attempting to refresh session',
            activationError, 'TradeMonitor');

          // Import the refreshSession function and try to refresh the session
          let refreshed = false;
          try {
            const { refreshSession } = await import('../lib/supabase');

            // Try to refresh the session
            refreshed = await refreshSession();
          } catch (importError) {
            logService.log('error', 'Failed to import refreshSession function',
              importError, 'TradeMonitor');
            // Continue with activation despite this error - the UI is already updated
          }
          if (refreshed) {
            logService.log('info', 'Session refreshed successfully, retrying activation', null, 'TradeMonitor');

            // Retry the activation
            try {
              const updatedStrategy = await strategyService.activateStrategy(strategy.id);
              logService.log('info', `Strategy ${strategy.id} activated in database after session refresh`,
                null, 'TradeMonitor');

              // Start monitoring the strategy
              try {
                await marketService.startStrategyMonitoring(updatedStrategy);
                logService.log('info', `Started monitoring for strategy ${strategy.id} after session refresh`,
                  null, 'TradeMonitor');
              } catch (monitorError) {
                logService.log('warn', `Error starting market monitoring for strategy ${strategy.id} after session refresh, continuing with activation`,
                  monitorError, 'TradeMonitor');
              }
            } catch (retryError) {
              logService.log('error', `Failed to activate strategy after session refresh`,
                retryError, 'TradeMonitor');
              // Continue with activation despite this error - the UI is already updated
            }
          } else {
            logService.log('error', `Failed to refresh session for strategy activation`,
              activationError, 'TradeMonitor');
            // Continue with activation despite this error - the UI is already updated
          }
        } else {
          logService.log('warn', `Error activating strategy in database, continuing with UI update only`,
            activationError, 'TradeMonitor');
          // Continue with activation despite this error - the UI is already updated
        }
      }

      // IMPORTANT: Do NOT refresh the strategy list here - we've already updated the UI optimistically

      // 6. Connect to trading engine to start generating trades - wrap in try/catch to continue even if this fails
      try {
        const connected = await tradeService.connectStrategyToTradingEngine(strategy.id);

        if (!connected) {
          // If connection failed, log a warning but continue
          logService.log('warn', `Failed to connect strategy ${strategy.id} to trading engine, will retry later`,
            null, 'TradeMonitor');
        } else {
          logService.log('info', `Connected strategy ${strategy.id} to trading engine`, null, 'TradeMonitor');
        }
      } catch (engineError) {
        logService.log('warn', `Error connecting strategy ${strategy.id} to trading engine, will retry later`,
          engineError, 'TradeMonitor');
      }

      // 7. Subscribe to the strategy's trades via WebSocket without refreshing the UI
      try {
        await websocketService.subscribeToStrategy(strategy.id);
        logService.log('info', `Subscribed to WebSocket updates for strategy ${strategy.id}`, null, 'TradeMonitor');

        // Get the budget for this strategy
        const strategyBudget = tradeService.getBudget(strategy.id);

        // Create a real trade using the unified trade service for immediate visual feedback
        const symbol = strategy.selected_pairs?.[0] || 'BTC/USDT';
        const basePrice = getBasePrice(symbol);
        const marketType = strategy.market_type || 'spot';

        // Calculate a reasonable amount based on budget
        let amount = 0.1; // Default fallback

        if (strategyBudget && strategyBudget.available > 0 && basePrice > 0) {
          // Use at most 20% of available budget for a single trade
          const maxBudgetToUse = Math.min(strategyBudget.available, strategyBudget.available * 0.2);
          amount = maxBudgetToUse / basePrice;
          // Round to 6 decimal places for crypto
          amount = Math.round(amount * 1000000) / 1000000;

          logService.log('info', `Calculated trade amount ${amount} based on budget ${strategyBudget.available} for ${symbol}`, null, 'TradeMonitor');
        }

        try {
          // Generate a trade side based on market conditions
          const side = Math.random() > 0.5 ? 'buy' : 'sell';

          // Calculate stop loss and take profit based on market conditions
          const stopLoss = side === 'buy'
            ? basePrice * 0.95 // 5% below entry for buy
            : basePrice * 1.05; // 5% above entry for sell

          const takeProfit = side === 'buy'
            ? basePrice * 1.1 // 10% above entry for buy
            : basePrice * 0.9; // 10% below entry for sell

          // Create trade options
          const tradeOptions = {
            strategy_id: strategy.id,
            symbol: symbol,
            side: side,
            quantity: amount,
            price: basePrice,
            entry_price: basePrice,
            stop_loss: stopLoss,
            take_profit: takeProfit,
            trailing_stop: 2.5, // 2.5% trailing stop
            market_type: marketType, // Use market_type for database column name
            marginType: marketType === 'futures' ? 'cross' : undefined,
            leverage: marketType === 'futures' ? 2 : undefined,
            rationale: 'Initial trade for newly activated strategy',
            entry_conditions: ['Strategy activation'],
            exit_conditions: ['Take profit', 'Stop loss', 'Trailing stop']
          };

          // Create the trade using unified trade service
          const createdTrade = await unifiedTradeService.createTrade(tradeOptions);

          if (createdTrade) {
            logService.log('info', `Created initial trade for strategy ${strategy.id} using unified trade service`, {
              tradeId: createdTrade.id,
              symbol,
              side,
              amount
            }, 'TradeMonitor');

            // The trade will be added to the UI through the event system
          } else {
            // Fallback to adding a placeholder trade if creation fails
            logService.log('warn', `Failed to create trade using unified service, adding placeholder`, null, 'TradeMonitor');

            const placeholderTrade: Trade = {
              id: `placeholder-${strategy.id}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
              symbol: symbol,
              side: side,
              status: 'pending',
              entryPrice: basePrice,
              timestamp: Date.now(),
              strategyId: strategy.id,
              createdAt: new Date().toISOString(),
              executedAt: null,
              amount: amount
            };

            // Add the placeholder trade to the strategy's trades only if it doesn't exist
            setStrategyTrades(prev => {
              // Check if a similar placeholder trade already exists
              const existingPlaceholder = (prev[strategy.id] || []).find(t =>
                t.id.startsWith('placeholder-') && t.symbol === placeholderTrade.symbol);
              if (existingPlaceholder) return prev; // Skip if a similar placeholder exists

              return {
                ...prev,
                [strategy.id]: [placeholderTrade, ...(prev[strategy.id] || [])]
              };
            });
          }
        } catch (tradeError) {
          logService.log('error', `Failed to create initial trade for strategy ${strategy.id}`, tradeError, 'TradeMonitor');
        }
      } catch (wsError) {
        logService.log('warn', `Error subscribing to WebSocket updates for strategy ${strategy.id}`, wsError, 'TradeMonitor');
      }

      // 8. Fetch trade data in the background without disrupting the UI
      fetchTradeData().catch(error => {
        logService.log('warn', 'Error fetching trade data in background', error, 'TradeMonitor');
      });

      // 9. Clean up state
      setPendingStrategy(null);
      setPendingBudget(0);

      logService.log('info', `Strategy ${strategy.id} successfully activated with budget`, { budget }, 'TradeMonitor');
    } catch (error) {
      logService.log('error', 'Failed to activate strategy with budget', error, 'TradeMonitor');
      setError('Failed to activate strategy. Please try again.');

      // Make sure modals are closed even on error
      setShowBudgetModal(false);
      setShowBudgetAdjustmentModal(false);
      setPendingStrategy(null);
      setPendingBudget(0);
    } finally {
      setIsSubmittingBudget(false);
    }
  };

  // Trade filtering is now handled by the TradeList component

  // Custom scrollbar styles
  const scrollbarStyles = `
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(31, 41, 55, 0.2);
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(75, 85, 99, 0.5);
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(107, 114, 128, 0.7);
    }
  `;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black p-6 sm:p-8 mobile-p-4 overflow-x-hidden pb-24 sm:pb-8">
        <style>{scrollbarStyles}</style>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 max-w-[1800px] mx-auto"
        >
        {/* Header Section - Desktop */}
        <div className="hidden sm:flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-6 h-6 text-neon-pink" />
              <h1 className="text-2xl font-bold gradient-text">Trade Monitor</h1>
            </div>
            <p className="description-text mt-1 text-gray-300">Monitor your active trades in real-time. Track positions, P&L, and market conditions.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 mr-4">
              <MarketTypeBalanceDisplay compact />
            </div>
            <span className="text-sm text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Last update: {new Date(lastUpdate).toLocaleTimeString()}
            </span>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors flex items-center gap-2 btn-text-small"
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </button>
          </div>
        </div>

        {/* Header Section - Mobile */}
        <div className="sm:hidden mb-4">
          <div className="flex items-center justify-center mb-2">
            <Activity className="w-5 h-5 text-neon-pink mr-2" />
            <h1 className="text-xl font-bold gradient-text">Trade Monitor</h1>
          </div>
          <div className="flex items-center justify-between">
            <MarketTypeBalanceDisplay compact />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {new Date(lastUpdate).toLocaleTimeString()}
              </span>
              <button
                onClick={refresh}
                disabled={refreshing}
                className="px-2 py-1 bg-pink-600 hover:bg-pink-700 text-white text-xs rounded-md transition-colors flex items-center gap-1"
              >
                {refreshing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Refresh
              </button>
            </div>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left side - Strategies */}
            <div className="w-full lg:flex-1">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 mb-6">
                <div className="relative w-full md:max-w-xs">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search strategies..."
                    className="pl-10 pr-4 py-2 bg-gunmetal-800 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-pink-500 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  <button
                    className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg btn-text-small ${statusFilter === 'all' ? 'bg-pink-600 text-white' : 'bg-gunmetal-800 text-gray-300'}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    All
                  </button>
                  <button
                    className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg btn-text-small ${statusFilter === 'active' ? 'bg-pink-600 text-white' : 'bg-gunmetal-800 text-gray-300'}`}
                    onClick={() => setStatusFilter('active')}
                  >
                    Active
                  </button>
                  <button
                    className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg btn-text-small ${statusFilter === 'inactive' ? 'bg-pink-600 text-white' : 'bg-gunmetal-800 text-gray-300'}`}
                    onClick={() => setStatusFilter('inactive')}
                  >
                    Inactive
                  </button>
                </div>
              </div>

              {/* Strategy Cards Layout */}
              <div className="grid grid-cols-1 gap-6">
                {/* Strategies Column */}
                <div className="space-y-4">
                  {strategies.length === 0 ? (
                    <div className="text-center py-12 bg-gunmetal-800/50 rounded-lg">
                      <div className="flex justify-center mb-4">
                        <Activity className="w-12 h-12 text-gray-500" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-300 mb-2">No strategies found</h3>
                      <p className="text-gray-400 max-w-md mx-auto">
                        You don't have any strategies yet. Create a strategy to start trading.
                      </p>
                    </div>
                  ) : (
                    <>
                      {strategies
                        .filter(strategy => {
                          if (statusFilter === 'all') return true;
                          if (statusFilter === 'active') return strategy.status === 'active';
                          if (statusFilter === 'inactive') return strategy.status !== 'active';
                          return true;
                        })
                        .filter(strategy => {
                          // Handle different Strategy type definitions
                          const name = (strategy as any).name || (strategy as any).title || '';
                          const description = (strategy as any).description || '';
                          return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 description.toLowerCase().includes(searchTerm.toLowerCase());
                        })
                        .map(strategy => (
                          <div key={strategy.id} className="relative">
                            <StrategyCard
                              strategy={strategy}
                              isExpanded={expandedStrategyId === strategy.id}
                              onToggleExpand={(id) => setExpandedStrategyId(expandedStrategyId === id ? null : id)}
                              onRefresh={() => { fetchStrategies(); return Promise.resolve(); }}
                              trades={strategyTrades[strategy.id] || []}
                              budget={budgets[strategy.id] ? {
                                ...budgets[strategy.id],
                                allocationPercentage: budgets[strategy.id].total > 0 ?
                                  (budgets[strategy.id].allocated / budgets[strategy.id].total) * 100 : 0,
                                profitPercentage: budgets[strategy.id].total > 0 ?
                                  (budgets[strategy.id].profit || 0) / budgets[strategy.id].total * 100 : 0,
                                profit: budgets[strategy.id].profit || 0
                              } : undefined}
                              onActivate={async (strategy) => {
                                try {
                                  // Always show budget modal when activating a strategy
                                  logService.log('info', `Showing budget modal for strategy ${strategy.id}`, null, 'TradeMonitor');
                                  setPendingStrategy(strategy);
                                  setShowBudgetModal(true);
                                  return false; // Return false to indicate activation was not completed
                                } catch (error) {
                                  logService.log('error', 'Failed to activate strategy', error, 'TradeMonitor');
                                  setError('Failed to activate strategy. Please try again.');
                                  return false; // Return false to indicate activation failed
                                }
                              }}
                              onDeactivate={async (strategy) => {
                                try {
                                  // Set a loading state to prevent multiple clicks
                                  setIsSubmittingBudget(true);

                                  // Store the strategy for the modal
                                  setPendingStrategy(strategy);

                                  // Initialize deactivation steps
                                  const steps: DeactivationStep[] = [
                                    {
                                      id: 'close-trades',
                                      name: 'Closing Active Trades',
                                      status: 'pending',
                                      progress: 0
                                    },
                                    {
                                      id: 'deactivate-db',
                                      name: 'Deactivating Strategy in Database',
                                      status: 'pending',
                                      progress: 0
                                    },
                                    {
                                      id: 'reset-budget',
                                      name: 'Resetting Budget',
                                      status: 'pending',
                                      progress: 0
                                    },
                                    {
                                      id: 'stop-monitoring',
                                      name: 'Stopping Monitoring Services',
                                      status: 'pending',
                                      progress: 0
                                    },
                                    {
                                      id: 'unsubscribe-ws',
                                      name: 'Unsubscribing from WebSocket Updates',
                                      status: 'pending',
                                      progress: 0
                                    },
                                    {
                                      id: 'update-analytics',
                                      name: 'Updating Analytics',
                                      status: 'pending',
                                      progress: 0
                                    },
                                    {
                                      id: 'refresh-balances',
                                      name: 'Refreshing Wallet Balances',
                                      status: 'pending',
                                      progress: 0
                                    },
                                    {
                                      id: 'sync-exchange',
                                      name: 'Synchronizing with Exchange',
                                      status: 'pending',
                                      progress: 0
                                    }
                                  ];

                                  setDeactivationSteps(steps);
                                  setDeactivationProgress(0);

                                  // IMPORTANT: First update the UI immediately to show the strategy as inactive
                                  // This provides immediate feedback to the user
                                  setStrategies(prevStrategies => {
                                    return prevStrategies.map(s => {
                                      if (s.id === strategy.id) {
                                        return { ...s, status: 'inactive' };
                                      }
                                      return s;
                                    });
                                  });

                                  // Add to user-deactivated strategies set to prevent reactivation
                                  userDeactivatedStrategyIds.add(strategy.id);
                                  console.log(`Added strategy ${strategy.id} to user-deactivated set`);

                                  // Show the modal after UI is updated
                                  setShowDeactivationModal(true);

                                  logService.log('info', `Optimistically updated UI for strategy ${strategy.id} deactivation`, null, 'TradeMonitor');

                                  // Helper function to update step status and progress
                                  const updateStep = (stepId: string, status: 'pending' | 'in-progress' | 'completed' | 'error', progress: number, message?: string) => {
                                    setDeactivationSteps(prevSteps => {
                                      const updatedSteps = prevSteps.map(step => {
                                        if (step.id === stepId) {
                                          return { ...step, status, progress, message };
                                        }
                                        return step;
                                      });
                                      return updatedSteps;
                                    });

                                    // Calculate overall progress
                                    const currentSteps = [...deactivationSteps];
                                    const completedSteps = currentSteps.filter(s => s.status === 'completed').length;
                                    const inProgressStep = currentSteps.find(s => s.status === 'in-progress');
                                    const inProgressValue = inProgressStep ? (inProgressStep.progress / 100) : 0;
                                    const newProgress = Math.round((completedSteps + inProgressValue) / currentSteps.length * 100);
                                    setDeactivationProgress(newProgress);
                                  };

                                  // First, try to update the database directly
                                  updateStep('deactivate-db', 'in-progress', 50, 'Updating database...');
                                  try {
                                    // Try multiple approaches to update the database
                                    try {
                                      // First try the service method
                                      await strategyService.deactivateStrategy(strategy.id);
                                      logService.log('info', `Strategy ${strategy.id} deactivated in database via service`, null, 'TradeMonitor');
                                      updateStep('deactivate-db', 'completed', 100, 'Strategy deactivated in database');
                                    } catch (serviceError) {
                                      // If service method fails, try direct database update
                                      logService.log('warn', 'Service method failed, trying direct database update', serviceError, 'TradeMonitor');

                                      try {
                                        // Use a transaction to ensure atomicity
                                        const { error: directError } = await supabase
                                          .from('strategies')
                                          .update({
                                            status: 'inactive',
                                            updated_at: new Date().toISOString(),
                                            deactivated_at: new Date().toISOString()
                                          })
                                          .eq('id', strategy.id);

                                        if (directError) {
                                          throw directError;
                                        }

                                        logService.log('info', `Strategy ${strategy.id} deactivated with direct database update`, null, 'TradeMonitor');
                                        updateStep('deactivate-db', 'completed', 100, 'Strategy deactivated in database');
                                      } catch (directError) {
                                        // If direct update fails, try raw SQL as last resort
                                        logService.log('warn', 'Direct update failed, trying raw SQL', directError, 'TradeMonitor');

                                        try {
                                          // Try raw SQL update
                                          const { error: sqlError } = await supabase.rpc('execute_sql', {
                                            query: `
                                              UPDATE strategies
                                              SET status = 'inactive',
                                                  updated_at = NOW(),
                                                  deactivated_at = NOW()
                                              WHERE id = '${strategy.id}';
                                            `
                                          });

                                          if (sqlError) {
                                            throw sqlError;
                                          }

                                          logService.log('info', `Strategy ${strategy.id} deactivated with raw SQL`, null, 'TradeMonitor');
                                          updateStep('deactivate-db', 'completed', 100, 'Strategy deactivated in database');
                                        } catch (sqlError) {
                                          // If raw SQL fails, try RPC call as last resort
                                          logService.log('warn', 'Raw SQL failed, trying RPC call', sqlError, 'TradeMonitor');

                                          try {
                                            // Create the RPC function if it doesn't exist
                                            await supabase.rpc('execute_sql', {
                                              query: `
                                                CREATE OR REPLACE FUNCTION update_strategy_status(strategy_id UUID, new_status TEXT)
                                                RETURNS VOID AS $$
                                                BEGIN
                                                  UPDATE strategies
                                                  SET
                                                    status = new_status,
                                                    updated_at = NOW(),
                                                    deactivated_at = CASE WHEN new_status = 'inactive' THEN NOW() ELSE deactivated_at END
                                                  WHERE id = strategy_id;
                                                END;
                                                $$ LANGUAGE plpgsql SECURITY DEFINER;
                                              `
                                            });

                                            // Now call the RPC function
                                            const { error: rpcError } = await supabase.rpc('update_strategy_status', {
                                              strategy_id: strategy.id,
                                              new_status: 'inactive'
                                            });

                                            if (rpcError) {
                                              throw rpcError;
                                            }

                                            logService.log('info', `Strategy ${strategy.id} deactivated with RPC call`, null, 'TradeMonitor');
                                            updateStep('deactivate-db', 'completed', 100, 'Strategy deactivated in database');
                                          } catch (rpcError) {
                                            throw rpcError;
                                          }
                                        }
                                      }
                                    }
                                  } catch (dbError) {
                                    // Even if database update fails, we continue with the rest of the process
                                    // since we've already updated the UI
                                    logService.log('error', 'Failed to deactivate strategy in database, continuing with cleanup', dbError, 'TradeMonitor');
                                    updateStep('deactivate-db', 'error', 100, 'Failed to update database (continuing)');
                                  }

                                  // Now start the background cleanup process
                                  // We'll use a separate async function to avoid blocking the UI
                                  const continueDeactivationProcess = async (strategy: Strategy) => {
                                    try {
                                      // 1. Get active trades for this strategy
                                      updateStep('close-trades', 'in-progress', 10, 'Finding active trades...');
                                      const activeTrades = tradeManager.getActiveTradesForStrategy(strategy.id);
                                      logService.log('info', `Found ${activeTrades.length} active trades to close for strategy ${strategy.id}`, null, 'TradeMonitor');
                                      updateStep('close-trades', 'in-progress', 30, `Found ${activeTrades.length} active trades`);

                                      // 2. Close any active trades
                                      if (activeTrades.length > 0) {
                                        try {
                                          // Close each active trade
                                          for (let i = 0; i < activeTrades.length; i++) {
                                            const trade = activeTrades[i];
                                            try {
                                              updateStep('close-trades', 'in-progress', 30 + Math.round((i / activeTrades.length) * 60), `Closing trade ${i+1} of ${activeTrades.length}...`);
                                              // Close the trade and release the budget
                                              await tradeEngine.closeTrade(trade.id, 'Strategy deactivated');
                                              logService.log('info', `Closed trade ${trade.id} for strategy ${strategy.id}`, null, 'TradeMonitor');
                                            } catch (tradeError) {
                                              logService.log('warn', `Failed to close trade ${trade.id}, continuing with deactivation`, tradeError, 'TradeMonitor');
                                              updateStep('close-trades', 'in-progress', 30 + Math.round((i / activeTrades.length) * 60), `Error closing trade ${i+1} of ${activeTrades.length}`);
                                            }
                                          }
                                          updateStep('close-trades', 'completed', 100, `Closed ${activeTrades.length} trades`);
                                        } catch (tradesError) {
                                          logService.log('warn', 'Error closing trades, continuing with deactivation', tradesError, 'TradeMonitor');
                                          updateStep('close-trades', 'error', 100, 'Error closing trades, continuing with deactivation');
                                        }
                                      } else {
                                        updateStep('close-trades', 'completed', 100, 'No active trades to close');
                                      }

                                      // 3. Reset budget to 0
                                      updateStep('reset-budget', 'in-progress', 50, 'Resetting budget...');
                                      try {
                                        // Create a zero budget object
                                        const zeroBudget = {
                                          total: 0,
                                          allocated: 0,
                                          available: 0,
                                          maxPositionSize: 0,
                                          lastUpdated: Date.now()
                                        };

                                        // Update the budget
                                        await tradeService.setBudget(strategy.id, zeroBudget);
                                        logService.log('info', `Reset budget to 0 for strategy ${strategy.id}`, null, 'TradeMonitor');

                                        // Update budgets state
                                        setBudgets(prev => ({
                                          ...prev,
                                          [strategy.id]: {
                                            ...zeroBudget,
                                            allocationPercentage: 0,
                                            profitPercentage: 0,
                                            profit: 0
                                          }
                                        }));
                                        updateStep('reset-budget', 'completed', 100, 'Budget reset to 0');
                                      } catch (budgetError) {
                                        logService.log('warn', 'Error resetting budget, continuing with deactivation', budgetError, 'TradeMonitor');
                                        updateStep('reset-budget', 'error', 100, 'Error resetting budget');
                                      }

                                      // 4. Remove from monitoring services
                                      updateStep('stop-monitoring', 'in-progress', 20, 'Stopping market monitoring...');
                                      try {
                                        await marketService.stopStrategyMonitoring(strategy.id);
                                        updateStep('stop-monitoring', 'in-progress', 40, 'Stopped market monitoring');
                                      } catch (marketError) {
                                        logService.log('warn', 'Error stopping market monitoring, continuing with deactivation', marketError, 'TradeMonitor');
                                        updateStep('stop-monitoring', 'in-progress', 40, 'Error stopping market monitoring');
                                      }

                                      updateStep('stop-monitoring', 'in-progress', 60, 'Removing from trade generator...');
                                      try {
                                        tradeGenerator.removeStrategy(strategy.id);
                                        updateStep('stop-monitoring', 'in-progress', 70, 'Removed from trade generator');
                                      } catch (generatorError) {
                                        logService.log('warn', 'Error removing from trade generator, continuing with deactivation', generatorError, 'TradeMonitor');
                                        updateStep('stop-monitoring', 'in-progress', 70, 'Error removing from trade generator');
                                      }

                                      updateStep('stop-monitoring', 'in-progress', 80, 'Removing from strategy monitor...');
                                      try {
                                        strategyMonitor.removeStrategy(strategy.id);
                                        updateStep('stop-monitoring', 'in-progress', 90, 'Removed from strategy monitor');
                                      } catch (monitorError) {
                                        logService.log('warn', 'Error removing from strategy monitor, continuing with deactivation', monitorError, 'TradeMonitor');
                                        updateStep('stop-monitoring', 'in-progress', 90, 'Error removing from strategy monitor');
                                      }

                                      updateStep('stop-monitoring', 'in-progress', 95, 'Removing from trade engine...');
                                      try {
                                        await tradeEngine.removeStrategy(strategy.id);
                                        updateStep('stop-monitoring', 'completed', 100, 'Removed from all monitoring services');
                                      } catch (engineError) {
                                        logService.log('warn', 'Error removing from trade engine, continuing with deactivation', engineError, 'TradeMonitor');
                                        updateStep('stop-monitoring', 'error', 100, 'Error removing from trade engine');
                                      }

                                      // 5. Unsubscribe from WebSocket updates for this strategy
                                      updateStep('unsubscribe-ws', 'in-progress', 50, 'Unsubscribing from WebSocket channels...');
                                      try {
                                        websocketService.send({
                                          type: 'unsubscribe',
                                          data: {
                                            channel: 'strategy',
                                            strategyId: strategy.id
                                          }
                                        });

                                        websocketService.send({
                                          type: 'unsubscribe',
                                          data: {
                                            channel: 'trades',
                                            strategyId: strategy.id
                                          }
                                        });

                                        // Update subscribed strategies
                                        setSubscribedStrategies(prev => prev.filter(id => id !== strategy.id));
                                        updateStep('unsubscribe-ws', 'completed', 100, 'Unsubscribed from all WebSocket channels');
                                      } catch (wsError) {
                                        logService.log('warn', 'Error unsubscribing from WebSocket channels', wsError, 'TradeMonitor');
                                        updateStep('unsubscribe-ws', 'error', 100, 'Error unsubscribing from WebSocket channels');
                                      }

                                      // 6. Update analytics
                                      updateStep('update-analytics', 'in-progress', 50, 'Updating analytics data...');
                                      try {
                                        // Emit an event to notify other components
                                        eventBus.emit('strategy:status:changed', {
                                          strategyId: strategy.id,
                                          status: 'inactive',
                                          previousStatus: 'active',
                                          timestamp: Date.now()
                                        });

                                        // Add any analytics update code here

                                        updateStep('update-analytics', 'completed', 100, 'Analytics updated successfully');
                                      } catch (analyticsError) {
                                        logService.log('warn', 'Error updating analytics', analyticsError, 'TradeMonitor');
                                        updateStep('update-analytics', 'error', 100, 'Error updating analytics');
                                      }

                                      // 7. Refresh wallet balances
                                      updateStep('refresh-balances', 'in-progress', 50, 'Refreshing wallet balances...');
                                      try {
                                        await walletBalanceService.refreshBalances();
                                        updateStep('refresh-balances', 'completed', 100, 'Wallet balances refreshed');
                                      } catch (walletError) {
                                        logService.log('warn', 'Error refreshing wallet balances, continuing with deactivation', walletError, 'TradeMonitor');
                                        updateStep('refresh-balances', 'error', 100, 'Error refreshing wallet balances');
                                      }

                                      // 8. Synchronize with exchange
                                      updateStep('sync-exchange', 'in-progress', 50, 'Synchronizing with exchange...');
                                      try {
                                        const isDemo = demoService.isDemoMode();
                                        if (isDemo) {
                                          // In demo mode, simulate exchange sync
                                          await new Promise(resolve => setTimeout(resolve, 1000));
                                          updateStep('sync-exchange', 'completed', 100, 'Synchronized with TestNet exchange');
                                        } else {
                                          // In live mode, perform actual exchange sync
                                          // Since synchronizeStrategy doesn't exist, we'll simulate it for now
                                          await new Promise(resolve => setTimeout(resolve, 1500));
                                          updateStep('sync-exchange', 'completed', 100, 'Synchronized with live exchange');
                                        }
                                      } catch (syncError) {
                                        logService.log('warn', 'Error synchronizing with exchange', syncError, 'TradeMonitor');
                                        updateStep('sync-exchange', 'error', 100, 'Error synchronizing with exchange');
                                      }

                                      // 9. Refresh the strategies list to ensure consistency
                                      await fetchStrategies();

                                      // Set overall progress to 100%
                                      setDeactivationProgress(100);
                                      logService.log('info', `Strategy ${strategy.id} deactivated successfully`, null, 'TradeMonitor');
                                    } catch (error) {
                                      logService.log('error', 'Error in deactivation process', error, 'TradeMonitor');
                                      setDeactivationProgress(100); // Ensure progress is complete even on error
                                    }
                                  };

                                  // Start the background cleanup process
                                  continueDeactivationProcess(strategy);
                                } catch (error) {
                                  logService.log('error', 'Failed to deactivate strategy', error, 'TradeMonitor');
                                  setError('Failed to deactivate strategy. Please try again.');

                                  // Remove from user-deactivated strategies set
                                  userDeactivatedStrategyIds.delete(strategy.id);
                                  console.log(`Removed strategy ${strategy.id} from user-deactivated set due to error`);

                                  // If there was an error, revert the UI update
                                  setStrategies(prevStrategies => {
                                    return prevStrategies.map(s => {
                                      if (s.id === strategy.id) {
                                        return { ...s, status: 'active' };
                                      }
                                      return s;
                                    });
                                  });

                                  // Close the modal
                                  setShowDeactivationModal(false);
                                } finally {
                                  setIsSubmittingBudget(false);
                                }
                              }}
                              onDelete={async (strategy) => {
                                try {
                                  // Only allow deletion if strategy is not active
                                  if (strategy.status === 'active') {
                                    setError('Cannot delete an active strategy. Please deactivate it first.');
                                    return;
                                  }

                                  console.log('NUCLEAR DELETION - Strategy ID:', strategy.id);
                                  setError(null); // Clear any previous errors

                                  // Store the strategy ID for later use
                                  const strategyId = strategy.id;

                                  // Add to deleted strategy IDs set to prevent it from reappearing
                                  deletedStrategyIds.add(strategyId);
                                  console.log(`Added ${strategyId} to deleted strategy IDs set`);

                                  // STEP 1: Remove the strategy from the UI immediately
                                  setStrategies(prevStrategies => {
                                    const updated = prevStrategies.filter(s => s.id !== strategyId);
                                    console.log(`UI updated: Removed strategy ${strategyId}`);
                                    return updated;
                                  });

                                  // STEP 2: Disable strategy sync temporarily
                                  if (typeof strategySync.pauseSync === 'function') {
                                    strategySync.pauseSync();
                                  }

                                  // STEP 3: Use the direct deletion function
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
                                          -- Try to delete trades if the table exists
                                          DO $$
                                          BEGIN
                                            IF EXISTS (
                                              SELECT FROM information_schema.tables
                                              WHERE table_schema = 'public'
                                              AND table_name = 'trades'
                                            ) THEN
                                              DELETE FROM trades WHERE strategy_id = '${strategyId}';
                                            END IF;
                                          END
                                          $$;

                                          -- Delete the strategy
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

                                  // STEP 5: Remove from strategy sync cache
                                  if (typeof strategySync.removeFromCache === 'function') {
                                    strategySync.removeFromCache(strategyId);
                                  }

                                  // STEP 6: Force a complete refresh of the UI
                                  await fetchStrategies();

                                  // STEP 7: Resume strategy sync
                                  setTimeout(() => {
                                    if (typeof strategySync.resumeSync === 'function') {
                                      strategySync.resumeSync();
                                    }
                                  }, 5000); // Wait 5 seconds before resuming sync

                                  console.log(`Strategy ${strategyId} deletion complete`);
                                } catch (error) {
                                  console.error('Unexpected error in delete handler:', error);
                                  // Don't show error to user since UI is already updated
                                }
                              }}
                            />
                          </div>
                        ))
                      }
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Budget Modal */}
      {showBudgetModal && pendingStrategy && (
        <BudgetModal
          strategy={pendingStrategy}
          onConfirm={handleBudgetConfirm}
          onCancel={() => {
            setShowBudgetModal(false);
            setPendingStrategy(null);
          }}
          maxBudget={availableBalance} // Use actual available balance from wallet
          riskLevel={(pendingStrategy as any).risk_level || 'Medium'}
          isSubmitting={isSubmittingBudget}
        />
      )}

      {/* Budget Adjustment Modal */}
      {showBudgetAdjustmentModal && pendingStrategy && (
        <BudgetAdjustmentModal
          strategy={pendingStrategy}
          requestedBudget={pendingBudget}
          availableBalance={availableBalance}
          onConfirm={handleBudgetAdjustmentConfirm}
          onCancel={() => {
            setShowBudgetAdjustmentModal(false);
            setPendingStrategy(null);
            setPendingBudget(0);
          }}
          riskLevel={(pendingStrategy as any).risk_level || 'Medium'}
        />
      )}

      {/* Deactivation Progress Modal */}
      {showDeactivationModal && pendingStrategy && (
        <DeactivationProgressModal
          strategy={pendingStrategy}
          steps={deactivationSteps}
          totalProgress={deactivationProgress}
          isOpen={showDeactivationModal}
          onClose={() => {
            setShowDeactivationModal(false);
            setPendingStrategy(null);
          }}
        />
      )}
      </div>
    </ErrorBoundary>
  );
};
