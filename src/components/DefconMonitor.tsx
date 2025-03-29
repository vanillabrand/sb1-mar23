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
      case 1: return 'from-red-500/5 to-red-500/10';
      case 2: return 'from-orange-500/5 to-orange-500/10';
      case 3: return 'from-yellow-500/5 to-yellow-500/10';
      case 4: return 'from-blue-500/5 to-blue-500/10';
      default: return 'from-green-500/5 to-green-500/10';
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

  return (
    <div className={`${className}`}>
      <div className={`
        bg-gradient-to-br ${getDefconBackground(defconLevel)}
        border ${getBorderColor(defconLevel)}
        rounded-xl backdrop-blur-sm
      `}>
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            <div className={`${getDefconColor(defconLevel)}`}>
              {getDefconIcon(defconLevel)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className={`text-xl font-mono font-bold tracking-wider ${getDefconColor(defconLevel)}`}>
                  DEFCON {defconLevel}
                </h3>
                <span className="text-xs text-gray-500 font-mono tracking-wider">
                  {strategies.length} STRATEGIES MONITORED
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono tracking-wider mt-1">
                {getDefconDescription(defconLevel)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
