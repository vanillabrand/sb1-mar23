import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
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
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const chartRef = useRef<HTMLDivElement>(null);

  // Updated color scheme to match the page's aesthetic
  const assetColors = [
    "#00FFFF", // Neon Turquoise
    "#FFFF00", // Neon Yellow
    "#00FF00", // Neon Green
    "#FF8C00", // Neon Orange
    "#FF1493", // Neon Pink/Raspberry
    "#9370DB", // Medium Purple
    "#00CED1", // Dark Turquoise
    "#FFD700", // Gold
    "#32CD32", // Lime Green
    "#FF6347"  // Tomato
  ];

  const updateAssetDistribution = async () => {
    // Only show loading indicator on first load, not on refreshes
    if (distributionData.length === 0) {
      setLoading(true);
    }

    try {
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
        } else if (analyticsData?.metrics && 'exposure' in analyticsData.metrics) {
          weight = (analyticsData.metrics as any).exposure / 100;
          sentiment = (analyticsData as any).marketState?.sentiment || 'neutral';
        } else {
          weight = 10 + Math.random() * 30;
          sentiment = Math.random() > 0.6 ? 'bullish' :
                     Math.random() < 0.4 ? 'bearish' :
                     'neutral';
        }

        return {
          name: asset,
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

      // Sort by value for better visual appearance
      distributionData.sort((a, b) => b.value - a.value);

      setDistributionData(distributionData);
    } catch (error) {
      console.error('Error updating asset distribution:', error);

      // Fallback to synthetic data
      const fallbackData = [
        { name: "BTC_USDT", value: 35, color: assetColors[0], sentiment: 'bullish' },
        { name: "ETH_USDT", value: 25, color: assetColors[1], sentiment: 'neutral' },
        { name: "SOL_USDT", value: 15, color: assetColors[2], sentiment: 'bearish' },
        { name: "BNB_USDT", value: 10, color: assetColors[3], sentiment: 'bullish' },
        { name: "XRP_USDT", value: 10, color: assetColors[4], sentiment: 'neutral' },
        { name: "Other", value: 5, color: assetColors[5], sentiment: 'neutral' },
      ];
      setDistributionData(fallbackData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    updateAssetDistribution();

    // Set up a refresh interval of once per minute
    const refreshInterval = setInterval(() => {
      updateAssetDistribution();
    }, 60000); // 60000ms = 1 minute

    return () => {
      clearInterval(refreshInterval);
    };
  }, [assets]);

  const handleRefresh = () => {
    setRefreshing(true);
    updateAssetDistribution();
  };

  // Enhanced 3D active sector rendering function
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;

    // Calculate 3D effect parameters
    const sin = Math.sin(-Math.PI / 8);
    const cos = Math.cos(-Math.PI / 8);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + innerRadius * cos;
    const my = cy + innerRadius * sin;

    return (
      <g>
        {/* Main sector with slight pull-out effect */}
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 10}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          opacity={0.9}
        />

        {/* 3D side effect */}
        <path
          d={`M ${cx + innerRadius * Math.cos(startAngle * Math.PI / 180)} ${cy + innerRadius * Math.sin(startAngle * Math.PI / 180)}
             L ${cx + (outerRadius + 10) * Math.cos(startAngle * Math.PI / 180)} ${cy + (outerRadius + 10) * Math.sin(startAngle * Math.PI / 180)}
             L ${sx + (outerRadius + 10) * Math.cos(startAngle * Math.PI / 180)} ${sy + (outerRadius + 10) * Math.sin(startAngle * Math.PI / 180)}
             L ${mx + innerRadius * Math.cos(startAngle * Math.PI / 180)} ${my + innerRadius * Math.sin(startAngle * Math.PI / 180)} z`}
          fill={fill}
          opacity={0.3}
        />

        {/* Outer glow effect */}
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 10}
          outerRadius={outerRadius + 15}
          fill={fill}
          opacity={0.5}
          filter="url(#glow)"
        />
      </g>
    );
  };

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(undefined);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gunmetal-900/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-gunmetal-700/50">

          <p className="text-white text-sm font-medium mb-1">{data.name}</p>
          <p className="text-lg font-bold mb-1" style={{ color: data.color }}>
            {data.value.toFixed(1)}%
          </p>
          <p className={`text-sm ${
            data.sentiment === 'bullish' ? 'text-green-400' :
            data.sentiment === 'bearish' ? 'text-red-400' :
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
    <div className={`${className} relative overflow-hidden`}>

      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-yellow-500/5 to-pink-500/5 rounded-xl"></div>

      <div className="relative z-10 p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-yellow-400 to-pink-500">
              Asset Distribution
            </h2>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-gunmetal-800/50 rounded-lg text-gray-400 hover:text-cyan-400 transition-all disabled:opacity-50 hover:bg-gunmetal-700/50"
            style={{
              transition: 'all 0.2s ease'
            }}
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Fixed height container to prevent flickering */}
        <div className="h-[220px] relative overflow-hidden" style={{ borderRadius: '12px' }}>
          {loading && distributionData.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <div
              className="h-full w-full relative overflow-hidden"
              ref={chartRef}
              style={{
                boxShadow: 'inset 0 0 15px 5px rgba(0, 0, 0, 0.2)',
                borderRadius: '12px'
              }}
            >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {/* 3D gradients for each slice */}
                  {distributionData.map((entry, index) => (
                    <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                      <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                    </linearGradient>
                  ))}

                  {/* Glow filter for 3D effect */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>

                  {/* 3D lighting effect */}
                  <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.3" />
                  </filter>
                </defs>

                {/* 3D shadow base - rendered first */}
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="53%" /* Slightly lower to create 3D shadow effect */
                  innerRadius={30}
                  outerRadius={70}
                  dataKey="value"
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  blendStroke
                  isAnimationActive={false}
                >
                  {distributionData.map((entry, index) => (
                    <Cell
                      key={`shadow-${index}`}
                      fill="#000"
                      opacity={0.15}
                      stroke="none"
                    />
                  ))}
                </Pie>

                {/* Main 3D pie chart */}
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={70}
                  dataKey="value"
                  labelLine={{
                    stroke: '#ffffff',
                    strokeWidth: 0.5,
                    strokeOpacity: 0.5,
                    strokeDasharray: '3 3'
                  }}
                  label={({ name, percent }) => `${name.split('_')[0]} ${(percent * 100).toFixed(0)}%`}
                  paddingAngle={2}
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  onMouseEnter={onPieEnter}
                  onMouseLeave={onPieLeave}
                  startAngle={90}
                  endAngle={-270}
                  filter="url(#shadow)"
                  isAnimationActive={false}
                >
                  {distributionData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`url(#gradient-${index})`}
                      stroke="none"
                      strokeWidth={0}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{ zIndex: 100 }}
                  cursor={false}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Static center effect - no animation */}
            <div
              className="absolute top-1/2 left-1/2 w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 via-yellow-500 to-pink-500"
              style={{
                transform: 'translate(-50%, -50%)',
                filter: 'blur(8px)',
                opacity: 0.4,
                zIndex: 5
              }}
            />

            {/* Subtle edge blur effect */}
            <div className="absolute inset-0 pointer-events-none" style={{
              boxShadow: 'inset 0 0 20px 10px rgba(0, 0, 0, 0.15)',
              borderRadius: '12px',
              zIndex: 10
            }} />
            </div>
          )}
        </div>

        {/* Fixed position legend - always present to prevent layout shifts */}
        <div className="h-24 mt-4"> {/* Fixed height container to prevent jumping */}
          {!loading && distributionData.length > 0 ? (
            <div
              className="flex flex-wrap justify-center gap-x-4 gap-y-2"
              style={{ minHeight: '4rem' }} /* Ensure minimum height */
            >
              {distributionData.map((entry, index) => (
                <div
                  key={`legend-${index}`}
                  className="flex items-center gap-1.5 group cursor-pointer transition-all duration-300 hover:bg-gunmetal-800/30 px-2 py-1 rounded"
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(undefined)}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: entry.color,
                      boxShadow: `0 0 5px ${entry.color}`,
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                  />
                  <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                    {entry.name.replace('_', '/')} ({entry.value.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              {/* Empty placeholder to maintain height */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}