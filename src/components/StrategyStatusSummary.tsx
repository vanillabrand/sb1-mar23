import React, { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Activity, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { eventBus } from '../lib/event-bus';
import { demoService } from '../lib/demo-service';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';
import type { Strategy, Trade } from '../lib/types';

interface StrategyStatusSummaryProps {
  strategies: Strategy[];
}

export const StrategyStatusSummary: React.FC<StrategyStatusSummaryProps> = ({ strategies }) => {
  // Track individual strategy stats
  const [strategyStats, setStrategyStats] = useState<Record<string, {
    performance: string;
    trades: number;
    winRate: string;
    lastTrade: string | null;
  }>>({});

  // Immediate fetch on component mount or when strategies change
  useEffect(() => {
    // Always run this effect, even with empty strategies
    // This ensures we reset the state when there are no strategies

    const isDemo = demoService.isInDemoMode();

    const fetchAndUpdateStats = async () => {
      try {
        // Get all strategy IDs
        const strategyIds = strategies.map(s => s.id);

        // Reset stats if there are no strategies
        if (strategyIds.length === 0) {
          setStrategyStats({});
          return;
        }

        // Fetch trades for all strategies
        const { data: trades, error } = await supabase
          .from('trades')
          .select('*')
          .in('strategy_id', strategyIds)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        if (trades) {
          // Calculate individual strategy stats
          const newStrategyStats: Record<string, any> = {};

          for (const strategyId of strategyIds) {
            const strategyTrades = trades.filter(trade => trade.strategy_id === strategyId);
            if (strategyTrades.length > 0) {
              // Calculate total profit, ensuring we handle all possible property names
              const totalProfit = strategyTrades.reduce((sum, trade) => {
                // Try all possible property names for profit
                const profit = trade.profit || trade.pnl || trade.profitLoss || 0;
                return sum + profit;
              }, 0);
              const completedTrades = strategyTrades.filter(t => t.status === 'closed');
              const winningTrades = completedTrades.filter(t => (t.profit || 0) > 0);
              const winRate = completedTrades.length ? (winningTrades.length / completedTrades.length) * 100 : 0;

              // Sort trades by creation date (newest first)
              const sortedTrades = [...strategyTrades].sort((a, b) => {
                const dateA = new Date(a.createdAt || a.created_at || 0);
                const dateB = new Date(b.createdAt || b.created_at || 0);
                return dateB.getTime() - dateA.getTime();
              });

              const lastTrade = sortedTrades[0];

              newStrategyStats[strategyId] = {
                performance: totalProfit.toFixed(2),
                trades: strategyTrades.length,
                winRate: winRate.toFixed(1),
                lastTrade: lastTrade ? formatDistanceToNow(new Date(lastTrade.createdAt || lastTrade.created_at), { addSuffix: true }) : null
              };
            }
          }

          setStrategyStats(newStrategyStats);
        }
      } catch (error) {
        logService.log('error', 'Error fetching trades for strategies', error, 'StrategyStatusSummary');
        console.error('Error fetching trades for strategies:', error);
      }
    };

    // Initial fetch
    fetchAndUpdateStats();

    // Set up event listeners for trade updates
    const handleTradeUpdate = (data: any) => {
      // Check if this update is relevant to our strategies
      if (data && data.strategyId && strategies.some(s => s.id === data.strategyId)) {
        logService.log('info', `Trade update received for strategy ${data.strategyId}`, data, 'StrategyStatusSummary');
        fetchAndUpdateStats();
      } else {
        // If no specific strategy ID or not in our list, refresh anyway to be safe
        fetchAndUpdateStats();
      }
    };

    // Subscribe to all relevant trade events
    const events = [
      'trade:created',
      'trade:updated',
      'trade:closed',
      'trade:removed',
      'trade:executed',
      'trade:update',
      'tradesUpdated',
      'budgetUpdated',
      'strategy:budget:updated'
    ];

    events.forEach(event => {
      eventBus.subscribe(event, handleTradeUpdate);
    });

    return () => {
      events.forEach(event => {
        eventBus.unsubscribe(event, handleTradeUpdate);
      });
    };
  }, [strategies]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-neon-turquoise" />
          <h3 className="text-lg font-bold gradient-text">Active Strategies</h3>
        </div>
        <span className="text-sm text-gray-400">{strategies.length} active</span>
      </div>

      {/* Active Strategies List */}
      {strategies.length > 0 ? (
        <div className="mt-4 space-y-3">
          {strategies.map(strategy => {
            const strategyData = strategyStats[strategy.id] || {
              performance: '0.00',
              trades: 0,
              winRate: '0.0',
              lastTrade: null
            };

            return (
              <div key={strategy.id} className="bg-gunmetal-800/30 rounded-lg p-3 hover:bg-gunmetal-800/50 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-neon-turquoise/10">
                      <Activity className="w-4 h-4 text-neon-turquoise" />
                    </div>
                    <span className="font-medium text-gray-200">{strategy.name || strategy.title}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neon-turquoise/10 text-neon-turquoise">
                    ACTIVE
                  </span>
                </div>

                {/* Strategy Stats */}
                <div className="grid grid-cols-5 gap-2 mt-2 text-sm">
                  <div>
                    <span className="text-gray-400 text-xs">Performance</span>
                    <p className={strategyData.performance.startsWith('-') ? 'text-red-500' : 'text-green-500'}>
                      {strategyData.performance}%
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Trades</span>
                    <p className="text-white">{strategyData.trades}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Win Rate</span>
                    <p className="text-white">{strategyData.winRate}%</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Market Type</span>
                    <p className="text-white">{strategy.market_type ? strategy.market_type.charAt(0).toUpperCase() + strategy.market_type.slice(1) : 'Spot'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Last Trade</span>
                    <p className="text-white">{strategyData.lastTrade || 'No trades'}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 bg-gunmetal-800/30 rounded-lg p-4 text-center">
          <p className="text-gray-400">No active strategies</p>
        </div>
      )}
    </div>
  );
};
