type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogService {
  initialize(): Promise<void>;
  log(level: LogLevel, message: string, error?: Error | null | any, component?: string): void;
  debug(message: string, metadata?: any, component?: string): void;
  info(message: string, metadata?: any, component?: string): void;
  warn(message: string, error?: Error | any, component?: string): void;
  error(message: string, error?: Error | any, component?: string): void;
}

class LogServiceImpl implements LogService {
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('[LogService] Initializing logging service...');

      // Add any additional initialization logic here
      // For example, setting up remote logging, configuring log levels, etc.

      this.initialized = true;
      this.log('info', 'Logging service initialized successfully', null, 'LogService');
    } catch (error) {
      console.error('[LogService] Failed to initialize logging service:', error);
      throw error;
    }
  }

  log(
    level: LogLevel,
    message: string,
    error: Error | null | any = null,
    component: string = 'General'
  ): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] ${component}:`;

    if (error) {
      // Check if it's an Error object or just metadata
      if (error instanceof Error) {
        console.log(prefix, message, error);
      } else {
        console.log(prefix, message, error);
      }
    } else {
      console.log(prefix, message);
    }
  }

  debug(message: string, metadata?: any, component?: string): void {
    this.log('debug', message, metadata, component);
  }

  info(message: string, metadata?: any, component?: string): void {
    this.log('info', message, metadata, component);
  }

  warn(message: string, error?: Error | any, component?: string): void {
    this.log('warn', message, error, component);
  }

  error(message: string, error?: Error | any, component?: string): void {
    this.log('error', message, error, component);
  }
}

// Export a single instance
export const logService = new LogServiceImpl();
