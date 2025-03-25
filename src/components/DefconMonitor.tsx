import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import useSound from 'use-sound';
import { marketService } from '../lib/market-service';
import { analyticsService } from '../lib/analytics-service';
import { bitmartService } from '../lib/bitmart-service';

interface DefconMonitorProps {
  volatility: number; // 0-100
  className?: string;
}

export function DefconMonitor({ volatility, className = "" }: DefconMonitorProps) {
  const [defconLevel, setDefconLevel] = useState(5);
  const [pulseSpeed, setPulseSpeed] = useState(2);
  const [playKlaxon] = useSound('https://assets.mixkit.co/active_storage/sfx/2894/2894-preview.mp3', { volume: 0.5 });
  const [lastDefconLevel, setLastDefconLevel] = useState(5);
  const [marketMetrics, setMarketMetrics] = useState({
    volatility: 0,
    riskScore: 0,
    sentiment: 0,
    volume: 0
  });

  useEffect(() => {
    const updateMarketMetrics = async () => {
      try {
        // Get market metrics from various services
        const dashboardMetrics = analyticsService.getDashboardMetrics();
        const riskProfile = dashboardMetrics?.riskProfile?.current || 0;
        
        // Get real-time market data
        const btcData = bitmartService.getAssetData('BTC_USDT');
        const ethData = bitmartService.getAssetData('ETH_USDT');
        
        // Calculate combined volatility
        const btcVol = Math.abs(btcData?.change24h || 0);
        const ethVol = Math.abs(ethData?.change24h || 0);
        const avgVolatility = (btcVol + ethVol) / 2;
        
        // Calculate volume intensity
        const btcVol24h = btcData?.volume24h || 0;
        const ethVol24h = ethData?.volume24h || 0;
        const volumeIntensity = ((btcVol24h + ethVol24h) / 2) / 1000000; // Normalize to millions
        
        // Calculate market sentiment (-100 to 100)
        const sentiment = ((btcData?.change24h || 0) + (ethData?.change24h || 0)) / 2;
        
        setMarketMetrics({
          volatility: avgVolatility,
          riskScore: riskProfile * 10, // Scale to 0-100
          sentiment: (sentiment + 100) / 2, // Normalize to 0-100
          volume: Math.min(volumeIntensity, 100)
        });
      } catch (error) {
        console.error('Error updating market metrics:', error);
      }
    };

    updateMarketMetrics();
    const interval = setInterval(updateMarketMetrics, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Calculate DEFCON level based on multiple factors
    const calculateDefconLevel = () => {
      const weights = {
        volatility: 0.3,
        riskScore: 0.3,
        sentiment: 0.2,
        volume: 0.2
      };

      const weightedScore = 
        (marketMetrics.volatility * weights.volatility) +
        (marketMetrics.riskScore * weights.riskScore) +
        (marketMetrics.sentiment * weights.sentiment) +
        (marketMetrics.volume * weights.volume);

      // Map score to DEFCON levels (1-5)
      if (weightedScore >= 80) return 1;
      if (weightedScore >= 60) return 2;
      if (weightedScore >= 40) return 3;
      if (weightedScore >= 20) return 4;
      return 5;
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

  const defconDescriptions = {
    5: 'NORMAL READINESS',
    4: 'INCREASED INTEL',
    3: 'INCREASED ALERT',
    2: 'HIGH READINESS',
    1: 'MAXIMUM ALERT'
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
            {defconDescriptions[defconLevel as keyof typeof defconDescriptions]}
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
      </div>
    </div>
  );
}