import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { newsService } from '../lib/news-service';

interface PanelWrapperProps {
  children: React.ReactNode;
  index: number;
  className?: string;
}

const PanelWrapper: React.FC<PanelWrapperProps> = ({ children, index, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`bg-gradient-to-br from-gunmetal-900/50 to-gunmetal-800/30 backdrop-blur-sm ${className}`}
    >
      {children}
    </motion.div>
  );
};

interface NewsWidgetProps {
  assets: string[];
  limit?: number;
}

export function NewsWidget({ assets = [], limit = 4 }: NewsWidgetProps) {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Memoize news fetching function
  const fetchNews = useCallback(async () => {
    try {
      setError(null);
      
      // Use default assets if none provided
      const newsAssets = assets.length > 0 
        ? assets 
        : ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];

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

  const getAssetColor = (asset: string): string => {
    const colors: Record<string, string> = {
      BTC: 'text-bitcoin',
      ETH: 'text-ethereum',
      SOL: 'text-solana',
      BNB: 'text-binance',
      XRP: 'text-ripple',
      default: 'text-gray-400'
    };
    return colors[asset] || colors.default;
  };

  const displayedNews = news.slice(currentPage * limit, (currentPage + 1) * limit);

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
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="space-y-4">
            {displayedNews.map((item, index) => (
              <PanelWrapper 
                key={item.id} 
                index={index}
                className="rounded-lg p-6"
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="flex items-start gap-6">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {item.relatedAssets?.slice(0, 3).map((asset: string) => (
                          <span 
                            key={asset} 
                            className={`px-2 py-0.5 text-xs font-medium bg-gunmetal-900/50 rounded-full ${getAssetColor(asset)}`}
                          >
                            {asset}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-gray-200 group-hover:text-neon-blue transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-sm text-gray-400 mt-2">
                        {item.summary}
                      </p>
                    </div>
                  </div>
                </a>
              </PanelWrapper>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
