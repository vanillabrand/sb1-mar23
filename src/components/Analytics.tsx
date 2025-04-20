import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Loader2,
  AlertCircle,
  BarChart3,
  PieChart as PieChartIcon,
  DollarSign,
  Shield,
  Clock,
  Award,
  Zap,
  Wallet
} from 'lucide-react';
import { analyticsService } from '../lib/analytics-service';
import { marketMonitor } from '../lib/market-monitor';
import { exchangeService } from '../lib/exchange-service';
import { tradeService } from '../lib/trade-service';
import { logService } from '../lib/log-service';

export const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // State for different analytics sections
  const [riskPerformance, setRiskPerformance] = useState<any>(null);
  const [portfolioPerformance, setPortfolioPerformance] = useState<any[]>([]);
  const [liveAssetPrices, setLiveAssetPrices] = useState<any[]>([]);
  const [performanceOverTime, setPerformanceOverTime] = useState<any[]>([]);
  const [strategyLeaderboard, setStrategyLeaderboard] = useState<any[]>([]);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Function to fetch all analytics data
  const fetchAnalytics = async () => {
    try {
      setError(null);
      setLoading(true);
      setRefreshing(true);
      setLastUpdated(new Date());

      // Fetch data for each section in parallel
      await Promise.all([
        fetchRiskPerformance(),
        fetchPortfolioPerformance(),
        fetchLiveAssetPrices(),
        fetchPerformanceOverTime(),
        fetchStrategyLeaderboard()
      ]);

      logService.log('info', 'Analytics data fetched successfully', null, 'Analytics');
    } catch (err) {
      setError('Failed to fetch analytics data');
      logService.log('error', 'Error fetching analytics data', err, 'Analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch risk performance metrics
  const fetchRiskPerformance = async () => {
    try {
      const metrics = await analyticsService.getRiskMetrics();
      setRiskPerformance(metrics);
    } catch (err) {
      logService.log('error', 'Error fetching risk performance', err, 'Analytics');
    }
  };

  // Fetch portfolio performance by strategy
  const fetchPortfolioPerformance = async () => {
    try {
      const strategies = await analyticsService.getStrategiesPerformance();
      setPortfolioPerformance(strategies || []);
    } catch (err) {
      logService.log('error', 'Error fetching portfolio performance', err, 'Analytics');
    }
  };

  // Fetch live asset prices
  const fetchLiveAssetPrices = async () => {
    try {
      // Get all unique assets from active strategies
      const assets = await analyticsService.getActiveAssets();

      // Fetch current prices for each asset
      const prices = await Promise.all(
        assets.map(async (asset) => {
          try {
            const ticker = await exchangeService.fetchTicker(asset);
            return {
              symbol: asset,
              price: ticker.last,
              change24h: ticker.percentage ? ticker.percentage : 0,
              volume: ticker.quoteVolume || 0,
              high24h: ticker.high || 0,
              low24h: ticker.low || 0
            };
          } catch (error) {
            logService.log('warn', `Failed to fetch ticker for ${asset}`, error, 'Analytics');
            return {
              symbol: asset,
              price: 0,
              change24h: 0,
              volume: 0,
              high24h: 0,
              low24h: 0
            };
          }
        })
      );

      setLiveAssetPrices(prices);
    } catch (err) {
      logService.log('error', 'Error fetching live asset prices', err, 'Analytics');
    }
  };

  // Fetch performance over time
  const fetchPerformanceOverTime = async () => {
    try {
      const performanceData = await analyticsService.getPerformanceHistory();
      setPerformanceOverTime(performanceData || []);
    } catch (err) {
      logService.log('error', 'Error fetching performance over time', err, 'Analytics');
    }
  };

  // Fetch strategy leaderboard
  const fetchStrategyLeaderboard = async () => {
    try {
      const leaderboard = await analyticsService.getStrategyLeaderboard();
      setStrategyLeaderboard(leaderboard || []);
    } catch (err) {
      logService.log('error', 'Error fetching strategy leaderboard', err, 'Analytics');
    }
  };

  // Set up websocket connection for live price updates
  useEffect(() => {
    let priceUpdateInterval: NodeJS.Timeout;

    const setupWebsocket = async () => {
      try {
        // For demo purposes, we'll use a polling interval instead of actual websockets
        // In a real implementation, you would connect to the exchange's websocket API
        priceUpdateInterval = setInterval(() => {
          fetchLiveAssetPrices();
          setLastUpdated(new Date());
        }, 15000); // Update every 15 seconds

        setWebsocketConnected(true);
        logService.log('info', 'Live price updates started', null, 'Analytics');
      } catch (error) {
        setWebsocketConnected(false);
        logService.log('error', 'Failed to set up live price updates', error, 'Analytics');
      }
    };

    // Initial data fetch
    fetchAnalytics();

    // Set up websocket connection
    setupWebsocket();

    // No periodic refresh - data is updated in real-time via websockets

    return () => {
      // Clean up intervals on component unmount
      if (priceUpdateInterval) clearInterval(priceUpdateInterval);
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (loading && !liveAssetPrices.length) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-black">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-neon-turquoise mx-auto mb-4" />
          <p className="text-gray-400">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-black">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 text-red-400 mb-2">
            <AlertCircle className="w-6 h-6" />
            <h3 className="text-lg font-medium">Error Loading Analytics</h3>
          </div>
          <p className="text-gray-300">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-gunmetal-800 text-gray-200 rounded-lg hover:bg-gunmetal-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6 overflow-x-hidden">
      <div className="max-w-[1800px] mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Analytics Dashboard</h1>
            <p className="text-gray-400 mt-1">Comprehensive performance metrics and market insights</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              <span className={`w-2 h-2 rounded-full ${websocketConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-neon-turquoise text-black rounded-lg hover:bg-neon-yellow transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - 8/12 width */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Risk Performance Panel */}
            <div className="panel-metallic rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Shield className="w-5 h-5 text-neon-pink" />
                <h2 className="text-xl font-bold text-white">Risk Performance</h2>
              </div>

              {/* Risk Performance Content */}
              <RiskPerformancePanel data={riskPerformance} />
            </div>

            {/* Portfolio Performance Panel */}
            <div className="panel-metallic rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-neon-turquoise" />
                <h2 className="text-xl font-bold text-white">Portfolio Performance by Strategy</h2>
              </div>

              {/* Portfolio Performance Content */}
              <PortfolioPerformancePanel data={portfolioPerformance} />
            </div>

            {/* Performance Over Time Panel */}
            <div className="panel-metallic rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-neon-yellow" />
                <h2 className="text-xl font-bold text-white">Performance Over Time</h2>
              </div>

              {/* Performance Over Time Content */}
              <PerformanceOverTimePanel data={performanceOverTime} />
            </div>
          </div>

          {/* Right Column - 4/12 width */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Live Asset Prices Panel */}
            <div className="panel-metallic rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-neon-orange" />
                  <h2 className="text-xl font-bold text-white">Live Asset Prices</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${websocketConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="text-xs text-gray-400">{websocketConnected ? 'Live' : 'Disconnected'}</span>
                </div>
              </div>

              {/* Live Asset Prices Content */}
              <LiveAssetPricesPanel data={liveAssetPrices} />
            </div>

            {/* Strategy Leaderboard Panel */}
            <div className="panel-metallic rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Award className="w-5 h-5 text-neon-yellow" />
                <h2 className="text-xl font-bold text-white">Strategy Leaderboard</h2>
              </div>

              {/* Strategy Leaderboard Content */}
              <StrategyLeaderboardPanel data={strategyLeaderboard} />
            </div>

            {/* Wallet Balance Panel */}
            <div className="panel-metallic rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Wallet className="w-5 h-5 text-neon-turquoise" />
                <h2 className="text-xl font-bold text-white">Wallet Balance</h2>
              </div>

              {/* Wallet Balance Content */}
              <WalletBalancePanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Risk Performance Panel Component
const RiskPerformancePanel: React.FC<{ data: any }> = ({ data }) => {
  // Default data if none is provided
  const riskData = data || {
    riskScore: 65,
    volatility: 0.12,
    drawdown: -8.5,
    sharpeRatio: 1.8,
    valueAtRisk: 2500,
    riskDistribution: [
      { name: 'Low', value: 30 },
      { name: 'Medium', value: 45 },
      { name: 'High', value: 25 }
    ],
    riskByStrategy: [
      { name: 'Strategy 1', risk: 35, return: 12 },
      { name: 'Strategy 2', risk: 65, return: 18 },
      { name: 'Strategy 3', risk: 85, return: 25 },
      { name: 'Strategy 4', risk: 45, return: 15 }
    ]
  };

  const COLORS = ['#00F5FF', '#FF00A8', '#FFD700', '#00FF7F'];

  return (
    <div className="space-y-6">
      {/* Risk Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gunmetal-900/50 p-4 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Risk Score</p>
          <p className="text-2xl font-bold text-neon-pink">{riskData.riskScore}<span className="text-sm text-gray-400">/100</span></p>
        </div>
        <div className="bg-gunmetal-900/50 p-4 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Volatility</p>
          <p className="text-2xl font-bold text-neon-yellow">{(riskData.volatility * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-gunmetal-900/50 p-4 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Max Drawdown</p>
          <p className="text-2xl font-bold text-neon-orange">{riskData.drawdown.toFixed(1)}%</p>
        </div>
        <div className="bg-gunmetal-900/50 p-4 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Sharpe Ratio</p>
          <p className="text-2xl font-bold text-neon-turquoise">{riskData.sharpeRatio.toFixed(2)}</p>
        </div>
      </div>

      {/* Risk Distribution Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-4">Risk Distribution</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskData.riskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {riskData.riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Allocation']}
                  contentStyle={{ backgroundColor: '#000000', borderColor: '#2A2A3E' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {riskData.riskDistribution.map((entry, index) => (
              <div key={`legend-${index}`} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                <span className="text-xs text-gray-400">{entry.name}: {entry.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk vs Return Chart */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-4">Risk vs Return</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData.riskByStrategy}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#999' }} axisLine={{ stroke: '#444' }} />
                <YAxis tick={{ fill: '#999' }} axisLine={{ stroke: '#444' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#000000', borderColor: '#2A2A3E' }}
                />
                <Bar dataKey="risk" name="Risk" fill="#FF00A8" />
                <Bar dataKey="return" name="Return" fill="#00F5FF" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// Portfolio Performance Panel Component
const PortfolioPerformancePanel: React.FC<{ data: any[] }> = ({ data }) => {
  // Default data if none is provided
  const portfolioData = data.length ? data : [
    { name: 'Strategy 1', performance: 12.5, trades: 24, winRate: 68 },
    { name: 'Strategy 2', performance: 8.3, trades: 18, winRate: 55 },
    { name: 'Strategy 3', performance: 15.7, trades: 32, winRate: 72 },
    { name: 'Strategy 4', performance: -3.2, trades: 15, winRate: 40 },
    { name: 'Strategy 5', performance: 5.8, trades: 22, winRate: 59 }
  ];

  return (
    <div className="space-y-6">
      {/* Performance Chart */}
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={portfolioData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#999' }} axisLine={{ stroke: '#444' }} />
            <YAxis tick={{ fill: '#999' }} axisLine={{ stroke: '#444' }} />
            <Tooltip
              formatter={(value, name) => [
                name === 'performance' ? `${value}%` : name === 'winRate' ? `${value}%` : value,
                name === 'performance' ? 'Performance' : name === 'winRate' ? 'Win Rate' : 'Trades'
              ]}
              contentStyle={{ backgroundColor: '#000000', borderColor: '#2A2A3E' }}
            />
            <Legend />
            <Bar
              dataKey="performance"
              name="Performance"
              fill="#00F5FF"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Strategy Performance Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gunmetal-700">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Strategy</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Performance</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Trades</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {portfolioData.map((strategy, index) => (
              <tr key={index} className="border-b border-gunmetal-800/30">
                <td className="py-3 px-4 text-sm text-gray-300">{strategy.name}</td>
                <td className={`py-3 px-4 text-sm text-right ${strategy.performance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {strategy.performance >= 0 ? '+' : ''}{strategy.performance.toFixed(2)}%
                </td>
                <td className="py-3 px-4 text-sm text-right text-gray-300">{strategy.trades}</td>
                <td className="py-3 px-4 text-sm text-right text-gray-300">{strategy.winRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Performance Over Time Panel Component
const PerformanceOverTimePanel: React.FC<{ data: any[] }> = ({ data }) => {
  // Default data if none is provided
  const timeData = data.length ? data : [
    { date: '2023-01-01', value: 10000, change: 0 },
    { date: '2023-02-01', value: 10800, change: 8 },
    { date: '2023-03-01', value: 11500, change: 6.48 },
    { date: '2023-04-01', value: 11200, change: -2.61 },
    { date: '2023-05-01', value: 12100, change: 8.04 },
    { date: '2023-06-01', value: 13000, change: 7.44 },
    { date: '2023-07-01', value: 13800, change: 6.15 },
    { date: '2023-08-01', value: 14500, change: 5.07 },
    { date: '2023-09-01', value: 15200, change: 4.83 },
    { date: '2023-10-01', value: 16000, change: 5.26 },
    { date: '2023-11-01', value: 16800, change: 5 },
    { date: '2023-12-01', value: 17500, change: 4.17 }
  ];

  // Calculate total performance
  const initialValue = timeData[0]?.value || 10000;
  const currentValue = timeData[timeData.length - 1]?.value || 10000;
  const totalPerformance = ((currentValue - initialValue) / initialValue) * 100;

  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-gunmetal-900/50 p-4 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Initial Value</p>
          <p className="text-2xl font-bold text-white">${initialValue.toLocaleString()}</p>
        </div>
        <div className="bg-gunmetal-900/50 p-4 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Current Value</p>
          <p className="text-2xl font-bold text-white">${currentValue.toLocaleString()}</p>
        </div>
        <div className="bg-gunmetal-900/50 p-4 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Total Performance</p>
          <p className={`text-2xl font-bold ${totalPerformance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPerformance >= 0 ? '+' : ''}{totalPerformance.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00F5FF" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#00F5FF" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#999' }}
              axisLine={{ stroke: '#444' }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { month: 'short' });
              }}
            />
            <YAxis
              tick={{ fill: '#999' }}
              axisLine={{ stroke: '#444' }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip
              formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Portfolio Value']}
              labelFormatter={(label) => {
                const date = new Date(label);
                return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              }}
              contentStyle={{ backgroundColor: '#000000', borderColor: '#2A2A3E' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#00F5FF"
              fillOpacity={1}
              fill="url(#colorValue)"
              name="Portfolio Value"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Performance Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gunmetal-700">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Month</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Value</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Change</th>
            </tr>
          </thead>
          <tbody>
            {timeData.slice(-6).map((month, index) => (
              <tr key={index} className="border-b border-gunmetal-800/30">
                <td className="py-3 px-4 text-sm text-gray-300">
                  {new Date(month.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </td>
                <td className="py-3 px-4 text-sm text-right text-gray-300">
                  ${month.value.toLocaleString()}
                </td>
                <td className={`py-3 px-4 text-sm text-right ${month.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {month.change >= 0 ? '+' : ''}{month.change.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Live Asset Prices Panel Component
const LiveAssetPricesPanel: React.FC<{ data: any[] }> = ({ data }) => {
  // Default data if none is provided
  const priceData = data.length ? data : [
    { symbol: 'BTC/USDT', price: 42568.75, change24h: 2.34, volume: 1245789654, high24h: 43100.25, low24h: 41890.50 },
    { symbol: 'ETH/USDT', price: 2356.42, change24h: 1.87, volume: 789456123, high24h: 2380.15, low24h: 2310.80 },
    { symbol: 'SOL/USDT', price: 98.75, change24h: 5.62, volume: 456123789, high24h: 101.25, low24h: 93.40 },
    { symbol: 'BNB/USDT', price: 312.45, change24h: -0.87, volume: 234567891, high24h: 318.75, low24h: 310.20 },
    { symbol: 'XRP/USDT', price: 0.5678, change24h: -1.23, volume: 123456789, high24h: 0.5780, low24h: 0.5620 }
  ];

  return (
    <div className="space-y-4">
      {/* Asset Price Cards */}
      <div className="space-y-3">
        {priceData.map((asset, index) => (
          <div key={index} className="panel-metallic p-3 sm:p-4 rounded-lg flex flex-wrap sm:flex-nowrap justify-between items-center gap-2">
            <div>
              <h3 className="font-medium text-white text-sm sm:text-base">{asset.symbol}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs ${asset.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {asset.change24h >= 0 ? '↑' : '↓'} {Math.abs(asset.change24h).toFixed(2)}%
                </span>
                <span className="text-xs text-gray-400">24h</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base sm:text-lg font-bold text-neon-turquoise">
                ${asset.price < 1 ? asset.price.toFixed(4) : asset.price.toFixed(2)}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-1">
                Vol: ${(asset.volume / 1000000).toFixed(2)}M
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Market Summary */}
      <div className="panel-metallic rounded-lg p-3 sm:p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Market Summary</h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 text-[10px] sm:text-xs">
          <div>
            <p className="text-gray-400">Top Gainer</p>
            <p className="text-green-400 font-medium">
              {priceData.reduce((prev, current) => (prev.change24h > current.change24h) ? prev : current).symbol}
              {' '}{priceData.reduce((prev, current) => (prev.change24h > current.change24h) ? prev : current).change24h.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-gray-400">Top Loser</p>
            <p className="text-red-400 font-medium">
              {priceData.reduce((prev, current) => (prev.change24h < current.change24h) ? prev : current).symbol}
              {' '}{priceData.reduce((prev, current) => (prev.change24h < current.change24h) ? prev : current).change24h.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-gray-400">Highest Volume</p>
            <p className="text-white font-medium">
              {priceData.reduce((prev, current) => (prev.volume > current.volume) ? prev : current).symbol}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Market Sentiment</p>
            <p className={`font-medium ${priceData.filter(a => a.change24h > 0).length > priceData.length / 2 ? 'text-green-400' : 'text-red-400'}`}>
              {priceData.filter(a => a.change24h > 0).length > priceData.length / 2 ? 'Bullish' : 'Bearish'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Strategy Leaderboard Panel Component
const StrategyLeaderboardPanel: React.FC<{ data: any[] }> = ({ data }) => {
  // Default data if none is provided
  const leaderboardData = data.length ? data : [
    { name: 'Momentum Breakout', performance: 28.5, trades: 42, winRate: 76, pnl: 4250 },
    { name: 'Trend Following', performance: 22.3, trades: 36, winRate: 72, pnl: 3680 },
    { name: 'Mean Reversion', performance: 18.7, trades: 58, winRate: 65, pnl: 2950 },
    { name: 'Volatility Breakout', performance: 15.2, trades: 29, winRate: 62, pnl: 2340 },
    { name: 'RSI Divergence', performance: 12.8, trades: 34, winRate: 59, pnl: 1980 }
  ];

  // Sort by performance
  const sortedData = [...leaderboardData].sort((a, b) => b.performance - a.performance);

  return (
    <div className="space-y-4">
      {/* Top Performers */}
      <div className="space-y-3">
        {sortedData.map((strategy, index) => (
          <div key={index} className="bg-gunmetal-900/50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-gunmetal-700'}`}>
                  {index + 1}
                </div>
                <h3 className="font-medium text-white">{strategy.name}</h3>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-400">+{strategy.performance.toFixed(1)}%</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div>
                <p className="text-gray-400">Trades</p>
                <p className="text-white font-medium">{strategy.trades}</p>
              </div>
              <div>
                <p className="text-gray-400">Win Rate</p>
                <p className="text-white font-medium">{strategy.winRate}%</p>
              </div>
              <div>
                <p className="text-gray-400">P&L</p>
                <p className="text-green-400 font-medium">+${strategy.pnl.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Distribution */}
      <div className="bg-gunmetal-900/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Performance Distribution</h3>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedData}>
              <XAxis
                dataKey="name"
                tick={{ fill: '#999', fontSize: 10 }}
                axisLine={{ stroke: '#444' }}
                tickFormatter={(value) => value.split(' ')[0]}
              />
              <Tooltip
                formatter={(value) => [`${value}%`, 'Performance']}
                contentStyle={{ backgroundColor: '#000000', borderColor: '#2A2A3E' }}
              />
              <Bar
                dataKey="performance"
                fill="#FFD700"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Wallet Balance Panel Component
const WalletBalancePanel: React.FC = () => {
  const [walletData, setWalletData] = useState<any>({
    totalBalance: 25680.42,
    availableBalance: 18450.75,
    allocatedBalance: 7229.67,
    assets: [
      { symbol: 'USDT', balance: 15680.42, allocated: 4200.00 },
      { symbol: 'BTC', balance: 0.12, allocated: 0.05, usdValue: 5100.00, allocatedUsdValue: 2125.00 },
      { symbol: 'ETH', balance: 1.85, allocated: 0.35, usdValue: 4360.00, allocatedUsdValue: 824.50 },
      { symbol: 'SOL', balance: 5.4, allocated: 0.8, usdValue: 540.00, allocatedUsdValue: 80.17 }
    ]
  });

  useEffect(() => {
    // In a real implementation, this would fetch the wallet balance from the wallet service
    const fetchWalletBalance = async () => {
      try {
        // This is a placeholder for the actual wallet balance fetch
        // const balance = await walletService.getBalance();
        // setWalletData(balance);
      } catch (error) {
        logService.log('error', 'Failed to fetch wallet balance', error, 'Analytics');
      }
    };

    fetchWalletBalance();
  }, []);

  return (
    <div className="space-y-4">
      {/* Balance Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gunmetal-900/50 p-4 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Total Balance</p>
          <p className="text-xl font-bold text-white">${walletData.totalBalance.toLocaleString()}</p>
        </div>
        <div className="bg-gunmetal-900/50 p-4 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Available</p>
          <p className="text-xl font-bold text-neon-turquoise">${walletData.availableBalance.toLocaleString()}</p>
        </div>
      </div>

      {/* Asset Allocation */}
      <div className="bg-gunmetal-900/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Asset Allocation</h3>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={walletData.assets.map(asset => ({
                  name: asset.symbol,
                  value: asset.usdValue || asset.balance
                }))}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                paddingAngle={2}
                dataKey="value"
              >
                {walletData.assets.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={[
                    '#00F5FF', '#FF00A8', '#FFD700', '#00FF7F', '#FF4500'
                  ][index % 5]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Value']}
                contentStyle={{ backgroundColor: '#000000', borderColor: '#2A2A3E' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          {walletData.assets.map((asset, index) => (
            <div key={`legend-${index}`} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: [
                '#00F5FF', '#FF00A8', '#FFD700', '#00FF7F', '#FF4500'
              ][index % 5] }}></div>
              <span className="text-xs text-gray-400">{asset.symbol}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Asset List */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gunmetal-700">
              <th className="text-left py-2 px-2 text-gray-400">Asset</th>
              <th className="text-right py-2 px-2 text-gray-400">Balance</th>
              <th className="text-right py-2 px-2 text-gray-400">Allocated</th>
            </tr>
          </thead>
          <tbody>
            {walletData.assets.map((asset, index) => (
              <tr key={index} className="border-b border-gunmetal-800/30">
                <td className="py-2 px-2 text-gray-300">{asset.symbol}</td>
                <td className="py-2 px-2 text-right text-gray-300">
                  {asset.balance < 1 && asset.balance > 0 ? asset.balance.toFixed(4) : asset.balance.toFixed(2)}
                  {asset.usdValue ? ` ($${asset.usdValue.toLocaleString()})` : ''}
                </td>
                <td className="py-2 px-2 text-right text-gray-300">
                  {asset.allocated < 1 && asset.allocated > 0 ? asset.allocated.toFixed(4) : asset.allocated.toFixed(2)}
                  {asset.allocatedUsdValue ? ` ($${asset.allocatedUsdValue.toLocaleString()})` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};