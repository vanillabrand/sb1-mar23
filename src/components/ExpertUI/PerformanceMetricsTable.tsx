import React from 'react';
import { Table } from 'lucide-react';

export function PerformanceMetricsTable() {
  return (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Table className="w-5 h-5 text-neon-green" />
        Performance Metrics
      </h3>
      <p className="text-gray-400 mb-4">Detailed performance metrics for all strategies and trades.</p>
      <div className="h-64 bg-gunmetal-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Performance metrics table will appear here</p>
      </div>
    </div>
  );
}
