import ccxt from 'ccxt';
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
