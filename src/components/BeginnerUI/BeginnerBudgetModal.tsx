import React, { useState } from 'react';
import { Strategy } from '../../lib/types';

interface BeginnerBudgetModalProps {
  strategy: Strategy;
  currentBudget: number;
  onClose: () => void;
  onSave: () => Promise<void>;
}

export function BeginnerBudgetModal({ strategy, currentBudget, onClose, onSave }: BeginnerBudgetModalProps) {
  const [budget, setBudget] = useState(currentBudget);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
      <div className="panel-metallic rounded-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Set Budget</h2>
        <p className="text-gray-400 mb-4">Set the budget for "{strategy.title || strategy.name}"</p>
        
        <div className="mb-6">
          <label htmlFor="budget" className="block text-sm font-medium text-gray-300 mb-2">
            Budget (USDT)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
            <input
              id="budget"
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              min="10"
              step="10"
              className="w-full pl-8 pr-4 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-turquoise"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gunmetal-800 text-white rounded-lg hover:bg-gunmetal-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              await onSave();
              onClose();
            }}
            className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
