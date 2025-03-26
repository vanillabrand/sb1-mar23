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

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private halfOpenTimeout: number = 30000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = 'OPEN';
      }
      throw error;
    }
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
    signal: any
  ): Promise<TradeValidationResult> {
    const marketData = await this.getMarketData(strategy);
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Validate signal expiration
    if (new Date(signal.expires_at) <= new Date()) {
      issues.push('Signal has expired');
    }

    // Validate price deviation
    const currentPrice = marketData.price;
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
