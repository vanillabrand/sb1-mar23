import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  Shield,
  TrendingDown,
  Gauge,
  BarChart3,
  RefreshCw,
  Loader2,
  Clock,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Hexagon,
  Target,
  Hash,
  Sliders,
  Save,
  X
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Cell,
  Legend
} from 'recharts';
import { useStrategies } from '../hooks/useStrategies';
import { marketService } from '../lib/market-service';
import { analyticsService } from '../lib/analytics-service';
import { bitmartService } from '../lib/bitmart-service';
import { exchangeService } from '../lib/exchange-service';
import { DefconMonitor } from './DefconMonitor';
import { tradeService } from '../lib/trade-service';
import { ccxtService } from '../lib/ccxt-service';
import { logService } from '../lib/log-service';
import type { Strategy } from '../lib/supabase-types';

const RiskManager = () => {
  const { strategies } = useStrategies();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [riskMetrics, setRiskMetrics] = useState<any>({
    portfolioRisk: 0,
    maxDrawdown: 0,
    valueAtRisk: 0,
    totalExposure: 0,
    volatility: 0
  });
  const [drawdownHistory, setDrawdownHistory] = useState<any[]>([]);
  const [assetVolatility, setAssetVolatility] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<'1W' | '1M' | '3M' | '6M'>('1M');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [marketConditions, setMarketConditions] = useState<any>({
    volatilityIndex: 0,
    marketSentiment: 'neutral',
    trendStrength: 0,
    liquidityScore: 0
  });

  const loadRiskData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get active strategies
      const activeStrategies = strategies.filter(s => s.status === 'active');
      
      if (activeStrategies.length === 0) {
        setRiskMetrics(defaultRiskMetrics);
        setDrawdownHistory([]);
        setAssetVolatility([]);
        setLoading(false);
        return;
      }

      // Calculate real-time market conditions
      const marketData = await Promise.all([
        analyticsService.getMarketSentiment(),
        analyticsService.getVolatilityIndex(),
        analyticsService.getLiquidityMetrics(),
        analyticsService.getTrendAnalysis()
      ]);

      setMarketConditions({
        volatilityIndex: marketData[1],
        marketSentiment: marketData[0],
        trendStrength: marketData[3],
        liquidityScore: marketData[2]
      });

      // Enhanced portfolio risk calculation
      const metrics = await calculatePortfolioRisk(activeStrategies);
      setRiskMetrics(metrics);

      // Real-time drawdown tracking
      const drawdown = await generateDrawdownHistory(activeStrategies);
      setDrawdownHistory(drawdown);

      // Asset volatility with enhanced indicators
      const volatility = await calculateAssetVolatility(activeStrategies);
      setAssetVolatility(volatility);

      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      setError('Failed to load risk data');
      logService.log('error', 'Failed to load risk data:', error, 'RiskManager');
      setLoading(false);
    }
  }, [strategies]);

  useEffect(() => {
    loadRiskData();
    
    // More frequent updates for critical metrics
    const fastInterval = setInterval(() => {
      calculateAssetVolatility(strategies.filter(s => s.status === 'active'))
        .then(setAssetVolatility);
    }, 15000); // Every 15 seconds

    // Regular updates for complete risk assessment
    const regularInterval = setInterval(loadRiskData, 60000); // Every minute
    
    return () => {
      clearInterval(fastInterval);
      clearInterval(regularInterval);
    };
  }, [loadRiskData, strategies]);

  const calculatePortfolioRisk = async (strategies: Strategy[]) => {
    try {
      let totalExposure = 0;
      let maxDrawdown = 0;
      let valueAtRisk = 0;
      let volatilitySum = 0;
      let assetCount = 0;

      for (const strategy of strategies) {
        // Get active trades
        const trades = await tradeService.getStrategyTrades(strategy.id);
        const activeTrades = trades.filter(t => t.status === 'open');

        // Calculate exposure
        const exposure = activeTrades.reduce((sum, trade) => 
          sum + (trade.entry_price * trade.amount), 0);
        totalExposure += exposure;

        // Calculate drawdown
        const equity = await analyticsService.getEquityCurve(strategy.id);
        if (equity.length > 0) {
          const peak = Math.max(...equity.map(e => e.value));
          const current = equity[equity.length - 1].value;
          const drawdown = ((peak - current) / peak) * 100;
          maxDrawdown = Math.max(maxDrawdown, drawdown);
        }

        // Calculate VaR using historical simulation
        if (trades.length > 0) {
          const returns = trades.map(t => t.pnl_percent);
          const sortedReturns = returns.sort((a, b) => a - b);
          const varIndex = Math.floor(0.05 * sortedReturns.length);
          const var95 = Math.abs(sortedReturns[varIndex] || 0);
          valueAtRisk += (var95 * exposure) / 100;
        }

        // Calculate volatility for each asset
        if (strategy.strategy_config?.assets) {
          for (const asset of strategy.strategy_config.assets) {
            const ticker = await bitmartService.getTicker(asset);
            const priceChange = parseFloat(ticker.change24h) || 0;
            volatilitySum += Math.abs(priceChange);
            assetCount++;
          }
        }
      }

      // Calculate average volatility
      const avgVolatility = assetCount > 0 ? volatilitySum / assetCount : 0;

      // Calculate portfolio risk score (0-100)
      const exposureScore = Math.min(100, (totalExposure / 100000) * 20);
      const drawdownScore = Math.min(100, maxDrawdown * 5);
      const varScore = Math.min(100, (valueAtRisk / totalExposure) * 100);
      const volatilityScore = Math.min(100, avgVolatility * 10);

      const portfolioRisk = (
        exposureScore * 0.3 +
        drawdownScore * 0.3 +
        varScore * 0.2 +
        volatilityScore * 0.2
      );

      return {
        portfolioRisk,
        maxDrawdown,
        valueAtRisk,
        totalExposure,
        volatility: avgVolatility
      };
    } catch (error) {
      logService.log('error', 'Error calculating portfolio risk:', error, 'RiskManager');
      throw error;
    }
  };

  const generateDrawdownHistory = async (strategies: Strategy[]) => {
    try {
      const now = new Date();
      const data = [];
      
      // Determine timeframe in days
      let days = 30; // Default 1M
      if (timeframe === '1W') days = 7;
      else if (timeframe === '3M') days = 90;
      else if (timeframe === '6M') days = 180;
      
      // Get historical equity data for each strategy
      const equityData = await Promise.all(
        strategies.map(s => analyticsService.getEquityCurve(s.id))
      );

      // Combine and normalize data
      for (let i = days; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        let totalDrawdown = 0;
        let strategyCount = 0;

        equityData.forEach(equity => {
          if (equity.length > 0) {
            const peak = Math.max(...equity.map(e => e.value));
            const current = equity.find(e => 
              new Date(e.date).toDateString() === date.toDateString()
            )?.value || peak;
            
            const drawdown = ((peak - current) / peak) * 100;
            totalDrawdown += drawdown;
            strategyCount++;
          }
        });

        data.push({
          date: date.toLocaleDateString(),
          value: strategyCount > 0 ? -(totalDrawdown / strategyCount) : 0
        });
      }

      return data;
    } catch (error) {
      logService.log('error', 'Error generating drawdown history:', error, 'RiskManager');
      throw error;
    }
  };

  const calculateAssetVolatility = async (strategies: Strategy[]) => {
    try {
      const assets = new Set<string>();
      strategies.forEach(s => {
        if (s.strategy_config?.assets) {
          s.strategy_config.assets.forEach(asset => assets.add(asset));
        }
      });

      const volatilityData = await Promise.all(
        Array.from(assets).map(async (asset) => {
          try {
            // Get real-time data
            const ticker = await bitmartService.getTicker(asset);
            const price = parseFloat(ticker.last_price);
            const priceChange = parseFloat(ticker.change24h) || 0;
            
            // Calculate volatility score (1-10)
            const volatilityScore = Math.min(10, Math.abs(priceChange));

            return {
              asset: asset.replace('_', '/'),
              volatility: volatilityScore,
              price,
              change: priceChange
            };
          } catch (error) {
            logService.log('error', `Error calculating volatility for ${asset}:`, error, 'RiskManager');
            return null;
          }
        })
      );

      return volatilityData.filter(data => data !== null);
    } catch (error) {
      logService.log('error', 'Error calculating asset volatility:', error, 'RiskManager');
      throw error;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRiskData();
    setRefreshing(false);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gunmetal-900/90 p-3 rounded-lg shadow-lg">
          <p className="text-gray-300 text-sm mb-1">{label}</p>
          <p className="text-neon-pink text-sm font-semibold">
            {payload[0].value.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-gunmetal-900/90 p-3 rounded-lg shadow-lg">
          <p className="text-gray-300 text-sm mb-1">{item.asset}</p>
          <p className="text-neon-yellow text-sm font-semibold">
            Volatility: {item.volatility.toFixed(1)}/10
          </p>
          <p className="text-gray-300 text-sm">
            Price: ${item.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </p>
          <p className={`text-sm ${item.change >= 0 ? 'text-neon-orange' : 'text-neon-pink'}`}>
            24h: {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-8 space-y-6">
      {/* Section Description */}
      <div className="bg-gunmetal-800/20 rounded-xl p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Risk Manager</h2>
        <p className="text-sm text-gray-400">
          Monitor and control trading risks across your portfolio. Track exposure, drawdown, and volatility in real-time.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold gradient-text">Risk Manager</h1>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 p-2 bg-gunmetal-800/50 hover:bg-gunmetal-700/50 rounded-lg text-gray-300 hover:text-neon-turquoise transition-all duration-300 disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-neon-pink/10 border border-neon-pink/20 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-neon-pink" />
          <p className="text-neon-pink">{error}</p>
        </div>
      )}

      {/* DEFCON Monitor */}
      <DefconMonitor 
        volatility={riskMetrics.volatility * 10}
        marketConditions={marketConditions}
        className="mb-6"
      />

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gunmetal-800/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400 font-bold">Portfolio Risk Score</p>
            <Gauge className="w-6 h-6 text-neon-yellow" />
          </div>
          <p className="text-3xl font-bold text-neon-yellow">
            {Math.round(riskMetrics.portfolioRisk)}/100
          </p>
        </div>

        <div className="bg-gunmetal-800/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400 font-bold">Max Drawdown</p>
            <TrendingDown className="w-6 h-6 text-neon-pink" />
          </div>
          <p className="text-3xl font-bold text-neon-pink">
            {riskMetrics.maxDrawdown.toFixed(2)}%
          </p>
        </div>

        <div className="bg-gunmetal-800/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400 font-bold">Value at Risk</p>
            <Shield className="w-6 h-6 text-neon-turquoise" />
          </div>
          <p className="text-3xl font-bold text-gray-200">
            ${Math.round(riskMetrics.valueAtRisk).toLocaleString()}
          </p>
        </div>

        <div className="bg-gunmetal-800/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400 font-bold">Total Exposure</p>
            <AlertTriangle className="w-6 h-6 text-neon-orange" />
          </div>
          <p className="text-3xl font-bold text-neon-orange">
            ${Math.round(riskMetrics.totalExposure).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Drawdown History and Asset Volatility */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Drawdown Chart */}
        <div className="bg-gunmetal-800/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-100">Portfolio Drawdown</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setTimeframe('1W');
                  loadRiskData();
                }}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  timeframe === '1W'
                    ? 'bg-neon-pink/20 text-neon-pink' 
                    : 'text-gray-400 hover:text-neon-pink'
                }`}
              >
                1W
              </button>
              <button 
                onClick={() => {
                  setTimeframe('1M');
                  loadRiskData();
                }}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  timeframe === '1M'
                    ? 'bg-neon-pink/20 text-neon-pink' 
                    : 'text-gray-400 hover:text-neon-pink'
                }`}
              >
                1M
              </button>
              <button 
                onClick={() => {
                  setTimeframe('3M');
                  loadRiskData();
                }}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  timeframe === '3M'
                    ? 'bg-neon-pink/20 text-neon-pink' 
                    : 'text-gray-400 hover:text-neon-pink'
                }`}
              >
                3M
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin" />
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={drawdownHistory}>
                  <defs>
                    <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(55, 65, 81, 0.3)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF' }}
                  />
                  <YAxis 
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#ec4899"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorDrawdown)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Asset Volatility Chart */}
        <div className="bg-gunmetal-800/20 rounded-xl p-5">
          <h2 className="text-xl font-semibold text-gray-100 mb-6">Asset Volatility</h2>
          
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin" />
            </div>
          ) : assetVolatility.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={assetVolatility}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(55, 65, 81, 0.3)" />
                  <XAxis 
                    type="number"
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF' }}
                    domain={[0, 10]}
                  />
                  <YAxis 
                    dataKey="asset" 
                    type="category"
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF' }}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar 
                    dataKey="volatility" 
                    fill="#facc15"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              No volatility data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RiskManager;
