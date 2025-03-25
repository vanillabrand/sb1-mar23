import React from 'react';

interface StrategyParameterEditorProps {
  parameter: {
    name: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    color?: string;
  };
  onChange: (value: number) => void;
  isEditing: boolean;
}

const colorMap = {
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
    label: 'text-indigo-700',
    slider: '#4f46e5',
    track: '#e0e7ff'
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    label: 'text-red-700',
    slider: '#dc2626',
    track: '#fee2e2'
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    label: 'text-green-700',
    slider: '#16a34a',
    track: '#dcfce7'
  },
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    label: 'text-blue-700',
    slider: '#2563eb',
    track: '#dbeafe'
  },
  orange: {
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    label: 'text-orange-700',
    slider: '#ea580c',
    track: '#ffedd5'
  }
};

export function StrategyParameterEditor({ parameter, onChange, isEditing }: StrategyParameterEditorProps) {
  const { name, value, min, max, step, unit, color = 'indigo' } = parameter;
  const colors = colorMap[color as keyof typeof colorMap];

  return (
    <div className="relative">
      {isEditing ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-gray-700">{name}</label>
            <span className={`text-sm font-semibold ${colors.text}`}>
              {value}{unit}
            </span>
          </div>
          <div className="relative pt-1">
            <style>
              {`
                .slider-${color} {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 100%;
                  height: 8px;
                  border-radius: 4px;
                  background: ${colors.track};
                  outline: none;
                  cursor: pointer;
                  transition: all 0.2s ease;
                }

                .slider-${color}::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 16px;
                  height: 16px;
                  background-color: ${colors.slider};
                  border: 2px solid white;
                  border-radius: 50%;
                  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                  transition: all 0.2s ease;
                }

                .slider-${color}::-moz-range-thumb {
                  width: 16px;
                  height: 16px;
                  background-color: ${colors.slider};
                  border: 2px solid white;
                  border-radius: 50%;
                  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                  transition: all 0.2s ease;
                }

                .slider-${color}::-webkit-slider-thumb:hover,
                .slider-${color}::-moz-range-thumb:hover {
                  transform: scale(1.1);
                }

                .slider-${color}:focus::-webkit-slider-thumb {
                  box-shadow: 0 0 0 2px ${colors.track};
                }

                .slider-${color}:focus::-moz-range-thumb {
                  box-shadow: 0 0 0 2px ${colors.track};
                }
              `}
            </style>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              className={`slider-${color}`}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{min}{unit}</span>
              <span>{max}{unit}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className={`p-4 ${colors.bg} rounded-lg`}>
          <p className={`text-sm ${colors.label}`}>{name}</p>
          <p className={`text-lg font-semibold ${colors.text}`}>
            {value}{unit}
          </p>
        </div>
      )}
    </div>
  );
}