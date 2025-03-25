import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { exchangeService } from '../lib/exchange-service';

export function NetworkStatus() {
  const [status, setStatus] = useState<'online' | 'offline' | 'degraded'>('online');
  const [latency, setLatency] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    if (checking) return;
    setChecking(true);

    try {
      const start = performance.now();
      const health = await exchangeService.checkHealth();
      const end = performance.now();
      
      setLatency(Math.round(end - start));
      setStatus(health.ok ? (health.degraded ? 'degraded' : 'online') : 'offline');
    } catch (error) {
      setStatus('offline');
      setLatency(null);
    } finally {
      setChecking(false);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'online': return 'text-neon-turquoise';
      case 'degraded': return 'text-neon-yellow';
      case 'offline': return 'text-neon-pink';
    }
  };

  const getStatusBg = () => {
    switch (status) {
      case 'online': return 'bg-neon-turquoise/10';
      case 'degraded': return 'bg-neon-yellow/10';
      case 'offline': return 'bg-neon-pink/10';
    }
  };

  const getStatusIcon = () => {
    if (checking) {
      return <Loader2 className={`w-4 h-4 animate-spin ${getStatusColor()}`} />;
    }
    
    switch (status) {
      case 'online':
        return <Wifi className={`w-4 h-4 ${getStatusColor()}`} />;
      case 'degraded':
        return <Wifi className={`w-4 h-4 ${getStatusColor()}`} />;
      case 'offline':
        return <WifiOff className={`w-4 h-4 ${getStatusColor()}`} />;
    }
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 ${getStatusBg()} rounded-lg`}>
      {getStatusIcon()}
      <span className={`text-xs font-mono ${getStatusColor()}`}>
        {status === 'offline' ? 'Offline' : 
         status === 'degraded' ? `Degraded ${latency}ms` :
         `Online ${latency}ms`}
      </span>
    </div>
  );
}