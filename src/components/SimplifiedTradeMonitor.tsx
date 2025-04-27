import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/enhanced-supabase';
import { logService } from '../lib/log-service';
import type { Strategy } from '../lib/types';

/**
 * A simplified version of the TradeMonitor component that loads only the essential data
 * and provides a basic UI. This is used as a fallback when the main TradeMonitor fails.
 */
export const SimplifiedTradeMonitor: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  // Load strategies on component mount
  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get strategies directly from the database
        const { data: fetchedStrategies, error } = await supabase
          .from('strategies')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setStrategies(fetchedStrategies || []);
        setLastUpdate(Date.now());
      } catch (error) {
        console.error('Failed to fetch strategies:', error);
        logService.log('error', 'Failed to fetch strategies in simplified monitor', error, 'SimplifiedTradeMonitor');
        setError('Failed to load strategies. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStrategies();
  }, []);

  // Refresh data manually
  const refresh = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get strategies directly from the database
      const { data: fetchedStrategies, error } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setStrategies(fetchedStrategies || []);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error('Failed to refresh strategies:', error);
      logService.log('error', 'Failed to refresh strategies in simplified monitor', error, 'SimplifiedTradeMonitor');
      setError('Failed to refresh strategies. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-6 sm:p-8 mobile-p-4 overflow-x-hidden pb-24 sm:pb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 max-w-[1800px] mx-auto"
      >
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-6 h-6 text-neon-pink" />
              <h1 className="text-2xl font-bold gradient-text">Trade Monitor (Simplified)</h1>
            </div>
            <p className="description-text mt-1 text-gray-300">
              This is a simplified version of the Trade Monitor. For full functionality, please refresh the page.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Last update: {new Date(lastUpdate).toLocaleTimeString()}
            </span>
            <button
              onClick={refresh}
              disabled={isLoading}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {strategies.length === 0 ? (
              <div className="text-center py-12 bg-gunmetal-800/50 rounded-lg">
                <div className="flex justify-center mb-4">
                  <Activity className="w-12 h-12 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">No strategies found</h3>
                <p className="text-gray-400 max-w-md mx-auto">
                  You don't have any strategies yet. Create a strategy to start trading.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {strategies.map((strategy) => (
                  <div key={strategy.id} className="bg-gunmetal-800 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-medium text-white">
                          {(strategy as any).name || (strategy as any).title || 'Unnamed Strategy'}
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                          {(strategy as any).description || 'No description'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          strategy.status === 'active' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {strategy.status || 'inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(strategy.selected_pairs || []).map((pair) => (
                        <span key={pair} className="px-2 py-1 bg-gunmetal-700 rounded-md text-xs text-gray-300">
                          {pair}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
