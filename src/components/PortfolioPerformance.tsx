import { useState, useEffect } from 'react';
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
import { supabase } from '../lib/supabase';
import { transactionService } from '../lib/transaction-service';
import { logService } from '../lib/log-service';
import { globalCacheService } from '../lib/global-cache-service';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  Line,
  ComposedChart,
  Bar,
  Cell,
  PieChart,
  Pie
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
  const [portfolioSummary, setPortfolioSummary] = useState<any>(null);

  useEffect(() => {
    loadPerformanceData();
    loadPortfolioSummary();
  }, [timeframe]);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Handle unauthenticated state gracefully
        setPerformanceData([]);
        setLoading(false);
        return;
      }

      // Use the global cache service to get portfolio data
      const data = await globalCacheService.getPortfolioData(timeframe);

      if (data && Array.isArray(data) && data.length > 0) {
        // Get portfolio summary to extract strategy data
        const summary = await globalCacheService.getPortfolioSummary();

        if (summary && summary.strategies && summary.strategies.length > 0) {
          // Enhance performance data with per-strategy values
          const enhancedData = data.map(dataPoint => {
            const enhancedPoint = { ...dataPoint };

            // For each strategy, add its estimated value at this point
            summary.strategies.forEach(strategy => {
              // Calculate the strategy's value at this point based on its current contribution
              // This is an approximation - in a real system, you'd have actual historical data
              const contribution = strategy.contribution / 100;
              const strategyValue = dataPoint.value * contribution;

              // Add strategy data with a prefix to avoid name collisions
              enhancedPoint[`strategy_${strategy.name}`] = strategyValue;
            });

            return enhancedPoint;
          });

          setPerformanceData(enhancedData);
        } else {
          setPerformanceData(data);
        }
      } else {
        // If no data in cache, generate sample data for demo purposes
        const sampleData = generateSamplePerformanceData(timeframe);
        setPerformanceData(sampleData);
      }

      setLoading(false);
    } catch (error) {
      logService.log('error', 'Failed to load performance data', error, 'PortfolioPerformance');
      setError('Failed to load performance data. Please try again later.');
      setLoading(false);
    }
  };

  const loadPortfolioSummary = async () => {
    try {
      const summary = await globalCacheService.getPortfolioSummary();
      if (summary) {
        setPortfolioSummary(summary);
      } else {
        // Generate sample summary for demo purposes
        const sampleSummary = {
          currentValue: 12450.75,
          startingValue: 10000,
          totalChange: 2450.75,
          percentChange: 24.51,
          totalTrades: 42,
          profitableTrades: 28,
          winRate: 66.67,
          strategies: [
            {
              id: 'strategy-1',
              name: 'Momentum Alpha',
              currentValue: 4357.76,
              startingValue: 3500,
              totalChange: 857.76,
              percentChange: 24.51,
              totalTrades: 18,
              profitableTrades: 12,
              winRate: 66.67,
              contribution: 35
            },
            {
              id: 'strategy-2',
              name: 'Trend Follower',
              currentValue: 3112.69,
              startingValue: 2500,
              totalChange: 612.69,
              percentChange: 24.51,
              totalTrades: 12,
              profitableTrades: 8,
              winRate: 66.67,
              contribution: 25
            },
            {
              id: 'strategy-3',
              name: 'Volatility Edge',
              currentValue: 2490.15,
              startingValue: 2000,
              totalChange: 490.15,
              percentChange: 24.51,
              totalTrades: 8,
              profitableTrades: 5,
              winRate: 62.5,
              contribution: 20
            },
            {
              id: 'strategy-4',
              name: 'Swing Trader',
              currentValue: 1867.61,
              startingValue: 1500,
              totalChange: 367.61,
              percentChange: 24.51,
              totalTrades: 4,
              profitableTrades: 3,
              winRate: 75.0,
              contribution: 15
            },
            {
              id: 'strategy-5',
              name: 'Market Neutral',
              currentValue: 622.54,
              startingValue: 500,
              totalChange: 122.54,
              percentChange: 24.51,
              totalTrades: 0,
              profitableTrades: 0,
              winRate: 0,
              contribution: 5
            }
          ]
        };
        setPortfolioSummary(sampleSummary);
      }
    } catch (error) {
      logService.log('error', 'Failed to load portfolio summary', error, 'PortfolioPerformance');
    }
  };

  // Generate sample performance data for demo purposes
  const generateSamplePerformanceData = (timeframe: string) => {
    const data = [];
    const now = Date.now();
    let interval: number;
    let points: number;

    switch (timeframe) {
      case '1h':
        interval = 5 * 60 * 1000; // 5 minutes
        points = 12;
        break;
      case '1d':
        interval = 60 * 60 * 1000; // 1 hour
        points = 24;
        break;
      case '1w':
        interval = 6 * 60 * 60 * 1000; // 6 hours
        points = 28;
        break;
      case '1m':
        interval = 24 * 60 * 60 * 1000; // 1 day
        points = 30;
        break;
      default:
        interval = 60 * 60 * 1000; // 1 hour
        points = 24;
    }

    // Sample strategies with their contribution percentages
    const sampleStrategies = [
      { name: 'Momentum Alpha', contribution: 35 },
      { name: 'Trend Follower', contribution: 25 },
      { name: 'Volatility Edge', contribution: 20 },
      { name: 'Swing Trader', contribution: 15 },
      { name: 'Market Neutral', contribution: 5 }
    ];

    let value = 10000; // Starting value
    let previousValue = value;

    // Initialize strategy values
    const strategyValues = {};
    sampleStrategies.forEach(strategy => {
      strategyValues[strategy.name] = value * (strategy.contribution / 100);
    });

    for (let i = points; i >= 0; i--) {
      // Add some randomness to the value (trending upward)
      const change = (Math.random() * 200) - 50; // Random change between -50 and +150
      value += change;
      value = Math.max(value, 9000); // Ensure value doesn't go below 9000

      const pointChange = value - previousValue;
      const percentChange = previousValue !== 0 ? (pointChange / previousValue) * 100 : 0;

      // Create data point with total portfolio value
      const dataPoint = {
        date: now - (i * interval),
        value: value,
        change: pointChange,
        percentChange: percentChange
      };

      // Add strategy-specific values with different growth patterns
      sampleStrategies.forEach(strategy => {
        // Each strategy has slightly different performance characteristics
        const strategyChange = change * (1 + (Math.random() * 0.5 - 0.25)); // +/- 25% variance
        const strategyValue = strategyValues[strategy.name] + (strategyChange * (strategy.contribution / 100));
        strategyValues[strategy.name] = Math.max(strategyValue, 0); // Ensure non-negative

        // Add to data point with strategy_ prefix
        dataPoint[`strategy_${strategy.name}`] = strategyValues[strategy.name];
      });

      data.push(dataPoint);
      previousValue = value;
    }

    return data;
  };

  const handleDownloadCSV = async () => {
    try {
      setDownloadingCSV(true);
      setError(null);

      if (!startDate || !endDate) {
        throw new Error('Please select a date range');
      }

      // Convert string dates to Date objects
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Get transactions for selected date range
      const transactions = await transactionService.getTransactionsForUser(start, end);

      if (transactions.length === 0) {
        throw new Error('No transactions found for the selected period');
      }

      // Format transactions for CSV - Include all available fields
      const csvData = transactions.map((tx: any) => ({
        Date: new Date(tx.created_at).toLocaleString(),
        Type: tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
        Amount: tx.amount.toFixed(2),
        'Balance Before': tx.balance_before.toFixed(2),
        'Balance After': tx.balance_after.toFixed(2),
        Status: tx.status.charAt(0).toUpperCase() + tx.status.slice(1),
        Description: tx.description || '',
        'Reference ID': tx.reference_id || '',
        'Reference Type': tx.reference_type || '',
        'Transaction ID': tx.id || '',
        'Created At': tx.created_at || '',
        'Updated At': tx.updated_at || ''
      }));

      // Generate CSV
      const headers = Object.keys(csvData[0]);
      const csv = [
        headers.join(','),
        ...csvData.map((row: Record<string, string>) => headers.map(header => {
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download transactions';
      setError(errorMessage);
      logService.log('error', 'Failed to download CSV', err, 'PortfolioPerformance');
    } finally {
      setDownloadingCSV(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-4 sm:p-6 md:p-8 shadow-lg border border-gunmetal-800/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-neon-raspberry" />
          <h2 className="text-xl font-bold gradient-text">Portfolio Performance</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-0.5 bg-gunmetal-800 rounded-lg p-0.5">
            {(['1h', '1d', '1w', '1m'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-1.5 py-1 rounded text-xs ${
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
        <>
          {/* Portfolio Summary Stats - Consolidated Panel */}
          <div className="bg-gunmetal-900/50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gunmetal-800/50 rounded-lg p-3 border border-gunmetal-700/50">
              <p className="text-gray-400 text-xs leading-tight mb-1 whitespace-normal">Current Value</p>
              <p className="text-xl md:text-2xl font-bold text-white truncate">
                ${portfolioSummary?.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="bg-gunmetal-800/50 rounded-lg p-3 border border-gunmetal-700/50">
              <p className="text-gray-400 text-xs leading-tight mb-1 whitespace-normal">Profit/Loss</p>
              <div className="flex items-baseline">
                <p className={`text-xl md:text-2xl font-bold truncate ${(portfolioSummary?.totalChange || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(portfolioSummary?.totalChange || 0) >= 0 ? '+' : ''}
                  ${Math.abs(portfolioSummary?.totalChange || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-xs ml-1 flex-shrink-0">({(portfolioSummary?.percentChange || 0).toFixed(1)}%)</span>
              </div>
            </div>
            <div className="bg-gunmetal-800/50 rounded-lg p-3 border border-gunmetal-700/50">
              <p className="text-gray-400 text-xs leading-tight mb-1 whitespace-normal">Total Trades</p>
              <p className="text-xl md:text-2xl font-bold text-white">
                {portfolioSummary?.totalTrades || 0}
              </p>
            </div>
            <div className="bg-gunmetal-800/50 rounded-lg p-3 border border-gunmetal-700/50">
              <p className="text-gray-400 text-xs leading-tight mb-1 whitespace-normal">Win Rate</p>
              <p className="text-xl md:text-2xl font-bold text-white">
                {(portfolioSummary?.winRate || 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

          {/* Performance Chart - Smaller Size */}
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={performanceData}>
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
                  formatter={(value: number, name: string) => {
                    // Format based on the data key
                    if (name === 'value') return [`$${value.toLocaleString()}`, 'Total Value'];
                    // For strategy-specific lines
                    if (name.startsWith('strategy_')) {
                      const strategyName = name.replace('strategy_', '');
                      return [`$${value.toLocaleString()}`, strategyName];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value) => {
                    if (value === 'value') return 'Total Portfolio';
                    if (value.startsWith('strategy_')) {
                      return value.replace('strategy_', '');
                    }
                    return value;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Portfolio Value"
                  stroke="#2dd4bf"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Strategy Breakdown */}
          {portfolioSummary?.strategies && portfolioSummary.strategies.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-white mb-4">Strategy Breakdown</h3>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Strategy Contribution Pie Chart */}
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={portfolioSummary.strategies.map((strategy: any) => ({
                          name: strategy.name,
                          value: strategy.contribution
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      >
                        {portfolioSummary.strategies.map((entry: any, index: number) => {
                          const colors = ['#2dd4bf', '#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(1)}%`, 'Contribution']}
                        contentStyle={{
                          backgroundColor: 'rgba(17, 24, 39, 0.8)',
                          border: '1px solid rgba(75, 85, 99, 0.4)',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Strategy Performance Table */}
                <div className="lg:col-span-2 table-container">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-400 uppercase bg-gunmetal-800/50">
                      <tr>
                        <th className="px-4 py-3">Strategy</th>
                        <th className="px-4 py-3">Current Value</th>
                        <th className="px-4 py-3">P/L</th>
                        <th className="px-4 py-3">Win Rate</th>
                        <th className="px-4 py-3">Trades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioSummary.strategies.map((strategy: any) => (
                        <tr key={strategy.id} className="border-b border-gunmetal-800/50 hover:bg-gunmetal-800/30">
                          <td className="px-4 py-3 font-medium text-white">{strategy.name}</td>
                          <td className="px-4 py-3">${strategy.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3">
                            <span className={strategy.totalChange >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {strategy.totalChange >= 0 ? '+' : ''}
                              ${Math.abs(strategy.totalChange).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              <span className="text-xs ml-1">({strategy.percentChange.toFixed(1)}%)</span>
                            </span>
                          </td>
                          <td className="px-4 py-3">{strategy.winRate.toFixed(1)}%</td>
                          <td className="px-4 py-3">{strategy.totalTrades}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
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
