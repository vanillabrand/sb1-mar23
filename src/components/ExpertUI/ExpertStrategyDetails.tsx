import React from 'react';
import { Strategy } from '../../lib/types';

interface ExpertStrategyDetailsProps {
  strategy: Strategy;
  onRefresh: () => Promise<void>;
}

export function ExpertStrategyDetails({ strategy, onRefresh }: ExpertStrategyDetailsProps) {
  return (
    <div className="panel-metallic rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4">Expert Strategy Details</h2>
      <p className="text-gray-400 mb-6">Advanced strategy management for "{strategy.title || strategy.name}"</p>
      
      <div className="text-center py-8">
        <p className="text-gray-500">Expert strategy details coming soon...</p>
      </div>
    </div>
  );
}
