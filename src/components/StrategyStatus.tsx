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
      lastTrade: lastTrade ? formatDistanceToNow(new Date(lastTrade.createdAt), { addSuffix: true }) : null
    };
  };

  // Fetch trades for all strategies
  const fetchTrades = async () => {
    try {
      // Get trades for all strategies
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Organize trades by strategy
      const tradesByStrategy: Record<string, Trade[]> = {};
      
      trades?.forEach(trade => {
        const strategyId = trade.strategyId || trade.strategy_id;
        if (!strategyId) return;
        
        if (!tradesByStrategy[strategyId]) {
          tradesByStrategy[strategyId] = [];
        }
        
        tradesByStrategy[strategyId].push(trade as Trade);
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
    }
  };

  // Initial data load
  useEffect(() => {
    fetchTrades();

    // Subscribe to trade updates
    const tradeSubscription = supabase
      .channel('trades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, (payload) => {
        const trade = payload.new as unknown as Trade;
        const oldTrade = payload.old as unknown as Trade;

        if (payload.eventType === 'INSERT' && trade && trade.strategyId) {
          // Update the trades for this strategy
          setStrategyTrades(prev => {
            const updatedTrades = { ...prev };

            if (!updatedTrades[trade.strategyId]) {
              updatedTrades[trade.strategyId] = [];
            }

            // Add the new trade at the beginning (most recent)
            updatedTrades[trade.strategyId] = [
              trade,
              ...updatedTrades[trade.strategyId].filter(t => t.id !== trade.id)
            ];

            return updatedTrades;
          });

          // Recalculate stats for this strategy
          setStrategyStats(prev => {
            const updatedStats = { ...prev };
            const strategyTradeList = [...(strategyTrades[trade.strategyId] || []), trade];
            updatedStats[trade.strategyId] = calculateStrategyStats(trade.strategyId, strategyTradeList);
            return updatedStats;
          });
        } else if (payload.eventType === 'UPDATE' && trade && trade.strategyId) {
          // Update the trades for this strategy
          setStrategyTrades(prev => {
            const updatedTrades = { ...prev };

            if (!updatedTrades[trade.strategyId]) {
              updatedTrades[trade.strategyId] = [];
            }

            // Update the existing trade
            updatedTrades[trade.strategyId] = updatedTrades[trade.strategyId].map(t =>
              t.id === trade.id ? trade : t
            );

            return updatedTrades;
          });

          // Recalculate stats for this strategy
          setStrategyStats(prev => {
            const updatedStats = { ...prev };
            const strategyTradeList = strategyTrades[trade.strategyId] || [];
            updatedStats[trade.strategyId] = calculateStrategyStats(trade.strategyId, strategyTradeList);
            return updatedStats;
          });
        } else if (payload.eventType === 'DELETE' && oldTrade && oldTrade.strategyId) {
          // Update the trades for this strategy
          setStrategyTrades(prev => {
            const updatedTrades = { ...prev };

            if (!updatedTrades[oldTrade.strategyId]) {
              return updatedTrades;
            }

            // Remove the deleted trade
            updatedTrades[oldTrade.strategyId] = updatedTrades[oldTrade.strategyId].filter(t =>
              t.id !== oldTrade.id
            );

            return updatedTrades;
          });

          // Recalculate stats for this strategy
          setStrategyStats(prev => {
            const updatedStats = { ...prev };
            const strategyTradeList = strategyTrades[oldTrade.strategyId] || [];
            const updatedTradeList = strategyTradeList.filter(t => t.id !== oldTrade.id);
            updatedStats[oldTrade.strategyId] = calculateStrategyStats(oldTrade.strategyId, updatedTradeList);
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

    // Cleanup
    return () => {
      tradeSubscription.unsubscribe();
      analyticsService.off('analyticsUpdate', analyticsUpdateHandler);
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
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-neon-yellow" />
          <h2 className="gradient-text">Active Strategies</h2>
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
