import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { analyticsService } from '../lib/analytics-service';

export const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setError(null);
      setLoading(true);
      
      // Get all strategy IDs and fetch their analytics
      const strategies = Array.from(analyticsService.analyticsData.keys());
      const data = strategies.map(strategyId => {
        const strategyData = analyticsService.analyticsData.get(strategyId);
        return {
          strategyId,
          data: strategyData?.[strategyData.length - 1] // Get most recent data point
        };
      }).filter(item => item.data); // Filter out undefined data

      setAnalyticsData(data);
    } catch (err) {
      setError('Failed to fetch analytics data');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        <AlertCircle className="w-6 h-6 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors"
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {analyticsData.map((item) => (
          <motion.div
            key={item.strategyId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-gunmetal-800 border border-gunmetal-700"
          >
            <h3 className="text-lg font-semibold mb-4">Strategy {item.strategyId}</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">PnL</span>
                <span className={item.data.metrics.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {item.data.metrics.pnl.toFixed(2)}%
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Win Rate</span>
                <span className="text-blue-500">{item.data.metrics.winRate.toFixed(2)}%</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Risk Score</span>
                <span className="text-yellow-500">{item.data.metrics.riskScore.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Market Sentiment</span>
                <span className="flex items-center gap-2">
                  {item.data.marketState.sentiment === 'bullish' ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  {item.data.marketState.sentiment}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Performance Overview</h2>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analyticsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="strategyId" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="data.metrics.pnl" name="PnL" stroke="#8884d8" />
              <Line type="monotone" dataKey="data.metrics.winRate" name="Win Rate" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};