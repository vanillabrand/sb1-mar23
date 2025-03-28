import ccxt from 'ccxt';
import { backOff } from 'exponential-backoff';
import { logService } from './log-service';
import { EventEmitter } from './event-emitter';
import type { ExchangeConfig } from './types';
import axios from 'axios';

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
  private proxyUrl = 'http://localhost:3000';
  
  private constructor() {
    super();
  }

  static getInstance(): CCXTService {
    if (!CCXTService.instance) {
      CCXTService.instance = new CCXTService();
    }
    return CCXTService.instance;
  }

  async checkProxyAvailability(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.proxyUrl}/health`, { timeout: 5000 });
      return response.data.status === 'ok';
    } catch (error) {
      return false;
    }
  }

  async initialize(config: ExchangeConfig): Promise<void> {
    try {
      // Check if proxy is available
      const isProxyAvailable = await this.checkProxyAvailability();
      if (!isProxyAvailable) {
        throw new Error('Proxy server is not available. Please ensure the proxy server is running.');
      }

      const exchange = await this.createExchange(config);
      
      // Configure the exchange instance
      exchange.options = {
        ...exchange.options,
        defaultType: 'spot',
        adjustForTimeDifference: true,
        createMarketBuyOrderRequiresPrice: false,
        warnOnFetchOHLCVLimitArgument: false,
      };

      // Set the API URLs to use our proxy
      const proxyUrl = `${this.proxyUrl}/api/proxy`;
      exchange.urls = {
        ...exchange.urls,
        api: {
          rest: proxyUrl,
          public: proxyUrl,
          private: proxyUrl,
          v1: proxyUrl,
          v2: proxyUrl
        }
      };

      // Force all requests through proxy
      exchange.proxy = proxyUrl;
      exchange.enableRateLimit = true;
      exchange.timeout = 10000;

      // Add custom headers
      exchange.headers = {
        ...exchange.headers,
        'Origin': window.location.origin,
      };

      await this.validateConnection(exchange);
      this.exchange = exchange;
    } catch (error) {
      logService.log('error', 'Failed to initialize exchange', error, 'CCXTService');
      throw error;
    }
  }

  private async validateConnection(exchange: any): Promise<void> {
    try {
      // Use fetchTime instead of direct API call
      await exchange.fetchTime();
      logService.log('info', 'Exchange connection validated', null, 'CCXTService');
    } catch (error) {
      logService.log('error', 'Exchange connection validation failed', error, 'CCXTService');
      throw new Error('Failed to validate exchange connection');
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

  private async createExchange(config: ExchangeConfig): Promise<ccxt.Exchange> {
    if (!this.isValidConfig(config)) {
      throw new Error('Invalid exchange configuration');
    }

    const ExchangeClass = this.getExchangeClass(config.name);
    const exchange = new ExchangeClass({
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

    // Load markets immediately to ensure the exchange is properly initialized
    await exchange.loadMarkets();

    return exchange;
  }
}

export const ccxtService = CCXTService.getInstance();
