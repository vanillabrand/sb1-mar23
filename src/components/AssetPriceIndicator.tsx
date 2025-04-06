import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { websocketService } from '../lib/websocket-service';
import { bitmartService } from '../lib/bitmart-service';
import { logService } from '../lib/log-service';

interface AssetPriceIndicatorProps {
  symbol: string;
  className?: string;
  compact?: boolean;
}

export function AssetPriceIndicator({ symbol, className = '', compact = false }: AssetPriceIndicatorProps) {
  const [price, setPrice] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;

    // Normalize symbol format
    const normalizedSymbol = symbol.includes('_') ? symbol : symbol.replace('/', '_');

    const fetchInitialPrice = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get initial price data
        const ticker = await bitmartService.getTicker(normalizedSymbol);
        if (ticker) {
          setPrice(parseFloat(ticker.last_price));

          // Calculate 24h change if available
          if (ticker.open_24h) {
            const open24h = parseFloat(ticker.open_24h);
            const currentPrice = parseFloat(ticker.last_price);
            setChange24h(((currentPrice - open24h) / open24h) * 100);
          }
        }

        setLoading(false);
      } catch (err) {
        logService.log('error', `Failed to fetch initial price for ${normalizedSymbol}`, err, 'AssetPriceIndicator');
        setError('Failed to load price');
        setLoading(false);
      }
    };

    // Subscribe to price updates with higher priority
    const subscribeToPrice = async () => {
      try {
        // Set higher priority for real-time updates
        await bitmartService.subscribeToSymbol(normalizedSymbol, { priority: 'high' });
      } catch (err) {
        logService.log('error', `Failed to subscribe to ${normalizedSymbol}`, err, 'AssetPriceIndicator');
      }
    };

    // Handle price updates with optimized rendering
    const handlePriceUpdate = (data: any) => {
      if (data.symbol === normalizedSymbol) {
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
          setPrice(parseFloat(data.price || data.last_price));
          setChange24h(data.change24h || 0);
          setLoading(false);
        });
      }
    };

    // Listen for price updates
    bitmartService.on('priceUpdate', handlePriceUpdate);

    // Initial setup
    fetchInitialPrice();
    subscribeToPrice();

    // Cleanup
    return () => {
      bitmartService.off('priceUpdate', handlePriceUpdate);
    };
  }, [symbol]);

  if (loading) {
    return (
      <div className={`flex items-center ${className}`}>
        <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
        <span className="text-xs text-gray-400 ml-1">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-xs text-gray-400 ${className}`}>
        {error}
      </div>
    );
  }

  if (price === null) {
    return (
      <div className={`text-xs text-gray-400 ${className}`}>
        No price data
      </div>
    );
  }

  // Format price with appropriate precision
  const formatPrice = (price: number): string => {
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 1000) return price.toFixed(2);
    return price.toFixed(2);
  };

  const isPositive = change24h >= 0;
  const changeColor = isPositive ? 'text-neon-turquoise' : 'text-neon-pink';
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown;

  if (compact) {
    return (
      <div className={`flex items-center ${className}`}>
        <span className="text-xs font-medium">{formatPrice(price)}</span>
        <ChangeIcon className={`w-3 h-3 ${changeColor} ml-1`} />
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      <span className="text-xs font-medium">{formatPrice(price)}</span>
      <div className={`flex items-center ${changeColor} ml-2`}>
        <ChangeIcon className="w-3 h-3 mr-1" />
        <span className="text-xs">{change24h.toFixed(1)}%</span>
      </div>
    </div>
  );
}
