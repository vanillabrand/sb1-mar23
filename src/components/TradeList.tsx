import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import type { Trade } from '../lib/types';
import { marketDataService } from '../lib/market-data-service';
import { Pagination } from './ui/Pagination';

interface TradeListProps {
  trades: Trade[];
  currentPage?: number;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

export const TradeList: React.FC<TradeListProps> = ({
  trades,
  currentPage: externalCurrentPage,
  onPageChange: externalOnPageChange,
  itemsPerPage: externalItemsPerPage,
  onItemsPerPageChange: externalOnItemsPerPageChange
}) => {
  // Use internal state if no external control is provided
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);
  const [internalItemsPerPage, setInternalItemsPerPage] = useState(10);

  // State to track current market prices and loading state
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState<boolean>(false);

  // Function to get market type color
  const getMarketTypeColor = (marketType?: string): string => {
    switch (marketType) {
      case 'spot':
        return 'text-green-400';
      case 'margin':
        return 'text-yellow-400';
      case 'futures':
        return 'text-pink-400';
      default:
        return 'text-gray-400';
    }
  };

  // Function to calculate unrealized profit/loss
  const calculateUnrealizedPnL = (trade: Trade): { percent: number | null, value: number | null } => {
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
    const currentPrice = marketPrices[trade.symbol];
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

  // Use either external or internal state
  const currentPage = externalCurrentPage !== undefined ? externalCurrentPage : internalCurrentPage;
  const itemsPerPage = externalItemsPerPage !== undefined ? externalItemsPerPage : internalItemsPerPage;

  // Handle page changes
  const handlePageChange = (page: number) => {
    if (externalOnPageChange) {
      externalOnPageChange(page);
    } else {
      setInternalCurrentPage(page);
    }
  };

  // Handle items per page changes
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    if (externalOnItemsPerPageChange) {
      externalOnItemsPerPageChange(newItemsPerPage);
    } else {
      setInternalItemsPerPage(newItemsPerPage);
      // Reset to first page when changing items per page
      if (externalOnPageChange) {
        externalOnPageChange(1);
      } else {
        setInternalCurrentPage(1);
      }
    }
  };

  // Fetch market prices for all trade symbols
  useEffect(() => {
    const fetchMarketPrices = async () => {
      setIsLoadingPrices(true);
      const uniqueSymbols = Array.from(new Set(trades.map(trade => trade.symbol)));
      const prices: Record<string, number> = {};

      for (const symbol of uniqueSymbols) {
        try {
          const marketData = await marketDataService.getMarketData(symbol);
          if (marketData && marketData.ticker && marketData.ticker.last) {
            prices[symbol] = parseFloat(marketData.ticker.last);
          }
        } catch (error) {
          console.error(`Failed to fetch price for ${symbol}:`, error);
        }
      }

      setMarketPrices(prices);
      setIsLoadingPrices(false);
    };

    fetchMarketPrices();

    // Set up an interval to refresh prices every 10 seconds
    const intervalId = setInterval(fetchMarketPrices, 10000);

    return () => clearInterval(intervalId);
  }, [trades]);

  // Function to manually refresh prices
  const refreshPrices = async () => {
    const uniqueSymbols = Array.from(new Set(trades.map(trade => trade.symbol)));
    setIsLoadingPrices(true);
    const prices: Record<string, number> = {};

    for (const symbol of uniqueSymbols) {
      try {
        const marketData = await marketDataService.getMarketData(symbol);
        if (marketData && marketData.ticker && marketData.ticker.last) {
          prices[symbol] = parseFloat(marketData.ticker.last);
        }
      } catch (error) {
        console.error(`Failed to fetch price for ${symbol}:`, error);
      }
    }

    setMarketPrices(prices);
    setIsLoadingPrices(false);
  };

  const totalPages = Math.ceil(trades.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedTrades = trades.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-4">
      <div className="bg-gunmetal-800 rounded-lg table-container">
        <div className="flex justify-end p-2">
          <button
            onClick={refreshPrices}
            disabled={isLoadingPrices}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-gunmetal-700 text-gray-300 rounded-md hover:bg-gunmetal-600 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingPrices ? 'animate-spin' : ''}`} />
            {isLoadingPrices ? 'Updating...' : 'Refresh Prices'}
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gunmetal-900">
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Symbol</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Side</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Entry</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Trade Value</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Exit</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Profit/Loss</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {displayedTrades.map((trade) => (
                <motion.tr
                  key={trade.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  layout
                  layoutId={`trade-${trade.id}`}
                  className="border-t border-gunmetal-700"
                >
                <td className="px-4 py-3 text-sm text-white">{trade.symbol || '-'}</td>
                <td className="px-4 py-3 text-sm text-white">
                  <span className={`flex items-center gap-1 ${
                    trade.side === 'buy' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {trade.side === 'buy' ?
                      <ArrowUpRight className="w-4 h-4" /> :
                      <ArrowDownRight className="w-4 h-4" />
                    }
                    {trade.side || '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-white">
                  {trade.amount !== undefined ? trade.amount.toFixed(6) : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-white">
                  {trade.entryPrice !== undefined ? `$${trade.entryPrice.toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {trade.amount !== undefined && trade.entryPrice !== undefined ? (
                    <div className="flex flex-col">
                      <span className="text-white font-medium">
                        ${(trade.amount * trade.entryPrice).toFixed(2)} USDT
                      </span>
                      <div className="flex flex-col gap-0.5">
                        {trade.leverage && (
                          <span className="text-xs text-blue-400">
                            {trade.leverage}x leverage
                          </span>
                        )}
                        {trade.marketType && (
                          <span className={`text-xs ${getMarketTypeColor(trade.marketType)}`}>
                            {trade.marketType.charAt(0).toUpperCase() + trade.marketType.slice(1)}
                          </span>
                        )}
                        {marketPrices[trade.symbol] && trade.status !== 'closed' && (
                          <span className="text-xs text-gray-400">
                            Current: ${marketPrices[trade.symbol].toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-white">
                  {trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {(() => {
                    const pnl = calculateUnrealizedPnL(trade);

                    if (pnl.percent === null) {
                      return <span className="text-gray-400">-</span>;
                    }

                    const isPositive = pnl.percent > 0;
                    const isNegative = pnl.percent < 0;
                    const colorClass = isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-400';

                    return (
                      <div className="flex flex-col">
                        <span className={`font-medium ${colorClass}`}>
                          {isPositive ? '+' : ''}{pnl.percent.toFixed(2)}%
                        </span>
                        {pnl.value !== null && (
                          <span className={`text-xs ${colorClass}`}>
                            {isPositive ? '+' : ''}
                            ${pnl.value.toFixed(2)} USDT
                          </span>
                        )}
                        {trade.status === 'pending' && (
                          <span className="text-xs text-yellow-400 mt-1">
                            (Unrealized)
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    trade.status === 'executed' ? 'bg-green-500/20 text-green-400' :
                    trade.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    trade.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {trade.status}
                  </span>
                </td>
              </motion.tr>
            ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage + 1} // Convert from 0-indexed to 1-indexed
        totalPages={totalPages}
        onPageChange={(page) => handlePageChange(page - 1)} // Convert from 1-indexed to 0-indexed
        itemsPerPage={itemsPerPage}
        totalItems={trades.length}
        showPageNumbers={true}
        showItemsPerPage={true}
        itemsPerPageOptions={[10, 20, 50]}
        onItemsPerPageChange={handleItemsPerPageChange}
        className="mt-4"
      />
    </div>
  );
};