import { useState, useEffect, useRef } from 'react';
import { Brain, RefreshCw, Loader2, Clock } from 'lucide-react';
import { globalCacheService } from '../lib/global-cache-service';
import { logService } from '../lib/log-service';
import { eventBus } from '../lib/event-bus';
import { ErrorBoundary } from './ErrorBoundary';
import { formatDistanceToNow } from 'date-fns';

interface AIMarketInsightProps {
  assets: Set<string>;
  className?: string;
}

interface SentimentDistribution {
  bullish: number;
  neutral: number;
  bearish: number;
}

const DEFAULT_DISTRIBUTION: SentimentDistribution = {
  bullish: 33,
  neutral: 34,
  bearish: 33
};

function AIMarketInsightContent({ assets, className = "" }: AIMarketInsightProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [sentimentDistribution, setSentimentDistribution] =
    useState<SentimentDistribution>(DEFAULT_DISTRIBUTION);

  const calculateSentimentDistribution = (marketInsights: any): SentimentDistribution => {
    if (!marketInsights?.assets?.length) {
      return DEFAULT_DISTRIBUTION;
    }

    const distribution = marketInsights.assets.reduce((acc: any, asset: any) => {
      const sentiment = asset?.sentiment?.toLowerCase() || 'neutral';
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, { bullish: 0, neutral: 0, bearish: 0 });

    const total = marketInsights.assets.length;
    return {
      bullish: Math.round((distribution.bullish / total) * 100) || 0,
      neutral: Math.round((distribution.neutral / total) * 100) || 0,
      bearish: Math.round((distribution.bearish / total) * 100) || 0
    };
  };

  const fetchInsights = async () => {
    try {
      setError(null);

      // Start with loading state
      setLoading(true);

      // Get assets from props or from user strategies
      let assetList: string[];

      if (assets.size > 0) {
        // Use assets from props if provided
        assetList = Array.from(assets);
      } else {
        try {
          // Import strategy service dynamically to avoid circular dependencies
          const { strategyService } = await import('../lib/strategy-service');

          // Get all strategies (both active and inactive)
          const strategies = await strategyService.getAllStrategies();

          // Extract unique asset pairs from all strategies
          const assetSet = new Set<string>();

          if (strategies && strategies.length > 0) {
            strategies.forEach(strategy => {
              // Extract trading pairs from various possible locations
              let pairs: string[] = [];

              if (strategy.selected_pairs && strategy.selected_pairs.length > 0) {
                pairs = strategy.selected_pairs;
              } else if (strategy.strategy_config?.assets && strategy.strategy_config.assets.length > 0) {
                pairs = strategy.strategy_config.assets;
              } else if (strategy.strategy_config?.config?.pairs && strategy.strategy_config.config.pairs.length > 0) {
                pairs = strategy.strategy_config.config.pairs;
              }

              // Add each pair to the set
              pairs.forEach(pair => {
                // Normalize pair format (ensure it uses underscores for DeepSeek API)
                const normalizedPair = pair.includes('/') ? pair.replace('/', '_') : pair;
                assetSet.add(normalizedPair);
              });
            });
          }

          // Convert Set to Array
          assetList = Array.from(assetSet);

          // If no assets found, use defaults
          if (assetList.length === 0) {
            assetList = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT'];
          }

          logService.log('info', 'Using assets from user strategies for market insights', { assets: assetList }, 'AIMarketInsight');
        } catch (strategyError) {
          logService.log('error', 'Error getting user strategy assets', strategyError, 'AIMarketInsight');
          // Fallback to default assets
          assetList = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT'];
        }
      }

      // First, try to get insights from localStorage for immediate display
      try {
        const cachedInsightsStr = localStorage.getItem('marketInsightsCache');
        if (cachedInsightsStr) {
          const cachedInsights = JSON.parse(cachedInsightsStr);
          const cacheKey = assetList.sort().join(',');

          if (cachedInsights[cacheKey]) {
            // Show cached data immediately
            setInsights(cachedInsights[cacheKey]);
            const distribution = calculateSentimentDistribution(cachedInsights[cacheKey]);
            setSentimentDistribution(distribution);

            // Get the last update time
            const lastUpdateTime = localStorage.getItem('marketInsightsLastUpdate');
            if (lastUpdateTime) {
              setLastUpdateTime(parseInt(lastUpdateTime, 10));
            }

            // We still have data loading, but we're showing something immediately
            setLoading(false);
          }
        }
      } catch (cacheError) {
        logService.log('warn', 'Error reading from localStorage cache', cacheError, 'AIMarketInsight');
        // Continue with normal loading
      }

      // Use the global cache service to get the latest data (may be from cache or fresh)
      // Pass skipRefresh=true to prevent triggering background refreshes
      const marketInsights = await globalCacheService.getMarketInsights(assetList, true);
      setInsights(marketInsights);

      logService.log('info', 'Successfully fetched market insights', { timestamp: Date.now() }, 'AIMarketInsight');

      const distribution = calculateSentimentDistribution(marketInsights);
      setSentimentDistribution(distribution);

      // Get the last update time from the cache service
      const lastUpdateTime = globalCacheService.getMarketInsightsLastUpdate();
      setLastUpdateTime(lastUpdateTime);
    } catch (err) {
      setError('Failed to generate market insights');
      logService.log('error', 'Error fetching market insights', err, 'AIMarketInsight');
      setSentimentDistribution(DEFAULT_DISTRIBUTION);
    } finally {
      // Ensure loading state is turned off
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reference to track if component is mounted
  const isMountedRef = useRef(true);
  // Reference to track if we're already fetching to prevent loops
  const isFetchingRef = useRef(false);
  // Reference to track the last fetch time to prevent too frequent updates
  const lastFetchTimeRef = useRef(0);

  useEffect(() => {
    // Initial fetch only if we haven't fetched recently
    const now = Date.now();
    if (!isFetchingRef.current && (now - lastFetchTimeRef.current > 10000)) {
      isFetchingRef.current = true;
      lastFetchTimeRef.current = now;

      fetchInsights().finally(() => {
        if (isMountedRef.current) {
          isFetchingRef.current = false;
        }
      });
    }

    // Subscribe to strategy:caches:refreshed event
    const unsubscribe = eventBus.subscribe('strategy:caches:refreshed', (data) => {
      if (isMountedRef.current && !isFetchingRef.current) {
        logService.log('info', 'Received strategy:caches:refreshed event, refreshing market insights', data, 'AIMarketInsight');

        isFetchingRef.current = true;
        lastFetchTimeRef.current = Date.now();

        fetchInsights().finally(() => {
          if (isMountedRef.current) {
            isFetchingRef.current = false;
          }
        });
      }
    });

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [assets]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);

      // Get assets from props or from user strategies
      let assetList: string[];

      if (assets.size > 0) {
        // Use assets from props if provided
        assetList = Array.from(assets);
      } else {
        try {
          // Import strategy service dynamically to avoid circular dependencies
          const { strategyService } = await import('../lib/strategy-service');

          // Get all strategies (both active and inactive)
          const strategies = await strategyService.getAllStrategies();

          // Extract unique asset pairs from all strategies
          const assetSet = new Set<string>();

          if (strategies && strategies.length > 0) {
            strategies.forEach(strategy => {
              // Extract trading pairs from various possible locations
              let pairs: string[] = [];

              if (strategy.selected_pairs && strategy.selected_pairs.length > 0) {
                pairs = strategy.selected_pairs;
              } else if (strategy.strategy_config?.assets && strategy.strategy_config.assets.length > 0) {
                pairs = strategy.strategy_config.assets;
              } else if (strategy.strategy_config?.config?.pairs && strategy.strategy_config.config.pairs.length > 0) {
                pairs = strategy.strategy_config.config.pairs;
              }

              // Add each pair to the set
              pairs.forEach(pair => {
                // Normalize pair format (ensure it uses underscores for DeepSeek API)
                const normalizedPair = pair.includes('/') ? pair.replace('/', '_') : pair;
                assetSet.add(normalizedPair);
              });
            });
          }

          // Convert Set to Array
          assetList = Array.from(assetSet);

          // If no assets found, use defaults
          if (assetList.length === 0) {
            assetList = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT'];
          }
        } catch (strategyError) {
          console.error('Error getting user strategy assets:', strategyError);
          // Fallback to default assets
          assetList = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT'];
        }
      }

      // Force a refresh of the global cache with the specific assets
      await globalCacheService.forceRefreshMarketInsights(assetList);

      // Then fetch the updated insights
      await fetchInsights();
    } catch (error) {
      logService.log('error', 'Error refreshing market insights', error, 'AIMarketInsight');
      setError('Failed to refresh market insights');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && !insights) {
    return (
      <div className={`${className} flex flex-col items-center justify-center h-[300px]`}>
        <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin mb-4" />
        <p className="text-sm text-gray-400">Generating market insights...</p>
      </div>
    );
  }

  // Loading indicator is now directly included in the JSX return

  if (error && !insights) {
    return (
      <div className={`${className} flex flex-col items-center justify-center h-[300px]`}>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className={`${className} relative`}>
      {loading && insights && (
        <div className="absolute top-0 left-0 right-0 bg-gunmetal-900/80 p-2 rounded-t-lg flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-neon-turquoise animate-spin mr-2" />
          <span className="text-xs text-gray-400">Updating insights...</span>
        </div>
      )}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-neon-turquoise" />
            <h2 className="text-lg font-semibold gradient-text">AI Market Insight</h2>
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

        {lastUpdateTime > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>Updated {formatDistanceToNow(new Date(lastUpdateTime))} ago</span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Strategic Recommendations */}
        {insights?.recommendations?.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-neon-turquoise mb-3">
              Strategic Recommendations
            </h3>
            <div className="grid gap-3">
              {insights.recommendations.map((rec: string, index: number) => (
                <div
                  key={index}
                  className="bg-gunmetal-800/30 rounded-lg p-4 hover:bg-gunmetal-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-neon-turquoise"></div>
                    <p className="text-sm text-gray-300">{rec}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sentiment Distribution */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gunmetal-800/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-neon-turquoise mb-1">
              {sentimentDistribution?.bullish ?? 0}%
            </div>
            <div className="text-sm text-gray-400">Bullish Signals</div>
          </div>
          <div className="bg-gunmetal-800/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-neon-yellow mb-1">
              {sentimentDistribution?.neutral ?? 0}%
            </div>
            <div className="text-sm text-gray-400">Neutral Signals</div>
          </div>
          <div className="bg-gunmetal-800/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-neon-pink mb-1">
              {sentimentDistribution?.bearish ?? 0}%
            </div>
            <div className="text-sm text-gray-400">Bearish Signals</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIMarketInsight(props: AIMarketInsightProps) {
  return (
    <ErrorBoundary fallback={
      <div className="p-4 bg-gunmetal-800/30 rounded-lg">
        <p className="text-gray-400">Failed to load market insights</p>
      </div>
    }>
      <AIMarketInsightContent {...props} />
    </ErrorBoundary>
  );
}
