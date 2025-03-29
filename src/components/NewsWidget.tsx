import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { newsService } from '../lib/news-service';

interface NewsWidgetProps {
  assets: string[];
  limit?: number;
}

export function NewsWidget({ assets = [], limit = 4 }: NewsWidgetProps) {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    try {
      setError(null);
      const newsAssets = assets.length > 0 ? assets : ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];
      const newsItems = await newsService.getNewsForAssets(newsAssets);
      setNews(newsItems.slice(0, limit));
    } catch (err) {
      setError('Failed to load news');
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
    }
  }, [assets, limit]);

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
            <h3 className="text-gray-200 group-hover:text-neon-blue transition-colors">
              {item.title}
            </h3>
            <p className="text-sm text-gray-400 mt-2">
              {item.summary}
            </p>
          </a>
        </motion.div>
      ))}
    </div>
  );
}
