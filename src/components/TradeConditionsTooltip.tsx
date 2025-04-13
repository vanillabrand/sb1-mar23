import React from 'react';
import { Info } from 'lucide-react';
import { Trade } from '../types';
import { Tooltip } from './Tooltip';

interface TradeConditionsTooltipProps {
  trade: Trade;
}

export const TradeConditionsTooltip: React.FC<TradeConditionsTooltipProps> = ({ trade }) => {
  const renderConditions = () => {
    const conditions = [];
    
    if (trade.take_profit) {
      conditions.push(`Take Profit: $${trade.take_profit}`);
    }
    if (trade.stop_loss) {
      conditions.push(`Stop Loss: $${trade.stop_loss}`);
    }
    if (trade.trailing_stop) {
      conditions.push(`Trailing Stop: ${trade.trailing_stop}%`);
    }
    if (trade.exit_conditions) {
      conditions.push(...trade.exit_conditions);
    }

    return conditions.join('\n');
  };

  return (
    <Tooltip content={renderConditions()}>
      <Info className="w-4 h-4 text-gray-400 hover:text-neon-turquoise cursor-help" />
    </Tooltip>
  );
};