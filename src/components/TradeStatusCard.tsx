import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  DollarSign,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { rustApiIntegration } from '../lib/rust-api-integration';
import { marketDataService } from '../lib/market-data-service';
import { tradeService } from '../lib/trade-service';
import { logService } from '../lib/log-service';
import { demoService } from '../lib/demo-service';
import type { Trade, Strategy } from '../lib/types';

interface TradeStatusCardProps {
  trade: Trade;
  strategy?: Strategy;
  onCloseTrade?: (trade: Trade) => Promise<void>;
  onEditTrade?: (trade: Trade) => void;
  onDeleteTrade?: (trade: Trade) => void;
  onViewDetails?: (trade: Trade) => void;
}

export function TradeStatusCard({
  trade,
  strategy,
  onCloseTrade,
  onEditTrade,
  onDeleteTrade,
  onViewDetails
}: TradeStatusCardProps) {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDemoMode = demoService.isDemoMode();
  const isOpen = trade.status === 'open' || trade.status === 'pending';
  const isClosed = trade.status === 'closed';
  const isCancelled = trade.status === 'cancelled';

  // Calculate profit/loss
  const calculatePnL = () => {
    if (!trade.amount || !trade.entryPrice) {
      return { percent: null, value: null };
    }

    // If the trade has an exit price, use that
    if (trade.exitPrice) {
      const pnlValue = (trade.amount * trade.exitPrice) - (trade.amount * trade.entryPrice);
      const pnlPercent = ((trade.exitPrice / trade.entryPrice) - 1) * 100;
      return {
        percent: trade.side === 'buy' ? pnlPercent : -pnlPercent,
        value: trade.side === 'buy' ? pnlValue : -pnlValue
      };
    }

    // If the trade is still open, use current market price
    if (currentPrice) {
      const pnlValue = (trade.amount * currentPrice) - (trade.amount * trade.entryPrice);
      const pnlPercent = ((currentPrice / trade.entryPrice) - 1) * 100;
      return {
        percent: trade.side === 'buy' ? pnlPercent : -pnlPercent,
        value: trade.side === 'buy' ? pnlValue : -pnlValue
      };
    }

    // If we don't have a current price, use the profit field if available
    if (trade.profit !== undefined) {
      const estimatedValue = (trade.profit / 100) * (trade.amount * trade.entryPrice);
      return { percent: trade.profit, value: estimatedValue };
    }

    return { percent: null, value: null };
  };

  const pnl = calculatePnL();
  const isProfitable = pnl.percent !== null && pnl.percent > 0;
  const isLoss = pnl.percent !== null && pnl.percent < 0;

  // Fetch current price
  useEffect(() => {
    const fetchPrice = async () => {
      if (!trade.symbol) return;

      try {
        const marketData = await marketDataService.getMarketData(trade.symbol);
        if (marketData && marketData.price !== undefined) {
          setCurrentPrice(parseFloat(marketData.price));
        }
      } catch (error) {
        console.error(`Failed to fetch price for ${trade.symbol}:`, error);
      }
    };

    fetchPrice();

    // Set up an interval to refresh price every 10 seconds if trade is open
    if (isOpen) {
      const intervalId = setInterval(fetchPrice, 10000);
      return () => clearInterval(intervalId);
    }
  }, [trade.symbol, isOpen]);

  // Handle closing a trade
  const handleCloseTrade = async () => {
    if (!isOpen || !onCloseTrade) return;

    try {
      setIsClosing(true);
      setError(null);
      await onCloseTrade(trade);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to close trade';
      setError(errorMessage);
      logService.log('error', 'Failed to close trade', error, 'TradeStatusCard');
    } finally {
      setIsClosing(false);
    }
  };

  // Handle refreshing price manually
  const handleRefreshPrice = async () => {
    if (!trade.symbol) return;

    try {
      setIsLoading(true);
      const marketData = await marketDataService.getMarketData(trade.symbol);
      if (marketData && marketData.price !== undefined) {
        setCurrentPrice(parseFloat(marketData.price));
      }
    } catch (error) {
      console.error(`Failed to fetch price for ${trade.symbol}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`panel-metallic rounded-xl overflow-hidden panel-shadow ${
        isOpen
          ? 'border-l-4 border-neon-turquoise'
          : isClosed
            ? isProfitable
              ? 'border-l-4 border-green-500'
              : 'border-l-4 border-red-500'
            : 'border-l-4 border-gray-500'
      }`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-semibold text-white">{trade.symbol || 'Unknown'}</span>
              {isDemoMode && (
                <span className="px-2 py-0.5 bg-neon-turquoise/20 text-neon-turquoise text-xs rounded-full">
                  Demo
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1 text-sm ${
                trade.side === 'buy' ? 'text-green-400' : 'text-red-400'
              }`}>
                {trade.side === 'buy' ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {trade.side || 'Unknown'}
              </span>

              <span className="text-xs px-2 py-0.5 bg-gunmetal-800 rounded-full text-gray-300">
                {trade.marketType || 'spot'}
                {trade.marginType && ` (${trade.marginType})`}
              </span>

              {trade.leverage && (
                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                  {trade.leverage}x
                </span>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div>
            <span className={`px-2 py-1 rounded-full text-xs ${
              trade.status === 'open' ? 'bg-green-500/20 text-green-400' :
              trade.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
              trade.status === 'closed' ? 'bg-blue-500/20 text-blue-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {trade.status}
            </span>
          </div>
        </div>

        {/* Trade Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <div className="text-xs text-gray-400 mb-1">Amount</div>
            <div className="text-sm text-white">
              {trade.amount !== undefined ? trade.amount.toFixed(6) : '-'}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-1">Entry Price</div>
            <div className="text-sm text-white">
              {trade.entryPrice !== undefined ? `$${trade.entryPrice.toFixed(2)}` : '-'}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-1">
              {isOpen ? 'Current Price' : 'Exit Price'}
            </div>
            <div className="flex items-center gap-1">
              {isOpen ? (
                <>
                  <span className="text-sm text-white">
                    {currentPrice !== null ? `$${currentPrice.toFixed(2)}` : '-'}
                  </span>
                  <button
                    onClick={handleRefreshPrice}
                    disabled={isLoading}
                    className="text-gray-400 hover:text-neon-turquoise"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </>
              ) : (
                <span className="text-sm text-white">
                  {trade.exitPrice !== undefined ? `$${trade.exitPrice.toFixed(2)}` : '-'}
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-1">Trade Value</div>
            <div className="text-sm text-white">
              {trade.amount !== undefined && trade.entryPrice !== undefined
                ? `$${(trade.amount * trade.entryPrice).toFixed(2)}`
                : '-'}
            </div>
          </div>
        </div>

        {/* Profit/Loss and Risk Parameters */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-xs text-gray-400 mb-1">Profit/Loss</div>
            {pnl.percent !== null ? (
              <div className="flex flex-col">
                <span className={`text-sm font-medium ${isProfitable ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-gray-400'}`}>
                  {isProfitable ? '+' : ''}{pnl.percent.toFixed(2)}%
                </span>
                {pnl.value !== null && (
                  <span className={`text-xs ${isProfitable ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-gray-400'}`}>
                    {isProfitable ? '+' : ''}${pnl.value.toFixed(2)} USDT
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-gray-400">-</span>
            )}
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-1">Risk Parameters</div>
            <div className="flex flex-col gap-1 text-xs">
              {trade.stopLoss && (
                <span className="text-red-400">
                  SL: ${trade.stopLoss.toFixed(2)}
                </span>
              )}
              {trade.takeProfit && (
                <span className="text-green-400">
                  TP: ${trade.takeProfit.toFixed(2)}
                </span>
              )}
              {trade.trailingStop && (
                <span className="text-blue-400">
                  TS: {trade.trailingStop}%
                </span>
              )}
              {!trade.stopLoss && !trade.takeProfit && !trade.trailingStop && (
                <span className="text-gray-400">None set</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between mt-3 pt-3 border-t border-gunmetal-800">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <span>
              {new Date(trade.created_at).toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isOpen && (
              <button
                onClick={handleCloseTrade}
                disabled={isClosing}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-neon-turquoise text-gunmetal-950 rounded-md hover:bg-neon-yellow transition-colors"
              >
                {isClosing ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle className="w-3 h-3" />
                )}
                Close Trade
              </button>
            )}

            {isOpen && onEditTrade && (
              <button
                onClick={() => onEditTrade(trade)}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-gunmetal-700 text-gray-300 rounded-md hover:bg-gunmetal-600 transition-colors"
              >
                <Edit className="w-3 h-3" />
                Edit
              </button>
            )}

            {onViewDetails && (
              <button
                onClick={() => onViewDetails(trade)}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-gunmetal-700 text-gray-300 rounded-md hover:bg-gunmetal-600 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Details
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-3 pt-3 border-t border-red-500/20 text-red-400 text-xs flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
