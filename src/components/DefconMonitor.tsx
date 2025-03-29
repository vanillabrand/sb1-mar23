import React, { useMemo } from 'react';
import { AlertTriangle, Shield, ShieldCheck } from 'lucide-react';
import type { Strategy } from '../lib/types';

interface DefconMonitorProps {
  strategies: Strategy[];
  className?: string;
}

export function DefconMonitor({ strategies, className = '' }: DefconMonitorProps) {
  const defconLevel = useMemo(() => {
    if (!strategies.length) return 5;
    
    const hasErrors = strategies.some(s => s.status === 'error');
    if (hasErrors) return 1;
    
    const hasWarnings = strategies.some(s => s.status === 'warning');
    if (hasWarnings) return 2;
    
    const allHealthy = strategies.every(s => s.status === 'active');
    if (allHealthy) return 5;
    
    return 3;
  }, [strategies]);

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
      case 1: return <AlertTriangle className="w-6 h-6" />;
      case 2: return <AlertTriangle className="w-6 h-6" />;
      case 3: return <Shield className="w-6 h-6" />;
      default: return <ShieldCheck className="w-6 h-6" />;
    }
  };

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      <div className={`flex items-center space-x-2 ${getDefconColor(defconLevel)}`}>
        {getDefconIcon(defconLevel)}
        <span className="font-mono text-xl">DEFCON {defconLevel}</span>
      </div>
      <div className="text-sm text-gray-400">
        Monitoring {strategies.length} active strategies
      </div>
    </div>
  );
}
