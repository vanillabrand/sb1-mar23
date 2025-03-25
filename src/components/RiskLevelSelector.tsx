import React from 'react';
import { Slider } from './ui/Slider';
import { RISK_LEVELS, type RiskLevel } from '../lib/types';
import {
  Shield,
  Scale,
  Flame,
  Swords,
  Zap,
  Crown,
  Turtle
} from 'lucide-react';

interface RiskLevelSelectorProps {
  value: RiskLevel;
  onChange: (level: RiskLevel) => void;
}

const icons = {
  'turtle': Turtle,
  'shield': Shield,
  'scale': Scale,
  'flame': Flame,
  'swords': Swords,
  'zap': Zap,
  'crown': Crown
};

export function RiskLevelSelector({ value, onChange }: RiskLevelSelectorProps) {
  const currentIndex = RISK_LEVELS.findIndex(level => level.name === value);
  
  const handleSliderChange = (newValue: number) => {
    onChange(RISK_LEVELS[newValue].name);
  };

  const currentLevel = RISK_LEVELS[currentIndex];
  const Icon = icons[currentLevel.icon as keyof typeof icons];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Icon className={`w-6 h-6 text-${currentLevel.color}-500`} />
        <div>
          <h3 className="font-semibold text-gray-900">{currentLevel.name}</h3>
          <p className="text-sm text-gray-500">{currentLevel.description}</p>
        </div>
      </div>

      <div className="relative pt-1">
        <div className="flex justify-between mb-2">
          {RISK_LEVELS.map((level, index) => {
            const IconComponent = icons[level.icon as keyof typeof icons];
            return (
              <button
                key={level.name}
                onClick={() => handleSliderChange(index)}
                className={`flex flex-col items-center transition-all ${
                  currentIndex === index 
                    ? `text-${level.color}-500 scale-110` 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <IconComponent className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        <div className="relative">
          <div className="h-2 bg-gradient-to-r from-emerald-500 via-blue-500 to-yellow-500 rounded-full" />
          <input
            type="range"
            min="0"
            max={RISK_LEVELS.length - 1}
            value={currentIndex}
            onChange={(e) => handleSliderChange(parseInt(e.target.value))}
            className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
          />
          <div 
            className="absolute top-0 w-4 h-4 -mt-1 bg-white rounded-full shadow-lg border-2 transition-all"
            style={{ 
              left: `${(currentIndex / (RISK_LEVELS.length - 1)) * 100}%`,
              borderColor: `var(--tw-colors-${currentLevel.color}-500)`
            }}
          />
        </div>

        <div className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-500">Leverage</p>
              <p className="text-lg font-semibold">{currentLevel.leverageMultiplier}x</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-500">Position Size</p>
              <p className="text-lg font-semibold">{currentLevel.positionSizeMultiplier * 100}%</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-500">Stop Loss</p>
              <p className="text-lg font-semibold">{currentLevel.stopLossMultiplier * 100}%</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-500">Take Profit</p>
              <p className="text-lg font-semibold">{currentLevel.takeProfitMultiplier * 100}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}