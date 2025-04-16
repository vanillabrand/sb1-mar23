import React, { useState, useEffect } from 'react';
import { RiskLevel } from '../lib/types';

interface RiskLevelSliderProps {
  value: RiskLevel;
  onChange: (value: RiskLevel) => void;
  disabled?: boolean;
}

export const RiskLevelSlider: React.FC<RiskLevelSliderProps> = ({ 
  value, 
  onChange,
  disabled = false
}) => {
  const riskLevels: RiskLevel[] = [
    'Ultra Low', 
    'Low', 
    'Medium', 
    'High', 
    'Ultra High', 
    'Extreme', 
    'God Mode'
  ];
  
  const [currentIndex, setCurrentIndex] = useState(riskLevels.indexOf(value));
  
  useEffect(() => {
    setCurrentIndex(riskLevels.indexOf(value));
  }, [value]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value);
    setCurrentIndex(newIndex);
    onChange(riskLevels[newIndex]);
  };
  
  const getTrackBackground = () => {
    const percentage = (currentIndex / (riskLevels.length - 1)) * 100;
    return `linear-gradient(to right, #10b981 0%, #10b981 ${percentage * 0.2}%, #eab308 ${percentage * 0.2}%, #eab308 ${percentage * 0.5}%, #ef4444 ${percentage * 0.5}%, #ef4444 100%)`;
  };
  
  const getThumbColor = () => {
    if (currentIndex <= 1) return 'bg-green-500';
    if (currentIndex <= 3) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  return (
    <div className="w-full">
      <div className="flex justify-between mb-1 text-xs text-gray-400">
        <span>Low Risk</span>
        <span>High Risk</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min="0"
          max={riskLevels.length - 1}
          value={currentIndex}
          onChange={handleChange}
          disabled={disabled}
          className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{
            background: getTrackBackground(),
          }}
        />
        <div 
          className={`absolute pointer-events-none ${getThumbColor()} w-4 h-4 rounded-full shadow-md transform -translate-x-1/2 -translate-y-1/2`}
          style={{
            top: '50%',
            left: `${(currentIndex / (riskLevels.length - 1)) * 100}%`,
          }}
        />
      </div>
      <div className="mt-2 text-center text-sm font-medium text-white">
        {riskLevels[currentIndex]}
      </div>
    </div>
  );
};
