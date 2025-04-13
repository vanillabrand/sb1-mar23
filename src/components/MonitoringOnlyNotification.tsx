import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { eventBus } from '../lib/event-bus';
import { Strategy } from '../lib/types';
import { supabase } from '../lib/supabase';

export function MonitoringOnlyNotification() {
  const [notifications, setNotifications] = useState<{
    strategyId: string;
    reason: string;
    budget: number;
    strategyTitle?: string;
    timestamp: number;
  }[]>([]);

  useEffect(() => {
    // Listen for monitoring-only events
    const handleMonitoringOnly = (data: { strategyId: string; reason: string; budget: number }) => {
      // Fetch the strategy title
      supabase
        .from('strategies')
        .select('title')
        .eq('id', data.strategyId)
        .single()
        .then(({ data: strategy }) => {
          setNotifications(prev => [
            {
              ...data,
              strategyTitle: strategy?.title || 'Unknown Strategy',
              timestamp: Date.now()
            },
            ...prev
          ].slice(0, 5)); // Keep only the 5 most recent notifications
        });
    };

    // Subscribe to the event
    eventBus.subscribe('strategy:monitoring-only', handleMonitoringOnly);

    // Clean up
    return () => {
      eventBus.unsubscribe('strategy:monitoring-only', handleMonitoringOnly);
    };
  }, []);

  // Remove a notification
  const removeNotification = (timestamp: number) => {
    setNotifications(prev => prev.filter(n => n.timestamp !== timestamp));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {notifications.map((notification) => (
        <div
          key={notification.timestamp}
          className="bg-gunmetal-900 border border-neon-pink/30 rounded-lg p-4 shadow-lg flex items-start gap-3 animate-slideIn"
        >
          <div className="bg-neon-pink/20 p-2 rounded-full">
            <AlertCircle className="w-5 h-5 text-neon-pink" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h4 className="font-medium text-white">Strategy in Monitoring-Only Mode</h4>
              <button
                onClick={() => removeNotification(notification.timestamp)}
                className="text-gray-400 hover:text-white"
              >
                &times;
              </button>
            </div>
            <p className="text-sm text-gray-300 mt-1">
              <span className="font-bold text-neon-pink">{notification.strategyTitle}</span> has been set to monitoring-only mode due to low budget (${notification.budget.toFixed(2)}).
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Existing trades will continue to be monitored, but no new trades will be generated until you add more funds.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
