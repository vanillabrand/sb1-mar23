import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { cacheService } from './cache-service';
import { v4 as uuidv4 } from 'uuid';
import { ExchangeId, ExchangeCredentials, WalletBalance } from './types';

/**
 * Demo Exchange Service
 *
 * This service provides a simulated exchange interface that mimics the behavior
 * of a real exchange but operates entirely with simulated data.
 *
 * It implements the same interface as the real exchange service to ensure
 * that demo mode works identically to live trading.
 */
export class DemoExchangeService extends EventEmitter {
  private static instance: DemoExchangeService;
  private initialized: boolean = false;
  private balances: Map<string, any> = new Map();
  private orders: Map<string, any> = new Map();
  private tickers: Map<string, any> = new Map();
  private markets: Map<string, any> = new Map();
  private lastPrices: Map<string, number> = new Map();
  private updateInterval: any = null;

  // Constants
  private readonly DEFAULT_BALANCE = 10000; // Default USDT balance
  private readonly TICKER_UPDATE_INTERVAL = 5000; // 5 seconds
  private readonly MARKET_DATA_CACHE_NAMESPACE = 'demo-market-data';
  private readonly TICKER_CACHE_TTL = 60; // 1 minute

  // Demo exchange info
  private readonly exchangeInfo = {
    id: 'demo-exchange',
    name: 'Demo Exchange',
    testnet: true,
    spotSupported: true,
    marginSupported: true,
    futuresSupported: true,
    credentials: {
      apiKey: 'demo-api-key',
      secret: 'demo-secret'
    }
  };

  constructor() {
    super();
    this.initializeBalances();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): DemoExchangeService {
    if (!DemoExchangeService.instance) {
      DemoExchangeService.instance = new DemoExchangeService();
    }
    return DemoExchangeService.instance;
  }

  /**
   * Initialize the demo exchange service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logService.log('info', 'Initializing demo exchange service', null, 'DemoExchangeService');

    // Initialize demo data
    this.initializeBalances();
    this.initializeMarkets();

    // Start ticker updates
    this.startTickerUpdates();

    this.initialized = true;

    // Emit initialized event
    this.emit('initialized', { success: true });

    logService.log('info', 'Demo exchange service initialized', null, 'DemoExchangeService');
  }

  /**
   * Initialize demo balances
   */
  private initializeBalances(): void {
    // Set up default balances
    this.balances.set('spot', {
      total: {
        USDT: this.DEFAULT_BALANCE,
        BTC: 0.1,
        ETH: 1.0,
        SOL: 10.0,
        DOGE: 1000.0
      },
      free: {
        USDT: this.DEFAULT_BALANCE,
        BTC: 0.1,
        ETH: 1.0,
        SOL: 10.0,
        DOGE: 1000.0
      },
      used: {
        USDT: 0,
        BTC: 0,
        ETH: 0,
        SOL: 0,
        DOGE: 0
      }
    });

    // Set up margin and futures balances
    this.balances.set('margin', {
      total: { USDT: this.DEFAULT_BALANCE },
      free: { USDT: this.DEFAULT_BALANCE },
      used: { USDT: 0 }
    });

    this.balances.set('futures', {
      total: { USDT: this.DEFAULT_BALANCE },
      free: { USDT: this.DEFAULT_BALANCE },
      used: { USDT: 0 }
    });
  }

  /**
   * Initialize demo markets
   */
  private initializeMarkets(): void {
    // Common trading pairs
    const pairs = [
      'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'DOGE/USDT', 'XRP/USDT',
      'ADA/USDT', 'DOT/USDT', 'AVAX/USDT', 'MATIC/USDT', 'LINK/USDT'
    ];

    // Create market data for each pair
    pairs.forEach(pair => {
      const [base, quote] = pair.split('/');

      // Generate a realistic price
      let basePrice;
      switch (base) {
        case 'BTC': basePrice = 45000 + (Math.random() * 5000); break;
        case 'ETH': basePrice = 3000 + (Math.random() * 500); break;
        case 'SOL': basePrice = 100 + (Math.random() * 20); break;
        case 'DOGE': basePrice = 0.1 + (Math.random() * 0.05); break;
        case 'XRP': basePrice = 0.5 + (Math.random() * 0.1); break;
        case 'ADA': basePrice = 0.4 + (Math.random() * 0.1); break;
        case 'DOT': basePrice = 7 + (Math.random() * 1); break;
        case 'AVAX': basePrice = 30 + (Math.random() * 5); break;
        case 'MATIC': basePrice = 0.8 + (Math.random() * 0.2); break;
        case 'LINK': basePrice = 15 + (Math.random() * 3); break;
        default: basePrice = 10 + (Math.random() * 5);
      }

      // Store the last price
      this.lastPrices.set(pair, basePrice);

      // Create market data
      this.markets.set(pair, {
        id: pair.replace('/', ''),
        symbol: pair,
        base,
        quote,
        active: true,
        precision: {
          price: 8,
          amount: 8
        },
        limits: {
          amount: {
            min: 0.0001,
            max: 1000
          },
          price: {
            min: 0.00000001,
            max: 1000000
          },
          cost: {
            min: 0.001,
            max: 1000000
          }
        }
      });

      // Create initial ticker
      this.updateTicker(pair, basePrice);
    });
  }

  /**
   * Start periodic ticker updates
   */
  private startTickerUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.updateAllTickers();
    }, this.TICKER_UPDATE_INTERVAL);
  }

  /**
   * Update all tickers with new prices
   */
  private updateAllTickers(): void {
    this.markets.forEach((market, symbol) => {
      const lastPrice = this.lastPrices.get(symbol) || 0;

      // Generate a new price with a small random change
      const changePercent = (Math.random() * 2 - 1) * 0.5; // -0.5% to +0.5%
      const newPrice = lastPrice * (1 + changePercent / 100);

      this.updateTicker(symbol, newPrice);
    });
  }

  /**
   * Update a single ticker
   */
  private updateTicker(symbol: string, price: number): void {
    const now = Date.now();
    const lastPrice = this.lastPrices.get(symbol) || price;

    // Store the new price
    this.lastPrices.set(symbol, price);

    // Create ticker data
    const ticker = {
      symbol,
      timestamp: now,
      datetime: new Date(now).toISOString(),
      high: Math.max(price * 1.01, lastPrice * 1.01),
      low: Math.min(price * 0.99, lastPrice * 0.99),
      bid: price * 0.999,
      bidVolume: Math.random() * 10,
      ask: price * 1.001,
      askVolume: Math.random() * 10,
      vwap: price,
      open: lastPrice,
      close: price,
      last: price,
      previousClose: lastPrice,
      change: price - lastPrice,
      percentage: ((price - lastPrice) / lastPrice) * 100,
      average: (price + lastPrice) / 2,
      baseVolume: Math.random() * 1000,
      quoteVolume: Math.random() * 1000 * price,
      info: {}
    };

    // Store the ticker
    this.tickers.set(symbol, ticker);

    // Cache the ticker
    cacheService.set(
      `ticker:${symbol}`,
      ticker,
      this.MARKET_DATA_CACHE_NAMESPACE,
      this.TICKER_CACHE_TTL
    );

    // Emit ticker update event
    this.emit('ticker:update', { symbol, ticker });
  }

  /**
   * Get the demo exchange info
   */
  getExchangeInfo(): any {
    return { ...this.exchangeInfo };
  }

  /**
   * Fetch balance for a specific account type
   */
  async fetchBalance(params: { type?: string } = {}): Promise<any> {
    const type = params.type || 'spot';

    // Ensure the balance exists
    if (!this.balances.has(type)) {
      this.balances.set(type, {
        total: { USDT: this.DEFAULT_BALANCE },
        free: { USDT: this.DEFAULT_BALANCE },
        used: { USDT: 0 }
      });
    }

    // Return a copy of the balance
    return { ...this.balances.get(type) };
  }

  /**
   * Fetch all wallet balances
   */
  async fetchAllWalletBalances(): Promise<{
    spot?: WalletBalance;
    margin?: WalletBalance;
    futures?: WalletBalance;
  }> {
    const balances: {
      spot?: WalletBalance;
      margin?: WalletBalance;
      futures?: WalletBalance;
    } = {};

    // Fetch spot balances
    const spotBalance = await this.fetchBalance({ type: 'spot' });
    balances.spot = this.normalizeBalanceToUSDT(spotBalance, 'spot');

    // Fetch margin balances
    const marginBalance = await this.fetchBalance({ type: 'margin' });
    balances.margin = this.normalizeBalanceToUSDT(marginBalance, 'margin');

    // Fetch futures balances
    const futuresBalance = await this.fetchBalance({ type: 'futures' });
    balances.futures = this.normalizeBalanceToUSDT(futuresBalance, 'futures');

    return balances;
  }

  /**
   * Normalize balance to USDT
   */
  private normalizeBalanceToUSDT(balance: any, type: string): WalletBalance {
    const result: WalletBalance = {
      total: 0,
      free: 0,
      used: 0,
      assets: []
    };

    // Process each asset
    Object.keys(balance.total).forEach(asset => {
      const amount = balance.total[asset];
      let valueInUSDT = 0;

      if (asset === 'USDT') {
        valueInUSDT = amount;
      } else {
        // Get the ticker for this asset/USDT
        const ticker = this.tickers.get(`${asset}/USDT`);
        if (ticker) {
          valueInUSDT = amount * ticker.last;
        } else {
          // Use a default value if ticker not found
          valueInUSDT = amount * 10; // Arbitrary value
        }
      }

      // Add to total
      result.total += valueInUSDT;
      result.free += (balance.free[asset] || 0) * (asset === 'USDT' ? 1 : (this.tickers.get(`${asset}/USDT`)?.last || 10));
      result.used += (balance.used[asset] || 0) * (asset === 'USDT' ? 1 : (this.tickers.get(`${asset}/USDT`)?.last || 10));

      // Add asset details
      result.assets.push({
        asset,
        total: balance.total[asset] || 0,
        free: balance.free[asset] || 0,
        used: balance.used[asset] || 0,
        valueInUSDT
      });
    });

    return result;
  }

  /**
   * Fetch ticker for a symbol
   */
  async fetchTicker(symbol: string): Promise<any> {
    // Normalize symbol format
    const normalizedSymbol = symbol.includes('_') ? symbol.replace('_', '/') : symbol;

    // Check if we have this ticker
    if (!this.tickers.has(normalizedSymbol)) {
      // Create a new ticker if it doesn't exist
      const basePrice = 10 + (Math.random() * 5);
      this.updateTicker(normalizedSymbol, basePrice);
    }

    // Return a copy of the ticker
    return { ...this.tickers.get(normalizedSymbol) };
  }

  /**
   * Fetch price for a symbol
   */
  async fetchPrice(symbol: string): Promise<any> {
    const ticker = await this.fetchTicker(symbol);
    return {
      symbol,
      price: ticker.last,
      timestamp: ticker.timestamp
    };
  }

  /**
   * Fetch OHLCV data (candles)
   */
  async fetchOHLCV(
    symbol: string,
    timeframe: string = '1h',
    since: number | undefined = undefined,
    limit: number | undefined = undefined
  ): Promise<any[]> {
    // Normalize symbol format
    const normalizedSymbol = symbol.includes('_') ? symbol.replace('_', '/') : symbol;

    // Get the current price
    const ticker = await this.fetchTicker(normalizedSymbol);
    const currentPrice = ticker.last;

    // Generate synthetic candles
    const candles: any[] = [];
    const now = Date.now();
    const timeframeMs = this.parseTimeframe(timeframe);
    const actualLimit = limit || 100;

    // Calculate the start time
    const startTime = since || now - (timeframeMs * actualLimit);

    // Generate candles
    for (let i = 0; i < actualLimit; i++) {
      const timestamp = startTime + (i * timeframeMs);

      // Generate a price with some randomness
      const volatility = 0.02; // 2% volatility
      const randomChange = (Math.random() * 2 - 1) * volatility;
      const basePrice = currentPrice * (1 + randomChange);

      // Generate OHLC with some variation
      const open = basePrice * (1 + (Math.random() * 0.01 - 0.005));
      const high = open * (1 + Math.random() * 0.01);
      const low = open * (1 - Math.random() * 0.01);
      const close = (open + high + low) / 3; // Average of the three

      // Generate volume
      const volume = Math.random() * 100;

      candles.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume
      });
    }

    return candles;
  }

  /**
   * Parse timeframe string to milliseconds
   */
  private parseTimeframe(timeframe: string): number {
    const unit = timeframe.slice(-1);
    const value = parseInt(timeframe.slice(0, -1));

    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      case 'M': return value * 30 * 24 * 60 * 60 * 1000;
      default: return value * 60 * 1000; // Default to minutes
    }
  }

  /**
   * Create an order
   */
  async createOrder(
    symbol: string,
    type: string,
    side: string,
    amount: number,
    price?: number
  ): Promise<any> {
    // Normalize symbol format
    const normalizedSymbol = symbol.includes('_') ? symbol.replace('_', '/') : symbol;

    // Get the current ticker
    const ticker = await this.fetchTicker(normalizedSymbol);

    // Use provided price or current market price
    const orderPrice = price || ticker.last;

    // Calculate cost
    const cost = amount * orderPrice;

    // Generate order ID
    const orderId = `demo-${uuidv4()}`;

    // Create order object
    const order = {
      id: orderId,
      clientOrderId: `demo-client-${uuidv4()}`,
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      symbol: normalizedSymbol,
      type,
      side,
      price: orderPrice,
      amount,
      cost,
      filled: type === 'market' ? amount : 0,
      remaining: type === 'market' ? 0 : amount,
      status: type === 'market' ? 'closed' : 'open',
      fee: {
        cost: cost * 0.001, // 0.1% fee
        currency: normalizedSymbol.split('/')[1]
      },
      trades: []
    };

    // Store the order
    this.orders.set(orderId, order);

    // Update balances
    this.updateBalancesForOrder(order);

    // Emit order created event
    this.emit('order:created', { order });

    // For market orders, emit filled event immediately
    if (type === 'market') {
      this.emit('order:filled', { order });
    }

    return order;
  }

  /**
   * Update balances after an order is created
   */
  private updateBalancesForOrder(order: any): void {
    const [base, quote] = order.symbol.split('/');
    const balanceType = 'spot'; // Default to spot

    // Get current balance
    const balance = this.balances.get(balanceType) || {
      total: {},
      free: {},
      used: {}
    };

    // Initialize if needed
    if (!balance.total[base]) balance.total[base] = 0;
    if (!balance.free[base]) balance.free[base] = 0;
    if (!balance.used[base]) balance.used[base] = 0;
    if (!balance.total[quote]) balance.total[quote] = 0;
    if (!balance.free[quote]) balance.free[quote] = 0;
    if (!balance.used[quote]) balance.used[quote] = 0;

    if (order.side === 'buy') {
      // Buying base with quote
      if (order.status === 'closed') {
        // For filled orders, update total and free
        balance.total[base] += order.amount;
        balance.free[base] += order.amount;
        balance.total[quote] -= order.cost;
        balance.free[quote] -= order.cost;
      } else {
        // For open orders, update used
        balance.used[quote] += order.cost;
        balance.free[quote] -= order.cost;
      }
    } else {
      // Selling base for quote
      if (order.status === 'closed') {
        // For filled orders, update total and free
        balance.total[base] -= order.amount;
        balance.free[base] -= order.amount;
        balance.total[quote] += order.cost;
        balance.free[quote] += order.cost;
      } else {
        // For open orders, update used
        balance.used[base] += order.amount;
        balance.free[base] -= order.amount;
      }
    }

    // Update the balance
    this.balances.set(balanceType, balance);
  }

  /**
   * Cancel an order
   */
  async cancelOrder(id: string, symbol?: string): Promise<any> {
    // Check if order exists
    if (!this.orders.has(id)) {
      throw new Error(`Order ${id} not found`);
    }

    // Get the order
    const order = this.orders.get(id);

    // Check if order is already closed
    if (order.status === 'closed') {
      throw new Error(`Order ${id} is already closed`);
    }

    // Update order status
    order.status = 'canceled';

    // Update balances
    this.revertBalancesForOrder(order);

    // Emit order canceled event
    this.emit('order:canceled', { order });

    return order;
  }

  /**
   * Revert balances after an order is canceled
   */
  private revertBalancesForOrder(order: any): void {
    const [base, quote] = order.symbol.split('/');
    const balanceType = 'spot'; // Default to spot

    // Get current balance
    const balance = this.balances.get(balanceType) || {
      total: {},
      free: {},
      used: {}
    };

    if (order.side === 'buy') {
      // Buying base with quote
      // Revert used quote
      balance.used[quote] -= order.cost;
      balance.free[quote] += order.cost;
    } else {
      // Selling base for quote
      // Revert used base
      balance.used[base] -= order.amount;
      balance.free[base] += order.amount;
    }

    // Update the balance
    this.balances.set(balanceType, balance);
  }

  /**
   * Fetch an order by ID
   */
  async fetchOrder(id: string, symbol?: string): Promise<any> {
    // Check if order exists
    if (!this.orders.has(id)) {
      throw new Error(`Order ${id} not found`);
    }

    // Return a copy of the order
    return { ...this.orders.get(id) };
  }

  /**
   * Fetch open orders
   */
  async fetchOpenOrders(symbol?: string): Promise<any[]> {
    const openOrders: any[] = [];

    // Filter orders
    this.orders.forEach(order => {
      if (order.status === 'open' && (!symbol || order.symbol === symbol)) {
        openOrders.push({ ...order });
      }
    });

    return openOrders;
  }

  /**
   * Fetch closed orders
   */
  async fetchClosedOrders(symbol?: string): Promise<any[]> {
    const closedOrders: any[] = [];

    // Filter orders
    this.orders.forEach(order => {
      if (order.status !== 'open' && (!symbol || order.symbol === symbol)) {
        closedOrders.push({ ...order });
      }
    });

    return closedOrders;
  }

  /**
   * Fetch markets
   */
  async fetchMarkets(): Promise<any[]> {
    const markets: any[] = [];

    // Return all markets
    this.markets.forEach(market => {
      markets.push({ ...market });
    });

    return markets;
  }

  /**
   * Fetch market price for a symbol
   * This is an alias for fetchPrice to match the exchange-service interface
   */
  async fetchMarketPrice(symbol: string): Promise<{ symbol: string; price: number; timestamp: number }> {
    return this.fetchPrice(symbol);
  }

  /**
   * Set market type for an order
   * @param marketType The market type (spot, margin, futures)
   */
  setMarketType(marketType: string): void {
    // In demo mode, we don't need to do anything special
    logService.log('info', `Setting market type to ${marketType} in demo mode`, null, 'DemoExchangeService');
  }

  /**
   * Check if the exchange is connected
   */
  isConnected(): boolean {
    return this.initialized;
  }

  /**
   * Check the health of the demo exchange
   */
  async checkHealth(): Promise<{ ok: boolean; degraded?: boolean; message?: string }> {
    // Demo exchange is always healthy
    return {
      ok: true,
      message: 'Demo exchange is operational'
    };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Stop ticker updates
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Clear data
    this.balances.clear();
    this.orders.clear();
    this.tickers.clear();
    this.markets.clear();
    this.lastPrices.clear();

    // Reset initialized flag
    this.initialized = false;

    logService.log('info', 'Demo exchange service cleaned up', null, 'DemoExchangeService');
  }
}

// Export singleton instance
export const demoExchangeService = DemoExchangeService.getInstance();
