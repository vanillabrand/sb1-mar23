import React, { useState } from 'react';
import { AlertTriangle, Loader2, AlertCircle } from 'lucide-react';
import { logService } from '../lib/log-service';

interface DeleteConfirmationProps {
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  name: string;
  isDeleting?: boolean;
}

export function DeleteConfirmation({ onConfirm, onCancel, name, isDeleting = false }: DeleteConfirmationProps) {
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleConfirm = async () => {
    try {
      setError(null);
      setIsClosing(true);
      await onConfirm();
      onCancel();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete strategy';
      setError(message);
      logService.log('error', 'Error in delete confirmation:', error, 'DeleteConfirmation');
      setIsClosing(false);
    }
  };

  const handleCancel = () => {
    setIsClosing(true);
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-gunmetal-800">
        <div className="flex items-center gap-3 mb-6 text-neon-pink">
          <AlertTriangle className="w-6 h-6" />
          <h2 className="text-xl font-bold">Delete Strategy</h2>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <p className="text-gray-300 mb-6">
          Are you sure you want to delete <span className="text-neon-turquoise font-semibold">{name}</span>? 
          This action cannot be undone and all associated data will be permanently removed.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={isDeleting || isClosing}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting || isClosing}
            className="flex items-center gap-2 px-4 py-2 bg-neon-pink text-white rounded-lg hover:bg-red-500 transition-all duration-300 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Strategy'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}