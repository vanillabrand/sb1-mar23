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

      if (error) {
        // Check if the error is because the trade_signals table doesn't exist
        if (error.message && error.message.includes('relation "trade_signals" does not exist')) {
          console.log('Trade signals table does not exist, skipping signal check');
          console.warn('Please run the database setup script to create the trade_signals table.');
          logService.log('warn', 'Trade signals table does not exist, skipping signal check', null, 'TradeEngine');
          return;
        }
        throw error;
      }

      // Process each signal
      for (const signal of signals || []) {
        await this.processTradeSignal(signal);
      }
    } catch (error) {
      console.error('Error checking trade signals:', error);
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

      // Update budget in database and local state
      await tradeService.updateBudgetAfterTrade(signal.strategy_id, positionSize, 0);

      // Update signal status
      await this.updateSignalStatus(signal.id, 'executed');

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
    statusData: { status: string; message: string } | string,
    messageParam?: string,
    indicators?: Record<string, number>,
    market_conditions?: any
  ): Promise<void> {
    try {
      // Handle both object and separate parameters
      let status: string;
      let message: string;

      if (typeof statusData === 'object') {
        // If first parameter is an object with status and message
        status = statusData.status;
        message = statusData.message;
      } else {
        // If parameters are passed separately
        status = statusData;
        message = messageParam || '';
      }

      const { error } = await supabase
        .from('monitoring_status')
        .upsert({
          strategy_id: strategyId,
          status,
          message,
          indicators: indicators || {},
          market_conditions: market_conditions || {},
          updated_at: new Date().toISOString()
        });

      if (error) {
        if (error.code === '42P01') { // PostgreSQL code for 'relation does not exist'
          logService.log('warn', 'Monitoring status table does not exist yet. This is normal if you haven\'t created it.', null, 'TradeEngine');
        } else if (error.status === 406) { // Not Acceptable - likely auth issue
          logService.log('warn', `Authentication issue when updating monitoring status for ${strategyId}`, error, 'TradeEngine');
        } else {
          throw error;
        }
      }

      // Emit event for UI updates
      eventBus.emit('monitoring:status:changed', {
        strategyId,
        status,
        message,
        indicators,
        market_conditions,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logService.log('error', `Failed to update monitoring status for ${strategyId}`, error, 'TradeEngine');
      // Don't throw the error, just log it to prevent cascading failures
    }
  }

  async addStrategy(strategyOrId: Strategy | string): Promise<void> {
    try {
      let strategy: Strategy;
      const strategyId = typeof strategyOrId === 'string' ? strategyOrId : strategyOrId.id;

      // Initialize the trade engine if not already initialized
      if (!this.initialized) {
        await this.initialize();
      }

      // If a string ID was passed, fetch the strategy from the database
      if (typeof strategyOrId === 'string') {
        try {
          const { data, error } = await supabase
            .from('strategies')
            .select('*')
            .eq('id', strategyOrId)
            .single();

          if (error) {
            if (error.status === 406) {
              logService.log('warn', `Authentication issue when fetching strategy ${strategyId}`, error, 'TradeEngine');
              throw new Error(`Authentication issue when fetching strategy: ${error.message}`);
            } else {
              throw error;
            }
          }

          if (!data) {
            throw new Error(`Strategy ${strategyId} not found: No data returned`);
          }

          strategy = data;
        } catch (fetchError) {
          logService.log('error', `Failed to fetch strategy ${strategyId}`, fetchError, 'TradeEngine');
          throw fetchError;
        }
      } else {
        strategy = strategyOrId;
      }

      // Ensure the strategy is active
      if (strategy.status !== 'active') {
        logService.log('warn', `Strategy ${strategy.id} is not active, updating status`, { currentStatus: strategy.status }, 'TradeEngine');

        try {
          // Update the strategy status to active
          const { data: updatedStrategy, error: updateError } = await supabase
            .from('strategies')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('id', strategy.id)
            .select()
            .single();

          if (updateError) {
            if (updateError.status === 406) {
              logService.log('warn', `Authentication issue when updating strategy status for ${strategy.id}`, updateError, 'TradeEngine');
              throw new Error(`Authentication issue when updating strategy status: ${updateError.message}`);
            } else {
              throw updateError;
            }
          }

          if (!updatedStrategy) {
            throw new Error(`Failed to update strategy status: No data returned`);
          }

          // Use the updated strategy
          strategy = updatedStrategy;
        } catch (updateError) {
          logService.log('error', `Failed to update strategy status for ${strategy.id}`, updateError, 'TradeEngine');
          throw updateError;
        }
      }

      // Add to active strategies
      this.activeStrategies.set(strategy.id, strategy);

      // Initialize monitoring status
      try {
        await this.updateMonitoringStatus(strategy.id, {
          status: 'monitoring',
          message: 'Strategy activated, monitoring market conditions'
        });
      } catch (monitoringError) {
        // Log but continue even if monitoring status update fails
        logService.log('warn', `Failed to update monitoring status for ${strategy.id}, continuing anyway`, monitoringError, 'TradeEngine');
      }

      logService.log('info', `Added strategy ${strategy.id} to trade engine`, null, 'TradeEngine');
    } catch (error) {
      const strategyId = typeof strategyOrId === 'string' ? strategyOrId : strategyOrId.id;
      logService.log('error', `Failed to add strategy ${strategyId}`, error, 'TradeEngine');
      throw error;
    }
  }

  async removeStrategy(strategyId: string): Promise<void> {
    try {
      // Get all active trades for this strategy
      const activeTrades = tradeManager.getActiveTradesForStrategy(strategyId);

      // Close any active trades
      if (activeTrades && activeTrades.length > 0) {
        for (const trade of activeTrades) {
          try {
            await this.closeTrade(trade.id, 'Strategy removed');
          } catch (tradeError) {
            logService.log('warn', `Failed to close trade ${trade.id} during strategy removal`, tradeError, 'TradeEngine');
          }
        }
      }

      // Remove strategy from active strategies
      this.activeStrategies.delete(strategyId);
      logService.log('info', `Removed strategy ${strategyId} from trade engine`, null, 'TradeEngine');
    } catch (error) {
      logService.log('error', `Error removing strategy ${strategyId}`, error, 'TradeEngine');
      // Still remove the strategy even if there was an error closing trades
      this.activeStrategies.delete(strategyId);
    }
  }

  /**
   * Close a trade and release the allocated budget
   * @param tradeId The ID of the trade to close
   * @param reason The reason for closing the trade
   */
  async closeTrade(tradeId: string, reason: string): Promise<void> {
    try {
      // Execute the trade closure with retry logic
      await this.executeTradeOperation(async () => {
        // 1. Get the trade details
        const { data: trade, error: tradeError } = await supabase
          .from('trades')
          .select('*')
          .eq('id', tradeId)
          .single();

        if (tradeError) throw tradeError;
        if (!trade) throw new Error(`Trade ${tradeId} not found`);

        // Check if trade is already closed
        if (trade.status === 'closed') {
          logService.log('info', `Trade ${tradeId} is already closed`, null, 'TradeEngine');
          return;
        }

        // Calculate profit/loss if possible
        let profit = 0;
        if (trade.exit_price && trade.price && trade.quantity) {
          const entryValue = trade.price * trade.quantity;
          const exitValue = trade.exit_price * trade.quantity;
          profit = trade.side === 'buy' ?
            exitValue - entryValue :
            entryValue - exitValue;

          // Apply fees if available
          if (trade.fee) {
            profit -= typeof trade.fee === 'object' ?
              (trade.fee.cost || 0) :
              (typeof trade.fee === 'number' ? trade.fee : 0);
          }
        }

        // 2. Close the trade through the exchange
        try {
          // Close the position through the trade manager
          await tradeManager.closePosition(tradeId);
          logService.log('info', `Closed position for trade ${tradeId} through trade manager`, null, 'TradeEngine');
        } catch (closeError) {
          logService.log('warn', `Error closing position for trade ${tradeId} through trade manager, marking as closed anyway`, closeError, 'TradeEngine');
        }

        // 3. Update the trade status in the database
        const { error: updateError } = await supabase
          .from('trades')
          .update({
            status: 'closed',
            close_reason: reason,
            closed_at: new Date().toISOString(),
            exit_price: trade.exit_price || trade.price, // Use entry price if no exit price
            profit: profit,
            updated_at: new Date().toISOString()
          })
          .eq('id', tradeId);

        if (updateError) throw updateError;

        // 4. Release the budget allocation
        try {
          // First try using allocated_budget if available
          if (trade.allocated_budget && trade.allocated_budget > 0) {
            await tradeService.releaseBudgetFromTrade(trade.strategy_id, trade.allocated_budget, profit, tradeId, 'closed');
            logService.log('info', `Released allocated budget ${trade.allocated_budget} for trade ${tradeId}`, null, 'TradeEngine');
          }
          // Fall back to calculating from price and quantity
          else if (trade.price && trade.quantity) {
            const tradeCost = trade.price * trade.quantity;
            await tradeService.releaseBudgetFromTrade(trade.strategy_id, tradeCost, profit, tradeId, 'closed');
            logService.log('info', `Released calculated budget ${tradeCost} for trade ${tradeId}`, null, 'TradeEngine');
          } else {
            // Last resort: try to get the budget from the trade metadata
            if (trade.metadata && trade.metadata.tradeCost) {
              await tradeService.releaseBudgetFromTrade(trade.strategy_id, trade.metadata.tradeCost, profit, tradeId, 'closed');
              logService.log('info', `Released metadata budget ${trade.metadata.tradeCost} for trade ${tradeId}`, null, 'TradeEngine');
            } else {
              logService.log('warn', `Could not determine budget amount for trade ${tradeId}`, null, 'TradeEngine');

              // Try to update the strategy budget directly as a last resort
              try {
                const budget = await tradeService.getBudget(trade.strategy_id);
                if (budget) {
                  // Force a budget refresh event to ensure UI is updated
                  eventBus.emit('budget:updated', {
                    strategyId: trade.strategy_id,
                    tradeId,
                    profit,
                    timestamp: Date.now()
                  });
                }
              } catch (budgetRefreshError) {
                logService.log('warn', `Failed to refresh budget for strategy ${trade.strategy_id}`, budgetRefreshError, 'TradeEngine');
              }
            }
          }
        } catch (budgetError) {
          logService.log('error', `Failed to release budget for trade ${tradeId}`, budgetError, 'TradeEngine');
          // Continue even if budget release fails
        }

        // 5. Emit events to notify other components
        try {
          this.emit('tradeClosed', {
            tradeId,
            reason,
            strategyId: trade.strategy_id,
            profit
          });

          eventBus.emit('trade:closed', {
            tradeId,
            strategyId: trade.strategy_id,
            status: 'closed',
            reason,
            profit
          });

          eventBus.emit('trade:update', {
            tradeId,
            status: 'closed',
            strategyId: trade.strategy_id
          });

          // Also emit budget updated event
          eventBus.emit('budget:updated', {
            strategyId: trade.strategy_id,
            tradeId,
            profit,
            timestamp: Date.now()
          });
        } catch (eventError) {
          logService.log('warn', `Error emitting trade closed events for ${tradeId}`, eventError, 'TradeEngine');
        }

        logService.log('info', `Closed trade ${tradeId} for reason: ${reason}`, { profit }, 'TradeEngine');
      }, `close trade ${tradeId}`);
    } catch (error) {
      logService.log('error', `Failed to close trade ${tradeId}`, error, 'TradeEngine');
      throw error;
    }
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

  private async updateStrategyStatus(strategyId: string, status: 'active' | 'inactive'): Promise<void> {
    try {
      const { error } = await supabase
        .from('strategies')
        .update({
          status,
          updated_at: new Date().toISOString(),
          ...(status === 'inactive' ? { deactivated_at: new Date().toISOString() } : { deactivated_at: null })
        })
        .eq('id', strategyId);

      if (error) throw error;

      // Emit event for UI updates
      eventBus.emit('strategy:status:changed', {
        strategyId,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logService.log('error', `Failed to update strategy status for ${strategyId}`, error, 'TradeEngine');
      throw error;
    }
  }
}

export const tradeEngine = TradeEngine.getInstance();
