import React from 'react';
import { TradeMonitor } from '../TradeMonitor';
import { Strategy } from '../../lib/types';

interface ExpertTradeMonitorProps {
  strategies?: Strategy[];
  className?: string;
}

export function ExpertTradeMonitor({ strategies = [], className = '' }: ExpertTradeMonitorProps) {
  // For now, use the existing TradeMonitor component
  return <TradeMonitor strategies={strategies} className={className} />;
}
