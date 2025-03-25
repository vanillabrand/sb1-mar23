import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Newspaper, 
  ExternalLink, 
  Search,
  Calendar,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { newsService } from '../lib/news-service';
import { Pagination } from './ui/Pagination';
import { useScreenSize, ITEMS_PER_PAGE } from '../lib/hooks/useScreenSize';

interface NewsWidgetProps {
  assets?: string[];
  limit?: number;
}

export function NewsWidget({ assets = [], limit = 10 }: NewsWidgetProps) {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const screenSize = useScreenSize();
  const itemsPerPage = ITEMS_PER_PAGE[screenSize];

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getAssetColor = (asset: string): string => {
    const assetColors: Record<string, string> = {
      'BTC': 'text-neon-orange',
      'ETH': 'text-neon-turquoise',
      'SOL': 'text-neon-yellow',
      'BNB': 'text-amber-400',
      'XRP': 'text-blue-400',
      'ADA': 'text-indigo-400',
      'DOGE': 'text-yellow-300',
      'MATIC': 'text-purple-400'
    };

    for (const [key, color] of Object.entries(assetColors)) {
      if (asset.includes(key)) {
        return color;
      }
    }
    return 'text-gray-300';
  };

  // Calculate pagination
  const totalPages = Math.ceil(news.length / itemsPerPage);
  const displayedNews = news.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 text-neon-raspberry animate-spin" />
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-neon-yellow" />
          <h3 className="text-lg font-semibold gradient-text">Market News</h3>
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {displayedNews.map((item, index) => (
            <motion.a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="block bg-gradient-to-br from-gunmetal-950/95 to-gunmetal-900/95 backdrop-blur-xl rounded-lg p-6 hover:bg-gunmetal-800/90 transition-all duration-300 group"
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
                  
                  <h4 className="text-sm font-medium text-gray-200 mb-4">{item.title}</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {formatDate(item.publishedAt)}
                      </div>
                      <span className="text-sm text-gray-400">{item.source}</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            </motion.a>
          ))}
        </AnimatePresence>
      </div>

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            showPageNumbers={screenSize !== 'sm'}
          />
        </div>
      )}
    </div>
  );
}