import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FlipTileProps {
  value: string;
  color?: string;
  delay?: number;
  isNumber?: boolean;
  isDecimal?: boolean;
}

// Dark metal panel colors
const TILE_COLORS = {
  background: '#1a1d21', // Dark metal background
  text: '#ffffff',      // White text
  shadow: 'rgba(0, 0, 0, 0.8)',
  highlight: 'rgba(255, 255, 255, 0.05)',
  border: '#111111',
  // Status colors
  up: '#00ffd1',    // Neon turquoise
  down: '#ff3864',  // Raspberry pink
  neutral: '#333333' // Dark grey
};

export function FlipTile({ value, color, delay = 0, isNumber = false, isDecimal = false }: FlipTileProps) {
  const [currentValue, setCurrentValue] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  const [isFlipping, setIsFlipping] = useState(false);

  // Always use the black background for authentic Vestaboard look
  const getBackgroundColor = () => {
    if (color) return color;
    return TILE_COLORS.background;
  };

  useEffect(() => {
    // Only animate if the value has changed
    if (value !== currentValue) {
      setPreviousValue(currentValue);
      setIsFlipping(true);

      // Set a timeout to update the current value after half the animation
      const timeout = setTimeout(() => {
        setCurrentValue(value);
      }, 150); // Half of the total animation duration

      return () => clearTimeout(timeout);
    }
  }, [value, currentValue]);

  // Reset the flipping state after animation completes
  useEffect(() => {
    if (isFlipping) {
      const timeout = setTimeout(() => {
        setIsFlipping(false);
      }, 300); // Total animation duration

      return () => clearTimeout(timeout);
    }
  }, [isFlipping]);

  return (
    <div
      className={`relative ${isDecimal ? 'w-4' : 'w-7'} h-10 mx-0.25 overflow-hidden rounded-sm`}
      style={{
        perspective: '1000px',
        backgroundColor: TILE_COLORS.background,
        boxShadow: `
          inset 0 1px 1px ${TILE_COLORS.highlight},
          inset 0 -1px 1px ${TILE_COLORS.shadow},
          0 2px 5px ${TILE_COLORS.shadow}
        `,
        border: `1px solid ${TILE_COLORS.border}`
      }}
    >
      {/* Top half (static) */}
      <div
        className="absolute top-0 left-0 w-full h-1/2 flex items-center justify-center overflow-hidden"
        style={{
          borderBottom: '1px solid rgba(0, 0, 0, 0.5)',
          borderTopLeftRadius: '4px',
          borderTopRightRadius: '4px',
          backgroundColor: getBackgroundColor(),
          zIndex: isFlipping ? 1 : 2
        }}
      >
        <span
          className="text-sm font-normal font-mono"
          style={{
            color: TILE_COLORS.text,
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
          }}
        >
          {isFlipping ? previousValue : currentValue}
        </span>
      </div>

      {/* Bottom half (static) */}
      <div
        className="absolute bottom-0 left-0 w-full h-1/2 flex items-center justify-center overflow-hidden"
        style={{
          borderTop: '1px solid rgba(0, 0, 0, 0.5)',
          borderBottomLeftRadius: '4px',
          borderBottomRightRadius: '4px',
          backgroundColor: getBackgroundColor(),
          zIndex: isFlipping ? 1 : 2
        }}
      >
        <span
          className="text-sm font-normal font-mono"
          style={{
            color: TILE_COLORS.text,
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
          }}
        >
          {currentValue}
        </span>
      </div>

      {/* Flipping animation */}
      <AnimatePresence>
        {isFlipping && (
          <>
            {/* Top flap (flips down) */}
            <motion.div
              initial={{ rotateX: 0 }}
              animate={{ rotateX: 90 }}
              exit={{ rotateX: 90 }}
              transition={{
                duration: 0.3,
                delay: delay,
                ease: [0.3, 0.6, 0.3, 1] // Custom easing for realistic flip
              }}
              className="absolute top-0 left-0 w-full h-1/2 flex items-center justify-center overflow-hidden origin-bottom"
              style={{
                backfaceVisibility: 'hidden',
                backgroundColor: getBackgroundColor(),
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
                boxShadow: '0 1px 5px rgba(0, 0, 0, 0.5)',
                zIndex: 3
              }}
            >
              <span
                className="text-sm font-normal font-mono"
                style={{
                  color: TILE_COLORS.text,
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
                }}
              >
                {previousValue}
              </span>
            </motion.div>

            {/* Bottom flap (flips up) */}
            <motion.div
              initial={{ rotateX: -90 }}
              animate={{ rotateX: 0 }}
              exit={{ rotateX: 0 }}
              transition={{
                duration: 0.3,
                delay: delay + 0.15, // Slight delay after top flap
                ease: [0.3, 0.6, 0.3, 1] // Custom easing for realistic flip
              }}
              className="absolute top-1/2 left-0 w-full h-1/2 flex items-center justify-center overflow-hidden origin-top"
              style={{
                backfaceVisibility: 'hidden',
                backgroundColor: getBackgroundColor(),
                borderBottomLeftRadius: '4px',
                borderBottomRightRadius: '4px',
                boxShadow: '0 -1px 5px rgba(0, 0, 0, 0.5)',
                zIndex: 3
              }}
            >
              <span
                className="text-sm font-normal font-mono"
                style={{
                  color: TILE_COLORS.text,
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
                }}
              >
                {currentValue}
              </span>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Reflective highlight */}
      <div
        className="absolute top-0 left-0 w-full h-1/5 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0))',
          zIndex: 10
        }}
      />

      {/* Bottom shadow */}
      <div
        className="absolute bottom-0 left-0 w-full h-1/5 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0))',
          zIndex: 10
        }}
      />
    </div>
  );
}
