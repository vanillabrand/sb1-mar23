import React from 'react';
import { Strategy } from '../../lib/types';

interface ExpertStrategyAnalyticsProps {
  strategies: Strategy[];
  onClose: () => void;
}

export function ExpertStrategyAnalytics({ strategies, onClose }: ExpertStrategyAnalyticsProps) {
  return (
    <div className="panel-metallic rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4">Strategy Analytics</h2>
      <p className="text-gray-400 mb-6">Advanced analytics and performance metrics for your strategies.</p>
      
      <div className="text-center py-8">
        <p className="text-gray-500">Strategy analytics coming soon...</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gunmetal-800 text-white rounded-lg hover:bg-gunmetal-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
