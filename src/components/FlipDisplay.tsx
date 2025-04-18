import React, { useEffect, useState } from 'react';
import { FlipTile } from './FlipTile';

interface FlipDisplayProps {
  value: string;
  previousValue?: string;
  label?: string;
  className?: string;
  isPrice?: boolean;
}

export function FlipDisplay({ value, previousValue, label, className = '', isPrice = false }: FlipDisplayProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [prevDisplayValue, setPrevDisplayValue] = useState(previousValue || value);

  useEffect(() => {
    if (value !== displayValue) {
      setPrevDisplayValue(displayValue);
      setDisplayValue(value);
    }
  }, [value, displayValue]);

  // Format the value for display
  const formatValue = (val: string): string => {
    if (isPrice) {
      // Ensure consistent length for prices
      if (parseFloat(val) < 10) {
        return val.padStart(8, ' ');
      } else if (parseFloat(val) < 100) {
        return val.padStart(7, ' ');
      } else if (parseFloat(val) < 1000) {
        return val.padStart(6, ' ');
      } else if (parseFloat(val) < 10000) {
        return val.padStart(5, ' ');
      }
    }
    return val;
  };

  // Split the value into individual characters
  const characters = formatValue(displayValue).split('');
  const prevCharacters = formatValue(prevDisplayValue).split('');

  // Pad the arrays to the same length if needed
  while (prevCharacters.length < characters.length) {
    prevCharacters.push(' ');
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <div className="mb-1 text-sm text-gray-400 font-medium">{label}</div>
      )}
      <div className="flex flex-wrap">
        {characters.map((char, index) => {
          const prevChar = index < prevCharacters.length ? prevCharacters[index] : ' ';
          const isNumber = !isNaN(parseInt(char, 10));
          const isSymbol = ['$', '+', '-', '.', '/', '%'].includes(char);

          // Skip rendering for space characters
          if (char === ' ' && prevChar === ' ') {
            return <div key={index} className="w-5 mx-0.25" />;
          }

          // Check if this is a decimal point
          const isDecimal = char === '.';

          return (
            <FlipTile
              key={index}
              value={char}
              delay={index * 0.05} // Stagger the animations
              isNumber={isNumber || isSymbol}
              isDecimal={isDecimal}
            />
          );
        })}
      </div>
    </div>
  );
}
