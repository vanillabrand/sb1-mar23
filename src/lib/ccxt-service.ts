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
      const exchange = await this.createExchange(config);
      
      // Set default options
      exchange.options = {
        ...exchange.options,
        defaultType: 'spot',
        adjustForTimeDifference: true,
        createMarketBuyOrderRequiresPrice: false,
        warnOnFetchOHLCVLimitArgument: false,
      };

      // Direct API connection
      exchange.urls = {
        ...exchange.urls,
        api: {
          rest: 'https://api-cloud.bitmart.com',
        }
      };

      exchange.enableRateLimit = true;
      exchange.timeout = 10000;

      await this.validateConnection(exchange);
      this.exchange = exchange;
    } catch (error) {
      logService.log('error', 'Failed to initialize exchange', error, 'CCXTService');
      throw error;
    }
  }

  private async validateConnection(exchange: ccxt.Exchange): Promise<void> {
    try {
      if (!exchange) {
        throw new Error('Exchange instance is undefined');
      }

      // Test connection with a simple request
      await exchange.loadMarkets();
      
      // Verify that we can fetch at least one ticker
      const testSymbol = 'BTC/USDT';
      await exchange.fetchTicker(testSymbol);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to validate exchange connection: ${errorMessage}`);
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

    // Ensure we're using the correct API endpoint
    exchange.urls = {
      ...exchange.urls,
      api: {
        rest: 'https://api-cloud.bitmart.com',
      }
    };

    return exchange;
  }
}

export const ccxtService = CCXTService.getInstance();
