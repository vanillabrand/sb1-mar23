import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock, RefreshCw, Loader2 } from 'lucide-react';
import { globalCacheService } from '../lib/global-cache-service';
import { formatDistanceToNow } from 'date-fns';
import { Pagination } from './ui/Pagination';
import { logService } from '../lib/log-service';
import { eventBus } from '../lib/event-bus';

interface NewsWidgetProps {
  assets: string[];
  limit?: number;
}

export function NewsWidget({ assets = [], limit = 4 }: NewsWidgetProps) {
  const [allNews, setAllNews] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(4);

  // Track if we've already fetched news to prevent multiple refreshes
  const hasFetchedRef = useRef(false);
  // Track the last time we manually refreshed
  const lastManualRefreshRef = useRef(0);
  // News refresh interval (10 minutes)
  const NEWS_REFRESH_INTERVAL = 10 * 60 * 1000;

  const fetchNews = useCallback(async (forceRefresh = false) => {
    try {
      // Check if we've already fetched and it's not a forced refresh
      if (hasFetchedRef.current && !forceRefresh) {
        // Check if we need to refresh based on time elapsed
        const now = Date.now();
        const lastUpdate = globalCacheService.getNewsLastUpdate();
        const timeSinceLastUpdate = now - lastUpdate;

        // If it's been less than 10 minutes since the last update, don't refresh
        if (timeSinceLastUpdate < NEWS_REFRESH_INTERVAL) {
          logService.log('info', `Skipping news refresh, last update was ${Math.round(timeSinceLastUpdate/1000)}s ago`, null, 'NewsWidget');
          return;
        }
      }

      setError(null);
      if (!refreshing) setLoading(true);

      let newsItems: any[] = [];

      // If specific assets are provided as props, use those
      if (assets.length > 0) {
        logService.log('info', `Fetching news for specified assets: ${assets.join(', ')}`, null, 'NewsWidget');
        newsItems = await globalCacheService.getNewsForAssets(assets);
      } else {
        // Otherwise, get news for all assets in user strategies
        logService.log('info', 'Fetching news for user strategy assets', null, 'NewsWidget');

        try {
          // Import the news service dynamically to avoid circular dependencies
          const { newsService } = await import('../lib/news-service');

          // Get news for all assets in user strategies
          newsItems = await newsService.getNewsForUserStrategies();

          logService.log('info', `Fetched ${newsItems.length} news items for user strategy assets`, null, 'NewsWidget');
        } catch (strategyError) {
          logService.log('error', 'Error fetching news for user strategies', strategyError, 'NewsWidget');

          // Fallback to default assets
          const defaultAssets = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];
          logService.log('info', `Falling back to default assets: ${defaultAssets.join(', ')}`, null, 'NewsWidget');

          newsItems = await globalCacheService.getNewsForAssets(defaultAssets);
        }
      }

      // Update state with the fetched news
      setAllNews(newsItems);

      // Update the paginated news
      updatePaginatedNews(newsItems);

      // Get the last update time from the cache service
      const lastUpdate = globalCacheService.getNewsLastUpdate();
      setLastUpdateTime(lastUpdate);

      // Mark that we've fetched news
      hasFetchedRef.current = true;

      logService.log('info', `News fetched successfully, ${newsItems.length} items`, null, 'NewsWidget');
    } catch (err) {
      setError('Failed to load news');
      logService.log('error', 'Error fetching news:', err, 'NewsWidget');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [assets, refreshing, NEWS_REFRESH_INTERVAL]);

  // Function to update paginated news
  const updatePaginatedNews = useCallback((items = allNews) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setNews(items.slice(startIndex, endIndex));
  }, [currentPage, itemsPerPage, allNews]);

  const handleRefresh = async () => {
    try {
      // Check if we've refreshed recently (within the last minute)
      const now = Date.now();
      const timeSinceLastRefresh = now - lastManualRefreshRef.current;

      if (timeSinceLastRefresh < 60000) { // 1 minute cooldown
        logService.log('info', `Manual refresh requested too soon (${Math.round(timeSinceLastRefresh/1000)}s since last refresh)`, null, 'NewsWidget');
        return;
      }

      setRefreshing(true);
      lastManualRefreshRef.current = now;

      logService.log('info', 'Manual refresh requested', null, 'NewsWidget');

      // If specific assets are provided as props, use those
      if (assets.length > 0) {
        logService.log('info', `Refreshing news for specified assets: ${assets.join(', ')}`, null, 'NewsWidget');
        // Force a refresh of the global cache for the specified assets
        await globalCacheService.forceRefreshNews(assets);
      } else {
        try {
          // Import services dynamically to avoid circular dependencies
          const { newsService } = await import('../lib/news-service');
          const { strategyService } = await import('../lib/strategy-service');

          // Get all user strategies
          const strategies = await strategyService.getAllStrategies();

          // Extract unique asset symbols from all strategies
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

              // Process each trading pair
              pairs.forEach(pair => {
                // Extract the base asset (e.g., 'BTC' from 'BTC/USDT')
                const baseAsset = pair.split(/[\/\_\-]/)[0].toUpperCase();
                if (baseAsset) assetSet.add(baseAsset);

                // Also extract the quote asset if it's not a stablecoin
                const parts = pair.split(/[\/\_\-]/);
                if (parts.length > 1) {
                  const quoteAsset = parts[1].toUpperCase();
                  // Only add quote assets that aren't stablecoins
                  if (quoteAsset && !['USDT', 'USDC', 'BUSD', 'DAI', 'USD'].includes(quoteAsset)) {
                    assetSet.add(quoteAsset);
                  }
                }
              });
            });
          }

          // Convert Set to Array
          const strategyAssets = Array.from(assetSet);

          if (strategyAssets.length > 0) {
            logService.log('info', `Refreshing news for user strategy assets: ${strategyAssets.join(', ')}`, null, 'NewsWidget');
            await globalCacheService.forceRefreshNews(strategyAssets);
          } else {
            // Fallback to default assets
            const defaultAssets = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];
            logService.log('info', `No user strategy assets found, refreshing news for default assets: ${defaultAssets.join(', ')}`, null, 'NewsWidget');
            await globalCacheService.forceRefreshNews(defaultAssets);
          }
        } catch (strategyError) {
          logService.log('error', 'Error getting user strategy assets for news refresh', strategyError, 'NewsWidget');

          // Fallback to default assets
          const defaultAssets = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];
          logService.log('info', `Falling back to default assets: ${defaultAssets.join(', ')}`, null, 'NewsWidget');
          await globalCacheService.forceRefreshNews(defaultAssets);
        }
      }

      // Then fetch the updated news with force refresh flag
      await fetchNews(true);

      logService.log('info', 'Manual refresh completed successfully', null, 'NewsWidget');
    } catch (error) {
      logService.log('error', 'Error refreshing news:', error, 'NewsWidget');
      setError('Failed to refresh news');
    } finally {
      setRefreshing(false);
    }
  };

  // Reference to track if component is mounted
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Initial fetch
    fetchNews();

    // Subscribe to strategy:caches:refreshed event
    const unsubscribe = eventBus.subscribe('strategy:caches:refreshed', (data) => {
      if (isMountedRef.current) {
        logService.log('info', 'Received strategy:caches:refreshed event, refreshing news', data, 'NewsWidget');
        fetchNews(true); // Force refresh
      }
    });

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [fetchNews]);

  // Update paginated news when page or items per page changes
  useEffect(() => {
    updatePaginatedNews();
  }, [updatePaginatedNews, currentPage, itemsPerPage]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(limit)].map((_, i) => (
          <div key={i} className="h-24 bg-gunmetal-800/30 rounded-lg" />
        ))}
      </div>
    );
  }

  // If there's an error, don't render the component
  if (error) {
    return null;
  }

  // If there are no news articles, don't render the component at all
  if (allNews.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold gradient-text">Latest News</h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 sm:p-2 bg-gunmetal-800/50 rounded-lg text-gray-400 hover:text-neon-turquoise transition-all disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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

      <div className="space-y-4">
        {news.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gradient-to-br from-gunmetal-900/50 to-gunmetal-800/30 backdrop-blur-sm rounded-lg p-6"
          >
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <h3 className="text-gray-200 group-hover:text-neon-turquoise transition-colors">
                {item.title}
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                {item.summary || item.description}
              </p>
            </a>
          </motion.div>
        ))}

        {/* Pagination */}
        {allNews.length > itemsPerPage && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(allNews.length / itemsPerPage)}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={allNews.length}
            showPageNumbers={false} // Use dots for news pagination
            showItemsPerPage={true}
            itemsPerPageOptions={[4, 6, 8]}
            onItemsPerPageChange={(newItemsPerPage) => {
              setItemsPerPage(newItemsPerPage);
              setCurrentPage(1); // Reset to first page when changing items per page
            }}
          />
        )}
      </div>
    </div>
  );
}
