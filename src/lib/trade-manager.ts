import { EventEmitter } from './event-emitter';
import { TradeOptions, TradeResult, TradeStatus } from '../types';
import { logService } from './log-service';
import { exchangeService } from './exchange-service';
import { riskManager } from './risk-manager';

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
      const activeTrades = Array.from(this.activeOrders.entries())
        .filter(([_, status]) => status.status === 'pending')
        .map(([orderId, status]) => ({
          id: orderId,
          ...status
        }));

      return activeTrades.filter(trade => trade.strategyId === strategyId);
    } catch (error) {
      logService.log('error', `Failed to get active trades for strategy ${strategyId}`, 
        error, 'TradeManager');
      return [];
    }
  }

  async executeTrade(options: TradeOptions): Promise<TradeResult> {
    const tradeId = this.generateTradeId(options);
    
    try {
      await this.validateTradePrerequisites(options);
      
      const order = await this.executeTradeWithRetry(options);
      
      await this.recordTradeExecution(tradeId, order);
      
      this.startOrderTracking(order.id);
      
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

  private startOrderTracking(orderId: string): void {
    if (!this.orderUpdateInterval) {
      this.orderUpdateInterval = setInterval(
        () => this.updateActiveOrders(),
        10000
      );
    }

    this.activeOrders.set(orderId, { status: 'pending', lastUpdate: Date.now() });
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
    return `${options.symbol}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
}

export const tradeManager = new TradeManager();
