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
      const metrics = analyticsService.getRiskMetrics();
      setRiskPerformance(metrics);
    } catch (err) {
      logService.log('error', 'Error fetching risk performance', err, 'Analytics');
    }
  };

  // Fetch portfolio performance by strategy
  const fetchPortfolioPerformance = async () => {
    try {
      const strategies = analyticsService.getStrategiesPerformance();
      setPortfolioPerformance(strategies || []);
    } catch (err) {
      logService.log('error', 'Error fetching portfolio performance', err, 'Analytics');
    }
  };

  // Fetch live asset prices
  const fetchLiveAssetPrices = async () => {
    try {
      // Get all unique assets from active strategies
      const assets = analyticsService.getActiveAssets();

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
      const performanceData = analyticsService.getPerformanceHistory();
      setPerformanceOverTime(performanceData || []);
    } catch (err) {
      logService.log('error', 'Error fetching performance over time', err, 'Analytics');
    }
  };

  // Fetch strategy leaderboard
  const fetchStrategyLeaderboard = async () => {
    try {
      const leaderboard = analyticsService.getStrategyLeaderboard();
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

    // Set up refresh interval for other analytics data
    const analyticsRefreshInterval = setInterval(() => {
      Promise.all([
        fetchRiskPerformance(),
        fetchPortfolioPerformance(),
        fetchPerformanceOverTime(),
        fetchStrategyLeaderboard()
      ]);
      setLastUpdated(new Date());
    }, 60000); // Refresh other analytics every minute

    return () => {
      // Clean up intervals on component unmount
      if (priceUpdateInterval) clearInterval(priceUpdateInterval);
      if (analyticsRefreshInterval) clearInterval(analyticsRefreshInterval);
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
            <div className="bg-black rounded-xl p-6 border border-gunmetal-800/50 shadow-lg">
              <div className="flex items-center gap-2 mb-6">
                <Shield className="w-5 h-5 text-neon-pink" />
                <h2 className="text-xl font-bold text-white">Risk Performance</h2>
              </div>

              {/* Risk Performance Content */}
              <RiskPerformancePanel data={riskPerformance} />
            </div>

            {/* Portfolio Performance Panel */}
            <div className="bg-black rounded-xl p-6 border border-gunmetal-800/50 shadow-lg">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-neon-turquoise" />
                <h2 className="text-xl font-bold text-white">Portfolio Performance by Strategy</h2>
              </div>

              {/* Portfolio Performance Content */}
              <PortfolioPerformancePanel data={portfolioPerformance} />
            </div>

            {/* Performance Over Time Panel */}
            <div className="bg-black rounded-xl p-6 border border-gunmetal-800/50 shadow-lg">
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
            <div className="bg-black rounded-xl p-6 border border-gunmetal-800/50 shadow-lg">
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
            <div className="bg-black rounded-xl p-6 border border-gunmetal-800/50 shadow-lg">
              <div className="flex items-center gap-2 mb-6">
                <Award className="w-5 h-5 text-neon-yellow" />
                <h2 className="text-xl font-bold text-white">Strategy Leaderboard</h2>
              </div>

              {/* Strategy Leaderboard Content */}
              <StrategyLeaderboardPanel data={strategyLeaderboard} />
            </div>

            {/* Wallet Balance Panel */}
            <div className="bg-black rounded-xl p-6 border border-gunmetal-800/50 shadow-lg">
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
                  contentStyle={{ backgroundColor: '#1A1A2E', borderColor: '#2A2A3E' }}
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
                  contentStyle={{ backgroundColor: '#1A1A2E', borderColor: '#2A2A3E' }}
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