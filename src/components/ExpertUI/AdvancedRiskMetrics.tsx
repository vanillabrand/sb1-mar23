import React from 'react';
import { AlertCircle } from 'lucide-react';

export function AdvancedRiskMetrics() {
  return (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-neon-raspberry" />
        Advanced Risk Metrics
      </h3>
      <p className="text-gray-400 mb-4">Detailed risk analysis and portfolio exposure metrics.</p>
      <div className="h-64 bg-gunmetal-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Risk metrics will appear here</p>
      </div>
    </div>
  );
}
