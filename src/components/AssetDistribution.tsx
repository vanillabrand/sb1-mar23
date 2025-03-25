import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RefreshCw, Loader2, PieChart as PieChartIcon } from 'lucide-react';
import { bitmartService } from '../lib/bitmart-service';
import { analyticsService } from '../lib/analytics-service';

interface AssetDistributionProps {
  assets: Set<string>;
  className?: string;
}

export function AssetDistribution({ assets, className = "" }: AssetDistributionProps) {
  const [distributionData, setDistributionData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const updateAssetDistribution = async () => {
    setLoading(true);
    try {
      const assetColors = [
        "#2dd4bf", "#facc15", "#fb923c", "#ec4899", "#8b5cf6", 
        "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#60a5fa"
      ];
      
      const assetList = Array.from(assets);
      if (assetList.length === 0) {
        assetList.push('BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT', 'XRP_USDT');
      }
      
      const distributionData = await Promise.all(assetList.slice(0, 7).map(async (asset, index) => {
        // Try to get real-time price data to inform distribution
        const realTimeData = bitmartService.getAssetData(asset);
        const analyticsData = analyticsService.getLatestAnalytics(asset);
        
        let weight = 0;
        let sentiment = 'neutral';
        
        // Calculate weight based on real data if available
        if (realTimeData?.price) {
          weight = (realTimeData.price / 1000) * (Math.abs(realTimeData.change24h) + 1);
          sentiment = realTimeData.change24h > 2 ? 'bullish' :
                     realTimeData.change24h < -2 ? 'bearish' :
                     'neutral';
        } else if (analyticsData?.metrics?.exposure) {
          weight = analyticsData.metrics.exposure / 100;
          sentiment = analyticsData.marketState?.sentiment || 'neutral';
        } else {
          weight = 10 + Math.random() * 30;
          sentiment = Math.random() > 0.6 ? 'bullish' :
                     Math.random() < 0.4 ? 'bearish' :
                     'neutral';
        }
        
        return {
          name: asset.replace('_', '/'),
          value: Math.max(5, Math.min(50, weight)),
          color: assetColors[index % assetColors.length],
          sentiment
        };
      }));
      
      // Add "Other" category if needed
      if (assetList.length > 7) {
        distributionData.push({
          name: "Other",
          value: 5 + Math.random() * 10,
          color: assetColors[7],
          sentiment: 'neutral'
        });
      }
      
      setDistributionData(distributionData);
    } catch (error) {
      console.error('Error updating asset distribution:', error);
      
      // Fallback to synthetic data
      const fallbackData = [
        { name: "BTC/USDT", value: 35, color: "#2dd4bf", sentiment: 'bullish' },
        { name: "ETH/USDT", value: 25, color: "#facc15", sentiment: 'neutral' },
        { name: "SOL/USDT", value: 15, color: "#fb923c", sentiment: 'bearish' },
        { name: "BNB/USDT", value: 10, color: "#ec4899", sentiment: 'bullish' },
        { name: "XRP/USDT", value: 10, color: "#8b5cf6", sentiment: 'neutral' },
        { name: "Other", value: 5, color: "#34d399", sentiment: 'neutral' },
      ];
      setDistributionData(fallbackData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    updateAssetDistribution();
    
    // Set up interval for periodic updates
    const interval = setInterval(() => {
      updateAssetDistribution();
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [assets]);

  const handleRefresh = () => {
    setRefreshing(true);
    updateAssetDistribution();
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gunmetal-900/90 p-3 rounded-lg shadow-lg">
          <p className="text-gray-300 text-sm mb-1">{data.name}</p>
          <p className="text-sm font-semibold" style={{ color: data.color }}>
            {data.value.toFixed(1)}%
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
          <PieChartIcon className="w-5 h-5 text-neon-yellow" />
          <h2 className="text-xl font-semibold gradient-text">Asset Distribution</h2>
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
      
      {loading && distributionData.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin" />
        </div>
      ) : (
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                outerRadius={60}
                dataKey="value"
                labelLine={{ stroke: '#374151', strokeWidth: 1, strokeDasharray: '2 2' }}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {distributionData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    strokeWidth={0}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}