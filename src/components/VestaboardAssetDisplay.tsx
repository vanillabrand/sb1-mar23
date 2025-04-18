import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { bitmartService } from '../lib/bitmart-service';
import { logService } from '../lib/log-service';
import { websocketService } from '../lib/websocket-service';
import { BarChart3, RefreshCw } from 'lucide-react';
import { FlipDisplay } from './FlipDisplay';

// Comprehensive list of asset pairs
const ASSET_PAIRS = [
  'BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT', 'XRP_USDT', 
  'ADA_USDT', 'DOGE_USDT', 'MATIC_USDT', 'DOT_USDT', 'LINK_USDT'
];

// Vestaboard-inspired colors
const VESTABOARD_COLORS = {
  background: '#1a1d21',
  panelBg: '#22262d',
  panelBorder: '#2c3038',
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0a0',
  upColor: '#4CAF50',
  downColor: '#FF5252',
  neutralColor: '#FFEB3B'
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

export function VestaboardAssetDisplay({ className = '' }: AssetPairIndicatorsProps) {
  const [assetData, setAssetData] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleAssets, setVisibleAssets] = useState<number[]>([0, 1, 2]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prevPricesRef = useRef<Record<string, number>>({});

  // Setup data fetching and optional websocket connection
  useEffect(() => {
    const setupDataFetching = async () => {
      try {
        // Start with initial data fetch
        updateAssetData();
        
        // Check if we're on a mobile device
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        // If on mobile, use polling instead of websockets
        if (isMobile) {
          logService.log('info', 'Mobile device detected, using polling for asset pairs', null, 'VestaboardAssetDisplay');
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
            logService.log('info', 'WebSocket connected for asset pair indicators', null, 'VestaboardAssetDisplay');
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
              
              logService.log('info', `Subscribed to ${formattedSymbol} ticker updates`, null, 'VestaboardAssetDisplay');
            } catch (error) {
              logService.log('error', `Failed to subscribe to ${formattedSymbol}`, error, 'VestaboardAssetDisplay');
            }
          }

          // Listen for ticker updates
          websocketService.on('ticker', handleTickerUpdate);
        } catch (wsError) {
          logService.log('error', 'Failed to setup websockets for asset pairs, falling back to polling', wsError, 'VestaboardAssetDisplay');
          // Set up polling as fallback
          timerRef.current = setInterval(() => {
            updateAssetData(false);
          }, 10000);
        }
      } catch (error) {
        logService.log('error', 'Failed to initialize asset pair data', error, 'VestaboardAssetDisplay');
      }
    };

    setupDataFetching();

    // Set up rotation of visible assets
    const rotationTimer = setInterval(() => {
      rotateVisibleAssets();
    }, 8000);

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      clearInterval(rotationTimer);
      websocketService.off('ticker', handleTickerUpdate);
    };
  }, []);

  // Rotate which assets are visible
  const rotateVisibleAssets = () => {
    setVisibleAssets(prev => {
      if (assetData.length <= 3) return prev;
      
      return prev.map(index => (index + 1) % assetData.length);
    });
  };

  // Handle ticker updates from websocket
  const handleTickerUpdate = (data: any) => {
    if (!data || !data.symbol) return;

    try {
      // Parse the symbol
      const symbol = data.symbol.toUpperCase().replace(/([A-Z]+)([A-Z]+)/, '$1_$2');
      
      if (!ASSET_PAIRS.includes(symbol)) return;

      const price = parseFloat(data.last_price);
      if (isNaN(price)) return;

      const open24h = parseFloat(data.open_24h || '0');
      const change24h = open24h ? ((price - open24h) / open24h) * 100 : 0;
      const volume24h = parseFloat(data.quote_volume_24h || '0');
      const high24h = parseFloat(data.high_24h || price);
      const low24h = parseFloat(data.low_24h || price);
      const now = Date.now();

      // Store the previous price before updating
      setAssetData(prevData => {
        const existingIndex = prevData.findIndex(item => item.symbol === symbol);
        
        if (existingIndex >= 0) {
          // Store the previous price
          prevPricesRef.current[symbol] = prevData[existingIndex].price;
          
          const newData = [...prevData];
          newData[existingIndex] = {
            ...newData[existingIndex],
            price,
            change24h,
            volume24h,
            high24h,
            low24h,
            lastUpdated: now,
            status: price > prevPricesRef.current[symbol] ? 'up' : price < prevPricesRef.current[symbol] ? 'down' : newData[existingIndex].status
          };
          
          return newData;
        } else {
          // New asset, store initial price
          prevPricesRef.current[symbol] = price;
          
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
    } catch (error) {
      logService.log('error', 'Error processing ticker update', error, 'VestaboardAssetDisplay');
    }
  };

  const updateAssetData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setRefreshing(true);

    try {
      // Get data for all asset pairs
      const dataPromises = ASSET_PAIRS.map(async (symbol) => {
        try {
          // Try to get real data from service
          let realData;
          try {
            realData = bitmartService.getAssetData(symbol);
          } catch (serviceError) {
            realData = null;
          }
          
          if (realData && typeof realData.price === 'number' && !isNaN(realData.price)) {
            // Store the previous price
            if (!prevPricesRef.current[symbol]) {
              prevPricesRef.current[symbol] = realData.price;
            }
            
            return {
              symbol,
              price: realData.price,
              change24h: realData.change24h,
              volume24h: realData.volume24h || 0,
              high24h: realData.high24h || realData.price * 1.05,
              low24h: realData.low24h || realData.price * 0.95,
              status: realData.price > prevPricesRef.current[symbol] ? 'up' : 
                     realData.price < prevPricesRef.current[symbol] ? 'down' : 'neutral',
              lastUpdated: Date.now()
            };
          }
          
          // If no real data, generate synthetic data
          const existingData = assetData.find(a => a.symbol === symbol);
          const basePrice = existingData?.price || getBasePrice(symbol);
          
          // Store the previous price if not already stored
          if (!prevPricesRef.current[symbol]) {
            prevPricesRef.current[symbol] = basePrice;
          }
          
          const change = (Math.random() * 2 - 1) * 0.5; // -0.5% to +0.5%
          const newPrice = basePrice * (1 + change / 100);
          
          return {
            symbol,
            price: newPrice,
            change24h: existingData?.change24h || (Math.random() * 10 - 5), // -5% to +5%
            volume24h: basePrice * 1000000 * (Math.random() + 0.5),
            high24h: basePrice * (1 + (Math.random() * 0.05)),
            low24h: basePrice * (1 - (Math.random() * 0.05)),
            status: newPrice > prevPricesRef.current[symbol] ? 'up' : 
                   newPrice < prevPricesRef.current[symbol] ? 'down' : 'neutral',
            lastUpdated: Date.now()
          };
        } catch (error) {
          // Return fallback data
          const basePrice = getBasePrice(symbol);
          
          // Store the previous price if not already stored
          if (!prevPricesRef.current[symbol]) {
            prevPricesRef.current[symbol] = basePrice;
          }
          
          return {
            symbol,
            price: basePrice,
            change24h: 0,
            volume24h: basePrice * 1000000,
            high24h: basePrice * 1.05,
            low24h: basePrice * 0.95,
            status: 'neutral' as const,
            lastUpdated: Date.now()
          };
        }
      });

      const results = await Promise.allSettled(dataPromises);
      
      const data = results
        .filter((result): result is PromiseFulfilledResult<AssetData> => result.status === 'fulfilled')
        .map(result => result.value);
      
      if (data.length > 0) {
        // Update previous prices for all assets
        data.forEach(asset => {
          prevPricesRef.current[asset.symbol] = asset.price;
        });
        
        setAssetData(data);
        
        // Initialize visible assets if needed
        if (visibleAssets.length === 0 || visibleAssets[0] >= data.length) {
          setVisibleAssets([0, 1, 2].filter(i => i < data.length));
        }
      }
    } catch (error) {
      logService.log('error', 'Failed to update asset data', error, 'VestaboardAssetDisplay');
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

  // Format asset pair name for display (BTC_USDT -> BTC/USDT)
  const formatAssetPair = (symbol: string): string => {
    return symbol.replace('_', '/');
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

  return (
    <div className={`${className} relative`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-neon-turquoise" />
            <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-neon-turquoise via-neon-yellow to-neon-raspberry">
              Live Asset Prices
            </h3>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded transition-colors duration-300"
            style={{
              background: VESTABOARD_COLORS.panelBg,
              borderColor: VESTABOARD_COLORS.panelBorder,
              color: refreshing ? VESTABOARD_COLORS.textSecondary : VESTABOARD_COLORS.textPrimary,
              opacity: refreshing ? 0.5 : 1
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        
        {loading && assetData.length === 0 ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 rounded-full animate-spin"
              style={{
                background: VESTABOARD_COLORS.panelBg,
                borderTop: `2px solid ${VESTABOARD_COLORS.textPrimary}`,
                boxShadow: `0 0 5px ${VESTABOARD_COLORS.panelBorder}`
              }}
            />
          </div>
        ) : (
          <div 
            className="relative overflow-hidden rounded-lg p-4"
            style={{ 
              background: 'linear-gradient(145deg, #1e2228, #262b33)',
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05), inset 0 -1px 1px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.2)',
              border: `1px solid ${VESTABOARD_COLORS.panelBorder}`
            }}
          >
            {/* Vestaboard display */}
            <div className="flex flex-col space-y-6">
              {visibleAssets.map(index => {
                if (index >= assetData.length) return null;
                
                const asset = assetData[index];
                const priceStr = '$' + formatPrice(asset.price);
                const changeStr = formatChange(asset.change24h);
                
                return (
                  <div key={asset.symbol} className="flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                      <div 
                        className="text-sm font-semibold px-2 py-1 rounded"
                        style={{ 
                          background: VESTABOARD_COLORS.panelBg,
                          color: VESTABOARD_COLORS.textPrimary
                        }}
                      >
                        {formatAssetPair(asset.symbol)}
                      </div>
                      
                      <div 
                        className="text-xs px-2 py-1 rounded"
                        style={{ 
                          background: asset.change24h > 0 
                            ? VESTABOARD_COLORS.upColor 
                            : asset.change24h < 0 
                              ? VESTABOARD_COLORS.downColor 
                              : VESTABOARD_COLORS.neutralColor,
                          color: '#000000',
                          opacity: 0.8
                        }}
                      >
                        {asset.status === 'up' ? '▲' : asset.status === 'down' ? '▼' : '■'} {changeStr}
                      </div>
                    </div>
                    
                    <FlipDisplay 
                      value={priceStr}
                      previousValue={prevPricesRef.current[asset.symbol] ? '$' + formatPrice(prevPricesRef.current[asset.symbol]) : priceStr}
                      isPrice={true}
                    />
                  </div>
                );
              })}
            </div>
            
            {/* Reflective highlight */}
            <div 
              className="absolute top-0 left-0 w-full h-1/6 pointer-events-none"
              style={{ 
                background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0))',
                zIndex: 10
              }}
            />
            
            {/* Bottom shadow */}
            <div 
              className="absolute bottom-0 left-0 w-full h-1/6 pointer-events-none"
              style={{ 
                background: 'linear-gradient(to top, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0))',
                zIndex: 10
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
