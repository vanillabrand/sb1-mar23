import React from 'react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-gunmetal-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-neon-blue mb-4"></div>
        <h2 className="text-xl font-bold text-white mb-2">Initializing Application</h2>
        <p className="text-gray-400">Please wait while we set things up...</p>
      </div>
    </div>
  );
};