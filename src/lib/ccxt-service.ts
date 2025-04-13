import ccxt from 'ccxt';
import type { ExchangeId, ExchangeCredentials } from './types';
import { logService } from './log-service';
import { EventEmitter } from './event-emitter';

class CCXTService extends EventEmitter {
  private exchanges: Map<string, any> = new Map();
  private readonly SPOT_TESTNET_BASE_URL = 'https://testnet.binance.vision/api';
  private readonly FUTURES_TESTNET_BASE_URL = 'https://testnet.binancefuture.com/fapi';
  private readonly TESTNET_BASE_URL = 'https://testnet.binance.vision/api'; // Kept for backward compatibility

  async createExchange(
    exchangeId: string,
    credentials: { apiKey: string; secret: string },
    testnet: boolean = false,
    marketType: 'spot' | 'future' = 'spot'
  ): Promise<any> {
    try {
      if (testnet) {
        // Determine which API credentials to use based on market type
        let apiKey, secret;

        if (marketType === 'future') {
          // Use Futures TestNet credentials
          apiKey = import.meta.env.VITE_BINANCE_FUTURES_TESTNET_API_KEY ||
                  import.meta.env.VITE_DEMO_EXCHANGE_API_KEY ||
                  import.meta.env.VITE_BINANCE_TESTNET_API_KEY ||
                  credentials.apiKey;
          secret = import.meta.env.VITE_BINANCE_FUTURES_TESTNET_API_SECRET ||
                  import.meta.env.VITE_DEMO_EXCHANGE_SECRET ||
                  import.meta.env.VITE_BINANCE_TESTNET_API_SECRET ||
                  credentials.secret;
        } else {
          // Use Spot TestNet credentials
          apiKey = import.meta.env.VITE_DEMO_EXCHANGE_API_KEY ||
                  import.meta.env.VITE_BINANCE_TESTNET_API_KEY ||
                  credentials.apiKey;
          secret = import.meta.env.VITE_DEMO_EXCHANGE_SECRET ||
                  import.meta.env.VITE_BINANCE_TESTNET_API_SECRET ||
                  credentials.secret;
        }

        // Determine which TestNet URL to use based on market type
        const testnetBaseUrl = marketType === 'future' ?
          this.FUTURES_TESTNET_BASE_URL :
          this.SPOT_TESTNET_BASE_URL;

        const exchange = new ccxt[exchangeId]({
          apiKey,
          secret,
          enableRateLimit: true,
          options: {
            defaultType: marketType, // Set the market type
            adjustForTimeDifference: true,
            createMarketBuyOrderRequiresPrice: false,
            warnOnFetchOHLCVLimitArgument: true,
            recvWindow: 60000,
          },
          urls: {
            test: {
              rest: testnetBaseUrl
            }
          }
        });

        // Enable test mode
        exchange.setSandboxMode(true);

        // Log the configuration
        logService.log('info', `Created TestNet exchange instance for ${marketType} trading`, {
          exchangeId,
          hasApiKey: !!apiKey,
          hasSecret: !!secret,
          testnet: true,
          marketType,
          baseUrl: testnetBaseUrl
        }, 'CCXTService');

        this.exchanges.set(marketType === 'future' ? `${exchangeId}Futures` : exchangeId, exchange);
        return exchange;
      }

      // ... rest of the method for non-testnet exchanges
    } catch (error) {
      logService.log('error', 'Failed to create exchange instance', error, 'CCXTService');
      throw error;
    }
  }

  /**
   * Get the current exchange instance
   * @returns The current exchange instance
   */
  getCurrentExchange(): ccxt.Exchange | null {
    return this.exchange;
  }

  /**
   * Get or create an exchange instance
   * @param exchangeId The exchange ID (e.g., 'binance')
   * @param testnet Whether to use testnet
   * @returns The exchange instance
   */
  async getExchange(exchangeId: ExchangeId, testnet: boolean = false): Promise<ccxt.Exchange | null> {
    try {
      // If we already have an exchange instance, return it
      if (this.exchange) {
        return this.exchange;
      }

      // Get credentials based on whether we're using testnet or not
      let credentials: ExchangeCredentials;

      if (testnet) {
        // Use TestNet credentials from environment variables
        const apiKey = import.meta.env.VITE_DEMO_EXCHANGE_API_KEY ||
                      import.meta.env.VITE_BINANCE_TESTNET_API_KEY ||
                      '';
        const secret = import.meta.env.VITE_DEMO_EXCHANGE_SECRET ||
                      import.meta.env.VITE_BINANCE_TESTNET_API_SECRET ||
                      '';

        credentials = {
          apiKey,
          secret,
          memo: ''
        };

        // Log the credentials (without the actual values for security)
        logService.log('info', `Using Binance TestNet credentials`, {
          hasApiKey: !!credentials.apiKey,
          hasSecret: !!credentials.secret,
          apiKeyLength: credentials.apiKey ? credentials.apiKey.length : 0,
          secretLength: credentials.secret ? credentials.secret.length : 0
        }, 'CCXTService');

        console.log(`TestNet credentials check: API Key ${credentials.apiKey ? 'present' : 'missing'}, Secret ${credentials.secret ? 'present' : 'missing'}`);
        console.log(`API Key length: ${credentials.apiKey ? credentials.apiKey.length : 0}, Secret length: ${credentials.secret ? credentials.secret.length : 0}`);
      } else {
        // Use demo exchange credentials
        credentials = {
          apiKey: import.meta.env.VITE_DEMO_EXCHANGE_API_KEY || '',
          secret: import.meta.env.VITE_DEMO_EXCHANGE_SECRET || '',
          memo: import.meta.env.VITE_DEMO_EXCHANGE_MEMO || ''
        };
      }

      // Create the exchange
      return await this.createExchange(exchangeId, credentials, testnet);
    } catch (error) {
      logService.log('error', `Failed to get exchange ${exchangeId}`, error, 'CCXTService');
      return null;
    }
  }

  async loadMarkets(): Promise<void> {
    if (!this.exchange) {
      throw new Error('Exchange not initialized');
    }
    await this.exchange.loadMarkets();
  }

  /**
   * Normalizes a symbol to the format expected by the exchange
   * @param symbol Symbol to normalize (e.g., 'BTC_USDT' or 'BTC/USDT')
   * @returns Normalized symbol (e.g., 'BTC/USDT')
   */
  normalizeSymbol(symbol: string): string {
    // Replace underscore with slash if present
    if (symbol.includes('_')) {
      logService.log('info', `Normalizing symbol format from ${symbol} to ${symbol.replace('_', '/')}`, null, 'CCXTService');
      return symbol.replace('_', '/');
    }
    return symbol;
  }

  async fetchTicker(symbol: string) {
    if (!this.exchange) {
      throw new Error('Exchange not initialized');
    }
    return await this.exchange.fetchTicker(this.normalizeSymbol(symbol));
  }

  async fetchOrderBook(symbol: string) {
    try {
      const exchange = this.getCurrentExchange();
      if (!exchange) {
        throw new Error('Exchange not initialized');
      }
      return await exchange.fetchOrderBook(this.normalizeSymbol(symbol));
    } catch (error) {
      logService.log('error', `Failed to fetch order book for ${symbol}`, error, 'CCXTService');
      throw error;
    }
  }

  async fetchRecentTrades(symbol: string, limit: number = 100) {
    try {
      const exchange = this.getCurrentExchange();
      if (!exchange) {
        throw new Error('Exchange not initialized');
      }
      return await exchange.fetchTrades(this.normalizeSymbol(symbol), undefined, limit);
    } catch (error) {
      logService.log('error', `Failed to fetch recent trades for ${symbol}`, error, 'CCXTService');
      throw error;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const exchange = this.getCurrentExchange();
      if (!exchange) {
        return false;
      }
      await exchange.loadMarkets();
      return true;
    } catch (error) {
      logService.log('error', 'Connection check failed', error, 'CCXTService');
      return false;
    }
  }

  getRateLimit(): number {
    const exchange = this.getCurrentExchange();
    if (!exchange) {
      return 1000; // Default rate limit
    }
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

export const ccxtService = new CCXTService();
