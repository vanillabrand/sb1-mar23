import { backOff } from 'exponential-backoff';
import * as ccxt from 'ccxt';
import { logService } from './log-service';
import { EventEmitter } from './event-emitter';
import type { ExchangeConfig } from './types';

class CCXTService extends EventEmitter {
  private static instance: CCXTService;
  private exchange: ccxt.Exchange | null = null;
  private exchangeId: string | null = null;
  private demoMode = true;
  private readonly DEMO_EXCHANGE = 'bitmart';
  private readonly DEMO_CREDENTIALS = {
    apiKey: import.meta.env.VITE_DEMO_EXCHANGE_API_KEY,
    secret: import.meta.env.VITE_DEMO_EXCHANGE_SECRET,
    memo: import.meta.env.VITE_DEMO_EXCHANGE_MEMO
  };
  private readonly MAX_RETRIES = 3;
  private readonly MAX_CONCURRENT_REQUESTS = 10;
  private readonly RATE_LIMIT = 2000; // 2 seconds between requests
  private readonly BURST_LIMIT = 5;
  private readonly QUEUE_TIMEOUT = 30000;
  private tokenBucket = this.BURST_LIMIT;
  private lastRefill = Date.now();
  private lastRequestTime = 0;
  private requestQueue: Array<() => Promise<any>> = [];
  private processingQueue = false;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    // Cleanup stale requests every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupStaleRequests(), 300000);
  }

  static getInstance(): CCXTService {
    if (!CCXTService.instance) {
      CCXTService.instance = new CCXTService();
    }
    return CCXTService.instance;
  }

  private async processQueue() {
    if (this.processingQueue || this.requestQueue.length === 0) return;
    
    this.processingQueue = true;
    
    while (this.requestQueue.length > 0) {
      await this.refillTokenBucket();
      
      if (this.tokenBucket <= 0) {
        await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT));
        continue;
      }

      const request = this.requestQueue.shift();
      if (!request) continue;

      try {
        this.tokenBucket--;
        await Promise.race([
          request(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), this.QUEUE_TIMEOUT)
          )
        ]);
      } catch (error) {
        logService.log('error', 'Error processing queued request', error, 'CCXTService');
      }
    }
    
    this.processingQueue = false;
  }

  private async refillTokenBucket() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.RATE_LIMIT);
    
    if (tokensToAdd > 0) {
      this.tokenBucket = Math.min(this.BURST_LIMIT, this.tokenBucket + tokensToAdd);
      this.lastRefill = now;
    }
  }

  private async queueRequest<T>(operation: () => Promise<T>): Promise<T> {
    // Remove completed requests from queue
    this.requestQueue = this.requestQueue.filter(p => p.isPending?.());
    
    if (this.requestQueue.length >= this.MAX_CONCURRENT_REQUESTS) {
      await Promise.race(this.requestQueue);
    }

    const request = operation();
    this.requestQueue.push(request);
    return request;
  }

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    return backOff(async () => {
      return this.queueRequest(async () => {
        try {
          return await operation();
        } catch (error) {
          if (error instanceof ccxt.RateLimitExceeded) {
            logService.log('warn', 'Rate limit exceeded, retrying...', error, 'CCXTService');
            throw error; // Allow backoff to retry
          }
          if (error instanceof ccxt.NetworkError) {
            logService.log('warn', 'Network error, retrying...', error, 'CCXTService');
            throw error; // Allow backoff to retry
          }
          throw error; // Other errors should not be retried
        }
      });
    }, {
      numOfAttempts: this.MAX_RETRIES,
      startingDelay: 1000,
      timeMultiple: 2,
      maxDelay: 10000,
      jitter: 'full'
    });
  }

  private cleanupStaleRequests(): void {
    this.requestQueue = this.requestQueue.filter(p => p.isPending?.());
  }

  async initialize(config: ExchangeConfig): Promise<void> {
    try {
      // Determine if using demo mode
      this.demoMode = config.apiKey === 'demo';
      
      // Get exchange ID
      const exchangeId = config.name.toLowerCase();
      
      // Check if exchange is supported by CCXT
      if (!ccxt.exchanges.includes(exchangeId)) {
        throw new Error(`Exchange ${exchangeId} is not supported`);
      }

      // Create exchange instance
      const ExchangeClass = ccxt[exchangeId as keyof typeof ccxt];
      if (!ExchangeClass) {
        throw new Error(`Exchange ${exchangeId} not found in CCXT`);
      }

      // Configure exchange
      const exchangeConfig: any = {
        enableRateLimit: true,
        timeout: 30000,
        options: {
          defaultType: 'spot',
          createMarketBuyOrderRequiresPrice: false,
          warnOnFetchOpenOrdersWithoutSymbol: false,
          recvWindow: 60000,
          defaultTimeInForce: 'GTC',
          adjustForTimeDifference: false, // Disable time sync by default
          verbose: false,
          fetchImplementation: async (url: string, options = {}) => {
            try {
              const response = await fetch(url, options);
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response;
            } catch (error) {
              logService.log('error', `Fetch error for ${url}`, error, 'CCXTService');
              throw error;
            }
          }
        }
      };

      // Use demo credentials or provided credentials
      if (this.demoMode) {
        exchangeConfig.apiKey = this.DEMO_CREDENTIALS.apiKey;
        exchangeConfig.secret = this.DEMO_CREDENTIALS.secret;
        if (exchangeId === 'bitmart') {
          exchangeConfig.password = this.DEMO_CREDENTIALS.memo;
        }
      } else {
        exchangeConfig.apiKey = config.apiKey;
        exchangeConfig.secret = config.secret;
        if (config.memo) {
          exchangeConfig.password = config.memo;
        }
      }

      // Create exchange instance
      const ExchangeConstructor = ExchangeClass as typeof ccxt.Exchange;
      this.exchange = new (ExchangeConstructor as any)(exchangeConfig);
      this.exchangeId = exchangeId;

      // Configure testnet if available and requested
      if (config.testnet && this.exchange.urls['test']) {
        this.exchange.urls.api = this.exchange.urls.test;
      }

      // Load markets with retry, but skip in demo mode
      if (!this.demoMode) {
        try {
          await this.retryOperation(async () => {
            if (!this.exchange) throw new Error('Exchange not initialized');
            await (this.exchange as ccxt.Exchange).loadMarkets();
          });
        } catch (error) {
          logService.log('warn', 'Failed to load markets, falling back to demo mode', error, 'CCXTService');
          this.demoMode = true;
        }
      }

      logService.log('info', `Initialized CCXT for ${exchangeId} exchange in ${this.demoMode ? 'demo' : 'live'} mode`, null, 'CCXTService');
    } catch (error) {
      logService.log('error', 'Failed to initialize CCXT', error, 'CCXTService');
      // Fall back to demo mode on initialization error
      this.demoMode = true;
      throw error;
    }
  }

  async fetchTicker(symbol: string): Promise<any> {
    if (this.demoMode) {
      return this.generateDemoTicker(symbol);
    }

    try {
      if (!this.exchange) {
        throw new Error('Exchange not initialized');
      }

      // Normalize symbol format for CCXT
      const normalizedSymbol = symbol.replace('_', '/');
      
      // Fetch ticker with retry
      const ticker = await this.retryOperation(async () => {
        return this.exchange!.fetchTicker(normalizedSymbol);
      });

      return {
        symbol: symbol,
        last_price: ticker.last.toString(),
        quote_volume_24h: ticker.quoteVolume?.toString() || '0',
        base_volume_24h: ticker.baseVolume?.toString() || '0',
        high_24h: ticker.high?.toString() || '0',
        low_24h: ticker.low?.toString() || '0',
        open_24h: ticker.open?.toString() || '0',
        timestamp: ticker.timestamp
      };
    } catch (error) {
      logService.log('error', `Failed to fetch ticker for ${symbol}`, error, 'CCXTService');
      return this.generateDemoTicker(symbol);
    }
  }

  private generateDemoTicker(symbol: string): any {
    const basePrice = symbol.includes('BTC') ? 45000 :
                     symbol.includes('ETH') ? 3000 :
                     symbol.includes('SOL') ? 100 :
                     symbol.includes('BNB') ? 300 :
                     symbol.includes('XRP') ? 0.5 : 1;

    const lastPrice = basePrice * (1 + (Math.random() - 0.5) * 0.002);
    const open24h = basePrice * (1 + (Math.random() - 0.5) * 0.01);
    const high24h = Math.max(lastPrice, open24h) * (1 + Math.random() * 0.005);
    const low24h = Math.min(lastPrice, open24h) * (1 - Math.random() * 0.005);

    return {
      symbol,
      last_price: lastPrice.toFixed(2),
      quote_volume_24h: (Math.random() * 1000000 + 500000).toFixed(2),
      base_volume_24h: (Math.random() * 100 + 50).toFixed(2),
      high_24h: high24h.toFixed(2),
      low_24h: low24h.toFixed(2),
      open_24h: open24h.toFixed(2),
      timestamp: Date.now()
    };
  }

  async fetchBalance(type: 'spot' | 'margin' | 'futures' = 'spot'): Promise<any> {
    if (this.demoMode) {
      return this.generateDemoBalance(type);
    }

    try {
      if (!this.exchange) {
        throw new Error('Exchange not initialized');
      }

      // Set account type if supported
      if (this.exchange.has[type]) {
        await this.exchange.setMarginMode(type === 'margin');
      }

      // Fetch balance with retry
      const balance = await this.retryOperation(async () => {
        return this.exchange!.fetchBalance();
      });

      const total = balance.total?.USDT || 0;
      const free = balance.free?.USDT || 0;
      const used = balance.used?.USDT || 0;

      return {
        total,
        available: free,
        frozen: used
      };
    } catch (error) {
      logService.log('error', `Failed to fetch ${type} balance`, error, 'CCXTService');
      return this.generateDemoBalance(type);
    }
  }

  private generateDemoBalance(type: string): any {
    const baseAmount = type === 'spot' ? 50000 :
                      type === 'margin' ? 20000 :
                      30000;
    const variance = baseAmount * 0.2;
    const total = baseAmount + (Math.random() * variance);
    const frozen = total * (Math.random() * 0.2);

    return {
      total,
      available: total - frozen,
      frozen
    };
  }

  async createOrder(
    symbol: string,
    type: 'market' | 'limit',
    side: 'buy' | 'sell',
    amount: number,
    price?: number
  ): Promise<any> {
    if (this.demoMode) {
      return this.generateDemoOrder(symbol, type, side, amount, price);
    }

    try {
      if (!this.exchange) {
        throw new Error('Exchange not initialized');
      }

      // Normalize symbol format for CCXT
      const normalizedSymbol = symbol.replace('_', '/');

      // Create order with retry
      return await this.retryOperation(async () => {
        return this.exchange!.createOrder(normalizedSymbol, type, side, amount, price);
      });
    } catch (error) {
      logService.log('error', `Failed to create ${type} ${side} order for ${symbol}`, error, 'CCXTService');
      return this.generateDemoOrder(symbol, type, side, amount, price);
    }
  }

  private generateDemoOrder(
    symbol: string,
    type: string,
    side: string,
    amount: number,
    price?: number
  ): any {
    const orderId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    const marketPrice = price || parseFloat(this.generateDemoTicker(symbol).last_price);

    return {
      id: orderId,
      symbol: symbol,
      type: type,
      side: side,
      amount: amount,
      price: marketPrice,
      status: 'closed',
      filled: amount,
      remaining: 0,
      timestamp: timestamp,
      datetime: new Date(timestamp).toISOString(),
      fee: {
        cost: amount * marketPrice * 0.001,
        currency: symbol.split('_')[1]
      }
    };
  }

  getExchangeId(): string | null {
    return this.exchangeId;
  }

  isInitialized(): boolean {
    return this.exchange !== null;
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  cleanup(): void {
    clearInterval(this.cleanupInterval);
    this.requestQueue = [];
    this.processingQueue = false;
  }
}

export const ccxtService = CCXTService.getInstance();
