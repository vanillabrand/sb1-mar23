import React, { useState, useEffect } from 'react';
import { cacheService } from '../lib/cache-service';
import { enhancedSupabase } from '../lib/enhanced-supabase';

const CacheStats: React.FC = () => {
  const [stats, setStats] = useState<Record<string, any>>({});
  const [expanded, setExpanded] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  useEffect(() => {
    // Load stats on mount
    loadStats();

    // Set up refresh interval
    const interval = window.setInterval(() => {
      loadStats();
    }, 5000); // Refresh every 5 seconds

    setRefreshInterval(interval);

    // Clean up
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  const loadStats = () => {
    // Get cache stats from all namespaces
    const namespaces = cacheService.getNamespaces();
    const allStats: Record<string, any> = {};

    namespaces.forEach(namespace => {
      const namespaceStats = cacheService.getStats(namespace);
      if (namespaceStats) {
        allStats[namespace] = namespaceStats;
      }
    });

    // Get Supabase cache stats
    const supabaseStats = enhancedSupabase.getCacheStats();
    Object.entries(supabaseStats).forEach(([key, value]) => {
      if (value) {
        allStats[`supabase_${key}`] = value;
      }
    });

    setStats(allStats);
  };

  const handleClearCache = (namespace: string) => {
    cacheService.clear(namespace);
    loadStats();
  };

  const handleClearAllCaches = () => {
    Object.keys(stats).forEach(namespace => {
      cacheService.clear(namespace);
    });
    loadStats();
  };

  const formatHitRatio = (hits: number, misses: number) => {
    const total = hits + misses;
    if (total === 0) return '0%';
    return `${Math.round((hits / total) * 100)}%`;
  };

  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Cache Statistics</h2>
        <div className="flex space-x-2">
          <button
            onClick={loadStats}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button
            onClick={handleClearAllCaches}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear All
          </button>
        </div>
      </div>

      {Object.keys(stats).length === 0 ? (
        <div className="text-center py-4 text-gray-400">No cache statistics available</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4 font-medium text-gray-400 text-sm">
            <div>Namespace</div>
            <div>Size</div>
            <div>Hit Ratio</div>
            <div>Actions</div>
          </div>

          {Object.entries(stats).map(([namespace, stat]) => (
            <div key={namespace} className="border-t border-gray-800 pt-3">
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="font-medium">{namespace}</div>
                <div>
                  {stat.size} / {stat.maxSize}
                  <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                    <div
                      className="bg-blue-500 h-1 rounded-full"
                      style={{ width: `${(stat.size / stat.maxSize) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  {formatHitRatio(stat.hits, stat.misses)}
                  <div className="text-xs text-gray-500">
                    {stat.hits} hits, {stat.misses} misses
                  </div>
                </div>
                <div>
                  <button
                    onClick={() => handleClearCache(namespace)}
                    className="px-2 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="mt-2 pl-4 text-sm text-gray-400 grid grid-cols-2 gap-2">
                  <div>TTL: {stat.ttl / 1000}s</div>
                  <div>Last Updated: {new Date().toLocaleTimeString()}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CacheStats;
