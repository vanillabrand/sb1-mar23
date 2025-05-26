import React from 'react';
import { Strategy } from '../../lib/types';

interface ExpertStrategyBatchActionsProps {
  strategies: Strategy[];
  onComplete: () => Promise<void>;
  onClose: () => void;
}

export function ExpertStrategyBatchActions({ strategies, onComplete, onClose }: ExpertStrategyBatchActionsProps) {
  return (
    <div className="panel-metallic rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4">Batch Actions</h2>
      <p className="text-gray-400 mb-6">Perform actions on {strategies.length} selected strategies.</p>
      
      <div className="text-center py-8">
        <p className="text-gray-500">Batch actions coming soon...</p>
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
