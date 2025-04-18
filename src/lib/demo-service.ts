// Import ccxt directly to avoid circular dependency
import ccxt from 'ccxt';
import { logService } from './log-service';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';

/**
 * DemoService provides mock data and functionality for demo mode
 * It initializes the ccxtService with mock data to prevent errors
 */
class DemoService {
  private static instance: DemoService;
  private _isDemoMode: boolean = false;
  private mockExchangeId: string = 'binance';
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private readonly FAST_INIT = true; // Enable fast initialization

  private constructor() {
    // Set demo mode to true immediately to prevent initialization issues
    this._isDemoMode = true;

    // Override CCXT methods immediately to ensure mock data is available
    this.overrideCcxtMethods();

    // Check if we should use fast initialization
    if (this.FAST_INIT || config.DEMO_MODE) {
      // Mark as initialized immediately
      this.isInitialized = true;

      // Schedule full initialization for later
      setTimeout(() => {
        this.initializeDemoMode().catch(error => {
          logService.log('error', 'Failed to initialize demo mode', error, 'DemoService');
        });
      }, 2000); // Delay full initialization by 2 seconds
    } else {
      // Initialize demo mode asynchronously but sooner
      setTimeout(() => {
        this.initializeDemoMode().catch(error => {
          logService.log('error', 'Failed to initialize demo mode', error, 'DemoService');
        });
      }, 0);
    }
  }

  static getInstance(): DemoService {
    if (!DemoService.instance) {
      DemoService.instance = new DemoService();
    }
    return DemoService.instance;
  }

  /**
   * Initialize demo mode by setting up mock exchange
   */
  private async initializeDemoMode(): Promise<void> {
    // If already initialized or initialization is in progress, return the existing promise
    if (this.isInitialized && !this.FAST_INIT) {
      logService.log('info', 'Demo mode already initialized', null, 'DemoService');
      return;
    }

    if (this.initializationPromise) {
      logService.log('info', 'Demo mode initialization already in progress', null, 'DemoService');
      return this.initializationPromise;
    }

    // Create a new initialization promise
    this.initializationPromise = this._initializeDemoMode();

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Internal implementation of demo mode initialization
   */
  private async _initializeDemoMode(): Promise<void> {
    try {
      // Override the executeWithRetry method to provide mock data first
      // This ensures we have mock data even if exchange initialization fails
      // Note: We already do this in the constructor for faster startup

      // Skip exchange initialization to avoid circular dependency issues
      logService.log('info', 'Skipping exchange initialization to avoid circular dependency', null, 'DemoService');

      // Initialize BitMart service in demo mode - do this in the background
      setTimeout(async () => {
        try {
          // Import the BitMart service
          const { bitmartService } = await import('./bitmart-service');

          // Initialize BitMart service with demo mode
          await bitmartService.initialize({
            apiKey: 'demo-api-key',
            secret: 'demo-secret',
            memo: '',
            testnet: true
          });

          logService.log('info', 'BitMart service initialized in demo mode', null, 'DemoService');
        } catch (bitmartError) {
          logService.log('warn', 'Failed to initialize BitMart service in demo mode', bitmartError, 'DemoService');
        }
      }, 1000); // Delay BitMart initialization by 1 second

      // Ensure demo mode is set to true and mark as initialized
      this._isDemoMode = true;
      this.isInitialized = true;
    } catch (error) {
      // If anything fails, ensure demo mode is still set to true
      this._isDemoMode = true;
      this.isInitialized = true; // Mark as initialized anyway to prevent further attempts
      logService.log('error', 'Error in demo mode initialization, but continuing with basic mock data', error, 'DemoService');
    }
  }

  /**
   * Override ccxt methods to provide mock data
   * Note: We're not directly modifying ccxtService to avoid circular dependencies
   */
  private overrideCcxtMethods(): void {
    // In the new implementation, we don't need to override methods here
    // This is now handled in ccxt-service.ts
    logService.log('info', 'CCXT methods will be handled by ccxt-service.ts', null, 'DemoService');
  }

  /**
   * Generate mock market data
   */
  private getMockMarketData(operationName: string): any {
    const now = Date.now();
    const basePrice = 50000 + Math.random() * 1000;

    return {
      timestamp: now,
      symbol: 'BTC/USDT',
      price: basePrice,
      volume: 100 + Math.random() * 50,
      high24h: basePrice * 1.05,
      low24h: basePrice * 0.95,
      orderBook: {
        asks: Array.from({ length: 10 }, (_, i) => [basePrice + (i * 10), 1 - (i * 0.05)]),
        bids: Array.from({ length: 10 }, (_, i) => [basePrice - (i * 10), 1 - (i * 0.05)]),
      },
      recentTrades: Array.from({ length: 20 }, (_, i) => ({
        id: `${uuidv4()}-${Date.now()}-${i}`,
        timestamp: now - (i * 60000),
        price: basePrice + (Math.random() * 200 - 100),
        amount: Math.random() * 2,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
      })),
    };
  }

  /**
   * Check if demo mode is active
   */
  isInDemoMode(): boolean {
    return this._isDemoMode;
  }

  /**
   * Check if demo mode is enabled (alias for isInDemoMode for compatibility)
   */
  isDemoMode(): boolean {
    return this._isDemoMode;
  }

  /**
   * Get the TestNet exchange instance for demo mode
   */
  async getTestNetExchange(): Promise<any> {
    try {
      const apiKey = import.meta.env.VITE_DEMO_EXCHANGE_API_KEY || import.meta.env.VITE_BINANCE_TESTNET_API_KEY || 'demo-api-key';
      const secret = import.meta.env.VITE_DEMO_EXCHANGE_SECRET || import.meta.env.VITE_BINANCE_TESTNET_API_SECRET || 'demo-secret';

      logService.log('info', 'Getting TestNet exchange with credentials', {
        hasApiKey: !!apiKey,
        hasSecret: !!secret,
        apiKeyLength: apiKey ? apiKey.length : 0,
        secretLength: secret ? secret.length : 0
      }, 'DemoService');

      // Create exchange directly using ccxt
      const config: any = {
        enableRateLimit: true,
        timeout: 30000,
        apiKey,
        secret,
        urls: {
          api: 'https://testnet.binance.vision/api/',
          ws: 'wss://testnet.binance.vision/ws'
        }
      };

      // Create the exchange instance directly
      const exchange = new ccxt.binance(config);
      exchange.verbose = true; // Enable detailed error logging

      return exchange;
    } catch (error) {
      logService.log('error', 'Failed to get TestNet exchange instance', error, 'DemoService');
      throw error;
    }
  }

  /**
   * Generate synthetic trade data for demo mode
   */
  generateSyntheticTrade(strategyId: string, symbol: string = 'BTC/USDT'): any {
    const now = Date.now();
    const basePrice = 50000 + Math.random() * 1000;
    const isBuy = Math.random() > 0.5;

    return {
      id: `${uuidv4()}-${now}-${Math.random().toString(36).substring(2, 9)}`,
      strategy_id: strategyId,
      symbol: symbol,
      side: isBuy ? 'buy' : 'sell',
      type: 'market',
      amount: Math.random() * 0.1,
      price: basePrice,
      cost: basePrice * (Math.random() * 0.1),
      fee: {
        cost: basePrice * 0.001,
        currency: 'USDT',
      },
      timestamp: now,
      datetime: new Date(now).toISOString(),
      status: 'closed',
    };
  }

  /**
   * Generate ticker data for a symbol
   */
  generateTickerData(symbol: string): any {
    const now = Date.now();
    let basePrice = 0;

    // Set realistic base prices for common symbols
    if (symbol.includes('BTC')) basePrice = 50000 + Math.random() * 5000;
    else if (symbol.includes('ETH')) basePrice = 3000 + Math.random() * 300;
    else if (symbol.includes('SOL')) basePrice = 100 + Math.random() * 20;
    else if (symbol.includes('BNB')) basePrice = 400 + Math.random() * 40;
    else if (symbol.includes('XRP')) basePrice = 0.5 + Math.random() * 0.1;
    else if (symbol.includes('ADA')) basePrice = 0.4 + Math.random() * 0.05;
    else if (symbol.includes('DOGE')) basePrice = 0.1 + Math.random() * 0.02;
    else if (symbol.includes('MATIC')) basePrice = 0.8 + Math.random() * 0.1;
    else if (symbol.includes('DOT')) basePrice = 6 + Math.random() * 1;
    else if (symbol.includes('LINK')) basePrice = 15 + Math.random() * 2;
    else basePrice = 10 + Math.random() * 5; // Default for other assets

    // Generate realistic price variations
    const open = basePrice * (1 - (Math.random() * 0.05));
    const high = basePrice * (1 + (Math.random() * 0.03));
    const low = basePrice * (1 - (Math.random() * 0.03));
    const close = basePrice;
    const volume = basePrice * 1000 * (Math.random() + 0.5);
    const percentage = ((close - open) / open) * 100;

    return {
      symbol: symbol,
      timestamp: now,
      datetime: new Date(now).toISOString(),
      high: high,
      low: low,
      bid: basePrice * 0.999,
      ask: basePrice * 1.001,
      last: basePrice,
      open: open,
      close: close,
      volume: volume,
      change: close - open,
      percentage: percentage,
      average: (open + close) / 2,
      info: {
        symbol: symbol.replace('/', ''),
        priceChange: (close - open).toFixed(8),
        priceChangePercent: percentage.toFixed(2),
        weightedAvgPrice: ((open + close) / 2).toFixed(8),
        prevClosePrice: open.toFixed(8),
        lastPrice: close.toFixed(8),
        lastQty: (Math.random() * 10).toFixed(8),
        bidPrice: (basePrice * 0.999).toFixed(8),
        bidQty: (Math.random() * 10).toFixed(8),
        askPrice: (basePrice * 1.001).toFixed(8),
        askQty: (Math.random() * 10).toFixed(8),
        openPrice: open.toFixed(8),
        highPrice: high.toFixed(8),
        lowPrice: low.toFixed(8),
        volume: volume.toFixed(8),
        quoteVolume: (volume * basePrice).toFixed(8),
        openTime: now - 86400000,
        closeTime: now,
        firstId: 1,
        lastId: 1000,
        count: 1000
      }
    };
  }
}

export const demoService = DemoService.getInstance();
