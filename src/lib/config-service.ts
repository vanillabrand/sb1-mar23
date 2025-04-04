import { logService } from './log-service';

/**
 * ConfigService provides access to environment variables and configuration settings
 */
class ConfigService {
  private static instance: ConfigService;
  private config: Record<string, string> = {};
  private initialized: boolean = false;

  private constructor() {
    this.loadConfig();
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): void {
    try {
      // Load environment variables from import.meta.env (Vite)
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        Object.keys(import.meta.env).forEach(key => {
          if (key.startsWith('VITE_')) {
            const configKey = key.replace('VITE_', '');
            this.config[configKey] = import.meta.env[key];
          } else {
            this.config[key] = import.meta.env[key];
          }
        });
      }

      // Add Binance TestNet WebSocket URL if not already set
      if (!this.config['BINANCE_TESTNET_WEBSOCKETS_URL']) {
        this.config['BINANCE_TESTNET_WEBSOCKETS_URL'] = 'wss://testnet.binancefuture.com/ws-fapi/v1';
      }

      this.initialized = true;
      logService.log('info', 'Config service initialized', null, 'ConfigService');
    } catch (error) {
      logService.log('error', 'Failed to load configuration', error, 'ConfigService');
    }
  }

  /**
   * Get a configuration value
   * @param key The configuration key
   * @param defaultValue Optional default value if the key is not found
   * @returns The configuration value or the default value
   */
  get(key: string, defaultValue?: string): string | undefined {
    if (!this.initialized) {
      this.loadConfig();
    }
    
    return this.config[key] || defaultValue;
  }

  /**
   * Set a configuration value
   * @param key The configuration key
   * @param value The configuration value
   */
  set(key: string, value: string): void {
    this.config[key] = value;
  }

  /**
   * Check if a configuration key exists
   * @param key The configuration key
   * @returns True if the key exists, false otherwise
   */
  has(key: string): boolean {
    return key in this.config;
  }

  /**
   * Get all configuration values
   * @returns All configuration values
   */
  getAll(): Record<string, string> {
    return { ...this.config };
  }
}

export const configService = ConfigService.getInstance();
