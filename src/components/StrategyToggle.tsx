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
      className={`relative z-50 flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
        strategy.status === 'active'
          ? 'bg-neon-turquoise text-gunmetal-950 hover:bg-neon-yellow'
          : 'bg-gunmetal-800 text-gray-400 hover:text-neon-turquoise'
      } disabled:opacity-50`}
      title={strategy.status === 'active' ? 'Disable Strategy' : 'Enable Strategy'}
    >
      {isToggling ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Power className="w-4 h-4" />
      )}
      <span className="text-sm font-medium">
        {strategy.status === 'active' ? 'Active' : 'Inactive'}
      </span>
    </button>
  );
}