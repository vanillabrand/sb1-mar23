import { EventEmitter } from './event-emitter';
import { marketMonitor } from './market-monitor';
import { tradeManager } from './trade-manager';
import { tradeService } from './trade-service';
import { analyticsService } from './analytics-service';
import { supabase } from './supabase';
import { logService } from './log-service';
import { technicalIndicators } from './indicators';
import { NetworkError, TimeoutError } from './errors';
import type { Strategy, TradeSignal } from './types';

class TradeEngine extends EventEmitter {
  private static instance: TradeEngine | null = null;
  private activeStrategies: Map<string, Strategy>;
  private monitoringInterval: NodeJS.Timeout | null;
  private signalCheckInterval: NodeJS.Timeout | null;
  private readonly MONITOR_INTERVAL: number;
  private readonly SIGNAL_CHECK_INTERVAL: number;
  private readonly SIGNAL_EXPIRY: number;
  private initialized: boolean;
  private readonly MAX_RETRIES: number;
  private readonly BACKOFF_DELAY: number;

  private constructor() {
    super();
    
    // Initialize all properties
    this.activeStrategies = new Map();
    this.monitoringInterval = null;
    this.signalCheckInterval = null;
    this.MONITOR_INTERVAL = 15000; // 15 seconds
    this.SIGNAL_CHECK_INTERVAL = 5000; // 5 seconds
    this.SIGNAL_EXPIRY = 300000; // 5 minutes
    this.initialized = false;
    this.MAX_RETRIES = 3;
    this.BACKOFF_DELAY = 1000;

    // Only bind methods that actually exist
    this.initialize = this.initialize.bind(this);
    this.startMonitoring = this.startMonitoring.bind(this);
    this.startSignalChecking = this.startSignalChecking.bind(this);
    this.checkSignals = this.checkSignals.bind(this);
    this.processTradeSignal = this.processTradeSignal.bind(this);
    this.cancelSignal = this.cancelSignal.bind(this);
    this.calculatePositionSize = this.calculatePositionSize.bind(this);
    this.executeTradeOperation = this.executeTradeOperation.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  static getInstance(): TradeEngine {
    if (!TradeEngine.instance) {
      TradeEngine.instance = new TradeEngine();
    }
    return TradeEngine.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logService.log('info', 'Initializing trade engine', null, 'TradeEngine');

      // Start monitoring and signal checking intervals
      this.startMonitoring();
      this.startSignalChecking();

      this.initialized = true;
      logService.log('info', 'Trade engine initialized successfully', null, 'TradeEngine');
    } catch (error) {
      logService.log('error', 'Failed to initialize trade engine', error, 'TradeEngine');
      throw error;
    }
  }

  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.checkStrategies().catch(error => {
        logService.log('error', 'Error in monitoring interval', error, 'TradeEngine');
      });
    }, this.MONITOR_INTERVAL);
  }

  private async checkStrategies(): Promise<void> {
    try {
      for (const [id, strategy] of this.activeStrategies) {
        // Implementation of strategy checking logic
        await this.executeTradeOperation(async () => {
          // Strategy checking logic here
        }, `check strategy ${id}`);
      }
    } catch (error) {
      logService.log('error', 'Error checking strategies', error, 'TradeEngine');
    }
  }

  private startSignalChecking(): void {
    if (this.signalCheckInterval) {
      clearInterval(this.signalCheckInterval);
    }

    this.signalCheckInterval = setInterval(() => {
      this.checkSignals().catch(error => {
        logService.log('error', 'Error in signal checking interval', error, 'TradeEngine');
      });
    }, this.SIGNAL_CHECK_INTERVAL);
  }

  private async checkSignals(): Promise<void> {
    try {
      // Get pending signals that haven't expired
      const { data: signals, error } = await supabase
        .from('trade_signals')
        .select('*')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (error) throw error;

      // Process each signal
      for (const signal of signals || []) {
        await this.processTradeSignal(signal);
      }
    } catch (error) {
      logService.log('error', 'Error checking trade signals', error, 'TradeEngine');
    }
  }

  private async processTradeSignal(signal: TradeSignal) {
    try {
      const strategy = this.activeStrategies.get(signal.strategy_id);
      if (!strategy) return;

      // Get available budget
      const budget = await tradeService.getBudget(signal.strategy_id);
      if (!budget || budget.available <= 0) {
        await this.cancelSignal(signal.id, 'Insufficient budget');
        return;
      }

      // Calculate position size
      const positionSize = this.calculatePositionSize(
        strategy,
        budget.available,
        signal.entry_price,
        signal.confidence
      );

      // Execute trade
      const trade = await tradeManager.executeTrade({
        strategy_id: signal.strategy_id,
        symbol: signal.symbol,
        type: signal.direction,
        entry_price: signal.entry_price,
        amount: positionSize,
        stop_loss: signal.stop_loss,
        take_profit: signal.take_profit,
        trailing_stop: signal.trailing_stop
      });

      // Update signal status
      await supabase
        .from('trade_signals')
        .update({
          status: 'executed',
          executed_at: new Date().toISOString()
        })
        .eq('id', signal.id);

      // Update monitoring status
      await this.updateMonitoringStatus(signal.strategy_id, {
        status: 'executing',
        message: 'Executing trade signal'
      });

      logService.log('info', `Executed trade signal ${signal.id}`, { signal, trade }, 'TradeEngine');
    } catch (error) {
      logService.log('error', `Error processing trade signal ${signal.id}`, error, 'TradeEngine');
      await this.cancelSignal(signal.id, 'Execution error');
    }
  }

  private async cancelSignal(signalId: string, reason: string) {
    try {
      await supabase
        .from('trade_signals')
        .update({
          status: 'cancelled',
          rationale: `${reason}. Original rationale: ${reason}`
        })
        .eq('id', signalId);
    } catch (error) {
      logService.log('error', `Error cancelling signal ${signalId}`, error, 'TradeEngine');
    }
  }

  private calculatePositionSize(
    strategy: Strategy,
    availableBudget: number,
    currentPrice: number,
    confidence: number
  ): number {
    const riskMultiplier = {
      'Ultra Low': 0.05,
      'Low': 0.1,
      'Medium': 0.15,
      'High': 0.2,
      'Ultra High': 0.25,
      'Extreme': 0.3,
      'God Mode': 0.5
    }[strategy.risk_level] || 0.15;

    // Base position size on risk level and confidence
    const baseSize = availableBudget * riskMultiplier;
    const confidenceAdjustedSize = baseSize * confidence;

    // Ensure position size doesn't exceed max allowed
    const maxPositionSize = strategy.strategy_config?.trade_parameters?.position_size || 0.1;
    const finalSize = Math.min(confidenceAdjustedSize, availableBudget * maxPositionSize);

    // Calculate actual position size in asset units
    const positionSize = finalSize / currentPrice;

    // Round to 8 decimal places for crypto
    return Math.floor(positionSize * 1e8) / 1e8;
  }

  private async updateMonitoringStatus(
    strategyId: string,
    update: {
      status: 'monitoring' | 'generating' | 'executing' | 'idle';
      message: string;
      indicators?: Record<string, number>;
      market_conditions?: any;
    }
  ) {
    try {
      const { error } = await supabase
        .from('monitoring_status')
        .upsert({
          strategy_id: strategyId,
          ...update,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      logService.log('error', `Error updating monitoring status for ${strategyId}`, error, 'TradeEngine');
    }
  }

  async addStrategy(strategy: Strategy): Promise<void> {
    try {
      this.activeStrategies.set(strategy.id, strategy);

      // Initialize monitoring status
      await this.updateMonitoringStatus(strategy.id, {
        status: 'monitoring',
        message: 'Strategy activated, monitoring market conditions'
      });

      logService.log('info', `Added strategy ${strategy.id} to trade engine`, null, 'TradeEngine');
    } catch (error) {
      logService.log('error', `Failed to add strategy ${strategy.id}`, error, 'TradeEngine');
      throw error;
    }
  }

  removeStrategy(strategyId: string): void {
    this.activeStrategies.delete(strategyId);
    logService.log('info', `Removed strategy ${strategyId} from trade engine`, null, 'TradeEngine');
  }

  cleanup() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.signalCheckInterval) {
      clearInterval(this.signalCheckInterval);
      this.signalCheckInterval = null;
    }
    this.activeStrategies.clear();
    this.initialized = false;
  }

  async executeTradeOperation<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (this.isRetryableError(error)) {
          const delay = this.calculateBackoff(attempt);
          logService.log('warn', 
            `Retry attempt ${attempt} for ${context}. Waiting ${delay}ms`,
            error,
            'TradeEngine'
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error(`Max retries exceeded for ${context}: ${lastError?.message}`);
  }

  private isRetryableError(error: any): boolean {
    return error instanceof NetworkError ||
           error instanceof TimeoutError ||
           error.code === 'ECONNRESET' ||
           error.code === 'ETIMEDOUT';
  }

  private calculateBackoff(attempt: number): number {
    return Math.min(
      this.BACKOFF_DELAY * Math.pow(2, attempt - 1) + Math.random() * 1000,
      30000
    );
  }
}

export const tradeEngine = TradeEngine.getInstance();
