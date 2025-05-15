import React, { useState } from 'react';
import { motion } from 'framer-motion';

export interface TradeFlowStageProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'completed' | 'current' | 'upcoming' | 'failed';
  isDemo?: boolean;
  className?: string;
}

export function TradeFlowStage({ 
  title, 
  description, 
  icon, 
  status, 
  isDemo = false,
  className = ''
}: TradeFlowStageProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div className={`relative ${className}`}>
      <div 
        className={`flex flex-col items-center ${status === 'upcoming' ? 'opacity-50' : ''}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div 
          className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
            status === 'completed' ? 'bg-green-500/20 text-green-400' :
            status === 'current' ? 'bg-blue-500/20 text-blue-400 animate-pulse' :
            status === 'failed' ? 'bg-red-500/20 text-red-400' :
            'bg-gunmetal-800 text-gray-400'
          } ${isDemo ? 'border border-neon-turquoise/30' : ''}`}
        >
          {icon}
        </div>
        <h4 className="text-sm font-medium text-gray-300 text-center">{title}</h4>
      </div>
      
      {/* Tooltip */}
      {showTooltip && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-48 p-2 bg-gunmetal-900 border border-gunmetal-700 rounded-lg shadow-xl z-10"
        >
          <p className="text-xs text-gray-300">{description}</p>
          {isDemo && (
            <p className="text-xs text-neon-turquoise mt-1">Demo Mode</p>
          )}
        </motion.div>
      )}
    </div>
  );
}
