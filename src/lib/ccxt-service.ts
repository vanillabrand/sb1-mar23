import ccxt from 'ccxt';
import { backOff } from 'exponential-backoff';
import { logService } from './log-service';
import { EventEmitter } from './event-emitter';
import type { ExchangeConfig } from './types';

export class CCXTService extends EventEmitter {
  private static instance: CCXTService;
  private exchange: ccxt.Exchange | null = null;
  private exchangeId: string | null = null;
  private readonly retryOptions = {
    numOfAttempts: 3,
    startingDelay: 1000,
    timeMultiple: 2,
    maxDelay: 5000
  };

  private constructor() {
    super();
  }

  static getInstance(): CCXTService {
    if (!CCXTService.instance) {
      CCXTService.instance = new CCXTService();
    }
    return CCXTService.instance;
  }

  async initialize(config: ExchangeConfig): Promise<void> {
    try {
      if (!this.isValidConfig(config)) {
        throw new Error('Invalid exchange configuration');
      }

      const proxyUrl = import.meta.env.VITE_PROXY_URL;
      
      const ExchangeClass = this.getExchangeClass(config.name);
      this.exchange = new ExchangeClass({
        apiKey: config.apiKey,
        secret: config.secret,
        password: config.memo,
        enableRateLimit: true,
        timeout: 10000,
        proxy: proxyUrl || undefined,
        options: {
          defaultType: 'spot',
          adjustForTimeDifference: true,
          createMarketBuyOrderRequiresPrice: false,
          fetchImplementation: async (url: string, options = {}) => {
            const finalUrl = proxyUrl ? `${proxyUrl}${encodeURIComponent(url)}` : url;
            return await fetch(finalUrl, {
              ...options,
              headers: {
                ...options.headers,
                'Origin': window.location.origin,
              },
            });
          }
        }
      });

      await this.validateConnection();
      this.exchangeId = config.name;
      this.emit('initialized', { exchangeId: this.exchangeId });
    } catch (error) {
      logService.log('error', 'Failed to initialize exchange', error, 'CCXTService');
      throw error;
    }
  }

  private async validateConnection(): Promise<void> {
    if (!this.exchange) {
      throw new Error('Exchange not initialized');
    }

    try {
      // Test the connection by loading markets
      await this.executeWithRetry(
        () => this.exchange!.loadMarkets(),
        'validate connection'
      );
    } catch (error) {
      throw new Error(`Failed to validate exchange connection: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getExchange(): Promise<ccxt.Exchange> {
    if (!this.exchange) {
      throw new Error('Exchange not initialized');
    }
    return this.exchange;
  }

  private isValidConfig(config: ExchangeConfig): boolean {
    return Boolean(
      config &&
      config.name &&
      config.apiKey &&
      config.secret &&
      typeof config.name === 'string' &&
      typeof config.apiKey === 'string' &&
      typeof config.secret === 'string'
    );
  }

  private getExchangeClass(exchangeId: string): typeof ccxt.Exchange {
    const normalizedId = exchangeId.toLowerCase();
    if (!(normalizedId in ccxt)) {
      throw new Error(`Unsupported exchange: ${exchangeId}`);
    }
    return ccxt[normalizedId as keyof typeof ccxt];
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    return backOff(
      async () => {
        try {
          return await operation();
        } catch (error) {
          if (this.isRetryableError(error)) {
            throw error;
          }
          throw new Error(`Non-retryable error in ${context}: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      this.retryOptions
    );
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof ccxt.NetworkError) return true;
    if (error instanceof ccxt.ExchangeNotAvailable) return true;
    if (error instanceof ccxt.RequestTimeout) return true;
    if (error instanceof ccxt.DDoSProtection) return true;
    return false;
  }

  private getProxyUrl(): string {
    // Check if we're running in Codespaces
    const isCodespaces = window.location.hostname.includes('.github.dev') ||
                        window.location.hostname.includes('.githubpreview.dev');
    
    if (isCodespaces) {
      // Replace the port in the current URL from 5173 to 3000
      const url = new URL(window.location.href);
      url.port = '3000';
      return `${url.origin}/api/proxy/`;
    }
    
    // Default to environment variable or localhost
    return import.meta.env.VITE_PROXY_URL || 'http://localhost:3000/api/proxy/';
  }

  private async createExchange(config: ExchangeConfig): Promise<ccxt.Exchange> {
    const ExchangeClass = this.getExchangeClass(config.name);
    return new ExchangeClass({
      apiKey: config.apiKey,
      secret: config.secret,
      password: config.memo,
      enableRateLimit: true,
      timeout: 10000,
      options: {
        defaultType: 'spot',
        adjustForTimeDifference: true,
        createMarketBuyOrderRequiresPrice: false
      }
    });
  }
}

export const ccxtService = CCXTService.getInstance();
