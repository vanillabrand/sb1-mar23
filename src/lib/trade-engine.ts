import { EventEmitter } from './event-emitter';
import { marketMonitor } from './market-monitor';
import { tradeManager } from './trade-manager';
import { tradeService } from './trade-service';
import { analyticsService } from './analytics-service';
import { supabase } from './supabase';
import { logService } from './log-service';
import { technicalIndicators } from './indicators';
import type { Strategy } from './supabase-types';

interface TradeSignal {
  id: string;
  strategy_id: string;
  symbol: string;
  direction: 'Long' | 'Short';
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  trailing_stop?: number;
  confidence: number;
  indicators: Record<string, number>;
  rationale: string;
  status: 'pending' | 'executed' | 'expired' | 'cancelled';
  created_at: string;
  expires_at: string;
  executed_at?: string;
}

class TradeEngine extends EventEmitter {
  private static instance: TradeEngine;
  private activeStrategies = new Map<string, Strategy>();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private signalCheckInterval: NodeJS.Timeout | null = null;
  private readonly MONITOR_INTERVAL = 15000; // 15 seconds
  private readonly SIGNAL_CHECK_INTERVAL = 5000; // 5 seconds
  private readonly SIGNAL_EXPIRY = 300000; // 5 minutes
  private initialized = false;
  private readonly MAX_RETRIES = 3;
  private readonly BACKOFF_DELAY = 1000;

  private constructor() {
    super();
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

  private startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.checkStrategies();
    }, this.MONITOR_INTERVAL);
  }

  private startSignalChecking() {
    if (this.signalCheckInterval) {
      clearInterval(this.signalCheckInterval);
    }

    this.signalCheckInterval = setInterval(() => {
      this.checkSignals();
    }, this.SIGNAL_CHECK_INTERVAL);
  }

  private async checkStrategies() {
    for (const [strategyId, strategy] of this.activeStrategies) {
      try {
        // Get current monitoring status
        const { data: status } = await supabase
          .from('monitoring_status')
          .select('*')
          .eq('strategy_id', strategyId)
          .single();

        if (!status || status.status === 'idle') continue;

        // Check each asset in the strategy
        if (strategy.strategy_config?.assets) {
          for (const symbol of strategy.strategy_config.assets) {
            await this.checkAssetForSignals(strategy, symbol);
          }
        }

        // Update monitoring status
        await this.updateMonitoringStatus(strategyId, {
          status: 'monitoring',
          message: 'Actively monitoring market conditions',
          last_check: new Date().toISOString(),
          next_check: new Date(Date.now() + this.MONITOR_INTERVAL).toISOString()
        });
      } catch (error) {
        logService.log('error', `Error checking strategy ${strategyId}`, error, 'TradeEngine');
      }
    }
  }

  private async checkAssetForSignals(strategy: Strategy, symbol: string) {
    try {
      // Get market state and indicators
      const marketState = marketMonitor.getMarketState(symbol);
      if (!marketState) return;

      // Calculate indicators
      const indicators = await marketMonitor.getIndicatorValues(
        symbol,
        strategy.strategy_config?.indicators || []
      );

      // Check entry conditions
      const signal = await this.evaluateTradeSignal(strategy, symbol, indicators, marketState);
      
      if (signal) {
        await this.generateTradeSignal(strategy, signal);
      }
    } catch (error) {
      logService.log('error', `Error checking ${symbol} for strategy ${strategy.id}`, error, 'TradeEngine');
    }
  }

  private async evaluateTradeSignal(
    strategy: Strategy,
    symbol: string,
    indicators: any[],
    marketState: any
  ): Promise<Partial<TradeSignal> | null> {
    try {
      // Get current price
      const price = marketState.price;
      if (!price) return null;

      // Calculate signal confidence based on indicators
      const confidence = this.calculateSignalConfidence(indicators, marketState);
      
      // Check if confidence meets minimum threshold
      const minConfidence = strategy.strategy_config?.trade_parameters?.confidence_factor || 0.7;
      if (confidence < minConfidence) return null;

      // Determine trade direction
      const direction = this.determineTradeDirection(indicators, marketState);
      if (!direction) return null;

      // Calculate entry, stop loss and take profit levels
      const stopLoss = this.calculateStopLoss(direction, price, strategy);
      const takeProfit = this.calculateTakeProfit(direction, price, strategy);
      const trailingStop = this.calculateTrailingStop(direction, price, strategy);

      return {
        symbol,
        direction,
        entry_price: price,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        trailing_stop: trailingStop,
        confidence,
        indicators: indicators.reduce((acc, ind) => ({
          ...acc,
          [ind.name]: ind.value
        }), {}),
        rationale: this.generateSignalRationale(direction, indicators, marketState)
      };
    } catch (error) {
      logService.log('error', 'Error evaluating trade signal', error, 'TradeEngine');
      return null;
    }
  }

  private calculateSignalConfidence(indicators: any[], marketState: any): number {
    // Weight different factors for confidence calculation
    const weights = {
      trend: 0.3,
      momentum: 0.3,
      volatility: 0.2,
      volume: 0.2
    };

    let confidence = 0;

    // Trend alignment (0-1)
    const trendScore = marketState.trend === 'bullish' ? 1 :
                      marketState.trend === 'bearish' ? 0 : 0.5;
    
    // Momentum strength (0-1)
    const momentum = Math.min(Math.abs(marketState.momentum) / 100, 1);
    
    // Volatility score (0-1, inverse)
    const volatility = Math.max(0, 1 - (marketState.volatility / 100));
    
    // Volume intensity (0-1)
    const volume = marketState.volume === 'high' ? 1 :
                  marketState.volume === 'medium' ? 0.5 : 0;

    // Calculate weighted average
    confidence = (
      trendScore * weights.trend +
      momentum * weights.momentum +
      volatility * weights.volatility +
      volume * weights.volume
    );

    return Math.min(1, Math.max(0, confidence));
  }

  private determineTradeDirection(
    indicators: any[],
    marketState: any
  ): 'Long' | 'Short' | null {
    // Count bullish and bearish signals
    let bullishSignals = 0;
    let bearishSignals = 0;

    // Check trend
    if (marketState.trend === 'bullish') bullishSignals++;
    if (marketState.trend === 'bearish') bearishSignals++;

    // Check momentum
    if (marketState.momentum > 0) bullishSignals++;
    if (marketState.momentum < 0) bearishSignals++;

    // Check indicators
    indicators.forEach(indicator => {
      switch (indicator.name) {
        case 'RSI':
          if (indicator.value < 30) bullishSignals++;
          if (indicator.value > 70) bearishSignals++;
          break;
        case 'MACD':
          if (indicator.value > indicator.signal) bullishSignals++;
          if (indicator.value < indicator.signal) bearishSignals++;
          break;
        // Add more indicators as needed
      }
    });

    // Determine direction based on signal count
    if (bullishSignals > bearishSignals + 1) return 'Long';
    if (bearishSignals > bullishSignals + 1) return 'Short';
    return null;
  }

  private calculateStopLoss(
    direction: 'Long' | 'Short',
    price: number,
    strategy: Strategy
  ): number {
    const stopLossPercent = strategy.strategy_config?.risk_management?.stop_loss || 2;
    return direction === 'Long'
      ? price * (1 - stopLossPercent / 100)
      : price * (1 + stopLossPercent / 100);
  }

  private calculateTakeProfit(
    direction: 'Long' | 'Short',
    price: number,
    strategy: Strategy
  ): number {
    const takeProfitPercent = strategy.strategy_config?.risk_management?.take_profit || 6;
    return direction === 'Long'
      ? price * (1 + takeProfitPercent / 100)
      : price * (1 - takeProfitPercent / 100);
  }

  private calculateTrailingStop(
    direction: 'Long' | 'Short',
    price: number,
    strategy: Strategy
  ): number {
    const trailingStopPercent = strategy.strategy_config?.risk_management?.trailing_stop_loss || 1;
    return direction === 'Long'
      ? price * (1 - trailingStopPercent / 100)
      : price * (1 + trailingStopPercent / 100);
  }

  private generateSignalRationale(
    direction: 'Long' | 'Short',
    indicators: any[],
    marketState: any
  ): string {
    const conditions = [];

    // Add market state conditions
    conditions.push(`Market trend is ${marketState.trend}`);
    conditions.push(`${marketState.volume} volume conditions`);
    if (Math.abs(marketState.momentum) > 0) {
      conditions.push(`Strong ${marketState.momentum > 0 ? 'upward' : 'downward'} momentum`);
    }

    // Add indicator conditions
    indicators.forEach(indicator => {
      switch (indicator.name) {
        case 'RSI':
          if (indicator.value < 30) conditions.push('RSI indicates oversold conditions');
          if (indicator.value > 70) conditions.push('RSI indicates overbought conditions');
          break;
        case 'MACD':
          if (indicator.value > indicator.signal) conditions.push('MACD bullish crossover');
          if (indicator.value < indicator.signal) conditions.push('MACD bearish crossover');
          break;
        // Add more indicators as needed
      }
    });

    return `Generated ${direction.toLowerCase()} signal based on: ${conditions.join(', ')}.`;
  }

  private async generateTradeSignal(
    strategy: Strategy,
    signal: Partial<TradeSignal>
  ): Promise<void> {
    try {
      // Insert trade signal
      const { data: tradeSignal, error } = await supabase
        .from('trade_signals')
        .insert({
          strategy_id: strategy.id,
          ...signal,
          status: 'pending',
          expires_at: new Date(Date.now() + this.SIGNAL_EXPIRY).toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Update monitoring status
      await this.updateMonitoringStatus(strategy.id, {
        status: 'generating',
        message: 'Trade signal generated',
        indicators: signal.indicators
      });

      // Emit signal event
      this.emit('signalGenerated', tradeSignal);

      logService.log('info', `Generated trade signal for strategy ${strategy.id}`, tradeSignal, 'TradeEngine');
    } catch (error) {
      logService.log('error', `Error generating trade signal for strategy ${strategy.id}`, error, 'TradeEngine');
    }
  }

  private async checkSignals() {
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
