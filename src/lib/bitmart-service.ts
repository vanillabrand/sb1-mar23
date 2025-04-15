import CryptoJS from 'crypto-js';
import { websocketService } from './websocket-service';
import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { config } from './config';

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
  // Store the original BitMart API URL for reference
  private baseUrl = 'https://api-cloud-v2.bitmart.com';
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
        'Content-Type': 'application/json'
      }
    };

    try {
      // Extract the path from the original URL
      let path = url;
      if (url.startsWith(this.baseUrl)) {
        path = url.substring(this.baseUrl.length);
      }

      // Use the config's proxyBaseUrl instead of hardcoded value
      const proxiedUrl = `${config.proxyBaseUrl}/api/bitmart${path.startsWith('/') ? path : '/' + path}`;

      const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
          ...defaultOptions.headers,
          ...options.headers
        }
      };

      logService.log('info', `Fetching from ${url} via proxy ${proxiedUrl}`, null, 'BitmartService');
      return fetch(proxiedUrl, finalOptions);
    } catch (error) {
      logService.log('error', `Error in fetchWithCORS: ${error.message}`, error, 'BitmartService');
      return this.createSyntheticResponse(url);
    }
  }

  /**
   * Create a synthetic response for demo mode or error fallback
   * @param url The original URL being requested
   * @returns A synthetic Response object
   */
  private createSyntheticResponse(url: string): Response {
    let responseData: any = {};

    // Generate appropriate synthetic data based on the URL
    if (url.includes('/spot/v1/symbols/kline')) {
      // Extract symbol from URL
      const symbolMatch = url.match(/symbol=([^&]+)/);
      const symbol = symbolMatch ? symbolMatch[1] : 'BTC_USDT';

      // Extract time parameters
      const fromMatch = url.match(/from=([^&]+)/);
      const toMatch = url.match(/to=([^&]+)/);
      const stepMatch = url.match(/step=([^&]+)/);

      const from = fromMatch ? parseInt(fromMatch[1]) : Math.floor(Date.now() / 1000) - 3600;
      const to = toMatch ? parseInt(toMatch[1]) : Math.floor(Date.now() / 1000);
      const step = stepMatch ? parseInt(stepMatch[1]) : 60;

      // Generate synthetic klines
      const klines = this.generateSyntheticKlines(symbol, from, to, step.toString());

      responseData = {
        code: 1000,
        trace: 'synthetic-trace-' + Date.now(),
        message: 'OK',
        data: {
          klines: klines.map(k => ({
            timestamp: Math.floor(k[0] / 1000),
            open: k[1],
            high: k[2],
            low: k[3],
            close: k[4],
            volume: k[5]
          }))
        }
      };
    } else if (url.includes('/spot/v1/ticker')) {
      // Extract symbol from URL
      const symbolMatch = url.match(/symbol=([^&]+)/);
      const symbol = symbolMatch ? symbolMatch[1] : 'BTC_USDT';

      // Generate synthetic ticker
      const ticker = this.generateSyntheticTicker(symbol);

      responseData = {
        code: 1000,
        trace: 'synthetic-trace-' + Date.now(),
        message: 'OK',
        data: {
          tickers: [{
            symbol: symbol,
            last_price: ticker.last_price,
            quote_volume_24h: ticker.volume_24h,
            base_volume_24h: '1000',
            high_24h: (parseFloat(ticker.last_price) * 1.05).toString(),
            low_24h: (parseFloat(ticker.last_price) * 0.95).toString(),
            open_24h: (parseFloat(ticker.last_price) * 0.98).toString(),
            best_bid: ticker.bid,
            best_ask: ticker.ask,
            fluctuation: '+0.0215',
            timestamp: Math.floor(Date.now() / 1000)
          }]
        }
      };
    } else if (url.includes('/system/time')) {
      responseData = {
        code: 1000,
        trace: 'synthetic-trace-' + Date.now(),
        message: 'OK',
        data: {
          server_time: Math.floor(Date.now() / 1000)
        }
      };
    }

    // Create a synthetic Response object
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
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

  // Using the existing generateSyntheticTicker method at the end of the file

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

    // If we have a predefined price, use it
    if (basePrices[symbol]) {
      return basePrices[symbol];
    }

    // Otherwise, extract the base asset and determine a reasonable price
    const parts = symbol.split('_');
    if (parts.length >= 2) {
      const baseAsset = parts[0];

      // Check for common cryptocurrencies
      if (baseAsset === 'BTC' || symbol.includes('BTC')) return 45000 + Math.random() * 1000;
      if (baseAsset === 'ETH' || symbol.includes('ETH')) return 2500 + Math.random() * 100;
      if (baseAsset === 'SOL' || symbol.includes('SOL')) return 100 + Math.random() * 10;
      if (baseAsset === 'BNB' || symbol.includes('BNB')) return 300 + Math.random() * 20;
      if (baseAsset === 'XRP' || symbol.includes('XRP')) return 0.5 + Math.random() * 0.05;
      if (baseAsset === 'ADA' || symbol.includes('ADA')) return 0.4 + Math.random() * 0.04;
      if (baseAsset === 'DOT' || symbol.includes('DOT')) return 5 + Math.random() * 0.5;
      if (baseAsset === 'DOGE' || symbol.includes('DOGE')) return 0.1 + Math.random() * 0.01;
    }

    // Default fallback price
    return 100 + Math.random() * 10;
  }

  getServerTime(): number {
    return Date.now() + this.serverTimeOffset;
  }

  /**
   * Subscribe to updates for a specific trading symbol
   * @param symbol The trading symbol to subscribe to (e.g., 'BTC_USDT')
   * @param options Optional configuration for the subscription
   */
  async subscribeToSymbol(symbol: string, options: { priority?: 'normal' | 'high' } = {}): Promise<void> {
    try {
      // Get priority from options or default to normal
      const priority = options.priority || 'normal';

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

        // If high priority, update more frequently
        if (priority === 'high') {
          // Set up a more frequent update interval for this specific symbol
          setInterval(() => {
            this.updateSpecificSymbol(normalizedSymbol);
          }, 1000); // Update every second for high priority symbols
        }

        logService.log('info', `Subscribed to ${normalizedSymbol} in demo mode with ${priority} priority`, null, 'BitmartService');
        return;
      }

      // In real mode, subscribe via WebSocket
      try {
        // Use send method instead of subscribe
        await websocketService.send({
          type: 'subscribe',
          channels: [`spot/ticker:${normalizedSymbol}`],
          priority: priority // Add priority to the subscription
        });
        logService.log('info', `Subscribed to ${normalizedSymbol} with ${priority} priority`, null, 'BitmartService');
      } catch (wsError) {
        logService.log('error', `Failed to subscribe to ${normalizedSymbol} via WebSocket`, wsError, 'BitmartService');
        // Fall back to polling if WebSocket fails
        this.pollSymbol(normalizedSymbol, priority === 'high');
      }
    } catch (error) {
      logService.log('error', `Failed to subscribe to symbol ${symbol}`, error, 'BitmartService');
      throw error;
    }
  }

  /**
   * Update a specific symbol with new price data
   * @param symbol The symbol to update
   */
  private updateSpecificSymbol(symbol: string): void {
    try {
      const existingData = this.assetData.get(symbol);
      if (!existingData) return;

      const basePrice = existingData.price;
      const priceVariance = basePrice * 0.001; // 0.1% variance for real-time updates
      const newPrice = basePrice + (Math.random() * priceVariance * 2 - priceVariance);
      const now = Date.now();

      // Update price history
      const newHistory = [...existingData.priceHistory];

      // Remove data points older than 1 hour
      const hourAgo = now - 3600000;
      while (newHistory.length > 0 && newHistory[0].timestamp < hourAgo) {
        newHistory.shift();
      }

      // Add new price point if enough time has passed or for high priority updates
      if (newHistory.length === 0 || now - newHistory[newHistory.length - 1].timestamp >= 1000) {
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
    } catch (error) {
      logService.log('error', `Failed to update specific symbol ${symbol}`, error, 'BitmartService');
    }
  }

  /**
   * Poll for updates for a symbol when WebSocket is not available
   * @param symbol The symbol to poll for
   * @param highPriority Whether to poll with high priority (more frequently)
   */
  private pollSymbol(symbol: string, highPriority: boolean = false): void {
    // Set up polling for this symbol with appropriate interval based on priority
    const pollIntervalTime = highPriority ? 1000 : 5000; // 1 second for high priority, 5 seconds for normal
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
    }, pollIntervalTime); // Poll at the appropriate interval

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
        // Use send method to unsubscribe
        await websocketService.send({
          type: 'unsubscribe',
          channels: [`spot/ticker:${normalizedSymbol}`]
        });
        logService.log('info', `Unsubscribed from ${normalizedSymbol}`, null, 'BitmartService');
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
      // Use imported format utilities instead of require
      // Import these at the top of the file instead
      const getBasePrice = (symbol: string) => {
        // Simple implementation to get a base price for common symbols
        if (symbol.includes('BTC')) return 50000 + Math.random() * 1000;
        if (symbol.includes('ETH')) return 3000 + Math.random() * 100;
        if (symbol.includes('SOL')) return 100 + Math.random() * 10;
        if (symbol.includes('BNB')) return 400 + Math.random() * 20;
        return 1 + Math.random(); // Default for unknown symbols
      };

      const standardizeAssetPairFormat = (symbol: string) => {
        return symbol.includes('_') ? symbol : symbol.replace('/', '_');
      };

      // Update all subscribed symbols
      this.subscriptions.forEach(symbol => {
        const existingData = this.assetData.get(symbol);
        if (!existingData) return;

        // Get a more realistic base price if we don't have one yet
        const basePrice = existingData.price || getBasePrice(symbol);

        // Use a more realistic price movement algorithm
        // This simulates real market behavior better with occasional larger moves
        let priceVariance;
        const randomFactor = Math.random();

        if (randomFactor > 0.98) {
          // Occasional larger move (2% of the time)
          priceVariance = basePrice * 0.01; // 1% variance
        } else if (randomFactor > 0.9) {
          // Medium move (8% of the time)
          priceVariance = basePrice * 0.005; // 0.5% variance
        } else {
          // Normal small move (90% of the time)
          priceVariance = basePrice * 0.001; // 0.1% variance
        }

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
          high24h: Math.max(existingData.high24h || 0, newPrice),
          low24h: existingData.low24h ? Math.min(existingData.low24h, newPrice) : newPrice,
          volume24h: existingData.volume24h + (newPrice * Math.random() * 10), // Increment volume
          lastUpdate: now,
          priceHistory: newHistory
        };

        this.assetData.set(symbol, updatedData);

        // Also emit a ticker event for WebSocket subscribers
        websocketService.emit('ticker', {
          symbol: standardizeAssetPairFormat(symbol),
          last_price: newPrice.toString(),
          quote_volume_24h: updatedData.volume24h.toString(),
          high_24h: updatedData.high24h.toString(),
          low_24h: updatedData.low24h.toString(),
          open_24h: open24h.toString(),
          timestamp: now
        });

        // Emit our own price update event
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

  /**
   * Get historical kline (candlestick) data for a symbol
   * @param symbol The trading symbol (e.g., 'BTC_USDT')
   * @param startTime Start time in seconds
   * @param endTime End time in seconds
   * @param interval Interval for the klines (e.g., '1m', '5m', '1h')
   * @returns Array of kline data
   */
  async getKlines(symbol: string, startTime: number, endTime: number, interval: string): Promise<any[]> {
    try {
      const normalizedSymbol = symbol.includes('_') ? symbol : symbol.replace('/', '_');

      if (this.demoMode) {
        return this.generateSyntheticKlines(normalizedSymbol, startTime, endTime, interval);
      }

      const url = `${this.baseUrl}/spot/v1/symbols/kline?symbol=${normalizedSymbol}&from=${startTime}&to=${endTime}&step=${this.getIntervalInMinutes(interval)}`;

      const response = await this.fetchWithCORS(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data && data.data && data.data.klines) {
        return data.data.klines.map((kline: any) => [
          parseInt(kline.timestamp) * 1000,
          kline.open,
          kline.high,
          kline.low,
          kline.close,
          kline.volume
        ]);
      }

      return this.generateSyntheticKlines(normalizedSymbol, startTime, endTime, interval);
    } catch (error) {
      logService.log('error', `Failed to get klines for ${symbol}`, error, 'BitmartService');
      return this.generateSyntheticKlines(symbol, startTime, endTime, interval);
    }
  }

  /**
   * Generate synthetic kline data for demo mode
   * @param symbol The trading symbol
   * @param startTime Start time in seconds
   * @param endTime End time in seconds
   * @param interval Interval for the klines
   * @returns Array of synthetic kline data
   */
  private generateSyntheticKlines(symbol: string, startTime: number, endTime: number, interval: string): any[] {
    const intervalMs = this.getIntervalInMilliseconds(interval);
    const basePrice = this.getBasePriceForSymbol(symbol);
    const klines = [];

    // Convert to milliseconds
    const startTimeMs = startTime * 1000;
    const endTimeMs = endTime * 1000;

    // Generate klines for each interval
    for (let time = startTimeMs; time <= endTimeMs; time += intervalMs) {
      // Generate a random price movement (-0.5% to +0.5%)
      const priceMovement = (Math.random() - 0.5) * 0.01;
      const open = basePrice * (1 + (Math.random() - 0.5) * 0.01);
      const close = open * (1 + priceMovement);
      const high = Math.max(open, close) * (1 + Math.random() * 0.005); // Up to 0.5% higher
      const low = Math.min(open, close) * (1 - Math.random() * 0.005); // Up to 0.5% lower
      const volume = basePrice * (Math.random() * 100 + 50); // Random volume

      klines.push([
        time,
        open.toFixed(2),
        high.toFixed(2),
        low.toFixed(2),
        close.toFixed(2),
        volume.toFixed(2)
      ]);
    }

    return klines;
  }

  /**
   * Convert interval string to minutes
   * @param interval Interval string (e.g., '1m', '5m', '1h')
   * @returns Interval in minutes
   */
  private getIntervalInMinutes(interval: string): number {
    const unit = interval.slice(-1);
    const value = parseInt(interval.slice(0, -1));

    switch (unit) {
      case 'm': return value;
      case 'h': return value * 60;
      case 'd': return value * 60 * 24;
      case 'w': return value * 60 * 24 * 7;
      default: return 1; // Default to 1 minute
    }
  }

  /**
   * Convert interval string to milliseconds
   * @param interval Interval string (e.g., '1m', '5m', '1h')
   * @returns Interval in milliseconds
   */
  private getIntervalInMilliseconds(interval: string): number {
    return this.getIntervalInMinutes(interval) * 60 * 1000;
  }

  /**
   * Get current ticker data for a symbol
   * @param symbol The trading symbol (e.g., 'BTC_USDT')
   * @returns Ticker data including bid, ask, and last price
   */
  async getTicker(symbol: string): Promise<any> {
    try {
      // Normalize the symbol format if needed
      const normalizedSymbol = symbol.includes('_') ? symbol : symbol.replace('/', '_');

      if (this.demoMode) {
        // In demo mode, generate synthetic ticker data
        return this.generateSyntheticTicker(normalizedSymbol);
      }

      // In real mode, fetch from the API
      const url = `${this.baseUrl}/spot/v1/ticker?symbol=${normalizedSymbol}`;

      const response = await this.fetchWithCORS(url);
      const data = await response.json();

      if (data && data.data && data.data.tickers && data.data.tickers.length > 0) {
        const ticker = data.data.tickers[0];
        return {
          bid: parseFloat(ticker.best_bid),
          ask: parseFloat(ticker.best_ask),
          last_price: parseFloat(ticker.last_price),
          volume_24h: parseFloat(ticker.volume),
          timestamp: Date.now()
        };
      }

      // Fall back to synthetic data if API doesn't return expected format
      return this.generateSyntheticTicker(normalizedSymbol);
    } catch (error) {
      logService.log('error', `Failed to get ticker for ${symbol}`, error, 'BitmartService');

      // Fall back to synthetic data on error
      const normalizedSymbol = symbol.includes('_') ? symbol : symbol.replace('/', '_');
      return this.generateSyntheticTicker(normalizedSymbol);
    }
  }

  /**
   * Generate synthetic ticker data for demo mode
   * @param symbol The trading symbol
   * @returns Synthetic ticker data
   */
  private generateSyntheticTicker(symbol: string): any {
    const basePrice = this.getBasePriceForSymbol(symbol);

    // Add some randomness to the price
    const lastPrice = basePrice * (1 + (Math.random() - 0.5) * 0.01);
    const bid = lastPrice * 0.999;
    const ask = lastPrice * 1.001;

    return {
      bid,
      ask,
      last_price: lastPrice.toString(),
      volume_24h: (basePrice * 100 * (0.5 + Math.random())).toString(),
      timestamp: Date.now()
    };
  }
}

export const bitmartService = BitmartService.getInstance();
