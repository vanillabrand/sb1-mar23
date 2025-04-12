import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import type { MarketData } from './types';

class MarketDataService extends EventEmitter {
  private marketData: Map<string, MarketData> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly UPDATE_INTERVAL = 5000; // 5 seconds

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    try {
      logService.log('info', 'Initializing market data service', null, 'MarketDataService');
      // Add any initialization logic here
      return Promise.resolve();
    } catch (error) {
      logService.log('error', 'Failed to initialize market data service', error, 'MarketDataService');
      throw error;
    }
  }

  async getMarketData(symbol: string): Promise<MarketData | undefined> {
    return this.marketData.get(symbol);
  }

  async updateMarketData(symbol: string, data: MarketData): Promise<void> {
    this.marketData.set(symbol, data);
    this.emit('marketDataUpdated', { symbol, data });
  }

  startTracking(symbol: string): void {
    if (this.updateIntervals.has(symbol)) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        // Implement your market data fetching logic here
        // For now, we'll just log that we're updating
        logService.log('debug', `Updating market data for ${symbol}`, null, 'MarketDataService');
      } catch (error) {
        logService.log('error', `Failed to update market data for ${symbol}`, error, 'MarketDataService');
      }
    }, this.UPDATE_INTERVAL);

    this.updateIntervals.set(symbol, intervalId);
  }

  stopTracking(symbol: string): void {
    const intervalId = this.updateIntervals.get(symbol);
    if (intervalId) {
      clearInterval(intervalId);
      this.updateIntervals.delete(symbol);
    }
  }

  cleanup(): void {
    this.updateIntervals.forEach((intervalId) => clearInterval(intervalId));
    this.updateIntervals.clear();
    this.marketData.clear();
  }
}

// Create and export a singleton instance
export const marketDataService = new MarketDataService();
