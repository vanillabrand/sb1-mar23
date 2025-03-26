import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Loader2, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Target
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { bitmartService } from '../lib/bitmart-service';
import { logService } from '../lib/log-service';

interface AssetPairData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  bid: number;
  ask: number;
  spread: number;
  lastUpdate: number;
  priceHistory: { timestamp: number; price: number }[];
}

interface StrategyAssetPanelProps {
  strategies: Strategy[];
  className?: string;
}

export function StrategyAssetPanel({ strategies, className }: StrategyAssetPanelProps) {
  const [assetData, setAssetData] = useState<Map<string, AssetPairData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Get unique assets from all active strategies
  const activeAssets = useMemo(() => {
    const assets = new Set<string>();
    strategies.forEach(strategy => {
      if (strategy.status === 'active' && strategy.strategy_config?.assets) {
        strategy.strategy_config.assets.forEach(asset => assets.add(asset));
      }
    });
    return Array.from(assets);
  }, [strategies]);

  useEffect(() => {
    const initializeAssetData = async () => {
      try {
        setLoading(true);
        await updateAssetData();
        
        // Set up WebSocket connections for each asset
        activeAssets.forEach(symbol => {
          bitmartService.subscribeToSymbol(symbol);
        });

        // Handle real-time updates
        const handlePriceUpdate = (data: any) => {
          setAssetData(prev => {
            const updated = new Map(prev);
            const existing = updated.get(data.symbol);
            if (existing) {
              const priceHistory = [...existing.priceHistory];
              priceHistory.push({
                timestamp: Date.now(),
                price: parseFloat(data.last_price)
              });
              // Keep last 100 price points
              if (priceHistory.length > 100) priceHistory.shift();

              updated.set(data.symbol, {
                ...existing,
                price: parseFloat(data.last_price),
                bid: parseFloat(data.best_bid),
                ask: parseFloat(data.best_ask),
                spread: ((parseFloat(data.best_ask) - parseFloat(data.best_bid)) / parseFloat(data.best_bid)) * 100,
                lastUpdate: Date.now(),
                priceHistory
              });
            }
            return updated;
          });
        };

        bitmartService.on('priceUpdate', handlePriceUpdate);

        return () => {
          activeAssets.forEach(symbol => {
            bitmartService.unsubscribeFromSymbol(symbol);
          });
          bitmartService.off('priceUpdate', handlePriceUpdate);
        };
      } catch (error) {
        logService.log('error', 'Failed to initialize asset data', error, 'StrategyAssetPanel');
      } finally {
        setLoading(false);
      }
    };

    initializeAssetData();
  }, [activeAssets]);

  const updateAssetData = async () => {
    try {
      setRefreshing(true);
      const updatedData = new Map<string, AssetPairData>();

      await Promise.all(activeAssets.map(async (symbol) => {
        const ticker = await bitmartService.getTicker(symbol);
        const price = parseFloat(ticker.last_price);
        const open24h = parseFloat(ticker.open_24h || '0');
        const change24h = open24h ? ((price - open24h) / open24h) * 100 : 0;

        updatedData.set(symbol, {
          symbol,
          price,
          change24h,
          volume24h: parseFloat(ticker.volume_24h),
          high24h: parseFloat(ticker.high_24h),
          low24h: parseFloat(ticker.low_24h),
          bid: parseFloat(ticker.best_bid),
          ask: parseFloat(ticker.best_ask),
          spread: ((parseFloat(ticker.best_ask) - parseFloat(ticker.best_bid)) / parseFloat(ticker.best_bid)) * 100,
          lastUpdate: Date.now(),
          priceHistory: [{
            timestamp: Date.now(),
            price
          }]
        });
      }));

      setAssetData(updatedData);
    } catch (error) {
      logService.log('error', 'Failed to update asset data', error, 'StrategyAssetPanel');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    updateAssetData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`bg-gunmetal-900/30 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <Activity className="w-5 h-5 text-neon-turquoise" />
          Strategy Assets
        </h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 bg-gunmetal-800/50 rounded-lg text-gray-400 hover:text-neon-turquoise transition-all disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <RefreshCw className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="space-y-4">
        {Array.from(assetData.entries()).map(([symbol, data], index) => (
          <PanelWrapper 
            key={symbol} 
            index={index}
            className="rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-200">
                  {symbol.replace('_', '/')}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`flex items-center ${
                    data.change24h >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'
                  }`}>
                    {data.change24h >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-mono font-bold text-gray-200">
                  ${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Price Chart */}
            <div className="h-24 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.priceHistory}>
                  <defs>
                    <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                      <stop 
                        offset="5%" 
                        stopColor={data.change24h >= 0 ? "#2dd4bf" : "#ec4899"} 
                        stopOpacity={0.3}
                      />
                      <stop 
                        offset="95%" 
                        stopColor={data.change24h >= 0 ? "#2dd4bf" : "#ec4899"} 
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={data.change24h >= 0 ? "#2dd4bf" : "#ec4899"}
                    fill={`url(#gradient-${symbol})`}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Market Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-neon-turquoise" />
                  <span className="text-xs text-gray-400">Volume</span>
                </div>
                <p className="text-sm font-medium text-gray-200">
                  ${(data.volume24h / 1000000).toFixed(1)}M
                </p>
              </div>
              <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-neon-yellow" />
                  <span className="text-xs text-gray-400">Spread</span>
                </div>
                <p className="text-sm font-medium text-neon-yellow">
                  {data.spread.toFixed(3)}%
                </p>
              </div>
              <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpRight className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-400">24h Range</span>
                </div>
                <p className="text-sm font-medium text-gray-200">
                  ${data.low24h.toFixed(1)} - ${data.high24h.toFixed(1)}
                </p>
              </div>
            </div>
          </PanelWrapper>
        ))}
      </div>
    </div>
  );
}
