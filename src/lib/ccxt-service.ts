import ccxt from 'ccxt';
import type { ExchangeId, ExchangeCredentials } from './types';
import { logService } from './log-service';
import { EventEmitter } from './event-emitter';

export class CCXTService {
  private static instance: CCXTService;
  private exchanges: Map<string, any> = new Map();
  private readonly TESTNET_URLS = {
    'binance': {
      rest: 'https://testnet.binance.vision/api/',
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

      const exchange = new ccxt[exchangeId](config);

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
}

export const ccxtService = new CCXTService();
