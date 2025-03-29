import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface WidgetErrorProps {
  title?: string;
  message?: string;
  className?: string;
  onRetry?: () => void;
}

export function WidgetError({ 
  title = 'Widget Error', 
  message = 'Failed to load widget data', 
  className = '',
  onRetry 
}: WidgetErrorProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-4 bg-gunmetal-800/30 rounded-lg ${className}`}>
      <AlertTriangle className="w-8 h-8 text-neon-pink mb-2" />
      <h3 className="text-lg font-semibold text-neon-pink mb-1">
        {title}
      </h3>
      <p className="text-sm text-gray-400 text-center">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-gunmetal-700 hover:bg-gunmetal-600 
                     text-sm text-gray-200 rounded-md transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}