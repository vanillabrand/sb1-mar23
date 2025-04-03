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
        recvWindow: 10000, // Increase receive window for Binance
      };

      // Add proxy support if available
      if (import.meta.env.VITE_PROXY_URL) {
        // For Binance TestNet, we need to use a specific proxy URL
        if (exchangeId === 'binance' && testnet) {
          // Use the binanceTestnet proxy path
          config.urls = {
            api: `${import.meta.env.VITE_PROXY_URL}binanceTestnet`
          };

          // Force CCXT to use our proxy for all requests
          // Don't set config.proxy = false as it's causing issues
          // Just let CCXT use the custom URLs

          // Add custom options for better error handling
          config.options = {
            ...config.options,
            verbose: true, // Enable verbose mode for debugging
            timeout: 30000, // 30 seconds timeout (increased for reliability)
            retry: true, // Enable retry
            retries: 5, // Increased number of retries
            retryDelay: 1000, // Delay between retries in milliseconds
            createMarketBuyOrderRequiresPrice: false, // Allow market orders without price
            defaultType: 'spot', // Use spot trading by default
          };

          // Log the configuration
          logService.log('info', `Using proxy for Binance TestNet: ${import.meta.env.VITE_PROXY_URL}binanceTestnet`, null, 'CCXTService');
          console.log(`Using proxy for Binance TestNet: ${import.meta.env.VITE_PROXY_URL}binanceTestnet with timeout: ${config.options.timeout}ms`);
          console.log('CCXT config:', JSON.stringify(config, null, 2));
        } else {
          // For other exchanges, use the standard proxy URL
          config.proxy = import.meta.env.VITE_PROXY_URL;
          logService.log('info', `Using proxy for exchange: ${import.meta.env.VITE_PROXY_URL}`, null, 'CCXTService');
        }
      }

      // Add user agent to avoid some blocks
      config.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

      if (credentials.memo) {
        config.password = credentials.memo;
      }

      const exchange = new ExchangeClass(config);

      // Configure testnet/sandbox mode if requested
      if (testnet) {
        exchange.setSandboxMode(true);
        logService.log('info', `Using testnet/sandbox mode for ${exchangeId}`, null, 'CCXTService');
      }

      // For Binance specifically, add some additional options
      if (exchangeId === 'binance') {
        // Adjust options for better reliability
        exchange.options = {
          ...exchange.options,
          adjustForTimeDifference: true,
          recvWindow: 10000,
          warnOnFetchOpenOrdersWithoutSymbol: false,
        };

        // Log the endpoint being used
        if (testnet) {
          // For TestNet, we're using our proxy
          const endpoint = import.meta.env.VITE_PROXY_URL ?
            `${import.meta.env.VITE_PROXY_URL}binanceTestnet` :
            'https://testnet.binance.vision';
          logService.log('info', `Binance TestNet endpoint: ${endpoint}`, null, 'CCXTService');
          console.log(`Using Binance TestNet endpoint: ${endpoint}`);
        } else {
          // For production, use the standard endpoint
          const endpoint = 'api.binance.com';
          logService.log('info', `Binance endpoint: ${endpoint}`, null, 'CCXTService');
        }
      }

      // Store the instance
      this.exchange = exchange;
      return exchange;

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
        credentials = {
          apiKey: import.meta.env.VITE_BINANCE_TEST_API_KEY || process.env.BINANCE_TESTNET_API_KEY || '',
          secret: import.meta.env.VITE_BINANCE_TEST_API_SECRET || process.env.BINANCE_TESTNET_API_SECRET || '',
          memo: ''
        };

        // Log the credentials (without the actual values for security)
        logService.log('info', `Using Binance TestNet credentials`,
          { hasApiKey: !!credentials.apiKey, hasSecret: !!credentials.secret },
          'CCXTService');
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

export const ccxtService = CCXTService.getInstance();
