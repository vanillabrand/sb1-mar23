import { EventEmitter } from './event-emitter';

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: any;
  source?: string;
}

class LogService extends EventEmitter {
  private static instance: LogService;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000; // Maximum number of logs to keep
  private originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
    info: console.info
  };

  private constructor() {
    super();
    this.interceptConsoleMethods();
  }

  static getInstance(): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService();
    }
    return LogService.instance;
  }

  private interceptConsoleMethods() {
    // Override console methods to capture logs
    console.log = (...args: any[]) => {
      this.originalConsole.log(...args);
      this.addLog('info', args[0], args.slice(1));
    };

    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      this.addLog('warn', args[0], args.slice(1));
    };

    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      this.addLog('error', args[0], args.slice(1));
    };

    console.debug = (...args: any[]) => {
      this.originalConsole.debug(...args);
      this.addLog('debug', args[0], args.slice(1));
    };

    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      this.addLog('info', args[0], args.slice(1));
    };
  }

  private addLog(level: LogEntry['level'], message: any, details?: any, source?: string) {
    // Format message if it's not a string
    const formattedMessage = typeof message === 'string' 
      ? message 
      : JSON.stringify(message, null, 2);

    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      message: formattedMessage,
      details: details?.length ? details : undefined,
      source
    };

    this.logs.push(logEntry);
    
    // Trim logs if they exceed the maximum
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Emit event for subscribers
    this.emit('newLog', logEntry);
    this.emit('logsUpdated', this.logs);
  }

  log(level: LogEntry['level'], message: string, details?: any, source?: string) {
    this.addLog(level, message, details ? [details] : undefined, source);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    this.emit('logsUpdated', this.logs);
  }

  setMaxLogs(max: number) {
    this.maxLogs = max;
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
      this.emit('logsUpdated', this.logs);
    }
  }

  restoreConsoleMethods() {
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;
    console.info = this.originalConsole.info;
  }
}

export const logService = LogService.getInstance();