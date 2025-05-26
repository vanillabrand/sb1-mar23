import React from 'react';
import { Strategy } from '../../lib/types';

interface BeginnerStrategyTemplatesProps {
  onSelectTemplate: (strategy: Strategy) => void;
  onCancel: () => void;
}

export function BeginnerStrategyTemplates({ onSelectTemplate, onCancel }: BeginnerStrategyTemplatesProps) {
  return (
    <div className="panel-metallic rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4">Strategy Templates</h2>
      <p className="text-gray-400 mb-6">Choose from pre-built strategy templates to get started quickly.</p>
      
      <div className="text-center py-8">
        <p className="text-gray-500">Strategy templates coming soon...</p>
        <button
          onClick={onCancel}
          className="mt-4 px-4 py-2 bg-gunmetal-800 text-white rounded-lg hover:bg-gunmetal-700 transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}
