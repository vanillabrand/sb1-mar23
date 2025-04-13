import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';
import { eventBus } from '../lib/event-bus';

interface AutoDeactivationNotificationProps {
  className?: string;
}

export const AutoDeactivationNotification: React.FC<AutoDeactivationNotificationProps> = ({ className }) => {
  const [notifications, setNotifications] = useState<{
    id: string;
    strategyId: string;
    reason: string;
    budget: number;
    timestamp: number;
  }[]>([]);

  useEffect(() => {
    const handleAutoDeactivation = (data: { strategyId: string; reason: string; budget: number }) => {
      setNotifications(prev => [
        ...prev,
        {
          id: `${data.strategyId}-${Date.now()}`,
          strategyId: data.strategyId,
          reason: data.reason,
          budget: data.budget,
          timestamp: Date.now()
        }
      ]);
    };

    // Subscribe to auto-deactivation events
    eventBus.subscribe('strategy:auto-deactivated', handleAutoDeactivation);

    return () => {
      // Unsubscribe when component unmounts
      eventBus.unsubscribe('strategy:auto-deactivated', handleAutoDeactivation);
    };
  }, []);

  // Remove notifications after 10 seconds
  useEffect(() => {
    if (notifications.length === 0) return;

    const timer = setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 10000);

    return () => clearTimeout(timer);
  }, [notifications]);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex flex-col gap-2 ${className}`}>
      <AnimatePresence>
        {notifications.map(notification => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-red-900/80 border border-red-500/30 rounded-lg p-4 shadow-lg max-w-md"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-red-300 font-medium">Strategy Automatically Deactivated</h4>
                <p className="text-gray-300 text-sm mt-1">
                  A strategy was deactivated because the remaining budget was too low (${notification.budget.toFixed(2)}).
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  Add more funds to the strategy and reactivate it to continue trading.
                </p>
              </div>
              <button
                onClick={() => dismissNotification(notification.id)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
