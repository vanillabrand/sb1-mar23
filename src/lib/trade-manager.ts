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

      // Get the trade status
      const status = this.activeOrders.get(tradeId);
      if (!status) {
        throw new Error(`Trade ${tradeId} status not found`);
      }

      // Validate the trade has required fields
      if (!status.symbol) {
        throw new Error(`Trade ${tradeId} is missing symbol`);
      }

      if (!status.amount || status.amount <= 0) {
        throw new Error(`Trade ${tradeId} has invalid amount: ${status.amount}`);
      }

      // Get current price for calculating profit/loss
      let currentPrice = 0;
      try {
        const marketData = await exchangeService.fetchMarketPrice(status.symbol);
        currentPrice = marketData.price;
      } catch (priceError) {
        logService.log('warn', `Failed to fetch current price for ${status.symbol}, using fallback`, priceError, 'TradeManager');
        // Use entry price as fallback
        currentPrice = status.entryPrice || 0;
      }

      // Calculate profit/loss
      const entryPrice = status.entryPrice || status.entry_price || 0;
      let profitLoss = 0;

      if (entryPrice > 0 && currentPrice > 0) {
        const priceDiff = status.side === 'buy' ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
        profitLoss = priceDiff * (status.amount || 1);
      }

      // If using a real exchange, close the position
      try {
        // Implement real exchange position closing logic here
        await exchangeService.cancelOrder(tradeId);
        logService.log('info', `Closed position for trade ${tradeId} on exchange`, null, 'TradeManager');
      } catch (exchangeError) {
        logService.log('warn', `Error closing position on exchange for trade ${tradeId}, continuing with local cleanup`, exchangeError, 'TradeManager');
      }

      // Release budget for this trade
      const strategyId = status.strategyId || status.strategy_id;
      if (strategyId) {
        try {
          // Calculate the trade cost
          const tradeCost = status.amount * entryPrice;

          // Release the budget with profit/loss
          tradeService.releaseBudgetFromTrade(strategyId, tradeCost, profitLoss, tradeId);
          logService.log('info', `Released budget for trade ${tradeId} with profit/loss ${profitLoss}`,
            { strategyId, tradeCost, profitLoss }, 'TradeManager');
        } catch (budgetError) {
          logService.log('warn', `Failed to release budget for trade ${tradeId}`, budgetError, 'TradeManager');
        }
      }

      // Remove from active orders
      this.activeOrders.delete(tradeId);

      // Emit trade closed event with updated status including profit/loss
      const closedStatus = {
        ...status,
        status: 'closed',
        exitPrice: currentPrice,
        profit: profitLoss,
        exitReason: 'manual_close',
        lastUpdate: Date.now(),
        closedAt: new Date().toISOString()
      };

      this.emit('tradeClosed', { tradeId, reason: 'manual_close', status: closedStatus });
      eventBus.emit('trade:closed', { tradeId, status: closedStatus });
      eventBus.emit('trade:update', { tradeId, status: closedStatus });

      logService.log('info', `Closed position for trade ${tradeId} with profit/loss ${profitLoss}`,
        { exitPrice: currentPrice, profit: profitLoss }, 'TradeManager');
    } catch (error) {
      logService.log('error', `Failed to close position for trade ${tradeId}`, error, 'TradeManager');
      throw error;
    }
  }

  async executeTrade(options: TradeOptions): Promise<TradeResult> {
    const tradeId = this.generateTradeId(options);

    // Reserve budget for this trade
    if (options.strategy_id || options.strategyId) {
      const strategyId = options.strategy_id || options.strategyId;
      let tradeAmount = options.amount || 0;
      let tradePrice = options.entry_price || 0;

      // Ensure we have a valid entry price
      if (tradePrice <= 0) {
        try {
          // Try to get current market price
          const marketData = await exchangeService.fetchMarketPrice(options.symbol);
          tradePrice = marketData.price;
          // Update the options with the current price
          options.entry_price = tradePrice;
          logService.log('info', `Updated entry price for ${options.symbol} to ${tradePrice}`, null, 'TradeManager');
        } catch (error) {
          logService.log('warn', `Failed to fetch market price for ${options.symbol}`, error, 'TradeManager');
          // Use a reasonable fallback price
          if (options.symbol.includes('BTC')) {
            tradePrice = 45000;
          } else if (options.symbol.includes('ETH')) {
            tradePrice = 3000;
          } else {
            tradePrice = 100;
          }
          options.entry_price = tradePrice;
        }
      }

      // Ensure we have a valid amount
      if (tradeAmount <= 0) {
        logService.log('warn', `Invalid trade amount: ${tradeAmount} for ${options.symbol}`, null, 'TradeManager');

        // Get the budget to calculate a reasonable amount
        const budget = tradeService.getBudget(strategyId);
        if (budget && budget.available > 0) {
          // Use at most 20% of available budget for a single trade
          const maxBudgetToUse = Math.min(budget.available, budget.available * 0.2);
          tradeAmount = maxBudgetToUse / tradePrice;
          // Round to 6 decimal places for crypto
          tradeAmount = Math.round(tradeAmount * 1000000) / 1000000;
          options.amount = tradeAmount;

          logService.log('info', `Calculated trade amount ${tradeAmount} based on budget ${budget.available} for ${options.symbol}`, null, 'TradeManager');
        } else {
          // Use a small default amount
          tradeAmount = 0.01;
          options.amount = tradeAmount;
          logService.log('info', `Using default trade amount ${tradeAmount} for ${options.symbol}`, null, 'TradeManager');
        }
      }

      // Calculate trade cost and enforce minimum trade value of $5
      const tradeCost = tradeAmount * tradePrice;
      const MIN_TRADE_VALUE = 5; // Minimum $5 trade as per exchange requirements

      if (tradeCost < MIN_TRADE_VALUE && tradeCost > 0) {
        // Adjust amount to meet minimum trade value
        tradeAmount = MIN_TRADE_VALUE / tradePrice;
        // Round to 6 decimal places for crypto
        tradeAmount = Math.round(tradeAmount * 1000000) / 1000000;
        options.amount = tradeAmount;

        logService.log('info', `Adjusted trade amount to meet minimum $5 requirement: ${tradeAmount} ${options.symbol}`,
          { originalCost: tradeCost, newCost: MIN_TRADE_VALUE }, 'TradeManager');
      }

      if (tradeCost > 0) {
        // Check if we have enough budget
        const budget = tradeService.getBudget(strategyId);
        if (!budget) {
          logService.log('warn', `No budget found for strategy ${strategyId}`, null, 'TradeManager');
          throw new Error(`No budget found for strategy ${strategyId}`);
        }

        if (budget.available < tradeCost) {
          // Try to adjust the amount to fit within the available budget
          if (budget.available > 0) {
            const adjustedAmount = budget.available / tradePrice;
            // Round to 6 decimal places for crypto
            const roundedAmount = Math.round(adjustedAmount * 1000000) / 1000000;

            if (roundedAmount > 0) {
              logService.log('warn',
                `Adjusting trade amount from ${tradeAmount} to ${roundedAmount} to fit within available budget ${budget.available}`,
                null, 'TradeManager');

              tradeAmount = roundedAmount;
              options.amount = tradeAmount;
              const adjustedCost = tradeAmount * tradePrice;

              // Reserve the adjusted budget
              const reserved = tradeService.reserveBudgetForTrade(strategyId, adjustedCost, tradeId);
              if (!reserved) {
                logService.log('warn', `Failed to reserve adjusted budget for trade: ${adjustedCost}`, null, 'TradeManager');
                throw new Error(`Failed to reserve adjusted budget for trade: ${adjustedCost}`);
              }
            } else {
              logService.log('warn', `Insufficient budget for trade: ${tradeCost} (available: ${budget.available})`, null, 'TradeManager');
              throw new Error(`Insufficient budget for trade: ${tradeCost} (available: ${budget.available})`);
            }
          } else {
            logService.log('warn', `Insufficient budget for trade: ${tradeCost} (available: ${budget.available})`, null, 'TradeManager');
            throw new Error(`Insufficient budget for trade: ${tradeCost} (available: ${budget.available})`);
          }
        } else {
          // Reserve the budget
          const reserved = tradeService.reserveBudgetForTrade(strategyId, tradeCost, tradeId);
          if (!reserved) {
            logService.log('warn', `Failed to reserve budget for trade: ${tradeCost}`, null, 'TradeManager');
            throw new Error(`Failed to reserve budget for trade: ${tradeCost}`);
          }
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

        // Release budget for this trade
        const strategyId = status.strategyId || status.strategy_id;
        if (strategyId) {
          try {
            // Calculate the trade cost
            const tradeCost = status.amount * entryPrice;

            // Release the budget with profit/loss
            tradeService.releaseBudgetFromTrade(strategyId, tradeCost, profitLoss, orderId);
            logService.log('info', `Released budget for trade ${orderId} with profit/loss ${profitLoss}`,
              { strategyId, tradeCost, profitLoss }, 'TradeManager');
          } catch (budgetError) {
            logService.log('warn', `Failed to release budget for trade ${orderId}`, budgetError, 'TradeManager');
          }
        }

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
    // Use a more structured ID format to prevent duplicates
    // Include timestamp with milliseconds for uniqueness
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 11);
    return `${options.symbol}-${timestamp}-${randomId}`;
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
      try {
        // Try to get current market price from exchange service
        const marketData = exchangeService.fetchMarketPrice(options.symbol);
        if (marketData && marketData.price) {
          entryPrice = marketData.price;
          // Update the options with the current price
          options.entry_price = entryPrice;
          logService.log('info', `Updated entry price for ${options.symbol} to ${entryPrice}`, null, 'TradeManager');
        }
      } catch (error) {
        logService.log('warn', `Failed to fetch market price for ${options.symbol}, using fallback price`, error, 'TradeManager');

        // Set realistic base prices for common symbols as fallback
        if (options.symbol.includes('BTC')) {
          // Use a more stable BTC price around $45,000
          entryPrice = 45000 + (Math.random() * 1000);
        } else if (options.symbol.includes('ETH')) {
          // Use a more stable ETH price around $3,000
          entryPrice = 3000 + (Math.random() * 100);
        } else if (options.symbol.includes('SOL')) {
          entryPrice = 120 + (Math.random() * 10);
        } else if (options.symbol.includes('BNB')) {
          entryPrice = 450 + (Math.random() * 10);
        } else if (options.symbol.includes('XRP')) {
          entryPrice = 0.5 + (Math.random() * 0.05);
        } else if (options.symbol.includes('DOGE')) {
          entryPrice = 0.1 + (Math.random() * 0.01);
        } else if (options.symbol.includes('ADA')) {
          entryPrice = 0.4 + (Math.random() * 0.02);
        } else {
          // Default for other symbols - more stable price
          entryPrice = 10 + (Math.random() * 5);
        }

        // Update the options with the fallback price
        options.entry_price = entryPrice;
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

    // Generate a realistic amount based on the price and budget
    let amount = options.amount;
    if (!amount || amount === 0) {
      // Get strategy budget if available
      let budget = null;
      let maxAmount = 0;

      if (options.strategyId || options.strategy_id) {
        const strategyId = options.strategyId || options.strategy_id;
        try {
          budget = tradeService.getBudget(strategyId);
          if (budget && budget.available > 0) {
            // Calculate maximum amount based on available budget
            // Use only a portion of the available budget (max 20%)
            const maxBudgetToUse = Math.min(budget.available, budget.available * 0.2);
            maxAmount = maxBudgetToUse / entryPrice;

            logService.log('info', `Calculated max amount ${maxAmount} based on budget ${budget.available} for ${options.symbol}`, null, 'TradeManager');
          }
        } catch (error) {
          logService.log('warn', `Failed to get budget for strategy ${strategyId}`, error, 'TradeManager');
        }
      }

      // Calculate a reasonable amount based on price and budget
      let calculatedAmount = 0;

      // For high-priced assets like BTC, use smaller amounts
      if (entryPrice > 10000) {
        // For BTC: 0.001 to 0.01 BTC
        calculatedAmount = 0.001 + (Math.random() * 0.009);
      } else if (entryPrice > 1000) {
        // For ETH: 0.01 to 0.1 ETH
        calculatedAmount = 0.01 + (Math.random() * 0.09);
      } else if (entryPrice > 100) {
        // For mid-priced assets: 0.1 to 1.0 units
        calculatedAmount = 0.1 + (Math.random() * 0.9);
      } else if (entryPrice > 10) {
        // For lower-priced assets: 1 to 5 units
        calculatedAmount = 1 + (Math.random() * 4);
      } else if (entryPrice > 1) {
        // For very low-priced assets: 5 to 20 units
        calculatedAmount = 5 + (Math.random() * 15);
      } else {
        // For extremely low-priced assets (like SHIB): 100 to 500 units
        calculatedAmount = 100 + (Math.random() * 400);
      }

      // If we have a budget, ensure we don't exceed it
      if (maxAmount > 0) {
        amount = Math.min(calculatedAmount, maxAmount);
      } else {
        amount = calculatedAmount;
      }

      // Round to 6 decimal places for crypto
      amount = Math.round(amount * 1000000) / 1000000;

      // Update the options with the calculated amount
      options.amount = amount;
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

    // Validate the trade cost against budget if available
    const tradeCost = amount * entryPrice;
    let budget = null;

    if (options.strategyId || options.strategy_id) {
      const strategyId = options.strategyId || options.strategy_id;
      try {
        budget = tradeService.getBudget(strategyId);
        if (budget && budget.available < tradeCost) {
          // Adjust amount to fit within available budget
          const adjustedAmount = budget.available / entryPrice;
          logService.log('warn',
            `Trade cost ${tradeCost} exceeds available budget ${budget.available}. Adjusting amount from ${amount} to ${adjustedAmount}`,
            null, 'TradeManager');
          amount = adjustedAmount;
          // Round to 6 decimal places for crypto
          amount = Math.round(amount * 1000000) / 1000000;
        }
      } catch (error) {
        logService.log('warn', `Failed to validate budget for strategy ${strategyId}`, error, 'TradeManager');
      }
    }

    // Create the final trade object
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
      exit_conditions: exitConditions,
      // Add market type if available
      marketType: options.marketType || 'spot'
    };
  }
}

export const tradeManager = new TradeManager();
