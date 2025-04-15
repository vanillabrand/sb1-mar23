import { useState, useEffect } from 'react';
import { Activity, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { eventBus } from '../lib/event-bus';
import { analyticsService, logService } from '../lib/services';
import { Pagination } from './ui/Pagination';
import type { Strategy, Trade } from '../lib/types';

interface StrategyStatusProps {
  strategies?: Strategy[];
}

export function StrategyStatus({ strategies = [] }: StrategyStatusProps) {
  const navigate = useNavigate();
  const [strategyTrades, setStrategyTrades] = useState<Record<string, Trade[]>>({});
  const [strategyStats, setStrategyStats] = useState<Record<string, {
    performance: string;
    trades: number;
    winRate: string;
    lastTrade: string | null;
  }>>({});
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 3; // Reduced to 3 visible strategies
  const totalPages = Math.ceil(strategies.length / ITEMS_PER_PAGE);

  // Get current page strategies
  const paginatedStrategies = strategies.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Function to handle strategy click and navigate to trade monitor
  const handleStrategyClick = (strategyId: string) => {
    navigate(`/trade-monitor?strategy=${strategyId}`);
  };

  // Helper function to log trade data for debugging
  const logTradeData = (message: string, data: any) => {
    console.log(`[StrategyStatus] ${message}:`, data);
  };

  // Calculate stats for a strategy based on its trades
  const calculateStrategyStats = (strategyId: string, trades: Trade[]) => {
    // Find the strategy object
    const strategy = strategies.find(s => s.id === strategyId);

    // Validate trades to ensure they have proper data
    const validTrades = trades.filter(t => {
      // Ensure trade has valid amount and entry price
      if (!t.amount || t.amount <= 0) {
        logService.log('warn', `Skipping trade with invalid amount: ${t.amount}`, { trade: t }, 'StrategyStatus');
        return false;
      }

      if (!t.entryPrice || t.entryPrice <= 0) {
        logService.log('warn', `Skipping trade with invalid entry price: ${t.entryPrice}`, { trade: t }, 'StrategyStatus');
        return false;
      }

      return true;
    });

    // If we have the strategy and it has a performance value, use that directly
    if (strategy && strategy.performance !== undefined && strategy.performance !== null) {
      logService.log('info', `Using strategy performance value for ${strategyId}: ${strategy.performance}`, null, 'StrategyStatus');

      // Only consider completed trades for win rate calculation
      const completedTrades = validTrades.filter(t => t.status === 'executed' || t.status === 'closed' || t.exitPrice);
      const totalCompletedTrades = completedTrades.length;

      // Calculate profitable trades (only from completed trades)
      const profitableTrades = completedTrades.filter(t => (t.profit || 0) > 0).length;

      // Calculate win rate based on completed trades
      const winRate = totalCompletedTrades > 0 ? (profitableTrades / totalCompletedTrades * 100) : 0;

      // Get the most recent trade
      const sortedTrades = [...validTrades].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const lastTrade = sortedTrades[0]; // First trade is the most recent after sorting

      // Format the last trade time with date and time
      const lastTradeTime = lastTrade ? formatDistanceToNow(new Date(lastTrade.createdAt), { addSuffix: true }) : null;

      return {
        performance: strategy.performance.toFixed(2),
        trades: validTrades.length, // Total number of valid trades (including pending)
        winRate: winRate.toFixed(1),
        lastTrade: lastTradeTime
      };
    }

    // Otherwise calculate from trades
    // Only consider completed trades for win rate calculation
    const completedTrades = validTrades.filter(t => t.status === 'executed' || t.status === 'closed' || t.exitPrice);
    const totalCompletedTrades = completedTrades.length;

    // Calculate profitable trades (only from completed trades)
    const profitableTrades = completedTrades.filter(t => (t.profit || 0) > 0).length;

    // Calculate win rate based on completed trades
    const winRate = totalCompletedTrades > 0 ? (profitableTrades / totalCompletedTrades * 100) : 0;

    // Calculate total profit from all trades
    const totalProfit = validTrades.reduce((sum, t) => sum + (t.profit || 0), 0);

    // Get the most recent trade
    const sortedTrades = [...validTrades].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const lastTrade = sortedTrades[0]; // First trade is the most recent after sorting

    // Format the last trade time with date and time
    const lastTradeTime = lastTrade ? formatDistanceToNow(new Date(lastTrade.createdAt), { addSuffix: true }) : null;

    logService.log('info', `Calculated stats from trades for ${strategyId}: profit=${totalProfit}, trades=${validTrades.length}, winRate=${winRate}`, null, 'StrategyStatus');

    return {
      performance: totalProfit.toFixed(2),
      trades: validTrades.length, // Total number of valid trades (including pending)
      winRate: winRate.toFixed(1),
      lastTrade: lastTradeTime
    };
  };

  // Fetch trades for all strategies with improved data handling
  const fetchTrades = async () => {
    try {
      setLoading(true);
      logService.log('info', 'Fetching trades for active strategies', null, 'StrategyStatus');

      // Get trades from the trades table
      const tradesResponse = await supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (tradesResponse.error) {
        logService.log('error', 'Error fetching from trades table', tradesResponse.error, 'StrategyStatus');
      }

      // Try to get trades from the strategy_trades table, but handle the case when it doesn't exist
      let strategyTradesResponse = { data: null, error: null };
      try {
        strategyTradesResponse = await supabase
          .from('strategy_trades')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);

        if (strategyTradesResponse.error) {
          // Check if the error is because the table doesn't exist
          if (strategyTradesResponse.error.code === '42P01') { // PostgreSQL code for 'relation does not exist'
            logService.log('warn', 'Strategy trades table does not exist yet. This is normal if you haven\'t created it.', null, 'StrategyStatus');
            // Set data to empty array to avoid errors
            strategyTradesResponse.data = [];
          } else {
            logService.log('error', 'Error fetching from strategy_trades table', strategyTradesResponse.error, 'StrategyStatus');
          }
        }
      } catch (error) {
        logService.log('error', 'Exception when fetching from strategy_trades table', error, 'StrategyStatus');
        // Set data to empty array to avoid errors
        strategyTradesResponse.data = [];
      }

      // Organize trades by strategy
      const tradesByStrategy: Record<string, Trade[]> = {};

      // Process trades from the trades table
      tradesResponse.data?.forEach(trade => {
        const strategyId = trade.strategyId || trade.strategy_id;
        if (!strategyId) return;

        if (!tradesByStrategy[strategyId]) {
          tradesByStrategy[strategyId] = [];
        }

        // Normalize trade data
        const normalizedTrade: Trade = {
          id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          status: trade.status,
          amount: trade.amount || trade.entry_amount || trade.quantity || 0.1,
          entryPrice: trade.entry_price || trade.entryPrice || 0,
          exitPrice: trade.exit_price || trade.exitPrice || 0,
          profit: trade.profit || trade.pnl || 0,
          timestamp: new Date(trade.created_at || trade.timestamp).getTime(),
          strategyId: strategyId,
          createdAt: trade.created_at || new Date(trade.timestamp).toISOString(),
          executedAt: trade.executed_at || null
        };

        tradesByStrategy[strategyId].push(normalizedTrade);
      });

      // Process trades from the strategy_trades table
      strategyTradesResponse.data?.forEach(trade => {
        const strategyId = trade.strategy_id;
        if (!strategyId) return;

        if (!tradesByStrategy[strategyId]) {
          tradesByStrategy[strategyId] = [];
        }

        // Normalize trade data
        const normalizedTrade: Trade = {
          id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          status: trade.status,
          amount: trade.amount || trade.entry_amount || trade.quantity || 0.1,
          entryPrice: trade.entry_price || 0,
          exitPrice: trade.exit_price || 0,
          profit: trade.pnl || 0,
          timestamp: new Date(trade.created_at).getTime(),
          strategyId: strategyId,
          createdAt: trade.created_at,
          executedAt: trade.executed_at || null
        };

        // Only add if we don't already have this trade (avoid duplicates)
        if (!tradesByStrategy[strategyId].some(t => t.id === normalizedTrade.id)) {
          tradesByStrategy[strategyId].push(normalizedTrade);
        }
      });

      // Log the number of trades found for each strategy
      Object.entries(tradesByStrategy).forEach(([strategyId, trades]) => {
        logService.log('info', `Found ${trades.length} trades for strategy ${strategyId}`, null, 'StrategyStatus');
      });

      // For strategies with no trades, check if we can get performance data from the strategy itself
      strategies.forEach(strategy => {
        if (strategy.status === 'active' && (!tradesByStrategy[strategy.id] || tradesByStrategy[strategy.id].length === 0)) {
          logService.log('info', `No trades found for active strategy ${strategy.id}, checking strategy data`, null, 'StrategyStatus');

          // If the strategy has performance data, create a synthetic trade to represent it
          if (strategy.performance !== undefined && strategy.performance !== null) {
            const syntheticTrade: Trade = {
              id: `synthetic-${strategy.id}`,
              symbol: (strategy.selected_pairs && strategy.selected_pairs[0]) || 'BTC/USDT',
              side: 'buy',
              status: 'executed',
              amount: 1,
              entryPrice: 100,
              exitPrice: 100 * (1 + (strategy.performance / 100)),
              profit: strategy.performance,
              timestamp: Date.now(),
              strategyId: strategy.id,
              createdAt: new Date().toISOString(),
              executedAt: new Date().toISOString()
            };

            tradesByStrategy[strategy.id] = [syntheticTrade];
            logService.log('info', `Created synthetic trade for strategy ${strategy.id} with performance ${strategy.performance}`, null, 'StrategyStatus');
          }
        }
      });

      setStrategyTrades(tradesByStrategy);

      // Calculate stats for each strategy
      const stats: Record<string, any> = {};

      Object.entries(tradesByStrategy).forEach(([strategyId, strategyTrades]) => {
        stats[strategyId] = calculateStrategyStats(strategyId, strategyTrades);
        logService.log('info', `Calculated stats for strategy ${strategyId}:`, stats[strategyId], 'StrategyStatus');
      });

      setStrategyStats(stats);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching trades:', error);
      logService.log('error', 'Error fetching trades', error, 'StrategyStatus');
      setLoading(false);

      // Set empty data instead of random data
      const emptyStats: Record<string, any> = {};
      const emptyTrades: Record<string, Trade[]> = {};

      strategies.forEach(strategy => {
        emptyTrades[strategy.id] = [];
        emptyStats[strategy.id] = {
          performance: '0.00',
          trades: 0,
          winRate: '0.0',
          lastTrade: null
        };
      });

      setStrategyTrades(emptyTrades);
      setStrategyStats(emptyStats);
    }
  };

  // Initial data load
  useEffect(() => {
    logService.log('info', 'StrategyStatus component mounted, fetching trades', null, 'StrategyStatus');
    fetchTrades();

    // Subscribe to trade updates via WebSocket
    const tradeSubscription = supabase
      .channel('trades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, (payload) => {
        const rawTrade = payload.new as any;
        const oldRawTrade = payload.old as any;

        if (payload.eventType === 'INSERT' && rawTrade) {
          // Add new trade
          const strategyId = rawTrade.strategyId || rawTrade.strategy_id;
          if (!strategyId) return;

          // Normalize the trade data
          const trade: Trade = {
            id: rawTrade.id,
            symbol: rawTrade.symbol,
            side: rawTrade.side,
            status: rawTrade.status,
            amount: rawTrade.amount || rawTrade.entry_amount || rawTrade.quantity || 0.1,
            entryPrice: rawTrade.entry_price || rawTrade.entryPrice || 0,
            exitPrice: rawTrade.exit_price || rawTrade.exitPrice || 0,
            profit: rawTrade.profit || rawTrade.pnl || 0,
            timestamp: new Date(rawTrade.created_at || rawTrade.timestamp).getTime(),
            strategyId: strategyId,
            createdAt: rawTrade.created_at || new Date(rawTrade.timestamp).toISOString(),
            executedAt: rawTrade.executed_at || null,
            marketType: rawTrade.market_type || rawTrade.marketType || 'spot'
          };

          // Validate the trade data
          if (!trade.entryPrice || trade.entryPrice <= 0) {
            logService.log('warn', `Skipping trade with invalid entry price: ${trade.entryPrice}`, { trade }, 'StrategyStatus');
            return;
          }

          if (!trade.amount || trade.amount <= 0) {
            logService.log('warn', `Skipping trade with invalid amount: ${trade.amount}`, { trade }, 'StrategyStatus');
            return;
          }

          // Update the trades for this strategy
          setStrategyTrades(prev => {
            const updatedTrades = { ...prev };

            if (!updatedTrades[strategyId]) {
              updatedTrades[strategyId] = [];
            }

            // Add the new trade at the beginning (most recent)
            updatedTrades[strategyId] = [
              trade,
              ...updatedTrades[strategyId].filter(t => t.id !== trade.id)
            ];

            return updatedTrades;
          });

          // Recalculate stats for this strategy
          setStrategyStats(prev => {
            const updatedStats = { ...prev };
            const strategyTradeList = [...(strategyTrades[strategyId] || []), trade];
            updatedStats[strategyId] = calculateStrategyStats(strategyId, strategyTradeList);
            return updatedStats;
          });
        } else if (payload.eventType === 'UPDATE' && rawTrade) {
          // Update the trades for this strategy
          const strategyId = rawTrade.strategyId || rawTrade.strategy_id;
          if (!strategyId) return;

          // Normalize the trade data
          const trade: Trade = {
            id: rawTrade.id,
            symbol: rawTrade.symbol,
            side: rawTrade.side,
            status: rawTrade.status,
            amount: rawTrade.amount || rawTrade.entry_amount || rawTrade.quantity || 0.1,
            entryPrice: rawTrade.entry_price || rawTrade.entryPrice || 0,
            exitPrice: rawTrade.exit_price || rawTrade.exitPrice || 0,
            profit: rawTrade.profit || rawTrade.pnl || 0,
            timestamp: new Date(rawTrade.created_at || rawTrade.timestamp).getTime(),
            strategyId: strategyId,
            createdAt: rawTrade.created_at || new Date(rawTrade.timestamp).toISOString(),
            executedAt: rawTrade.executed_at || null
          };

          setStrategyTrades(prev => {
            const updatedTrades = { ...prev };

            if (!updatedTrades[strategyId]) {
              updatedTrades[strategyId] = [];
            }

            // Update the existing trade
            updatedTrades[strategyId] = updatedTrades[strategyId].map(t =>
              t.id === trade.id ? trade : t
            );

            return updatedTrades;
          });

          // Recalculate stats for this strategy
          setStrategyStats(prev => {
            const updatedStats = { ...prev };
            const strategyTradeList = strategyTrades[strategyId] || [];
            updatedStats[strategyId] = calculateStrategyStats(strategyId, strategyTradeList);
            return updatedStats;
          });
        } else if (payload.eventType === 'DELETE' && oldRawTrade) {
          // Update the trades for this strategy
          const strategyId = oldRawTrade.strategyId || oldRawTrade.strategy_id;
          if (!strategyId) return;

          setStrategyTrades(prev => {
            const updatedTrades = { ...prev };

            if (!updatedTrades[strategyId]) {
              return updatedTrades;
            }

            // Remove the deleted trade
            updatedTrades[strategyId] = updatedTrades[strategyId].filter(t =>
              t.id !== oldRawTrade.id
            );

            return updatedTrades;
          });

          // Recalculate stats for this strategy
          setStrategyStats(prev => {
            const updatedStats = { ...prev };
            const strategyTradeList = strategyTrades[strategyId] || [];
            const updatedTradeList = strategyTradeList.filter(t => t.id !== oldRawTrade.id);
            updatedStats[strategyId] = calculateStrategyStats(strategyId, updatedTradeList);
            return updatedStats;
          });
        }
      })
      .subscribe();

    // Subscribe to analytics updates
    const analyticsUpdateHandler = (data: any) => {
      if (data && data.strategyId) {
        // Update stats for this strategy
        setStrategyStats(prev => {
          const updatedStats = { ...prev };
          const strategyTradeList = strategyTrades[data.strategyId] || [];
          updatedStats[data.strategyId] = calculateStrategyStats(data.strategyId, strategyTradeList);
          return updatedStats;
        });
      }
    };

    analyticsService.on('analyticsUpdate', analyticsUpdateHandler);

    // Subscribe to budget updates
    const budgetUpdatedHandler = (data: any) => {
      if (data && data.strategyId) {
        // Trigger a refresh of trades for this strategy
        fetchTrades();
      }
    };

    eventBus.subscribe('budget:updated', budgetUpdatedHandler);

    // Subscribe to event bus for trade events
    const tradeCreatedHandler = (data: any) => {
      if (data && data.trade && data.strategy) {
        const strategyId = data.strategy.id;
        const rawTrade = data.trade;

        // Normalize the trade data
        const trade: Trade = {
          id: rawTrade.id,
          symbol: rawTrade.symbol,
          side: rawTrade.side,
          status: rawTrade.status || 'pending',
          amount: rawTrade.amount || (rawTrade as any).entry_amount || (rawTrade as any).quantity || 0.1,
          entryPrice: rawTrade.entryPrice || rawTrade.entry_price || 0,
          exitPrice: rawTrade.exitPrice || rawTrade.exit_price || 0,
          profit: rawTrade.profit || rawTrade.pnl || 0,
          timestamp: Date.now(),
          strategyId: strategyId,
          createdAt: new Date().toISOString(),
          executedAt: null
        };

        // Update the trades for this strategy
        setStrategyTrades(prev => {
          const updatedTrades = { ...prev };
          if (!updatedTrades[strategyId]) {
            updatedTrades[strategyId] = [];
          }

          // Add the new trade at the beginning of the array
          updatedTrades[strategyId] = [trade, ...updatedTrades[strategyId]];
          return updatedTrades;
        });
      }
    };

    // Subscribe to trade created events
    eventBus.subscribe('trade:created', tradeCreatedHandler);

    // Cleanup
    return () => {
      tradeSubscription.unsubscribe();
      analyticsService.off('analyticsUpdate', analyticsUpdateHandler);
      eventBus.unsubscribe('budget:updated', budgetUpdatedHandler);
      eventBus.unsubscribe('trade:created', tradeCreatedHandler);
    };
  }, []);

  // Update stats when trades change
  useEffect(() => {
    // Throttle function to prevent too many updates
    let updateTimeout: NodeJS.Timeout | null = null;

    const updateStats = () => {
      // Calculate stats for each strategy
      const stats: Record<string, any> = {};

      Object.entries(strategyTrades).forEach(([strategyId, strategyTrades]) => {
        stats[strategyId] = calculateStrategyStats(strategyId, strategyTrades);
      });

      // Also calculate stats for strategies that don't have trades yet
      strategies.forEach(strategy => {
        if (!stats[strategy.id]) {
          stats[strategy.id] = calculateStrategyStats(strategy.id, []);
        }
      });

      logService.log('info', 'Updated strategy stats due to trade changes', stats, 'StrategyStatus');
      setStrategyStats(stats);
    };

    // Throttled update function
    const throttledUpdate = () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }

      updateTimeout = setTimeout(() => {
        updateStats();
        updateTimeout = null;
      }, 300); // Throttle to max once per 300ms
    };

    // Initial update
    throttledUpdate();

    // Subscribe to real-time updates
    const tradeUpdateHandler = () => {
      throttledUpdate();
    };

    // Subscribe to all relevant trade events
    eventBus.subscribe('trade:update', tradeUpdateHandler);
    eventBus.subscribe('trade:created', tradeUpdateHandler);
    eventBus.subscribe('trade:closed', tradeUpdateHandler);
    eventBus.subscribe('trade:executed', tradeUpdateHandler);
    eventBus.subscribe('budgetUpdated', tradeUpdateHandler);

    // Clean up
    return () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      eventBus.unsubscribe('trade:update', tradeUpdateHandler);
      eventBus.unsubscribe('trade:created', tradeUpdateHandler);
      eventBus.unsubscribe('trade:closed', tradeUpdateHandler);
      eventBus.unsubscribe('trade:executed', tradeUpdateHandler);
      eventBus.unsubscribe('budgetUpdated', tradeUpdateHandler);
    };
  }, [strategyTrades, strategies]); // Also recalculate when strategies change

  // Get performance color based on value
  const getPerformanceColor = (value: string) => {
    const numValue = parseFloat(value);
    if (numValue > 0) return 'text-green-400';
    if (numValue < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="grid gap-4">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-neon-yellow" />
            <h2 className="gradient-text">Active Strategies</h2>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchTrades();
            }}
            className="p-2 rounded-lg bg-gunmetal-800 hover:bg-gunmetal-700 transition-colors"
            title="Refresh strategy data"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neon-turquoise">
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M3 22v-6h6"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
          </button>
        </div>
      </div>
      {loading ? (
        <div className="p-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-turquoise mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading strategy data...</p>
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto pr-2 strategy-scroll">
          {paginatedStrategies.map(strategy => {
        const stats = strategyStats[strategy.id] || {
          performance: '0.00',
          trades: 0,
          winRate: '0.0',
          lastTrade: null
        };

        const isPositive = parseFloat(stats.performance) >= 0;

        return (
          <div
            key={strategy.id}
            className="p-4 panel-metallic rounded-lg cursor-pointer hover:shadow-lg transition-all duration-300 mb-3"
            onClick={() => handleStrategyClick(strategy.id)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${strategy.status === 'active' ? 'bg-neon-turquoise/10' : 'bg-gunmetal-800'}`}>
                  <Activity className={`w-4 h-4 ${strategy.status === 'active' ? 'text-neon-turquoise' : 'text-gray-400'}`} />
                </div>
                <h3 className="text-lg font-medium">{strategy.title || 'Unnamed Strategy'}</h3>
              </div>
              <span className={`px-2 py-1 rounded text-sm ${
                strategy.status === 'active' ? 'bg-green-500/20 text-green-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {strategy.status}
              </span>
            </div>

            {/* Analytics Section */}
            <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gunmetal-700/30">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className={`w-3 h-3 ${isPositive ? 'text-green-400' : 'text-red-400'}`} />
                  <span className="text-xs text-gray-400">Performance</span>
                </div>
                <p className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{stats.performance}%
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Activity className="w-3 h-3 text-neon-yellow" />
                  <span className="text-xs text-gray-400">Trades</span>
                </div>
                <p className="text-sm font-medium text-white">{stats.trades}</p>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1">
                  <BarChart3 className="w-3 h-3 text-neon-orange" />
                  <span className="text-xs text-gray-400">Win Rate</span>
                </div>
                <p className="text-sm font-medium text-white">{stats.winRate}%</p>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-neon-turquoise" />
                  <span className="text-xs text-gray-400">Last Trade</span>
                </div>
                <p className="text-sm font-medium text-white">
                  {stats.lastTrade || 'None'}
                </p>
              </div>
            </div>
          </div>
        );
      })}

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={strategies.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      )}
    </div>
  );
}
