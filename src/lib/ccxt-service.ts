import ccxt from 'ccxt';
import { logService } from './log-service';

export class CCXTService {
  private exchanges: Map<string, any> = new Map();
  private readonly TESTNET_URLS: Record<string, { rest: string, ws: string }> = {
    'binance': {
      rest: 'https://testnet.binance.vision/api',
      ws: 'wss://testnet.binance.vision/ws'
    }
  };

  async createExchange(exchangeId: string, credentials?: any, useTestnet: boolean = false): Promise<any> {
    try {
      const config: any = {
        enableRateLimit: true,
        timeout: 30000,
      };

      if (useTestnet) {
        config.urls = {
          api: this.TESTNET_URLS[exchangeId]?.rest,
          ws: this.TESTNET_URLS[exchangeId]?.ws
        };
      }

      if (credentials?.apiKey) {
        config.apiKey = credentials.apiKey;
        config.secret = credentials.secret;
      }

      // Use type assertion to avoid TypeScript error
      const exchange = new (ccxt as any)[exchangeId](config);

      // Set up proper error handling
      exchange.verbose = true; // Enable detailed error logging

      return exchange;
    } catch (error) {
      logService.log('error', `Failed to create exchange ${exchangeId}`, error, 'CCXTService');
      throw error;
    }
  }

  async getExchange(exchangeId: string, useTestnet: boolean = false): Promise<any> {
    const key = `${exchangeId}-${useTestnet ? 'testnet' : 'main'}`;

    if (!this.exchanges.has(key)) {
      const exchange = await this.createExchange(exchangeId, null, useTestnet);
      this.exchanges.set(key, exchange);
    }

    return this.exchanges.get(key);
  }

  /**
   * Execute an operation with retry logic
   * @param operation Function to execute
   * @param operationName Name of the operation for logging
   * @param maxRetries Maximum number of retries
   * @returns Result of the operation
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        logService.log('warn', `Attempt ${attempt}/${maxRetries} failed for ${operationName}`, error, 'CCXTService');

        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const delay = Math.floor(Math.random() * 1000 * Math.pow(2, attempt));
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logService.log('error', `All ${maxRetries} attempts failed for ${operationName}`, lastError, 'CCXTService');
    throw lastError;
  }
}

export const ccxtService = new CCXTService();
