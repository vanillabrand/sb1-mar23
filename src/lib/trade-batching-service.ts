import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { eventBus } from './event-bus';
import { v4 as uuidv4 } from 'uuid';

export interface BatchedTradeOptions {
  symbol: string;
  side: string;
  type?: string;
  amount: number;
  entry_price?: number;
  price?: number;
  stop_loss?: number;
  take_profit?: number;
  trailing_stop?: number;
  strategy_id?: string;
  strategyId?: string;
  trade_id?: string;
  tradeId?: string;
  confidence?: number;
  risk_level?: string;
  riskLevel?: string;
  metadata?: any;
}

export interface BatchedTrade {
  id: string;
  options: BatchedTradeOptions;
  timestamp: number;
  processed: boolean;
  result?: any;
  error?: any;
}

export interface TradeBatch {
  id: string;
  symbol: string;
  side: string;
  type: string;
  trades: BatchedTrade[];
  totalAmount: number;
  timestamp: number;
  processed: boolean;
  result?: any;
  error?: any;
}

/**
 * Service for batching similar trades to reduce API calls and fees
 */
class TradeBatchingService extends EventEmitter {
  private static instance: TradeBatchingService;
  private pendingTrades: Map<string, BatchedTrade> = new Map();
  private batches: Map<string, TradeBatch> = new Map();
  private batchingInterval: NodeJS.Timeout | null = null;
  private processingBatch = false;
  
  // Configuration
  private readonly BATCH_INTERVAL_MS = 1000; // 1 second batching window
  private readonly MAX_BATCH_SIZE = 10; // Maximum number of trades in a batch
  private readonly MIN_BATCH_SIZE = 2; // Minimum number of trades to form a batch
  private readonly MAX_BATCH_AGE_MS = 5000; // Maximum age of a batch before processing (5 seconds)
  private readonly BATCH_ENABLED = true; // Whether batching is enabled

  private constructor() {
    super();
    this.startBatchProcessor();
  }

  static getInstance(): TradeBatchingService {
    if (!TradeBatchingService.instance) {
      TradeBatchingService.instance = new TradeBatchingService();
    }
    return TradeBatchingService.instance;
  }

  /**
   * Add a trade to the batching queue
   * @param options Trade options
   * @returns Promise that resolves to the trade ID
   */
  async addTrade(options: BatchedTradeOptions): Promise<string> {
    try {
      // Generate a unique ID for this trade
      const tradeId = options.trade_id || options.tradeId || uuidv4();
      
      // Create a batched trade object
      const batchedTrade: BatchedTrade = {
        id: tradeId,
        options,
        timestamp: Date.now(),
        processed: false
      };
      
      // Add to pending trades
      this.pendingTrades.set(tradeId, batchedTrade);
      
      logService.log('debug', `Added trade ${tradeId} to batching queue`, {
        symbol: options.symbol,
        side: options.side,
        amount: options.amount
      }, 'TradeBatchingService');
      
      // Emit event
      this.emit('tradeAdded', { tradeId, options });
      eventBus.emit('tradeBatch:tradeAdded', { tradeId, options });
      
      return tradeId;
    } catch (error) {
      logService.log('error', 'Failed to add trade to batching queue', error, 'TradeBatchingService');
      throw error;
    }
  }

  /**
   * Get the result of a batched trade
   * @param tradeId Trade ID
   * @returns Promise that resolves to the trade result or null if not found
   */
  async getTradeResult(tradeId: string): Promise<any | null> {
    try {
      // Check if the trade is still pending
      const pendingTrade = this.pendingTrades.get(tradeId);
      if (pendingTrade) {
        // If the trade is still pending and not processed, return null
        if (!pendingTrade.processed) {
          return null;
        }
        
        // If the trade has an error, throw it
        if (pendingTrade.error) {
          throw pendingTrade.error;
        }
        
        // Return the result
        return pendingTrade.result;
      }
      
      // Trade not found
      return null;
    } catch (error) {
      logService.log('error', `Failed to get trade result for ${tradeId}`, error, 'TradeBatchingService');
      throw error;
    }
  }

  /**
   * Wait for a trade to be processed
   * @param tradeId Trade ID
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise that resolves to the trade result
   */
  async waitForTradeResult(tradeId: string, timeoutMs: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkResult = async () => {
        try {
          // Check if the trade has been processed
          const result = await this.getTradeResult(tradeId);
          
          if (result !== null) {
            // Trade has been processed
            resolve(result);
            return;
          }
          
          // Check if we've exceeded the timeout
          if (Date.now() - startTime > timeoutMs) {
            reject(new Error(`Timeout waiting for trade ${tradeId} to be processed`));
            return;
          }
          
          // Check again in 100ms
          setTimeout(checkResult, 100);
        } catch (error) {
          reject(error);
        }
      };
      
      // Start checking
      checkResult();
    });
  }

  /**
   * Cancel a pending trade
   * @param tradeId Trade ID
   * @returns True if the trade was cancelled, false if it was not found or already processed
   */
  cancelTrade(tradeId: string): boolean {
    try {
      // Check if the trade is still pending
      const pendingTrade = this.pendingTrades.get(tradeId);
      if (pendingTrade && !pendingTrade.processed) {
        // Remove from pending trades
        this.pendingTrades.delete(tradeId);
        
        logService.log('info', `Cancelled trade ${tradeId}`, null, 'TradeBatchingService');
        
        // Emit event
        this.emit('tradeCancelled', { tradeId });
        eventBus.emit('tradeBatch:tradeCancelled', { tradeId });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logService.log('error', `Failed to cancel trade ${tradeId}`, error, 'TradeBatchingService');
      return false;
    }
  }

  /**
   * Get the current batching status
   * @returns Batching status object
   */
  getBatchingStatus(): any {
    return {
      enabled: this.BATCH_ENABLED,
      pendingTrades: this.pendingTrades.size,
      activeBatches: this.batches.size,
      processingBatch: this.processingBatch,
      batchInterval: this.BATCH_INTERVAL_MS,
      maxBatchSize: this.MAX_BATCH_SIZE,
      minBatchSize: this.MIN_BATCH_SIZE,
      maxBatchAge: this.MAX_BATCH_AGE_MS
    };
  }

  /**
   * Start the batch processor
   */
  private startBatchProcessor(): void {
    if (this.batchingInterval) {
      clearInterval(this.batchingInterval);
    }
    
    this.batchingInterval = setInterval(() => {
      this.processBatches().catch(error => {
        logService.log('error', 'Error processing batches', error, 'TradeBatchingService');
      });
    }, this.BATCH_INTERVAL_MS);
    
    logService.log('info', `Started trade batch processor with interval ${this.BATCH_INTERVAL_MS}ms`, null, 'TradeBatchingService');
  }

  /**
   * Process pending trades and create batches
   */
  private async processBatches(): Promise<void> {
    if (!this.BATCH_ENABLED || this.processingBatch || this.pendingTrades.size === 0) {
      return;
    }
    
    try {
      this.processingBatch = true;
      
      // Group trades by symbol, side, and type
      const tradeGroups = this.groupTrades();
      
      // Create batches for each group
      for (const [groupKey, trades] of tradeGroups.entries()) {
        // Only create a batch if we have enough trades or the oldest trade is too old
        const oldestTradeAge = Date.now() - Math.min(...trades.map(trade => trade.timestamp));
        
        if (trades.length >= this.MIN_BATCH_SIZE || (trades.length > 0 && oldestTradeAge >= this.MAX_BATCH_AGE_MS)) {
          await this.createAndProcessBatch(groupKey, trades);
        }
      }
    } catch (error) {
      logService.log('error', 'Failed to process batches', error, 'TradeBatchingService');
    } finally {
      this.processingBatch = false;
    }
  }

  /**
   * Group trades by symbol, side, and type
   * @returns Map of group keys to arrays of trades
   */
  private groupTrades(): Map<string, BatchedTrade[]> {
    const groups = new Map<string, BatchedTrade[]>();
    
    // Group trades by symbol, side, and type
    for (const trade of this.pendingTrades.values()) {
      // Skip already processed trades
      if (trade.processed) {
        continue;
      }
      
      const { symbol, side, type = 'market' } = trade.options;
      const groupKey = `${symbol}:${side}:${type}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      
      groups.get(groupKey)!.push(trade);
      
      // Limit the number of trades in a batch
      if (groups.get(groupKey)!.length >= this.MAX_BATCH_SIZE) {
        break;
      }
    }
    
    return groups;
  }

  /**
   * Create and process a batch of trades
   * @param groupKey Group key
   * @param trades Array of trades
   */
  private async createAndProcessBatch(groupKey: string, trades: BatchedTrade[]): Promise<void> {
    try {
      // Extract common properties
      const [symbol, side, type] = groupKey.split(':');
      
      // Calculate total amount
      const totalAmount = trades.reduce((sum, trade) => sum + trade.options.amount, 0);
      
      // Create batch
      const batchId = uuidv4();
      const batch: TradeBatch = {
        id: batchId,
        symbol,
        side,
        type,
        trades,
        totalAmount,
        timestamp: Date.now(),
        processed: false
      };
      
      // Add to batches
      this.batches.set(batchId, batch);
      
      logService.log('info', `Created batch ${batchId} with ${trades.length} trades for ${symbol}`, {
        symbol,
        side,
        type,
        totalAmount,
        tradeCount: trades.length
      }, 'TradeBatchingService');
      
      // Mark trades as being processed
      for (const trade of trades) {
        // Remove from pending trades
        this.pendingTrades.delete(trade.id);
      }
      
      // Emit batch created event
      this.emit('batchCreated', { batchId, batch });
      eventBus.emit('tradeBatch:batchCreated', { batchId, batch });
      
      // Process the batch
      await this.executeBatch(batch);
    } catch (error) {
      logService.log('error', `Failed to create and process batch for ${groupKey}`, error, 'TradeBatchingService');
      
      // Return trades to pending queue
      for (const trade of trades) {
        if (!trade.processed) {
          this.pendingTrades.set(trade.id, trade);
        }
      }
    }
  }

  /**
   * Execute a batch of trades
   * @param batch Trade batch
   */
  private async executeBatch(batch: TradeBatch): Promise<void> {
    try {
      // Import exchange service dynamically to avoid circular dependencies
      const { exchangeService } = await import('./exchange-service');
      
      logService.log('info', `Executing batch ${batch.id} with ${batch.trades.length} trades for ${batch.symbol}`, {
        symbol: batch.symbol,
        side: batch.side,
        type: batch.type,
        totalAmount: batch.totalAmount
      }, 'TradeBatchingService');
      
      // Create a single order for the entire batch
      const batchOrder = await exchangeService.createOrder({
        symbol: batch.symbol,
        side: batch.side,
        type: batch.type,
        amount: batch.totalAmount
      });
      
      // Update batch with result
      batch.result = batchOrder;
      batch.processed = true;
      
      logService.log('info', `Successfully executed batch ${batch.id}`, {
        orderId: batchOrder.id,
        symbol: batch.symbol,
        amount: batch.totalAmount
      }, 'TradeBatchingService');
      
      // Process individual trades
      await this.processBatchResults(batch);
      
      // Emit batch executed event
      this.emit('batchExecuted', { batchId: batch.id, result: batchOrder });
      eventBus.emit('tradeBatch:batchExecuted', { batchId: batch.id, result: batchOrder });
    } catch (error) {
      logService.log('error', `Failed to execute batch ${batch.id}`, error, 'TradeBatchingService');
      
      // Update batch with error
      batch.error = error;
      batch.processed = true;
      
      // Process individual trades with error
      await this.processBatchError(batch, error);
      
      // Emit batch error event
      this.emit('batchError', { batchId: batch.id, error });
      eventBus.emit('tradeBatch:batchError', { batchId: batch.id, error });
    } finally {
      // Remove batch after processing
      setTimeout(() => {
        this.batches.delete(batch.id);
      }, 60000); // Keep batch for 1 minute for reference
    }
  }

  /**
   * Process batch results for individual trades
   * @param batch Trade batch
   */
  private async processBatchResults(batch: TradeBatch): Promise<void> {
    try {
      // Process each trade in the batch
      for (const trade of batch.trades) {
        try {
          // Calculate the proportion of the batch order for this trade
          const proportion = trade.options.amount / batch.totalAmount;
          
          // Create a result for this trade based on the batch result
          const tradeResult = this.createTradeResult(trade, batch.result, proportion);
          
          // Update trade with result
          trade.result = tradeResult;
          trade.processed = true;
          
          logService.log('debug', `Processed trade ${trade.id} from batch ${batch.id}`, {
            symbol: batch.symbol,
            amount: trade.options.amount,
            proportion
          }, 'TradeBatchingService');
          
          // Emit trade executed event
          this.emit('tradeExecuted', { tradeId: trade.id, result: tradeResult });
          eventBus.emit('tradeBatch:tradeExecuted', { tradeId: trade.id, result: tradeResult });
        } catch (tradeError) {
          logService.log('error', `Failed to process trade ${trade.id} from batch ${batch.id}`, tradeError, 'TradeBatchingService');
          
          // Update trade with error
          trade.error = tradeError;
          trade.processed = true;
          
          // Emit trade error event
          this.emit('tradeError', { tradeId: trade.id, error: tradeError });
          eventBus.emit('tradeBatch:tradeError', { tradeId: trade.id, error: tradeError });
        }
      }
    } catch (error) {
      logService.log('error', `Failed to process batch results for batch ${batch.id}`, error, 'TradeBatchingService');
    }
  }

  /**
   * Process batch error for individual trades
   * @param batch Trade batch
   * @param error Batch error
   */
  private async processBatchError(batch: TradeBatch, error: any): Promise<void> {
    try {
      // Process each trade in the batch
      for (const trade of batch.trades) {
        // Update trade with error
        trade.error = error;
        trade.processed = true;
        
        // Emit trade error event
        this.emit('tradeError', { tradeId: trade.id, error });
        eventBus.emit('tradeBatch:tradeError', { tradeId: trade.id, error });
      }
    } catch (processError) {
      logService.log('error', `Failed to process batch error for batch ${batch.id}`, processError, 'TradeBatchingService');
    }
  }

  /**
   * Create a trade result from a batch result
   * @param trade Batched trade
   * @param batchResult Batch result
   * @param proportion Proportion of the batch
   * @returns Trade result
   */
  private createTradeResult(trade: BatchedTrade, batchResult: any, proportion: number): any {
    // Create a unique ID for this trade result
    const tradeResultId = `${batchResult.id}-${trade.id}`;
    
    // Calculate the filled amount for this trade
    const filledAmount = (batchResult.filled || 0) * proportion;
    
    // Calculate the cost for this trade
    const tradeCost = (batchResult.cost || 0) * proportion;
    
    // Calculate the fee for this trade
    const tradeFee = batchResult.fee ? {
      ...batchResult.fee,
      cost: (batchResult.fee.cost || 0) * proportion
    } : undefined;
    
    // Create a trade result based on the batch result
    return {
      id: tradeResultId,
      clientOrderId: `client-${tradeResultId}`,
      timestamp: batchResult.timestamp,
      datetime: batchResult.datetime,
      symbol: batchResult.symbol,
      type: batchResult.type,
      side: batchResult.side,
      price: batchResult.price,
      amount: trade.options.amount,
      cost: tradeCost,
      filled: filledAmount,
      remaining: trade.options.amount - filledAmount,
      status: batchResult.status,
      fee: tradeFee,
      trades: [],
      stopLoss: trade.options.stop_loss,
      takeProfit: trade.options.take_profit,
      trailingStop: trade.options.trailing_stop,
      batchId: batchResult.id,
      proportion,
      originalTradeId: trade.id,
      strategyId: trade.options.strategy_id || trade.options.strategyId
    };
  }
}

export const tradeBatchingService = TradeBatchingService.getInstance();
