type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class LogService {
  log(
    level: LogLevel,
    message: string,
    error: Error | null = null,
    component: string = 'General'
  ): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] ${component}:`;
    
    if (error) {
      console.log(prefix, message, error);
    } else {
      console.log(prefix, message);
    }
  }

  debug(message: string, component?: string): void {
    this.log('debug', message, null, component || 'General');
  }

  info(message: string, component?: string): void {
    this.log('info', message, null, component || 'General');
  }

  warn(message: string, error?: Error, component?: string): void {
    this.log('warn', message, error || null, component || 'General');
  }

  error(message: string, error?: Error, component?: string): void {
    this.log('error', message, error || null, component || 'General');
  }
}

export const logService = new LogService();
