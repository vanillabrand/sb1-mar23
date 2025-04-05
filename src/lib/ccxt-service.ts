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

      // Log the credentials being used (without the actual values for security)
      logService.log('info', `Creating exchange with credentials`, {
        exchangeId,
        testnet,
        hasApiKey: !!credentials.apiKey,
        hasSecret: !!credentials.secret,
        apiKeyLength: credentials.apiKey ? credentials.apiKey.length : 0,
        secretLength: credentials.secret ? credentials.secret.length : 0
      }, 'CCXTService');

      console.log(`Creating exchange ${exchangeId} with credentials: API Key ${credentials.apiKey ? 'present' : 'missing'}, Secret ${credentials.secret ? 'present' : 'missing'}`);

      const config: any = {
        apiKey: credentials.apiKey,
        secret: credentials.secret,
        enableRateLimit: true,
        timeout: 30000,
        recvWindow: 10000, // Increase receive window for Binance
      };

      // Get the proxy base URL
      const proxyBaseUrl = import.meta.env.VITE_PROXY_BASE_URL || 'http://localhost:3001';

      // Configure URLs based on exchange and testnet mode
      switch (exchangeId) {
        case 'binance':
          if (testnet) {
            // Binance TestNet
            config.urls = {
              api: {
                public: `${proxyBaseUrl}/api/binanceTestnet`,
                private: `${proxyBaseUrl}/api/binanceTestnet`,
                fapiPublic: `${proxyBaseUrl}/api/binanceFutures`,
                fapiPrivate: `${proxyBaseUrl}/api/binanceFutures`,
                fapiV2Public: `${proxyBaseUrl}/api/binanceFutures`,
                fapiV2Private: `${proxyBaseUrl}/api/binanceFutures`,
                dapiPublic: `${proxyBaseUrl}/api/binanceFutures`,
                dapiPrivate: `${proxyBaseUrl}/api/binanceFutures`
              }
            };
            console.log('Using custom URLs for Binance TestNet:', config.urls);
          } else {
            // Regular Binance
            config.urls = {
              api: {
                public: `${proxyBaseUrl}/api/binance`,
                private: `${proxyBaseUrl}/api/binance`,
                fapiPublic: `${proxyBaseUrl}/api/binance`,
                fapiPrivate: `${proxyBaseUrl}/api/binance`,
                fapiV2Public: `${proxyBaseUrl}/api/binance`,
                fapiV2Private: `${proxyBaseUrl}/api/binance`,
                dapiPublic: `${proxyBaseUrl}/api/binance`,
                dapiPrivate: `${proxyBaseUrl}/api/binance`
              }
            };
            console.log('Using custom URLs for Binance:', config.urls);
          }
          break;

        case 'bitmart':
          // BitMart
          config.urls = {
            api: {
              public: `${proxyBaseUrl}/api/bitmart`,
              private: `${proxyBaseUrl}/api/bitmart`
            }
          };
          console.log('Using custom URLs for BitMart:', config.urls);
          break;

        case 'bybit':
          if (testnet) {
            config.urls = {
              api: {
                public: `${proxyBaseUrl}/api/bybitTestnet`,
                private: `${proxyBaseUrl}/api/bybitTestnet`
              }
            };
            console.log('Using custom URLs for Bybit TestNet:', config.urls);
          } else {
            config.urls = {
              api: {
                public: `${proxyBaseUrl}/api/bybit`,
                private: `${proxyBaseUrl}/api/bybit`
              }
            };
            console.log('Using custom URLs for Bybit:', config.urls);
          }
          break;

        case 'okx':
          if (testnet) {
            config.urls = {
              api: {
                public: `${proxyBaseUrl}/api/okxTestnet`,
                private: `${proxyBaseUrl}/api/okxTestnet`
              }
            };
            console.log('Using custom URLs for OKX TestNet:', config.urls);
          } else {
            config.urls = {
              api: {
                public: `${proxyBaseUrl}/api/okx`,
                private: `${proxyBaseUrl}/api/okx`
              }
            };
            console.log('Using custom URLs for OKX:', config.urls);
          }
          break;

        case 'coinbase':
          if (testnet) {
            config.urls = {
              api: {
                public: `${proxyBaseUrl}/api/coinbaseSandbox`,
                private: `${proxyBaseUrl}/api/coinbaseSandbox`
              }
            };
            console.log('Using custom URLs for Coinbase Sandbox:', config.urls);
          } else {
            config.urls = {
              api: {
                public: `${proxyBaseUrl}/api/coinbase`,
                private: `${proxyBaseUrl}/api/coinbase`
              }
            };
            console.log('Using custom URLs for Coinbase:', config.urls);
          }
          break;

        case 'kraken':
          if (testnet) {
            config.urls = {
              api: {
                public: `${proxyBaseUrl}/api/krakenFutures`,
                private: `${proxyBaseUrl}/api/krakenFutures`
              }
            };
            console.log('Using custom URLs for Kraken Futures:', config.urls);
          } else {
            config.urls = {
              api: {
                public: `${proxyBaseUrl}/api/kraken`,
                private: `${proxyBaseUrl}/api/kraken`
              }
            };
            console.log('Using custom URLs for Kraken:', config.urls);
          }
          break;

        case 'bitget':
          config.urls = {
            api: {
              public: `${proxyBaseUrl}/api/bitget`,
              private: `${proxyBaseUrl}/api/bitget`
            }
          };
          console.log('Using custom URLs for Bitget:', config.urls);
          break;

        default:
          // Other exchanges - use our generic exchange proxy
          config.urls = {
            api: {
              public: `${proxyBaseUrl}/api/${exchangeId}`,
              private: `${proxyBaseUrl}/api/${exchangeId}`
            }
          };
          console.log(`Using generic exchange proxy for ${exchangeId}:`, config.urls);
          break;
      }

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

        // For Binance TestNet, we need to ensure all requests go through our proxy
        // by setting the correct URLs and headers
        if (exchangeId === 'binance') {
          // Set the correct URLs for Binance TestNet
          const testnetBaseUrl = `${proxyBaseUrl}/api/binanceTestnet`;
          console.log('Setting Binance TestNet base URL:', testnetBaseUrl);

          // Override the URLs to use our proxy
          exchange.urls = {
            ...exchange.urls,
            api: {
              public: testnetBaseUrl,
              private: testnetBaseUrl,
              v1: testnetBaseUrl,
              v2: testnetBaseUrl,
              v3: testnetBaseUrl,
              fapiPublic: testnetBaseUrl,  // Add futures API endpoints
              fapiPrivate: testnetBaseUrl,
              fapiPrivateV2: testnetBaseUrl,
              dapiPublic: testnetBaseUrl,  // Add delivery API endpoints
              dapiPrivate: testnetBaseUrl,
            },
            test: {
              public: testnetBaseUrl,
              private: testnetBaseUrl,
            },
          };

          // Override the default API endpoints
          exchange.options = {
            ...exchange.options,
            defaultType: 'spot',
            adjustForTimeDifference: true,
            recvWindow: 10000,
            verbose: true, // Enable verbose mode for debugging
          };

          // Log the updated URLs
          console.log('Updated exchange URLs:', exchange.urls);

          // Override the defaultHeaders to ensure API key is sent correctly
          exchange.headers = {
            ...exchange.headers,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          };

          // Override the sign method to ensure API key is sent through our proxy
          const originalSign = exchange.sign.bind(exchange);
          exchange.sign = function(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
            try {
              // Handle specific endpoints that are not supported in TestNet
              if (testnet && (api === 'fapiPublic' || api === 'dapiPublic')) {
                // Redirect to the public API instead
                api = 'public';
                logService.log('info', `Redirecting ${api} request to public API in TestNet mode`, { path }, 'CCXTService');
              }

              // Ensure we have headers
              headers = headers || {};

              // Add the API key to the headers
              if (credentials.apiKey) {
                headers['X-MBX-APIKEY'] = credentials.apiKey;
                console.log(`Setting X-MBX-APIKEY header in sign method: ${credentials.apiKey.substring(0, 5)}...`);
              } else {
                // If no API key in credentials, try to use the one from the environment
                const envApiKey = import.meta.env.VITE_BINANCE_TESTNET_API_KEY || '6dbf9bc5b8e03455128d00bab9ccaffb33fa812bfcf0b21bcb50cff355a88049';
                if (envApiKey) {
                  headers['X-MBX-APIKEY'] = envApiKey;
                  console.log(`Using API key from environment in sign method: ${envApiKey.substring(0, 5)}...`);
                } else {
                  console.warn('No API key found in credentials or environment variables');
                }
              }

              // Call the original sign method
              const result = originalSign(path, api, method, params, headers, body);

              // Ensure the X-MBX-APIKEY header is set correctly in the result
              if (result.headers) {
                if (credentials.apiKey) {
                  result.headers['X-MBX-APIKEY'] = credentials.apiKey;
                  console.log(`Setting X-MBX-APIKEY header in result: ${credentials.apiKey.substring(0, 5)}...`);
                } else {
                  // If no API key in credentials, try to use the one from the environment
                  const envApiKey = import.meta.env.VITE_BINANCE_TESTNET_API_KEY || '6dbf9bc5b8e03455128d00bab9ccaffb33fa812bfcf0b21bcb50cff355a88049';
                  if (envApiKey) {
                    result.headers['X-MBX-APIKEY'] = envApiKey;
                    console.log(`Using API key from environment in result: ${envApiKey.substring(0, 5)}...`);
                  }
                }
              }

              // Log the request for debugging
              console.log('Binance TestNet request:', {
                path: path,
                api: api,
                url: result.url,
                method: result.method,
                params: params,
                headers: result.headers ? { ...result.headers, 'X-MBX-APIKEY': '***' } : undefined,
                body: result.body
              });

              return result;
            } catch (error) {
              console.error('Error in sign method:', error);

              // If the error is about unsupported TestNet endpoints, redirect to public API
              if (error.message && error.message.includes('does not have a testnet/sandbox URL')) {
                logService.log('warn', 'Endpoint not supported in TestNet, redirecting to public API', { path, api }, 'CCXTService');

                // Try again with the public API
                return this.sign(path, 'public', method, params, headers, body);
              }

              // Create a default result if the original sign method fails
              const url = typeof exchange.urls.api === 'string'
                ? `${exchange.urls.api}${path}`
                : `${exchange.urls.api.public}${path}`;

              return {
                url,
                method,
                headers: {
                  ...headers,
                  'X-MBX-APIKEY': credentials.apiKey
                },
                body
              };
            }
          };

          logService.log('info', 'Using custom URLs for Binance TestNet', { urls: exchange.urls }, 'CCXTService');
        }
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

export const ccxtService = CCXTService.getInstance();
