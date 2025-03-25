import React, { useState, useEffect } from 'react';
import { Activity, Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';
import { exchangeService } from '../lib/exchange-service';
import { motion, AnimatePresence } from 'framer-motion';

interface HealthStatus {
  status: 'online' | 'offline' | 'degraded';
  latency: number;
  lastChecked: number;
  message?: string;
}

export function ExchangeHealth() {
  const [health, setHealth] = useState<HealthStatus>({
    status: 'online',
    latency: 0,
    lastChecked: Date.now()
  });
  const [checking, setChecking] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    if (checking) return;
    setChecking(true);

    try {
      const start = performance.now();
      const status = await exchangeService.checkHealth();
      const latency = Math.round(performance.now() - start);

      setHealth({
        status: status.ok ? (status.degraded ? 'degraded' : 'online') : 'offline',
        latency,
        lastChecked: Date.now(),
        message: status.message
      });
    } catch (error) {
      setHealth(prev => ({
        ...prev,
        status: 'offline',
        lastChecked: Date.now(),
        message: error instanceof Error ? error.message : 'Connection failed'
      }));
    } finally {
      setChecking(false);
    }
  };

  const getStatusColor = () => {
    switch (health.status) {
      case 'online':
        return 'text-neon-turquoise';
      case 'degraded':
        return 'text-neon-yellow';
      case 'offline':
        return 'text-neon-pink';
    }
  };

  const getStatusBg = () => {
    switch (health.status) {
      case 'online':
        return 'bg-neon-turquoise/10';
      case 'degraded':
        return 'bg-neon-yellow/10';
      case 'offline':
        return 'bg-neon-pink/10';
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-neon-turquoise';
    if (latency < 300) return 'text-neon-yellow';
    return 'text-neon-pink';
  };

  const getStatusIcon = () => {
    if (checking) {
      return <Loader2 className={`w-4 h-4 animate-spin ${getStatusColor()}`} />;
    }
    
    switch (health.status) {
      case 'online':
        return <Wifi className={`w-4 h-4 ${getStatusColor()}`} />;
      case 'degraded':
        return <AlertTriangle className={`w-4 h-4 ${getStatusColor()}`} />;
      case 'offline':
        return <WifiOff className={`w-4 h-4 ${getStatusColor()}`} />;
    }
  };

  const formatTimeSince = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="relative">
      <motion.button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg ${getStatusBg()} hover:bg-opacity-20 transition-colors`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
          </span>
        </div>
        {health.status !== 'offline' && (
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <span className={`text-sm font-mono ${getLatencyColor(health.latency)}`}>
              {health.latency}ms
            </span>
          </div>
        )}
      </motion.button>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-gunmetal-900/95 backdrop-blur-xl rounded-lg border border-gunmetal-800 p-4 z-10"
          >
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400">Last Check</p>
                <p className="text-sm font-medium text-gray-200">
                  {formatTimeSince(health.lastChecked)}
                </p>
              </div>
              {health.message && (
                <div>
                  <p className="text-xs text-gray-400">Status Message</p>
                  <p className={`text-sm font-medium ${getStatusColor()}`}>
                    {health.message}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400">Connection Type</p>
                <p className="text-sm font-medium text-gray-200">
                  {exchangeService.isDemo() ? 'Demo Mode' : 'Live Connection'}
                </p>
              </div>
              <button
                onClick={checkHealth}
                disabled={checking}
                className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-gunmetal-800 rounded-lg text-gray-300 hover:text-neon-turquoise transition-colors"
              >
                {checking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
                    Check Now
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}