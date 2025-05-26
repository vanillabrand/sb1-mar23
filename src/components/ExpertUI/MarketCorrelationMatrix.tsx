import React from 'react';
import { TrendingUp } from 'lucide-react';

export function MarketCorrelationMatrix() {
  return (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-neon-yellow" />
        Market Correlation Matrix
      </h3>
      <p className="text-gray-400 mb-4">Asset correlation analysis for diversification optimization.</p>
      <div className="h-64 bg-gunmetal-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Correlation matrix will appear here</p>
      </div>
    </div>
  );
}
