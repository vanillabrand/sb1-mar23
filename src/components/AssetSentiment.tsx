import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Loader2, 
  RefreshCw,
  Activity,
  Gauge,
  Scale,
  AlertCircle,
  Smile,
  Frown,
  Meh,
  ArrowBigUp,
  ArrowBigDown
} from 'lucide-react';
import { bitmartService } from '../lib/bitmart-service';
import { analyticsService } from '../lib/analytics-service';

interface AssetSentimentProps {
  assets: Set<string>;
  className?: string;
}

interface SentimentData {
  fearGreedIndex: number; // 0-100 (0 = Extreme Fear, 100 = Extreme Greed)
  bullBearIndex: number; // 0-100 (0 = Extremely Bearish, 100 = Extremely Bullish)
  lastUpdate: number;
}

export function AssetSentiment({ assets, className = "" }: AssetSentimentProps) {
  const [sentiment, setSentiment] = useState<SentimentData>({
    fearGreedIndex: 50,
    bullBearIndex: 50,
    lastUpdate: Date.now()
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial sentiment update when component mounts
    updateSentiment();
  }, [assets]);

  const updateSentiment = async () => {
    try {
      setError(null);
      if (!refreshing) setLoading(true);

      let pairs = Array.from(assets);
      if (pairs.length === 0) {
        pairs = ['BTC_USDT', 'ETH_USDT'];
      }

      // Calculate sentiment based on multiple factors
      const sentimentData = await Promise.all(pairs.map(async (symbol) => {
        try {
          // Get real-time data
          const ticker = await bitmartService.getTicker(symbol);
          const price = parseFloat(ticker.last_price);
          const open24h = parseFloat(ticker.open_24h || '0');
          const high24h = parseFloat(ticker.high_24h || price);
          const low24h = parseFloat(ticker.low_24h || price);
          const change24h = open24h ? ((price - open24h) / open24h) * 100 : 0;
          const volume = parseFloat(ticker.quote_volume_24h || '0');
          
          // Get analytics data
          const analytics = analyticsService.getLatestAnalytics(symbol);
          
          // Calculate momentum (rate of price change)
          const momentum = analytics?.metrics?.momentum || change24h;
          
          // Calculate volatility
          const volatility = ((high24h - low24h) / low24h) * 100;
          
          // Calculate volume ratio compared to average
          const avgVolume = analytics?.metrics?.avgVolume || volume;
          const volumeRatio = volume / avgVolume;
          
          // Calculate price position within range
          const priceRange = high24h - low24h;
          const pricePosition = priceRange > 0 ? ((price - low24h) / priceRange) * 100 : 50;
          
          return {
            price,
            change24h,
            momentum,
            volatility,
            volumeRatio,
            pricePosition
          };
        } catch (error) {
          console.error(`Error processing sentiment for ${symbol}:`, error);
          return null;
        }
      }));

      // Filter out failed requests
      const validData = sentimentData.filter((data): data is any => data !== null);
      
      if (validData.length === 0) {
        throw new Error('No valid sentiment data available');
      }

      // Calculate Fear & Greed Index (0-100)
      const fearGreedIndex = calculateFearGreedIndex(validData);
      
      // Calculate Bull & Bear Index (0-100)
      const bullBearIndex = calculateBullBearIndex(validData);

      setSentiment({
        fearGreedIndex,
        bullBearIndex,
        lastUpdate: Date.now()
      });

    } catch (error) {
      setError('Failed to update market sentiment');
      console.error('Sentiment calculation error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateFearGreedIndex = (data: any[]): number => {
    // Weighted components for Fear & Greed calculation
    const weights = {
      volatility: 0.3,    // Higher volatility = more fear
      momentum: 0.3,      // Positive momentum = more greed
      volumeRatio: 0.2,   // Higher volume = more greed
      pricePosition: 0.2  // Higher in range = more greed
    };

    let fearGreedScore = 0;

    data.forEach(asset => {
      // Volatility component (inverted - higher volatility means more fear)
      const volatilityScore = Math.max(0, 100 - (asset.volatility * 2));
      
      // Momentum component (normalize to 0-100 range)
      const momentumScore = ((asset.momentum + 10) / 20) * 100;
      
      // Volume ratio component
      const volumeScore = Math.min(100, asset.volumeRatio * 50);
      
      // Price position component
      const positionScore = asset.pricePosition;

      // Calculate weighted score
      const assetScore = (
        volatilityScore * weights.volatility +
        momentumScore * weights.momentum +
        volumeScore * weights.volumeRatio +
        positionScore * weights.pricePosition
      );

      fearGreedScore += assetScore;
    });

    // Average across all assets and ensure within 0-100 range
    return Math.min(100, Math.max(0, fearGreedScore / data.length));
  };

  const calculateBullBearIndex = (data: any[]): number => {
    // Weighted components for Bull & Bear calculation
    const weights = {
      priceChange: 0.4,   // Recent price changes
      momentum: 0.3,      // Price momentum
      volumeRatio: 0.2,   // Trading volume
      pricePosition: 0.1  // Position in range
    };

    let bullBearScore = 0;

    data.forEach(asset => {
      // Price change component (normalize to 0-100 range)
      const priceChangeScore = ((asset.change24h + 10) / 20) * 100;
      
      // Momentum component (normalize to 0-100 range)
      const momentumScore = ((asset.momentum + 10) / 20) * 100;
      
      // Volume ratio component
      const volumeScore = Math.min(100, asset.volumeRatio * 50);
      
      // Price position component
      const positionScore = asset.pricePosition;

      // Calculate weighted score
      const assetScore = (
        priceChangeScore * weights.priceChange +
        momentumScore * weights.momentum +
        volumeScore * weights.volumeRatio +
        positionScore * weights.pricePosition
      );

      bullBearScore += assetScore;
    });

    // Average across all assets and ensure within 0-100 range
    return Math.min(100, Math.max(0, bullBearScore / data.length));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    updateSentiment();
  };

  const getFearGreedLabel = (value: number): string => {
    if (value >= 75) return 'Extreme Greed';
    if (value >= 60) return 'Greed';
    if (value >= 40) return 'Neutral';
    if (value >= 25) return 'Fear';
    return 'Extreme Fear';
  };

  const getBullBearLabel = (value: number): string => {
    if (value >= 75) return 'Strongly Bullish';
    if (value >= 60) return 'Bullish';
    if (value >= 40) return 'Neutral';
    if (value >= 25) return 'Bearish';
    return 'Strongly Bearish';
  };

  const getScaleColor = (value: number): string => {
    if (value >= 75) return 'text-neon-turquoise';
    if (value >= 60) return 'text-neon-yellow';
    if (value >= 40) return 'text-gray-200';
    if (value >= 25) return 'text-neon-orange';
    return 'text-neon-pink';
  };

  const getFearGreedIcon = (value: number) => {
    if (value >= 75) return <Smile className="w-8 h-8 text-neon-turquoise" />;
    if (value >= 60) return <Smile className="w-8 h-8 text-neon-yellow" />;
    if (value >= 40) return <Meh className="w-8 h-8 text-gray-200" />;
    if (value >= 25) return <Frown className="w-8 h-8 text-neon-orange" />;
    return <Frown className="w-8 h-8 text-neon-pink" />;
  };

  const getBullBearIcon = (value: number) => {
    if (value >= 75) return <ArrowBigUp className="w-8 h-8 text-neon-turquoise" />;
    if (value >= 60) return <ArrowBigUp className="w-8 h-8 text-neon-yellow" />;
    if (value >= 40) return <TrendingUp className="w-8 h-8 text-gray-200" />;
    if (value >= 25) return <ArrowBigDown className="w-8 h-8 text-neon-orange" />;
    return <ArrowBigDown className="w-8 h-8 text-neon-pink" />;
  };

  const getScaleMarkers = () => {
    return [0, 25, 50, 75, 100].map(value => (
      <div 
        key={value} 
        className="absolute h-3 w-0.5 bg-gunmetal-700"
        style={{ left: `${value}%`, top: '-4px' }}
      >
        <span className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-gray-400">
          {value}
        </span>
      </div>
    ));
  };

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-neon-pink/10 border border-neon-pink/20 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-neon-pink" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-neon-yellow" />
          <h3 className="text-lg font-semibold gradient-text">Market Sentiment</h3>
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

      <div className="space-y-8">
        {/* Fear & Greed Index */}
        <div className="bg-gunmetal-900/30 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Scale className="w-5 h-5 text-neon-yellow" />
              <h4 className="text-lg font-medium text-gray-200">Fear & Greed Index</h4>
            </div>
            {getFearGreedIcon(sentiment.fearGreedIndex)}
          </div>
          
          <div className="relative pt-2 pb-12">
            {/* Scale Background with Markers */}
            <div className="relative h-2">
              <div className="absolute inset-0 bg-gradient-to-r from-neon-pink via-gray-500 to-neon-turquoise rounded-full" />
              {getScaleMarkers()}
            </div>
            
            {/* Slider Thumb */}
            <motion.div
              initial={{ x: `${sentiment.fearGreedIndex}%` }}
              animate={{ x: `${sentiment.fearGreedIndex}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute top-0 -ml-3"
              style={{ left: `${sentiment.fearGreedIndex}%` }}
            >
              <div className="relative">
                <div className="w-6 h-6 bg-gunmetal-900 rounded-full border-2 border-neon-yellow shadow-lg" />
                <div className="absolute w-0.5 h-4 bg-neon-yellow left-1/2 -translate-x-1/2 -bottom-4" />
              </div>
              <div className="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                <p className={`text-lg font-bold ${getScaleColor(sentiment.fearGreedIndex)}`}>
                  {getFearGreedLabel(sentiment.fearGreedIndex)}
                </p>
                <p className="text-sm text-gray-400">
                  {sentiment.fearGreedIndex.toFixed(1)}
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bull & Bear Index */}
        <div className="bg-gunmetal-900/30 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-neon-orange" />
              <h4 className="text-lg font-medium text-gray-200">Bull & Bear Index</h4>
            </div>
            {getBullBearIcon(sentiment.bullBearIndex)}
          </div>
          
          <div className="relative pt-2 pb-12">
            {/* Scale Background with Markers */}
            <div className="relative h-2">
              <div className="absolute inset-0 bg-gradient-to-r from-neon-pink via-gray-500 to-neon-turquoise rounded-full" />
              {getScaleMarkers()}
            </div>
            
            {/* Slider Thumb */}
            <motion.div
              initial={{ x: `${sentiment.bullBearIndex}%` }}
              animate={{ x: `${sentiment.bullBearIndex}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute top-0 -ml-3"
              style={{ left: `${sentiment.bullBearIndex}%` }}
            >
              <div className="relative">
                <div className="w-6 h-6 bg-gunmetal-900 rounded-full border-2 border-neon-orange shadow-lg" />
                <div className="absolute w-0.5 h-4 bg-neon-orange left-1/2 -translate-x-1/2 -bottom-4" />
              </div>
              <div className="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                <p className={`text-lg font-bold ${getScaleColor(sentiment.bullBearIndex)}`}>
                  {getBullBearLabel(sentiment.bullBearIndex)}
                </p>
                <p className="text-sm text-gray-400">
                  {sentiment.bullBearIndex.toFixed(1)}
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Last Updated */}
        <div className="text-sm text-gray-400 text-center">
          Last updated: {new Date(sentiment.lastUpdate).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}