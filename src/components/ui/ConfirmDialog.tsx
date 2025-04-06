import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: 'primary' | 'destructive';
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = 'primary'
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="panel-metallic backdrop-blur-xl rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-full ${confirmVariant === 'destructive' ? 'bg-red-500/10 text-red-500' : 'bg-neon-turquoise/10 text-neon-turquoise'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-gray-200">{title}</h2>
        </div>

        <p className="text-gray-300 mb-6">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg ${
              confirmVariant === 'destructive'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-neon-turquoise text-gunmetal-950 hover:bg-neon-yellow'
            } transition-all duration-300`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
