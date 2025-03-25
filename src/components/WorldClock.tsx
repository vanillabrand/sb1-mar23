import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface WorldClockProps {
  timezone?: string;
}

export function WorldClock({ timezone = 'UTC' }: WorldClockProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate clock hand angles
  const hours = time.getHours() + (time.getMinutes() / 60);
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const hourDegrees = (hours % 12) * 30 + minutes / 2;
  const minuteDegrees = minutes * 6;
  const secondDegrees = seconds * 6;

  return (
    <div className="flex items-center justify-center">
      {/* Clock Face */}
      <div className="relative w-24 h-24 rounded-full bg-gunmetal-800/50 shadow-[0_0_30px_rgba(45,212,191,0.15)]">
        {/* Hour markers */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-2 bg-gray-600"
            style={{
              transform: `rotate(${i * 30}deg) translateY(8px)`,
              transformOrigin: 'bottom center',
              left: 'calc(50% - 2px)',
              top: '0'
            }}
          />
        ))}

        {/* Clock Hands */}
        <motion.div
          className="absolute w-0.5 h-[36px] bg-gray-400 rounded-full"
          style={{
            left: 'calc(50% - 0.5px)',
            bottom: '50%',
            transformOrigin: 'bottom',
            transform: `rotate(${hourDegrees}deg)`
          }}
        />
        <motion.div
          className="absolute w-0.5 h-[48px] bg-gray-300 rounded-full"
          style={{
            left: 'calc(50% - 0.5px)',
            bottom: '50%',
            transformOrigin: 'bottom',
            transform: `rotate(${minuteDegrees}deg)`
          }}
        />
        <motion.div
          className="absolute w-[1px] h-[56px] bg-neon-yellow rounded-full"
          style={{
            left: 'calc(50% - 0.5px)',
            bottom: '50%',
            transformOrigin: 'bottom',
            transform: `rotate(${secondDegrees}deg)`,
            transition: 'transform 0.1s linear'
          }}
        />

        {/* Center Pin */}
        <div className="absolute top-1/2 left-1/2 w-3 h-3 rounded-full bg-neon-turquoise transform -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(45,212,191,0.5)]" />
      </div>

      {/* Digital Time */}
      <div className="ml-6">
        <div className="text-2xl font-mono font-bold text-neon-turquoise">
          {time.toLocaleTimeString('en-US', { 
            timeZone: timezone,
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
}