import axios from 'axios';
import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { config } from './config';

interface Asset {
  id: string;
  rank: string;
  symbol: string;
  name: string;
  priceUsd: string;
  changePercent24Hr: string;
  volumeUsd24Hr: string;
  marketCapUsd: string;
  supply: string;
  maxSupply: string;
  vwap24Hr: string;
}

interface AssetHistory {
  priceUsd: string;
  time: number;
}

class CoinCapService extends EventEmitter {
  private static instance: CoinCapService;
  private readonly BASE_URL = config.getFullUrl('/api/coincap');
  private readonly WS_URL = 'wss://ws.coincap.io/prices/all'; // WebSockets will be handled separately
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 5000;
  private priceCache = new Map<string, number>();
  private historyCache = new Map<string, AssetHistory[]>();
  private updateInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.startWebSocket();
  }

  static getInstance(): CoinCapService {
    if (!CoinCapService.instance) {
      CoinCapService.instance = new CoinCapService();
    }
    return CoinCapService.instance;
  }

  private startWebSocket() {
    if (this.ws) {
      this.ws.close();
    }

    try {
      this.ws = new WebSocket(this.WS_URL);

      this.ws.onopen = () => {
        logService.log('info', 'CoinCap WebSocket connected', null, 'CoinCapService');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          Object.entries(data).forEach(([symbol, price]) => {
            this.priceCache.set(symbol, Number(price));
            this.emit('priceUpdate', { symbol, price: Number(price) });
          });
        } catch (error) {
          logService.log('error', 'Error parsing WebSocket message', error, 'CoinCapService');
        }
      };

      this.ws.onclose = () => {
        logService.log('warn', 'CoinCap WebSocket closed', null, 'CoinCapService');
        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          setTimeout(() => {
            this.reconnectAttempts++;
            this.startWebSocket();
          }, this.RECONNECT_DELAY);
        }
      };

      this.ws.onerror = (error) => {
        logService.log('error', 'CoinCap WebSocket error', error, 'CoinCapService');
      };
    } catch (error) {
      logService.log('error', 'Error starting WebSocket', error, 'CoinCapService');
    }
  }

  async getAssets(limit: number = 10): Promise<Asset[]> {
    try {
      const response = await axios.get(`${this.BASE_URL}/assets?limit=${limit}`);
      return response.data.data;
    } catch (error) {
      logService.log('error', 'Error fetching assets', error, 'CoinCapService');
      throw error;
    }
  }

  async getAssetHistory(id: string, interval: string = 'h1'): Promise<AssetHistory[]> {
    try {
      // Check cache first
      const cacheKey = `${id}-${interval}`;
      const cachedData = this.historyCache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const response = await axios.get(
        `${this.BASE_URL}/assets/${id}/history?interval=${interval}`
      );

      const history = response.data.data;
      this.historyCache.set(cacheKey, history);

      return history;
    } catch (error) {
      logService.log('error', `Error fetching history for ${id}`, error, 'CoinCapService');
      throw error;
    }
  }

  async getAssetPrice(symbol: string): Promise<number> {
    try {
      // Check WebSocket cache first
      const cachedPrice = this.priceCache.get(symbol);
      if (cachedPrice) {
        return cachedPrice;
      }

      // Fallback to REST API
      const response = await axios.get(`${this.BASE_URL}/assets/${symbol.toLowerCase()}`);
      const price = Number(response.data.data.priceUsd);
      this.priceCache.set(symbol, price);
      return price;
    } catch (error) {
      logService.log('error', `Error fetching price for ${symbol}`, error, 'CoinCapService');
      throw error;
    }
  }

  startPeriodicUpdates(interval: number = 10000) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      try {
        const assets = await this.getAssets();
        assets.forEach(asset => {
          this.priceCache.set(asset.symbol, Number(asset.priceUsd));
          this.emit('priceUpdate', {
            symbol: asset.symbol,
            price: Number(asset.priceUsd),
            change24h: Number(asset.changePercent24Hr),
            volume24h: Number(asset.volumeUsd24Hr),
            marketCap: Number(asset.marketCapUsd)
          });
        });
      } catch (error) {
        logService.log('error', 'Error in periodic update', error, 'CoinCapService');
      }
    }, interval);
  }

  stopPeriodicUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  cleanup() {
    this.stopPeriodicUpdates();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.priceCache.clear();
    this.historyCache.clear();
    this.reconnectAttempts = 0;
  }
}

export const coincapService = CoinCapService.getInstance();