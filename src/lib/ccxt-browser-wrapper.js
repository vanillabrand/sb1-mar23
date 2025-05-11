/**
 * This file provides a browser-compatible wrapper for CCXT functionality.
 * It intercepts CCXT calls and provides mock implementations or proxies to our backend.
 */

// Check if we're in production mode
const isProduction = process.env.NODE_ENV === 'production';

// Helper function for safer logging
const safeLog = (message, data = null) => {
  try {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  } catch (e) {
    // Ignore logging errors in production
  }
};

// Mock CCXT exchange class
class MockExchange {
  constructor(config = {}) {
    this.id = config.id || 'mock';
    this.name = config.name || 'Mock Exchange';
    this.apiKey = config.apiKey;
    this.secret = config.secret;
    this.verbose = config.verbose || false;
    this.timeout = config.timeout || 30000;
    this.markets = {};
    this.symbols = [];
    this.currencies = {};
    this.options = config.options || {};

    // Log initialization (only in development)
    if (!isProduction) {
      safeLog(`[CCXT Browser Wrapper] Created mock exchange: ${this.id}`);
    }
  }

  // Mock API methods
  async fetchMarkets() {
    if (!isProduction) {
      safeLog(`[CCXT Browser Wrapper] fetchMarkets called for ${this.id}`);
    }
    return [];
  }

  async loadMarkets() {
    if (!isProduction) {
      safeLog(`[CCXT Browser Wrapper] loadMarkets called for ${this.id}`);
    }
    this.markets = {};
    this.symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
    return this.markets;
  }

  async fetchBalance() {
    if (!isProduction) {
      safeLog(`[CCXT Browser Wrapper] fetchBalance called for ${this.id}`);
    }
    return {
      info: {},
      free: { BTC: 1.0, USDT: 10000.0, ETH: 10.0 },
      used: { BTC: 0.0, USDT: 0.0, ETH: 0.0 },
      total: { BTC: 1.0, USDT: 10000.0, ETH: 10.0 }
    };
  }

  async fetchTicker(symbol) {
    if (!isProduction) {
      safeLog(`[CCXT Browser Wrapper] fetchTicker called for ${symbol} on ${this.id}`);
    }
    return {
      symbol,
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      high: 100 + Math.random() * 10,
      low: 90 + Math.random() * 10,
      bid: 95 + Math.random() * 10,
      ask: 96 + Math.random() * 10,
      last: 95.5 + Math.random() * 10,
      open: 94 + Math.random() * 10,
      close: 95.5 + Math.random() * 10,
      average: 95 + Math.random() * 10,
      baseVolume: 1000 + Math.random() * 1000,
      quoteVolume: 95000 + Math.random() * 10000,
      info: {}
    };
  }

  async fetchTickers(symbols) {
    if (!isProduction) {
      safeLog(`[CCXT Browser Wrapper] fetchTickers called for ${symbols.join(', ')} on ${this.id}`);
    }
    const result = {};
    for (const symbol of symbols) {
      result[symbol] = await this.fetchTicker(symbol);
    }
    return result;
  }

  async fetchTime() {
    return Date.now();
  }

  async createOrder(symbol, type, side, amount, price = undefined, params = {}) {
    if (!isProduction) {
      safeLog(`[CCXT Browser Wrapper] createOrder called: ${side} ${amount} ${symbol} @ ${price || 'market price'}`);
    }
    return {
      id: `mock-order-${Date.now()}`,
      symbol,
      type,
      side,
      amount,
      price,
      status: 'open',
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      info: {}
    };
  }

  async cancelOrder(id, symbol = undefined, params = {}) {
    if (!isProduction) {
      safeLog(`[CCXT Browser Wrapper] cancelOrder called for order ${id}`);
    }
    return {
      id,
      symbol,
      status: 'canceled',
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      info: {}
    };
  }
}

// Create exchange constructors
const exchanges = {
  binance: function(config) {
    return new MockExchange({ ...config, id: 'binance' });
  },
  bybit: function(config) {
    return new MockExchange({ ...config, id: 'bybit' });
  },
  bitmart: function(config) {
    return new MockExchange({ ...config, id: 'bitmart' });
  },
  bitget: function(config) {
    return new MockExchange({ ...config, id: 'bitget' });
  },
  okx: function(config) {
    return new MockExchange({ ...config, id: 'okx' });
  },
  coinbase: function(config) {
    return new MockExchange({ ...config, id: 'coinbase' });
  },
  kraken: function(config) {
    return new MockExchange({ ...config, id: 'kraken' });
  }
};

// Export individual exchange constructors
export const binance = exchanges.binance;
export const bybit = exchanges.bybit;
export const bitmart = exchanges.bitmart;
export const bitget = exchanges.bitget;
export const okx = exchanges.okx;
export const coinbase = exchanges.coinbase;
export const kraken = exchanges.kraken;

// Default export for compatibility with "import ccxt from 'ccxt'"
export default exchanges;
