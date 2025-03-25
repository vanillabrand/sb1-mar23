import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2, 
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  DollarSign,
  Coins,
  AlertCircle,
  Wallet
} from 'lucide-react';
import { exchangeService } from '../lib/exchange-service';
import { websocketService } from '../lib/websocket-service';
import { motion, AnimatePresence } from 'framer-motion';
import { logService } from '../lib/log-service';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface AssetBalance {
  symbol: string;
  name: string;
  free: number;
  used: number;
  total: number;
  usdValue: number;
  change24h: number;
  priceHistory?: { timestamp: number; price: number }[];
}

export function ExchangeBalances() {
  const [balances, setBalances] = useState<AssetBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'name' | 'change'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const priceHistoryMap = useRef<Map<string, { timestamp: number; price: number }[]>>(new Map());

  // Filter and sort balances using useMemo
  const filteredBalances = useMemo(() => {
    return balances
      .filter(balance => {
        // Apply search filter
        const matchesSearch = balance.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            balance.name.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Apply zero balance filter
        const hasBalance = showZeroBalances || balance.total > 0;
        
        return matchesSearch && hasBalance;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'value':
            comparison = (b.usdValue || 0) - (a.usdValue || 0);
            break;
          case 'name':
            comparison = a.symbol.localeCompare(b.symbol);
            break;
          case 'change':
            comparison = (b.change24h || 0) - (a.change24h || 0);
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [balances, searchTerm, sortBy, sortOrder, showZeroBalances]);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Ensure exchange service is initialized
        await exchangeService.ensureInitialized();
        setInitialized(true);
        await fetchBalances();

        // Set up WebSocket listeners
        websocketService.on('balance', handleBalanceUpdate);
        websocketService.on('ticker', handleTickerUpdate);

      } catch (error) {
        logService.log('error', 'Failed to initialize exchange service', error, 'ExchangeBalances');
        setError('Failed to initialize exchange connection');
        setLoading(false);
      }
    };

    initialize();

    return () => {
      websocketService.off('balance', handleBalanceUpdate);
      websocketService.off('ticker', handleTickerUpdate);
    };
  }, []);

  const handleBalanceUpdate = (data: any) => {
    if (!data?.symbol) return;
    
    setBalances(prev => {
      const updated = [...prev];
      const index = updated.findIndex(b => b.symbol === data.symbol);
      if (index >= 0) {
        updated[index] = {
          ...updated[index],
          free: Number(data.free) || 0,
          used: Number(data.used) || 0,
          total: Number(data.total) || 0
        };
      }
      return updated;
    });
  };

  const handleTickerUpdate = (data: any) => {
    if (!data?.symbol) return;
    
    // Update price history
    const history = priceHistoryMap.current.get(data.symbol) || [];
    const price = Number(data.price) || 0;
    const now = Date.now();
    
    // Keep last 50 price points
    history.push({ timestamp: now, price });
    if (history.length > 50) {
      history.shift();
    }
    priceHistoryMap.current.set(data.symbol, history);
    
    setBalances(prev => {
      const updated = [...prev];
      const index = updated.findIndex(b => b.symbol === data.symbol);
      if (index >= 0) {
        const price = Number(data.price) || 0;
        const total = updated[index].total || 0;
        updated[index] = {
          ...updated[index],
          usdValue: price * total,
          change24h: Number(data.change24h) || 0,
          priceHistory: [...history]
        };
      }
      return updated;
    });
  };

  useEffect(() => {
    if (!initialized) return;

    // Set up periodic updates
    const interval = setInterval(() => {
      fetchBalances();
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [initialized]);

  const fetchBalances = async () => {
    try {
      setError(null);
      if (!refreshing) setLoading(true);

      // Generate demo data if in demo mode
      if (exchangeService.isDemo()) {
        const demoBalances = generateDemoBalances();
        setBalances(demoBalances);
        setTotalValue(demoBalances.reduce((sum, b) => sum + (b.usdValue || 0), 0));
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch real balances
      const balanceData = await exchangeService.fetchBalance();
      const tickers = await exchangeService.fetchAllTickers();

      const processedBalances: AssetBalance[] = [];
      let totalUsdValue = 0;

      // Process each balance
      for (const symbol in balanceData) {
        const balance = balanceData[symbol];
        if (!balance) continue;
        
        const total = Number(balance.total) || 0;
        if (total <= 0 && !showZeroBalances) continue;

        // Find ticker for this asset
        const ticker = tickers.find(t => t.symbol === `${symbol}/USDT`);
        const price = ticker ? Number(ticker.last_price) || 0 : 0;
        const change24h = ticker ? Number(ticker.percentage) || 0 : 0;
        const usdValue = total * price;

        totalUsdValue += usdValue;

        // Get or initialize price history
        let priceHistory = priceHistoryMap.current.get(symbol) || [];
        if (price > 0) {
          const now = Date.now();
          priceHistory.push({ timestamp: now, price });
          if (priceHistory.length > 50) {
            priceHistory.shift();
          }
          priceHistoryMap.current.set(symbol, priceHistory);
        }

        processedBalances.push({
          symbol,
          name: symbol,
          free: Number(balance.free) || 0,
          used: Number(balance.used) || 0,
          total,
          usdValue,
          change24h,
          priceHistory
        });
      }

      setBalances(processedBalances);
      setTotalValue(totalUsdValue);

      logService.log('info', 'Successfully fetched balances', null, 'ExchangeBalances');
    } catch (error) {
      setError('Failed to fetch balances');
      logService.log('error', 'Error fetching balances:', error, 'ExchangeBalances');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateDemoBalances = (): AssetBalance[] => {
    const demoAssets = [
      { symbol: 'BTC', price: 45000, change: 2.5 },
      { symbol: 'ETH', price: 3000, change: -1.2 },
      { symbol: 'SOL', price: 100, change: 5.7 },
      { symbol: 'BNB', price: 300, change: 1.8 },
      { symbol: 'USDT', price: 1, change: 0 }
    ];

    return demoAssets.map(asset => {
      const total = Math.random() * 10;
      const price = asset.price * (1 + (Math.random() - 0.5) * 0.002);
      
      // Generate synthetic price history
      const history = Array.from({ length: 50 }, (_, i) => ({
        timestamp: Date.now() - (50 - i) * 60000,
        price: asset.price * (1 + (Math.random() - 0.5) * 0.1)
      }));
      
      priceHistoryMap.current.set(asset.symbol, history);

      return {
        symbol: asset.symbol,
        name: asset.symbol,
        free: Math.random() * 10,
        used: Math.random() * 2,
        total,
        usdValue: price * total,
        change24h: asset.change,
        priceHistory: history
      };
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBalances();
  };

  const formatNumber = (value: number | undefined, decimals: number = 2): string => {
    if (value === undefined || isNaN(value)) return '0.00';
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  if (!initialized && loading) {
    return (
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-neon-turquoise" />
          <h3 className="text-xl font-bold text-gray-200">Asset Balances</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 bg-gunmetal-800/50 rounded-lg text-gray-400 hover:text-neon-turquoise transition-all disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <RefreshCw className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Total Value */}
      <div className="bg-gunmetal-800/30 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Total Portfolio Value</p>
            <p className="text-2xl font-bold text-neon-turquoise">
              ${formatNumber(totalValue)}
            </p>
          </div>
          <DollarSign className="w-8 h-8 text-neon-turquoise opacity-50" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search assets..."
            className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'value' | 'name' | 'change')}
            className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
          >
            <option value="value">Sort by Value</option>
            <option value="name">Sort by Name</option>
            <option value="change">Sort by Change</option>
          </select>

          <button
            onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
            className="p-2 bg-gunmetal-800 rounded-lg text-gray-400 hover:text-neon-turquoise transition-colors"
          >
            <ChevronDown className={`w-5 h-5 transform transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={() => setShowZeroBalances(!showZeroBalances)}
            className={`p-2 rounded-lg transition-colors ${
              showZeroBalances 
                ? 'bg-neon-turquoise/20 text-neon-turquoise' 
                : 'bg-gunmetal-800 text-gray-400 hover:text-neon-turquoise'
            }`}
            title={showZeroBalances ? 'Hide zero balances' : 'Show zero balances'}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Balances Table */}
      {loading && !refreshing ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-neon-turquoise animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-neon-pink/10 border border-neon-pink/20 text-neon-pink rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      ) : filteredBalances.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No assets found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gunmetal-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Asset</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Available</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">In Use</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Value</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">24h Change</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Price Chart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gunmetal-800">
              <AnimatePresence>
                {filteredBalances.map((balance) => (
                  <motion.tr
                    key={balance.symbol}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="hover:bg-gunmetal-800/30"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="font-medium text-gray-200">{balance.symbol}</div>
                          <div className="text-sm text-gray-400">{balance.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="font-mono text-gray-200">
                        {formatNumber(balance.total, balance.symbol === 'BTC' ? 8 : 2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="font-mono text-gray-200">
                        {formatNumber(balance.free, balance.symbol === 'BTC' ? 8 : 2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="font-mono text-gray-200">
                        {formatNumber(balance.used, balance.symbol === 'BTC' ? 8 : 2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-200">
                      ${formatNumber(balance.usdValue)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right font-mono ${
                      (balance.change24h || 0) >= 0 ? 'text-neon-turquoise' : 'text-neon-pink'
                    }`}>
                      <div className="flex items-center justify-end gap-1">
                        {(balance.change24h || 0) >= 0 ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                        {(balance.change24h || 0) >= 0 ? '+' : ''}{formatNumber(balance.change24h)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-24 h-12">
                        {balance.priceHistory && balance.priceHistory.length > 0 && (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={balance.priceHistory}>
                              <defs>
                                <linearGradient id={`gradient-${balance.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop 
                                    offset="5%" 
                                    stopColor={(balance.change24h || 0) >= 0 ? "#2dd4bf" : "#ec4899"} 
                                    stopOpacity={0.3}
                                  />
                                  <stop 
                                    offset="95%" 
                                    stopColor={(balance.change24h || 0) >= 0 ? "#2dd4bf" : "#ec4899"} 
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="price"
                                stroke={(balance.change24h || 0) >= 0 ? "#2dd4bf" : "#ec4899"}
                                fill={`url(#gradient-${balance.symbol})`}
                                strokeWidth={1}
                                dot={false}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}