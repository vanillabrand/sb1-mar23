import React, { useState, useEffect } from 'react';
import { Wallet, Loader2, RefreshCw } from 'lucide-react';
import { exchangeService } from '../lib/exchange-service';
import { websocketService } from '../lib/websocket-service';
import { logService } from '../lib/log-service';
import { motion, AnimatePresence } from 'framer-motion';

interface WalletBalance {
  free: number;
  used: number;
  total: number;
  currency: string;
}

interface MarketBalances {
  spot?: WalletBalance;
  margin?: WalletBalance;
  futures?: WalletBalance;
}

export const SidenavBalances: React.FC = () => {
  const [balances, setBalances] = useState<MarketBalances>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Ensure exchange service is initialized
        await exchangeService.ensureInitialized();
        setInitialized(true);
        await fetchBalances();

        // Set up WebSocket listeners for balance updates
        websocketService.on('balance', handleBalanceUpdate);
      } catch (error) {
        logService.log('error', 'Failed to initialize exchange service', error, 'SidenavBalances');
        setError('Failed to initialize exchange connection');
        setLoading(false);
      }
    };

    initialize();

    return () => {
      websocketService.off('balance', handleBalanceUpdate);
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;

    // Set up periodic updates
    const interval = setInterval(() => {
      fetchBalances();
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [initialized]);

  const handleBalanceUpdate = (data: any) => {
    if (!data) return;

    setBalances(prev => ({
      ...prev,
      ...data
    }));
  };

  const fetchBalances = async () => {
    try {
      setError(null);
      if (!refreshing) setLoading(true);
      setRefreshing(true);

      // Fetch balances from exchange service
      const walletBalances = await exchangeService.fetchAllWalletBalances();
      
      setBalances(walletBalances);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      logService.log('error', 'Failed to fetch balances', error, 'SidenavBalances');
      setError('Failed to fetch balances');
      setLoading(false);
      setRefreshing(false);
      
      // In case of error, generate demo balances
      if (exchangeService.isDemo()) {
        generateDemoBalances();
      }
    }
  };

  const generateDemoBalances = () => {
    // Create demo balances for different market types
    setBalances({
      spot: {
        free: 10000,
        used: 2000,
        total: 12000,
        currency: 'USDT'
      },
      margin: {
        free: 5000,
        used: 1000,
        total: 6000,
        currency: 'USDT'
      },
      futures: {
        free: 8000,
        used: 3000,
        total: 11000,
        currency: 'USDT'
      }
    });
    
    setLoading(false);
    setRefreshing(false);
  };

  const handleRefresh = () => {
    if (refreshing) return;
    fetchBalances();
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  return (
    <div className="px-4 py-3 mb-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-neon-turquoise" />
          <span className="text-sm font-medium text-gray-300">Balances</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1 bg-gunmetal-800/50 rounded-md text-gray-400 hover:text-neon-turquoise transition-all disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
        </button>
      </div>

      {loading && !refreshing ? (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 text-neon-turquoise animate-spin" />
        </div>
      ) : error ? (
        <div className="text-xs text-neon-pink py-1">{error}</div>
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {/* Spot Balance */}
            {balances.spot && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="bg-gunmetal-800/30 rounded-md p-2"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Spot</span>
                  <span className="text-xs font-medium text-neon-turquoise">
                    ${formatNumber(balances.spot.total)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-500">Available</span>
                  <span className="text-xs text-gray-300">${formatNumber(balances.spot.free)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">In Use</span>
                  <span className="text-xs text-gray-300">${formatNumber(balances.spot.used)}</span>
                </div>
              </motion.div>
            )}

            {/* Margin Balance */}
            {balances.margin && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="bg-gunmetal-800/30 rounded-md p-2"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Margin</span>
                  <span className="text-xs font-medium text-neon-turquoise">
                    ${formatNumber(balances.margin.total)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-500">Available</span>
                  <span className="text-xs text-gray-300">${formatNumber(balances.margin.free)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">In Use</span>
                  <span className="text-xs text-gray-300">${formatNumber(balances.margin.used)}</span>
                </div>
              </motion.div>
            )}

            {/* Futures Balance */}
            {balances.futures && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="bg-gunmetal-800/30 rounded-md p-2"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Futures</span>
                  <span className="text-xs font-medium text-neon-turquoise">
                    ${formatNumber(balances.futures.total)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-500">Available</span>
                  <span className="text-xs text-gray-300">${formatNumber(balances.futures.free)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">In Use</span>
                  <span className="text-xs text-gray-300">${formatNumber(balances.futures.used)}</span>
                </div>
              </motion.div>
            )}

            {/* No balances message */}
            {!balances.spot && !balances.margin && !balances.futures && (
              <div className="text-xs text-gray-400 text-center py-2">
                No balances available
              </div>
            )}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};
