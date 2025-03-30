import React from 'react';
import type { Strategy } from '../lib/types';

interface StrategyStatusProps {
  strategies?: Strategy[];
}

export function StrategyStatus({ strategies = [] }: StrategyStatusProps) {
  if (!strategies || strategies.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-400">No active strategies</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {strategies.map(strategy => (
        <div key={strategy.id} className="p-4 bg-gunmetal-900 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">{strategy.title}</h3>
            <span className={`px-2 py-1 rounded text-sm ${
              strategy.status === 'active' ? 'bg-green-500/20 text-green-400' : 
              'bg-gray-500/20 text-gray-400'
            }`}>
              {strategy.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
