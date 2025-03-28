import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import useSound from 'use-sound';
import { 
  marketService,
  analyticsService,
  bitmartService 
} from '../lib/services';
import { strategyMonitor } from '../lib/strategy-monitor';
import type { Strategy } from '../lib/types';

interface MarketMetrics {
  volatility: number;      // 0-100
  riskScore: number;       // 0-100
  sentiment: number;       // 0-100 (normalized from -100 to 100)
  volume: number;         // 0-100 (normalized)
  activeStrategiesRisk: number; // 0-100
}

interface DefconMonitorProps {
  className?: string;
  strategies?: Strategy[];
}

export function DefconMonitor({ className = "", strategies = [] }: DefconMonitorProps) {
  const [defconLevel, setDefconLevel] = useState(5);
  const [pulseSpeed, setPulseSpeed] = useState(2);
  const [playKlaxon] = useSound('https://assets.mixkit.co/active_storage/sfx/2894/2894-preview.mp3', { volume: 0.5 });
  const [lastDefconLevel, setLastDefconLevel] = useState(5);
  const [marketMetrics, setMarketMetrics] = useState<MarketMetrics>({
    volatility: 0,
    riskScore: 0,
    sentiment: 0,
    volume: 0,
    activeStrategiesRisk: 0
  });

  useEffect(() => {
    const updateMarketMetrics = async () => {
      try {
        // Get market metrics from various services
        const dashboardMetrics = await analyticsService.getDashboardMetrics();
        const riskProfile = dashboardMetrics?.riskProfile?.current || 0;
        
        // Get real-time market data for major assets
        const btcData = await bitmartService.getAssetData('BTC_USDT');
        const ethData = await bitmartService.getAssetData('ETH_USDT');
        
        // Calculate volatility metrics
        const btcVol = Math.abs(btcData?.change24h || 0);
        const ethVol = Math.abs(ethData?.change24h || 0);
        const avgVolatility = (btcVol + ethVol) / 2;
        
        // Calculate volume intensity
        const btcVol24h = btcData?.volume24h || 0;
        const ethVol24h = ethData?.volume24h || 0;
        const volumeIntensity = ((btcVol24h + ethVol24h) / 2) / 1000000; // Normalize to millions
        
        // Calculate market sentiment (-100 to 100)
        const sentiment = ((btcData?.change24h || 0) + (ethData?.change24h || 0)) / 2;

        // Calculate active strategies risk
        const strategiesRisk = await calculateStrategiesRisk(strategies);
        
        setMarketMetrics({
          volatility: avgVolatility,
          riskScore: riskProfile * 10, // Scale to 0-100
          sentiment: (sentiment + 100) / 2, // Normalize to 0-100
          volume: Math.min(volumeIntensity, 100),
          activeStrategiesRisk: strategiesRisk
        });
      } catch (error) {
        console.error('Error updating market metrics:', error);
      }
    };

    updateMarketMetrics();
    const interval = setInterval(updateMarketMetrics, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [strategies]);

  const calculateStrategiesRisk = async (strategies: Strategy[]): Promise<number> => {
    if (!strategies.length) return 0;

    const risks = await Promise.all(
      strategies.map(async (strategy) => {
        const monitor = await strategyMonitor.getStrategyStatus(strategy.id);
        return monitor.riskScore || 0;
      })
    );

    return Math.min(100, (risks.reduce((a, b) => a + b, 0) / risks.length));
  };

  useEffect(() => {
    // Calculate DEFCON level based on multiple factors
    const calculateDefconLevel = () => {
      const weights = {
        volatility: 0.25,
        riskScore: 0.25,
        sentiment: 0.2,
        volume: 0.15,
        strategiesRisk: 0.15
      };

      const weightedScore = 
        (marketMetrics.volatility * weights.volatility) +
        (marketMetrics.riskScore * weights.riskScore) +
        ((100 - marketMetrics.sentiment) * weights.sentiment) + // Invert sentiment for risk calculation
        (marketMetrics.volume * weights.volume) +
        (marketMetrics.activeStrategiesRisk * weights.strategiesRisk);

      // Map weighted score to DEFCON levels (1-5)
      if (weightedScore >= 80) return 1;      // Maximum Alert
      if (weightedScore >= 60) return 2;      // High Readiness
      if (weightedScore >= 40) return 3;      // Increased Alert
      if (weightedScore >= 20) return 4;      // Increased Intel
      return 5;                               // Normal Readiness
    };

    const level = calculateDefconLevel();
    setDefconLevel(level);

    // Play klaxon sound when entering DEFCON 1
    if (level === 1 && lastDefconLevel !== 1) {
      playKlaxon();
    }
    setLastDefconLevel(level);

    // Calculate pulse speed (1-5, where 5 is fastest)
    const speed = Math.max(1, Math.min(5, Math.ceil(marketMetrics.volatility / 20)));
    setPulseSpeed(speed);
  }, [marketMetrics, lastDefconLevel, playKlaxon]);

  const defconColors = {
    5: '#2dd4bf', // Cyan
    4: '#22c55e', // Green
    3: '#facc15', // Yellow
    2: '#fb923c', // Orange
    1: '#ef4444'  // Red
  };

  const getMarketStateDescription = (): string => {
    const { volatility, sentiment, riskScore } = marketMetrics;
    
    if (defconLevel === 1) return "EXTREME MARKET VOLATILITY - HIGH RISK";
    if (defconLevel === 2) return "SIGNIFICANT MARKET INSTABILITY";
    if (defconLevel === 3) return "ELEVATED MARKET UNCERTAINTY";
    if (defconLevel === 4) return "MODERATE MARKET FLUCTUATION";
    return "STABLE MARKET CONDITIONS";
  };

  const pulseAnimation = {
    initial: { 
      opacity: 0.3,
      scale: 1,
      boxShadow: '0 0 0px currentColor'
    },
    animate: { 
      opacity: [0.3, 1, 0.3],
      scale: [1, 1.05, 1],
      boxShadow: ['0 0 3px currentColor', '0 0 20px currentColor', '0 0 3px currentColor'],
      transition: {
        duration: 6 - pulseSpeed,
        repeat: Infinity,
        ease: [0.455, 0.03, 0.515, 0.955],
        times: [0, 0.5, 1]
      }
    }
  };

  const glowAnimation = {
    initial: {
      filter: 'drop-shadow(0 0 0px currentColor)'
    },
    animate: {
      filter: ['drop-shadow(0 0 2px currentColor)', 'drop-shadow(0 0 10px currentColor)', 'drop-shadow(0 0 2px currentColor)'],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      {/* DEFCON Level Box */}
      <div className="flex flex-col items-center">
        <motion.div
          className="relative w-24 h-24 bg-black rounded-lg flex items-center justify-center backdrop-blur-lg"
          animate={pulseAnimation}
          style={{ 
            color: defconColors[defconLevel as keyof typeof defconColors],
            border: `3px solid ${defconColors[defconLevel as keyof typeof defconColors]}`,
            boxShadow: `0 0 10px ${defconColors[defconLevel as keyof typeof defconColors]}`
          }}
        >
          <motion.span 
            className="text-4xl font-bold font-mono"
            animate={glowAnimation}
          >
            {defconLevel}
          </motion.span>
        </motion.div>
        <div className="text-center mt-2">
          <motion.p 
            className="text-lg font-bold font-mono"
            animate={glowAnimation}
            style={{ color: defconColors[defconLevel as keyof typeof defconColors] }}
          >
            D E F C O N
          </motion.p>
          <p className="text-sm font-medium text-gray-400 mt-1">
            {getMarketStateDescription()}
          </p>
        </div>
      </div>

      {/* Market Metrics */}
      <div className="space-y-2">
        <div>
          <p className="text-sm text-gray-400">Market Volatility</p>
          <p className="text-xl font-bold text-neon-yellow">
            {marketMetrics.volatility.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Risk Score</p>
          <p className="text-xl font-bold text-neon-orange">
            {marketMetrics.riskScore.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Market Sentiment</p>
          <p className={`text-xl font-bold ${
            marketMetrics.sentiment > 60 ? 'text-neon-turquoise' :
            marketMetrics.sentiment < 40 ? 'text-neon-pink' :
            'text-neon-yellow'
          }`}>
            {marketMetrics.sentiment.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Strategies Risk</p>
          <p className="text-xl font-bold text-neon-purple">
            {marketMetrics.activeStrategiesRisk.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}
