import React, { useState, useEffect } from 'react';
import CacheStats from './CacheStats';
import WebSocketStatus from './WebSocketStatus';
import CircuitBreakerStatus from './CircuitBreakerStatus';
import RetryQueue from './RetryQueue';

interface PerformanceMetrics {
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  timing: {
    navigationStart: number;
    loadEventEnd: number;
    domComplete: number;
    responseEnd: number;
  };
  fps: number;
  networkRequests: {
    total: number;
    pending: number;
    success: number;
    failed: number;
  };
}

const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    memory: {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0
    },
    timing: {
      navigationStart: 0,
      loadEventEnd: 0,
      domComplete: 0,
      responseEnd: 0
    },
    fps: 0,
    networkRequests: {
      total: 0,
      pending: 0,
      success: 0,
      failed: 0
    }
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [fpsHistory, setFpsHistory] = useState<number[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Initial metrics collection
    collectMetrics();

    // Set up refresh interval
    const interval = window.setInterval(() => {
      collectMetrics();
    }, 2000); // Refresh every 2 seconds

    setRefreshInterval(interval);

    // Set up FPS counter
    let frameCount = 0;
    let lastTime = performance.now();
    
    const countFrames = () => {
      frameCount++;
      const now = performance.now();
      
      if (now - lastTime >= 1000) {
        const fps = Math.round(frameCount * 1000 / (now - lastTime));
        setFpsHistory(prev => [...prev.slice(-29), fps]);
        setMetrics(prev => ({
          ...prev,
          fps
        }));
        frameCount = 0;
        lastTime = now;
      }
      
      requestAnimationFrame(countFrames);
    };
    
    const frameId = requestAnimationFrame(countFrames);

    // Clean up
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      cancelAnimationFrame(frameId);
    };
  }, []);

  const collectMetrics = () => {
    // Collect memory metrics if available
    const memory = (performance as any).memory;
    if (memory) {
      setMetrics(prev => ({
        ...prev,
        memory: {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        }
      }));
      
      // Update memory history
      setMemoryHistory(prev => [...prev.slice(-29), memory.usedJSHeapSize / 1024 / 1024]);
    }

    // Collect timing metrics
    const timing = performance.timing;
    if (timing) {
      setMetrics(prev => ({
        ...prev,
        timing: {
          navigationStart: timing.navigationStart,
          loadEventEnd: timing.loadEventEnd,
          domComplete: timing.domComplete,
          responseEnd: timing.responseEnd
        }
      }));
    }

    // Collect network request metrics
    const entries = performance.getEntriesByType('resource');
    const networkRequests = {
      total: entries.length,
      pending: 0,
      success: 0,
      failed: 0
    };

    // Count pending/success/failed requests (this is an approximation)
    entries.forEach((entry: any) => {
      if (entry.responseStatus) {
        if (entry.responseStatus >= 200 && entry.responseStatus < 300) {
          networkRequests.success++;
        } else {
          networkRequests.failed++;
        }
      } else if (entry.duration === 0) {
        networkRequests.pending++;
      } else {
        networkRequests.success++;
      }
    });

    setMetrics(prev => ({
      ...prev,
      networkRequests
    }));
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (time: number): string => {
    return `${time.toFixed(2)}ms`;
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-3">Memory Usage</h3>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Used Heap</span>
              <span>{formatBytes(metrics.memory.usedJSHeapSize)}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${(metrics.memory.usedJSHeapSize / metrics.memory.jsHeapSizeLimit) * 100}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Heap</span>
              <span>{formatBytes(metrics.memory.totalJSHeapSize)}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${(metrics.memory.totalJSHeapSize / metrics.memory.jsHeapSizeLimit) * 100}%` }}
              ></div>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            Heap Limit: {formatBytes(metrics.memory.jsHeapSizeLimit)}
          </div>
        </div>

        {expanded && memoryHistory.length > 0 && (
          <div className="mt-4 h-32 flex items-end space-x-1">
            {memoryHistory.map((mem, i) => (
              <div
                key={i}
                className="bg-blue-500 w-full"
                style={{ height: `${(mem / Math.max(...memoryHistory)) * 100}%` }}
                title={`${mem.toFixed(1)} MB`}
              ></div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-3">Performance</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">FPS</span>
            <span className={metrics.fps < 30 ? 'text-red-500' : metrics.fps < 50 ? 'text-yellow-500' : 'text-green-500'}>
              {metrics.fps}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Page Load Time</span>
            <span>
              {metrics.timing.loadEventEnd > 0
                ? formatTime(metrics.timing.loadEventEnd - metrics.timing.navigationStart)
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">DOM Complete</span>
            <span>
              {metrics.timing.domComplete > 0
                ? formatTime(metrics.timing.domComplete - metrics.timing.navigationStart)
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Response Time</span>
            <span>
              {metrics.timing.responseEnd > 0
                ? formatTime(metrics.timing.responseEnd - metrics.timing.navigationStart)
                : 'N/A'}
            </span>
          </div>
        </div>

        {expanded && fpsHistory.length > 0 && (
          <div className="mt-4 h-32 flex items-end space-x-1">
            {fpsHistory.map((fps, i) => (
              <div
                key={i}
                className={`w-full ${fps < 30 ? 'bg-red-500' : fps < 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ height: `${(fps / 60) * 100}%` }}
                title={`${fps} FPS`}
              ></div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-3">Network Requests</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Total Requests</span>
            <span>{metrics.networkRequests.total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Successful</span>
            <span className="text-green-500">{metrics.networkRequests.success}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Failed</span>
            <span className="text-red-500">{metrics.networkRequests.failed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Pending</span>
            <span className="text-yellow-500">{metrics.networkRequests.pending}</span>
          </div>
        </div>
      </div>

      <CircuitBreakerStatus />
    </div>
  );

  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Performance Monitor</h2>
        <div className="flex space-x-2">
          <button
            onClick={collectMetrics}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            {expanded ? 'Basic View' : 'Detailed View'}
          </button>
        </div>
      </div>

      <div className="mb-4 border-b border-gray-800 pb-2">
        <div className="flex space-x-4">
          <button
            className={`px-3 py-1 rounded ${activeTab === 'overview' ? 'bg-blue-600' : 'bg-gray-700'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`px-3 py-1 rounded ${activeTab === 'cache' ? 'bg-blue-600' : 'bg-gray-700'}`}
            onClick={() => setActiveTab('cache')}
          >
            Cache
          </button>
          <button
            className={`px-3 py-1 rounded ${activeTab === 'websocket' ? 'bg-blue-600' : 'bg-gray-700'}`}
            onClick={() => setActiveTab('websocket')}
          >
            WebSockets
          </button>
          <button
            className={`px-3 py-1 rounded ${activeTab === 'retry' ? 'bg-blue-600' : 'bg-gray-700'}`}
            onClick={() => setActiveTab('retry')}
          >
            Retry Queue
          </button>
        </div>
      </div>

      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'cache' && <CacheStats />}
        {activeTab === 'websocket' && <WebSocketStatus />}
        {activeTab === 'retry' && <RetryQueue />}
      </div>
    </div>
  );
};

export default PerformanceMonitor;
