import React from 'react';
import { Trade } from '../types';
import { demoService } from '../lib/demo-service';

interface TradeStatusBadgeProps {
  trade: Trade;
}

export const TradeStatusBadge: React.FC<TradeStatusBadgeProps> = ({ trade }) => {
  const isDemo = demoService.isDemoMode();
  
  const getStatusConfig = (status: string) => {
    const baseConfig = {
      executed: 'bg-green-500/20 text-green-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      open: 'bg-blue-500/20 text-blue-400',
      closed: 'bg-gray-500/20 text-gray-400',
    }[status] || 'bg-gray-500/20 text-gray-400';

    // Add demo indicator if in demo mode
    return isDemo ? `${baseConfig} border border-neon-turquoise/30` : baseConfig;
  };

  const getStatusLabel = (status: string) => {
    return isDemo ? `${status} (Demo)` : status;
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs ${getStatusConfig(trade.status)}`}
      title={trade.status === 'executed' ? 
        `${isDemo ? 'Demo ' : ''}Executed: ${trade.executedAt ? new Date(trade.executedAt).toLocaleString() : 'Unknown'}` : 
        ''}
    >
      {getStatusLabel(trade.status)}
    </span>
  );
};
