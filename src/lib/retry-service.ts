import { EventEmitter } from './event-emitter';
import { supabase } from './supabase';
import { logService } from './log-service';
import { eventBus } from './event-bus';
import { v4 as uuidv4 } from 'uuid';

export type OperationType = 'trade_creation' | 'trade_execution' | 'order_cancellation' | 'strategy_activation' | 'strategy_deactivation' | 'market_data_fetch' | 'other';

export type FailedOperationStatus = 'pending' | 'in_progress' | 'succeeded' | 'failed' | 'cancelled';

export interface FailedOperation {
  id?: string;
  operation_type: OperationType;
  operation_data: any;
  error_message?: string;
  error_details?: any;
  retry_count?: number;
  max_retries?: number;
  next_retry_at?: string;
  status?: FailedOperationStatus;
  created_at?: string;
  updated_at?: string;
  strategy_id?: string;
  trade_id?: string;
  priority?: number;
}

export interface RetryOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  backoffFactor?: number;
  jitterFactor?: number;
  priority?: number;
}

class RetryService extends EventEmitter {
  private static instance: RetryService;
  private retryInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly DEFAULT_RETRY_OPTIONS: RetryOptions = {
    maxRetries: 5,
    initialBackoffMs: 1000, // 1 second
    maxBackoffMs: 3600000, // 1 hour
    backoffFactor: 2, // Exponential backoff
    jitterFactor: 0.2, // 20% jitter
    priority: 1 // Normal priority
  };
  private readonly RETRY_INTERVAL_MS = 30000; // Check for retries every 30 seconds
  private readonly MAX_CONCURRENT_RETRIES = 5; // Process up to 5 retries at once

  private constructor() {
    super();
    this.startRetryProcessor();
  }

  static getInstance(): RetryService {
    if (!RetryService.instance) {
      RetryService.instance = new RetryService();
    }
    return RetryService.instance;
  }

  /**
   * Record a failed operation for later retry
   * @param operation The failed operation details
   * @param options Retry options
   * @returns The ID of the recorded failed operation
   */
  async recordFailedOperation(operation: FailedOperation, options?: RetryOptions): Promise<string> {
    try {
      const mergedOptions = { ...this.DEFAULT_RETRY_OPTIONS, ...options };
      const nextRetryAt = this.calculateNextRetryTime(0, mergedOptions);

      const operationId = operation.id || uuidv4();
      
      const { data, error } = await supabase
        .from('failed_operations')
        .insert({
          id: operationId,
          operation_type: operation.operation_type,
          operation_data: operation.operation_data,
          error_message: operation.error_message || 'Unknown error',
          error_details: operation.error_details || {},
          retry_count: 0,
          max_retries: mergedOptions.maxRetries,
          next_retry_at: nextRetryAt,
          status: 'pending',
          strategy_id: operation.strategy_id,
          trade_id: operation.trade_id,
          priority: mergedOptions.priority
        })
        .select()
        .single();

      if (error) {
        logService.log('error', 'Failed to record failed operation', error, 'RetryService');
        throw error;
      }

      logService.log('info', `Recorded failed operation ${operationId} for retry`, {
        operationType: operation.operation_type,
        nextRetryAt,
        maxRetries: mergedOptions.maxRetries
      }, 'RetryService');

      // Emit event
      this.emit('operationRecorded', { operationId, operation });
      eventBus.emit('retry:operationRecorded', { operationId, operation });

      return operationId;
    } catch (error) {
      logService.log('error', 'Failed to record failed operation', error, 'RetryService');
      throw error;
    }
  }

  /**
   * Manually retry a specific failed operation
   * @param operationId The ID of the failed operation to retry
   * @returns True if the retry was successful, false otherwise
   */
  async retryOperation(operationId: string): Promise<boolean> {
    try {
      // Get the operation details
      const { data: operation, error: fetchError } = await supabase
        .from('failed_operations')
        .select('*')
        .eq('id', operationId)
        .single();

      if (fetchError || !operation) {
        logService.log('error', `Failed to fetch operation ${operationId}`, fetchError, 'RetryService');
        return false;
      }

      // Update status to in_progress
      const { error: updateError } = await supabase
        .from('failed_operations')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', operationId);

      if (updateError) {
        logService.log('error', `Failed to update operation ${operationId} status`, updateError, 'RetryService');
        return false;
      }

      // Process the retry
      const success = await this.processRetry(operation);

      // Update the operation status based on the result
      const newStatus: FailedOperationStatus = success ? 'succeeded' : 'failed';
      const retryCount = operation.retry_count + 1;
      const maxRetries = operation.max_retries;
      
      // Calculate next retry time if needed
      let nextRetryAt = null;
      if (!success && retryCount < maxRetries) {
        nextRetryAt = this.calculateNextRetryTime(retryCount, {
          initialBackoffMs: 1000,
          maxBackoffMs: 3600000,
          backoffFactor: 2,
          jitterFactor: 0.2
        });
      }

      // Update the operation in the database
      const { error: finalUpdateError } = await supabase
        .from('failed_operations')
        .update({
          status: newStatus,
          retry_count: retryCount,
          next_retry_at: nextRetryAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', operationId);

      if (finalUpdateError) {
        logService.log('error', `Failed to update operation ${operationId} after retry`, finalUpdateError, 'RetryService');
      }

      // Emit events
      if (success) {
        this.emit('operationSucceeded', { operationId, operation });
        eventBus.emit('retry:operationSucceeded', { operationId, operation });
      } else {
        this.emit('operationFailed', { operationId, operation, retryCount, maxRetries });
        eventBus.emit('retry:operationFailed', { operationId, operation, retryCount, maxRetries });
      }

      return success;
    } catch (error) {
      logService.log('error', `Error retrying operation ${operationId}`, error, 'RetryService');
      return false;
    }
  }

  /**
   * Cancel a pending retry operation
   * @param operationId The ID of the operation to cancel
   * @returns True if the operation was cancelled, false otherwise
   */
  async cancelRetry(operationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('failed_operations')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', operationId)
        .eq('status', 'pending');

      if (error) {
        logService.log('error', `Failed to cancel operation ${operationId}`, error, 'RetryService');
        return false;
      }

      logService.log('info', `Cancelled retry operation ${operationId}`, null, 'RetryService');
      
      // Emit event
      this.emit('operationCancelled', { operationId });
      eventBus.emit('retry:operationCancelled', { operationId });
      
      return true;
    } catch (error) {
      logService.log('error', `Error cancelling operation ${operationId}`, error, 'RetryService');
      return false;
    }
  }

  /**
   * Get all pending retry operations
   * @param limit Maximum number of operations to return
   * @returns Array of pending retry operations
   */
  async getPendingRetries(limit: number = 100): Promise<FailedOperation[]> {
    try {
      const { data, error } = await supabase
        .from('failed_operations')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('next_retry_at', { ascending: true })
        .limit(limit);

      if (error) {
        logService.log('error', 'Failed to fetch pending retries', error, 'RetryService');
        return [];
      }

      return data || [];
    } catch (error) {
      logService.log('error', 'Error fetching pending retries', error, 'RetryService');
      return [];
    }
  }

  /**
   * Get operations for a specific strategy
   * @param strategyId The strategy ID
   * @param status Optional status filter
   * @returns Array of operations for the strategy
   */
  async getOperationsForStrategy(strategyId: string, status?: FailedOperationStatus): Promise<FailedOperation[]> {
    try {
      let query = supabase
        .from('failed_operations')
        .select('*')
        .eq('strategy_id', strategyId);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        logService.log('error', `Failed to fetch operations for strategy ${strategyId}`, error, 'RetryService');
        return [];
      }

      return data || [];
    } catch (error) {
      logService.log('error', `Error fetching operations for strategy ${strategyId}`, error, 'RetryService');
      return [];
    }
  }

  /**
   * Start the background retry processor
   */
  private startRetryProcessor(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }

    this.retryInterval = setInterval(() => {
      this.processRetries().catch(error => {
        logService.log('error', 'Error processing retries', error, 'RetryService');
      });
    }, this.RETRY_INTERVAL_MS);

    logService.log('info', `Started retry processor with interval ${this.RETRY_INTERVAL_MS}ms`, null, 'RetryService');
  }

  /**
   * Process pending retries
   */
  private async processRetries(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get operations that are due for retry
      const { data: operations, error } = await supabase
        .from('failed_operations')
        .select('*')
        .eq('status', 'pending')
        .lte('next_retry_at', new Date().toISOString())
        .order('priority', { ascending: false })
        .order('next_retry_at', { ascending: true })
        .limit(this.MAX_CONCURRENT_RETRIES);

      if (error) {
        logService.log('error', 'Failed to fetch operations for retry', error, 'RetryService');
        return;
      }

      if (!operations || operations.length === 0) {
        return;
      }

      logService.log('info', `Processing ${operations.length} operations for retry`, null, 'RetryService');

      // Process each operation
      const retryPromises = operations.map(operation => this.retryOperation(operation.id));
      await Promise.allSettled(retryPromises);

    } catch (error) {
      logService.log('error', 'Error in retry processor', error, 'RetryService');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single retry operation
   * @param operation The operation to retry
   * @returns True if the retry was successful, false otherwise
   */
  private async processRetry(operation: FailedOperation): Promise<boolean> {
    try {
      logService.log('info', `Processing retry for operation ${operation.id}`, {
        operationType: operation.operation_type,
        retryCount: operation.retry_count,
        maxRetries: operation.max_retries
      }, 'RetryService');

      // Import necessary services dynamically to avoid circular dependencies
      let success = false;

      switch (operation.operation_type) {
        case 'trade_creation':
          success = await this.retryTradeCreation(operation);
          break;
        case 'trade_execution':
          success = await this.retryTradeExecution(operation);
          break;
        case 'order_cancellation':
          success = await this.retryOrderCancellation(operation);
          break;
        case 'strategy_activation':
          success = await this.retryStrategyActivation(operation);
          break;
        case 'strategy_deactivation':
          success = await this.retryStrategyDeactivation(operation);
          break;
        case 'market_data_fetch':
          success = await this.retryMarketDataFetch(operation);
          break;
        default:
          logService.log('warn', `Unknown operation type: ${operation.operation_type}`, null, 'RetryService');
          success = false;
      }

      return success;
    } catch (error) {
      logService.log('error', `Error processing retry for operation ${operation.id}`, error, 'RetryService');
      return false;
    }
  }

  /**
   * Retry a trade creation operation
   * @param operation The operation to retry
   * @returns True if the retry was successful, false otherwise
   */
  private async retryTradeCreation(operation: FailedOperation): Promise<boolean> {
    try {
      const { tradeManager } = await import('./trade-manager');
      const { tradeService } = await import('./trade-service');
      
      const tradeOptions = operation.operation_data;
      
      // Execute the trade
      const result = await tradeManager.executeTrade(tradeOptions);
      
      if (result && result.id) {
        logService.log('info', `Successfully retried trade creation: ${result.id}`, { operation }, 'RetryService');
        return true;
      }
      
      return false;
    } catch (error) {
      logService.log('error', 'Failed to retry trade creation', error, 'RetryService');
      return false;
    }
  }

  /**
   * Retry a trade execution operation
   * @param operation The operation to retry
   * @returns True if the retry was successful, false otherwise
   */
  private async retryTradeExecution(operation: FailedOperation): Promise<boolean> {
    try {
      const { exchangeService } = await import('./exchange-service');
      
      const orderOptions = operation.operation_data;
      
      // Create the order on the exchange
      const result = await exchangeService.createOrder(orderOptions);
      
      if (result && result.id) {
        logService.log('info', `Successfully retried trade execution: ${result.id}`, { operation }, 'RetryService');
        return true;
      }
      
      return false;
    } catch (error) {
      logService.log('error', 'Failed to retry trade execution', error, 'RetryService');
      return false;
    }
  }

  /**
   * Retry an order cancellation operation
   * @param operation The operation to retry
   * @returns True if the retry was successful, false otherwise
   */
  private async retryOrderCancellation(operation: FailedOperation): Promise<boolean> {
    try {
      const { exchangeService } = await import('./exchange-service');
      const { tradeManager } = await import('./trade-manager');
      
      const { orderId } = operation.operation_data;
      
      // Try to cancel the order
      if (operation.operation_data.closePosition) {
        // This is a position close operation
        await tradeManager.closePosition(orderId);
      } else {
        // This is a simple order cancellation
        await exchangeService.cancelOrder(orderId);
      }
      
      logService.log('info', `Successfully retried order cancellation: ${orderId}`, { operation }, 'RetryService');
      return true;
    } catch (error) {
      logService.log('error', 'Failed to retry order cancellation', error, 'RetryService');
      return false;
    }
  }

  /**
   * Retry a strategy activation operation
   * @param operation The operation to retry
   * @returns True if the retry was successful, false otherwise
   */
  private async retryStrategyActivation(operation: FailedOperation): Promise<boolean> {
    try {
      const { strategyService } = await import('./strategy-service');
      
      const { strategyId } = operation.operation_data;
      
      // Activate the strategy
      const result = await strategyService.activateStrategy(strategyId);
      
      if (result) {
        logService.log('info', `Successfully retried strategy activation: ${strategyId}`, { operation }, 'RetryService');
        return true;
      }
      
      return false;
    } catch (error) {
      logService.log('error', 'Failed to retry strategy activation', error, 'RetryService');
      return false;
    }
  }

  /**
   * Retry a strategy deactivation operation
   * @param operation The operation to retry
   * @returns True if the retry was successful, false otherwise
   */
  private async retryStrategyDeactivation(operation: FailedOperation): Promise<boolean> {
    try {
      const { strategyService } = await import('./strategy-service');
      
      const { strategyId } = operation.operation_data;
      
      // Deactivate the strategy
      const result = await strategyService.deactivateStrategy(strategyId);
      
      if (result) {
        logService.log('info', `Successfully retried strategy deactivation: ${strategyId}`, { operation }, 'RetryService');
        return true;
      }
      
      return false;
    } catch (error) {
      logService.log('error', 'Failed to retry strategy deactivation', error, 'RetryService');
      return false;
    }
  }

  /**
   * Retry a market data fetch operation
   * @param operation The operation to retry
   * @returns True if the retry was successful, false otherwise
   */
  private async retryMarketDataFetch(operation: FailedOperation): Promise<boolean> {
    try {
      const { exchangeService } = await import('./exchange-service');
      
      const { symbol, timeframe, limit } = operation.operation_data;
      
      // Fetch market data
      const result = await exchangeService.getCandles(symbol, timeframe, limit);
      
      if (result && result.length > 0) {
        logService.log('info', `Successfully retried market data fetch for ${symbol}`, { operation }, 'RetryService');
        return true;
      }
      
      return false;
    } catch (error) {
      logService.log('error', 'Failed to retry market data fetch', error, 'RetryService');
      return false;
    }
  }

  /**
   * Calculate the next retry time based on exponential backoff with jitter
   * @param retryCount Current retry count
   * @param options Retry options
   * @returns ISO string of the next retry time
   */
  private calculateNextRetryTime(retryCount: number, options: RetryOptions): string {
    const {
      initialBackoffMs = 1000,
      maxBackoffMs = 3600000,
      backoffFactor = 2,
      jitterFactor = 0.2
    } = options;

    // Calculate base delay with exponential backoff
    let delay = initialBackoffMs * Math.pow(backoffFactor, retryCount);
    
    // Apply maximum
    delay = Math.min(delay, maxBackoffMs);
    
    // Apply jitter to avoid thundering herd problem
    const jitter = 1 + (Math.random() * jitterFactor * 2 - jitterFactor);
    delay = Math.floor(delay * jitter);
    
    // Calculate next retry time
    const nextRetryTime = new Date(Date.now() + delay);
    
    return nextRetryTime.toISOString();
  }
}

export const retryService = RetryService.getInstance();
