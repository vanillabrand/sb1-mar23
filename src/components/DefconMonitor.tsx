import { useMemo } from 'react';
import { AlertTriangle, Shield, ShieldCheck, AlertCircle } from 'lucide-react';
import type { Strategy } from '../lib/types';

interface DefconMonitorProps {
  strategies: Strategy[];
  className?: string;
}

export function DefconMonitor({ strategies, className = '' }: DefconMonitorProps) {
  const defconLevel = useMemo(() => {
    if (!strategies.length) return 5;

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
        bg-gradient-to-br ${getDefconBackground(defconLevel)}
        border ${getBorderColor(defconLevel)}
        rounded-xl backdrop-blur-sm
      `}>
        <div className="px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className={`
              ${getDefconColor(defconLevel)}
              p-1 sm:p-1.5
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
                <h3 className={`text-base sm:text-lg font-mono font-bold tracking-wider ${getDefconColor(defconLevel)}`}>
                  DEFCON {defconLevel}
                </h3>
                <span className="text-[10px] sm:text-xs text-gray-500 font-mono tracking-wider">
                  {strategies.length} STRATEGIES MONITORED
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 font-mono tracking-wider mt-0.5 truncate">
                {getDefconDescription(defconLevel)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
