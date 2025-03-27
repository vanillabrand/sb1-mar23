import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { exchangeService } from './exchange-service';
import { CACHE_DURATIONS } from '@/lib/constants';

class MarketDataService extends EventEmitter {
  private static instance: MarketDataService;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  private constructor() {
    super();
  }

  public static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<any[]> {
    try {
      const cacheKey = `${symbol}-${timeframe}-${limit}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_DURATIONS.MARKET_DATA) {
        return cached.data;
      }

      const candles = await exchangeService.getCandles(symbol, timeframe, limit);
      
      this.cache.set(cacheKey, {
        data: candles,
        timestamp: Date.now()
      });

      return candles;
    } catch (error) {
      logService.log('error', 'Failed to fetch candles', error, 'MarketDataService');
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
  }
}

export const marketDataService = MarketDataService.getInstance();