import React from 'react';
import { Strategy } from '../../lib/types';

interface BeginnerStrategyDeleteModalProps {
  strategy: Strategy;
  onClose: () => void;
  onDelete: () => Promise<void>;
}

export function BeginnerStrategyDeleteModal({ strategy, onClose, onDelete }: BeginnerStrategyDeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
      <div className="panel-metallic rounded-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Delete Strategy</h2>
        <p className="text-gray-400 mb-6">Are you sure you want to delete "{strategy.title || strategy.name}"?</p>
        
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gunmetal-800 text-white rounded-lg hover:bg-gunmetal-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              await onDelete();
              onClose();
            }}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
