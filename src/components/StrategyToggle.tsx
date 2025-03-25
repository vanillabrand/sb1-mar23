import React, { useState } from 'react';
import { Power, Loader2 } from 'lucide-react';
import { marketService } from '../lib/market-service';
import { logService } from '../lib/log-service';
import type { Strategy } from '../lib/supabase-types';

interface StrategyToggleProps {
  strategy: Strategy;
  onToggle: () => void;
}

export function StrategyToggle({ strategy, onToggle }: StrategyToggleProps) {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    
    try {
      setIsToggling(true);
      
      if (strategy.status === 'active') {
        await marketService.stopStrategyMonitoring(strategy.id);
      } else {
        // Start monitoring if strategy is not active
        await marketService.startStrategyMonitoring(strategy.id);
      }
      
      onToggle();
    } catch (error) {
      logService.log('error', `Failed to toggle strategy ${strategy.id}`, error, 'StrategyToggle');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
        strategy.status === 'active' 
          ? 'bg-neon-turquoise/20 text-neon-turquoise hover:bg-neon-turquoise/30' 
          : 'bg-gunmetal-700 text-gray-400 hover:bg-gunmetal-600'
      }`}
      title={strategy.status === 'active' ? 'Stop Strategy' : 'Start Strategy'}
    >
      {isToggling ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Power className="w-5 h-5" />
      )}
    </button>
  );
}
