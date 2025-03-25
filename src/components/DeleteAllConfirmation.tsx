import React from 'react';
import { AlertTriangle, Loader2, AlertCircle } from 'lucide-react';

interface DeleteAllConfirmationProps {
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isDeleting: boolean;
  error: string | null;
  hasActiveStrategies?: boolean;
}

export function DeleteAllConfirmation({ 
  onConfirm, 
  onCancel, 
  isDeleting, 
  error,
  hasActiveStrategies = false
}: DeleteAllConfirmationProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-gunmetal-800">
        <div className="flex items-center gap-3 mb-6 text-neon-pink">
          <AlertTriangle className="w-6 h-6" />
          <h2 className="text-xl font-bold">Delete All Strategies</h2>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {hasActiveStrategies ? (
          <>
            <div className="bg-neon-yellow/10 border border-neon-yellow/20 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-neon-yellow">
                <AlertTriangle className="w-5 h-5" />
                <p className="font-medium">Active Strategies Detected</p>
              </div>
              <p className="text-gray-300 mt-2">
                Please deactivate all active strategies before deleting. This ensures all trades are properly closed and resources are cleaned up.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete all inactive strategies? This action cannot be undone and will:
            </p>

            <ul className="space-y-2 mb-6 text-sm text-gray-400">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-neon-pink"></div>
                Remove all inactive strategy configurations
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-neon-pink"></div>
                Clear associated budget allocations
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-neon-pink"></div>
                Delete historical trade data
              </li>
            </ul>

            <div className="flex justify-end gap-3">
              <button
                onClick={onCancel}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-neon-pink text-white rounded-lg hover:bg-red-500 transition-all duration-300 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete All Strategies'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}