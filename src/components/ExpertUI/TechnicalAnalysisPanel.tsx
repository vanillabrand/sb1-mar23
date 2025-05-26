import React from 'react';
import { BarChart2 } from 'lucide-react';

export function TechnicalAnalysisPanel() {
  return (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-neon-turquoise" />
        Technical Analysis
      </h3>
      <p className="text-gray-400 mb-4">Advanced technical indicators and chart patterns for selected assets.</p>
      <div className="h-64 bg-gunmetal-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Technical analysis charts will appear here</p>
      </div>
    </div>
  );
}
