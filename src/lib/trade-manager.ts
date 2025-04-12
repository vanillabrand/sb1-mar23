import { EventEmitter } from './event-emitter';
import { TradeOptions, TradeResult, TradeStatus } from '../types';
import { logService } from './log-service';
import { exchangeService } from './exchange-service';
import { riskManager } from './risk-manager';
import { eventBus } from './event-bus';
import { ccxtService } from './ccxt-service';
import { demoService } from './demo-service';
import { tradeService } from './trade-service';

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

    // Reserve budget for this trade
    if (options.strategy_id) {
      const tradeAmount = options.amount || 0;
      const tradePrice = options.entry_price || 0;
      const tradeCost = tradeAmount * tradePrice;

      if (tradeCost > 0) {
        // Check if we have enough budget
        const budget = tradeService.getBudget(options.strategy_id);
        if (!budget || budget.available < tradeCost) {
          logService.log('warn', `Insufficient budget for trade: ${tradeCost} (available: ${budget?.available || 0})`, null, 'TradeManager');
          throw new Error(`Insufficient budget for trade: ${tradeCost} (available: ${budget?.available || 0})`);
        }

        // Reserve the budget
        const reserved = tradeService.reserveBudgetForTrade(options.strategy_id, tradeCost);
        if (!reserved) {
          logService.log('warn', `Failed to reserve budget for trade: ${tradeCost}`, null, 'TradeManager');
          throw new Error(`Failed to reserve budget for trade: ${tradeCost}`);
        }

        logService.log('info', `Reserved ${tradeCost} for trade in strategy ${options.strategy_id}`, null, 'TradeManager');
      }
    }

    try {
      // Determine if we should use TestNet, real exchange, or demo mode
      const isDemoMode = demoService.isInDemoMode();
      const isExchangeConnected = await exchangeService.isConnected();
      const useTestNet = options.testnet || isDemoMode;
      const useRealExchange = !useTestNet && isExchangeConnected;

      // Log the mode being used
      logService.log('info', `Executing trade in ${useTestNet ? 'TestNet/Demo' : (useRealExchange ? 'Real Exchange' : 'Simulated')} mode`, {
        useTestNet,
        useRealExchange,
        isDemoMode,
        isExchangeConnected,
        options
      }, 'TradeManager');

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
      } else if (options.demo || !useRealExchange) {
        // For demo mode without TestNet or when no real exchange is connected, create a simulated trade
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
        5000 // Reduced interval for more frequent updates
      );
    }

    // Create a complete trade status object with entry and exit conditions
    const tradeStatus = {
      status: orderDetails.status || 'pending',
      lastUpdate: Date.now(),
      timestamp: orderDetails.timestamp || Date.now(),
      symbol: orderDetails.symbol,
      side: orderDetails.side,
      entryPrice: orderDetails.entryPrice || orderDetails.entry_price,
      exitPrice: orderDetails.exitPrice,
      profit: orderDetails.profit,
      strategyId: orderDetails.strategyId || orderDetails.strategy_id,
      createdAt: new Date().toISOString(),
      executedAt: null,
      // Ensure entry and exit conditions are tracked
      entryConditions: orderDetails.entry_conditions || orderDetails.entryConditions || [],
      exitConditions: orderDetails.exit_conditions || orderDetails.exitConditions || [],
      stopLoss: orderDetails.stop_loss || orderDetails.stopLoss,
      takeProfit: orderDetails.take_profit || orderDetails.takeProfit,
      trailingStop: orderDetails.trailing_stop || orderDetails.trailingStop
    };

    this.activeOrders.set(orderId, tradeStatus);

    // Emit trades updated event
    this.emit('tradesUpdated', { orderId, status: tradeStatus });

    // Also emit to the event bus for UI components to listen
    eventBus.emit('tradesUpdated', { orderId, status: tradeStatus });
    eventBus.emit('trade:update', { orderId, status: tradeStatus });

    // Log that we're tracking this order with entry/exit conditions
    logService.log('info', `Started tracking order ${orderId} with entry/exit conditions`,
      {
        symbol: tradeStatus.symbol,
        entryConditions: tradeStatus.entryConditions,
        exitConditions: tradeStatus.exitConditions,
        stopLoss: tradeStatus.stopLoss,
        takeProfit: tradeStatus.takeProfit
      },
      'TradeManager');
  }

  private async updateActiveOrders(): Promise<void> {
    const updates = Array.from(this.activeOrders.entries()).map(async ([orderId, status]) => {
      try {
        // Fetch current order status from exchange
        const orderStatus = await exchangeService.fetchOrderStatus(orderId);

        // Get current market price for this symbol
        const symbol = status.symbol;
        let currentPrice = null;

        try {
          const marketData = await exchangeService.fetchMarketPrice(symbol);
          currentPrice = marketData.price;
        } catch (priceError) {
          logService.log('warn', `Failed to fetch current price for ${symbol}`, priceError, 'TradeManager');
        }

        // Check if we need to evaluate exit conditions
        if (currentPrice && status.status === 'filled' &&
            (status.exitConditions?.length > 0 || status.stopLoss || status.takeProfit || status.trailingStop)) {

          // Check stop loss
          if (status.stopLoss) {
            if ((status.side === 'buy' && currentPrice <= status.stopLoss) ||
                (status.side === 'sell' && currentPrice >= status.stopLoss)) {
              // Stop loss triggered
              await this.executeExitOrder(orderId, status, currentPrice, 'stop_loss');
              return; // Exit early as we've closed the position
            }
          }

          // Check take profit
          if (status.takeProfit) {
            if ((status.side === 'buy' && currentPrice >= status.takeProfit) ||
                (status.side === 'sell' && currentPrice <= status.takeProfit)) {
              // Take profit triggered
              await this.executeExitOrder(orderId, status, currentPrice, 'take_profit');
              return; // Exit early as we've closed the position
            }
          }

          // Check trailing stop if applicable
          if (status.trailingStop && status.highestPrice) {
            if (status.side === 'buy') {
              // For long positions, update highest price if current price is higher
              if (currentPrice > status.highestPrice) {
                this.activeOrders.set(orderId, { ...status, highestPrice: currentPrice });
              } else if (currentPrice <= (status.highestPrice - status.trailingStop)) {
                // Trailing stop triggered
                await this.executeExitOrder(orderId, status, currentPrice, 'trailing_stop');
                return; // Exit early as we've closed the position
              }
            } else { // For short positions
              // For short positions, update lowest price if current price is lower
              if (!status.lowestPrice || currentPrice < status.lowestPrice) {
                this.activeOrders.set(orderId, { ...status, lowestPrice: currentPrice });
              } else if (currentPrice >= (status.lowestPrice + status.trailingStop)) {
                // Trailing stop triggered
                await this.executeExitOrder(orderId, status, currentPrice, 'trailing_stop');
                return; // Exit early as we've closed the position
              }
            }
          } else if (status.trailingStop && !status.highestPrice && status.side === 'buy') {
            // Initialize highest price for trailing stop
            this.activeOrders.set(orderId, { ...status, highestPrice: currentPrice });
          } else if (status.trailingStop && !status.lowestPrice && status.side === 'sell') {
            // Initialize lowest price for trailing stop
            this.activeOrders.set(orderId, { ...status, lowestPrice: currentPrice });
          }

          // Check custom exit conditions if defined
          if (status.exitConditions?.length > 0) {
            // Implement custom exit condition evaluation here
            // This would typically involve checking technical indicators
            // For now, we'll just log that we're checking
            logService.log('info', `Checking exit conditions for ${orderId}`, { exitConditions: status.exitConditions }, 'TradeManager');
          }
        }

        // Update order status based on exchange response
        this.handleOrderStatusUpdate(orderId, orderStatus, currentPrice);
      } catch (error) {
        logService.log('error', `Failed to update order ${orderId}`, error, 'TradeManager');
      }
    });

    await Promise.allSettled(updates);
  }

  /**
   * Execute an exit order when conditions are met
   */
  private async executeExitOrder(orderId: string, status: any, currentPrice: number, reason: string): Promise<void> {
    try {
      logService.log('info', `Executing exit order for ${orderId} due to ${reason}`,
        { symbol: status.symbol, currentPrice, entryPrice: status.entryPrice }, 'TradeManager');

      // Calculate profit/loss
      const entryPrice = status.entryPrice || 0;
      const priceDiff = status.side === 'buy' ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
      const profitLoss = priceDiff * (status.amount || 1);

      // Execute the exit order on the exchange
      const exitSide = status.side === 'buy' ? 'sell' : 'buy';

      try {
        // If using TestNet or demo mode
        if (demoService.isInDemoMode()) {
          const testnetExchange = await demoService.getTestNetExchange();
          await testnetExchange.createOrder(
            status.symbol,
            'market',
            exitSide,
            status.amount,
            currentPrice
          );
        } else {
          // Real exchange
          await exchangeService.createOrder({
            symbol: status.symbol,
            side: exitSide,
            type: 'market',
            amount: status.amount,
            entry_price: currentPrice
          });
        }

        // Update order status
        const updatedStatus = {
          ...status,
          status: 'closed',
          exitPrice: currentPrice,
          profit: profitLoss,
          exitReason: reason,
          lastUpdate: Date.now(),
          closedAt: new Date().toISOString()
        };

        // Remove from active orders
        this.activeOrders.delete(orderId);

        // Record transaction for this trade closure
        try {
          // Import dynamically to avoid circular dependencies
          const { transactionService } = await import('./transaction-service');
          const { tradeService } = await import('./trade-service');

          // Get the strategy budget
          const budget = tradeService.getBudget(status.strategyId || status.strategy_id);
          if (budget) {
            await transactionService.recordTransaction(
              'trade',
              profitLoss, // Profit/loss amount
              budget.total,
              `Closed ${status.side} trade for ${status.symbol} due to ${reason}`,
              orderId,
              'trade',
              {
                strategy_id: status.strategyId || status.strategy_id,
                symbol: status.symbol,
                side: status.side,
                entry_price: status.entryPrice || status.entry_price,
                exit_price: currentPrice,
                profit: profitLoss,
                reason: reason
              }
            );
          }
        } catch (txError) {
          logService.log('warn', 'Failed to record transaction for trade closure', txError, 'TradeManager');
        }

        // Emit events
        this.emit('orderComplete', { orderId, status: updatedStatus });
        eventBus.emit('trade:closed', { orderId, status: updatedStatus });
        eventBus.emit('trade:update', { orderId, status: updatedStatus });

        logService.log('info', `Successfully closed position for ${orderId} due to ${reason}`,
          { profitLoss, exitPrice: currentPrice }, 'TradeManager');
      } catch (exitError) {
        logService.log('error', `Failed to execute exit order for ${orderId}`, exitError, 'TradeManager');
        throw exitError;
      }
    } catch (error) {
      logService.log('error', `Error in executeExitOrder for ${orderId}`, error, 'TradeManager');
    }
  }

  private handleOrderStatusUpdate(orderId: string, status: any, currentPrice?: number): void {
    if (this.isOrderComplete(status)) {
      // Get existing order details before removing
      const existingOrder = this.activeOrders.get(orderId);

      // Remove from active orders
      this.activeOrders.delete(orderId);

      // Create complete status object with all details
      const completeStatus = {
        ...existingOrder,
        status: status.status,
        lastUpdate: Date.now(),
        exitPrice: currentPrice || status.price,
        closedAt: new Date().toISOString()
      };

      // Emit completion events
      this.emit('orderComplete', { orderId, status: completeStatus });
      eventBus.emit('trade:closed', { orderId, status: completeStatus });
      eventBus.emit('trade:update', { orderId, status: completeStatus });

      logService.log('info', `Order ${orderId} completed with status: ${status.status}`,
        { symbol: existingOrder?.symbol, exitPrice: completeStatus.exitPrice }, 'TradeManager');
    } else {
      // Get existing order details
      const existingOrder = this.activeOrders.get(orderId);

      if (!existingOrder) {
        logService.log('warn', `Cannot update non-existent order ${orderId}`, null, 'TradeManager');
        return;
      }

      // Update with new status while preserving other fields
      const updatedStatus = {
        ...existingOrder,
        status: status.status,
        lastUpdate: Date.now(),
        currentPrice: currentPrice || existingOrder.currentPrice
      };

      this.activeOrders.set(orderId, updatedStatus);

      // Emit update event
      eventBus.emit('trade:update', { orderId, status: updatedStatus });
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

      // Record transaction for this trade
      try {
        // Import dynamically to avoid circular dependencies
        const { transactionService } = await import('./transaction-service');
        const { tradeService } = await import('./trade-service');

        // Get the strategy budget
        const budget = tradeService.getBudget(order.strategyId || order.strategy_id);
        if (budget) {
          await transactionService.recordTransaction(
            'trade',
            -order.amount * order.entryPrice, // Negative amount for trade creation
            budget.total,
            `Created ${order.side} trade for ${order.symbol}`,
            tradeId,
            'trade',
            {
              strategy_id: order.strategyId || order.strategy_id,
              symbol: order.symbol,
              side: order.side,
              price: order.entryPrice || order.entry_price,
              quantity: order.amount,
              entryConditions: order.entryConditions || order.entry_conditions || [],
              exitConditions: order.exitConditions || order.exit_conditions || []
            }
          );
        }
      } catch (txError) {
        logService.log('warn', 'Failed to record transaction for trade execution', txError, 'TradeManager');
      }

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
   * Create a simulated order for demo mode with complete entry and exit conditions
   */
  private createSimulatedOrder(options: TradeOptions, tradeId: string): any {
    const now = Date.now();

    // Ensure we have entry and exit conditions
    let entryConditions = options.entryConditions || options.entry_conditions || [];
    let exitConditions = options.exitConditions || options.exit_conditions || [];

    // Handle string-based conditions (from DeepSeek)
    if (typeof entryConditions === 'string') {
      entryConditions = [entryConditions];
    }

    if (typeof exitConditions === 'string') {
      exitConditions = [exitConditions];
    }

    // Generate realistic price based on the symbol
    let entryPrice = options.entry_price || 0;
    if (!entryPrice || entryPrice === 0) {
      // Set realistic base prices for common symbols
      if (options.symbol.includes('BTC')) {
        // Generate a random BTC price between $60,000 and $70,000
        entryPrice = 60000 + (Math.random() * 10000);
      } else if (options.symbol.includes('ETH')) {
        // Generate a random ETH price between $2,800 and $3,500
        entryPrice = 2800 + (Math.random() * 700);
      } else if (options.symbol.includes('SOL')) {
        // Generate a random SOL price between $120 and $180
        entryPrice = 120 + (Math.random() * 60);
      } else if (options.symbol.includes('BNB')) {
        // Generate a random BNB price between $450 and $550
        entryPrice = 450 + (Math.random() * 100);
      } else if (options.symbol.includes('XRP')) {
        // Generate a random XRP price between $0.45 and $0.65
        entryPrice = 0.45 + (Math.random() * 0.2);
      } else if (options.symbol.includes('DOGE')) {
        // Generate a random DOGE price between $0.10 and $0.20
        entryPrice = 0.10 + (Math.random() * 0.1);
      } else if (options.symbol.includes('ADA')) {
        // Generate a random ADA price between $0.35 and $0.55
        entryPrice = 0.35 + (Math.random() * 0.2);
      } else {
        // Default for other symbols - random price between $1 and $100
        entryPrice = 1 + (Math.random() * 99);
      }
    }

    // If no entry conditions provided, create a basic one
    if (entryConditions.length === 0) {
      const direction = options.side === 'buy' ? 'above' : 'below';
      // Create a string-based entry condition
      entryConditions = [`Price crosses ${direction} ${entryPrice.toFixed(2)}`];
    }

    // If no exit conditions and no stop loss/take profit, create basic ones
    if (exitConditions.length === 0 && !options.stop_loss && !options.take_profit) {
      const direction = options.side === 'buy' ? 1 : -1;

      // Default 2% stop loss
      const stopLoss = entryPrice * (1 - (0.02 * direction));
      // Default 4% take profit
      const takeProfit = entryPrice * (1 + (0.04 * direction));

      options.stop_loss = stopLoss;
      options.take_profit = takeProfit;

      // Create string-based exit conditions
      exitConditions = [
        `Stop loss at ${stopLoss.toFixed(2)}`,
        `Take profit at ${takeProfit.toFixed(2)}`
      ];
    }

    // Generate a realistic amount based on the price
    let amount = options.amount;
    if (!amount || amount === 0) {
      // For high-priced assets like BTC, use smaller amounts
      if (entryPrice > 10000) {
        // For BTC: 0.001 to 0.05 BTC
        amount = 0.001 + (Math.random() * 0.049);
      } else if (entryPrice > 1000) {
        // For ETH: 0.01 to 0.5 ETH
        amount = 0.01 + (Math.random() * 0.49);
      } else if (entryPrice > 100) {
        // For mid-priced assets: 0.1 to 2.0 units
        amount = 0.1 + (Math.random() * 1.9);
      } else if (entryPrice > 10) {
        // For lower-priced assets: 1 to 10 units
        amount = 1 + (Math.random() * 9);
      } else if (entryPrice > 1) {
        // For very low-priced assets: 10 to 100 units
        amount = 10 + (Math.random() * 90);
      } else {
        // For extremely low-priced assets (like SHIB): 1000 to 10000 units
        amount = 1000 + (Math.random() * 9000);
      }
    }

    // Log that we're creating a simulated order with entry/exit conditions
    logService.log('info', `Creating simulated order with entry/exit conditions`,
      {
        tradeId,
        symbol: options.symbol,
        entryPrice,
        amount,
        entryConditions,
        exitConditions,
        stopLoss: options.stop_loss,
        takeProfit: options.take_profit
      },
      'TradeManager');

    return {
      id: tradeId,
      status: 'pending', // Initial status is pending, will be updated to filled after a short delay
      symbol: options.symbol,
      side: options.side,
      type: options.type || 'market',
      amount: amount,
      entryPrice: entryPrice,
      stopLoss: options.stopLoss || options.stop_loss || 0,
      takeProfit: options.takeProfit || options.take_profit || 0,
      trailingStop: options.trailingStop || options.trailing_stop,
      timestamp: now,
      strategyId: options.strategyId || options.strategy_id || '',
      createdAt: new Date(now).toISOString(),
      executedAt: null,
      entryConditions: entryConditions,
      exitConditions: exitConditions,
      // For backward compatibility
      entry_conditions: entryConditions,
      exit_conditions: exitConditions
      // Removed duplicate status key
    };
  }
}

export const tradeManager = new TradeManager();
