import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, RefreshCw, Loader2 } from 'lucide-react';
import { globalCacheService } from '../lib/global-cache-service';
import { formatDistanceToNow } from 'date-fns';

interface NewsWidgetProps {
  assets: string[];
  limit?: number;
}

export function NewsWidget({ assets = [], limit = 4 }: NewsWidgetProps) {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

  const fetchNews = useCallback(async () => {
    try {
      setError(null);
      if (!refreshing) setLoading(true);

      const newsAssets = assets.length > 0 ? assets : ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];

      // Use the global cache service instead of direct API call
      const newsItems = await globalCacheService.getNewsForAssets(newsAssets);
      setNews(newsItems.slice(0, limit));

      // Get the last update time from the cache service
      const lastUpdate = globalCacheService.getNewsLastUpdate();
      setLastUpdateTime(lastUpdate);
    } catch (err) {
      setError('Failed to load news');
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [assets, limit, refreshing]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      // Force a refresh of the global cache
      await globalCacheService.forceRefreshNews();
      // Then fetch the updated news
      await fetchNews();
    } catch (error) {
      console.error('Error refreshing news:', error);
      setError('Failed to refresh news');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(limit)].map((_, i) => (
          <div key={i} className="h-24 bg-gunmetal-800/30 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold gradient-text">Latest News</h2>
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
      </div>
    </div>
  );
}
