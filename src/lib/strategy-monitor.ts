import { EventEmitter } from './event-emitter';
import { supabase } from './supabase';
import { marketService } from './market-service';
import { tradeManager } from './trade-manager';
import { aiTradeService } from './ai-trade-service';
import { logService } from './log-service';
import { marketMonitor } from './market-monitor';
import { tradeService } from './trade-service';
import { exchangeService } from './exchange-service';
import { indicatorService } from './indicator-service';
import { marketDataService } from './market-data-service';
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

interface MarketState {
  trend: string;
  volatility: number;
  volume: number;
  sentiment: number;
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

  private setupRealtimeSubscription(): void {
    supabase
      .channel('strategy_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'strategies' 
      }, this.handleStrategyChange.bind(this))
      .subscribe();
  }

  private async handleStrategyChange(payload: any): Promise<void> {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    try {
      switch (eventType) {
        case 'INSERT':
        case 'UPDATE':
          if (newRecord.status === 'active') {
            this.activeStrategies.set(newRecord.id, newRecord);
          } else {
            this.activeStrategies.delete(newRecord.id);
          }
          break;
        case 'DELETE':
          this.activeStrategies.delete(oldRecord.id);
          break;
      }
    } catch (error) {
      this.handleError('Failed to handle strategy change', error);
    }
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

      const trades = await tradeManager.getActiveTradesForStrategy(strategy.id);
      await this.validateTrades(strategy, trades);

    } catch (error) {
      this.handleError(`Health check failed for strategy ${strategy.id}`, error);
    }
  }

  private async validateTrades(strategy: Strategy, trades: any[]): Promise<void> {
    for (const trade of trades) {
      try {
        const validation = await this.validateSingleTrade(strategy, trade);
        if (!validation.isValid) {
          await this.handleInvalidTrade(strategy, trade, validation);
        }
      } catch (error) {
        this.handleError(`Trade validation failed for trade ${trade.id}`, error);
      }
    }
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

    if (riskAnalysis.level > strategy.maxRiskLevel) {
      issues.push('Risk level exceeds strategy maximum');
      recommendations.push('Consider closing position or adjusting risk parameters');
    }

    if (!positionSize.isValid) {
      issues.push('Position size outside allowed range');
      recommendations.push(positionSize.recommendation);
    }

    return {
      isValid: issues.length === 0,
      issues,
      riskScore: riskAnalysis.level,
      recommendations
    };
  }

  private async getMarketData(strategy: Strategy): Promise<MarketData> {
    const cacheKey = `${strategy.id}-market-data`;
    const cached = this.marketDataCache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const data = await this.marketDataCircuitBreaker.execute(async () => {
        return await marketDataService.getMarketData(strategy.market);
      });

      this.marketDataCache.set(cacheKey, {
        timestamp: Date.now(),
        data,
        expiresAt: Date.now() + CACHE_DURATIONS.MARKET_DATA
      });

      return data;
    } catch (error) {
      this.handleError('Failed to fetch market data', error);
      throw error;
    }
  }

  private async analyzeTradeRisk(trade: any, marketData: MarketData): Promise<RiskAnalysis> {
    // Implementation details...
    return {
      level: 0,
      factors: [],
      mitigations: []
    };
  }

  private async validatePositionSize(trade: any, strategy: Strategy): Promise<any> {
    // Implementation details...
    return {
      isValid: true,
      recommendation: ''
    };
  }

  private validateStopLoss(trade: any, marketData: MarketData): boolean {
    // Implementation details...
    return true;
  }

  private async handleInvalidTrade(
    strategy: Strategy,
    trade: any,
    validation: TradeValidationResult
  ): Promise<void> {
    logService.log('warn', 'Invalid trade detected', {
      strategyId: strategy.id,
      tradeId: trade.id,
      issues: validation.issues
    });

    // Emit event for invalid trade
    this.emit('invalidTrade', {
      strategy,
      trade,
      validation
    });
  }

  private async handleUnsuitableMarket(
    strategy: Strategy,
    analysis: MarketFitAnalysis
  ): Promise<void> {
    logService.log('warn', 'Unsuitable market conditions detected', {
      strategyId: strategy.id,
      reason: analysis.reason,
      score: analysis.score
    });

    // Emit event for unsuitable market
    this.emit('unsuitableMarket', {
      strategy,
      analysis
    });
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

  private handleError(message: string, error: unknown): void {
    logService.log('error', message, error, 'StrategyMonitor');
  }

  public cleanup(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.marketDataCache.clear();
    this.analysisCache.clear();
    this.activeStrategies.clear();
  }
}

export const strategyMonitor = StrategyMonitor.getInstance();
