import { supabase } from './supabase';
import { EventEmitter } from './event-emitter';
import { exchangeService } from './exchange-service';
import { marketMonitor } from './market-monitor';
import { logService } from './log-service';
import type { Strategy, StrategyTrade } from './supabase-types';

interface AnalyticsData {
  timestamp: number;
  strategyId: string;
  metrics: {
    performance: number;
    drawdown: number;
    volatility: number;
  };
  trades: {
    active: number;
    total: number;
    profitable: number;
    avgDuration: number;
  };
  portfolio: any;
}

class AnalyticsService extends EventEmitter {
  private static instance: AnalyticsService | null = null;
  private analyticsData: Map<string, AnalyticsData[]>;
  private updateInterval: NodeJS.Timeout | null;
  private readonly STORAGE_KEY: string;
  private readonly UPDATE_INTERVAL: number;
  private initialized: boolean;
  private initializationPromise: Promise<void> | null;

  private constructor() {
    super();
    this.analyticsData = new Map();
    this.updateInterval = null;
    this.STORAGE_KEY = 'stratgen_analytics';
    this.UPDATE_INTERVAL = 60000; // 1 minute
    this.initialized = false;
    this.initializationPromise = null;

    // Bind methods to instance
    this.initialize = this.initialize.bind(this);
    this.loadStoredData = this.loadStoredData.bind(this);
    this.saveData = this.saveData.bind(this);
    this.startPeriodicUpdates = this.startPeriodicUpdates.bind(this);
    this.trackStrategy = this.trackStrategy.bind(this);
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      try {
        // Load stored data
        this.loadStoredData();

        // Start periodic updates
        this.startPeriodicUpdates();

        // Load active strategies
        const { data: strategies, error } = await supabase
          .from('strategies')
          .select('*')
          .eq('status', 'active');

        if (error) throw error;

        if (strategies) {
          // Initialize analytics for each active strategy
          for (const strategy of strategies) {
            await this.trackStrategy(strategy);
          }
        }

        this.initialized = true;
        logService.log('info', 'Analytics service initialized successfully', null, 'AnalyticsService');
      } catch (error) {
        logService.log('error', 'Failed to initialize analytics service', error, 'AnalyticsService');
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  private loadStoredData(): void {
    try {
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        Object.entries(parsed).forEach(([key, value]) => {
          this.analyticsData.set(key, value as AnalyticsData[]);
        });
      }
    } catch (error) {
      logService.log('error', 'Error loading stored analytics data', error, 'AnalyticsService');
    }
  }

  private saveData(): void {
    try {
      const data: Record<string, AnalyticsData[]> = {};
      this.analyticsData.forEach((value, key) => {
        data[key] = value;
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      logService.log('error', 'Error saving analytics data', error, 'AnalyticsService');
    }
  }

  private startPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.analyticsData.forEach((_, strategyId) => {
        this.updateAnalytics(strategyId).catch(error => {
          logService.log('error', `Error in periodic update for ${strategyId}`, error, 'AnalyticsService');
        });
      });
    }, this.UPDATE_INTERVAL);
  }

  async trackStrategy(strategy: Strategy): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.analyticsData.has(strategy.id)) {
      this.analyticsData.set(strategy.id, []);
    }
    await this.updateAnalytics(strategy.id);
  }

  private async updateAnalytics(strategyId: string): Promise<void> {
    try {
      const { data: strategy } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', strategyId)
        .single();

      if (!strategy) return;

      const { data: trades } = await supabase
        .from('strategy_trades')
        .select('*')
        .eq('strategy_id', strategyId);

      if (!trades) return;

      // Calculate metrics
      const activeTrades = trades.filter(t => t.status === 'open');
      const closedTrades = trades.filter(t => t.status === 'closed');
      const profitableTrades = closedTrades.filter(t => t.pnl > 0);

      // Get market data for each asset
      const assetMetrics = await Promise.all(
        strategy.strategy_config.assets.map(async (symbol: string) => {
          const marketState = marketMonitor.getMarketState(symbol);
          const ticker = await exchangeService.fetchTicker(symbol);
          return { marketState, ticker };
        })
      );

      // Calculate aggregated metrics
      const metrics = this.calculateAggregatedMetrics(trades, assetMetrics);

      // Calculate portfolio metrics
      const portfolio = await this.calculatePortfolioMetrics(strategy, trades);

      // Create analytics entry
      const analyticsEntry: AnalyticsData = {
        strategyId,
        timestamp: Date.now(),
        metrics: {
          performance: metrics.performance,
          drawdown: metrics.drawdown,
          volatility: metrics.volatility
        },
        trades: {
          active: activeTrades.length,
          total: trades.length,
          profitable: profitableTrades.length,
          avgDuration: this.calculateAverageDuration(closedTrades)
        },
        portfolio
      };

      // Store analytics
      const strategyData = this.analyticsData.get(strategyId) || [];
      strategyData.push(analyticsEntry);
      
      // Keep last 24 hours of data
      const cutoff = Date.now() - (24 * 60 * 60 * 1000);
      const filteredData = strategyData.filter(d => d.timestamp >= cutoff);
      this.analyticsData.set(strategyId, filteredData);

      // Save to local storage
      this.saveData();

      // Emit update
      this.emit('analyticsUpdate', analyticsEntry);
    } catch (error) {
      logService.log('warn', `Error updating analytics for ${strategyId}:`, error, 'AnalyticsService');
    }
  }

  private calculateAggregatedMetrics(trades: StrategyTrade[], assetMetrics: any[]): any {
    const activeTrades = trades.filter(t => t.status === 'open');
    const initialEquity = 10000; // Example initial equity

    // Calculate current equity
    const equity = initialEquity + trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    // Calculate total PnL
    const pnl = (equity - initialEquity) / initialEquity * 100;

    // Calculate drawdown
    const equityHistory = trades.map((t, i) => {
      const tradesPnL = trades.slice(0, i + 1).reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      return initialEquity + tradesPnL;
    });

    const maxEquity = Math.max(...equityHistory);
    const currentDrawdown = ((maxEquity - equity) / maxEquity) * 100;
    const maxDrawdown = Math.max(...equityHistory.map((eq, i) => {
      const subsequentMin = Math.min(...equityHistory.slice(i));
      return ((eq - subsequentMin) / eq) * 100;
    }));

    // Calculate volume and exposure
    const volume = activeTrades.reduce((sum, t) => sum + ((t.entry_price || 0) * (t.current_price || 0)), 0);
    const exposure = activeTrades.reduce((sum, t) => sum + (t.entry_price || 0), 0);

    // Calculate risk metrics
    const riskScore = this.calculateRiskScore(assetMetrics);
    const volatility = this.calculateVolatility(assetMetrics);
    const valueAtRisk = this.calculateValueAtRisk(trades, assetMetrics);
    const sharpeRatio = this.calculateSharpeRatio(trades);
    const beta = this.calculateBeta(trades, assetMetrics);
    const momentum = this.calculateMomentum(assetMetrics);

    return {
      performance: pnl,
      drawdown: currentDrawdown,
      maxDrawdown,
      volume,
      exposure,
      riskScore,
      volatility,
      valueAtRisk,
      sharpeRatio,
      beta,
      momentum
    };
  }

  private calculateRiskScore(metrics: any[]): number {
    // Implementation needed
    return 0;
  }

  private calculateVolatility(metrics: any[]): number {
    // Implementation needed
    return 0;
  }

  private calculateValueAtRisk(trades: StrategyTrade[], assetMetrics: any[]): number {
    try {
      const returns = trades.map((t, i) => 
        i === 0 ? 0 : ((t.pnl || 0) / (trades[i-1].entry_price || 1)) * 100
      );
      
      // Calculate 95% VaR using historical simulation
      const sortedReturns = returns.sort((a, b) => a - b);
      const varIndex = Math.floor(0.05 * sortedReturns.length);
      const var95 = Math.abs(sortedReturns[varIndex] || 0);
      
      // Adjust VaR based on current exposure and volatility
      const totalExposure = trades.reduce((sum, t) => sum + (t.entry_price || 0), 0);
      const avgVolatility = this.calculateVolatility(assetMetrics);
      
      return (var95 * totalExposure * avgVolatility) / 100;
    } catch (error) {
      logService.log('error', 'Error calculating Value at Risk', error, 'AnalyticsService');
      return 0;
    }
  }

  private calculateSharpeRatio(trades: StrategyTrade[]): number {
    // Implementation needed
    return 0;
  }

  private calculateBeta(trades: StrategyTrade[], assetMetrics: any[]): number {
    // Implementation needed
    return 0;
  }

  private calculateMomentum(assetMetrics: any[]): number {
    // Implementation needed
    return 0;
  }

  private determineOverallTrend(assetMetrics: any[]): string {
    // Implementation needed
    return 'neutral';
  }

  private determineOverallSentiment(assetMetrics: any[]): string {
    // Implementation needed
    return 'neutral';
  }

  private determineVolumeLevel(assetMetrics: any[]): number {
    // Implementation needed
    return 0;
  }

  private calculateAverageDuration(trades: StrategyTrade[]): number {
    // Implementation needed
    return 0;
  }

  private async calculatePortfolioMetrics(strategy: Strategy, trades: StrategyTrade[]): Promise<any> {
    // Implementation needed
    return {};
  }

  getStrategyAnalytics(strategyId: string): AnalyticsData[] {
    return this.analyticsData.get(strategyId) || [];
  }

  getLatestAnalytics(strategyId: string): AnalyticsData | null {
    const data = this.analyticsData.get(strategyId);
    if (!data || data.length === 0) return null;
    return data[data.length - 1];
  }

  getDashboardMetrics(): any {
    const allMetrics = Array.from(this.analyticsData.values())
      .flatMap(data => data)
      .filter(d => d.timestamp >= Date.now() - (24 * 60 * 60 * 1000));

    if (allMetrics.length === 0) {
      return {
        totalEquity: 0,
        totalPnl: 0,
        totalExposure: 0,
        avgWinRate: 0,
        totalTrades: 0,
        riskProfile: {
          current: 5,
          average: 5,
          trend: 'stable'
        }
      };
    }

    const metrics = {
      totalEquity: allMetrics.reduce((sum, d) => sum + d.metrics.equity, 0),
      totalPnl: allMetrics.reduce((sum, d) => sum + d.metrics.pnl, 0) / allMetrics.length,
      totalExposure: allMetrics.reduce((sum, d) => sum + d.metrics.exposure, 0),
      avgWinRate: allMetrics.reduce((sum, d) => sum + d.metrics.winRate, 0) / allMetrics.length,
      totalTrades: allMetrics.reduce((sum, d) => sum + d.trades.total, 0),
      riskProfile: this.calculateOverallRiskProfile(allMetrics),
      marketSentiment: this.calculateOverallMarketSentiment(allMetrics),
      volumeProfile: this.calculateVolumeProfile(allMetrics)
    };

    return metrics;
  }

  private calculateOverallRiskProfile(metrics: AnalyticsData[]): any {
    const riskScores = metrics.map(m => m.metrics.riskScore);
    const current = riskScores[riskScores.length - 1] || 0;
    const average = riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length;
    
    // Calculate trend
    const recentScores = riskScores.slice(-5); // Look at last 5 data points
    const trend = recentScores.length > 1
      ? recentScores[recentScores.length - 1] > recentScores[0]
        ? 'increasing'
        : recentScores[recentScores.length - 1] < recentScores[0]
          ? 'decreasing'
          : 'stable'
      : 'stable';

    return { current, average, trend };
  }

  private calculateOverallMarketSentiment(metrics: AnalyticsData[]): any {
    const sentiments = metrics.map(m => m.marketState.sentiment);
    const bullish = sentiments.filter(s => s === 'bullish').length;
    const bearish = sentiments.filter(s => s === 'bearish').length;
    const neutral = sentiments.filter(s => s === 'neutral').length;

    return {
      primary: bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral',
      distribution: {
        bullish: (bullish / sentiments.length) * 100,
        bearish: (bearish / sentiments.length) * 100,
        neutral: (neutral / sentiments.length) * 100
      }
    };
  }

  private calculateVolumeProfile(metrics: AnalyticsData[]): any {
    const volumes = metrics.map(m => m.marketState.volume);
    const high = volumes.filter(v => v === 'high').length;
    const medium = volumes.filter(v => v === 'medium').length;
    const low = volumes.filter(v => v === 'low').length;

    return {
      current: volumes[volumes.length - 1] || 'medium',
      distribution: {
        high: (high / volumes.length) * 100,
        medium: (medium / volumes.length) * 100,
        low: (low / volumes.length) * 100
      }
    };
  }

  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.analyticsData.clear();
    this.saveData();
    this.initialized = false;
  }

  async getMarketSentiment(): Promise<string> {
    // Implement market sentiment analysis
    const metrics = await this.getMarketMetrics();
    return this.analyzeSentiment(metrics);
  }

  async getVolatilityIndex(): Promise<number> {
    // Implement volatility index calculation
    const metrics = await this.getMarketMetrics();
    return this.calculateVolatilityIndex(metrics);
  }

  async getLiquidityMetrics(): Promise<number> {
    // Implement liquidity analysis
    const metrics = await this.getMarketMetrics();
    return this.analyzeLiquidity(metrics);
  }

  async getTrendAnalysis(): Promise<number> {
    // Implement trend strength analysis
    const metrics = await this.getMarketMetrics();
    return this.analyzeTrendStrength(metrics);
  }

  private analyzeSentiment(metrics: any): string {
    // Implement sentiment analysis logic
    // Return 'bullish', 'bearish', or 'neutral'
  }

  private calculateVolatilityIndex(metrics: any): number {
    // Implement volatility index calculation
    // Return 0-100 score
  }

  private analyzeLiquidity(metrics: any): number {
    // Implement liquidity analysis
    // Return 0-100 score
  }

  private analyzeTrendStrength(metrics: any): number {
    // Implement trend strength calculation
    // Return 0-100 score
  }
}

export const analyticsService = AnalyticsService.getInstance();
