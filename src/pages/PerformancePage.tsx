import React from 'react';
import PerformanceMonitor from '../components/PerformanceMonitor';
import { useNavigate } from 'react-router-dom';

const PerformancePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">System Performance</h1>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
        >
          Back
        </button>
      </div>

      <PerformanceMonitor />
    </div>
  );
};

export default PerformancePage;
