import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { indicatorService } from './indicator-service';
import { exchangeService } from './exchange-service';
import type { Strategy, MarketData, MarketCondition, TimeFrame } from './types';

export class MarketMonitor extends EventEmitter {
  private static instance: MarketMonitor;
  private strategies: Map<string, Strategy> = new Map();
  private marketData: Map<string, MarketData> = new Map();
  private readonly UPDATE_INTERVAL = 60000; // 1 minute
  private readonly ANALYSIS_INTERVAL = 300000; // 5 minutes

  private constructor() {
    super();
    this.startMonitoring();
  }

  static getInstance(): MarketMonitor {
    if (!MarketMonitor.instance) {
      MarketMonitor.instance = new MarketMonitor();
    }
    return MarketMonitor.instance;
  }

  async addStrategy(strategy: Strategy): Promise<void> {
    try {
      this.strategies.set(strategy.id, strategy);
      await this.updateMarketData(strategy);
      await this.analyzeMarketConditions(strategy);
      
      logService.log('info', `Started market monitoring for strategy ${strategy.id}`, 
        { strategy: strategy.id }, 'MarketMonitor');
    } catch (error) {
      logService.log('error', `Failed to add strategy to market monitor`, 
        { strategy: strategy.id, error }, 'MarketMonitor');
      throw error;
    }
  }

  private async startMonitoring(): Promise<void> {
    setInterval(() => {
      this.strategies.forEach(strategy => {
        this.updateMarketData(strategy).catch(error => {
          logService.log('error', 'Market data update failed', 
            { strategy: strategy.id, error }, 'MarketMonitor');
        });
      });
    }, this.UPDATE_INTERVAL);

    setInterval(() => {
      this.strategies.forEach(strategy => {
        this.analyzeMarketConditions(strategy).catch(error => {
          logService.log('error', 'Market analysis failed', 
            { strategy: strategy.id, error }, 'MarketMonitor');
        });
      });
    }, this.ANALYSIS_INTERVAL);
  }

  private async updateMarketData(strategy: Strategy): Promise<void> {
    try {
      const timeframes: TimeFrame[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
      const marketData: MarketData = {
        timestamp: Date.now(),
        pairs: {}
      };

      await Promise.all(strategy.tradingPairs.map(async pair => {
        const pairData = await Promise.all(timeframes.map(async timeframe => {
          const candles = await exchangeService.getCandles(pair, timeframe, 100);
          const volume = await exchangeService.get24hVolume(pair);
          const orderBook = await exchangeService.getOrderBook(pair);

          return {
            timeframe,
            candles,
            volume,
            orderBook,
            indicators: await this.calculateIndicators(candles, timeframe)
          };
        }));

        marketData.pairs[pair] = Object.fromEntries(
          pairData.map((data, i) => [timeframes[i], data])
        );
      }));

      this.marketData.set(strategy.id, marketData);
      this.emit('marketDataUpdate', { strategyId: strategy.id, marketData });
    } catch (error) {
      logService.log('error', 'Failed to update market data', 
        { strategy: strategy.id, error }, 'MarketMonitor');
      throw error;
    }
  }

  private async calculateIndicators(candles: any[], timeframe: TimeFrame) {
    return {
      sma: await indicatorService.calculateIndicator(
        { type: 'SMA', period: 20 },
        candles
      ),
      ema: await indicatorService.calculateIndicator(
        { type: 'EMA', period: 20 },
        candles
      ),
      rsi: await indicatorService.calculateIndicator(
        { type: 'RSI', period: 14 },
        candles
      ),
      macd: await indicatorService.calculateIndicator(
        { type: 'MACD', period: null },
        candles
      ),
      bb: await indicatorService.calculateIndicator(
        { type: 'BB', period: 20 },
        candles
      )
    };
  }

  private async analyzeMarketConditions(strategy: Strategy): Promise<void> {
    try {
      const marketData = this.marketData.get(strategy.id);
      if (!marketData) return;

      const conditions: MarketCondition = {
        timestamp: Date.now(),
        volatility: this.calculateVolatility(marketData),
        trend: this.identifyTrend(marketData),
        volume: this.analyzeVolume(marketData),
        liquidity: this.assessLiquidity(marketData),
        sentiment: await this.analyzeSentiment(marketData)
      };

      this.emit('marketConditionUpdate', {
        strategyId: strategy.id,
        conditions
      });
    } catch (error) {
      logService.log('error', 'Failed to analyze market conditions', 
        { strategy: strategy.id, error }, 'MarketMonitor');
      throw error;
    }
  }

  private calculateVolatility(marketData: MarketData): number {
    // Implementation of volatility calculation using standard deviation
    // of price changes across different timeframes
    return 0; // Placeholder
  }

  private identifyTrend(marketData: MarketData): 'uptrend' | 'downtrend' | 'sideways' {
    // Implementation of trend identification using multiple indicators
    // and timeframe correlation
    return 'sideways'; // Placeholder
  }

  private analyzeVolume(marketData: MarketData): {
    level: 'high' | 'medium' | 'low';
    change24h: number;
  } {
    // Implementation of volume analysis comparing current volume
    // to historical averages
    return { level: 'medium', change24h: 0 }; // Placeholder
  }

  private assessLiquidity(marketData: MarketData): {
    score: number;
    spreadAvg: number;
    depth: number;
  } {
    // Implementation of liquidity assessment using order book analysis
    return { score: 0, spreadAvg: 0, depth: 0 }; // Placeholder
  }

  private async analyzeSentiment(marketData: MarketData): Promise<{
    score: number;
    signals: string[];
  }> {
    // Implementation of market sentiment analysis using technical indicators
    // and possibly external data sources
    return { score: 0, signals: [] }; // Placeholder
  }

  getMarketData(strategyId: string): MarketData | undefined {
    return this.marketData.get(strategyId);
  }

  removeStrategy(strategyId: string): void {
    this.strategies.delete(strategyId);
    this.marketData.delete(strategyId);
    logService.log('info', `Stopped market monitoring for strategy ${strategyId}`, 
      { strategyId }, 'MarketMonitor');
  }
}

export const marketMonitor = MarketMonitor.getInstance();
