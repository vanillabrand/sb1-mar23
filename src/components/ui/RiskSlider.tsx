import React from 'react';
import { motion } from 'framer-motion';
import { Scale, Shield, Target, Gauge, Zap, AlertTriangle, Crown } from 'lucide-react';
import type { RiskLevel } from '../../lib/types';

interface RiskSliderProps {
  value: RiskLevel;
  onChange: (value: RiskLevel) => void;
  className?: string;
}

const RISK_LEVELS: { name: RiskLevel; icon: any; color: string; description: string }[] = [
  {
    name: 'Ultra Low',
    icon: Scale,
    color: 'emerald-400',
    description: 'Conservative approach with minimal risk'
  },
  {
    name: 'Low',
    icon: Shield,
    color: 'neon-turquoise',
    description: 'Balanced approach with controlled risk'
  },
  {
    name: 'Medium',
    icon: Target,
    color: 'neon-yellow',
    description: 'Moderate risk with balanced returns'
  },
  {
    name: 'High',
    icon: Gauge,
    color: 'neon-orange',
    description: 'Aggressive approach with higher risk'
  },
  {
    name: 'Ultra High',
    icon: Zap,
    color: 'neon-pink',
    description: 'Very aggressive with substantial risk'
  },
  {
    name: 'Extreme',
    icon: AlertTriangle,
    color: 'purple-400',
    description: 'Maximum risk for maximum returns'
  },
  {
    name: 'God Mode',
    icon: Crown,
    color: 'amber-400',
    description: 'Ultimate risk level for experts only'
  }
];

export function RiskSlider({ value, onChange, className = '' }: RiskSliderProps) {
  const currentIndex = RISK_LEVELS.findIndex(level => level.name === value);
  const currentLevel = RISK_LEVELS[currentIndex];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    onChange(RISK_LEVELS[index].name);
  };

  return (
    <div className={className}>
      {/* Current Risk Level Display */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-3 rounded-lg bg-${currentLevel.color}/10`}>
          {React.createElement(currentLevel.icon, {
            className: `w-6 h-6 text-${currentLevel.color}`
          })}
        </div>
        <div>
          <h3 className={`text-lg font-semibold text-${currentLevel.color}`}>
            {currentLevel.name}
          </h3>
          <p className="text-sm text-gray-400">{currentLevel.description}</p>
        </div>
      </div>

      {/* Slider Track */}
      <div className="relative pt-2">
        <div className="h-2 bg-gradient-to-r from-emerald-400 via-neon-yellow to-amber-400 rounded-full" />

        {/* Tick Marks */}
        {RISK_LEVELS.map((_, i) => (
          <div
            key={i}
            className="absolute top-0 w-0.5 h-4 bg-gunmetal-700"
            style={{ left: `${(i / (RISK_LEVELS.length - 1)) * 100}%` }}
          />
        ))}

        {/* Slider Input */}
        <input
          type="range"
          min={0}
          max={RISK_LEVELS.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          className="absolute top-0 w-full h-6 opacity-0 cursor-pointer"
        />

        {/* Slider Thumb */}
        <motion.div
          className={`absolute top-1 w-4 h-4 rounded-full bg-white border-2 -translate-y-1/2 -translate-x-1/2 shadow-lg`}
          style={{
            left: `${(currentIndex / (RISK_LEVELS.length - 1)) * 100}%`,
            borderColor: `var(--tw-colors-${currentLevel.color})`
          }}
          animate={{
            scale: [1, 1.1, 1],
            transition: { duration: 0.2 }
          }}
        />
      </div>

      {/* Risk Level Labels */}
      <div className="flex justify-between mt-6">
        {RISK_LEVELS.map((level, i) => (
          <button
            key={i}
            onClick={() => onChange(level.name)}
            className={`text-xs transform -rotate-45 ${
              value === level.name
                ? `text-${level.color} font-medium`
                : 'text-gray-500 hover:text-gray-400'
            }`}
          >
            {level.name}
          </button>
        ))}
      </div>

      {/* Risk Parameters */}
      <div className="grid grid-cols-2 gap-4 mt-8">
        <div className="bg-gunmetal-900/30 p-3 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Max Leverage</p>
          <p className="text-lg font-medium text-neon-yellow">
            {currentIndex <= 2 ? '1x' : 
             currentIndex === 3 ? '3x' :
             currentIndex === 4 ? '5x' :
             currentIndex === 5 ? '10x' : '20x'}
          </p>
        </div>
        <div className="bg-gunmetal-900/30 p-3 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Position Size</p>
          <p className="text-lg font-medium text-neon-orange">
            {currentIndex === 0 ? '5%' :
             currentIndex === 1 ? '10%' :
             currentIndex === 2 ? '15%' :
             currentIndex === 3 ? '20%' :
             currentIndex === 4 ? '25%' :
             currentIndex === 5 ? '30%' : '50%'}
          </p>
        </div>
      </div>
    </div>
  );
}