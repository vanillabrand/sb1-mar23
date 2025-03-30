import ccxt from 'ccxt';
import type { ExchangeId, ExchangeCredentials } from './types';
import { logService } from './log-service';

class CCXTService {
  private static instance: CCXTService;
  private exchange: ccxt.Exchange | null = null;

  private constructor() {}

  static getInstance(): CCXTService {
    if (!CCXTService.instance) {
      CCXTService.instance = new CCXTService();
    }
    return CCXTService.instance;
  }

  async createExchange(
    exchangeId: ExchangeId,
    credentials: ExchangeCredentials,
    testnet: boolean = false
  ): Promise<ccxt.Exchange> {
    try {
      // @ts-ignore: Dynamic access to CCXT exchanges
      const ExchangeClass = ccxt[exchangeId];
      if (!ExchangeClass) {
        throw new Error(`Unsupported exchange: ${exchangeId}`);
      }

      const config: any = {
        apiKey: credentials.apiKey,
        secret: credentials.secret,
        enableRateLimit: true,
        timeout: 30000,
      };

      if (credentials.memo) {
        config.password = credentials.memo;
      }

      const exchange = new ExchangeClass(config);

      if (testnet) {
        exchange.setSandboxMode(true);
      }

      // Store the instance
      this.exchange = exchange;
      return exchange;

    } catch (error) {
      logService.log('error', 'Failed to create exchange instance', error, 'CCXTService');
      throw error;
    }
  }

  getExchange(): ccxt.Exchange | null {
    return this.exchange;
  }

  async loadMarkets(): Promise<void> {
    if (!this.exchange) {
      throw new Error('Exchange not initialized');
    }
    await this.exchange.loadMarkets();
  }

  async fetchTicker(symbol: string) {
    if (!this.exchange) {
      throw new Error('Exchange not initialized');
    }
    return await this.exchange.fetchTicker(symbol);
  }

  async fetchOrderBook(symbol: string) {
    try {
      const exchange = this.getExchange();
      return await exchange.fetchOrderBook(symbol);
    } catch (error) {
      logService.log('error', `Failed to fetch order book for ${symbol}`, error, 'CCXTService');
      throw error;
    }
  }

  async fetchRecentTrades(symbol: string, limit: number = 100) {
    try {
      const exchange = this.getExchange();
      return await exchange.fetchTrades(symbol, undefined, limit);
    } catch (error) {
      logService.log('error', `Failed to fetch recent trades for ${symbol}`, error, 'CCXTService');
      throw error;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const exchange = this.getExchange();
      await exchange.loadMarkets();
      return true;
    } catch (error) {
      logService.log('error', 'Connection check failed', error, 'CCXTService');
      return false;
    }
  }

  getRateLimit(): number {
    const exchange = this.getExchange();
    return exchange.rateLimit;
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        logService.log('warn', `Retry ${i + 1}/${maxRetries} failed for ${operationName}`, error, 'CCXTService');
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw lastError;
  }
}

export const ccxtService = CCXTService.getInstance();
