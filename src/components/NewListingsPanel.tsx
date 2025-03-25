import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Coins, 
  RefreshCw, 
  Loader2, 
  Clock,
  Sparkles,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Globe,
  AlertCircle
} from 'lucide-react';
import { bitmartService } from '../lib/bitmart-service';

interface NewListing {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  marketCap: number;
  listedAt: Date;
  exchange: string;
  description?: string;
}

export function NewListingsPanel({ className = "" }) {
  const [listings, setListings] = useState<NewListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchListings();
    
    // Update every 5 minutes
    const interval = setInterval(fetchListings, 300000);
    return () => clearInterval(interval);
  }, []);

  const fetchListings = async () => {
    try {
      setError(null);
      if (!refreshing) setLoading(true);

      // In a real implementation, this would fetch from an API
      // For demo, generate synthetic data
      const demoListings: NewListing[] = [
        {
          symbol: 'PEPE2/USDT',
          name: 'Pepe 2.0',
          price: 0.000001234,
          change: 156.78,
          volume: 2345678,
          marketCap: 12345678,
          listedAt: new Date(Date.now() - 25 * 60000), // 25 minutes ago
          exchange: 'BitMart',
          description: 'The next generation of meme tokens'
        },
        {
          symbol: 'AI/USDT',
          name: 'AiCoin',
          price: 0.45,
          change: 89.32,
          volume: 1234567,
          marketCap: 9876543,
          listedAt: new Date(Date.now() - 45 * 60000), // 45 minutes ago
          exchange: 'BitMart',
          description: 'AI-powered DeFi ecosystem'
        }
      ];

      setListings(demoListings);
    } catch (error) {
      console.error('Error fetching new listings:', error);
      setError('Failed to fetch new listings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchListings();
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (loading && !refreshing) {
    return (
      <div className={`flex items-center justify-center h-32 ${className}`}>
        <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-neon-pink/10 border border-neon-pink/20 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-3 text-neon-pink">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-neon-orange" />
          <h3 className="text-lg font-semibold gradient-text">New Listings</h3>
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

      <div className="space-y-3">
        <AnimatePresence>
          {listings.map((listing) => (
            <motion.div
              key={listing.symbol}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-gunmetal-900/30 rounded-lg p-4 hover:bg-gunmetal-800/30 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-semibold text-gray-200">{listing.name}</h4>
                    <span className="px-2 py-0.5 text-xs font-medium bg-neon-orange/20 text-neon-orange rounded-full">
                      New
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{listing.symbol}</p>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-lg font-mono font-bold text-gray-200">
                    ${listing.price.toFixed(listing.price < 0.01 ? 8 : 2)}
                  </div>
                  <div className={`flex items-center gap-1 ${
                    listing.change >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'
                  }`}>
                    {listing.change >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {listing.change >= 0 ? '+' : ''}{listing.change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-gunmetal-900/30 p-2 rounded-lg">
                  <div className="flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-neon-yellow" />
                    <span className="text-xs text-gray-400">Listed</span>
                  </div>
                  <p className="text-sm font-medium text-neon-yellow">
                    {formatTimeAgo(listing.listedAt)}
                  </p>
                </div>
                <div className="bg-gunmetal-900/30 p-2 rounded-lg">
                  <div className="flex items-center gap-1 mb-1">
                    <DollarSign className="w-3 h-3 text-neon-turquoise" />
                    <span className="text-xs text-gray-400">Market Cap</span>
                  </div>
                  <p className="text-sm font-medium text-neon-turquoise">
                    ${(listing.marketCap / 1000000).toFixed(1)}M
                  </p>
                </div>
                <div className="bg-gunmetal-900/30 p-2 rounded-lg">
                  <div className="flex items-center gap-1 mb-1">
                    <Globe className="w-3 h-3 text-neon-pink" />
                    <span className="text-xs text-gray-400">Exchange</span>
                  </div>
                  <p className="text-sm font-medium text-neon-pink">
                    {listing.exchange}
                  </p>
                </div>
              </div>

              {listing.description && (
                <p className="text-sm text-gray-400 line-clamp-1">
                  {listing.description}
                </p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}