import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface ClockData {
  timezone: string;
  name: string;
  time: string;
  date: string;
}

export function MultiWorldClock() {
  const [time, setTime] = useState(new Date());
  
  const TIMEZONES = [
    { id: 'UTC', name: 'UTC' },
    { id: 'America/New_York', name: 'New York' },
    { id: 'America/Los_Angeles', name: 'Los Angeles' },
    { id: 'Europe/London', name: 'London' },
    { id: 'Asia/Tokyo', name: 'Tokyo' },
    { id: 'Asia/Shanghai', name: 'Shanghai' },
    { id: 'Asia/Singapore', name: 'Singapore' },
    { id: 'Australia/Sydney', name: 'Sydney' },
    { id: 'Europe/Frankfurt', name: 'Frankfurt' },
    { id: 'Asia/Dubai', name: 'Dubai' }
  ];

  const [clocks, setClocks] = useState<ClockData[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Update all clocks when time changes
    const updatedClocks = TIMEZONES.map(tz => ({
      timezone: tz.id,
      name: tz.name,
      time: new Intl.DateTimeFormat('en-US', {
        timeZone: tz.id,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(time),
      date: new Intl.DateTimeFormat('en-US', {
        timeZone: tz.id,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(time)
    }));
    
    setClocks(updatedClocks);
  }, [time]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-neon-turquoise" />
        <h2 className="text-lg font-semibold gradient-text">World Clocks</h2>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {clocks.map((clock) => (
          <div 
            key={clock.timezone} 
            className="bg-gunmetal-800/50 rounded-lg p-3 flex flex-col items-center"
          >
            <div className="text-sm font-medium text-gray-300 mb-1">{clock.name}</div>
            <div className="text-xl font-mono text-neon-turquoise">{clock.time}</div>
            <div className="text-xs text-gray-500 mt-1">{clock.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
