import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  AlertTriangle, 
  Info, 
  Bug, 
  AlertCircle, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Download, 
  Maximize2, 
  Minimize2,
  Search
} from 'lucide-react';
import { logService, type LogEntry } from '../lib/log-service';

interface LogWindowProps {
  onClose: () => void;
}

export function LogWindow({ onClose }: LogWindowProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial load of logs
    setLogs(logService.getLogs());

    // Subscribe to log updates
    const handleLogsUpdated = (updatedLogs: LogEntry[]) => {
      setLogs(updatedLogs);
    };

    logService.on('logsUpdated', handleLogsUpdated);

    return () => {
      logService.off('logsUpdated', handleLogsUpdated);
    };
  }, []);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleClearLogs = () => {
    logService.clearLogs();
  };

  const handleExportLogs = () => {
    const logData = JSON.stringify(logs, null, 2);
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `stratgen-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-neon-pink" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-neon-orange" />;
      case 'debug':
        return <Bug className="w-4 h-4 text-neon-yellow" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-neon-turquoise" />;
    }
  };

  const getLogClass = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'bg-neon-pink/10 border-neon-pink/20 text-neon-pink';
      case 'warn':
        return 'bg-neon-orange/10 border-neon-orange/20 text-neon-orange';
      case 'debug':
        return 'bg-neon-yellow/10 border-neon-yellow/20 text-neon-yellow';
      case 'info':
      default:
        return 'bg-neon-turquoise/10 border-neon-turquoise/20 text-neon-turquoise';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  const filteredLogs = logs.filter(log => {
    // Apply level filter
    if (filter !== 'all' && log.level !== filter) {
      return false;
    }
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        log.message.toLowerCase().includes(searchLower) ||
        (log.source && log.source.toLowerCase().includes(searchLower)) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(searchLower))
      );
    }
    
    return true;
  });

  return (
    <div 
      className={`fixed ${isExpanded ? 'inset-0' : 'bottom-0 right-0 w-[600px] h-[400px]'} 
        bg-gunmetal-900/95 backdrop-blur-xl border border-gunmetal-800 rounded-t-lg 
        shadow-2xl z-50 flex flex-col transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gunmetal-800">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-neon-turquoise" />
          <h2 className="text-lg font-semibold">Debug Log</h2>
          <span className="text-xs bg-gunmetal-800 px-2 py-0.5 rounded-full text-gray-400">
            {filteredLogs.length} entries
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-gunmetal-800 rounded-lg transition-colors"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4 text-gray-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gunmetal-800 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gunmetal-800">
        <div className="flex items-center gap-1 bg-gunmetal-800 rounded-lg p-1">
          <button 
            onClick={() => setFilter('all')}
            className={`px-2 py-1 rounded text-xs font-medium ${
              filter === 'all' ? 'bg-gunmetal-700 text-gray-200' : 'text-gray-400'
            }`}
          >
            All
          </button>
          <button 
            onClick={() => setFilter('info')}
            className={`px-2 py-1 rounded text-xs font-medium ${
              filter === 'info' ? 'bg-neon-turquoise/20 text-neon-turquoise' : 'text-gray-400'
            }`}
          >
            Info
          </button>
          <button 
            onClick={() => setFilter('warn')}
            className={`px-2 py-1 rounded text-xs font-medium ${
              filter === 'warn' ? 'bg-neon-orange/20 text-neon-orange' : 'text-gray-400'
            }`}
          >
            Warn
          </button>
          <button 
            onClick={() => setFilter('error')}
            className={`px-2 py-1 rounded text-xs font-medium ${
              filter === 'error' ? 'bg-neon-pink/20 text-neon-pink' : 'text-gray-400'
            }`}
          >
            Error
          </button>
          <button 
            onClick={() => setFilter('debug')}
            className={`px-2 py-1 rounded text-xs font-medium ${
              filter === 'debug' ? 'bg-neon-yellow/20 text-neon-yellow' : 'text-gray-400'
            }`}
          >
            Debug
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs..."
            className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neon-turquoise"
          />
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded-lg transition-colors ${
              autoScroll ? 'bg-neon-turquoise/20 text-neon-turquoise' : 'hover:bg-gunmetal-800 text-gray-400'
            }`}
            title={autoScroll ? "Auto-scroll enabled" : "Auto-scroll disabled"}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button 
            onClick={handleExportLogs}
            className="p-1.5 hover:bg-gunmetal-800 rounded-lg text-gray-400 transition-colors"
            title="Export logs"
          >
            <Download className="w-4 h-4" />
          </button>
          <button 
            onClick={handleClearLogs}
            className="p-1.5 hover:bg-gunmetal-800 rounded-lg text-gray-400 transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Log Content */}
      <div 
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No logs to display
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div 
              key={index} 
              className={`p-2 rounded border ${getLogClass(log.level)}`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  {getLogIcon(log.level)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-400">{formatTimestamp(log.timestamp)}</span>
                    {log.source && (
                      <span className="bg-gunmetal-800 px-1.5 py-0.5 rounded text-gray-300">
                        {log.source}
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap break-words">
                    {log.message}
                  </div>
                  {log.details && (
                    <div className="mt-1 bg-gunmetal-900/50 p-2 rounded overflow-x-auto">
                      <pre>{JSON.stringify(log.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}