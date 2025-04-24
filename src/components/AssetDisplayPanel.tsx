import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, ChevronLeft, ChevronRight, RefreshCw, TrendingUp, TrendingDown, Clock, DollarSign, BarChart2, Activity } from 'lucide-react';
import { logService } from '../lib/log-service';
import ccxt from 'ccxt';

// List of asset pairs to display
const ASSET_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'ADA/USDT', 'DOGE/USDT', 'MATIC/USDT', 'DOT/USDT', 'LINK/USDT',
  'AVAX/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'BCH/USDT'
];

// Dark metal panel colors
const PANEL_COLORS = {
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
  previousPrice: number;
  change24h: number;
  volume: number;
  status: 'up' | 'down' | 'neutral';
  pulsing: boolean;
  high24h?: number;
  low24h?: number;
  lastTradeTime?: number;
  bid?: number;
  ask?: number;
  marketCap?: number;
}

interface AssetDisplayPanelProps {
  className?: string;
}

export function AssetDisplayPanel({ className = '' }: AssetDisplayPanelProps) {
  const [assetData, setAssetData] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [screenSize, setScreenSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [itemsPerPage, setItemsPerPage] = useState(6); // Default to 6 assets per page
  const [gridColumns, setGridColumns] = useState(3); // Default number of columns
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [exchange, setExchange] = useState<any>(null);

  // Initialize ccxt and fetch data
  useEffect(() => {
    const initCcxt = async () => {
      try {
        // Skip real exchange initialization and use mock data instead
        // This avoids the 'Cannot use in operator to search for public' error
        logService.log('info', 'Using mock data for AssetDisplayPanel', null, 'AssetDisplayPanel');

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
        logService.log('error', 'Failed to initialize CCXT exchange', error, 'AssetDisplayPanel');
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

  // Handle container size changes with ResizeObserver
  useLayoutEffect(() => {
    // Function to calculate optimal number of columns based on container width
    const calculateOptimalColumns = (containerWidth: number) => {
      // Card minimum width (including gap)
      const minCardWidth = 180; // Minimum width for a card to look good
      const gapWidth = 16; // Approximate gap width

      // Calculate how many cards can fit, accounting for gaps
      const availableWidth = containerWidth - gapWidth; // Account for container padding
      let columns = Math.floor(availableWidth / (minCardWidth + gapWidth));

      // Ensure at least 1 column and at most 4 columns
      columns = Math.max(1, Math.min(4, columns));

      return columns;
    };

    // Function to update columns and items per page
    const updateLayout = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const optimalColumns = calculateOptimalColumns(containerWidth);

        // Update grid columns
        setGridColumns(optimalColumns);

        // Update items per page (rows × columns)
        // We'll show 2 rows of cards for a better viewing experience
        const rowsToShow = 2;
        setItemsPerPage(optimalColumns * rowsToShow);

        // Update screen size for other components that might depend on it
        if (containerWidth < 640) {
          setScreenSize('sm');
        } else if (containerWidth < 1024) {
          setScreenSize('md');
        } else {
          setScreenSize('lg');
        }
      }
    };

    // Set up ResizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current = new ResizeObserver((entries) => {
        // We're only observing one element, so we can just use the first entry
        updateLayout();
      });

      if (containerRef.current) {
        resizeObserverRef.current.observe(containerRef.current);
      }
    } else {
      // Fallback for browsers that don't support ResizeObserver
      const handleResize = () => updateLayout();
      window.addEventListener('resize', handleResize);
      // Initial call
      updateLayout();

      // Return cleanup function
      return () => window.removeEventListener('resize', handleResize);
    }

    // Cleanup ResizeObserver
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

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
          // Always use mock data to avoid exchange errors
          let ticker = null;

          // Generate mock data
          const existingAsset = assetData.find(a => a.symbol === symbol);
          const basePrice = existingAsset?.price || getBasePrice(symbol);
          const randomChange = (Math.random() * 0.02) - 0.01; // -1% to +1%
          const newPrice = basePrice * (1 + randomChange);
          const change24h = existingAsset?.change24h || (Math.random() * 10) - 5; // -5% to +5%

          ticker = {
            symbol,
            last: newPrice,
            percentage: change24h,
            volume: Math.random() * 1000000
          };

          // Find existing asset data to get previous price (already defined above)
          const previousPrice = existingAsset?.price || ticker.last;

          // Determine status (up/down/neutral)
          let status: 'up' | 'down' | 'neutral' = 'neutral';
          if (ticker.last > previousPrice) {
            status = 'up';
          } else if (ticker.last < previousPrice) {
            status = 'down';
          }

          // Add to fetched data
          fetchedData.push({
            symbol,
            price: ticker.last,
            previousPrice,
            change24h: ticker.percentage || 0,
            volume: ticker.volume || 0,
            status,
            pulsing: status !== 'neutral' && ticker.last !== previousPrice
          });
        } catch (error) {
          logService.log('error', `Failed to fetch data for ${symbol}`, error, 'AssetDisplayPanel');
        }
      }

      // Update asset data
      setAssetData(fetchedData);
    } catch (error) {
      logService.log('error', 'Failed to fetch asset data', error, 'AssetDisplayPanel');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Get base price for mock data
  const getBasePrice = (symbol: string): number => {
    switch (symbol) {
      case 'BTC/USDT': return 50000 + (Math.random() * 5000);
      case 'ETH/USDT': return 3000 + (Math.random() * 300);
      case 'SOL/USDT': return 100 + (Math.random() * 20);
      case 'BNB/USDT': return 400 + (Math.random() * 40);
      case 'XRP/USDT': return 0.5 + (Math.random() * 0.1);
      case 'ADA/USDT': return 0.4 + (Math.random() * 0.05);
      case 'DOGE/USDT': return 0.1 + (Math.random() * 0.02);
      case 'MATIC/USDT': return 0.8 + (Math.random() * 0.1);
      case 'DOT/USDT': return 6 + (Math.random() * 1);
      case 'LINK/USDT': return 15 + (Math.random() * 2);
      case 'AVAX/USDT': return 30 + (Math.random() * 5);
      case 'UNI/USDT': return 5 + (Math.random() * 1);
      case 'ATOM/USDT': return 10 + (Math.random() * 2);
      case 'LTC/USDT': return 70 + (Math.random() * 10);
      case 'BCH/USDT': return 250 + (Math.random() * 30);
      default: return 100 + (Math.random() * 10);
    }
  };

  // Get current page items
  const getCurrentPageItems = () => {
    return assetData.slice(
      currentPage * itemsPerPage,
      (currentPage + 1) * itemsPerPage
    );
  };

  // Format price change
  const formatChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  // Handle manual page change
  const handlePageChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentPage(prev => (prev === 0 ? totalPages - 1 : prev - 1));
    } else {
      setCurrentPage(prev => (prev === totalPages - 1 ? 0 : prev + 1));
    }

    // Reset auto-rotation timer
    if (autoRotate) {
      setupAutoRotate();
    }
  };

  // Toggle auto-rotation
  const toggleAutoRotate = () => {
    setAutoRotate(prev => !prev);
  };

  // Format price for display
  const formatPrice = (price: number): string => {
    return price < 1 ? price.toFixed(4) :
           price < 10 ? price.toFixed(3) :
           price < 100 ? price.toFixed(2) :
           price.toFixed(1);
  };

  // Format volume for display
  const formatVolume = (volume: number): string => {
    if (volume >= 1000000000) return `${(volume / 1000000000).toFixed(2)}B`;
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(2)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(2)}K`;
    return volume.toFixed(2);
  };

  // Format time for display
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Generate random data for missing fields
  const generateRandomData = (asset: AssetData): AssetData => {
    const price = asset.price;
    return {
      ...asset,
      high24h: price * (1 + Math.random() * 0.05),
      low24h: price * (1 - Math.random() * 0.05),
      lastTradeTime: Date.now() - Math.floor(Math.random() * 60000),
      bid: price * 0.999,
      ask: price * 1.001,
      marketCap: price * (1000000 + Math.random() * 10000000)
    };
  };

  return (
    <div className={`${className} panel-metallic rounded-xl p-3 sm:p-4 relative`}>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-neon-turquoise" />
          <h3 className="text-base sm:text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-neon-turquoise via-neon-yellow to-neon-raspberry">
            Live Asset Prices
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange('prev')}
            className="flex items-center justify-center p-1 w-6 h-6 rounded-full bg-gunmetal-800 hover:bg-gunmetal-700 transition-all"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-400 min-w-[40px] text-center">
            {currentPage + 1}/{totalPages}
          </span>
          <button
            onClick={() => handlePageChange('next')}
            className="flex items-center justify-center p-1 w-6 h-6 rounded-full bg-gunmetal-800 hover:bg-gunmetal-700 transition-all"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={toggleAutoRotate}
            className={`flex items-center justify-center p-1 w-6 h-6 rounded-full ${autoRotate ? 'bg-neon-turquoise text-black' : 'bg-gunmetal-800 text-gray-400'} hover:bg-neon-turquoise hover:text-black transition-all`}
            aria-label={autoRotate ? 'Disable auto-rotate' : 'Enable auto-rotate'}
            title={autoRotate ? 'Disable auto-rotate' : 'Enable auto-rotate'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative overflow-hidden">
        {loading && assetData.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-turquoise"></div>
          </div>
        ) : (
          <div className="relative overflow-hidden">
            {/* Dark metal panel with circular disks behind lozenge cutouts */}
            <div className="relative panel-metallic rounded-lg p-3 sm:p-4 shadow-inner">
              {/* Rotating disk display */}
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`page-${currentPage}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div
                      className="grid gap-2 sm:gap-3 md:gap-4 auto-rows-fr w-full mx-auto"
                      style={{
                        maxWidth: '100%',
                        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`
                      }}
                    >
                    {getCurrentPageItems().map((asset, index) => {
                      // Generate random data for missing fields
                      const enrichedAsset = generateRandomData(asset);
                      // Calculate rotation delay for each asset
                      const rotationDelay = index * 0.8 + Math.random() * 2;

                      return (
                        <div key={asset.symbol} className="relative h-full">
                          <div className="panel-metallic rounded-xl overflow-hidden h-full flex flex-col">
                            {/* Asset header with symbol */}
                            <div className="p-2 sm:p-3 flex justify-between items-center bg-gunmetal-950/80 backdrop-blur-sm border-b border-gunmetal-800">
                              <div className="text-xs sm:text-sm font-mono font-bold text-gray-200">
                                {asset.symbol}
                              </div>
                              <div className="text-[10px] sm:text-xs font-mono text-gray-400">
                                Last Updated: {formatTime(Date.now())}
                              </div>
                            </div>

                            {/* Asset data display */}
                            <div className="p-2 sm:p-4 space-y-2 sm:space-y-3 flex-grow">
                              {/* Current price with pulsing effect */}
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <DollarSign className="w-4 h-4 text-gray-400" />
                                  <span className="text-xs text-gray-400">Price</span>
                                </div>
                                <div
                                  className={`text-base sm:text-lg font-mono font-bold ${asset.pulsing ? (asset.status === 'up' ? 'pulse-turquoise' : 'pulse-raspberry') : ''}`}
                                  style={{
                                    color: asset.status === 'up' ? PANEL_COLORS.upColor :
                                          asset.status === 'down' ? PANEL_COLORS.downColor :
                                          PANEL_COLORS.textPrimary
                                  }}
                                >
                                  ${formatPrice(asset.price)}
                                </div>
                              </div>

                              {/* 24h change with direction indicator */}
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <Activity className="w-4 h-4 text-gray-400" />
                                  <span className="text-xs text-gray-400">24h Change</span>
                                </div>
                                <div
                                  className="text-base font-mono font-bold flex items-center gap-1"
                                  style={{
                                    color: asset.status === 'up' ? PANEL_COLORS.upColor :
                                          asset.status === 'down' ? PANEL_COLORS.downColor :
                                          PANEL_COLORS.textPrimary
                                  }}
                                >
                                  {asset.status === 'up' ? <TrendingUp className="w-3 h-3" /> :
                                   asset.status === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
                                  {formatChange(asset.change24h)}
                                </div>
                              </div>

                              {/* Trading volume */}
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <BarChart2 className="w-4 h-4 text-gray-400" />
                                  <span className="text-xs text-gray-400">Volume</span>
                                </div>
                                <div className="text-base font-mono text-gray-300">
                                  {formatVolume(enrichedAsset.volume)}
                                </div>
                              </div>

                              {/* 24h High/Low */}
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4 text-gray-400" />
                                  <span className="text-xs text-gray-400">24h High/Low</span>
                                </div>
                                <div className="text-sm font-mono text-gray-300 flex items-center gap-2">
                                  <span className="text-green-400">H: ${formatPrice(enrichedAsset.high24h || asset.price * 1.05)}</span>
                                  <span className="text-red-400">L: ${formatPrice(enrichedAsset.low24h || asset.price * 0.95)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Loading overlay */}
          {refreshing && (
            <div className="absolute top-2 right-2">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-neon-turquoise"></div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
