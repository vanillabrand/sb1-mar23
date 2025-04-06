import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Trade } from '../lib/types';
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

  const totalPages = Math.ceil(trades.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedTrades = trades.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-4">
      <div className="bg-gunmetal-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gunmetal-900">
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Symbol</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Side</th>
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
                  {trade.entryPrice !== undefined ? `$${trade.entryPrice.toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-white">
                  {trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {trade.profit !== undefined ? (
                    <span className={`${
                      trade.profit > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
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