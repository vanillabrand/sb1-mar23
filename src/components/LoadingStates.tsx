import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <Loader2 className="animate-spin" size={size} />
);

export const LoadingOverlay: React.FC<{ message?: string }> = ({ message }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
    <div className="bg-gray-900 p-6 rounded-lg flex flex-col items-center gap-4">
      <LoadingSpinner size={32} />
      {message && <p className="text-gray-200">{message}</p>}
    </div>
  </div>
);

export const ComponentLoader: React.FC<{
  isLoading: boolean;
  error?: Error | null;
  children: React.ReactNode;
}> = ({ isLoading, error, children }) => {
  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">{error.message}</div>;
  return <>{children}</>;
};