import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Trade } from '../lib/types';

interface TradeListProps {
  trades: Trade[];
  currentPage: number;
  onPageChange: (page: number) => void;
}

const ITEMS_PER_PAGE = 10;

export const TradeList: React.FC<TradeListProps> = ({ trades, currentPage, onPageChange }) => {
  const totalPages = Math.ceil(trades.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const displayedTrades = trades.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="bg-gunmetal-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gunmetal-900">
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Pair</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Entry</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Exit</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Profit</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {displayedTrades.map((trade) => (
              <motion.tr
                key={trade.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-t border-gunmetal-700"
              >
                <td className="px-4 py-3 text-sm text-white">{trade.pair}</td>
                <td className="px-4 py-3 text-sm text-white">
                  <span className={`flex items-center gap-1 ${
                    trade.type === 'buy' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {trade.type === 'buy' ? 
                      <ArrowUpRight className="w-4 h-4" /> : 
                      <ArrowDownRight className="w-4 h-4" />
                    }
                    {trade.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-white">${trade.entryPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-white">
                  {trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`${
                    trade.profit > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    trade.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    trade.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {trade.status}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-4">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gunmetal-800 rounded-lg text-white disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-gray-400">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages - 1}
            className="flex items-center gap-2 px-4 py-2 bg-gunmetal-800 rounded-lg text-white disabled:opacity-50"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};