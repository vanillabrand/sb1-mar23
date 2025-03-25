import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  RefreshCw, 
  Loader2, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronDown,
  Clock,
  Activity
} from 'lucide-react';
import { bitmartService } from '../lib/bitmart-service';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

interface TopPairsPanelProps {
  assets: Set<string>;
  className?: string;
}

interface AssetData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  priceHistory: { timestamp: number; price: number }[];
}

type TimeFrame = '1m' | '5m' | '10m' | '1h';

export function TopPairsPanel({ assets, className = "" }: TopPairsPanelProps) {
  const [assetData, setAssetData] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [timeframe, setTimeframe] = useState<TimeFrame>('1h');
  const itemsPerPage = 2;

  useEffect(() => {
    updateAssetData();
    
    // Set up WebSocket subscription
    const pairs = Array.from(assets).length > 0 ? Array.from(assets) : ['BTC_USDT', 'ETH_USDT'];
    pairs.forEach(pair => {
      bitmartService.subscribeToSymbol(pair);
    });
    
    // Set up interval for periodic updates
    const interval = setInterval(() => {
      updateAssetData();
    }, 5000);
    
    return () => {
      clearInterval(interval);
      pairs.forEach(pair => {
        bitmartService.unsubscribeFromSymbol(pair);
      });
    };
  }, [assets]);

  const updateAssetData = async () => {
    try {
      let pairs = Array.from(assets);
      if (pairs.length === 0) {
        pairs = ['BTC_USDT', 'ETH_USDT'];
      }
      
      const data = await Promise.all(pairs.map(async (pair) => {
        const ticker = await bitmartService.getTicker(pair);
        const price = parseFloat(ticker.last_price);
        const open24h = parseFloat(ticker.open_24h || '0');
        const change24h = open24h ? ((price - open24h) / open24h) * 100 : 0;
        
        // Get historical data based on timeframe
        const now = Date.now();
        const timeframeMs = {
          '1m': 60 * 1000,
          '5m': 5 * 60 * 1000,
          '10m': 10 * 60 * 1000,
          '1h': 60 * 60 * 1000
        }[timeframe];

        const priceHistory = bitmartService.getAssetData(pair)?.priceHistory.filter(
          p => p.timestamp >= now - timeframeMs
        ) || [];

        return {
          symbol: pair.replace('_', '/'),
          price,
          change24h,
          volume24h: parseFloat(ticker.quote_volume_24h),
          high24h: parseFloat(ticker.high_24h),
          low24h: parseFloat(ticker.low_24h),
          priceHistory
        };
      }));
      
      setAssetData(data);
    } catch (error) {
      console.error('Error updating asset data:', error);
      
      // Generate synthetic data if fetch fails
      const syntheticData = [
        'BTC/USDT',
        'ETH/USDT'
      ].map(symbol => {
        const basePrice = symbol.includes('BTC') ? 45000 : 3000;
        const now = Date.now();
        const priceHistory = Array.from({ length: 120 }, (_, i) => ({
          timestamp: now - (120 - i) * 60000,
          price: basePrice * (1 + (Math.random() - 0.5) * 0.1)
        }));

        return {
          symbol,
          price: basePrice * (1 + (Math.random() - 0.5) * 0.002),
          change24h: (Math.random() * 10) - 5,
          volume24h: Math.random() * 1000000 + 500000,
          high24h: basePrice * 1.02,
          low24h: basePrice * 0.98,
          priceHistory
        };
      });

      setAssetData(syntheticData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    updateAssetData();
  };

  const totalPages = Math.ceil(assetData.length / itemsPerPage);
  const displayedAssets = assetData.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gunmetal-900/90 p-3 rounded-lg shadow-lg">
          <p className="text-gray-300 text-sm mb-1">
            {new Date(label).toLocaleTimeString()}
          </p>
          <p className="text-neon-turquoise text-sm font-semibold">
            ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          <Coins className="w-5 h-5 text-neon-yellow" />
          <h3 className="text-lg font-semibold gradient-text">Top Pairs</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-gunmetal-800/50 rounded-lg p-1">
            {(['1m', '5m', '10m', '1h'] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  timeframe === tf
                    ? 'bg-neon-raspberry text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg text-gray-400 hover:text-neon-turquoise transition-colors disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {displayedAssets.map((asset) => (
          <div 
            key={asset.symbol}
            className="bg-gunmetal-900/30 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-200">{asset.symbol}</h4>
                <p className="text-2xl font-mono font-bold">
                  ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className={`flex items-center ${asset.change24h >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'}`}>
                {asset.change24h >= 0 ? (
                  <ArrowUpRight className="w-5 h-5" />
                ) : (
                  <ArrowDownRight className="w-5 h-5" />
                )}
                <span className="font-semibold">
                  {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Price Chart */}
            <div className="h-32 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={asset.priceHistory}>
                  <defs>
                    <linearGradient id={`gradient-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                      <stop 
                        offset="5%" 
                        stopColor={asset.change24h >= 0 ? "#2dd4bf" : "#ec4899"} 
                        stopOpacity={0.3}
                      />
                      <stop 
                        offset="95%" 
                        stopColor={asset.change24h >= 0 ? "#2dd4bf" : "#ec4899"} 
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="timestamp"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  />
                  <YAxis 
                    domain={['auto', 'auto']}
                    stroke="#6B7280"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    tickFormatter={(value) => value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={asset.change24h >= 0 ? "#2dd4bf" : "#ec4899"}
                    fill={`url(#gradient-${asset.symbol})`}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-neon-turquoise" />
                  <span className="text-xs text-gray-400">24h Volume</span>
                </div>
                <p className="text-sm font-medium text-gray-200">
                  ${(asset.volume24h / 1000000).toFixed(1)}M
                </p>
              </div>
              <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpRight className="w-4 h-4 text-neon-yellow" />
                  <span className="text-xs text-gray-400">24h High</span>
                </div>
                <p className="text-sm font-medium text-gray-200">
                  ${asset.high24h.toFixed(2)}
                </p>
              </div>
              <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight className="w-4 h-4 text-neon-pink" />
                  <span className="text-xs text-gray-400">24h Low</span>
                </div>
                <p className="text-sm font-medium text-gray-200">
                  ${asset.low24h.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentPage
                  ? 'bg-neon-raspberry w-8'
                  : 'bg-gunmetal-700 hover:bg-gunmetal-600'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}