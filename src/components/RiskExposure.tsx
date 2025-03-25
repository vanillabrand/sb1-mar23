import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { bitmartService } from '../lib/bitmart-service';
import { analyticsService } from '../lib/analytics-service';

interface RiskExposureProps {
  assets: Set<string>;
  className?: string;
}

export function RiskExposure({ assets, className = "" }: RiskExposureProps) {
  const [riskExposureData, setRiskExposureData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const updateRiskExposure = async () => {
    setLoading(true);
    try {
      const assetList = Array.from(assets);
      if (assetList.length === 0) {
        assetList.push('BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT', 'XRP_USDT');
      }
      
      const exposureData = await Promise.all(assetList.slice(0, 6).map(async (asset) => {
        const realTimeData = bitmartService.getAssetData(asset);
        const analyticsData = analyticsService.getLatestAnalytics(asset);
        
        let value = 0;
        let risk = 0;
        let sentiment = 'neutral';
        
        // Use real data if available
        if (analyticsData?.metrics?.exposure) {
          value = analyticsData.metrics.exposure;
          risk = analyticsData.metrics.riskScore || 5;
          sentiment = analyticsData.marketState?.sentiment || 'neutral';
        } else if (realTimeData?.price) {
          // Calculate a synthetic exposure based on price and change
          const price = realTimeData.price;
          const volatility = Math.abs(realTimeData.change24h);
          value = price * (0.1 + volatility / 10);
          risk = 3 + (volatility / 5);
          sentiment = realTimeData.change24h > 2 ? 'bullish' :
                     realTimeData.change24h < -2 ? 'bearish' :
                     'neutral';
        } else {
          // Fallback to synthetic data
          value = 1000 + Math.random() * 9000;
          risk = 1 + Math.random() * 9;
          sentiment = Math.random() > 0.6 ? 'bullish' :
                     Math.random() < 0.4 ? 'bearish' :
                     'neutral';
        }
        
        return {
          asset: asset.replace('_', '/'),
          value: Math.round(value),
          risk: Math.min(10, Math.round(risk * 10) / 10),
          sentiment
        };
      }));
      
      // Sort by exposure value in descending order
      exposureData.sort((a, b) => b.value - a.value);
      
      setRiskExposureData(exposureData);
    } catch (error) {
      console.error('Error updating risk exposure data:', error);
      
      // Fallback to synthetic data
      const fallbackData = [
        { asset: 'BTC/USDT', value: 8500, risk: 7.2, sentiment: 'bullish' },
        { asset: 'ETH/USDT', value: 6200, risk: 6.8, sentiment: 'neutral' },
        { asset: 'SOL/USDT', value: 4300, risk: 8.1, sentiment: 'bearish' },
        { asset: 'BNB/USDT', value: 3100, risk: 5.5, sentiment: 'bullish' },
        { asset: 'XRP/USDT', value: 2200, risk: 4.2, sentiment: 'neutral' }
      ];
      setRiskExposureData(fallbackData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    updateRiskExposure();
    
    // Set up interval for periodic updates
    const interval = setInterval(() => {
      updateRiskExposure();
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [assets]);

  const handleRefresh = () => {
    setRefreshing(true);
    updateRiskExposure();
  };

  // Graph styling constants
  const chartStyles = {
    gridColor: "rgba(55, 65, 81, 0.15)",
    textColor: "#9CA3AF",
    barColor: "#fb923c"
  };

  // Custom tooltip for the bar chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gunmetal-900/90 p-3 rounded-lg shadow-lg">
          <p className="text-gray-300 text-sm mb-1">{data.asset}</p>
          <p className="text-neon-orange text-sm font-semibold">
            ${data.value.toLocaleString()}
          </p>
          <p className="text-neon-yellow text-sm">
            Risk: {data.risk}/10
          </p>
          <p className={`text-sm ${
            data.sentiment === 'bullish' ? 'text-neon-turquoise' :
            data.sentiment === 'bearish' ? 'text-neon-pink' :
            'text-gray-400'
          }`}>
            Sentiment: {data.sentiment.charAt(0).toUpperCase() + data.sentiment.slice(1)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-neon-orange" />
          <h2 className="text-xl font-semibold gradient-text">Risk Exposure</h2>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 bg-gunmetal-800/50 rounded-lg text-gray-400 hover:text-neon-turquoise transition-all disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      </div>
      
      {loading && riskExposureData.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin" />
        </div>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={riskExposureData} 
              layout="vertical"
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <XAxis 
                type="number" 
                tick={{ fill: chartStyles.textColor, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <YAxis 
                dataKey="asset" 
                type="category" 
                tick={{ fill: chartStyles.textColor, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <CartesianGrid strokeDasharray="3 3" stroke={chartStyles.gridColor} horizontal={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="value" 
                fill={chartStyles.barColor} 
                radius={[0, 4, 4, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}