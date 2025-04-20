import { useMemo, useEffect, useState } from 'react';
import { AlertTriangle, Shield, ShieldCheck, AlertCircle } from 'lucide-react';
import type { Strategy } from '../lib/types';
import { marketService } from '../lib/market-service';
import { exchangeService } from '../lib/exchange-service';
import { logService } from '../lib/log-service';

interface MarketCondition {
  volatility: number;  // 0-1 scale
  trend: 'bullish' | 'bearish' | 'neutral';
  volume: 'high' | 'normal' | 'low';
  sentiment: 'positive' | 'negative' | 'neutral';
  timestamp: number;
}

interface DefconMonitorProps {
  strategies: Strategy[];
  className?: string;
  // Optional props for direct market data input
  volatility?: number;  // 0-10 scale
  marketConditions?: MarketCondition;
}

export function DefconMonitor({ strategies, className = '', volatility, marketConditions }: DefconMonitorProps) {
  const [marketData, setMarketData] = useState<{
    volatility: number;
    marketConditions?: MarketCondition;
  }>({ volatility: 0 });

  // Fetch market data if not provided via props
  useEffect(() => {
    if (volatility !== undefined) {
      setMarketData(prev => ({ ...prev, volatility }));
    } else {
      // Fetch market volatility from service
      const fetchMarketData = async () => {
        try {
          // Get volatility data for major assets
          const assets = ['BTC/USDT', 'ETH/USDT'];
          let totalVolatility = 0;

          for (const asset of assets) {
            try {
              const candles = await exchangeService.getCandles(asset, '1h', 24);
              if (candles && candles.length > 0) {
                // Calculate volatility based on price movements
                const prices = candles.map((c: any) => c.close);
                const volatility = calculateVolatility(prices);
                totalVolatility += volatility;
              }
            } catch (error) {
              logService.log('warn', `Failed to fetch candles for ${asset}`, error, 'DefconMonitor');
            }
          }

          // Average volatility and scale to 0-10
          const avgVolatility = assets.length > 0 ? (totalVolatility / assets.length) * 10 : 0;
          setMarketData(prev => ({ ...prev, volatility: avgVolatility }));
        } catch (error) {
          logService.log('error', 'Failed to fetch market data', error, 'DefconMonitor');
        }
      };

      fetchMarketData();

      // Set up interval to refresh data every 5 minutes
      const interval = setInterval(fetchMarketData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [volatility]);

  // Update market conditions if provided via props
  useEffect(() => {
    if (marketConditions) {
      setMarketData(prev => ({ ...prev, marketConditions }));
    }
  }, [marketConditions]);

  // Helper function to calculate volatility
  const calculateVolatility = (prices: number[]): number => {
    if (prices.length < 2) return 0;

    // Calculate percentage changes
    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const change = (prices[i] - prices[i-1]) / prices[i-1];
      changes.push(change);
    }

    // Calculate standard deviation of changes
    const mean = changes.reduce((sum, val) => sum + val, 0) / changes.length;
    const squaredDiffs = changes.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
    const stdDev = Math.sqrt(variance);

    // Normalize to 0-1 scale (typical daily volatility ranges from 0-5%)
    return Math.min(stdDev * 20, 1);
  };

  const defconLevel = useMemo(() => {
    // Start with strategy-based checks
    if (!strategies.length) {
      // If no strategies, base level purely on market conditions
      if (marketData.volatility > 7) return 1; // Extreme volatility
      if (marketData.volatility > 5) return 2; // High volatility
      if (marketData.volatility > 3) return 3; // Moderate volatility
      return 4; // Low volatility
    }

    // Check for custom properties that might indicate errors
    const hasErrors = strategies.some(s => {
      // @ts-ignore - Check for custom properties that might be added at runtime
      return s.hasError === true || s.errorCount > 0 || s.status === 'error';
    });
    if (hasErrors) return 1;

    // Check for custom properties that might indicate warnings
    const hasWarnings = strategies.some(s => {
      // @ts-ignore - Check for custom properties that might be added at runtime
      return s.hasWarning === true || s.warningCount > 0 || s.status === 'warning';
    });
    if (hasWarnings) return 2;

    // Consider market conditions
    if (marketData.volatility > 7) return 2; // High volatility = DEFCON 2
    if (marketData.volatility > 5) return 3; // Moderate volatility = DEFCON 3

    // Check market trend if available
    if (marketData.marketConditions) {
      if (marketData.marketConditions.trend === 'bearish' &&
          marketData.marketConditions.sentiment === 'negative') {
        return 3; // Bearish trend with negative sentiment = DEFCON 3
      }
    }

    const allHealthy = strategies.every(s => s.status === 'active');
    if (allHealthy && marketData.volatility < 3) return 5; // All healthy and low volatility

    return 4; // Default to DEFCON 4 for normal conditions
  }, [strategies, marketData]);

  const getDefconColor = (level: number) => {
    switch (level) {
      case 1: return 'text-red-500';
      case 2: return 'text-orange-500';
      case 3: return 'text-yellow-500';
      case 4: return 'text-blue-500';
      default: return 'text-green-500';
    }
  };

  const getDefconIcon = (level: number) => {
    switch (level) {
      case 1: return <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />;
      case 2: return <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />;
      case 3: return <Shield className="w-4 h-4 sm:w-5 sm:h-5" />;
      case 4: return <Shield className="w-4 h-4 sm:w-5 sm:h-5" />;
      default: return <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />;
    }
  };

  const getDefconDescription = (level: number) => {
    switch (level) {
      case 1: return 'CRITICAL RISK LEVEL - IMMEDIATE ACTION REQUIRED';
      case 2: return 'HIGH RISK LEVEL - CAUTION ADVISED';
      case 3: return 'MODERATE RISK LEVEL - MONITOR CLOSELY';
      case 4: return 'LOW RISK LEVEL - NORMAL OPERATIONS';
      default: return 'MINIMAL RISK LEVEL - ALL SYSTEMS NORMAL';
    }
  };

  const getDefconBackground = (level: number) => {
    switch (level) {
      case 1: return 'from-red-500/5 to-transparent';
      case 2: return 'from-orange-500/5 to-transparent';
      case 3: return 'from-yellow-500/5 to-transparent';
      case 4: return 'from-blue-500/5 to-transparent';
      default: return 'from-green-500/5 to-transparent';
    }
  };

  const getBorderColor = (level: number) => {
    switch (level) {
      case 1: return 'border-red-500/20';
      case 2: return 'border-orange-500/20';
      case 3: return 'border-yellow-500/20';
      case 4: return 'border-blue-500/20';
      default: return 'border-green-500/20';
    }
  };

  const getDefconRingColor = (level: number) => {
    switch (level) {
      case 1: return 'ring-red-500/30';
      case 2: return 'ring-orange-500/30';
      case 3: return 'ring-yellow-500/30';
      case 4: return 'ring-blue-500/30';
      default: return 'ring-green-500/30';
    }
  };

  const getDefconGlowColor = (level: number) => {
    switch (level) {
      case 1: return 'shadow-red-500/20';
      case 2: return 'shadow-orange-500/20';
      case 3: return 'shadow-yellow-500/20';
      case 4: return 'shadow-blue-500/20';
      default: return 'shadow-green-500/20';
    }
  };

  return (
    <div className={`${className}`}>
      <div className={`
        panel-metallic rounded-xl backdrop-blur-sm
        bg-gradient-to-br ${getDefconBackground(defconLevel)}
      `}>
        <div className="px-3 py-3 sm:px-4">
          {/* Mobile layout (stacked) */}
          <div className="md:hidden">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-x-2 gap-y-2">
              <div className="flex items-center gap-2">
                <div className={`
                  ${getDefconColor(defconLevel)}
                  p-1.5
                  rounded-full
                  ring-1
                  ${getDefconRingColor(defconLevel)}
                  bg-gunmetal-950
                  shadow-lg
                  ${getDefconGlowColor(defconLevel)}
                  flex-shrink-0
                `}>
                  {getDefconIcon(defconLevel)}
                </div>
                <h3 className={`text-base font-mono font-bold tracking-wider ${getDefconColor(defconLevel)}`}>
                  DEFCON {defconLevel}
                </h3>
              </div>
              <span className="text-[10px] text-gray-500 font-mono tracking-wider bg-gunmetal-900/50 px-2 py-1 rounded-full">
                VOL: {marketData.volatility.toFixed(1)}/10
              </span>
            </div>

            <div className="pl-0 sm:pl-9"> {/* Align with the icon on larger screens */}
              <p className="text-[10px] text-gray-400 font-mono tracking-wider mb-1">
                {getDefconDescription(defconLevel)}
              </p>

              <div className="flex flex-wrap gap-1 sm:gap-2 mt-2">
                <span className="text-[10px] text-gray-500 font-mono tracking-wider bg-gunmetal-900/50 px-2 py-0.5 rounded-full">
                  {strategies.length} STRATEGIES
                </span>

                {marketData.marketConditions && (
                  <>
                    <span className="text-[10px] text-gray-500 font-mono tracking-wider bg-gunmetal-900/50 px-2 py-0.5 rounded-full">
                      {marketData.marketConditions.trend.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono tracking-wider bg-gunmetal-900/50 px-2 py-0.5 rounded-full">
                      {marketData.marketConditions.sentiment.toUpperCase()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Desktop layout (horizontal) */}
          <div className="hidden md:flex items-center gap-3">
            <div className={`
              ${getDefconColor(defconLevel)}
              p-1.5
              rounded-full
              ring-1
              ${getDefconRingColor(defconLevel)}
              bg-gunmetal-950
              shadow-lg
              ${getDefconGlowColor(defconLevel)}
              flex-shrink-0
            `}>
              {getDefconIcon(defconLevel)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h3 className={`text-lg font-mono font-bold tracking-wider ${getDefconColor(defconLevel)}`}>
                  DEFCON {defconLevel}
                </h3>
                <span className="text-xs text-gray-500 font-mono tracking-wider">
                  {strategies.length} STRATEGIES MONITORED
                </span>
                <span className="text-xs text-gray-500 font-mono tracking-wider ml-auto">
                  VOLATILITY: {marketData.volatility.toFixed(1)}/10
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono tracking-wider mt-0.5">
                {getDefconDescription(defconLevel)}
              </p>
              {marketData.marketConditions && (
                <p className="text-xs text-gray-400 font-mono tracking-wider mt-0.5">
                  MARKET: {marketData.marketConditions.trend.toUpperCase()} | SENTIMENT: {marketData.marketConditions.sentiment.toUpperCase()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
