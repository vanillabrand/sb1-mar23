import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Tag, 
  ChevronLeft, 
  ChevronRight,
  Brain,
  Target,
  Clock,
  DollarSign,
  Gauge,
  AlertCircle,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  BarChart3,
  Loader2
} from 'lucide-react';
import { bitmartService } from '../lib/bitmart-service';
import { marketMonitor } from '../lib/market-monitor';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { logService } from '../lib/log-service';
import type { Strategy } from '../lib/supabase-types';

interface AssetPairMonitorProps {
  strategy: Strategy;
  onTradeSignal?: (signal: any) => void;
}

interface AssetData {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  signal: 'buy' | 'sell' | null;
  confidence: number;
  priceHistory: { timestamp: number; price: number }[];
}

export function AssetPairMonitor({ strategy, onTradeSignal }: AssetPairMonitorProps) {
  const [assetData, setAssetData] = useState<Map<string, AssetData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [monitoringProgress, setMonitoringProgress] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!strategy.strategy_config?.assets) return;

    const initializeMonitoring = async () => {
      try {
        setLoading(true);
        setError(null);

        // Subscribe to each asset
        for (const symbol of strategy.strategy_config.assets) {
          try {
            await marketMonitor.addAsset(symbol);
            bitmartService.subscribeToSymbol(symbol);
          } catch (error) {
            logService.log('error', `Failed to initialize monitoring for ${symbol}`, error, 'AssetPairMonitor');
          }
        }

        // Initial data fetch
        await updateAssetData();
        setLoading(false);
      } catch (error) {
        setError('Failed to initialize asset monitoring');
        setLoading(false);
      }
    };

    initializeMonitoring();

    // Set up WebSocket listeners
    const handlePriceUpdate = async (data: any) => {
      if (!strategy.strategy_config?.assets?.includes(data.symbol)) return;

      const updatedData = await processAssetData(data.symbol, data);
      if (updatedData) {
        setAssetData(prev => new Map(prev).set(data.symbol, updatedData));
      }
    };

    bitmartService.on('priceUpdate', handlePriceUpdate);

    // Set up monitoring progress updates
    const monitoringInterval = setInterval(() => {
      strategy.strategy_config?.assets?.forEach(symbol => {
        setMonitoringProgress(prev => {
          const newProgress = new Map(prev);
          const currentProgress = newProgress.get(symbol) || 0;
          newProgress.set(symbol, (currentProgress + 1) % 100);
          return newProgress;
        });
      });
    }, 1000);

    // Cleanup
    return () => {
      bitmartService.off('priceUpdate', handlePriceUpdate);
      strategy.strategy_config?.assets?.forEach(symbol => {
        bitmartService.unsubscribeFromSymbol(symbol);
      });
      clearInterval(monitoringInterval);
    };
  }, [strategy.id, strategy.strategy_config?.assets]);

  const updateAssetData = async () => {
    if (!strategy.strategy_config?.assets) return;

    try {
      const updatedData = new Map<string, AssetData>();

      for (const symbol of strategy.strategy_config.assets) {
        const data = await processAssetData(symbol);
        if (data) {
          updatedData.set(symbol, data);
        }
      }

      setAssetData(updatedData);
    } catch (error) {
      logService.log('error', 'Failed to update asset data', error, 'AssetPairMonitor');
    }
  };

  const processAssetData = async (symbol: string, wsData?: any): Promise<AssetData | null> => {
    try {
      // Get real-time data
      const ticker = wsData || await bitmartService.getTicker(symbol);
      const price = parseFloat(ticker.last_price);
      const open24h = parseFloat(ticker.open_24h || '0');
      const change24h = open24h ? ((price - open24h) / open24h) * 100 : 0;

      // Get market state
      const marketState = marketMonitor.getMarketState(symbol);
      
      // Check for trade signals based on strategy configuration
      const signal = await checkTradeSignals(symbol, strategy, marketState);

      // Get or update price history
      const existingData = assetData.get(symbol);
      let priceHistory = existingData?.priceHistory || [];
      
      // Add new price point
      const now = Date.now();
      priceHistory = [
        ...priceHistory.filter(p => now - p.timestamp <= 60000), // Keep last minute
        { timestamp: now, price }
      ];

      const data: AssetData = {
        symbol,
        price,
        change24h,
        volume: parseFloat(ticker.quote_volume_24h || '0'),
        signal: signal?.type || null,
        confidence: signal?.confidence || 0,
        priceHistory
      };

      // Emit trade signal if confidence is high enough
      if (signal && signal.confidence >= (strategy.strategy_config?.trade_parameters?.confidence_factor || 0.7)) {
        onTradeSignal?.(signal);
      }

      return data;
    } catch (error) {
      logService.log('error', `Failed to process asset data for ${symbol}`, error, 'AssetPairMonitor');
      return null;
    }
  };

  const checkTradeSignals = async (
    symbol: string, 
    strategy: Strategy, 
    marketState: any
  ): Promise<{ type: 'buy' | 'sell'; confidence: number } | null> => {
    if (!strategy.strategy_config?.conditions) return null;

    try {
      // Get indicator values
      const indicators = await marketMonitor.getIndicatorValues(
        symbol,
        strategy.strategy_config.indicators || []
      );

      // Check entry conditions
      let entrySignals = 0;
      let totalSignals = 0;

      strategy.strategy_config.conditions.entry.forEach(condition => {
        const indicator = indicators.find(i => i.name === condition.indicator);
        if (!indicator) return;

        totalSignals++;
        if (evaluateCondition(indicator.value, condition.operator, condition.value)) {
          entrySignals++;
        }
      });

      // Check exit conditions
      let exitSignals = 0;
      strategy.strategy_config.conditions.exit.forEach(condition => {
        const indicator = indicators.find(i => i.name === condition.indicator);
        if (!indicator) return;

        totalSignals++;
        if (evaluateCondition(indicator.value, condition.operator, condition.value)) {
          exitSignals++;
        }
      });

      if (totalSignals === 0) return null;

      // Calculate signal confidence
      const entryConfidence = entrySignals / totalSignals;
      const exitConfidence = exitSignals / totalSignals;

      if (entryConfidence > exitConfidence && entryConfidence > 0.5) {
        return { type: 'buy', confidence: entryConfidence };
      } else if (exitConfidence > entryConfidence && exitConfidence > 0.5) {
        return { type: 'sell', confidence: exitConfidence };
      }

      return null;
    } catch (error) {
      logService.log('error', `Failed to check trade signals for ${symbol}`, error, 'AssetPairMonitor');
      return null;
    }
  };

  const evaluateCondition = (value: number, operator: string, threshold: number): boolean => {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      default: return false;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await updateAssetData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-neon-pink/10 border border-neon-pink/20 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="w-6 h-6 text-neon-pink" />
        <p className="text-neon-pink">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-200">Asset Pairs</h3>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from(assetData.entries()).map(([symbol, data]) => (
          <motion.div
            key={symbol}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gunmetal-800/30 rounded-lg p-4"
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
                      <TrendingDown className="w-4 h-4" /> )}
                    <span className="text-sm font-medium">
                      {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
                    </span>
                  </div>
                  {data.signal && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      data.signal === 'buy' 
                        ? 'bg-neon-turquoise/20 text-neon-turquoise' 
                        : 'bg-neon-pink/20 text-neon-pink'
                    }`}>
                      {data.signal.toUpperCase()} ({Math.round(data.confidence * 100)}%)
                    </span>
                  )}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-neon-turquoise" />
                  <span className="text-xs text-gray-400">Volume (24h)</span>
                </div>
                <p className="text-sm font-medium text-gray-200">
                  ${data.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="bg-gunmetal-900/30 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-neon-yellow" />
                  <span className="text-xs text-gray-400">Signal Strength</span>
                </div>
                <p className="text-sm font-medium text-neon-yellow">
                  {data.signal ? `${Math.round(data.confidence * 100)}%` : 'No Signal'}
                </p>
              </div>
            </div>

            {/* Monitoring Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Monitoring Progress</span>
                <span>{monitoringProgress.get(symbol) || 0}%</span>
              </div>
              <div className="h-1 bg-gunmetal-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-neon-turquoise"
                  initial={{ width: 0 }}
                  animate={{ width: `${monitoringProgress.get(symbol) || 0}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}