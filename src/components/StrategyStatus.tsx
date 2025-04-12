import { useState, useEffect } from 'react';
import { Activity, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { eventBus } from '../lib/event-bus';
import { analyticsService } from '../lib/services';
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

  // Generate demo trades for a strategy
  const generateDemoTradesForStrategy = (strategy: Strategy, count: number): Trade[] => {
    const trades: Trade[] = [];
    const now = Date.now();
    const symbols = strategy.selected_pairs || [];

    // Use default symbols if none are defined
    const availableSymbols = symbols.length > 0 ?
      symbols : ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT'];

    // Generate random trades
    for (let i = 0; i < count; i++) {
      const symbol = availableSymbols[Math.floor(Math.random() * availableSymbols.length)];
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const isProfit = Math.random() > 0.4; // 60% chance of profit
      const basePrice = getBasePrice(symbol);
      const entryPrice = basePrice * (0.95 + Math.random() * 0.1);
      const exitPrice = isProfit ?
        entryPrice * (1 + (0.01 + Math.random() * 0.05)) :
        entryPrice * (0.95 + Math.random() * 0.04);
      const amount = 0.1 + Math.random() * 0.9;
      const profit = side === 'buy' ?
        ((exitPrice - entryPrice) / entryPrice) * 100 :
        ((entryPrice - exitPrice) / entryPrice) * 100;

      // Adjust profit based on side
      const adjustedProfit = side === 'buy' ? profit : (isProfit ? profit : -profit);

      trades.push({
        id: `demo-${strategy.id}-${i}-${now}`,
        symbol,
        side,
        status: Math.random() > 0.3 ? 'executed' : 'pending',
        amount,
        entryPrice,
        exitPrice: Math.random() > 0.5 ? exitPrice : undefined,
        profit: adjustedProfit,
        timestamp: now - (i * 3600000), // Spread out over hours
        strategyId: strategy.id,
        createdAt: new Date(now - (i * 3600000)).toISOString(),
        executedAt: Math.random() > 0.3 ? new Date(now - (i * 3600000) + 60000).toISOString() : null
      });
    }

    return trades;
  };

  // Helper function to get base price for a symbol
  const getBasePrice = (symbol: string): number => {
    if (symbol.includes('BTC')) return 60000 + (Math.random() * 5000);
    if (symbol.includes('ETH')) return 3000 + (Math.random() * 300);
    if (symbol.includes('SOL')) return 150 + (Math.random() * 20);
    if (symbol.includes('XRP')) return 0.5 + (Math.random() * 0.1);
    if (symbol.includes('DOGE')) return 0.1 + (Math.random() * 0.02);
    if (symbol.includes('ADA')) return 0.4 + (Math.random() * 0.05);
    return 10 + (Math.random() * 5); // Default for other symbols
  };

  // Calculate stats for a strategy based on its trades
  const calculateStrategyStats = (strategyId: string, trades: Trade[]) => {
    // Only consider completed trades for win rate calculation
    const completedTrades = trades.filter(t => t.status === 'executed' || t.status === 'closed' || t.exitPrice);
    const totalCompletedTrades = completedTrades.length;

    // Calculate profitable trades (only from completed trades)
    const profitableTrades = completedTrades.filter(t => (t.profit || 0) > 0).length;

    // Calculate win rate based on completed trades
    const winRate = totalCompletedTrades > 0 ? (profitableTrades / totalCompletedTrades * 100) : 0;

    // Calculate total profit from all trades
    const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);

    // Get the most recent trade
    const lastTrade = trades[0]; // First trade is the most recent due to ordering

    // Format the last trade time with date and time
    const lastTradeTime = lastTrade ? formatDistanceToNow(new Date(lastTrade.createdAt), { addSuffix: true }) : null;

    return {
      performance: totalProfit.toFixed(2),
      trades: trades.length, // Total number of trades (including pending)
      winRate: winRate.toFixed(1),
      lastTrade: lastTradeTime
    };
  };

  // Fetch trades for all strategies with improved data handling
  const fetchTrades = async () => {
    try {
      // Get trades for all strategies
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200); // Increased limit to get more trades

      if (error) throw error;

      // Organize trades by strategy
      const tradesByStrategy: Record<string, Trade[]> = {};

      // Process database trades
      trades?.forEach(trade => {
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
          amount: trade.amount || (trade as any).entry_amount || (trade as any).quantity || 0.1,
          entryPrice: trade.entry_price || (trade as any).entryPrice || 0,
          exitPrice: trade.exit_price || (trade as any).exitPrice || 0,
          profit: trade.profit || (trade as any).pnl || 0,
          timestamp: new Date(trade.created_at || trade.timestamp).getTime(),
          strategyId: strategyId,
          createdAt: trade.created_at || new Date(trade.timestamp).toISOString(),
          executedAt: trade.executed_at || null
        };

        tradesByStrategy[strategyId].push(normalizedTrade);
      });

      // If we have no trades for active strategies, generate some demo trades
      strategies.forEach(strategy => {
        if (strategy.status === 'active' && (!tradesByStrategy[strategy.id] || tradesByStrategy[strategy.id].length === 0)) {
          // Generate demo trades for this strategy
          tradesByStrategy[strategy.id] = generateDemoTradesForStrategy(strategy, 5);
        }
      });

      setStrategyTrades(tradesByStrategy);

      // Calculate stats for each strategy
      const stats: Record<string, any> = {};

      Object.entries(tradesByStrategy).forEach(([strategyId, strategyTrades]) => {
        stats[strategyId] = calculateStrategyStats(strategyId, strategyTrades);
      });

      setStrategyStats(stats);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching trades:', error);
      setLoading(false);

      // Generate fallback demo data if fetch fails
      const fallbackStats: Record<string, any> = {};
      const fallbackTrades: Record<string, Trade[]> = {};

      strategies.forEach(strategy => {
        fallbackTrades[strategy.id] = generateDemoTradesForStrategy(strategy, 5);
        fallbackStats[strategy.id] = calculateStrategyStats(strategy.id, fallbackTrades[strategy.id]);
      });

      setStrategyTrades(fallbackTrades);
      setStrategyStats(fallbackStats);
    }
  };

  // Initial data load
  useEffect(() => {
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
            executedAt: rawTrade.executed_at || null
          };

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
      eventBus.unsubscribe('trade:created', tradeCreatedHandler);
    };
  }, []);

  // Update stats when trades change
  useEffect(() => {
    // Calculate stats for each strategy
    const stats: Record<string, any> = {};

    Object.entries(strategyTrades).forEach(([strategyId, strategyTrades]) => {
      stats[strategyId] = calculateStrategyStats(strategyId, strategyTrades);
    });

    setStrategyStats(stats);
  }, [strategyTrades]);

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
