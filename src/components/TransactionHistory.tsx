import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Download, 
  Filter, 
  Loader2, 
  AlertCircle,
  Calendar,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { transactionService } from '../lib/transaction-service';
import { Pagination } from './ui/Pagination';

interface Transaction {
  id: string;
  type: 'trade' | 'deposit' | 'withdrawal';
  amount: number;
  balance_before: number;
  balance_after: number;
  description?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  reference_id?: string;
  reference_type?: 'strategy' | 'trade';
  metadata?: Record<string, any>;
}

interface TransactionHistoryProps {
  className?: string;
  limit?: number;
}

export function TransactionHistory({ className = '', limit }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactionType, setTransactionType] = useState<'all' | 'trade' | 'deposit' | 'withdrawal'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [downloadingCSV, setDownloadingCSV] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [paginatedTransactions, setPaginatedTransactions] = useState<Transaction[]>([]);

  // Fetch transactions on component mount
  useEffect(() => {
    fetchTransactions();
  }, []);

  // Update filtered transactions when filters change
  useEffect(() => {
    filterTransactions();
  }, [transactions, transactionType, startDate, endDate]);

  // Update paginated transactions when page or items per page changes
  useEffect(() => {
    updatePaginatedTransactions();
  }, [filteredTransactions, currentPage, itemsPerPage]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate default date range (last 30 days)
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);

      // Set default date inputs
      setStartDate(format(start, 'yyyy-MM-dd'));
      setEndDate(format(end, 'yyyy-MM-dd'));

      // Fetch transactions from service
      const fetchedTransactions = await transactionService.getTransactionsForUser(start, end);
      setTransactions(fetchedTransactions);
      setFilteredTransactions(fetchedTransactions);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  const filterTransactions = () => {
    let filtered = [...transactions];

    // Filter by transaction type
    if (transactionType !== 'all') {
      filtered = filtered.filter(t => t.type === transactionType);
    }

    // Filter by date range
    if (startDate) {
      const startDateTime = new Date(startDate);
      filtered = filtered.filter(t => new Date(t.created_at) >= startDateTime);
    }

    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(t => new Date(t.created_at) <= endDateTime);
    }

    setFilteredTransactions(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const updatePaginatedTransactions = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    // If limit is provided, only show that many transactions
    const limitedTransactions = limit 
      ? filteredTransactions.slice(0, limit) 
      : filteredTransactions;
      
    setPaginatedTransactions(limitedTransactions.slice(startIndex, endIndex));
  };

  const downloadCSV = async () => {
    try {
      setDownloadingCSV(true);
      
      // Create CSV content
      const headers = ['Date', 'Type', 'Amount', 'Balance Before', 'Balance After', 'Status', 'Description'];
      const csvContent = [
        headers.join(','),
        ...filteredTransactions.map(t => [
          format(new Date(t.created_at), 'yyyy-MM-dd HH:mm:ss'),
          t.type,
          t.amount,
          t.balance_before,
          t.balance_after,
          t.status,
          t.description || ''
        ].join(','))
      ].join('\n');
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `transaction_history_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading CSV:', err);
      setError('Failed to download transaction history');
    } finally {
      setDownloadingCSV(false);
    }
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'deposit':
        return <ArrowUpRight className="w-4 h-4 text-green-400" />;
      case 'withdrawal':
        return <ArrowDownRight className="w-4 h-4 text-red-400" />;
      case 'trade':
        return <ArrowUpRight className="w-4 h-4 text-neon-turquoise" />;
      default:
        return null;
    }
  };

  const getAmountColor = (type: Transaction['type'], amount: number) => {
    if (type === 'deposit' || (type === 'trade' && amount > 0)) {
      return 'text-green-400';
    } else if (type === 'withdrawal' || (type === 'trade' && amount < 0)) {
      return 'text-red-400';
    }
    return 'text-gray-200';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold text-gray-200">Transaction History</h2>
        
        <div className="flex flex-wrap gap-2">
          {/* Filter controls */}
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-neon-turquoise"
              />
            </div>
            
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-neon-turquoise"
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as any)}
                className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-neon-turquoise appearance-none"
              >
                <option value="all">All Types</option>
                <option value="trade">Trades</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
              </select>
            </div>
          </div>
          
          {/* Download button */}
          <button
            onClick={downloadCSV}
            disabled={downloadingCSV || loading || filteredTransactions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gunmetal-800 text-gray-200 rounded-lg hover:bg-gunmetal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloadingCSV ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export CSV
          </button>
        </div>
      </div>
      
      {/* Transaction list */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-gunmetal-800/50 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-neon-raspberry mx-auto mb-4" />
          <p className="text-gray-300 mb-2">Failed to load transactions</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button
            onClick={fetchTransactions}
            className="px-4 py-2 bg-gunmetal-800 text-white rounded-lg hover:bg-gunmetal-700 transition-all"
          >
            Try Again
          </button>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-gunmetal-800/50 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-300 mb-2">No transactions found</p>
          <p className="text-gray-400 text-sm">Try adjusting your filters or date range</p>
        </div>
      ) : (
        <>
          <div className="bg-gunmetal-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gunmetal-900">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Balance</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="sync">
                  {paginatedTransactions.map((transaction) => (
                    <motion.tr
                      key={transaction.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="border-t border-gunmetal-700 hover:bg-gunmetal-700/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(transaction.type)}
                          <span className="capitalize">{transaction.type}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-sm font-mono font-medium ${getAmountColor(transaction.type, transaction.amount)}`}>
                        {transaction.amount > 0 ? '+' : ''}{transaction.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {transaction.balance_after.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">
                        {transaction.description || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          transaction.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          transaction.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {transaction.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {!limit && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredTransactions.length / itemsPerPage)}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={filteredTransactions.length}
              showPageNumbers={true}
              showItemsPerPage={true}
              itemsPerPageOptions={[10, 25, 50]}
              onItemsPerPageChange={(newItemsPerPage) => {
                setItemsPerPage(newItemsPerPage);
                setCurrentPage(1); // Reset to first page when changing items per page
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
