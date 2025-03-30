import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, 
  RefreshCw, 
  Loader2, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronDown,
  Clock,
  Activity,
  Zap
} from 'lucide-react';
import { bitmartService } from '../lib/bitmart-service';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { logService } from '../lib/log-service';

interface MarketTrend {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  dominance: number;
  priceHistory: { timestamp: number; price: number }[];
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  volatility: number;
}

interface MarketTrendsPanelProps {
  className?: string;
}

export function MarketTrendsPanel({ className = "" }: MarketTrendsPanelProps) {
  const [trends, setTrends] = useState<MarketTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '24h' | '7d'>('24h');
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 3;

  useEffect(() => {
    updateTrends();
    
    // Set up interval for periodic updates
    const interval = setInterval(() => {
      updateTrends();
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [selectedTimeframe]);

  const updateTrends = async () => {
    try {
      setError(null);
      if (!refreshing) setLoading(true);

      const defaultAssets = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT', 'XRP_USDT'];
      
      const trendData = await Promise.all(defaultAssets.map(async (asset) => {
        try {
          const ticker = await bitmartService.getTicker(asset);
          const price = parseFloat(ticker.last_price);
          const open24h = parseFloat(ticker.open_24h || '0');
          const change24h = open24h ? ((price - open24h) / open24h) * 100 : 0;
          const volume24h = parseFloat(ticker.quote_volume_24h || '0');
          const high24h = parseFloat(ticker.high_24h || price);
          const low24h = parseFloat(ticker.low_24h || price);

          // Generate synthetic market cap and dominance
          const supply = asset.includes('BTC') ? 19600000 :
                        asset.includes('ETH') ? 120000000 :
                        asset.includes('SOL') ? 410000000 :
                        asset.includes('BNB') ? 155000000 :
                        45000000000;
          
          const marketCap = price * supply;
          const dominance = (marketCap / (marketCap * 1.5)) * 100;

          // Generate price history
          const now = Date.now();
          const priceHistory = Array.from({ length: 50 }, (_, i) => {
            const timeAgo = now - (50 - i) * 60000; // 1-minute intervals
            const historicalChange = Math.sin(i / 10) * (Math.random() * 2);
            return {
              timestamp: timeAgo,
              price: price * (1 + historicalChange / 100)
            };
          });

          // Calculate trend metrics
          const volatility = Math.abs(change24h);
          const strength = Math.min(100, Math.abs(change24h) * 5);
          const trend = change24h > 2 ? 'bullish' :
                       change24h < -2 ? 'bearish' :
                       'neutral';

          return {
            symbol: asset.replace('_', '/'),
            name: asset.split('_')[0],
            price,
            change24h,
            volume24h,
            marketCap,
            dominance,
            priceHistory,
            trend,
            strength,
            volatility
          };
        } catch (error) {
          logService.log('error', `Error processing ${asset}:`, error, 'MarketTrendsPanel');
          return null;
        }
      }));

      // Filter out any failed requests
      const validTrends = trendData.filter((trend): trend is MarketTrend => trend !== null);
      
      if (validTrends.length === 0) {
        throw new Error('No valid market data available');
      }

      // Sort by market cap
      validTrends.sort((a, b) => b.marketCap - a.marketCap);
      
      setTrends(validTrends);
    } catch (error) {
      logService.log('error', 'Failed to update market trends:', error, 'MarketTrendsPanel');
      setError('Failed to load market trends');
      
      // Generate fallback data
      const fallbackData = [
        {
          symbol: 'BTC/USDT',
          name: 'Bitcoin',
          price: 45000 + (Math.random() * 1000),
          change24h: (Math.random() * 10) - 5,
          volume24h: 1000000000 + (Math.random() * 500000000),
          marketCap: 850000000000,
          dominance: 45,
          priceHistory: Array.from({ length: 50 }, (_, i) => ({
            timestamp: Date.now() - (50 - i) * 60000,
            price: 45000 * (1 + (Math.random() - 0.5) * 0.01)
          })),
          trend: 'neutral',
          strength: 50,
          volatility: 5
        },
        {
          symbol: 'ETH/USDT',
          name: 'Ethereum',
          price: 3000 + (Math.random() * 100),
          change24h: (Math.random() * 8) - 4,
          volume24h: 500000000 + (Math.random() * 200000000),
          marketCap: 350000000000,
          dominance: 18,
          priceHistory: Array.from({ length: 50 }, (_, i) => ({
            timestamp: Date.now() - (50 - i) * 60000,
            price: 3000 * (1 + (Math.random() - 0.5) * 0.01)
          })),
          trend: 'bullish',
          strength: 65,
          volatility: 4
        }
      ];
      setTrends(fallbackData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    updateTrends();
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const totalPages = Math.ceil(trends.length / itemsPerPage);
  const displayedTrends = trends.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-neon-raspberry" />
          <h2 className="text-xl font-bold gradient-text">Market Trends</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 bg-gunmetal-800 rounded-lg p-1">
            {(['1h', '24h', '7d'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-3 py-1 rounded text-sm ${
                  selectedTimeframe === tf
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

      <div className="space-y-6">
        <AnimatePresence mode="sync">
          {displayedTrends.map((trend) => (
            <motion.div
              key={trend.symbol}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800/50 relative overflow-hidden"
            >
              {/* Background Chart */}
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend.priceHistory}>
                    <defs>
                      <linearGradient id={`gradient-${trend.symbol}`} x1="0" y1="0" x2="0" y2="1">
                        <stop 
                          offset="5%" 
                          stopColor={trend.change24h >= 0 ? "#2dd4bf" : "#ec4899"} 
                          stopOpacity={0.2}
                        />
                        <stop 
                          offset="95%" 
                          stopColor={trend.change24h >= 0 ? "#2dd4bf" : "#ec4899"} 
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={trend.change24h >= 0 ? "#2dd4bf" : "#ec4899"}
                      fill={`url(#gradient-${trend.symbol})`}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Content */}
              <div className="relative z-10">
                <div className="grid grid-cols-12 gap-6">
                  {/* Asset Info */}
                  <div className="col-span-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-200">{trend.name}</h3>
                      <div className="text-2xl font-mono font-bold text-gray-200">
                        ${trend.price.toFixed(2)}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 ${
                        trend.change24h >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'
                      }`}>
                        {trend.change24h >= 0 ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                        <span className="font-semibold">
                          {trend.change24h >= 0 ? '+' : ''}{trend.change24h.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Market Stats */}
                  <div className="col-span-9 grid grid-cols-3 gap-4">
                    <div className="bg-gunmetal-900/50 backdrop-blur-sm p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-neon-yellow" />
                        <span className="text-xs text-gray-400">Volume 24h</span>
                      </div>
                      <p className="text-sm font-medium text-neon-yellow">
                        ${formatNumber(trend.volume24h)}
                      </p>
                    </div>
                    <div className="bg-gunmetal-900/50 backdrop-blur-sm p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-neon-orange" />
                        <span className="text-xs text-gray-400">Market Cap</span>
                      </div>
                      <p className="text-sm font-medium text-neon-orange">
                        ${formatNumber(trend.marketCap)}
                      </p>
                    </div>
                    <div className="bg-gunmetal-900/50 backdrop-blur-sm p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-neon-pink" />
                        <span className="text-xs text-gray-400">Market Dominance</span>
                      </div>
                      <p className="text-sm font-medium text-neon-pink">
                        {trend.dominance.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Dot Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
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
