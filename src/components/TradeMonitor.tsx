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
import { marketService } from '../lib/market-service';
import { marketDataService } from '../lib/market-data-service';
import { marketAnalyzer } from '../lib/market-analyzer';
import { tradeService } from '../lib/trade-service';
import { logService } from '../lib/log-service';
import { supabase } from '../lib/supabase';
import { directDeleteStrategy } from '../lib/direct-delete';
import { eventBus } from '../lib/event-bus';
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
import { BudgetModal } from './BudgetModal';
import { BudgetAdjustmentModal } from './BudgetAdjustmentModal';
import type { Trade, Strategy, StrategyBudget } from '../lib/types';

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

  // WebSocket state
  const [wsConnected, setWsConnected] = useState(false);
  const [subscribedStrategies, setSubscribedStrategies] = useState<string[]>([]);
  const [binanceConnected, setBinanceConnected] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);
  const [tradeListPage, setTradeListPage] = useState(0);

  // Modal state
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showBudgetAdjustmentModal, setShowBudgetAdjustmentModal] = useState(false);
  const [pendingStrategy, setPendingStrategy] = useState<Strategy | null>(null);
  const [pendingBudget, setPendingBudget] = useState<number>(0);
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);

  // Stats
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [availableBalance, setAvailableBalance] = useState<number>(0);

  // Track deleted strategy IDs to prevent them from reappearing
  const [deletedStrategyIds] = useState<Set<string>>(new Set<string>());

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

        // Update the trades for this strategy
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

        // Also update the global trades list
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
        // Set Binance connection status
        setBinanceConnected(true);

        // Handle Binance TestNet data
        if (data.e === 'trade') {
          // Create a trade object from Binance data
          const binanceTrade = {
            id: `binance-${data.t}`,
            timestamp: data.T,
            datetime: new Date(data.T).toISOString(),
            symbol: data.s.toUpperCase().replace(/([A-Z]+)([A-Z]+)$/, '$1/$2'), // Convert BTCUSDT to BTC/USDT
            side: data.m ? 'sell' : 'buy', // m = is buyer the market maker
            price: parseFloat(data.p),
            amount: parseFloat(data.q),
            cost: parseFloat(data.p) * parseFloat(data.q),
            fee: {
              cost: parseFloat(data.p) * parseFloat(data.q) * 0.001, // 0.1% fee
              currency: data.s.slice(-4) // Last 4 characters (e.g., USDT from BTCUSDT)
            },
            status: 'closed',
            strategyId: 'binance-testnet'
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

            // Update the trades for this strategy
            setStrategyTrades(prev => {
              const updatedTrades = [...(prev[matchingStrategy.id] || []), binanceTrade];
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
              const updatedTrades = [...prev, binanceTrade];
              // Sort by timestamp, newest first
              updatedTrades.sort((a, b) => b.timestamp - a.timestamp);
              // Keep only the latest 100 trades
              return updatedTrades.slice(0, 100);
            });

            // Update the live trades list
            setLiveTrades(prev => {
              const updatedTrades = [binanceTrade, ...prev];
              // Keep only the latest 50 trades
              return updatedTrades.slice(0, 50);
            });

            // Log the Binance trade for debugging
            logService.log('debug', `Assigned Binance trade for ${data.s} to strategy ${matchingStrategy.id}`, { binanceTrade }, 'TradeMonitor');
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
              // Convert pair format from BTC/USDT to btcusdt@trade
              const formattedPair = pair.replace('/', '').toLowerCase() + '@trade';
              return formattedPair;
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

        // Subscribe to trading opportunities
        eventBus.subscribe('market:tradingOpportunity', (analysis) => {
          logService.log('info', `Trading opportunity detected for ${analysis.symbol}`, analysis, 'TradeMonitor');
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
          const newTrade = payload.new as Trade;
          setTrades(prevTrades => {
            // Add the new trade at the beginning of the array
            const updatedTrades = [newTrade, ...prevTrades];
            // Limit to 10 trades per strategy if needed
            return updatedTrades;
          });
        } else if (payload.eventType === 'UPDATE') {
          // Update existing trade
          const updatedTrade = payload.new as Trade;
          setTrades(prevTrades => {
            return prevTrades.map(trade =>
              trade.id === updatedTrade.id ? updatedTrade : trade
            );
          });
        } else if (payload.eventType === 'DELETE') {
          // Remove deleted trade
          const deletedTradeId = payload.old.id;
          setTrades(prevTrades => {
            return prevTrades.filter(trade => trade.id !== deletedTradeId);
          });
        }
      })
      .subscribe();

    // Set up subscription to strategy updates
    const strategySubscription = supabase
      .channel('strategies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'strategies' }, () => {
        fetchStrategies();
      })
      .subscribe();

    // Subscribe to strategy events
    const strategyCreatedUnsubscribe = eventBus.subscribe('strategy:created', () => {
      fetchStrategies().then(() => fetchTradeData());
    });

    // Subscribe to trade events
    const tradeCreatedUnsubscribe = eventBus.subscribe('trade:created', (data) => {
      console.log('Trade created:', data);
      fetchStrategies().then(() => fetchTradeData());
    });

    const tradeUpdatedUnsubscribe = eventBus.subscribe('trade:update', (data) => {
      console.log('Trade updated:', data);
      fetchStrategies().then(() => fetchTradeData());
    });

    const tradesUpdatedUnsubscribe = eventBus.subscribe('tradesUpdated', (data) => {
      console.log('Trades updated:', data);
      fetchStrategies().then(() => fetchTradeData());
    });

    // Subscribe to strategy deleted events
    const strategyDeletedUnsubscribe = eventBus.subscribe('strategy:deleted', (data) => {
      console.log('Strategy deleted:', data);
      // Update local state to immediately remove the strategy from the list
      setStrategies(prevStrategies => prevStrategies.filter(s => s.id !== data.strategyId));
      // Refresh trade data
      fetchTradeData();
    });

    // Subscribe to wallet balance updates
    const handleBalanceUpdate = () => {
      setAvailableBalance(walletBalanceService.getAvailableBalance());
    };

    walletBalanceService.on('balancesUpdated', handleBalanceUpdate);

    // Auto-refresh timer removed as per user request

    return () => {
      // Unsubscribe from all subscriptions
      tradeSubscription.unsubscribe();
      strategySubscription.unsubscribe();
      strategyCreatedUnsubscribe();
      tradeCreatedUnsubscribe();
      tradeUpdatedUnsubscribe();
      tradesUpdatedUnsubscribe();
      strategyDeletedUnsubscribe();
      walletBalanceService.off('balancesUpdated', handleBalanceUpdate);

      // Remove the direct DOM event listener
      document.removeEventListener('strategy:remove', handleStrategyRemove);

      // Clean up market analyzer
      marketAnalyzer.cleanup();
    };
  }, []);

  // Fetch strategies from the database
  const fetchStrategies = async () => {
    try {
      console.log('Fetching strategies directly from database...');

      // Get strategies directly from the database
      const { data: fetchedStrategies, error } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Filter out any strategies that were deleted in this session
      const filteredStrategies = fetchedStrategies.filter(strategy => {
        const isDeleted = deletedStrategyIds.has(strategy.id);
        if (isDeleted) {
          console.log(`Filtering out deleted strategy ${strategy.id}`);
        }
        return !isDeleted;
      });

      console.log(`Fetched ${filteredStrategies.length} strategies from database`);

      // Update the strategies state with a completely new array
      setStrategies([...filteredStrategies]);

      // Subscribe to market data for active strategies
      filteredStrategies.forEach(strategy => {
        if (strategy.status === 'active' && strategy.selected_pairs) {
          strategy.selected_pairs.forEach((symbol: string) => {
            // Use the market service to subscribe to market data
            marketService.subscribeToMarket(symbol)
              .catch((error: any) => {
                logService.log('error', `Failed to subscribe to market data for ${symbol}`, error, 'TradeMonitor');
              });
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

  // Helper function to get status color
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'open':
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-500';
      case 'closed':
      case 'completed':
        return 'bg-green-500/20 text-green-500';
      case 'canceled':
      case 'cancelled':
        return 'bg-gray-500/20 text-gray-400';
      case 'failed':
        return 'bg-red-500/20 text-red-500';
      default:
        return 'bg-blue-500/20 text-blue-500';
    }
  };

  // Helper function to get strategy name
  const getStrategyName = (strategyId: string, strategies: Strategy[]): string => {
    const strategy = strategies.find(s => s.id === strategyId);
    return strategy ? ((strategy as any).name || (strategy as any).title || 'Unknown Strategy') : 'Unknown Strategy';
  };

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
   * @returns Array of mock trades
   */
  const generateMockTrades = (symbol: string, count: number): any[] => {
    const trades = [];
    const now = Date.now();
    const basePrice = getBasePrice(symbol);

    for (let i = 0; i < count; i++) {
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const price = basePrice * (1 + (Math.random() * 0.1 - 0.05));
      const amount = 0.1 + Math.random() * 0.9; // 0.1 to 1.0
      const cost = price * amount;
      const fee = cost * 0.001; // 0.1% fee

      trades.push({
        id: `mock-${now}-${i}`,
        symbol,
        side,
        price,
        amount,
        cost,
        fee: { cost: fee, currency: symbol.split('/')[1] },
        timestamp: now - (i * 60000) // Spread out over the last few minutes
      });
    }

    return trades;
  };

  /**
   * Gets a base price for a given symbol
   * @param symbol Trading pair symbol
   * @returns Base price
   */
  const getBasePrice = (symbol: string): number => {
    const baseAsset = symbol.split('/')[0];

    switch (baseAsset) {
      case 'BTC': return 50000;
      case 'ETH': return 3000;
      case 'SOL': return 100;
      case 'BNB': return 500;
      case 'XRP': return 0.5;
      default: return 100;
    }
  };

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

      // Check if we have a valid cache for all strategies combined
      const cacheKey = 'all_strategies';
      const cachedData = tradeCache.get(cacheKey);
      const now = Date.now();

      if (cachedData && (now - cachedData.timestamp) < TRADE_CACHE_TTL) {
        logService.log('info', 'Using cached trades for all strategies', null, 'TradeMonitor');
        return cachedData.trades;
      }

      // Get trades from TestNet via ccxtService
      const exchange = await ccxtService.getExchange('binance', true); // true for testnet

      if (!exchange) {
        logService.log('error', 'Failed to initialize TestNet exchange', null, 'TradeMonitor');
        return [];
      }

      // Collect all unique symbols from active strategies
      const symbols = new Set<string>();
      activeStrategies.forEach(strategy => {
        if (strategy.selected_pairs && Array.isArray(strategy.selected_pairs)) {
          strategy.selected_pairs.forEach(pair => symbols.add(pair));
        }
      });

      // If no symbols found, use default ones
      if (symbols.size === 0) {
        symbols.add('BTC/USDT');
        symbols.add('ETH/USDT');
        symbols.add('BNB/USDT');
      }

      const allTrades: Trade[] = [];

      // Fetch trades for each symbol
      for (const symbol of Array.from(symbols)) {
        try {
          // Normalize the symbol format (replace _ with / if needed)
          const normalizedSymbol = symbol.includes('_')
            ? symbol.replace('_', '/')
            : symbol;

          logService.log('info', `Fetching trades for symbol ${normalizedSymbol}`, null, 'TradeMonitor');

          let symbolTrades;
          try {
            // Try to fetch trades for this symbol
            symbolTrades = await exchange.fetchMyTrades(normalizedSymbol, undefined, 20);
          } catch (fetchError) {
            logService.log('warn', `Failed to fetch trades for ${normalizedSymbol}, using mock data`, fetchError, 'TradeMonitor');
            // Generate mock trades for this symbol
            symbolTrades = generateMockTrades(normalizedSymbol, 5);
          }

          // Find a strategy that uses this symbol
          const matchingStrategy = activeStrategies.find(strategy =>
            strategy.selected_pairs?.includes(symbol)
          );

          const strategyId = matchingStrategy?.id || activeStrategies[0].id;

          // Convert to our Trade format
          const formattedTrades = symbolTrades.map((trade: any) => ({
            id: trade.id || `${Date.now()}-${Math.random()}`,
            symbol: trade.symbol,
            side: trade.side as 'buy' | 'sell',
            status: 'executed', // Use 'executed' instead of 'closed'
            entryPrice: trade.price,
            exitPrice: trade.price * (1 + (Math.random() * 0.1 - 0.05)), // Random exit price
            profit: trade.fee ? (trade.cost - trade.fee.cost) : trade.cost,
            timestamp: trade.timestamp,
            strategyId, // Use the matching strategy ID
          }));

          allTrades.push(...formattedTrades);
        } catch (symbolError) {
          logService.log('warn', `Failed to fetch trades for ${symbol}`, symbolError, 'TradeMonitor');
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
      return [];
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

  // Activate a strategy with the given budget - simplified version
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
      const { data: latestStrategy, error: fetchError } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', strategy.id)
        .single();

      if (fetchError || !latestStrategy) {
        throw new Error(`Failed to fetch latest strategy data: ${fetchError?.message || 'No data returned'}`);
      }

      // 3. Activate the strategy in the database
      const updatedStrategy = await strategyService.activateStrategy(strategy.id);
      logService.log('info', `Strategy ${strategy.id} activated in database`, null, 'TradeMonitor');

      // 4. Start monitoring the strategy - wrap in try/catch to continue even if this fails
      try {
        await marketService.startStrategyMonitoring(updatedStrategy);
        logService.log('info', `Started monitoring for strategy ${strategy.id}`, null, 'TradeMonitor');
      } catch (monitorError) {
        logService.log('warn', `Error starting market monitoring for strategy ${strategy.id}, continuing with activation`, monitorError, 'TradeMonitor');
      }

      // 5. Connect to trading engine to start generating trades - wrap in try/catch to continue even if this fails
      try {
        const connected = await tradeService.connectStrategyToTradingEngine(strategy.id);

        if (!connected) {
          // If connection failed, log a warning but continue
          logService.log('warn', `Failed to connect strategy ${strategy.id} to trading engine, will retry later`, null, 'TradeMonitor');
        } else {
          logService.log('info', `Connected strategy ${strategy.id} to trading engine`, null, 'TradeMonitor');
        }
      } catch (engineError) {
        logService.log('warn', `Error connecting strategy ${strategy.id} to trading engine, will retry later`, engineError, 'TradeMonitor');
      }

      // 6. Refresh data
      try {
        await fetchStrategies();
        await fetchTradeData(); // Also refresh trade data to show new trades
      } catch (refreshError) {
        logService.log('warn', 'Error refreshing data after strategy activation', refreshError, 'TradeMonitor');
      }

      // 7. Clean up state
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

  const filteredTrades = trades
    .filter(trade => {
      // Use symbol instead of pair for searching
      const matchesSearch = trade.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      return matchesSearch;
    })
    .sort((a, b) => b.timestamp - a.timestamp);

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
    <div className="min-h-screen bg-black p-6 overflow-x-hidden">
      <style>{scrollbarStyles}</style>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 max-w-[1800px] mx-auto"
      >
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="gradient-text">Trade Monitor</h1>
            <p className="description-text mt-1">Monitor your active trades in real-time. Track positions, P&L, and market conditions.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Last update: {new Date(lastUpdate).toLocaleTimeString()}
            </span>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 btn-text-small"
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
          <div className="flex gap-6">
            {/* Left side - Strategies */}
            <div className="flex-1">
              <div className="flex justify-between items-center mb-6">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search strategies..."
                    className="pl-10 pr-4 py-2 bg-gunmetal-800 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    className={`px-3 py-1.5 rounded-lg btn-text-small ${statusFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-gunmetal-800 text-gray-300'}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    All
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-lg btn-text-small ${statusFilter === 'active' ? 'bg-pink-500 text-white' : 'bg-gunmetal-800 text-gray-300'}`}
                    onClick={() => setStatusFilter('active')}
                  >
                    Active
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-lg btn-text-small ${statusFilter === 'inactive' ? 'bg-blue-500 text-white' : 'bg-gunmetal-800 text-gray-300'}`}
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
                  strategies
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
                      <StrategyCard
                        key={strategy.id}
                        strategy={strategy}
                        isExpanded={expandedStrategyId === strategy.id}
                        onToggleExpand={(id) => setExpandedStrategyId(expandedStrategyId === id ? null : id)}
                        onRefresh={fetchStrategies}
                        trades={strategyTrades[strategy.id] || []}
                        onActivate={async (strategy) => {
                          try {
                            // Check if budget is already set
                            const budget = tradeService.getBudget(strategy.id);

                            if (!budget || budget.total <= 0) {
                              // If no budget or budget is zero, show budget modal
                              logService.log('info', `No budget set for strategy ${strategy.id}, showing budget modal`, null, 'TradeMonitor');
                              setPendingStrategy(strategy);
                              setShowBudgetModal(true);
                              return false; // Return false to indicate activation was not completed
                            }

                            // Check if budget exceeds available balance
                            if (budget.total > availableBalance) {
                              logService.log('info', `Budget exceeds available balance: ${budget.total} > ${availableBalance}`, null, 'TradeMonitor');
                              setPendingStrategy(strategy);
                              setPendingBudget(budget.total);
                              setShowBudgetAdjustmentModal(true);
                              return false; // Return false to indicate activation was not completed
                            }

                            // If budget exists and is within available balance, proceed with activation directly
                            await activateStrategyWithBudget(strategy, budget);
                            return true; // Return true to indicate successful activation
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

                            // 1. Deactivate strategy in database first
                            await strategyService.deactivateStrategy(strategy.id);
                            logService.log('info', `Strategy ${strategy.id} deactivated in database`, null, 'TradeMonitor');

                            // 2. Close any active trades
                            const activeTrades = tradeManager.getActiveTradesForStrategy(strategy.id);
                            logService.log('info', `Found ${activeTrades.length} active trades to close for strategy ${strategy.id}`, null, 'TradeMonitor');

                            for (const trade of activeTrades) {
                              try {
                                await tradeEngine.closeTrade(trade.id, 'Strategy deactivated');
                                logService.log('info', `Closed trade ${trade.id} for strategy ${strategy.id}`, null, 'TradeMonitor');
                              } catch (tradeError) {
                                logService.log('warn', `Failed to close trade ${trade.id}`, tradeError, 'TradeMonitor');
                              }
                            }

                            // 3. Stop monitoring
                            await marketService.stopStrategyMonitoring(strategy.id);
                            tradeGenerator.removeStrategy(strategy.id);
                            strategyMonitor.removeStrategy(strategy.id);
                            await tradeEngine.removeStrategy(strategy.id);

                            // 4. Refresh the strategies list
                            await fetchStrategies();

                            logService.log('info', `Strategy ${strategy.id} deactivated successfully`, null, 'TradeMonitor');
                          } catch (error) {
                            logService.log('error', 'Failed to deactivate strategy', error, 'TradeMonitor');
                            setError('Failed to deactivate strategy. Please try again.');
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
                            strategySync.pauseSync();

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
                            strategySync.removeFromCache(strategyId);

                            // STEP 6: Force a complete refresh of the UI
                            await fetchStrategies();

                            // STEP 7: Resume strategy sync
                            setTimeout(() => {
                              strategySync.resumeSync();
                            }, 5000); // Wait 5 seconds before resuming sync

                            console.log(`Strategy ${strategyId} deletion complete`);
                          } catch (error) {
                            console.error('Unexpected error in delete handler:', error);
                            // Don't show error to user since UI is already updated
                          }
                        }}
                      />
                    ))
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
    </div>
  );
};
