import { supabase } from './supabase';
import { EventEmitter } from './event-emitter';
import { exchangeService } from './exchange-service';
import { marketMonitor } from './market-monitor';
import { logService } from './log-service';
import type { Strategy, StrategyTrade } from './supabase-types';

interface AnalyticsData {
  strategyId: string;
  timestamp: number;
  metrics: {
    equity: number;
    pnl: number;
    drawdown: number;
    winRate: number;
    volume: number;
    exposure: number;
    riskScore: number;
    volatility: number;
    valueAtRisk: number;
    maxDrawdown: number;
    sharpeRatio: number;
    beta: number;
  };
  marketState: {
    trend: string;
    sentiment: string;
    volume: string;
    momentum: number;
  };
  trades: {
    active: number;
    total: number;
    profitable: number;
    avgDuration: number;
  };
  portfolio: {
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    marginLevel: number;
    leverage: number;
  };
}

class AnalyticsService extends EventEmitter {
  private static instance: AnalyticsService;
  private analyticsData: Map<string, AnalyticsData[]> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly STORAGE_KEY = 'stratgen_analytics';
  private readonly UPDATE_INTERVAL = 60000; // 1 minute
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    super();
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
        const { data: strategies } = await supabase
          .from('strategies')
          .select('*')
          .eq('status', 'active');

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

  private loadStoredData() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        Object.entries(data).forEach(([key, value]) => {
          this.analyticsData.set(key, value as AnalyticsData[]);
        });
      }
    } catch (error) {
      logService.log('warn', 'Failed to load stored analytics data', error, 'AnalyticsService');
    }
  }

  private saveData() {
    try {
      const data = Object.fromEntries(this.analyticsData.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      logService.log('warn', 'Failed to save analytics data', error, 'AnalyticsService');
    }
  }

  private startPeriodicUpdates() {
    if (this.updateInterval) return;

    this.updateInterval = setInterval(() => {
      this.analyticsData.forEach((_, strategyId) => {
        this.updateAnalytics(strategyId);
      });
    }, this.UPDATE_INTERVAL);
  }

  async trackStrategy(strategy: Strategy) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.analyticsData.has(strategy.id)) {
      this.analyticsData.set(strategy.id, []);
    }
    await this.updateAnalytics(strategy.id);
  }

  private async updateAnalytics(strategyId: string) {
    try {
      // Get strategy data
      const { data: strategy } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', strategyId)
        .single();

      if (!strategy || !strategy.strategy_config?.assets) return;

      // Get trades data
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
          equity: metrics.equity,
          pnl: metrics.pnl,
          drawdown: metrics.drawdown,
          winRate: (profitableTrades.length / closedTrades.length) * 100 || 0,
          volume: metrics.volume,
          exposure: metrics.exposure,
          riskScore: metrics.riskScore,
          volatility: metrics.volatility,
          valueAtRisk: metrics.valueAtRisk,
          maxDrawdown: metrics.maxDrawdown,
          sharpeRatio: metrics.sharpeRatio,
          beta: metrics.beta
        },
        marketState: {
          trend: this.determineOverallTrend(assetMetrics),
          sentiment: this.determineOverallSentiment(assetMetrics),
          volume: this.determineVolumeLevel(assetMetrics),
          momentum: metrics.momentum
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

  private calculateAggregatedMetrics(trades: StrategyTrade[], assetMetrics: any[]) {
    const activeTrades = trades.filter(t => t.status === 'open');
    const initialEquity = 10000; // Example initial equity

    // Calculate current equity
    const equity = initialEquity + trades.reduce((sum, t) => sum + t.pnl, 0);

    // Calculate total PnL
    const pnl = (equity - initialEquity) / initialEquity * 100;

    // Calculate drawdown
    const equityHistory = trades.map((t, i) => {
      const tradesPnL = trades.slice(0, i + 1).reduce((sum, trade) => sum + trade.pnl, 0);
      return initialEquity + tradesPnL;
    });
    
    const maxEquity = Math.max(...equityHistory, initialEquity);
    const currentDrawdown = ((maxEquity - equity) / maxEquity) * 100;
    const maxDrawdown = Math.max(...equityHistory.map((eq, i) => {
      const peak = Math.max(...equityHistory.slice(0, i + 1));
      return ((peak - eq) / peak) * 100;
    }));

    // Calculate volume and exposure
    const volume = activeTrades.reduce((sum, t) => sum + (t.entry_price * t.current_price), 0);
    const exposure = activeTrades.reduce((sum, t) => sum + t.entry_price, 0);

    // Calculate risk metrics
    const riskScore = this.calculateRiskScore(assetMetrics);
    const volatility = this.calculateVolatility(assetMetrics);
    const valueAtRisk = this.calculateValueAtRisk(trades, assetMetrics);
    const sharpeRatio = this.calculateSharpeRatio(trades);
    const beta = this.calculateBeta(trades, assetMetrics);
    const momentum = this.calculateMomentum(assetMetrics);

    return {
      equity,
      pnl,
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

  private calculateRiskScore(assetMetrics: any[]): number {
    let riskScore = 0;
    const weights = {
      volatility: 0.3,
      volume: 0.2,
      momentum: 0.2,
      trend: 0.15,
      exposure: 0.15
    };

    assetMetrics.forEach(metric => {
      if (!metric.marketState) return;

      // Volatility component (0-10)
      const volatilityScore = metric.marketState.volatility === 'high' ? 10 :
                             metric.marketState.volatility === 'medium' ? 5 : 2;
      
      // Volume component (0-10)
      const volumeScore = metric.marketState.volume === 'high' ? 8 :
                         metric.marketState.volume === 'medium' ? 5 : 3;
      
      // Momentum component (0-10)
      const momentumScore = Math.min(10, Math.abs(metric.marketState.momentum) * 10);
      
      // Trend component (0-10)
      const trendScore = metric.marketState.trend === 'bullish' ? 7 :
                        metric.marketState.trend === 'bearish' ? 8 : 5;
      
      // Exposure component (0-10)
      const exposureScore = Math.min(10, (metric.ticker?.change24h || 0) / 2);

      // Calculate weighted average
      const score = (
        volatilityScore * weights.volatility +
        volumeScore * weights.volume +
        momentumScore * weights.momentum +
        trendScore * weights.trend +
        exposureScore * weights.exposure
      );

      riskScore += score;
    });

    // Average across all assets and normalize to 0-10 scale
    return Math.min(10, riskScore / assetMetrics.length);
  }

  private calculateVolatility(assetMetrics: any[]): number {
    return assetMetrics.reduce((total, metric) => {
      if (!metric.ticker) return total;
      const high = parseFloat(metric.ticker.high_24h);
      const low = parseFloat(metric.ticker.low_24h);
      const avg = (high + low) / 2;
      return total + ((high - low) / avg) * 100;
    }, 0) / assetMetrics.length;
  }

  private calculateValueAtRisk(trades: StrategyTrade[], assetMetrics: any[]): number {
    try {
      const returns = trades.map((t, i) => 
        i === 0 ? 0 : (t.pnl / trades[i-1].entry_price) * 100
      );
      
      // Calculate 95% VaR using historical simulation
      const sortedReturns = returns.sort((a, b) => a - b);
      const varIndex = Math.floor(0.05 * sortedReturns.length);
      const var95 = Math.abs(sortedReturns[varIndex] || 0);
      
      // Adjust VaR based on current exposure and volatility
      const totalExposure = trades.reduce((sum, t) => sum + t.entry_price, 0);
      const avgVolatility = this.calculateVolatility(assetMetrics);
      
      return (var95 * totalExposure * avgVolatility) / 100;
    } catch (error) {
      logService.log('error', 'Error calculating Value at Risk', error, 'AnalyticsService');
      return 0;
    }
  }

  private calculateSharpeRatio(trades: StrategyTrade[]): number {
    try {
      const returns = trades.map((t, i) => 
        i === 0 ? 0 : (t.pnl / trades[i-1].entry_price) * 100
      );
      
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const riskFreeRate = 2; // Assume 2% risk-free rate
      
      const stdDev = Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      );
      
      return stdDev === 0 ? 0 : (avgReturn - riskFreeRate) / stdDev;
    } catch (error) {
      logService.log('error', 'Error calculating Sharpe Ratio', error, 'AnalyticsService');
      return 0;
    }
  }

  private calculateBeta(trades: StrategyTrade[], assetMetrics: any[]): number {
    try {
      const returns = trades.map((t, i) => 
        i === 0 ? 0 : (t.pnl / trades[i-1].entry_price) * 100
      );
      
      // Use BTC as market benchmark
      const btcReturns = assetMetrics
        .filter(m => m.ticker?.symbol?.includes('BTC'))
        .map(m => parseFloat(m.ticker.change24h) || 0);
      
      if (returns.length === 0 || btcReturns.length === 0) return 1;
      
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const avgMarketReturn = btcReturns.reduce((sum, r) => sum + r, 0) / btcReturns.length;
      
      const covariance = returns.reduce((sum, r, i) => 
        sum + (r - avgReturn) * (btcReturns[i] - avgMarketReturn), 0
      ) / returns.length;
      
      const marketVariance = btcReturns.reduce((sum, r) => 
        sum + Math.pow(r - avgMarketReturn, 2), 0
      ) / btcReturns.length;
      
      return marketVariance === 0 ? 1 : covariance / marketVariance;
    } catch (error) {
      logService.log('error', 'Error calculating Beta', error, 'AnalyticsService');
      return 1;
    }
  }

  private calculateMomentum(assetMetrics: any[]): number {
    return assetMetrics.reduce((total, metric) => {
      if (!metric.marketState) return total;
      return total + (metric.marketState.momentum || 0);
    }, 0) / assetMetrics.length;
  }

  private determineOverallTrend(assetMetrics: any[]): string {
    const trends = assetMetrics
      .filter(m => m.marketState?.trend)
      .map(m => m.marketState.trend);

    if (trends.length === 0) return 'neutral';

    const bullCount = trends.filter(t => t === 'bullish').length;
    const bearCount = trends.filter(t => t === 'bearish').length;

    if (bullCount > bearCount) return 'bullish';
    if (bearCount > bullCount) return 'bearish';
    return 'neutral';
  }

  private determineOverallSentiment(assetMetrics: any[]): string {
    return this.determineOverallTrend(assetMetrics);
  }

  private determineVolumeLevel(assetMetrics: any[]): string {
    const volumes = assetMetrics
      .filter(m => m.marketState?.volume)
      .map(m => m.marketState.volume);

    if (volumes.length === 0) return 'medium';

    const highCount = volumes.filter(v => v === 'high').length;
    const lowCount = volumes.filter(v => v === 'low').length;

    if (highCount > volumes.length / 2) return 'high';
    if (lowCount > volumes.length / 2) return 'low';
    return 'medium';
  }

  private calculateAverageDuration(trades: StrategyTrade[]): number {
    if (trades.length === 0) return 0;

    const durations = trades.map(trade => {
      const start = new Date(trade.created_at).getTime();
      const end = new Date(trade.updated_at).getTime();
      return end - start;
    });

    return durations.reduce((sum, duration) => sum + duration, 0) / trades.length;
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
}

export const analyticsService = AnalyticsService.getInstance();