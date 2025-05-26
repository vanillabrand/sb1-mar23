import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Clock, Activity, Zap } from 'lucide-react';
import { rustApiIntegration } from '../lib/rust-api-integration';
import { eventBus } from '../lib/event-bus';
import { logService } from '../lib/log-service';
import { tradeService } from '../lib/trade-service';
import { marketDataService } from '../lib/market-data-service';
import { websocketService } from '../lib/websocket-service';
import { formatCurrency } from '../lib/format-utils';
import type { Trade, Strategy } from '../lib/types';

interface RealTimeTradeAnalyticsProps {
  strategy: Strategy;
  trades: Trade[];
  budget?: {
    total: number;
    allocated: number;
    available: number;
    profit: number;
    profitPercentage?: number;
    allocationPercentage?: number;
  };
  className?: string;
}

export function RealTimeTradeAnalytics({ strategy, trades, budget, className = '' }: RealTimeTradeAnalyticsProps) {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [tradeMetrics, setTradeMetrics] = useState({
    totalTrades: 0,
    activeTrades: 0,
    profitableTrades: 0,
    unprofitableTrades: 0,
    totalProfit: 0,
    totalLoss: 0,
    netProfit: 0,
    winRate: 0,
    avgTradeProfit: 0,
    avgTradeDuration: 0,
    unrealizedProfit: 0
  });
  const [isWebsocketConnected, setIsWebsocketConnected] = useState(false);

  // Subscribe to real-time price updates via websocket
  useEffect(() => {
    if (!strategy || !strategy.selected_pairs || strategy.selected_pairs.length === 0) return;

    const subscribeToLivePrices = async () => {
      try {
        // Subscribe to price updates for each trading pair
        for (const pair of strategy.selected_pairs) {
          try {
            // Format the symbol for websocket subscription
            const formattedSymbol = pair.replace('/', '').toLowerCase() + '@ticker';

            // Subscribe to ticker updates
            await websocketService.send({
              type: 'subscribe',
              channel: 'ticker',
              symbol: formattedSymbol
            });

            logService.log('info', `Subscribed to real-time price updates for ${pair}`, null, 'RealTimeTradeAnalytics');
          } catch (error) {
            logService.log('error', `Failed to subscribe to ${pair} via websocket`, error, 'RealTimeTradeAnalytics');
          }
        }

        setIsWebsocketConnected(true);
      } catch (error) {
        logService.log('error', 'Failed to set up real-time price updates', error, 'RealTimeTradeAnalytics');
        setIsWebsocketConnected(false);
      }
    };

    subscribeToLivePrices();

    // Handle price updates from websocket
    const handlePriceUpdate = (data: any) => {
      if (!data || !data.symbol) return;

      // Update the live prices state
      setLivePrices(prev => ({
        ...prev,
        [data.symbol]: data.price || data.last_price
      }));

      // Update the last updated timestamp
      setLastUpdated(new Date());
    };

    // Subscribe to price updates
    eventBus.subscribe('market:ticker', handlePriceUpdate);

    // Clean up subscriptions
    return () => {
      eventBus.unsubscribe('market:ticker', handlePriceUpdate);

      // Unsubscribe from websocket channels
      if (strategy.selected_pairs) {
        for (const pair of strategy.selected_pairs) {
          const formattedSymbol = pair.replace('/', '').toLowerCase() + '@ticker';
          websocketService.send({
            type: 'unsubscribe',
            channel: 'ticker',
            symbol: formattedSymbol
          }).catch(error => {
            logService.log('error', `Failed to unsubscribe from ${pair}`, error, 'RealTimeTradeAnalytics');
          });
        }
      }
    };
  }, [strategy.id, strategy.selected_pairs]);

  // Calculate trade metrics
  useEffect(() => {
    if (!trades || trades.length === 0) return;

    const calculateMetrics = () => {
      const activeTrades = trades.filter(t => t.status === 'open' || t.status === 'pending');
      const closedTrades = trades.filter(t => t.status === 'closed');
      const profitableTrades = closedTrades.filter(t => (t.profit || 0) > 0);
      const unprofitableTrades = closedTrades.filter(t => (t.profit || 0) <= 0);

      const totalProfit = profitableTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
      const totalLoss = unprofitableTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
      const netProfit = totalProfit + totalLoss;

      // Calculate unrealized profit for active trades
      let unrealizedProfit = 0;
      for (const trade of activeTrades) {
        const currentPrice = livePrices[trade.symbol] || trade.entryPrice;
        if (!currentPrice) continue;

        const priceDiff = trade.side === 'buy'
          ? currentPrice - trade.entryPrice
          : trade.entryPrice - currentPrice;

        const tradeProfit = priceDiff * (trade.amount || 0);
        unrealizedProfit += tradeProfit;
      }

      // Calculate average trade duration for closed trades
      let totalDuration = 0;
      for (const trade of closedTrades) {
        if (trade.closedAt && trade.timestamp) {
          totalDuration += (trade.closedAt - trade.timestamp);
        }
      }
      const avgTradeDuration = closedTrades.length > 0 ? totalDuration / closedTrades.length : 0;

      setTradeMetrics({
        totalTrades: trades.length,
        activeTrades: activeTrades.length,
        profitableTrades: profitableTrades.length,
        unprofitableTrades: unprofitableTrades.length,
        totalProfit,
        totalLoss,
        netProfit,
        winRate: closedTrades.length > 0 ? (profitableTrades.length / closedTrades.length) * 100 : 0,
        avgTradeProfit: closedTrades.length > 0 ? netProfit / closedTrades.length : 0,
        avgTradeDuration,
        unrealizedProfit
      });
    };

    calculateMetrics();

    // Recalculate metrics when live prices update
    const interval = setInterval(calculateMetrics, 5000);

    return () => clearInterval(interval);
  }, [trades, livePrices]);

  // Format duration in minutes/hours
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <motion.div
      className={`bg-gunmetal-800/50 rounded-lg p-4 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white flex items-center">
          <Activity className="w-5 h-5 text-neon-turquoise mr-2" />
          Real-Time Analytics
        </h3>
        <div className="flex items-center text-xs text-gray-400">
          <Clock className="w-3 h-3 mr-1" />
          Updated: {lastUpdated.toLocaleTimeString()}
          {isWebsocketConnected && (
            <span className="ml-2 flex items-center text-neon-turquoise">
              <Zap className="w-3 h-3 mr-1" />
              Live
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {/* Budget and Balance */}
        <div className="bg-gunmetal-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Total Budget</div>
          <div className="text-lg font-semibold text-white">{formatCurrency(budget?.total || 0)}</div>
        </div>
        <div className="bg-gunmetal-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Available Balance</div>
          <div className="text-lg font-semibold text-white">{formatCurrency(budget?.available || 0)}</div>
        </div>
        <div className="bg-gunmetal-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Allocated</div>
          <div className="text-lg font-semibold text-white">{formatCurrency(budget?.allocated || 0)}</div>
        </div>
        <div className="bg-gunmetal-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Profit/Loss</div>
          <div className={`text-lg font-semibold ${(budget?.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {(budget?.profit || 0) >= 0 ? '+' : ''}{formatCurrency(budget?.profit || 0)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Trade Metrics */}
        <div className="bg-gunmetal-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Active Trades</div>
          <div className="text-lg font-semibold text-white">{tradeMetrics.activeTrades}</div>
        </div>
        <div className="bg-gunmetal-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Win Rate</div>
          <div className="text-lg font-semibold text-white">{tradeMetrics.winRate.toFixed(1)}%</div>
        </div>
        <div className="bg-gunmetal-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Unrealized P/L</div>
          <div className={`text-lg font-semibold ${tradeMetrics.unrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {tradeMetrics.unrealizedProfit >= 0 ? '+' : ''}{formatCurrency(tradeMetrics.unrealizedProfit)}
          </div>
        </div>
        <div className="bg-gunmetal-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Avg Duration</div>
          <div className="text-lg font-semibold text-white">{formatDuration(tradeMetrics.avgTradeDuration)}</div>
        </div>
      </div>
    </motion.div>
  );
}
