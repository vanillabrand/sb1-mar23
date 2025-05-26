import React from 'react';

interface ExpertStrategyImportExportProps {
  onImportComplete: () => Promise<void>;
  onClose: () => void;
}

export function ExpertStrategyImportExport({ onImportComplete, onClose }: ExpertStrategyImportExportProps) {
  return (
    <div className="panel-metallic rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4">Import/Export Strategies</h2>
      <p className="text-gray-400 mb-6">Import and export strategy configurations.</p>
      
      <div className="text-center py-8">
        <p className="text-gray-500">Import/Export functionality coming soon...</p>
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
