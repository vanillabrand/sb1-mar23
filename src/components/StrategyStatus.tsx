import React, { useState, useEffect } from 'react';
import { CollapsibleDescription } from './CollapsibleDescription';
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
  const ITEMS_PER_PAGE = 6;
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

  // Calculate stats for a strategy based on its trades
  const calculateStrategyStats = (strategyId: string, trades: Trade[]) => {
    const totalTrades = trades.length;
    const profitableTrades = trades.filter(t => (t.profit || 0) > 0).length;
    const winRate = totalTrades > 0 ? (profitableTrades / totalTrades * 100) : 0;
    const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const lastTrade = trades[0]; // First trade is the most recent due to ordering

    return {
      performance: totalProfit.toFixed(2),
      trades: totalTrades,
      winRate: winRate.toFixed(1),
      lastTrade: lastTrade ? formatDistanceToNow(new Date(lastTrade.created_at), { addSuffix: true }) : null
    };
  };

  // Fetch trades for all strategies
  useEffect(() => {
    const fetchTradesForStrategies = async () => {
      if (strategies.length === 0) return;

      setLoading(true);

      try {
        // Get all strategy IDs
        const strategyIds = strategies.map(s => s.id);

        // Fetch trades for all strategies
        const { data: trades, error } = await supabase
          .from('trades')
          .select('*')
          .in('strategy_id', strategyIds)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Group trades by strategy ID
        const tradesByStrategy: Record<string, Trade[]> = {};

        trades?.forEach(trade => {
          if (!tradesByStrategy[trade.strategy_id]) {
            tradesByStrategy[trade.strategy_id] = [];
          }
          tradesByStrategy[trade.strategy_id].push(trade as unknown as Trade);
        });

        setStrategyTrades(tradesByStrategy);

        // Calculate stats for each strategy
        const stats: Record<string, any> = {};

        strategyIds.forEach(strategyId => {
          const strategyTradeList = tradesByStrategy[strategyId] || [];
          stats[strategyId] = calculateStrategyStats(strategyId, strategyTradeList);
        });

        setStrategyStats(stats);
      } catch (error) {
        console.error('Error fetching trades:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTradesForStrategies();
  }, [strategies]);

  // Subscribe to real-time analytics updates
  useEffect(() => {
    if (strategies.length === 0) return;

    // Create a map of event handlers for each strategy
    const analyticsHandlers: Record<string, (data: any) => void> = {};

    // Subscribe to analytics updates for each strategy
    strategies.forEach(strategy => {
      const handler = (data: any) => {
        if (data && data.metrics) {
          // Update stats for this strategy
          setStrategyStats(prev => {
            const updatedStats = { ...prev };

            // Update performance from analytics data
            if (updatedStats[strategy.id]) {
              updatedStats[strategy.id] = {
                ...updatedStats[strategy.id],
                performance: data.metrics.performance.toFixed(2),
                // Update other stats if available in the analytics data
                ...(data.trades ? {
                  trades: data.trades.total,
                  winRate: ((data.trades.profitable / data.trades.total) * 100).toFixed(1),
                  lastTrade: data.timestamp ? new Date(data.timestamp).toISOString() : updatedStats[strategy.id].lastTrade
                } : {})
              };
            }

            return updatedStats;
          });
        }
      };

      // Store the handler for cleanup
      analyticsHandlers[strategy.id] = handler;

      // Subscribe to strategy-specific analytics updates
      eventBus.subscribe(`strategy:analytics:${strategy.id}`, handler);
    });

    // Also subscribe to general analytics updates
    const analyticsUpdateHandler = (data: any) => {
      if (data && data.strategyId && strategies.some(s => s.id === data.strategyId)) {
        // This will trigger an update for the specific strategy
        const strategyId = data.strategyId;
        const handler = analyticsHandlers[strategyId];
        if (handler) handler(data);
      }
    };

    analyticsService.on('analyticsUpdate', analyticsUpdateHandler);

    return () => {
      // Unsubscribe from all strategy-specific events
      strategies.forEach(strategy => {
        const handler = analyticsHandlers[strategy.id];
        if (handler) {
          eventBus.unsubscribe(`strategy:analytics:${strategy.id}`, handler);
        }
      });

      // Unsubscribe from general analytics updates
      analyticsService.off('analyticsUpdate', analyticsUpdateHandler);
    };
  }, [strategies]);

  // Subscribe to real-time trade updates
  useEffect(() => {
    if (strategies.length === 0) return;

    // Subscribe to trade updates via Supabase realtime
    const subscription = supabase
      .channel('trade_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trades'
      }, (payload) => {
        // When a trade is created, updated, or deleted
        const trade = payload.new as unknown as Trade;
        const oldTrade = payload.old as unknown as Trade;

        if (payload.eventType === 'INSERT' && trade && trade.strategy_id) {
          // Update the trades for this strategy
          setStrategyTrades(prev => {
            const updatedTrades = { ...prev };

            if (!updatedTrades[trade.strategy_id]) {
              updatedTrades[trade.strategy_id] = [];
            }

            // Add the new trade at the beginning (most recent)
            updatedTrades[trade.strategy_id] = [
              trade,
              ...updatedTrades[trade.strategy_id].filter(t => t.id !== trade.id)
            ];

            return updatedTrades;
          });

          // Recalculate stats for this strategy
          setStrategyStats(prev => {
            const updatedStats = { ...prev };
            const strategyTradeList = [...(strategyTrades[trade.strategy_id] || []), trade];
            updatedStats[trade.strategy_id] = calculateStrategyStats(trade.strategy_id, strategyTradeList);
            return updatedStats;
          });
        } else if (payload.eventType === 'UPDATE' && trade && trade.strategy_id) {
          // Update the trades for this strategy
          setStrategyTrades(prev => {
            const updatedTrades = { ...prev };

            if (!updatedTrades[trade.strategy_id]) {
              updatedTrades[trade.strategy_id] = [];
            }

            // Update the existing trade
            updatedTrades[trade.strategy_id] = updatedTrades[trade.strategy_id].map(t =>
              t.id === trade.id ? trade : t
            );

            return updatedTrades;
          });

          // Recalculate stats for this strategy
          setStrategyStats(prev => {
            const updatedStats = { ...prev };
            const strategyTradeList = strategyTrades[trade.strategy_id] || [];
            updatedStats[trade.strategy_id] = calculateStrategyStats(trade.strategy_id, strategyTradeList);
            return updatedStats;
          });
        } else if (payload.eventType === 'DELETE' && oldTrade && oldTrade.strategy_id) {
          // Update the trades for this strategy
          setStrategyTrades(prev => {
            const updatedTrades = { ...prev };

            if (!updatedTrades[oldTrade.strategy_id]) {
              return updatedTrades;
            }

            // Remove the deleted trade
            updatedTrades[oldTrade.strategy_id] = updatedTrades[oldTrade.strategy_id].filter(t =>
              t.id !== oldTrade.id
            );

            return updatedTrades;
          });

          // Recalculate stats for this strategy
          setStrategyStats(prev => {
            const updatedStats = { ...prev };
            const strategyTradeList = strategyTrades[oldTrade.strategy_id] || [];
            const updatedTradeList = strategyTradeList.filter(t => t.id !== oldTrade.id);
            updatedStats[oldTrade.strategy_id] = calculateStrategyStats(oldTrade.strategy_id, updatedTradeList);
            return updatedStats;
          });
        }
      })
      .subscribe();

    // Clean up subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [strategies, strategyTrades]);

  if (!strategies || strategies.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-400">No active strategies</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-neon-yellow" />
          <h2 className="gradient-text">Active Strategies</h2>
        </div>
        <CollapsibleDescription id="strategy-status-description" className="ml-8 mt-2 mb-4">
          <p className="description-text">Your currently running trading strategies with real-time performance metrics.</p>
        </CollapsibleDescription>
      </div>
      {loading ? (
        <div className="p-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neon-turquoise mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading strategy data...</p>
        </div>
      ) : (
        <>
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
            className="p-4 panel-metallic rounded-lg cursor-pointer hover:shadow-lg transition-all duration-300"
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
                  <BarChart3 className="w-3 h-3 text-neon-turquoise" />
                  <span className="text-xs text-gray-400">Win Rate</span>
                </div>
                <p className="text-sm font-medium text-white">{stats.winRate}%</p>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-neon-orange" />
                  <span className="text-xs text-gray-400">Last Trade</span>
                </div>
                <p className="text-sm font-medium text-white">
                  {stats.lastTrade ? stats.lastTrade : 'No trades yet'}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Pagination Controls */}
      {strategies.length > ITEMS_PER_PAGE && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={strategies.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      )}
      </>
      )}
    </div>
  );
}
