import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface WorldClockProps {
  timezone: string;
}

export function WorldClock({ timezone }: WorldClockProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formattedTime = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(time);

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(time);

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="text-4xl font-mono text-neon-turquoise">
        {formattedTime}
      </div>
      <div className="text-sm text-gray-400">
        {formattedDate}
      </div>
    </div>
  );
}
