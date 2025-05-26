import React from 'react';
import { Trade } from '../../lib/types';

interface BeginnerTradeDetailsProps {
  trade: Trade;
  onRefresh: () => Promise<void>;
}

export function BeginnerTradeDetails({ trade, onRefresh }: BeginnerTradeDetailsProps) {
  return (
    <div className="panel-metallic rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4">Trade Details</h2>
      <p className="text-gray-400 mb-6">Detailed trade information for {trade.symbol}</p>
      
      <div className="text-center py-8">
        <p className="text-gray-500">Detailed trade view coming soon...</p>
      </div>
    </div>
  );
}
