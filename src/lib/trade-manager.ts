import { EventEmitter } from './event-emitter';
import { TradeOptions, TradeResult, TradeStatus } from '../types';
import { logService } from './log-service';
import { exchangeService } from './exchange-service';
import { riskManager } from './risk-manager';
import { eventBus } from './event-bus';
import { ccxtService } from './ccxt-service';
import { demoService } from './demo-service';
import { tradeService } from './trade-service';
import { enhancedPositionSizing } from './enhanced-position-sizing';
import { tradeBatchingService } from './trade-batching-service';

class TradeManager extends EventEmitter {
  private readonly EXECUTION_TIMEOUT = 30000;
  private readonly MAX_RETRIES = 5; // Increased from 3 to 5
  private readonly INITIAL_BACKOFF = 1000; // 1 second
  private readonly MAX_BACKOFF = 30000; // 30 seconds
  private readonly BACKOFF_FACTOR = 2; // Exponential backoff factor
  private readonly BACKOFF_JITTER = 0.2; // 20% jitter to avoid thundering herd
  private activeOrders = new Map<string, TradeStatus>();
  private orderUpdateInterval: NodeJS.Timeout | null = null;
  private circuitBreaker = {
    // Track different types of failures
    failures: {
      network: 0,
      exchange: 0,
      validation: 0,
      unknown: 0
    },
    totalFailures: 0,
    lastFailure: 0,
    // Different thresholds for different error types
    thresholds: {
      network: 3,     // Network errors are common but transient
      exchange: 5,     // Exchange API errors might require more patience
      validation: 2,   // Validation errors are likely to persist
      unknown: 3       // Unknown errors - be cautious
    },
    resetTimeout: 300000, // 5 minutes
    halfOpenTimeout: 60000, // 1 minute in half-open state
    isOpen: false,
    isHalfOpen: false,
    lastStateChange: 0,
    consecutiveSuccesses: 0,
    requiredSuccesses: 3  // Number of consecutive successes to close circuit
  };

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
          try {
            // Use enhanced position sizing service to calculate optimal position size
            const positionSize = await this.calculateOptimalPositionSize({
              strategyId,
              symbol: options.symbol,
              currentPrice: tradePrice,
              availableBudget: budget.available,
              side: options.side,
              confidence: options.confidence || 0.7,
              stopLossPrice: options.stop_loss,
              riskLevel: options.risk_level || 'Medium'
            });

            tradeAmount = positionSize;
            options.amount = tradeAmount;

            logService.log('info', `Calculated optimal position size ${tradeAmount} for ${options.symbol} using enhanced sizing algorithm`, {
              strategyId,
              availableBudget: budget.available,
              currentPrice: tradePrice
            }, 'TradeManager');
          } catch (positionSizeError) {
            logService.log('warn', `Failed to calculate optimal position size, falling back to basic calculation`, positionSizeError, 'TradeManager');

            // Fallback to basic calculation
            const maxBudgetToUse = Math.min(budget.available, budget.available * 0.2);
            tradeAmount = maxBudgetToUse / tradePrice;
            // Round to 6 decimal places for crypto
            tradeAmount = Math.round(tradeAmount * 1000000) / 1000000;
            options.amount = tradeAmount;

            logService.log('info', `Calculated trade amount ${tradeAmount} based on budget ${budget.available} for ${options.symbol}`, null, 'TradeManager');
          }
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
      await this.handleTradeError(tradeId, error, options);
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

  /**
   * Execute a trade with batching support
   * @param options Trade options
   * @returns Promise that resolves to the trade result
   */
  private async executeTradeWithRetry(options: TradeOptions): Promise<any> {
    // Check if circuit breaker is open
    if (this.isCircuitBreakerOpen()) {
      // Record the operation for later retry
      await this.recordFailedOperation(
        new Error('Circuit breaker is open. Trading temporarily disabled.'),
        options
      );
      throw new Error('Circuit breaker is open due to multiple failures. Trading temporarily disabled.');
    }

    // Check if this trade is eligible for batching
    const isBatchable = this.isTradeBatchable(options);

    // If the trade is batchable, use the batching service
    if (isBatchable) {
      try {
        logService.log('info', `Using trade batching for ${options.symbol}`, {
          symbol: options.symbol,
          side: options.side,
          amount: options.amount
        }, 'TradeManager');

        // Add the trade to the batching service
        const batchedTradeId = await tradeBatchingService.addTrade(options);

        // Wait for the trade to be processed
        const result = await tradeBatchingService.waitForTradeResult(batchedTradeId, this.EXECUTION_TIMEOUT);

        // Record success for circuit breaker
        this.recordSuccess();

        // Log success
        logService.log('info', `Batched trade execution successful for ${options.symbol}`,
          { tradeId: batchedTradeId, orderId: result.id }, 'TradeManager');

        return result;
      } catch (batchError) {
        logService.log('warn', `Batched trade execution failed for ${options.symbol}, falling back to direct execution`,
          batchError, 'TradeManager');
        // Fall back to direct execution
      }
    }

    // Direct execution without batching
    let lastError: Error | null = null;
    let backoffTime = this.INITIAL_BACKOFF;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        // Log the attempt
        logService.log('info', `Trade execution attempt ${attempt}/${this.MAX_RETRIES} for ${options.symbol}`,
          { attempt, maxRetries: this.MAX_RETRIES }, 'TradeManager');

        // Execute the trade with timeout
        const result = await this.executeWithTimeout(
          () => exchangeService.createOrder(options),
          this.EXECUTION_TIMEOUT
        );

        // Record success for circuit breaker
        this.recordSuccess();

        // Log success
        logService.log('info', `Trade execution successful for ${options.symbol} on attempt ${attempt}`,
          { orderId: result.id }, 'TradeManager');

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Record failure for circuit breaker with error details
        this.recordFailure(error);

        // Log the error with detailed information
        logService.log('error', `Trade execution failed on attempt ${attempt}/${this.MAX_RETRIES}`,
          {
            error: lastError.message,
            symbol: options.symbol,
            attempt,
            isRetryable: this.isRetryableError(error),
            errorType: this.categorizeError(error),
            circuitBreakerStatus: {
              failures: this.circuitBreaker.failures,
              totalFailures: this.circuitBreaker.totalFailures,
              isOpen: this.circuitBreaker.isOpen,
              isHalfOpen: this.circuitBreaker.isHalfOpen
            }
          },
          'TradeManager');

        // Check if we should retry immediately
        if (this.isRetryableError(error) && attempt < this.MAX_RETRIES && !this.isCircuitBreakerOpen()) {
          // Calculate backoff time with jitter
          const jitter = 1 + (Math.random() * this.BACKOFF_JITTER * 2 - this.BACKOFF_JITTER);
          const actualBackoff = Math.min(backoffTime * jitter, this.MAX_BACKOFF);

          logService.log('info', `Retrying in ${actualBackoff}ms (attempt ${attempt}/${this.MAX_RETRIES})`,
            { backoffTime: actualBackoff }, 'TradeManager');

          // Wait for backoff period
          await new Promise(resolve => setTimeout(resolve, actualBackoff));

          // Increase backoff for next attempt
          backoffTime = Math.min(backoffTime * this.BACKOFF_FACTOR, this.MAX_BACKOFF);

          continue;
        }

        // If circuit breaker opened during retries, throw specific error
        if (this.isCircuitBreakerOpen()) {
          // Record the operation for later retry
          await this.recordFailedOperation(lastError, options);
          throw new Error('Circuit breaker opened during retry attempts. Trading temporarily disabled.');
        }

        break;
      }
    }

    // If we've exhausted all retries, record the operation for later retry
    await this.recordFailedOperation(lastError, options);

    throw new Error(`Trade execution failed after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  /**
   * Determine if a trade is eligible for batching
   * @param options Trade options
   * @returns True if the trade is batchable, false otherwise
   */
  private isTradeBatchable(options: TradeOptions): boolean {
    try {
      // Only batch market orders
      if (options.type && options.type !== 'market') {
        return false;
      }

      // Don't batch orders with stop loss, take profit, or trailing stop
      if (options.stop_loss || options.take_profit || options.trailing_stop) {
        return false;
      }

      // Don't batch orders with specific entry conditions
      if (options.entry_conditions && options.entry_conditions.length > 0) {
        return false;
      }

      // Don't batch orders with specific exit conditions
      if (options.exit_conditions && options.exit_conditions.length > 0) {
        return false;
      }

      // Don't batch orders with specific metadata
      if (options.metadata) {
        return false;
      }

      // Don't batch orders in demo mode
      if (options.demo || options.testnet) {
        return false;
      }

      // Only batch orders with a reasonable amount
      const MIN_BATCHABLE_AMOUNT_USD = 10; // $10 minimum
      const MAX_BATCHABLE_AMOUNT_USD = 1000; // $1000 maximum

      const orderValue = options.amount * (options.entry_price || options.price || 0);
      if (orderValue < MIN_BATCHABLE_AMOUNT_USD || orderValue > MAX_BATCHABLE_AMOUNT_USD) {
        return false;
      }

      // All checks passed, this trade is batchable
      return true;
    } catch (error) {
      logService.log('warn', 'Error determining if trade is batchable', error, 'TradeManager');
      return false; // Default to not batchable on error
    }
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
      const amount = status.amount || 1;
      const tradeValue = amount * entryPrice; // Trade value in USDT
      const profitLoss = priceDiff * amount;

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
          // Create exit order options
          const exitOrderOptions = {
            symbol: status.symbol,
            side: exitSide,
            type: 'market',
            amount: status.amount,
            entry_price: currentPrice,
            strategy_id: status.strategyId || status.strategy_id,
            trade_id: orderId
          };

          // Check if this exit order is eligible for batching
          const isBatchable = this.isTradeBatchable(exitOrderOptions);

          if (isBatchable) {
            // Use batching service for exit order
            logService.log('info', `Using trade batching for exit order ${orderId}`, {
              symbol: status.symbol,
              side: exitSide,
              amount: status.amount
            }, 'TradeManager');

            // Add the exit order to the batching service
            const batchedTradeId = await tradeBatchingService.addTrade(exitOrderOptions);

            // Wait for the exit order to be processed
            await tradeBatchingService.waitForTradeResult(batchedTradeId, this.EXECUTION_TIMEOUT);

            logService.log('info', `Batched exit order execution successful for ${orderId}`,
              { tradeId: batchedTradeId, symbol: status.symbol }, 'TradeManager');
          } else {
            // Real exchange direct execution
            await exchangeService.createOrder(exitOrderOptions);
          }
        }

        // Update order status
        const updatedStatus = {
          ...status,
          status: 'closed',
          exitPrice: currentPrice,
          profit: profitLoss,
          exitReason: reason,
          lastUpdate: Date.now(),
          closedAt: new Date().toISOString(),
          tradeValue: tradeValue // Store the trade value in USDT
        };

        // Remove from active orders
        this.activeOrders.delete(orderId);

        // Release budget for this trade
        const strategyId = status.strategyId || status.strategy_id;
        if (strategyId) {
          try {
            // Use the calculated trade value
            // Release the budget with profit/loss
            tradeService.releaseBudgetFromTrade(strategyId, tradeValue, profitLoss, orderId);
            logService.log('info', `Released budget for trade ${orderId} with profit/loss ${profitLoss}`,
              { strategyId, tradeValue, profitLoss }, 'TradeManager');
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
                trade_value: tradeValue,
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

  // This method is replaced by the more comprehensive version below

  /**
   * Determines if an error is retryable
   * @param error The error to check
   * @returns True if the error is retryable, false otherwise
   */
  private isRetryableError(error: any): boolean {
    // Don't retry if circuit breaker is open
    if (this.isCircuitBreakerOpen()) {
      return false;
    }

    const errorMessage = error?.message?.toLowerCase() || '';

    // Network errors are generally retryable
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('etimedout')
    ) {
      return true;
    }

    // Rate limit errors are retryable
    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('ratelimit') ||
      errorMessage.includes('too many requests') ||
      error?.code === 429
    ) {
      return true;
    }

    // Temporary server errors are retryable
    if (
      errorMessage.includes('server error') ||
      errorMessage.includes('service unavailable') ||
      error?.code === 500 ||
      error?.code === 502 ||
      error?.code === 503 ||
      error?.code === 504
    ) {
      return true;
    }

    // Insufficient funds errors are not retryable
    if (
      errorMessage.includes('insufficient') ||
      errorMessage.includes('not enough') ||
      errorMessage.includes('balance')
    ) {
      return false;
    }

    // Invalid parameter errors are not retryable
    if (
      errorMessage.includes('invalid') ||
      errorMessage.includes('parameter') ||
      errorMessage.includes('argument')
    ) {
      return false;
    }

    // By default, don't retry unknown errors
    return false;
  }

  /**
   * Checks if the circuit breaker is open
   * @returns True if the circuit breaker is open, false otherwise
   */
  private isCircuitBreakerOpen(): boolean {
    const now = Date.now();

    // If the circuit breaker is open, check if it's time to transition to half-open
    if (this.circuitBreaker.isOpen) {
      const timeSinceLastStateChange = now - this.circuitBreaker.lastStateChange;

      // If enough time has passed, transition to half-open state
      if (timeSinceLastStateChange >= this.circuitBreaker.resetTimeout) {
        this.transitionToHalfOpen();
      }

      return true;
    }

    // If the circuit breaker is half-open, allow limited traffic through
    if (this.circuitBreaker.isHalfOpen) {
      // In half-open state, we'll allow one request at a time to test the system
      return false;
    }

    return false;
  }

  /**
   * Records a failure for the circuit breaker
   * @param error The error that occurred
   */
  private recordFailure(error?: any): void {
    const now = Date.now();
    const timeSinceLastFailure = now - this.circuitBreaker.lastFailure;
    const errorType = this.categorizeError(error);

    // If it's been a while since the last failure, reset the counters
    if (timeSinceLastFailure >= this.circuitBreaker.resetTimeout) {
      this.circuitBreaker.failures.network = 0;
      this.circuitBreaker.failures.exchange = 0;
      this.circuitBreaker.failures.validation = 0;
      this.circuitBreaker.failures.unknown = 0;
      this.circuitBreaker.totalFailures = 0;
    }

    // Increment the appropriate failure counter
    this.circuitBreaker.failures[errorType]++;
    this.circuitBreaker.totalFailures++;
    this.circuitBreaker.lastFailure = now;
    this.circuitBreaker.consecutiveSuccesses = 0; // Reset consecutive successes

    // If we're in half-open state, any failure immediately opens the circuit
    if (this.circuitBreaker.isHalfOpen) {
      this.openCircuitBreaker();
      return;
    }

    // Check if we've reached the threshold for this error type
    if (this.circuitBreaker.failures[errorType] >= this.circuitBreaker.thresholds[errorType]) {
      this.openCircuitBreaker();
    }

    // Also check total failures as a fallback
    const avgThreshold = Object.values(this.circuitBreaker.thresholds).reduce((sum, val) => sum + val, 0) / 4;
    if (this.circuitBreaker.totalFailures >= avgThreshold * 2) {
      this.openCircuitBreaker();
    }

    // Record the failed operation for later retry
    this.recordFailedOperation(error);
  }

  /**
   * Records a successful operation for the circuit breaker
   */
  private recordSuccess(): void {
    // If we're in half-open state, track consecutive successes
    if (this.circuitBreaker.isHalfOpen) {
      this.circuitBreaker.consecutiveSuccesses++;

      // If we've had enough consecutive successes, close the circuit
      if (this.circuitBreaker.consecutiveSuccesses >= this.circuitBreaker.requiredSuccesses) {
        this.closeCircuitBreaker();
      }
    }
  }

  /**
   * Opens the circuit breaker
   */
  private openCircuitBreaker(): void {
    const now = Date.now();
    this.circuitBreaker.isOpen = true;
    this.circuitBreaker.isHalfOpen = false;
    this.circuitBreaker.lastStateChange = now;

    // Log that the circuit breaker has opened
    logService.log('warn', 'Circuit breaker opened due to multiple failures',
      {
        failures: this.circuitBreaker.failures,
        thresholds: this.circuitBreaker.thresholds,
        totalFailures: this.circuitBreaker.totalFailures,
        resetTimeout: this.circuitBreaker.resetTimeout
      },
      'TradeManager');

    // Emit circuit breaker event
    this.emit('circuitBreakerOpened', {
      failures: this.circuitBreaker.failures,
      thresholds: this.circuitBreaker.thresholds,
      totalFailures: this.circuitBreaker.totalFailures,
      resetTimeout: this.circuitBreaker.resetTimeout
    });

    eventBus.emit('trade:circuitBreakerOpened', {
      failures: this.circuitBreaker.failures,
      thresholds: this.circuitBreaker.thresholds,
      totalFailures: this.circuitBreaker.totalFailures,
      resetTimeout: this.circuitBreaker.resetTimeout
    });
  }

  /**
   * Transitions the circuit breaker to half-open state
   */
  private transitionToHalfOpen(): void {
    const now = Date.now();
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.isHalfOpen = true;
    this.circuitBreaker.lastStateChange = now;
    this.circuitBreaker.consecutiveSuccesses = 0;

    logService.log('info', 'Circuit breaker transitioning to half-open state', null, 'TradeManager');

    // Emit circuit breaker event
    this.emit('circuitBreakerHalfOpen', {});
    eventBus.emit('trade:circuitBreakerHalfOpen', {});
  }

  /**
   * Closes the circuit breaker
   */
  private closeCircuitBreaker(): void {
    const now = Date.now();
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.isHalfOpen = false;
    this.circuitBreaker.lastStateChange = now;
    this.circuitBreaker.failures.network = 0;
    this.circuitBreaker.failures.exchange = 0;
    this.circuitBreaker.failures.validation = 0;
    this.circuitBreaker.failures.unknown = 0;
    this.circuitBreaker.totalFailures = 0;
    this.circuitBreaker.consecutiveSuccesses = 0;

    logService.log('info', 'Circuit breaker closed after successful operations', null, 'TradeManager');

    // Emit circuit breaker event
    this.emit('circuitBreakerClosed', {});
    eventBus.emit('trade:circuitBreakerClosed', {});
  }

  /**
   * Resets the circuit breaker
   */
  private resetCircuitBreaker(): void {
    // Only log if the circuit breaker was previously open or half-open
    if (this.circuitBreaker.isOpen || this.circuitBreaker.isHalfOpen) {
      logService.log('info', 'Circuit breaker manually reset', null, 'TradeManager');

      // Emit circuit breaker event
      this.emit('circuitBreakerReset', {});
      eventBus.emit('trade:circuitBreakerReset', {});
    }

    const now = Date.now();
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.isHalfOpen = false;
    this.circuitBreaker.lastStateChange = now;
    this.circuitBreaker.failures.network = 0;
    this.circuitBreaker.failures.exchange = 0;
    this.circuitBreaker.failures.validation = 0;
    this.circuitBreaker.failures.unknown = 0;
    this.circuitBreaker.totalFailures = 0;
    this.circuitBreaker.consecutiveSuccesses = 0;
  }

  /**
   * Categorizes an error into one of the circuit breaker's error types
   * @param error The error to categorize
   * @returns The error type
   */
  private categorizeError(error: any): 'network' | 'exchange' | 'validation' | 'unknown' {
    if (!error) return 'unknown';

    const errorMessage = error.message?.toLowerCase() || '';

    // Network errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('etimedout')
    ) {
      return 'network';
    }

    // Exchange API errors
    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('ratelimit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('server error') ||
      errorMessage.includes('service unavailable') ||
      error?.code === 429 ||
      error?.code === 500 ||
      error?.code === 502 ||
      error?.code === 503 ||
      error?.code === 504
    ) {
      return 'exchange';
    }

    // Validation errors
    if (
      errorMessage.includes('invalid') ||
      errorMessage.includes('parameter') ||
      errorMessage.includes('argument') ||
      errorMessage.includes('insufficient') ||
      errorMessage.includes('not enough') ||
      errorMessage.includes('balance') ||
      errorMessage.includes('validation')
    ) {
      return 'validation';
    }

    // Default to unknown
    return 'unknown';
  }

  /**
   * Records a failed operation for later retry
   * @param error The error that occurred
   * @param options The trade options
   */
  private async recordFailedOperation(error: any, options?: TradeOptions): Promise<void> {
    try {
      // Import retry service dynamically to avoid circular dependencies
      const { retryService, OperationType } = await import('./retry-service');

      if (!options) return;

      // Determine operation type
      let operationType: OperationType = 'trade_execution';

      // Create operation data
      const operationData = { ...options };

      // Record the failed operation
      await retryService.recordFailedOperation({
        operation_type: operationType,
        operation_data: operationData,
        error_message: error?.message || 'Unknown error',
        error_details: error,
        strategy_id: options.strategy_id || options.strategyId,
        trade_id: options.trade_id
      });

      logService.log('info', 'Recorded failed operation for later retry', {
        operationType,
        strategyId: options.strategy_id || options.strategyId,
        symbol: options.symbol
      }, 'TradeManager');
    } catch (recordError) {
      logService.log('error', 'Failed to record failed operation', recordError, 'TradeManager');
    }
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

  private async handleTradeError(tradeId: string, error: any, options?: TradeOptions): Promise<void> {
    logService.log('error', `Trade execution failed for ${tradeId}`,
      error, 'TradeManager');

    // Emit trade error event
    this.emit('tradeError', { tradeId, error });
    eventBus.emit('trade:error', { tradeId, error });

    // Record the failed operation for later retry if we have options
    if (options) {
      try {
        await this.recordFailedOperation(error, {
          ...options,
          trade_id: tradeId
        });
      } catch (recordError) {
        logService.log('error', `Failed to record failed operation for trade ${tradeId}`, recordError, 'TradeManager');
      }
    }
  }

  /**
   * Calculate the optimal position size using the enhanced position sizing service
   * @param options Position sizing options
   * @returns Promise that resolves to the optimal position size
   */
  private async calculateOptimalPositionSize(options: {
    strategyId: string;
    symbol: string;
    currentPrice: number;
    availableBudget: number;
    side: string;
    confidence?: number;
    stopLossPrice?: number;
    riskLevel?: string;
  }): Promise<number> {
    try {
      // Get volatility data if available
      let volatility: number | undefined;
      try {
        // This could be fetched from a market data service or calculated
        // For now, we'll use a placeholder implementation
        volatility = await this.estimateVolatility(options.symbol);
      } catch (volatilityError) {
        logService.log('debug', `Could not estimate volatility for ${options.symbol}`, volatilityError, 'TradeManager');
        // Continue without volatility data
      }

      // Convert options to the format expected by the enhanced position sizing service
      const positionSizingOptions = {
        strategyId: options.strategyId,
        symbol: options.symbol,
        availableBudget: options.availableBudget,
        currentPrice: options.currentPrice,
        riskLevel: options.riskLevel as any || 'Medium',
        marketType: 'spot', // Default to spot market
        confidence: options.confidence || 0.7,
        volatility,
        stopLossPrice: options.stopLossPrice
      };

      // Use the enhanced position sizing service to calculate the optimal position size
      const positionSize = await enhancedPositionSizing.calculateOptimalPositionSize(positionSizingOptions);

      // Log the calculation details
      logService.log('debug', 'Calculated optimal position size', {
        strategyId: options.strategyId,
        symbol: options.symbol,
        currentPrice: options.currentPrice,
        availableBudget: options.availableBudget,
        positionSize,
        positionValue: positionSize * options.currentPrice
      }, 'TradeManager');

      return positionSize;
    } catch (error) {
      logService.log('error', 'Failed to calculate optimal position size', error, 'TradeManager');
      // Fall back to a simple calculation
      const riskMultiplier = 0.1; // 10% of available budget
      return (options.availableBudget * riskMultiplier) / options.currentPrice;
    }
  }

  /**
   * Estimate volatility for a symbol
   * @param symbol Trading pair symbol
   * @returns Promise that resolves to the estimated volatility (as a percentage)
   */
  private async estimateVolatility(symbol: string): Promise<number> {
    try {
      // In a real implementation, this would fetch historical price data
      // and calculate volatility using standard deviation of returns
      // For now, we'll use a simple placeholder implementation

      // Get some recent price data
      const prices = await this.getRecentPrices(symbol);

      if (prices.length < 2) {
        // Not enough data to calculate volatility
        return 20; // Default to 20% volatility
      }

      // Calculate daily returns
      const returns: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
        returns.push(dailyReturn);
      }

      // Calculate standard deviation of returns
      const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
      const squaredDiffs = returns.map(value => Math.pow(value - mean, 2));
      const variance = squaredDiffs.reduce((sum, value) => sum + value, 0) / squaredDiffs.length;
      const stdDev = Math.sqrt(variance);

      // Annualize the volatility (assuming daily returns)
      const annualizedVolatility = stdDev * Math.sqrt(365) * 100; // Convert to percentage

      return annualizedVolatility;
    } catch (error) {
      logService.log('error', 'Failed to estimate volatility', error, 'TradeManager');
      return 20; // Default to 20% volatility
    }
  }

  /**
   * Get recent prices for a symbol
   * @param symbol Trading pair symbol
   * @returns Promise that resolves to an array of prices
   */
  private async getRecentPrices(symbol: string): Promise<number[]> {
    try {
      // In a real implementation, this would fetch historical price data
      // For now, we'll use a simple placeholder implementation
      const currentPrice = await exchangeService.fetchMarketPrice(symbol);

      // Generate some fake historical prices based on the current price
      const prices: number[] = [];
      const numDays = 30;
      const basePrice = currentPrice.price;

      for (let i = 0; i < numDays; i++) {
        // Add some random variation to simulate price changes
        const randomFactor = 0.98 + (Math.random() * 0.04); // +/- 2%
        prices.push(basePrice * randomFactor);
      }

      return prices;
    } catch (error) {
      logService.log('error', 'Failed to get recent prices', error, 'TradeManager');
      return [];
    }
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
