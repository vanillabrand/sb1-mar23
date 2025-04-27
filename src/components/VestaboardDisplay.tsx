import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlipTile } from './FlipTile';
import { BarChart3, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { logService } from '../lib/log-service';
// Import from our browser-compatible wrapper
import ccxt from '../lib/ccxt-entry';
import { FlipDisplay } from './FlipDisplay';

// CSS classes for pulsing animations
const PULSE_CLASSES = {
  up: 'pulse-turquoise',
  down: 'pulse-raspberry',
  neutral: ''
};

// CSS styles for pulsing animations
const PULSE_STYLES = `
  @keyframes pulse-turquoise {
    0% { box-shadow: 0 0 0 0 rgba(0, 255, 209, 0.4); }
    70% { box-shadow: 0 0 0 6px rgba(0, 255, 209, 0); }
    100% { box-shadow: 0 0 0 0 rgba(0, 255, 209, 0); }
  }

  @keyframes pulse-raspberry {
    0% { box-shadow: 0 0 0 0 rgba(255, 56, 100, 0.4); }
    70% { box-shadow: 0 0 0 6px rgba(255, 56, 100, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 56, 100, 0); }
  }

  .pulse-turquoise {
    animation: pulse-turquoise 2s infinite;
    border-radius: 4px;
  }

  .pulse-raspberry {
    animation: pulse-raspberry 2s infinite;
    border-radius: 4px;
  }
`;

// List of asset pairs to display
const ASSET_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'ADA/USDT', 'DOGE/USDT', 'MATIC/USDT', 'DOT/USDT', 'LINK/USDT',
  'AVAX/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'BCH/USDT'
];

// Dark metal panel colors
const VESTABOARD_COLORS = {
  background: '#1a1d21',
  panelBg: '#22262d',
  panelBorder: '#2c3038',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0a0',
  upColor: '#00ffd1',    // Neon turquoise
  downColor: '#ff3864',  // Raspberry pink
  neutralColor: '#333333' // Dark grey
};

interface AssetData {
  symbol: string;
  price: number;
  prevPrice: number;
  priceChange: number; // Actual price change amount
  change24h: number;   // Percentage change
  status: 'up' | 'down' | 'neutral';
  lastUpdated: number;
  pulsing?: boolean;   // Whether the price is currently pulsing
}

interface VestaboardDisplayProps {
  className?: string;
}

export function VestaboardDisplay({ className = '' }: VestaboardDisplayProps) {
  const [assetData, setAssetData] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(6); // Show 6 assets per page (2 rows of 3 on desktop)
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  // Initialize exchange instance
  const [exchange, setExchange] = useState<any>(null);

  // Add CSS styles for animations
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = PULSE_STYLES;
    document.head.appendChild(styleEl);

    return () => {
      // Clean up the style element when component unmounts
      if (styleEl && document.head.contains(styleEl)) {
        document.head.removeChild(styleEl);
      }
    };
  }, []);

  // Initialize ccxt and fetch data
  useEffect(() => {
    const initCcxt = async () => {
      try {
        // Create exchange instance directly
        const config: any = {
          enableRateLimit: true,
          timeout: 30000,
        };

        // Use testnet for safety
        config.urls = {
          api: 'https://testnet.binance.vision/api/',
          ws: 'wss://testnet.binance.vision/ws'
        };

        // Create the exchange
        const binanceExchange = new ccxt.binance(config);
        setExchange(binanceExchange);
        logService.log('info', 'CCXT exchange initialized for VestaboardDisplay', null, 'VestaboardDisplay');

        // Fetch initial data
        await fetchAssetData();

        // Set up auto-refresh interval (every 10 seconds)
        timerRef.current = setInterval(() => {
          fetchAssetData(false);
        }, 10000);

        // Set up auto-rotation
        if (autoRotate) {
          setupAutoRotate();
        }
      } catch (error) {
        logService.log('error', 'Failed to initialize CCXT exchange', error, 'VestaboardDisplay');
        setLoading(false);
      }
    };

    initCcxt();

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (autoRotateRef.current) {
        clearInterval(autoRotateRef.current);
      }
    };
  }, []);

  // Set up auto-rotation when autoRotate changes
  useEffect(() => {
    if (autoRotate) {
      setupAutoRotate();
    } else if (autoRotateRef.current) {
      clearInterval(autoRotateRef.current);
    }
  }, [autoRotate]);

  // Update total pages when asset data changes
  useEffect(() => {
    if (assetData.length > 0) {
      setTotalPages(Math.ceil(assetData.length / itemsPerPage));
    }
  }, [assetData, itemsPerPage]);

  // Set up auto-rotation
  const setupAutoRotate = () => {
    if (autoRotateRef.current) {
      clearInterval(autoRotateRef.current);
    }

    autoRotateRef.current = setInterval(() => {
      setCurrentPage(prev => (prev + 1) % totalPages);
    }, 8000);
  };

  // Fetch asset data from ccxt
  const fetchAssetData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setRefreshing(true);

    try {
      const fetchedData: AssetData[] = [];

      // Fetch data for each asset pair
      for (const symbol of ASSET_PAIRS) {
        try {
          // Get ticker data directly from exchange
          let ticker;
          if (exchange) {
            try {
              ticker = await exchange.fetchTicker(symbol);
            } catch (exchangeError) {
              logService.log('warn', `Exchange error for ${symbol}`, exchangeError, 'VestaboardDisplay');
              ticker = null;
            }
          }

          if (ticker) {
            // Find existing data for this symbol to determine price change
            const existingData = assetData.find(a => a.symbol === symbol);
            const prevPrice = existingData?.price || ticker.last;

            // Calculate percentage change if not provided
            let percentChange = 0;
            if (ticker.percentage) {
              percentChange = ticker.percentage;
            } else if (ticker.open && ticker.last) {
              percentChange = ((ticker.last - ticker.open) / ticker.open) * 100;
            }

            // Calculate actual price change
            const priceChange = ticker.last - prevPrice;

            // Create asset data object
            const asset: AssetData = {
              symbol,
              price: ticker.last,
              prevPrice,
              priceChange,
              change24h: percentChange,
              status: priceChange > 0 ? 'up' : priceChange < 0 ? 'down' : 'neutral',
              lastUpdated: Date.now(),
              pulsing: priceChange !== 0 // Start pulsing if price changed
            };

            fetchedData.push(asset);
          } else {
            // Use existing data if available
            const existingData = assetData.find(a => a.symbol === symbol);
            if (existingData) {
              fetchedData.push(existingData);
            } else {
              // Generate synthetic data
              const basePrice = getBasePrice(symbol);
              fetchedData.push({
                symbol,
                price: basePrice,
                prevPrice: basePrice,
                priceChange: 0,
                change24h: 0,
                status: 'neutral',
                lastUpdated: Date.now(),
                pulsing: false
              });
            }
          }
        } catch (error) {
          logService.log('error', `Failed to fetch data for ${symbol}`, error, 'VestaboardDisplay');

          // Use existing data if available
          const existingData = assetData.find(a => a.symbol === symbol);
          if (existingData) {
            fetchedData.push(existingData);
          } else {
            // Generate synthetic data
            const basePrice = getBasePrice(symbol);
            fetchedData.push({
              symbol,
              price: basePrice,
              prevPrice: basePrice,
              priceChange: 0,
              change24h: 0,
              status: 'neutral',
              lastUpdated: Date.now(),
              pulsing: false
            });
          }
        }
      }

      // Update state with fetched data
      setAssetData(fetchedData);
    } catch (error) {
      logService.log('error', 'Failed to fetch asset data', error, 'VestaboardDisplay');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper function to get a base price for an asset
  const getBasePrice = (symbol: string): number => {
    if (symbol.includes('BTC')) return 50000 + Math.random() * 5000;
    if (symbol.includes('ETH')) return 3000 + Math.random() * 300;
    if (symbol.includes('SOL')) return 100 + Math.random() * 20;
    if (symbol.includes('BNB')) return 400 + Math.random() * 40;
    if (symbol.includes('XRP')) return 0.5 + Math.random() * 0.1;
    if (symbol.includes('ADA')) return 0.4 + Math.random() * 0.05;
    if (symbol.includes('DOGE')) return 0.1 + Math.random() * 0.02;
    if (symbol.includes('MATIC')) return 0.8 + Math.random() * 0.1;
    if (symbol.includes('DOT')) return 6 + Math.random() * 1;
    if (symbol.includes('LINK')) return 15 + Math.random() * 2;
    return 10 + Math.random() * 5; // Default for other assets
  };

  // Format price for display
  const formatPrice = (price: number): string => {
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    return price.toFixed(2);
  };

  // Format change percentage for display
  const formatChange = (change: number): string => {
    return (change > 0 ? '+' : '') + change.toFixed(2) + '%';
  };

  // Handle refresh button click
  const handleRefresh = () => {
    fetchAssetData(false);
  };

  // Handle pagination
  const handlePrevPage = () => {
    setAutoRotate(false);
    setCurrentPage(prev => (prev - 1 + totalPages) % totalPages);
  };

  const handleNextPage = () => {
    setAutoRotate(false);
    setCurrentPage(prev => (prev + 1) % totalPages);
  };

  // Toggle auto-rotate
  const toggleAutoRotate = () => {
    setAutoRotate(prev => !prev);
  };

  // Get current page items
  const getCurrentPageItems = () => {
    const startIndex = currentPage * itemsPerPage;
    return assetData.slice(startIndex, startIndex + itemsPerPage);
  };

  // Format price change for display
  const formatPriceChange = (change: number): string => {
    return (change > 0 ? '+' : '') + formatPrice(Math.abs(change));
  };

  // Render price display for an asset
  const renderPriceDisplay = (asset: AssetData) => {
    const priceStr = formatPrice(asset.price);
    const prevPriceStr = formatPrice(asset.prevPrice);
    const priceChangeStr = formatPriceChange(asset.priceChange);

    // We use CSS classes for pulsing animations based on status

    return (
      <div className="flex flex-col my-1">
        {/* Price display with pulsing effect */}
        <div
          className={`flex justify-center ${asset.pulsing ? PULSE_CLASSES[asset.status] : ''}`}
          style={{ transition: 'all 0.3s ease' }}
        >
          <FlipDisplay
            value={`$${priceStr}`}
            previousValue={`$${prevPriceStr}`}
            isPrice={true}
          />
        </div>

        {/* Price change display */}
        <div className="flex justify-end mt-0.5">
          <div
            className="text-xs px-1.5 py-0.5 rounded-sm font-mono"
            style={{
              background: VESTABOARD_COLORS.background,
              color: asset.status === 'up' ? VESTABOARD_COLORS.upColor :
                    asset.status === 'down' ? VESTABOARD_COLORS.downColor :
                    VESTABOARD_COLORS.textPrimary,
              border: `1px solid ${VESTABOARD_COLORS.panelBorder}`
            }}
          >
            {priceChangeStr}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`${className} relative`}>
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-neon-turquoise" />
            <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-neon-turquoise via-neon-yellow to-neon-raspberry">
              Live Asset Prices
            </h3>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleAutoRotate}
              className="p-1.5 rounded transition-colors duration-300"
              style={{
                background: autoRotate ? VESTABOARD_COLORS.panelBg : 'transparent',
                border: `1px solid ${VESTABOARD_COLORS.panelBorder}`,
                color: autoRotate ? VESTABOARD_COLORS.textPrimary : VESTABOARD_COLORS.textSecondary
              }}
            >
              <RefreshCw size={14} className={autoRotate ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 rounded transition-colors duration-300"
              style={{
                background: 'transparent',
                border: `1px solid ${VESTABOARD_COLORS.panelBorder}`,
                color: refreshing ? VESTABOARD_COLORS.textSecondary : VESTABOARD_COLORS.textPrimary,
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
                border: `2px solid ${VESTABOARD_COLORS.panelBg}`,
                borderTop: `2px solid ${VESTABOARD_COLORS.textPrimary}`,
                boxShadow: `0 0 10px ${VESTABOARD_COLORS.panelBorder}`
              }}
            />
          </div>
        ) : (
          <div
            className="relative overflow-hidden rounded-lg p-3"
            style={{
              background: VESTABOARD_COLORS.panelBg,
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05), inset 0 -1px 1px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.5)',
              border: `1px solid ${VESTABOARD_COLORS.panelBorder}`
            }}
          >
            {/* Pagination controls */}
            <div className="absolute top-1/2 left-2 transform -translate-y-1/2 z-10">
              <button
                onClick={handlePrevPage}
                className="p-1.5 rounded-full transition-colors duration-300"
                style={{
                  background: VESTABOARD_COLORS.background,
                  border: `1px solid ${VESTABOARD_COLORS.panelBorder}`,
                  color: VESTABOARD_COLORS.textPrimary
                }}
              >
                <ChevronLeft size={14} />
              </button>
            </div>

            <div className="absolute top-1/2 right-2 transform -translate-y-1/2 z-10">
              <button
                onClick={handleNextPage}
                className="p-1.5 rounded-full transition-colors duration-300"
                style={{
                  background: VESTABOARD_COLORS.background,
                  border: `1px solid ${VESTABOARD_COLORS.panelBorder}`,
                  color: VESTABOARD_COLORS.textPrimary
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Vestaboard display */}
            <div className="flex flex-col space-y-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`page-${currentPage}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {getCurrentPageItems().map((asset) => (
                      <div key={asset.symbol} className="flex flex-col">
                        <div className="flex justify-between items-center mb-0.5">
                          <div
                            className="text-xs font-mono px-1.5 py-0.5 rounded-sm"
                            style={{
                              background: VESTABOARD_COLORS.background,
                              color: VESTABOARD_COLORS.textPrimary,
                              border: `1px solid ${VESTABOARD_COLORS.panelBorder}`
                            }}
                          >
                            {asset.symbol}
                          </div>

                          <div
                            className="text-xs px-1.5 py-0.5 rounded-sm font-mono"
                            style={{
                              background: VESTABOARD_COLORS.background,
                              color: asset.status === 'up' ? VESTABOARD_COLORS.upColor :
                                    asset.status === 'down' ? VESTABOARD_COLORS.downColor :
                                    VESTABOARD_COLORS.textPrimary,
                              border: `1px solid ${VESTABOARD_COLORS.panelBorder}`
                            }}
                          >
                            {formatChange(asset.change24h)}
                          </div>
                        </div>

                        {renderPriceDisplay(asset)}
                      </div>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Pagination dots */}
            <div className="flex justify-center mt-2 space-x-1">
              {Array.from({ length: totalPages }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setAutoRotate(false);
                    setCurrentPage(index);
                  }}
                  className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    background: index === currentPage ? VESTABOARD_COLORS.textPrimary : VESTABOARD_COLORS.textSecondary,
                    opacity: index === currentPage ? 1 : 0.5,
                    transform: index === currentPage ? 'scale(1.2)' : 'scale(1)'
                  }}
                />
              ))}
            </div>

            {/* Reflective highlight */}
            <div
              className="absolute top-0 left-0 w-full h-1/6 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0))',
                zIndex: 5
              }}
            />

            {/* Bottom shadow */}
            <div
              className="absolute bottom-0 left-0 w-full h-1/6 pointer-events-none"
              style={{
                background: 'linear-gradient(to top, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0))',
                zIndex: 5
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
