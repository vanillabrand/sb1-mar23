import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Wifi, WifiOff, AlertCircle, RefreshCw, Clock, BarChart2 } from 'lucide-react';
import { websocketPerformanceMonitor } from '../lib/websocket-performance-monitor';
import { eventBus } from '../lib/event-bus';
import { websocketManager } from '../lib/websocket-manager';

interface PerformanceReport {
  connectionId: string;
  averageLatency: number;
  maxLatency: number;
  messagesPerSecond: number;
  bytesPerSecond: number;
  errorRate: number;
  reconnectRate: number;
  uptime: number;
  connectionStability: number;
}

export function WebSocketPerformanceMonitor() {
  const [reports, setReports] = useState<PerformanceReport[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeConnections, setActiveConnections] = useState<string[]>([]);

  useEffect(() => {
    // Listen for performance reports
    const handlePerformanceReports = (data: any) => {
      setReports(data.reports);
    };

    eventBus.on('websocket:performance:reports', handlePerformanceReports);

    // Listen for WebSocket connections
    const handleConnected = (data: any) => {
      setActiveConnections(prev => [...prev, data.connectionId]);
    };

    const handleDisconnected = (data: any) => {
      setActiveConnections(prev => prev.filter(id => id !== data.connectionId));
    };

    eventBus.on('websocket:connected', handleConnected);
    eventBus.on('websocket:disconnected', handleDisconnected);

    // Initialize active connections
    setActiveConnections(websocketManager.getConnections());

    return () => {
      eventBus.off('websocket:performance:reports', handlePerformanceReports);
      eventBus.off('websocket:connected', handleConnected);
      eventBus.off('websocket:disconnected', handleDisconnected);
    };
  }, []);

  const toggleMonitoring = () => {
    if (isMonitoring) {
      websocketPerformanceMonitor.stopMonitoring();
      setIsMonitoring(false);
    } else {
      websocketPerformanceMonitor.startMonitoring();
      setIsMonitoring(true);
    }
  };

  const getStabilityColor = (stability: number) => {
    if (stability >= 0.8) return 'text-green-500';
    if (stability >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-green-500';
    if (latency < 300) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="panel-metallic rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-neon-turquoise" />
          <h2 className="text-lg font-semibold text-white">WebSocket Performance</h2>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={toggleMonitoring}
            className={`px-3 py-1 rounded-lg text-sm flex items-center gap-1 ${
              isMonitoring ? 'bg-neon-raspberry text-white' : 'bg-neon-turquoise text-gunmetal-900'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isMonitoring ? (
              <>
                <WifiOff className="w-4 h-4" />
                Stop Monitoring
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                Start Monitoring
              </>
            )}
          </motion.button>
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg bg-gunmetal-800 text-gray-300 hover:bg-gunmetal-700"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            )}
          </motion.button>
        </div>
      </div>

      {/* Active Connections */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Wifi className="w-4 h-4 text-neon-turquoise" />
          <h3 className="text-sm font-medium text-gray-300">Active Connections</h3>
        </div>
        <div className="bg-gunmetal-900 rounded-lg p-3">
          {activeConnections.length === 0 ? (
            <div className="text-gray-400 text-sm flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              No active WebSocket connections
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {activeConnections.map(connectionId => (
                <div key={connectionId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm text-gray-300">{connectionId}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {websocketManager.isConnected(connectionId) ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Performance Reports */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart2 className="w-4 h-4 text-neon-turquoise" />
              <h3 className="text-sm font-medium text-gray-300">Performance Metrics</h3>
            </div>
            {reports.length === 0 ? (
              <div className="bg-gunmetal-900 rounded-lg p-4 text-center">
                <div className="text-gray-400 text-sm mb-2">No performance data available</div>
                {isMonitoring ? (
                  <div className="text-xs text-gray-500">Monitoring is active. Data will appear soon.</div>
                ) : (
                  <button
                    onClick={toggleMonitoring}
                    className="px-3 py-1 bg-neon-turquoise text-gunmetal-900 rounded-lg text-sm"
                  >
                    Start Monitoring
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {reports.map(report => (
                  <div key={report.connectionId} className="bg-gunmetal-900 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{report.connectionId}</span>
                      <div className={`px-2 py-0.5 rounded-full text-xs ${getStabilityColor(report.connectionStability)}`}>
                        Stability: {Math.round(report.connectionStability * 100)}%
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-400">Latency:</span>
                        <span className={getLatencyColor(report.averageLatency)}>
                          {Math.round(report.averageLatency)}ms
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-400">Messages/s:</span>
                        <span className="text-neon-turquoise">
                          {report.messagesPerSecond.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-400">Error Rate:</span>
                        <span className={report.errorRate > 0.01 ? 'text-red-500' : 'text-green-500'}>
                          {(report.errorRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-400">Reconnects/hr:</span>
                        <span className={report.reconnectRate > 1 ? 'text-yellow-500' : 'text-green-500'}>
                          {report.reconnectRate.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
