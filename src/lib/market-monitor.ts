import { EventEmitter } from './event-emitter';
import { bitmartService } from './bitmart-service';
import { SMA, RSI, MACD } from 'technicalindicators';
import { logService } from './log-service';
import type { Strategy } from './supabase-types';

interface MarketState {
  trend: 'bullish' | 'bearish' | 'sideways';
  volatility: 'low' | 'medium' | 'high';
  volume: 'low' | 'medium' | 'high';
  momentum: number;
  strength: number;
}

interface MarketData {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IndicatorValue {
  name: string;
  value: number;
  signal?: number;
  upper?: number;
  lower?: number;
}

class MarketMonitor extends EventEmitter {
  private static instance: MarketMonitor;
  private monitoredAssets: Map<string, MarketState> = new Map();
  private historicalData: Map<string, MarketData[]> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 15000; // 15 seconds
  private assetSubscriptions = new Set<string>();
  private hasActiveStrategies = false;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    super();
  }

  static getInstance(): MarketMonitor {
    if (!MarketMonitor.instance) {
      MarketMonitor.instance = new MarketMonitor();
    }
    return MarketMonitor.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      try {
        logService.log('info', 'Initializing market monitor', null, 'MarketMonitor');
        
        // Set up WebSocket listeners
        bitmartService.on('priceUpdate', this.handlePriceUpdate.bind(this));
        
        // Start periodic market state updates
        this.startMonitoring();
        
        this.initialized = true;
        logService.log('info', 'Market monitor initialized successfully', null, 'MarketMonitor');
      } catch (error) {
        logService.log('error', 'Failed to initialize market monitor', error, 'MarketMonitor');
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  private handlePriceUpdate(data: any) {
    if (!data.symbol || !this.monitoredAssets.has(data.symbol)) return;
    
    this.updateMarketState(data.symbol).catch(error => {
      logService.log('error', `Error updating market state for ${data.symbol}`, error, 'MarketMonitor');
    });
  }

  private startMonitoring() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.monitoredAssets.forEach((_, symbol) => {
        this.updateMarketState(symbol).catch(error => {
          logService.log('error', `Error updating market state for ${symbol}`, error, 'MarketMonitor');
        });
      });
    }, this.UPDATE_INTERVAL);
    
    logService.log('info', `Market monitoring started with interval: ${this.UPDATE_INTERVAL}ms`, null, 'MarketMonitor');
  }

  async addAsset(symbol: string) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const normalizedSymbol = symbol.includes('/') ? symbol.replace('/', '_') : symbol;
      
      if (this.monitoredAssets.has(normalizedSymbol)) {
        return;
      }

      logService.log('info', `Adding asset to monitor: ${normalizedSymbol}`, null, 'MarketMonitor');

      this.assetSubscriptions.add(normalizedSymbol);
      this.hasActiveStrategies = true;

      // Subscribe to real-time updates
      bitmartService.subscribeToSymbol(normalizedSymbol);

      // Initialize historical data
      const now = Math.floor(Date.now() / 1000);
      const sevenDaysAgo = now - (7 * 24 * 60 * 60);
      
      try {
        const ticker = await bitmartService.getTicker(normalizedSymbol);
        const price = parseFloat(ticker.last_price);
        const historicalData = [{
          symbol: normalizedSymbol,
          timestamp: now * 1000,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: parseFloat(ticker.quote_volume_24h)
        }];
        this.historicalData.set(normalizedSymbol, historicalData);
      } catch (error) {
        logService.log('warn', `Error fetching initial data for ${normalizedSymbol}`, error, 'MarketMonitor');
        // Initialize with current timestamp and price 100
        const historicalData = [{
          symbol: normalizedSymbol,
          timestamp: now * 1000,
          open: 100,
          high: 100,
          low: 100,
          close: 100,
          volume: 1000000
        }];
        this.historicalData.set(normalizedSymbol, historicalData);
      }
      
      // Calculate and store initial market state
      const state = await this.calculateMarketState(normalizedSymbol);
      this.monitoredAssets.set(normalizedSymbol, state);

      logService.log('info', `Successfully added asset to monitor: ${normalizedSymbol}`, null, 'MarketMonitor');
    } catch (error) {
      logService.log('error', `Error adding asset ${symbol} to monitor:`, error, 'MarketMonitor');
      throw error;
    }
  }

  removeAsset(symbol: string) {
    const normalizedSymbol = symbol.includes('/') ? symbol.replace('/', '_') : symbol;
    this.monitoredAssets.delete(normalizedSymbol);
    this.historicalData.delete(normalizedSymbol);
    this.assetSubscriptions.delete(normalizedSymbol);
    bitmartService.unsubscribeFromSymbol(normalizedSymbol);

    this.hasActiveStrategies = this.assetSubscriptions.size > 0;
    logService.log('info', `Removed asset from monitor: ${normalizedSymbol}`, null, 'MarketMonitor');
  }

  private async updateMarketState(symbol: string) {
    try {
      const ticker = await bitmartService.getTicker(symbol);
      const price = parseFloat(ticker.last_price);
      
      // Update historical data
      const data = this.historicalData.get(symbol) || [];
      data.push({
        symbol,
        timestamp: Date.now(),
        open: parseFloat(ticker.open_24h),
        high: parseFloat(ticker.high_24h),
        low: parseFloat(ticker.low_24h),
        close: price,
        volume: parseFloat(ticker.quote_volume_24h)
      });

      // Keep only the latest 1000 data points
      if (data.length > 1000) {
        data.splice(0, data.length - 1000);
      }
      this.historicalData.set(symbol, data);
      
      // Calculate and update market state
      const state = await this.calculateMarketState(symbol);
      this.monitoredAssets.set(symbol, state);
      
      // Emit market update event
      this.emit('marketUpdate', {
        symbol,
        state,
        price,
        timestamp: Date.now()
      });
    } catch (error) {
      logService.log('warn', `Error updating market state for ${symbol}:`, error, 'MarketMonitor');
    }
  }

  private async calculateMarketState(symbol: string): Promise<MarketState> {
    const data = this.historicalData.get(symbol);
    if (!data || data.length < 2) {
      return {
        trend: 'sideways',
        volatility: 'medium',
        volume: 'medium',
        momentum: 0,
        strength: 50
      };
    }

    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume);

    // Calculate simple trend
    const lastPrice = closes[closes.length - 1];
    const prevPrice = closes[closes.length - 2];
    const trend = lastPrice > prevPrice ? 'bullish' : lastPrice < prevPrice ? 'bearish' : 'sideways';

    // Calculate volatility
    const priceChanges = closes.slice(1).map((price, i) => 
      Math.abs((price - closes[i]) / closes[i]) * 100
    );
    const avgVolatility = priceChanges.reduce((sum, val) => sum + val, 0) / priceChanges.length;
    const volatility = avgVolatility > 2 ? 'high' : avgVolatility > 1 ? 'medium' : 'low';

    // Calculate volume level
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const lastVolume = volumes[volumes.length - 1];
    const volume = lastVolume > avgVolume * 1.5 ? 'high' : 
                  lastVolume > avgVolume * 0.5 ? 'medium' : 'low';

    // Calculate momentum (-100 to 100)
    const momentum = ((lastPrice - prevPrice) / prevPrice) * 100;

    // Calculate overall strength (0-100)
    const strength = 50 + (momentum / 2);

    return {
      trend,
      volatility,
      volume,
      momentum,
      strength
    };
  }

  async getIndicatorValues(symbol: string, indicators: any[]): Promise<IndicatorValue[]> {
    const data = this.historicalData.get(symbol);
    if (!data || data.length < 2) {
      throw new Error('Insufficient historical data');
    }

    const closes = data.map(d => d.close);
    const results: IndicatorValue[] = [];

    for (const indicator of indicators) {
      try {
        switch (indicator.name.toLowerCase()) {
          case 'rsi': {
            const values = RSI.calculate({
              period: indicator.parameters?.period || 14,
              values: closes
            });
            results.push({
              name: 'RSI',
              value: values[values.length - 1] || 50
            });
            break;
          }
          case 'macd': {
            const values = MACD.calculate({
              fastPeriod: indicator.parameters?.fastPeriod || 12,
              slowPeriod: indicator.parameters?.slowPeriod || 26,
              signalPeriod: indicator.parameters?.signalPeriod || 9,
              values: closes
            });
            const lastValue = values[values.length - 1];
            results.push({
              name: 'MACD',
              value: lastValue?.MACD || 0,
              signal: lastValue?.signal || 0
            });
            break;
          }
          case 'sma': {
            const values = SMA.calculate({
              period: indicator.parameters?.period || 20,
              values: closes
            });
            results.push({
              name: 'SMA',
              value: values[values.length - 1] || closes[closes.length - 1]
            });
            break;
          }
          case 'bollinger': {
            const bb = BollingerBands.calculate({
              period: indicator.parameters?.period || 20,
              stdDev: indicator.parameters?.stdDev || 2,
              values: closes
            });
            const lastBB = bb[bb.length - 1];
            results.push({
              name: 'Bollinger',
              value: lastBB?.middle || closes[closes.length - 1],
              upper: lastBB?.upper,
              lower: lastBB?.lower
            });
            break;
          }
        }
      } catch (error) {
        logService.log('warn', `Error calculating ${indicator.name}:`, error, 'MarketMonitor');
      }
    }

    return results;
  }

  getMarketState(symbol: string): MarketState | undefined {
    return this.monitoredAssets.get(symbol);
  }

  getHistoricalData(symbol: string, period: number): MarketData[] {
    const data = this.historicalData.get(symbol);
    if (!data) return [];
    
    const cutoff = Date.now() - period;
    return data.filter(d => d.timestamp >= cutoff);
  }

  isMonitoringAsset(symbol: string): boolean {
    return this.monitoredAssets.has(symbol);
  }

  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.monitoredAssets.clear();
    this.historicalData.clear();
    this.assetSubscriptions.clear();
    this.hasActiveStrategies = false;
    this.initialized = false;
    logService.log('info', 'Market monitor cleaned up', null, 'MarketMonitor');
  }
}

export const marketMonitor = MarketMonitor.getInstance();
