import React, { useState, useEffect } from 'react';
import { logService } from '../lib/log-service';
import { eventBus } from '../lib/event-bus';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  component: string;
  data?: any;
}

export const TradeDebugMonitor: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Subscribe to trade events
    const handleTradeCreated = (data: any) => {
      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Trade created: ${data.trade?.symbol || 'Unknown'}`,
        component: 'TradeDebugMonitor',
        data
      });
    };

    const handleTradeUpdated = (data: any) => {
      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Trade updated: ${data.trade?.symbol || 'Unknown'} - Status: ${data.trade?.status || 'Unknown'}`,
        component: 'TradeDebugMonitor',
        data
      });
    };

    const handleTradeError = (data: any) => {
      addLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Trade error: ${data.error?.message || 'Unknown error'}`,
        component: 'TradeDebugMonitor',
        data
      });
    };

    // Subscribe to events
    eventBus.subscribe('trade:created', handleTradeCreated);
    eventBus.subscribe('trade:updated', handleTradeUpdated);
    eventBus.subscribe('trade:error', handleTradeError);

    // Override logService.log to capture logs
    const originalLog = logService.log;
    logService.log = (level, message, error, component) => {
      // Only capture trade-related logs
      if (
        component?.includes('Trade') ||
        component?.includes('trade') ||
        message.includes('trade') ||
        message.includes('Trade')
      ) {
        addLog({
          timestamp: new Date().toISOString(),
          level,
          message,
          component: component || 'Unknown',
          data: error
        });
      }

      // Call the original log function
      return originalLog(level, message, error, component);
    };

    return () => {
      // Unsubscribe from events
      eventBus.unsubscribe('trade:created', handleTradeCreated);
      eventBus.unsubscribe('trade:updated', handleTradeUpdated);
      eventBus.unsubscribe('trade:error', handleTradeError);

      // Restore original log function
      logService.log = originalLog;
    };
  }, []);

  const addLog = (log: LogEntry) => {
    setLogs(prevLogs => {
      const newLogs = [...prevLogs, log];
      // Keep only the last 100 logs
      return newLogs.slice(-100);
    });
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  if (!isVisible) {
    return (
      <button
        onClick={toggleVisibility}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-md z-50"
      >
        Show Trade Monitor
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 w-full md:w-1/2 lg:w-1/3 h-1/3 bg-gray-900 text-white p-4 overflow-auto z-50 border-t border-l border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">Trade Debug Monitor</h3>
        <div>
          <button
            onClick={clearLogs}
            className="bg-red-600 text-white px-2 py-1 rounded-md mr-2 text-sm"
          >
            Clear
          </button>
          <button
            onClick={toggleVisibility}
            className="bg-gray-700 text-white px-2 py-1 rounded-md text-sm"
          >
            Hide
          </button>
        </div>
      </div>

      <div className="overflow-y-auto h-[calc(100%-2rem)]">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center mt-4">No trade logs yet</div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={`mb-1 p-1 text-xs font-mono border-l-2 ${
                log.level === 'error' ? 'border-red-500 bg-red-900/20' :
                log.level === 'warn' ? 'border-yellow-500 bg-yellow-900/20' :
                'border-blue-500 bg-blue-900/20'
              }`}
            >
              <div className="flex justify-between">
                <span className="text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className="text-gray-400">{log.component}</span>
              </div>
              <div>{log.message}</div>
              {log.data && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-gray-400">Details</summary>
                  <pre className="text-xs overflow-x-auto mt-1 p-1 bg-gray-800 rounded">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
