import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Calendar, 
  Download, 
  Filter, 
  Loader2, 
  AlertCircle, 
  X, 
  ChevronDown 
} from 'lucide-react';
import { transactionService } from '../lib/transaction-service';
import { logService } from '../lib/log-service';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

export function PortfolioPerformance() {
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'1h' | '1d' | '1w' | '1m'>('1d');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [downloadingCSV, setDownloadingCSV] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transactionType, setTransactionType] = useState<'all' | 'trade' | 'deposit' | 'withdrawal'>('all');

  useEffect(() => {
    loadPerformanceData();
  }, [timeframe]);

  const loadPerformanceData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Handle unauthenticated state gracefully
        setPerformanceData(null);
        return;
      }
      
      const transactions = await transactionService.getTransactionsForUser();
      // Process transactions...
    } catch (error) {
      logService.log('error', 'Failed to load performance data', error, 'PortfolioPerformance');
      // Handle error state
    }
  };

  const handleDownloadCSV = async () => {
    try {
      setDownloadingCSV(true);
      setError(null);
      
      if (!startDate || !endDate) {
        throw new Error('Please select a date range');
      }

      // Get transactions for selected date range
      const transactions = await transactionService.getTransactionsForUser(
        new Date(startDate).getTime(),
        new Date(endDate).getTime(),
        transactionType
      );

      if (transactions.length === 0) {
        throw new Error('No transactions found for the selected period');
      }

      // Format transactions for CSV
      const csvData = transactions.map(tx => ({
        Date: new Date(tx.created_at).toLocaleString(),
        Type: tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
        Amount: tx.amount.toFixed(2),
        'Balance Before': tx.balance_before.toFixed(2),
        'Balance After': tx.balance_after.toFixed(2),
        Status: tx.status.charAt(0).toUpperCase() + tx.status.slice(1),
        Description: tx.description || ''
      }));

      // Generate CSV
      const headers = Object.keys(csvData[0]);
      const csv = [
        headers.join(','),
        ...csvData.map(row => headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in values
          return /[,"]/.test(value) 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(','))
      ].join('\n');

      // Download file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions_${startDate}_${endDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setShowTransactionModal(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to download transactions');
      logService.log('error', 'Error downloading transactions:', error, 'PortfolioPerformance');
    } finally {
      setDownloadingCSV(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-8 shadow-lg border border-gunmetal-800/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-neon-raspberry" />
          <h2 className="text-xl font-bold gradient-text">Portfolio Performance</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 bg-gunmetal-800 rounded-lg p-1">
            {(['1h', '1d', '1w', '1m'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded text-sm ${
                  timeframe === tf
                    ? 'bg-neon-raspberry text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="bg-neon-pink/10 border border-neon-pink/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-neon-pink" />
          <p className="text-neon-pink">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
        </div>
      ) : performanceData.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-300 text-lg mb-2">No Performance Data</p>
          <p className="text-gray-400">Start trading to see your portfolio performance</p>
        </div>
      ) : (
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={performanceData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#6B7280"
                tick={{ fill: '#9CA3AF' }}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis 
                stroke="#6B7280"
                tick={{ fill: '#9CA3AF' }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(17, 24, 39, 0.8)',
                  border: '1px solid rgba(75, 85, 99, 0.4)',
                  borderRadius: '8px',
                  backdropFilter: 'blur(4px)',
                }}
                labelStyle={{ color: '#9CA3AF' }}
                itemStyle={{ color: '#2dd4bf' }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#2dd4bf"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Export Button - Moved to bottom left */}
      <div className="mt-6">
        <button
          onClick={() => setShowTransactionModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gunmetal-800 text-gray-200 rounded-lg hover:text-neon-turquoise transition-colors"
        >
          <Download className="w-4 h-4" />
          Export Transactions
        </button>
      </div>

      {/* Transaction Export Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-gunmetal-800"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold gradient-text">Export Transactions</h3>
              <button
                onClick={() => setShowTransactionModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Start Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  End Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Transaction Type
                </label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value as typeof transactionType)}
                    className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent appearance-none"
                  >
                    <option value="all">All Transactions</option>
                    <option value="trade">Trades Only</option>
                    <option value="deposit">Deposits Only</option>
                    <option value="withdrawal">Withdrawals Only</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowTransactionModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownloadCSV}
                  disabled={downloadingCSV || !startDate || !endDate}
                  className="flex items-center gap-2 px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300 disabled:opacity-50"
                >
                  {downloadingCSV ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download CSV
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
