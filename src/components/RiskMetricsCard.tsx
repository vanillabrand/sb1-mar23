import React from 'react';
import { motion } from 'framer-motion';

interface RiskMetricsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'red' | 'yellow' | 'green';
  description?: string;
}

export const RiskMetricsCard: React.FC<RiskMetricsCardProps> = ({
  title,
  value,
  icon,
  color,
  description
}) => {
  const getColorClasses = () => {
    switch (color) {
      case 'red':
        return 'text-red-400 bg-red-900/20';
      case 'yellow':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'green':
        return 'text-green-400 bg-green-900/20';
      default:
        return 'text-gray-400 bg-gray-900/20';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="panel-metallic rounded-lg p-4 flex flex-col"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">{title}</h3>
        <div className={`p-1.5 rounded-full ${getColorClasses()}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-white">{value}</span>
          {description && (
            <span className="text-xs text-gray-400 mt-1">{description}</span>
          )}
        </div>
        <div className="h-10 w-16">
          <RiskIndicator value={parseFloat(value)} color={color} />
        </div>
      </div>
    </motion.div>
  );
};

interface RiskIndicatorProps {
  value: number;
  color: 'red' | 'yellow' | 'green';
}

const RiskIndicator: React.FC<RiskIndicatorProps> = ({ value, color }) => {
  // Normalize value to 0-100 range if it's a percentage
  const normalizedValue = value > 1 && value <= 100 ? value : value * 100;
  
  // Calculate height based on normalized value (max height is 100%)
  const height = `${Math.min(100, normalizedValue)}%`;
  
  const getBarColor = () => {
    switch (color) {
      case 'red':
        return 'bg-gradient-to-t from-red-900/30 to-red-500/70';
      case 'yellow':
        return 'bg-gradient-to-t from-yellow-900/30 to-yellow-500/70';
      case 'green':
        return 'bg-gradient-to-t from-green-900/30 to-green-500/70';
      default:
        return 'bg-gradient-to-t from-gray-900/30 to-gray-500/70';
    }
  };
  
  return (
    <div className="h-full w-full bg-gray-900/50 rounded-md relative overflow-hidden">
      <motion.div
        initial={{ height: '0%' }}
        animate={{ height }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`absolute bottom-0 left-0 w-full ${getBarColor()}`}
      />
    </div>
  );
};
