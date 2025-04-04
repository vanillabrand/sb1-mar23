import CryptoJS from 'crypto-js';
import { websocketService } from './websocket-service';
import { EventEmitter } from './event-emitter';
import { logService } from './log-service';

interface BitmartConfig {
  apiKey: string;
  secret: string;
  memo: string;
  testnet?: boolean;
  useUSDX?: boolean;
}

interface BitmartTicker {
  symbol: string;
  last_price: string;
  quote_volume_24h: string;
  base_volume_24h: string;
  high_24h: string;
  low_24h: string;
  open_24h: string;
  timestamp: number;
}

interface BitmartKline {
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface BitmartBalance {
  total: number;
  available: number;
  frozen: number;
}

interface AssetData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: number;
  priceHistory: { timestamp: number; price: number }[];
}

interface TradingPair {
  symbol: string;
  volume24h: number;
  change24h: number;
  price: number;
  popularity: number;
}

class BitmartService extends EventEmitter {
  private static instance: BitmartService;
  private config: BitmartConfig | null = null;
  // Change this to use the proxy URL instead of direct BitMart API
  private baseUrl = '/api/bitmart'; // Changed from 'https://api-cloud.bitmart.com'
  private demoMode = false;
  private useUSDX = false;
  private serverTimeOffset = 0;
  private assetData = new Map<string, AssetData>();
  private tradingPairs = new Map<string, TradingPair>();
  private subscriptions = new Set<string>();
  private initialized = false;
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 5000; // 5 seconds
  private readonly DEFAULT_ASSETS = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT', 'XRP_USDT'];
  private readonly HISTORY_POINTS = 60; // Keep 60 points for 1 hour of data
  private readonly HISTORY_INTERVAL = 60000; // 1 minute intervals

  private constructor() {
    super();
    this.setupWebSocket();
  }

  static getInstance(): BitmartService {
    if (!BitmartService.instance) {
      BitmartService.instance = new BitmartService();
    }
    return BitmartService.instance;
  }

  private setupWebSocket(): void {
    websocketService.on('ticker', (data) => {
      if (!data || !data.symbol) return;

      const price = parseFloat(data.last_price);
      if (isNaN(price)) return;

      const open24h = parseFloat(data.open_24h || '0');
      const change24h = open24h ? ((price - open24h) / open24h) * 100 : 0;
      const volume24h = parseFloat(data.quote_volume_24h || '0');
      const high24h = parseFloat(data.high_24h || price);
      const low24h = parseFloat(data.low_24h || price);
      const now = Date.now();

      // Get existing data or create new
      const existingData = this.assetData.get(data.symbol) || {
        symbol: data.symbol,
        price: 0,
        change24h: 0,
        volume24h: 0,
        high24h: 0,
        low24h: 0,
        lastUpdate: 0,
        priceHistory: []
      };

      // Update price history
      const newHistory = [...existingData.priceHistory];

      // Remove data points older than 1 hour
      const hourAgo = now - 3600000;
      while (newHistory.length > 0 && newHistory[0].timestamp < hourAgo) {
        newHistory.shift();
      }

      // Add new price point if enough time has passed
      if (newHistory.length === 0 || now - newHistory[newHistory.length - 1].timestamp >= this.HISTORY_INTERVAL) {
        newHistory.push({ timestamp: now, price });
      }

      // Update asset data
      const assetData: AssetData = {
        symbol: data.symbol,
        price,
        change24h,
        volume24h,
        high24h,
        low24h,
        lastUpdate: now,
        priceHistory: newHistory
      };

      this.assetData.set(data.symbol, assetData);
      this.emit('priceUpdate', assetData);
    });
  }

  getAssetData(symbol: string): AssetData | undefined {
    const data = this.assetData.get(symbol);
    if (!data) {
      // Generate synthetic data if no real data exists
      const basePrice = symbol.includes('BTC') ? 45000 :
                       symbol.includes('ETH') ? 3000 :
                       symbol.includes('SOL') ? 100 :
                       symbol.includes('BNB') ? 300 :
                       symbol.includes('XRP') ? 0.5 : 1;

      const now = Date.now();
      const syntheticData: AssetData = {
        symbol,
        price: basePrice * (1 + (Math.random() - 0.5) * 0.002),
        change24h: (Math.random() * 10) - 5,
        volume24h: Math.random() * 1000000 + 500000,
        high24h: basePrice * (1 + Math.random() * 0.01),
        low24h: basePrice * (1 - Math.random() * 0.01),
        lastUpdate: now,
        priceHistory: Array.from({ length: 60 }, (_, i) => ({
          timestamp: now - (60 - i) * 60000,
          price: basePrice * (1 + (Math.random() - 0.5) * 0.01)
        }))
      };

      this.assetData.set(symbol, syntheticData);
      return syntheticData;
    }
    return data;
  }

  private async fetchWithCORS(url: string, options: RequestInit = {}): Promise<Response> {
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      mode: 'cors'
    };

    // Don't rewrite the URL since we're using relative paths now
    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      logService.log('info', `Fetching from ${url}`, null, 'BitmartService');
      const response = await fetch(url, finalOptions);

      // Check if the response is OK
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        logService.log('warn', `Response is not JSON: ${contentType}`, null, 'BitmartService');
        throw new Error(`Expected JSON response but got ${contentType}`);
      }

      return response;
    } catch (error) {
      logService.log('error', `Failed to fetch from ${url}`, error, 'BitmartService');
      throw error;
    }
  }

  /**
   * Generates a realistic mock price for a given symbol
   * @param symbol The trading symbol
   * @returns A realistic price for the symbol
   */
  private generateMockPrice(symbol: string): number {
    // Extract the base asset from the symbol (e.g., 'BTC' from 'BTC_USDT')
    const baseAsset = symbol.split('_')[0];

    // Return a realistic price based on the asset
    switch (baseAsset) {
      case 'BTC': return 50000 + (Math.random() * 2000 - 1000);
      case 'ETH': return 3000 + (Math.random() * 100 - 50);
      case 'SOL': return 100 + (Math.random() * 10 - 5);
      case 'BNB': return 500 + (Math.random() * 20 - 10);
      case 'XRP': return 0.5 + (Math.random() * 0.05 - 0.025);
      default: return 100 + (Math.random() * 10 - 5);
    }
  }

  private async initializeServerTime(): Promise<void> {
    try {
      const response = await this.fetchWithCORS(`${this.baseUrl}/system/time`);
      const { server_time } = await response.json();
      this.serverTimeOffset = server_time - Date.now();
    } catch (error) {
      if (this.demoMode) {
        logService.log('warn', 'Failed to sync server time in demo mode, using local time', error, 'BitmartService');
        this.serverTimeOffset = 0;
        return;
      }
      throw error;
    }
  }

  async initialize(config: BitmartConfig): Promise<void> {
    try {
      this.config = config;
      this.demoMode = config.testnet || false;
      this.useUSDX = config.useUSDX || false;

      if (this.demoMode) {
        // In demo mode, initialize with default data
        await this.initializeDemoData();
        this.initialized = true;
        this.emit('initialized');
        return;
      }

      await this.initializeServerTime();
      // ... rest of the initialization logic
    } catch (error) {
      logService.log('error', 'Failed to initialize Bitmart service', error, 'BitmartService');
      throw error;
    }
  }

  private async initializeDemoData(): Promise<void> {
    try {
      // Initialize demo market data
      this.DEFAULT_ASSETS.forEach(symbol => {
        const basePrice = this.getBasePriceForSymbol(symbol);
        const demoData = this.generateDemoMarketData(symbol, basePrice);
        this.assetData.set(symbol, demoData);
      });

      // Start demo data updates
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }

      this.updateInterval = setInterval(() => {
        this.updateDemoMarketData();
      }, this.UPDATE_INTERVAL);

    } catch (error) {
      logService.log('error', 'Failed to initialize demo data', error, 'BitmartService');
      throw error;
    }
  }

  private getBasePriceForSymbol(symbol: string): number {
    // Default base prices for demo mode
    const basePrices: Record<string, number> = {
      'BTC_USDT': 45000,
      'ETH_USDT': 2500,
      'SOL_USDT': 100,
      'BNB_USDT': 300,
      'XRP_USDT': 0.5
    };
    return basePrices[symbol] || 100;
  }

  getServerTime(): number {
    return Date.now() + this.serverTimeOffset;
  }

  /**
   * Subscribe to updates for a specific trading symbol
   * @param symbol The trading symbol to subscribe to (e.g., 'BTC_USDT')
   */
  async subscribeToSymbol(symbol: string): Promise<void> {
    try {
      // Normalize the symbol format if needed
      const normalizedSymbol = symbol.includes('_') ? symbol : symbol.replace('/', '_');

      // Check if already subscribed
      if (this.subscriptions.has(normalizedSymbol)) {
        logService.log('info', `Already subscribed to ${normalizedSymbol}`, null, 'BitmartService');
        return;
      }

      // Add to subscriptions set
      this.subscriptions.add(normalizedSymbol);

      if (this.demoMode) {
        // In demo mode, just generate synthetic data
        const basePrice = this.getBasePriceForSymbol(normalizedSymbol);
        const demoData = this.generateDemoMarketData(normalizedSymbol, basePrice);
        this.assetData.set(normalizedSymbol, demoData);
        logService.log('info', `Subscribed to ${normalizedSymbol} in demo mode`, null, 'BitmartService');
        return;
      }

      // In real mode, subscribe via WebSocket
      try {
        await websocketService.subscribe(`spot/ticker:${normalizedSymbol}`);
        logService.log('info', `Subscribed to ${normalizedSymbol}`, null, 'BitmartService');
      } catch (wsError) {
        logService.log('error', `Failed to subscribe to ${normalizedSymbol} via WebSocket`, wsError, 'BitmartService');
        // Fall back to polling if WebSocket fails
        this.pollSymbol(normalizedSymbol);
      }
    } catch (error) {
      logService.log('error', `Failed to subscribe to symbol ${symbol}`, error, 'BitmartService');
      throw error;
    }
  }

  /**
   * Poll for updates for a symbol when WebSocket is not available
   * @param symbol The symbol to poll for
   */
  private pollSymbol(symbol: string): void {
    // Set up polling for this symbol
    const pollInterval = setInterval(async () => {
      try {
        try {
          // Fetch latest ticker data
          const response = await this.fetchWithCORS(`${this.baseUrl}/spot/v1/ticker?symbol=${symbol}`);
          const data = await response.json();

          if (data && data.data && data.data.length > 0) {
            const ticker = data.data[0];
            // Process the ticker data similar to WebSocket
            websocketService.emit('ticker', {
              symbol: ticker.symbol,
              last_price: ticker.last_price,
              quote_volume_24h: ticker.quote_volume_24h,
              base_volume_24h: ticker.base_volume_24h,
              high_24h: ticker.high_24h,
              low_24h: ticker.low_24h,
              open_24h: ticker.open_24h,
              timestamp: Date.now()
            });
          }
        } catch (fetchError) {
          // If we can't fetch from BitMart, generate mock data instead
          logService.log('warn', `Failed to fetch data for ${symbol}, using mock data`, fetchError, 'BitmartService');

          // Generate mock ticker data
          const mockPrice = this.generateMockPrice(symbol);
          websocketService.emit('ticker', {
            symbol: symbol,
            last_price: mockPrice.toString(),
            quote_volume_24h: (mockPrice * 1000000).toString(),
            base_volume_24h: (1000).toString(),
            high_24h: (mockPrice * 1.05).toString(),
            low_24h: (mockPrice * 0.95).toString(),
            open_24h: (mockPrice * 0.98).toString(),
            timestamp: Date.now()
          });
        }
      } catch (error) {
        logService.log('error', `Failed to poll symbol ${symbol}`, error, 'BitmartService');
      }
    }, 5000); // Poll every 5 seconds

    // Store the interval ID for cleanup
    // (You might want to add a map to store these intervals)
  }

  /**
   * Unsubscribe from updates for a specific trading symbol
   * @param symbol The trading symbol to unsubscribe from (e.g., 'BTC_USDT')
   */
  async unsubscribeFromSymbol(symbol: string): Promise<void> {
    try {
      // Normalize the symbol format if needed
      const normalizedSymbol = symbol.includes('_') ? symbol : symbol.replace('/', '_');

      // Check if subscribed
      if (!this.subscriptions.has(normalizedSymbol)) {
        logService.log('info', `Not subscribed to ${normalizedSymbol}, nothing to unsubscribe`, null, 'BitmartService');
        return;
      }

      // Remove from subscriptions set
      this.subscriptions.delete(normalizedSymbol);

      if (this.demoMode) {
        // In demo mode, just log the unsubscription
        logService.log('info', `Unsubscribed from ${normalizedSymbol} in demo mode`, null, 'BitmartService');
        return;
      }

      // In real mode, unsubscribe via WebSocket
      try {
        // Check if websocketService has an unsubscribe method
        if (typeof websocketService.unsubscribe === 'function') {
          await websocketService.unsubscribe(`spot/ticker:${normalizedSymbol}`);
          logService.log('info', `Unsubscribed from ${normalizedSymbol}`, null, 'BitmartService');
        } else {
          logService.log('info', `WebSocket unsubscribe not available for ${normalizedSymbol}`, null, 'BitmartService');
        }
      } catch (wsError) {
        logService.log('error', `Failed to unsubscribe from ${normalizedSymbol} via WebSocket`, wsError, 'BitmartService');
      }
    } catch (error) {
      logService.log('error', `Failed to unsubscribe from symbol ${symbol}`, error, 'BitmartService');
    }
  }

  /**
   * Generate demo market data for a symbol
   * @param symbol The trading symbol
   * @param basePrice The base price to use for generating data
   * @returns Synthetic asset data
   */
  private generateDemoMarketData(symbol: string, basePrice: number): AssetData {
    const now = Date.now();
    const priceVariance = basePrice * 0.01; // 1% variance
    const price = basePrice + (Math.random() * priceVariance * 2 - priceVariance);

    // Generate price history for the last hour
    const priceHistory = [];
    for (let i = 0; i < 60; i++) {
      const historyPrice = basePrice * (1 + (Math.random() - 0.5) * 0.02); // 2% variance
      priceHistory.push({
        timestamp: now - (60 - i) * 60000, // 1 minute intervals
        price: historyPrice
      });
    }

    return {
      symbol,
      price,
      change24h: (Math.random() * 10) - 5, // -5% to +5%
      volume24h: Math.random() * 1000000 + 500000,
      high24h: basePrice * 1.02, // 2% higher than base
      low24h: basePrice * 0.98, // 2% lower than base
      lastUpdate: now,
      priceHistory
    };
  }

  /**
   * Update demo market data for all subscribed symbols
   */
  private updateDemoMarketData(): void {
    try {
      // Update all subscribed symbols
      this.subscriptions.forEach(symbol => {
        const existingData = this.assetData.get(symbol);
        if (!existingData) return;

        const basePrice = existingData.price;
        const priceVariance = basePrice * 0.002; // 0.2% variance for updates
        const newPrice = basePrice + (Math.random() * priceVariance * 2 - priceVariance);
        const now = Date.now();

        // Update price history
        const newHistory = [...existingData.priceHistory];

        // Remove data points older than 1 hour
        const hourAgo = now - 3600000;
        while (newHistory.length > 0 && newHistory[0].timestamp < hourAgo) {
          newHistory.shift();
        }

        // Add new price point if enough time has passed
        if (newHistory.length === 0 || now - newHistory[newHistory.length - 1].timestamp >= this.HISTORY_INTERVAL) {
          newHistory.push({ timestamp: now, price: newPrice });
        }

        // Calculate 24h change
        const open24h = newHistory.length > 0 ? newHistory[0].price : basePrice;
        const change24h = ((newPrice - open24h) / open24h) * 100;

        // Update asset data
        const updatedData: AssetData = {
          ...existingData,
          price: newPrice,
          change24h,
          lastUpdate: now,
          priceHistory: newHistory
        };

        this.assetData.set(symbol, updatedData);
        this.emit('priceUpdate', updatedData);
      });
    } catch (error) {
      logService.log('error', 'Failed to update demo market data', error, 'BitmartService');
    }
  }

  private getDemoData(url: string): any {
    // Return mock data based on the URL
    if (url.includes('/contract/public/details')) {
      return {
        code: 200,
        data: {
          symbols: [
            { symbol: 'BTC_USDT', price: '50000.00', volume_24h: '1000000' },
            { symbol: 'ETH_USDT', price: '3000.00', volume_24h: '500000' }
          ]
        }
      };
    }
    return {};
  }
}

export const bitmartService = BitmartService.getInstance();
