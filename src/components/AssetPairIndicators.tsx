import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { bitmartService } from '../lib/bitmart-service';
import { logService } from '../lib/log-service';
import { websocketService } from '../lib/websocket-service';
import { ccxtService } from '../lib/ccxt-service';
import { demoService } from '../lib/demo-service';
import { ArrowUpIcon, ArrowDownIcon, RefreshCw, BarChart3 } from 'lucide-react';

// Comprehensive list of asset pairs
const ASSET_PAIRS = [
  'BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT', 'XRP_USDT',
  'ADA_USDT', 'DOGE_USDT', 'MATIC_USDT', 'DOT_USDT', 'LINK_USDT',
  'AVAX_USDT', 'UNI_USDT', 'ATOM_USDT', 'LTC_USDT', 'BCH_USDT',
  'ALGO_USDT', 'XLM_USDT', 'FIL_USDT', 'TRX_USDT', 'ETC_USDT'
];

// Muted colors for rolodex interface
const MUTED_COLORS = {
  background: '#1a1d21',
  cardBg: '#22262d',
  cardBgHover: '#2a2f36',
  cardBorder: '#2c3038',
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0a0',
  textMuted: '#707070',
  upColor: '#4a9668',
  downColor: '#a05252',
  neutralColor: '#8a8a8a'
};

interface AssetPairIndicatorsProps {
  className?: string;
}

interface AssetData {
  symbol: string;
  price: number;
  change24h: number;
  status: 'up' | 'down' | 'neutral';
  lastUpdated: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
}

export function AssetPairIndicators({ className = '' }: AssetPairIndicatorsProps) {
  const [assetData, setAssetData] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const autoRotateRef = useRef(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Setup data fetching and optional websocket connection
  useEffect(() => {
    const setupDataFetching = async () => {
      try {
        // Start with initial data fetch regardless of websocket status
        updateAssetData();

        // Check if we're on a mobile device
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // If on mobile, use polling instead of websockets to avoid potential issues
        if (isMobile) {
          logService.log('info', 'Mobile device detected, using polling for asset pairs', null, 'AssetPairIndicators');
          // Set up interval to update asset data every 10 seconds
          timerRef.current = setInterval(() => {
            updateAssetData(false);
          }, 10000);
          return;
        }

        // For desktop, try to use websockets
        try {
          // Initialize websocket connection if not already connected
          if (!websocketService.getConnectionStatus()) {
            await websocketService.connect({});
            logService.log('info', 'WebSocket connected for asset pair indicators', null, 'AssetPairIndicators');
          }

          // Subscribe to ticker updates for all asset pairs
          for (const pair of ASSET_PAIRS) {
            const formattedSymbol = pair.replace('_', '').toLowerCase();

            try {
              // Subscribe to ticker updates
              await websocketService.send({
                type: 'subscribe',
                channel: 'ticker',
                symbol: formattedSymbol
              });

              logService.log('info', `Subscribed to ${formattedSymbol} ticker updates`, null, 'AssetPairIndicators');
            } catch (error) {
              logService.log('error', `Failed to subscribe to ${formattedSymbol}`, error, 'AssetPairIndicators');
            }
          }

          // Listen for ticker updates
          websocketService.on('ticker', handleTickerUpdate);
        } catch (wsError) {
          logService.log('error', 'Failed to setup websockets for asset pairs, falling back to polling', wsError, 'AssetPairIndicators');
          // Set up polling as fallback
          timerRef.current = setInterval(() => {
            updateAssetData(false);
          }, 10000);
        }
      } catch (error) {
        logService.log('error', 'Failed to initialize asset pair data', error, 'AssetPairIndicators');
      }
    };

    setupDataFetching();

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      websocketService.off('ticker', handleTickerUpdate);
    };
  }, []);

  // Auto-rotate effect
  useEffect(() => {
    autoRotateRef.current = autoRotate;

    if (autoRotate && assetData.length > 0) {
      timerRef.current = setInterval(() => {
        if (autoRotateRef.current) {
          setActiveIndex(prev => (prev + 1) % assetData.length);
        }
      }, 5000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [autoRotate, assetData.length]);

  // Handle ticker updates from websocket with improved error handling
  const handleTickerUpdate = (data: any) => {
    // Guard against invalid data
    if (!data) {
      logService.log('warn', 'Received empty ticker data', null, 'AssetPairIndicators');
      return;
    }

    if (!data.symbol) {
      logService.log('warn', 'Received ticker data without symbol', data, 'AssetPairIndicators');
      return;
    }

    try {
      // Safely parse the symbol
      let symbol;
      try {
        symbol = data.symbol.toUpperCase().replace(/([A-Z]+)([A-Z]+)/, '$1_$2');
      } catch (symbolError) {
        logService.log('warn', 'Failed to parse symbol from ticker data', { data, error: symbolError }, 'AssetPairIndicators');
        return;
      }

      // Check if this is a symbol we're interested in
      if (!ASSET_PAIRS.includes(symbol)) {
        // Not an error, just not a symbol we're tracking
        return;
      }

      // Safely parse price data
      let price, open24h, change24h, volume24h, high24h, low24h;
      try {
        price = parseFloat(data.last_price);
        if (isNaN(price)) {
          logService.log('warn', 'Invalid price in ticker data', { symbol, price: data.last_price }, 'AssetPairIndicators');
          return;
        }

        open24h = parseFloat(data.open_24h || '0');
        change24h = open24h ? ((price - open24h) / open24h) * 100 : 0;
        volume24h = parseFloat(data.quote_volume_24h || '0');
        high24h = parseFloat(data.high_24h || price);
        low24h = parseFloat(data.low_24h || price);
      } catch (parseError) {
        logService.log('warn', 'Failed to parse numeric values from ticker data',
          { symbol, data, error: parseError }, 'AssetPairIndicators');
        return;
      }

      const now = Date.now();

      // Safely update state
      try {
        setAssetData(prevData => {
          // Guard against null or undefined prevData (shouldn't happen, but just in case)
          if (!prevData) return [{
            symbol,
            price,
            change24h,
            volume24h,
            high24h,
            low24h,
            status: 'neutral',
            lastUpdated: now
          }];

          const existingIndex = prevData.findIndex(item => item.symbol === symbol);

          if (existingIndex >= 0) {
            const newData = [...prevData];
            const oldPrice = newData[existingIndex].price;

            newData[existingIndex] = {
              ...newData[existingIndex],
              price,
              change24h,
              volume24h,
              high24h,
              low24h,
              lastUpdated: now,
              status: price > oldPrice ? 'up' : price < oldPrice ? 'down' : newData[existingIndex].status
            };

            return newData;
          } else {
            return [
              ...prevData,
              {
                symbol,
                price,
                change24h,
                volume24h,
                high24h,
                low24h,
                status: 'neutral',
                lastUpdated: now
              }
            ];
          }
        });

        if (loading) {
          setLoading(false);
        }

        if (refreshing) {
          setRefreshing(false);
        }
      } catch (stateError) {
        logService.log('error', 'Failed to update state with ticker data',
          { symbol, error: stateError }, 'AssetPairIndicators');
      }
    } catch (error) {
      // Catch-all for any other errors
      logService.log('error', 'Error processing ticker update', error, 'AssetPairIndicators');
    }
  };

  const updateAssetData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setRefreshing(true);

    try {
      // Get data for all asset pairs with improved error handling
      const dataPromises = ASSET_PAIRS.map(async (symbol) => {
        try {
          // Try to get real data from service
          let realData;
          try {
            realData = bitmartService.getAssetData(symbol);
          } catch (serviceError) {
            logService.log('warn', `Error fetching data from service for ${symbol}`, serviceError, 'AssetPairIndicators');
            realData = null;
          }

          if (realData && typeof realData.price === 'number' && !isNaN(realData.price)) {
            return {
              symbol,
              price: realData.price,
              change24h: realData.change24h,
              volume24h: realData.volume24h || 0,
              high24h: realData.high24h || realData.price * 1.05,
              low24h: realData.low24h || realData.price * 0.95,
              status: realData.change24h > 0 ? 'up' : realData.change24h < 0 ? 'down' : 'neutral',
              lastUpdated: Date.now()
            };
          }

          // If no real data, generate synthetic data
          const existingData = assetData.find(a => a.symbol === symbol);
          const basePrice = existingData?.price || getBasePrice(symbol);
          const change = (Math.random() * 2 - 1) * 0.5; // -0.5% to +0.5%
          const newPrice = basePrice * (1 + change / 100);

          return {
            symbol,
            price: newPrice,
            change24h: existingData?.change24h || (Math.random() * 10 - 5), // -5% to +5%
            volume24h: basePrice * 1000000 * (Math.random() + 0.5),
            high24h: basePrice * (1 + (Math.random() * 0.05)),
            low24h: basePrice * (1 - (Math.random() * 0.05)),
            status: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
            lastUpdated: Date.now()
          };
        } catch (error) {
          logService.log('error', `Failed to get data for ${symbol}`, error, 'AssetPairIndicators');

          // Return fallback data
          return {
            symbol,
            price: getBasePrice(symbol),
            change24h: 0,
            volume24h: getBasePrice(symbol) * 1000000,
            high24h: getBasePrice(symbol) * 1.05,
            low24h: getBasePrice(symbol) * 0.95,
            status: 'neutral' as const,
            lastUpdated: Date.now()
          };
        }
      });

      // Use Promise.allSettled instead of Promise.all to handle individual promise rejections
      const results = await Promise.allSettled(dataPromises);

      // Filter out rejected promises and extract values from fulfilled ones
      const data = results
        .filter((result): result is PromiseFulfilledResult<AssetData> => result.status === 'fulfilled')
        .map(result => result.value);

      // Only update state if we have data
      if (data.length > 0) {
        setAssetData(data);
      } else {
        logService.log('warn', 'No asset data was successfully retrieved', null, 'AssetPairIndicators');
      }
    } catch (error) {
      logService.log('error', 'Failed to update asset data', error, 'AssetPairIndicators');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper function to get a base price for an asset
  const getBasePrice = (symbol: string): number => {
    if (symbol.startsWith('BTC')) return 50000 + Math.random() * 5000;
    if (symbol.startsWith('ETH')) return 3000 + Math.random() * 300;
    if (symbol.startsWith('SOL')) return 100 + Math.random() * 20;
    if (symbol.startsWith('BNB')) return 400 + Math.random() * 40;
    if (symbol.startsWith('XRP')) return 0.5 + Math.random() * 0.1;
    if (symbol.startsWith('ADA')) return 0.4 + Math.random() * 0.05;
    if (symbol.startsWith('DOGE')) return 0.1 + Math.random() * 0.02;
    if (symbol.startsWith('MATIC')) return 0.8 + Math.random() * 0.1;
    if (symbol.startsWith('DOT')) return 6 + Math.random() * 1;
    if (symbol.startsWith('LINK')) return 15 + Math.random() * 2;
    return 10 + Math.random() * 5; // Default for other assets
  };

  const handleRefresh = () => {
    setRefreshing(true);
    updateAssetData(false);
  };

  const handlePrev = () => {
    setAutoRotate(false);
    setActiveIndex(prev => (prev - 1 + assetData.length) % assetData.length);
  };

  const handleNext = () => {
    setAutoRotate(false);
    setActiveIndex(prev => (prev + 1) % assetData.length);
  };

  const toggleAutoRotate = () => {
    setAutoRotate(prev => !prev);
  };

  // Format asset pair name for display (BTC_USDT -> BTC/USDT)
  const formatAssetPair = (symbol: string): string => {
    return symbol.replace('_', '/');
  };

  return (
    <div className={`${className} relative`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-neon-turquoise" />
            <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-neon-turquoise via-neon-yellow to-neon-raspberry">
              Asset Pair Indicators
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleAutoRotate}
              className="p-1.5 rounded transition-colors duration-300"
              style={{
                background: autoRotate ? MUTED_COLORS.cardBgHover : MUTED_COLORS.cardBg,
                borderColor: MUTED_COLORS.cardBorder,
                color: autoRotate ? MUTED_COLORS.textPrimary : MUTED_COLORS.textMuted
              }}
            >
              <RefreshCw size={14} className={autoRotate ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 rounded transition-colors duration-300"
              style={{
                background: MUTED_COLORS.cardBg,
                borderColor: MUTED_COLORS.cardBorder,
                color: refreshing ? MUTED_COLORS.textMuted : MUTED_COLORS.textSecondary,
                opacity: refreshing ? 0.5 : 1
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading && assetData.length === 0 ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 rounded-full animate-spin"
              style={{
                background: MUTED_COLORS.cardBg,
                borderTop: `2px solid ${MUTED_COLORS.textPrimary}`,
                boxShadow: `0 0 5px ${MUTED_COLORS.cardBorder}`
              }}
            />
          </div>
        ) : (
          <div className="relative overflow-hidden" style={{ height: '240px' }}>
            {/* Rolodex Navigation */}
            <div className="absolute top-1/2 left-4 z-10 transform -translate-y-1/2">
              <button
                onClick={handlePrev}
                className="p-2 rounded-full transition-colors duration-300"
                style={{
                  background: MUTED_COLORS.cardBg,
                  color: MUTED_COLORS.textSecondary
                }}
              >
                <ArrowUpIcon size={16} />
              </button>
            </div>

            <div className="absolute top-1/2 right-4 z-10 transform -translate-y-1/2">
              <button
                onClick={handleNext}
                className="p-2 rounded-full transition-colors duration-300"
                style={{
                  background: MUTED_COLORS.cardBg,
                  color: MUTED_COLORS.textSecondary
                }}
              >
                <ArrowDownIcon size={16} />
              </button>
            </div>

            {/* Rolodex Cards */}
            <div className="relative h-full flex items-center justify-center">
              <AnimatePresence mode="wait">
                {assetData.length > 0 && (
                  <motion.div
                    key={assetData[activeIndex].symbol}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    transition={{ duration: 0.3 }}
                    className="w-full max-w-md mx-auto p-6 rounded-lg"
                    style={{
                      background: MUTED_COLORS.cardBg,
                      border: `1px solid ${MUTED_COLORS.cardBorder}`,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{
                            background: 'linear-gradient(145deg, #1a1e24, #2a2f36)',
                            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05), inset 0 -1px 1px rgba(0, 0, 0, 0.2)',
                            border: `1px solid ${MUTED_COLORS.cardBorder}`
                          }}
                        >
                          <span style={{ color: MUTED_COLORS.textPrimary, fontWeight: 'bold' }}>
                            {assetData[activeIndex].symbol.split('_')[0]}
                          </span>
                        </div>

                        <div>
                          <h4 style={{ color: MUTED_COLORS.textPrimary, fontWeight: 'bold' }}>
                            {formatAssetPair(assetData[activeIndex].symbol)}
                          </h4>
                          <p style={{ color: MUTED_COLORS.textSecondary, fontSize: '0.8rem' }}>
                            Last updated: {new Date(assetData[activeIndex].lastUpdated).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <span style={{
                          color: assetData[activeIndex].status === 'up'
                            ? MUTED_COLORS.upColor
                            : assetData[activeIndex].status === 'down'
                              ? MUTED_COLORS.downColor
                              : MUTED_COLORS.textPrimary,
                          fontWeight: 'bold',
                          fontSize: '1.25rem'
                        }}>
                          ${assetData[activeIndex].price < 1
                            ? assetData[activeIndex].price.toFixed(4)
                            : assetData[activeIndex].price.toFixed(2)}
                        </span>

                        <div className="flex items-center gap-1">
                          {assetData[activeIndex].status === 'up' ? (
                            <ArrowUpIcon size={12} style={{ color: MUTED_COLORS.upColor }} />
                          ) : assetData[activeIndex].status === 'down' ? (
                            <ArrowDownIcon size={12} style={{ color: MUTED_COLORS.downColor }} />
                          ) : null}

                          <span style={{
                            color: assetData[activeIndex].change24h > 0
                              ? MUTED_COLORS.upColor
                              : assetData[activeIndex].change24h < 0
                                ? MUTED_COLORS.downColor
                                : MUTED_COLORS.textSecondary,
                            fontSize: '0.875rem'
                          }}>
                            {assetData[activeIndex].change24h > 0 ? '+' : ''}
                            {assetData[activeIndex].change24h.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <div className="p-3 rounded"
                        style={{
                          background: MUTED_COLORS.background,
                          border: `1px solid ${MUTED_COLORS.cardBorder}`
                        }}
                      >
                        <p style={{ color: MUTED_COLORS.textMuted, fontSize: '0.75rem' }}>24h High</p>
                        <p style={{ color: MUTED_COLORS.textPrimary, fontWeight: 'bold' }}>
                          ${assetData[activeIndex].high24h?.toFixed(2) || '-'}
                        </p>
                      </div>

                      <div className="p-3 rounded"
                        style={{
                          background: MUTED_COLORS.background,
                          border: `1px solid ${MUTED_COLORS.cardBorder}`
                        }}
                      >
                        <p style={{ color: MUTED_COLORS.textMuted, fontSize: '0.75rem' }}>24h Low</p>
                        <p style={{ color: MUTED_COLORS.textPrimary, fontWeight: 'bold' }}>
                          ${assetData[activeIndex].low24h?.toFixed(2) || '-'}
                        </p>
                      </div>

                      <div className="p-3 rounded"
                        style={{
                          background: MUTED_COLORS.background,
                          border: `1px solid ${MUTED_COLORS.cardBorder}`
                        }}
                      >
                        <p style={{ color: MUTED_COLORS.textMuted, fontSize: '0.75rem' }}>24h Volume</p>
                        <p style={{ color: MUTED_COLORS.textPrimary, fontWeight: 'bold' }}>
                          ${assetData[activeIndex].volume24h
                            ? (assetData[activeIndex].volume24h > 1000000
                              ? (assetData[activeIndex].volume24h / 1000000).toFixed(2) + 'M'
                              : assetData[activeIndex].volume24h.toFixed(2))
                            : '-'}
                        </p>
                      </div>

                      <div className="p-3 rounded"
                        style={{
                          background: MUTED_COLORS.background,
                          border: `1px solid ${MUTED_COLORS.cardBorder}`
                        }}
                      >
                        <p style={{ color: MUTED_COLORS.textMuted, fontSize: '0.75rem' }}>Position</p>
                        <p style={{ color: MUTED_COLORS.textPrimary, fontWeight: 'bold' }}>
                          {activeIndex + 1} / {assetData.length}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Pagination Dots */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
              {assetData.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setAutoRotate(false);
                    setActiveIndex(index);
                  }}
                  className="w-2 h-2 rounded-full transition-all duration-300"
                  style={{
                    background: index === activeIndex ? MUTED_COLORS.textPrimary : MUTED_COLORS.textMuted,
                    opacity: index === activeIndex ? 1 : 0.5,
                    transform: index === activeIndex ? 'scale(1.2)' : 'scale(1)'
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
