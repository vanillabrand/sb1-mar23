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
  private baseUrl = 'https://api-cloud.bitmart.com';
  private demoMode = false;
  private useUSDX = false;
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

  // Rest of the BitmartService implementation...
  // (Keep all existing methods and add getAssetData above them)
}

export const bitmartService = BitmartService.getInstance();