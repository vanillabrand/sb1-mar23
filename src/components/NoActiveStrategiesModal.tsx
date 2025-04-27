import React from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NoActiveStrategiesModalProps {
  className?: string;
}

export const NoActiveStrategiesModal: React.FC<NoActiveStrategiesModalProps> = ({ className = '' }) => {
  const navigate = useNavigate();

  return (
    <div className={`panel-metallic rounded-xl p-8 text-center ${className}`}>
      <div className="flex flex-col items-center justify-center">
        <div className="relative mb-6">
          <Shield className="w-16 h-16 text-gray-700" />
          <AlertTriangle className="w-8 h-8 text-neon-yellow absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-3">No Active Strategies</h2>
        
        <p className="text-gray-400 mb-6 max-w-md mx-auto">
          The Risk Manager requires at least one active strategy to display risk analytics. 
          Please activate a strategy to start monitoring your portfolio risk.
        </p>
        
        <button
          onClick={() => navigate('/strategies')}
          className="px-6 py-3 bg-neon-turquoise text-black font-medium rounded-lg hover:bg-neon-turquoise/90 transition-all"
        >
          Go to Strategies
        </button>
      </div>
    </div>
  );
};
