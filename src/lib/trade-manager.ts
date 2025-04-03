import { EventEmitter } from './event-emitter';
import { TradeOptions, TradeResult, TradeStatus } from '../types';
import { logService } from './log-service';
import { exchangeService } from './exchange-service';
import { riskManager } from './risk-manager';
import { eventBus } from './event-bus';
import { ccxtService } from './ccxt-service';
import { demoService } from './demo-service';

class TradeManager extends EventEmitter {
  private readonly EXECUTION_TIMEOUT = 30000;
  private readonly MAX_RETRIES = 3;
  private activeOrders = new Map<string, TradeStatus>();
  private orderUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  getActiveTradesForStrategy(strategyId: string): any[] {
    try {
      // Get all trades from active orders
      const activeTrades = Array.from(this.activeOrders.entries())
        .map(([orderId, status]) => ({
          id: orderId,
          ...status,
          // Ensure these fields are present for UI display
          timestamp: status.timestamp || Date.now(),
          symbol: status.symbol || 'BTC/USDT',
          side: status.side || 'buy',
          entryPrice: status.entryPrice || 0,
          exitPrice: status.exitPrice,
          profit: status.profit,
          strategyId: status.strategyId || strategyId
        }));

      // Filter by strategy ID
      return activeTrades.filter(trade => trade.strategyId === strategyId);
    } catch (error) {
      logService.log('error', `Failed to get active trades for strategy ${strategyId}`,
        error, 'TradeManager');
      return [];
    }
  }

  /**
   * Close a position for a trade
   * @param tradeId The ID of the trade to close
   */
  async closePosition(tradeId: string): Promise<void> {
    try {
      // Find the trade in active orders
      if (!this.activeOrders.has(tradeId)) {
        throw new Error(`Trade ${tradeId} not found in active orders`);
      }

      // If using a real exchange, close the position
      try {
        // Implement real exchange position closing logic here
        await exchangeService.cancelOrder(tradeId);
        logService.log('info', `Closed position for trade ${tradeId} on exchange`, null, 'TradeManager');
      } catch (exchangeError) {
        logService.log('warn', `Error closing position on exchange for trade ${tradeId}, continuing with local cleanup`, exchangeError, 'TradeManager');
      }

      // Remove from active orders
      this.activeOrders.delete(tradeId);

      // Emit trade closed event
      this.emit('tradeClosed', { tradeId, reason: 'manual_close' });

      logService.log('info', `Closed position for trade ${tradeId}`, null, 'TradeManager');
    } catch (error) {
      logService.log('error', `Failed to close position for trade ${tradeId}`, error, 'TradeManager');
      throw error;
    }
  }

  async executeTrade(options: TradeOptions): Promise<TradeResult> {
    const tradeId = this.generateTradeId(options);

    try {
      // Determine if we should use TestNet or real exchange
      const useTestNet = options.testnet || demoService.isInDemoMode();

      // Log the mode being used
      logService.log('info', `Executing trade in ${useTestNet ? 'TestNet/Demo' : 'Real'} mode`, { useTestNet, options }, 'TradeManager');

      // Set the testnet option
      options.testnet = useTestNet;

      // If using TestNet, we'll use real TestNet trades
      if (useTestNet) {
        try {
          // Get TestNet exchange instance from demo service
          const testnetExchange = await demoService.getTestNetExchange();

          // Execute the trade on TestNet
          const testnetOrder = await testnetExchange.createOrder(
            options.symbol,
            options.type || 'market',
            options.side,
            options.amount,
            options.entry_price
          );

          // Track the order
          this.startOrderTracking(testnetOrder.id, {
            ...testnetOrder,
            strategyId: options.strategy_id,
            status: 'pending',
            timestamp: Date.now(),
            createdAt: new Date().toISOString(),
            executedAt: null
          });

          // Emit trade created event
          this.emit('tradeCreated', { tradeId: testnetOrder.id, order: testnetOrder });
          eventBus.emit('trade:created', { tradeId: testnetOrder.id, order: testnetOrder });

          return this.createTradeResult(testnetOrder, 'pending');
        } catch (testnetError) {
          logService.log('error', 'Failed to execute TestNet trade', testnetError, 'TradeManager');

          // Fall back to simulated trade if TestNet fails
          const simulatedOrder = this.createSimulatedOrder(options, tradeId);
          this.startOrderTracking(tradeId, simulatedOrder);

          // Emit trade created event
          this.emit('tradeCreated', { tradeId, order: simulatedOrder });
          eventBus.emit('trade:created', { tradeId, order: simulatedOrder });

          return this.createTradeResult(simulatedOrder, 'pending');
        }
      } else if (options.demo) {
        // For demo mode without TestNet, create a simulated trade
        const simulatedOrder = this.createSimulatedOrder(options, tradeId);
        this.startOrderTracking(tradeId, simulatedOrder);

        // Emit trade created event
        this.emit('tradeCreated', { tradeId, order: simulatedOrder });
        eventBus.emit('trade:created', { tradeId, order: simulatedOrder });

        return this.createTradeResult(simulatedOrder, 'pending');
      }

      // For real trades, validate prerequisites
      await this.validateTradePrerequisites(options);

      const order = await this.executeTradeWithRetry(options);

      await this.recordTradeExecution(tradeId, order);

      this.startOrderTracking(order.id, order);

      return this.createTradeResult(order, 'executed');
    } catch (error) {
      await this.handleTradeError(tradeId, error);
      throw error;
    }
  }

  private async validateTradePrerequisites(options: TradeOptions): Promise<void> {
    const [exchangeHealth, riskValidation] = await Promise.all([
      exchangeService.checkHealth(),
      riskManager.validateTrade(options)
    ]);

    if (!exchangeHealth.ok) {
      throw new Error(`Exchange unavailable: ${exchangeHealth.message}`);
    }

    if (!riskValidation.approved) {
      throw new Error(`Risk validation failed: ${riskValidation.reason}`);
    }
  }

  private async executeTradeWithRetry(options: TradeOptions): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await this.executeWithTimeout(
          () => exchangeService.createOrder(options),
          this.EXECUTION_TIMEOUT
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (this.isRetryableError(error) && attempt < this.MAX_RETRIES) {
          await this.handleRetry(attempt, options);
          continue;
        }

        break;
      }
    }

    throw new Error(`Trade execution failed after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  private startOrderTracking(orderId: string, orderDetails: any = {}): void {
    if (!this.orderUpdateInterval) {
      this.orderUpdateInterval = setInterval(
        () => this.updateActiveOrders(),
        10000
      );
    }

    // Create a complete trade status object
    const tradeStatus = {
      status: orderDetails.status || 'pending',
      lastUpdate: Date.now(),
      timestamp: orderDetails.timestamp || Date.now(),
      symbol: orderDetails.symbol,
      side: orderDetails.side,
      entryPrice: orderDetails.entryPrice,
      exitPrice: orderDetails.exitPrice,
      profit: orderDetails.profit,
      strategyId: orderDetails.strategyId,
      createdAt: new Date().toISOString(),
      executedAt: null
    };

    this.activeOrders.set(orderId, tradeStatus);

    // Emit trades updated event
    this.emit('tradesUpdated', { orderId, status: tradeStatus });

    // Also emit to the event bus for UI components to listen
    eventBus.emit('tradesUpdated', { orderId, status: tradeStatus });
    eventBus.emit('trade:update', { orderId, status: tradeStatus });
  }

  private async updateActiveOrders(): Promise<void> {
    const updates = Array.from(this.activeOrders.entries()).map(async ([orderId, status]) => {
      try {
        const orderStatus = await exchangeService.fetchOrderStatus(orderId);
        this.handleOrderStatusUpdate(orderId, orderStatus);
      } catch (error) {
        logService.log('error', `Failed to update order ${orderId}`, error, 'TradeManager');
      }
    });

    await Promise.allSettled(updates);
  }

  private handleOrderStatusUpdate(orderId: string, status: any): void {
    if (this.isOrderComplete(status)) {
      this.activeOrders.delete(orderId);
      this.emit('orderComplete', { orderId, status });
    } else {
      this.activeOrders.set(orderId, {
        status: status.status,
        lastUpdate: Date.now()
      });
    }
  }

  cleanup(): void {
    if (this.orderUpdateInterval) {
      clearInterval(this.orderUpdateInterval);
      this.orderUpdateInterval = null;
    }
    this.activeOrders.clear();
  }

  private generateTradeId(options: TradeOptions): string {
    return `${options.symbol}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      )
    ]);
  }

  private isRetryableError(error: any): boolean {
    // Add logic to determine if error is retryable
    return error.message?.includes('timeout') ||
           error.message?.includes('rate limit') ||
           error.message?.includes('network');
  }

  private async handleRetry(attempt: number, options: TradeOptions): Promise<void> {
    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
    logService.log('info', `Retrying trade execution (attempt ${attempt + 1})`,
      { options }, 'TradeManager');
  }

  /**
   * Record trade execution details
   */
  private async recordTradeExecution(tradeId: string, order: any): Promise<void> {
    try {
      // In a real implementation, this would record the trade to a database
      logService.log('info', `Trade ${tradeId} executed successfully`, { order }, 'TradeManager');

      // Emit trade executed event
      this.emit('tradeExecuted', { tradeId, order });

      // Also emit to the event bus for UI components to listen
      eventBus.emit('trade:executed', { tradeId, order });
      eventBus.emit('trade:update', { tradeId, order });
    } catch (error) {
      logService.log('error', `Failed to record trade execution for ${tradeId}`, error, 'TradeManager');
    }
  }

  private async handleTradeError(tradeId: string, error: any): Promise<void> {
    logService.log('error', `Trade execution failed for ${tradeId}`,
      error, 'TradeManager');
    this.emit('tradeError', { tradeId, error });
  }

  private createTradeResult(order: any, status: string): TradeResult {
    return {
      id: order.id,
      status,
      timestamp: Date.now(),
      details: order
    };
  }

  private isOrderComplete(status: any): boolean {
    return ['filled', 'cancelled', 'rejected'].includes(status.status);
  }

  /**
   * Create a simulated order for demo mode
   */
  private createSimulatedOrder(options: TradeOptions, tradeId: string): any {
    const now = Date.now();

    return {
      id: tradeId,
      status: 'pending',
      symbol: options.symbol,
      side: options.side,
      type: options.type || 'market',
      amount: options.amount,
      entryPrice: options.entryPrice || options.entry_price || 0,
      stopLoss: options.stopLoss || options.stop_loss || 0,
      takeProfit: options.takeProfit || options.take_profit || 0,
      trailingStop: options.trailingStop || options.trailing_stop,
      timestamp: now,
      strategyId: options.strategyId || options.strategy_id || '',
      createdAt: new Date(now).toISOString(),
      executedAt: null
    };
  }
}

export const tradeManager = new TradeManager();
