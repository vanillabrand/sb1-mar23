import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock, RefreshCw, Loader2 } from 'lucide-react';
import { globalCacheService } from '../lib/global-cache-service';
import { formatDistanceToNow } from 'date-fns';
import { Pagination } from './ui/Pagination';
import { logService } from '../lib/log-service';

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

      const newsAssets = assets.length > 0 ? assets : ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];

      logService.log('info', `Fetching news for assets: ${newsAssets.join(', ')}`, null, 'NewsWidget');

      // Use the global cache service instead of direct API call
      const newsItems = await globalCacheService.getNewsForAssets(newsAssets);
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

      // Force a refresh of the global cache
      await globalCacheService.forceRefreshNews();

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

  useEffect(() => {
    fetchNews();
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
