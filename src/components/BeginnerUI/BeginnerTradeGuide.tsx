import React from 'react';

interface BeginnerTradeGuideProps {
  onClose: () => void;
}

export function BeginnerTradeGuide({ onClose }: BeginnerTradeGuideProps) {
  return (
    <div className="panel-metallic rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4">Trading Guide</h2>
      <p className="text-gray-400 mb-6">Learn the basics of trading and how to read trade information.</p>
      
      <div className="text-center py-8">
        <p className="text-gray-500">Trading guide coming soon...</p>
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
