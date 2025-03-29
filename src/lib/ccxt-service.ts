import ccxt from 'ccxt';
import { logService } from './log-service';

export class CCXTService {
  private static instance: CCXTService;

  static getInstance(): CCXTService {
    if (!this.instance) {
      this.instance = new CCXTService();
    }
    return this.instance;
  }

  async createExchange(
    exchangeId: string,
    credentials: { apiKey: string; secret: string; memo?: string }
  ): Promise<ccxt.Exchange> {
    try {
      const exchangeClass = ccxt[exchangeId];
      const exchange = new exchangeClass({
        apiKey: credentials.apiKey,
        secret: credentials.secret,
        password: credentials.memo,
        enableRateLimit: true,
        timeout: 30000,
        // Add proxy configuration
        urls: {
          api: {
            public: '/api',  // This will be relative to the current domain
            private: '/api',
          }
        },
        // Optional: Configure fetch to use your proxy
        fetchImplementation: async (url, options = {}) => {
          const proxyUrl = url.replace('https://api-cloud-v2.bitmart.com', '/api');
          return fetch(proxyUrl, {
            ...options,
            mode: 'cors',
            credentials: 'omit'
          });
        }
      });

      return exchange;
    } catch (error) {
      logService.log('error', 'Failed to create CCXT exchange instance', error, 'CCXTService');
      throw error;
    }
  }
}

export const ccxtService = CCXTService.getInstance();
