import React from 'react';
import { Gauge } from 'lucide-react';

interface LeverageDialProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function LeverageDial({ value, onChange, min = 1, max = 100 }: LeverageDialProps) {
  // Get color based on leverage value
  const getLeverageColor = (leverage: number): string => {
    if (leverage <= 20) return 'text-neon-turquoise';
    if (leverage <= 50) return 'text-neon-yellow';
    if (leverage <= 75) return 'text-neon-orange';
    return 'text-neon-pink';
  };

  const leverageColor = getLeverageColor(value);
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="w-full space-y-4">
      {/* Value Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg bg-gunmetal-800/50 ${leverageColor}`}>
            <Gauge className="w-5 h-5" />
          </div>
          <span className="text-sm text-gray-400">Leverage</span>
        </div>
        <span className={`text-2xl font-bold ${leverageColor}`}>
          {value}x
        </span>
      </div>

      {/* Custom Slider */}
      <div className="relative pt-2">
        {/* Track Background */}
        <div className="w-full h-2 bg-gunmetal-800 rounded-full" />

        {/* Active Track */}
        <div 
          className={`absolute left-0 top-2 h-2 rounded-full transition-all duration-200 ${leverageColor}`}
          style={{ width: `${percentage}%` }}
        />

        {/* Thumb */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute top-0 w-full h-6 opacity-0 cursor-pointer"
        />
        <div 
          className={`absolute top-1 h-4 w-4 rounded-full bg-white border-2 transition-all duration-200 -translate-y-1/2 ${leverageColor}`}
          style={{ left: `${percentage}%`, transform: `translateX(-50%) translateY(-50%)` }}
        />
      </div>

      {/* Tick Marks */}
      <div className="flex justify-between px-1 text-xs text-gray-500">
        <span>{min}x</span>
        <span>{Math.round((max - min) / 2 + min)}x</span>
        <span>{max}x</span>
      </div>
    </div>
  );
}