import { EventEmitter } from './event-emitter';
import { supabase } from './supabase';
import { marketService } from './market-service';
import { tradeManager } from './trade-manager';
import { aiTradeService } from './ai-trade-service';
import { logService } from './log-service';
import { marketMonitor } from './market-monitor';
import { tradeService } from './trade-service';
import { exchangeService } from './exchange-service';
import type { Strategy } from './supabase-types';
import { Decimal } from 'decimal.js';
import { CACHE_DURATIONS } from '@/lib/constants';
import type { MarketData } from '@/lib/types';

interface IndicatorValue {
  name: string;
  value: number;
  signal?: number;
  upper?: number;
  lower?: number;
  timestamp: number;
}

interface MarketDataCacheEntry {
  timestamp: number;
  data: MarketData;
  expiresAt: number;
}

interface MarketData {
  price: Decimal;
  volume: Decimal;
  indicators: Record<string, number>;
  marketState: {
    volatility: number;
    trend: 'bullish' | 'bearish' | 'sideways';
    sentiment: number;
  };
}

interface MarketFitAnalysis {
  isSuitable: boolean;
  score: number;
  reason?: string;
  details: {
    marketConditions: MarketState;
    riskAnalysis: RiskAnalysis;
    confidenceScore: number;
    warnings: string[];
  };
}

interface RiskAnalysis {
  level: number;
  factors: string[];
  mitigations: string[];
}

interface AnalysisCacheEntry {
  timestamp: number;
  data: MarketFitAnalysis;
  expiresAt: number;
}

interface TradeValidationResult {
  isValid: boolean;
  issues: string[];
  riskScore: number;
  recommendations: string[];
}

interface StrategyMetrics {
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  recoveryFactor: number;
}

interface CacheEntry<T> {
  timestamp: number;
  data: T;
  expiresAt: number;
}

const CACHE_DURATIONS = {
  MARKET_DATA: 5 * 60 * 1000, // 5 minutes
  ANALYSIS: 15 * 60 * 1000,   // 15 minutes
  CLEANUP_INTERVAL: 60 * 60 * 1000 // 1 hour
} as const;

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

class CircuitBreaker {
  private failures = 0;
  private lastFailure: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private successfulAttempts = 0;
  private readonly requiredSuccesses = 3;

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private halfOpenTimeout: number = 30000,
    private onStateChange?: (state: 'CLOSED' | 'OPEN' | 'HALF_OPEN') => void
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.timeout) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new Error(`Circuit breaker is OPEN. Retry after ${this.getRemainingTimeout()}ms`);
      }
    }

    try {
      const result = await operation();
      
      if (this.state === 'HALF_OPEN') {
        this.successfulAttempts++;
        if (this.successfulAttempts >= this.requiredSuccesses) {
          this.transitionTo('CLOSED');
        }
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      
      if (this.failures >= this.threshold) {
        this.transitionTo('OPEN');
      }
      throw error;
    }
  }

  private transitionTo(newState: 'CLOSED' | 'OPEN' | 'HALF_OPEN') {
    this.state = newState;
    if (newState === 'CLOSED') {
      this.failures = 0;
      this.successfulAttempts = 0;
    } else if (newState === 'HALF_OPEN') {
      this.successfulAttempts = 0;
    }
    this.onStateChange?.(newState);
  }

  private getRemainingTimeout(): number {
    return Math.max(0, this.timeout - (Date.now() - this.lastFailure));
  }

  getState(): string {
    return this.state;
  }
}

class StrategyMonitor extends EventEmitter {
  private static instance: StrategyMonitor;
  private activeStrategies: Map<string, Strategy> = new Map();
  private marketDataCache: Map<string, MarketDataCacheEntry> = new Map();
  private analysisCache: Map<string, AnalysisCacheEntry> = new Map();
  private pollingInterval?: NodeJS.Timeout;
  private isInitialized = false;
  private metricsCache: Map<string, StrategyMetrics> = new Map();
  private readonly METRICS_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private exchangeCircuitBreaker = new CircuitBreaker();
  private marketDataCircuitBreaker = new CircuitBreaker();

  private constructor() {
    super();
    this.cleanupStaleData = this.cleanupStaleData.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  public static getInstance(): StrategyMonitor {
    if (!StrategyMonitor.instance) {
      StrategyMonitor.instance = new StrategyMonitor();
    }
    return StrategyMonitor.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadActiveStrategies();
      this.setupRealtimeSubscription();
      this.startPolling();
      setInterval(this.cleanupStaleData, CACHE_DURATIONS.CLEANUP_INTERVAL);
      this.isInitialized = true;
    } catch (error) {
      this.handleError('Initialization failed', error);
      throw error;
    }
  }

  private async loadActiveStrategies(): Promise<void> {
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('status', 'active');

    if (error) throw error;

    strategies?.forEach(strategy => {
      this.activeStrategies.set(strategy.id, strategy);
    });
  }

  private startPolling(): void {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(async () => {
      for (const strategy of this.activeStrategies.values()) {
        await this.checkStrategyHealth(strategy);
      }
    }, 30000); // Check every 30 seconds
  }

  private async checkStrategyHealth(strategy: Strategy): Promise<void> {
    try {
      const analysis = await this.getMarketFitAnalysis(strategy);
      
      if (!analysis.isSuitable) {
        await this.handleUnsuitableMarket(strategy, analysis);
        return;
      }

      const trades = tradeManager.getActiveTradesForStrategy(strategy.id);
      await this.validateTrades(strategy, trades);

    } catch (error) {
      this.handleError(`Health check failed for strategy ${strategy.id}`, error);
    }
  }

  private async getMarketFitAnalysis(
    strategy: Strategy,
    retryCount = 0
  ): Promise<MarketFitAnalysis> {
    const cacheKey = `${strategy.id}-market-fit`;
    const cached = this.analysisCache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const analysis = await aiTradeService.analyzeMarketFit(strategy);
      
      this.analysisCache.set(cacheKey, {
        timestamp: Date.now(),
        data: analysis,
        expiresAt: Date.now() + CACHE_DURATIONS.ANALYSIS
      });

      return analysis;
    } catch (error) {
      if (retryCount < MAX_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.getMarketFitAnalysis(strategy, retryCount + 1);
      }
      throw error;
    }
  }

  private async handleUnsuitableMarket(
    strategy: Strategy,
    analysis: MarketFitAnalysis
  ): Promise<void> {
    logService.log('warn', 
      `Market conditions unsuitable for strategy ${strategy.id}`,
      { analysis },
      'StrategyMonitor'
    );

    const activeTrades = tradeManager.getActiveTradesForStrategy(strategy.id);
    
    if (activeTrades.length > 0) {
      await this.handleRiskMitigation(strategy, activeTrades, analysis);
    }

    await this.updateStrategyStatus(strategy.id, 'paused', {
      reason: analysis.reason,
      marketFitScore: analysis.score
    });
  }

  private async handleRiskMitigation(
    strategy: Strategy,
    trades: any[],
    analysis: MarketFitAnalysis
  ): Promise<void> {
    const riskLevel = analysis.details.riskAnalysis.level;

    if (riskLevel >= 4) { // High risk
      await Promise.all(trades.map(trade => 
        tradeManager.closeTrade(trade.id, 'Emergency market conditions')
      ));
    } else { // Moderate risk
      await Promise.all(trades.map(trade =>
        tradeManager.adjustTradeRisk(trade.id, {
          tightenStops: true,
          reduceExposure: true
        })
      ));
    }
  }

  private async updateStrategyStatus(
    strategyId: string,
    status: string,
    details: Record<string, any>
  ): Promise<void> {
    const { error } = await supabase
      .from('strategies')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...details
      })
      .eq('id', strategyId);

    if (error) throw error;
  }

  private handleError(message: string, error: any): void {
    logService.log('error', message, error, 'StrategyMonitor');
    this.emit('error', { message, error });
  }

  private cleanupStaleData(): void {
    const now = Date.now();

    for (const [key, entry] of this.marketDataCache.entries()) {
      if (now > entry.expiresAt) {
        this.marketDataCache.delete(key);
      }
    }

    for (const [key, entry] of this.analysisCache.entries()) {
      if (now > entry.expiresAt) {
        this.analysisCache.delete(key);
      }
    }
  }

  public async shutdown(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    for (const strategy of this.activeStrategies.values()) {
      await this.handleStrategyDeactivation(strategy);
    }

    this.activeStrategies.clear();
    this.marketDataCache.clear();
    this.analysisCache.clear();
    this.isInitialized = false;
  }

  private setupRealtimeSubscription(): void {
    supabase
      .channel('strategy-monitor')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'strategies'
        },
        this.handleStrategyChange.bind(this)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monitoring_status'
        },
        this.handleMonitoringStatusChange.bind(this)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trade_signals'
        },
        this.handleTradeSignalChange.bind(this)
      )
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') {
          this.handleError('Realtime subscription failed', new Error(status));
        }
      });
  }

  private async handleStrategyChange(payload: any): Promise<void> {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    try {
      switch (eventType) {
        case 'INSERT':
          if (newRecord.status === 'active') {
            this.activeStrategies.set(newRecord.id, newRecord);
            await this.initializeStrategyMonitoring(newRecord);
          }
          break;

        case 'UPDATE':
          if (newRecord.status !== oldRecord.status) {
            if (newRecord.status === 'active') {
              this.activeStrategies.set(newRecord.id, newRecord);
              await this.initializeStrategyMonitoring(newRecord);
            } else {
              await this.handleStrategyDeactivation(oldRecord);
              this.activeStrategies.delete(oldRecord.id);
            }
          } else {
            this.activeStrategies.set(newRecord.id, newRecord);
          }
          break;

        case 'DELETE':
          await this.handleStrategyDeactivation(oldRecord);
          this.activeStrategies.delete(oldRecord.id);
          break;
      }
    } catch (error) {
      this.handleError(`Strategy change handler failed for ${payload.eventType}`, error);
    }
  }

  private async initializeStrategyMonitoring(strategy: Strategy): Promise<void> {
    try {
      // Initialize market data monitoring
      const marketData = await this.getMarketData(strategy);
      await this.updateMonitoringStatus(strategy.id, {
        lastCheck: new Date().toISOString(),
        marketData,
        status: 'active'
      });

      // Initialize performance metrics
      await this.updateStrategyMetrics(strategy);

      // Set up initial risk parameters
      await this.configureRiskParameters(strategy);

      this.emit('strategy:initialized', {
        strategyId: strategy.id,
        timestamp: Date.now()
      });
    } catch (error) {
      this.handleError(`Failed to initialize monitoring for strategy ${strategy.id}`, error);
      await this.updateMonitoringStatus(strategy.id, {
        status: 'error',
        error: error.message
      });
    }
  }

  private async validateTrades(
    strategy: Strategy,
    trades: any[]
  ): Promise<TradeValidationResult[]> {
    const results: TradeValidationResult[] = [];

    for (const trade of trades) {
      try {
        const validation = await this.validateSingleTrade(strategy, trade);
        results.push(validation);

        if (!validation.isValid) {
          await this.handleInvalidTrade(strategy, trade, validation);
        }
      } catch (error) {
        this.handleError(`Trade validation failed for ${trade.id}`, error);
      }
    }

    return results;
  }

  private async validateSingleTrade(
    strategy: Strategy,
    trade: any
  ): Promise<TradeValidationResult> {
    const marketData = await this.getMarketData(strategy);
    const riskAnalysis = await this.analyzeTradeRisk(trade, marketData);
    const positionSize = await this.validatePositionSize(trade, strategy);
    const stopLoss = this.validateStopLoss(trade, marketData);

    const issues: string[] = [];
    const recommendations: string[] = [];

    if (riskAnalysis.riskScore > strategy.maxRiskScore) {
      issues.push('Risk score exceeds strategy maximum');
      recommendations.push('Consider closing position or adjusting risk parameters');
    }

    if (!positionSize.isValid) {
      issues.push('Position size outside allowed range');
      recommendations.push(positionSize.recommendation);
    }

    if (!stopLoss.isValid) {
      issues.push('Stop loss validation failed');
      recommendations.push(stopLoss.recommendation);
    }

    return {
      isValid: issues.length === 0,
      issues,
      riskScore: riskAnalysis.riskScore,
      recommendations
    };
  }

  private async handleInvalidTrade(
    strategy: Strategy,
    trade: any,
    validation: TradeValidationResult
  ): Promise<void> {
    logService.log('warn',
      `Invalid trade detected for strategy ${strategy.id}`,
      { trade, validation },
      'StrategyMonitor'
    );

    if (validation.riskScore > strategy.maxRiskScore * 1.5) {
      // Emergency close for high-risk situations
      await tradeManager.closeTrade(trade.id, 'Emergency risk management');
    } else {
      // Attempt to adjust the trade
      await tradeManager.adjustTradeRisk(trade.id, {
        tightenStops: true,
        reduceExposure: true,
        recommendations: validation.recommendations
      });
    }

    // Update monitoring status
    await this.updateMonitoringStatus(strategy.id, {
      lastCheck: new Date().toISOString(),
      warnings: validation.issues,
      riskScore: validation.riskScore
    });
  }

  private async updateStrategyMetrics(strategy: Strategy): Promise<void> {
    try {
      const trades = await tradeService.getStrategyTrades(strategy.id);
      const metrics = this.calculateStrategyMetrics(trades);
      
      this.metricsCache.set(strategy.id, metrics);
      
      await supabase
        .from('strategies')
        .update({
          metrics,
          updated_at: new Date().toISOString()
        })
        .eq('id', strategy.id);
    } catch (error) {
      this.handleError(`Failed to update metrics for strategy ${strategy.id}`, error);
    }
  }

  private calculateStrategyMetrics(trades: any[]): StrategyMetrics {
    // Calculate key performance metrics
    const winningTrades = trades.filter(t => t.profit > 0);
    const winRate = winningTrades.length / trades.length;
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(trades
      .filter(t => t.profit < 0)
      .reduce((sum, t) => sum + t.profit, 0));
    
    const profitFactor = grossProfit / (grossLoss || 1);
    
    // Calculate Sharpe Ratio
    const returns = trades.map(t => t.profit);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = (avgReturn - 0.02) / stdDev; // Assuming 2% risk-free rate
    
    // Calculate Maximum Drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let runningTotal = 0;
    
    trades.forEach(trade => {
      runningTotal += trade.profit;
      if (runningTotal > peak) peak = runningTotal;
      const drawdown = peak - runningTotal;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    const recoveryFactor = grossProfit / (maxDrawdown || 1);

    return {
      winRate,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      recoveryFactor
    };
  }

  private async handleMonitoringStatusChange(payload: any): Promise<void> {
    const { new: newStatus } = payload;
    
    try {
      const strategy = this.activeStrategies.get(newStatus.strategy_id);
      if (!strategy) return;

      if (newStatus.status === 'warning' || newStatus.status === 'error') {
        await this.handleMonitoringAlert(strategy, newStatus);
      }

      this.emit('monitoringStatusUpdate', {
        strategyId: strategy.id,
        status: newStatus
      });
    } catch (error) {
      this.handleError('Failed to handle monitoring status change', error);
    }
  }

  private async handleTradeSignalChange(payload: any): Promise<void> {
    const { eventType, new: signal } = payload;
    
    try {
      if (eventType !== 'INSERT') return;
      
      const strategy = this.activeStrategies.get(signal.strategy_id);
      if (!strategy) return;

      const analysis = await this.getMarketFitAnalysis(strategy);
      if (!analysis.isSuitable) {
        await this.rejectTradeSignal(signal.id, 'Unsuitable market conditions');
        return;
      }

      const validation = await this.validateTradeSignal(strategy, signal);
      if (!validation.isValid) {
        await this.rejectTradeSignal(signal.id, validation.issues.join(', '));
        return;
      }

      this.emit('validTradeSignal', {
        signal,
        validation,
        analysis
      });
    } catch (error) {
      this.handleError('Failed to handle trade signal change', error);
    }
  }

  private async handleMonitoringAlert(
    strategy: Strategy,
    status: any
  ): Promise<void> {
    const activeTrades = tradeManager.getActiveTradesForStrategy(strategy.id);
    
    if (status.status === 'error') {
      // Emergency risk management
      await Promise.all(activeTrades.map(trade =>
        tradeManager.closeTrade(trade.id, 'Emergency system error')
      ));
      
      await this.updateStrategyStatus(strategy.id, 'paused', {
        reason: status.message,
        pausedAt: new Date().toISOString()
      });
    } else if (status.status === 'warning') {
      // Adjust risk parameters
      await Promise.all(activeTrades.map(trade =>
        tradeManager.adjustTradeRisk(trade.id, {
          tightenStops: true,
          reduceExposure: true
        })
      ));
    }
  }

  private async rejectTradeSignal(
    signalId: string,
    reason: string
  ): Promise<void> {
    await supabase
      .from('trade_signals')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', signalId);
  }

  private async validateTradeSignal(
    strategy: Strategy,
    signal: TradeSignal
  ): Promise<TradeValidationResult> {
    const marketData: MarketData = await this.getMarketData(strategy);
    
    // Add null check
    const currentPrice = marketData.price;
    if (!currentPrice) {
      throw new Error('Current price not available');
    }
    
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Validate signal expiration
    if (new Date(signal.expires_at) <= new Date()) {
      issues.push('Signal has expired');
    }

    // Validate price deviation
    const priceDiff = Math.abs(currentPrice.minus(signal.entry_price)
      .div(signal.entry_price)
      .toNumber());
    
    if (priceDiff > strategy.strategy_config.maxPriceDeviation) {
      issues.push('Price deviation exceeds maximum allowed');
      recommendations.push('Update entry price to current market price');
    }

    // Validate market volatility
    if (marketData.marketState.volatility > strategy.strategy_config.maxVolatility) {
      issues.push('Market volatility exceeds strategy limits');
      recommendations.push('Wait for lower volatility conditions');
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(signal, marketData);

    return {
      isValid: issues.length === 0,
      issues,
      riskScore,
      recommendations
    };
  }

  private calculateRiskScore(signal: any, marketData: MarketData): number {
    const volatilityWeight = 0.3;
    const volumeWeight = 0.2;
    const sentimentWeight = 0.2;
    const trendWeight = 0.3;

    const volatilityScore = Math.min(marketData.marketState.volatility / 100, 1);
    const volumeScore = Math.min(marketData.marketState.volume / 100, 1);
    const sentimentScore = (marketData.marketState.sentiment + 100) / 200;
    
    const trendScore = marketData.marketState.trend === signal.direction ? 0.2 :
      marketData.marketState.trend === 'sideways' ? 0.5 : 0.8;

    return (
      volatilityScore * volatilityWeight +
      volumeScore * volumeWeight +
      sentimentScore * sentimentWeight +
      trendScore * trendWeight
    ) * 100;
  }

  private async getMarketData(
    strategy: Strategy,
    retryCount = 0
  ): Promise<MarketData> {
    const cacheKey = `${strategy.id}-market-data`;
    const cached = this.marketDataCache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const marketState = await marketMonitor.getMarketState(strategy.strategy_config.symbol);
      const price = await exchangeService.getCurrentPrice(strategy.strategy_config.symbol);
      const volume = await exchangeService.get24hVolume(strategy.strategy_config.symbol);
      const indicators = await marketMonitor.getIndicatorValues(
        strategy.strategy_config.symbol,
        strategy.strategy_config.indicators
      );

      const data: MarketData = {
        price: new Decimal(price),
        volume: new Decimal(volume),
        indicators,
        marketState
      };

      this.marketDataCache.set(cacheKey, {
        timestamp: Date.now(),
        data,
        expiresAt: Date.now() + CACHE_DURATIONS.MARKET_DATA
      });

      return data;
    } catch (error) {
      if (retryCount < MAX_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.getMarketData(strategy, retryCount + 1);
      }
      throw error;
    }
  }

  private async handleStrategyDeactivation(strategy: Strategy): Promise<void> {
    try {
      // Close all active trades
      const activeTrades = tradeManager.getActiveTradesForStrategy(strategy.id);
      await Promise.all(activeTrades.map(trade =>
        tradeManager.closeTrade(trade.id, 'Strategy deactivated')
      ));

      // Clean up caches
      this.marketDataCache.delete(`${strategy.id}-market-data`);
      this.analysisCache.delete(`${strategy.id}-market-fit`);
      this.metricsCache.delete(strategy.id);

      // Update final metrics
      await this.updateStrategyMetrics(strategy);

      this.emit('strategy:deactivated', {
        strategyId: strategy.id,
        timestamp: Date.now()
      });
    } catch (error) {
      this.handleError(`Failed to handle strategy deactivation for ${strategy.id}`, error);
    }
  }

  private metrics = {
    operations: new Map<string, { count: number, totalTime: number }>(),
    errors: new Map<string, number>(),
    lastReset: Date.now()
  };

  private async measureOperation<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    try {
      return await operation();
    } finally {
      const duration = performance.now() - start;
      const stats = this.metrics.operations.get(name) || { count: 0, totalTime: 0 };
      this.metrics.operations.set(name, {
        count: stats.count + 1,
        totalTime: stats.totalTime + duration
      });
    }
  }

  public getMetrics(): Record<string, any> {
    const result: Record<string, any> = {
      uptime: Date.now() - this.metrics.lastReset,
      operations: {},
      errors: Object.fromEntries(this.metrics.errors)
    };

    for (const [name, stats] of this.metrics.operations) {
      result.operations[name] = {
        count: stats.count,
        avgTime: stats.totalTime / stats.count,
        totalTime: stats.totalTime
      };
    }

    return result;
  }
}

export const strategyMonitor = StrategyMonitor.getInstance();

interface MarketRegime {
  type: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'UNCERTAIN';
  confidence: number;
  metrics: Record<string, number>;
  timestamp: number;
  symbol: string;
}

interface RegimeIndicators {
  adx: number;
  macdHistogram: number;
  macdStdDev: number;
  macdMax: number;
  atr: number;
  atrUpperBand: number;
  rsi: number;
  bbWidth: number;
  bbWidthMA: number;
  bbWidthMax: number;
  volatility: number;
  trendStrength: number;
}

class MarketRegimeDetector {
  private regimeHistory: Map<string, MarketRegime[]> = new Map();
  private readonly HISTORY_LENGTH = 24; // Keep 24 hours of regime history
  private readonly UPDATE_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private lastUpdate: Map<string, number> = new Map();

  constructor(
    private readonly indicatorService: IndicatorService,
    private readonly marketDataService: MarketDataService
  ) {}

  async detectRegime(symbol: string, timeframe: string = '1h'): Promise<MarketRegime> {
    const now = Date.now();
    const lastUpdateTime = this.lastUpdate.get(symbol) || 0;

    // Check if we need to update
    if (now - lastUpdateTime < this.UPDATE_INTERVAL) {
      return this.getLatestRegime(symbol);
    }

    const indicators = await this.calculateRegimeIndicators(symbol, timeframe);
    const regime = await this.analyzeRegime(symbol, indicators);
    
    this.updateRegimeHistory(symbol, regime);
    this.lastUpdate.set(symbol, now);

    return regime;
  }

  private async calculateRegimeIndicators(
    symbol: string,
    timeframe: string
  ): Promise<RegimeIndicators> {
    // Fetch required candles for calculations
    const candles = await this.marketDataService.getCandles(symbol, timeframe, 100);
    
    // Calculate ADX for trend strength
    const adx = await this.indicatorService.calculateADX(candles, 14);
    
    // Calculate MACD
    const macd = await this.indicatorService.calculateMACD(candles, {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9
    });
    
    // Calculate Bollinger Bands
    const bb = await this.indicatorService.calculateBB(candles, 20, 2);
    
    // Calculate ATR
    const atr = await this.indicatorService.calculateATR(candles, 14);
    
    // Calculate RSI
    const rsi = await this.indicatorService.calculateRSI(candles, 14);

    // Calculate derived metrics
    const macdHistogram = macd.histogram[macd.histogram.length - 1];
    const macdValues = macd.histogram.slice(-30);
    const macdStdDev = this.calculateStdDev(macdValues);
    const macdMax = Math.max(...macdValues.map(Math.abs));

    const atrValues = atr.slice(-30);
    const atrMA = this.calculateSMA(atrValues, 10);
    const atrUpperBand = atrMA + (this.calculateStdDev(atrValues) * 2);

    const bbWidth = (bb.upper[bb.upper.length - 1] - bb.lower[bb.lower.length - 1]) /
                   bb.middle[bb.middle.length - 1];
    const bbWidthHistory = bb.upper.map((u, i) => 
      (u - bb.lower[i]) / bb.middle[i]
    );
    const bbWidthMA = this.calculateSMA(bbWidthHistory.slice(-30), 10);
    const bbWidthMax = Math.max(...bbWidthHistory.slice(-30));

    // Calculate overall volatility and trend strength
    const volatility = this.calculateVolatility(candles);
    const trendStrength = this.calculateTrendStrength(candles);

    return {
      adx: adx[adx.length - 1],
      macdHistogram,
      macdStdDev,
      macdMax,
      atr: atr[atr.length - 1],
      atrUpperBand,
      rsi: rsi[rsi.length - 1],
      bbWidth,
      bbWidthMA,
      bbWidthMax,
      volatility,
      trendStrength
    };
  }

  private async analyzeRegime(
    symbol: string,
    indicators: RegimeIndicators
  ): Promise<MarketRegime> {
    // Trend detection
    const isTrending = indicators.adx > 25 && 
                      Math.abs(indicators.macdHistogram) > indicators.macdStdDev &&
                      indicators.trendStrength > 0.7;

    // Volatility detection
    const isVolatile = indicators.atr > indicators.atrUpperBand &&
                      indicators.volatility > 0.8;

    // Range detection
    const isRangebound = indicators.rsi > 40 && indicators.rsi < 60 &&
                        indicators.bbWidth < indicators.bbWidthMA &&
                        indicators.trendStrength < 0.3;

    // Determine regime type and confidence
    let type: MarketRegime['type'];
    let confidence: number;

    if (isTrending) {
      type = 'TRENDING';
      confidence = Math.min(
        1,
        (indicators.adx / 50 + 
         Math.abs(indicators.macdHistogram) / indicators.macdMax +
         indicators.trendStrength) / 3
      );
    } else if (isVolatile) {
      type = 'VOLATILE';
      confidence = Math.min(
        1,
        (indicators.atr / indicators.atrUpperBand +
         indicators.volatility) / 2
      );
    } else if (isRangebound) {
      type = 'RANGING';
      confidence = Math.min(
        1,
        (1 - indicators.bbWidth / indicators.bbWidthMax +
         1 - indicators.trendStrength) / 2
      );
    } else {
      type = 'UNCERTAIN';
      confidence = 0.5;
    }

    return {
      type,
      confidence,
      metrics: indicators,
      timestamp: Date.now(),
      symbol
    };
  }

  private updateRegimeHistory(symbol: string, regime: MarketRegime): void {
    const history = this.regimeHistory.get(symbol) || [];
    history.push(regime);
    
    // Keep only recent history
    const cutoff = Date.now() - (this.HISTORY_LENGTH * 60 * 60 * 1000);
    const filteredHistory = history.filter(r => r.timestamp >= cutoff);
    
    this.regimeHistory.set(symbol, filteredHistory);
  }

  private getLatestRegime(symbol: string): MarketRegime {
    const history = this.regimeHistory.get(symbol);
    if (!history || history.length === 0) {
      throw new Error(`No regime history available for ${symbol}`);
    }
    return history[history.length - 1];
  }

  async adjustStrategyForRegime(
    strategy: Strategy,
    regime: MarketRegime
  ): Promise<void> {
    const config = { ...strategy.strategy_config };
    const baseAdjustment = regime.confidence;

    switch (regime.type) {
      case 'TRENDING':
        // In trending markets, increase position size and use trailing stops
        config.trade_parameters = {
          ...config.trade_parameters,
          position_size: config.trade_parameters.position_size * (1 + baseAdjustment * 0.5),
          trailing_stop: true,
          trailing_stop_distance: config.trade_parameters.stop_loss * 1.5
        };
        
        config.risk_management = {
          ...config.risk_management,
          stop_loss: config.risk_management.stop_loss * (1 + baseAdjustment * 0.3),
          take_profit: config.risk_management.take_profit * (1 + baseAdjustment * 0.5)
        };
        break;
        
      case 'RANGING':
        // In ranging markets, reduce position size and tighten stops
        config.trade_parameters = {
          ...config.trade_parameters,
          position_size: config.trade_parameters.position_size * (1 - baseAdjustment * 0.3),
          trailing_stop: false
        };
        
        config.risk_management = {
          ...config.risk_management,
          stop_loss: config.risk_management.stop_loss * 0.8,
          take_profit: config.risk_management.take_profit * 0.8
        };
        break;
        
      case 'VOLATILE':
        // In volatile markets, reduce position size and widen stops
        config.trade_parameters = {
          ...config.trade_parameters,
          position_size: config.trade_parameters.position_size * (1 - baseAdjustment * 0.5),
          trailing_stop: true,
          trailing_stop_distance: config.trade_parameters.stop_loss * 2
        };
        
        config.risk_management = {
          ...config.risk_management,
          stop_loss: config.risk_management.stop_loss * (1 + baseAdjustment),
          take_profit: config.risk_management.take_profit * (1 + baseAdjustment * 0.5)
        };
        break;
        
      case 'UNCERTAIN':
        // In uncertain markets, reduce exposure significantly
        config.trade_parameters = {
          ...config.trade_parameters,
          position_size: config.trade_parameters.position_size * 0.5,
          trailing_stop: false
        };
        
        config.risk_management = {
          ...config.risk_management,
          stop_loss: config.risk_management.stop_loss * 1.2,
          take_profit: config.risk_management.take_profit * 0.8
        };
        break;
    }

    // Ensure adjustments don't exceed maximum limits
    this.validateAndClampConfig(config);
    
    // Update strategy configuration
    await this.updateStrategyConfig(strategy.id, config);
    
    // Log regime change
    logService.log(
      'info',
      `Strategy ${strategy.id} adjusted for ${regime.type} regime (confidence: ${regime.confidence})`,
      { regime, newConfig: config },
      'MarketRegimeDetector'
    );
  }

  private calculateStdDev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b) / values.length);
  }

  private calculateSMA(values: number[], period: number): number {
    return values.slice(-period).reduce((a, b) => a + b) / period;
  }

  private calculateVolatility(candles: any[]): number {
    const returns = candles.slice(1).map((candle, i) => 
      (candle.close - candles[i].close) / candles[i].close
    );
    return this.calculateStdDev(returns) * Math.sqrt(returns.length);
  }

  private calculateTrendStrength(candles: any[]): number {
    const prices = candles.map(c => c.close);
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    
    // Calculate trend strength based on SMA alignment and price position
    const currentPrice = prices[prices.length - 1];
    const trendAlignment = (sma20 - sma50) / sma50;
    const pricePosition = (currentPrice - sma50) / sma50;
    
    return Math.min(1, (Math.abs(trendAlignment) + Math.abs(pricePosition)) / 2);
  }

  private validateAndClampConfig(config: any): void {
    // Ensure position size stays within global limits
    config.trade_parameters.position_size = Math.min(
      config.trade_parameters.position_size,
      GLOBAL_MAX_POSITION_SIZE
    );

    // Ensure stop loss isn't too tight
    config.risk_management.stop_loss = Math.max(
      config.risk_management.stop_loss,
      MINIMUM_STOP_LOSS_DISTANCE
    );

    // Validate take profit is greater than stop loss
    if (config.risk_management.take_profit <= config.risk_management.stop_loss) {
      config.risk_management.take_profit = config.risk_management.stop_loss * 1.5;
    }
  }
}

// Export singleton instance
export const marketRegimeDetector = new MarketRegimeDetector(
  indicatorService,
  marketDataService
);
