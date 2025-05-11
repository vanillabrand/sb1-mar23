// Import the browser-compatible CCXT wrapper
import ccxt from './ccxt-browser-wrapper';
import type { ExchangeId, ExchangeCredentials } from './types';
import { logService } from './log-service';
import { EventEmitter } from './event-emitter';
import { demoService } from './demo-service';

export class CCXTService extends EventEmitter {
  private static instance: CCXTService;
  private exchanges: Map<string, any> = new Map();
  private initialized: boolean = false;
  private defaultExchange: string = 'binance';
  private useTestnet: boolean = true; // Default to testnet for safety
  private readonly TESTNET_URLS = {
    'binance': {
      rest: 'https://testnet.binance.vision/api/',
      ws: 'wss://testnet.binance.vision/ws'
    },
    'bybit': {
      rest: 'https://api-testnet.bybit.com',
      ws: 'wss://stream-testnet.bybit.com'
    },
    'bitmart': {
      // BitMart doesn't have a separate testnet, using production API with test credentials
      rest: 'https://api-cloud.bitmart.com',
      ws: 'wss://ws-manager-compress.bitmart.com/api?protocol=1.1'
    },
    'bitget': {
      rest: 'https://api.bitget-simulated.com',
      ws: 'wss://ws.bitget-simulated.com/mix/v1/stream'
    },
    'okx': {
      // OKX demo trading API
      rest: 'https://www.okx.com/api/v5/mock-trading',
      ws: 'wss://wspap.okx.com:8443/ws/v5/public'
    },
    'coinbase': {
      rest: 'https://api-public.sandbox.exchange.coinbase.com',
      ws: 'wss://ws-feed-public.sandbox.exchange.coinbase.com'
    },
    'kraken': {
      // Kraken doesn't have a public testnet, using production API with test credentials
      rest: 'https://api.kraken.com',
      ws: 'wss://ws.kraken.com'
    }
  };

  constructor() {
    super();
  }

  async initialize(options: { exchangeId?: string, useTestnet?: boolean } = {}): Promise<void> {
    try {
      if (this.initialized) return;

      // Set options
      if (options.exchangeId) this.defaultExchange = options.exchangeId;
      if (options.useTestnet !== undefined) this.useTestnet = options.useTestnet;

      // Initialize default exchange
      await this.getExchange(this.defaultExchange, this.useTestnet);

      this.initialized = true;
      logService.log('info', `CCXT service initialized with ${this.defaultExchange} exchange`, { useTestnet: this.useTestnet }, 'CCXTService');
    } catch (error) {
      logService.log('error', 'Failed to initialize CCXT service', error, 'CCXTService');
      throw error;
    }
  }

  async createExchange(exchangeId: string, credentials?: any, useTestnet: boolean = false): Promise<any> {
    try {
      // Log the exchange creation attempt
      logService.log('info', `Creating exchange instance for ${exchangeId}`, {
        hasCredentials: !!credentials,
        useTestnet
      }, 'CCXTService');

      const config: any = {
        enableRateLimit: true,
        timeout: 45000, // Increase timeout to 45 seconds for better reliability
        verbose: false, // Disable verbose mode in production
        // Add proxy support for all exchanges
        proxy: `${window.location.protocol}//${window.location.host}/api/${exchangeId.toLowerCase()}`,
      };

      // Configure TestNet URLs if needed
      if (useTestnet) {
        // Check if we have TestNet URLs for this exchange
        if (this.TESTNET_URLS[exchangeId]) {
          config.urls = {
            api: this.TESTNET_URLS[exchangeId]?.rest,
            ws: this.TESTNET_URLS[exchangeId]?.ws
          };

          logService.log('info', `Using TestNet URLs for ${exchangeId}`, {
            rest: this.TESTNET_URLS[exchangeId]?.rest,
            ws: this.TESTNET_URLS[exchangeId]?.ws
          }, 'CCXTService');
        } else {
          logService.log('warn', `No TestNet URLs found for ${exchangeId}, using production URLs`, null, 'CCXTService');
        }
      }

      // Add credentials if provided
      if (credentials?.apiKey) {
        config.apiKey = credentials.apiKey;
        config.secret = credentials.secret;

        // Add passphrase/memo for exchanges that require it
        if (credentials.memo) {
          // Handle exchange-specific credential formats
          if (exchangeId === 'okx' || exchangeId === 'bitget') {
            config.password = credentials.memo;
            logService.log('info', `Added password for ${exchangeId}`, null, 'CCXTService');
          } else if (exchangeId === 'kucoin') {
            config.password = credentials.memo;
            logService.log('info', `Added password for ${exchangeId}`, null, 'CCXTService');
          } else if (exchangeId === 'coinbase') {
            config.password = credentials.memo;
            logService.log('info', `Added password for ${exchangeId}`, null, 'CCXTService');
          } else if (exchangeId === 'kraken') {
            // Kraken doesn't use a password/memo field in CCXT
            logService.log('info', `Memo provided for Kraken but not used in CCXT config`, null, 'CCXTService');
          } else {
            config.memo = credentials.memo;
            logService.log('info', `Added memo for ${exchangeId}`, null, 'CCXTService');
          }
        }
      }

      // Exchange-specific configurations
      if (exchangeId === 'kraken') {
        // Kraken specific settings
        config.options = {
          ...config.options,
          // Add Kraken-specific options
          createMarketBuyOrderRequiresPrice: true,
          createMarketOrderRequiresPrice: true,
          fetchTradingFeesBySymbol: false,
          fetchOrderBooks: true,
          fetchOHLCVWarning: false,
          fetchTickersMaxSymbols: 60,
          // Add a custom user agent
          'headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          // Add additional Kraken-specific options to improve reliability
          'recvWindow': 60000, // Longer receive window
          'adjustForTimeDifference': true, // Adjust for time difference
          'verbose': true, // Enable verbose mode for better debugging
          'enableRateLimit': true, // Enable rate limiting
          'retry': {
            'enabled': true,
            'maxRetries': 5
          }
        };

        // Increase timeout for Kraken
        config.timeout = 90000; // 90 seconds (increased from 60)

        // Add proxy configuration for Kraken
        config.proxy = 'http://localhost:3001/api/kraken/';
      } else if (exchangeId === 'binance') {
        // Binance specific settings
        config.options = {
          ...config.options,
          createMarketBuyOrderRequiresPrice: false,
          fetchTradingFeesBySymbol: true,
          recvWindow: 30000,
          adjustForTimeDifference: true,
          verbose: true,
          retry: {
            enabled: true,
            maxRetries: 3
          }
        };
      } else if (exchangeId === 'bybit') {
        // ByBit specific settings
        config.options = {
          ...config.options,
          recvWindow: 20000,
          adjustForTimeDifference: true,
          verbose: true,
          retry: {
            enabled: true,
            maxRetries: 3
          }
        };
      } else if (exchangeId === 'bitmart') {
        // BitMart specific settings
        config.options = {
          ...config.options,
          recvWindow: 20000,
          verbose: true,
          retry: {
            enabled: true,
            maxRetries: 3
          }
        };
      } else if (exchangeId === 'bitget') {
        // Bitget specific settings
        config.options = {
          ...config.options,
          recvWindow: 20000,
          verbose: true,
          retry: {
            enabled: true,
            maxRetries: 3
          }
        };
      } else if (exchangeId === 'okx') {
        // OKX specific settings
        config.options = {
          ...config.options,
          recvWindow: 20000,
          verbose: true,
          retry: {
            enabled: true,
            maxRetries: 3
          }
        };
      } else if (exchangeId === 'coinbase') {
        // Coinbase specific settings
        config.options = {
          ...config.options,
          createMarketBuyOrderRequiresPrice: true,
          recvWindow: 30000,
          verbose: true,
          retry: {
            enabled: true,
            maxRetries: 3
          }
        };
      }

      // Exchange-specific configurations
      if (exchangeId === 'kraken') {
        // Kraken specific settings
        config.rateLimit = 3000; // Kraken has stricter rate limits

        // Add additional Kraken-specific options
        config.options = {
          ...config.options,
          // Ensure we're using the correct API version
          version: '0',
          // Add additional Kraken-specific options
          exchangeType: 'spot',
          adjustForTimeDifference: true
        };
      } else if (exchangeId === 'binance') {
        // Binance specific settings
        config.options = {
          ...config.options,
          adjustForTimeDifference: true,
          recvWindow: 60000, // Increase receive window for Binance
          defaultType: useTestnet ? 'spot' : 'spot', // Default to spot market
          warnOnFetchOpenOrdersWithoutSymbol: false,
        };
      } else if (exchangeId === 'bybit') {
        // Bybit specific settings
        config.options = {
          ...config.options,
          defaultType: 'spot',
          recvWindow: 60000,
        };
      } else if (exchangeId === 'bitmart') {
        // BitMart specific settings
        config.options = {
          ...config.options,
          recvWindow: 60000,
        };
      } else if (exchangeId === 'okx') {
        // OKX specific settings
        config.options = {
          ...config.options,
          adjustForTimeDifference: true,
        };
      } else if (exchangeId === 'coinbase') {
        // Coinbase specific settings
        config.options = {
          ...config.options,
          adjustForTimeDifference: true,
        };
      }

      // Log the final configuration (without sensitive data)
      const configForLogging = { ...config };
      delete configForLogging.apiKey;
      delete configForLogging.secret;
      delete configForLogging.password;
      logService.log('info', `Exchange configuration for ${exchangeId}`, configForLogging, 'CCXTService');

      try {
        // Use our browser-compatible exchange wrapper
        const exchange = new ccxt[exchangeId](config);

        // Set up proper error handling
        exchange.verbose = false; // Disable verbose mode in production

        // Log successful creation
        logService.log('info', `Successfully created ${exchangeId} exchange instance`, {
          hasApiKey: !!credentials?.apiKey,
          hasSecret: !!credentials?.secret,
          testnet: useTestnet
        }, 'CCXTService');

        return exchange;
      } catch (createError) {
        logService.log('error', `Failed to create ${exchangeId} exchange instance`, createError, 'CCXTService');
        throw new Error(`Failed to create ${exchangeId} exchange instance: ${createError instanceof Error ? createError.message : 'Unknown error'}`);
      }
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

  async fetchTicker(symbol: string, exchangeId?: string): Promise<any> {
    try {
      // Ensure service is initialized
      if (!this.initialized) {
        await this.initialize();
      }

      const exchange = await this.getExchange(exchangeId || this.defaultExchange, this.useTestnet);

      // Format symbol if needed (some exchanges use different formats)
      const formattedSymbol = symbol.includes('/') ? symbol : symbol.replace('_', '/');

      // Try to fetch real ticker data
      try {
        const ticker = await exchange.fetchTicker(formattedSymbol);

        // Add percentage change if not provided
        if (ticker && !ticker.percentage && ticker.open && ticker.last) {
          ticker.percentage = ((ticker.last - ticker.open) / ticker.open) * 100;
        }

        return ticker;
      } catch (exchangeError) {
        logService.log('warn', `Failed to fetch ticker from exchange for ${symbol}`, exchangeError, 'CCXTService');

        // Fall back to demo data
        const demoTicker = demoService.generateTickerData(formattedSymbol);
        return demoTicker;
      }
    } catch (error) {
      logService.log('error', `Error in fetchTicker for ${symbol}`, error, 'CCXTService');
      throw error;
    }
  }

  async fetchTickers(symbols: string[], exchangeId?: string): Promise<Record<string, any>> {
    try {
      // Ensure service is initialized
      if (!this.initialized) {
        await this.initialize();
      }

      const exchange = await this.getExchange(exchangeId || this.defaultExchange, this.useTestnet);

      // Format symbols if needed
      const formattedSymbols = symbols.map(s => s.includes('/') ? s : s.replace('_', '/'));

      // Try to fetch real ticker data
      try {
        const tickers = await exchange.fetchTickers(formattedSymbols);
        return tickers;
      } catch (exchangeError) {
        logService.log('warn', 'Failed to fetch tickers from exchange', exchangeError, 'CCXTService');

        // Fall back to demo data
        const demoTickers: Record<string, any> = {};
        for (const symbol of formattedSymbols) {
          demoTickers[symbol] = demoService.generateTickerData(symbol);
        }
        return demoTickers;
      }
    } catch (error) {
      logService.log('error', 'Error in fetchTickers', error, 'CCXTService');
      throw error;
    }
  }
}

export const ccxtService = new CCXTService();
