import { logService } from './log-service';
import { eventBus } from './event-bus';
import { circuitBreakerManager, CircuitBreaker } from './circuit-breaker';

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial backoff time in milliseconds */
  initialBackoffMs?: number;
  /** Maximum backoff time in milliseconds */
  maxBackoffMs?: number;
  /** Backoff factor for exponential backoff */
  backoffFactor?: number;
  /** Jitter factor to avoid thundering herd (0-1) */
  jitterFactor?: number;
  /** Function to determine if an error is retryable */
  isRetryableError?: (error: any) => boolean;
  /** Circuit breaker to use for this operation */
  circuitBreaker?: CircuitBreaker | string;
  /** Context for logging */
  context?: string;
  /** Timeout for the operation in milliseconds */
  timeoutMs?: number;
  /** Whether to throw the last error after all retries */
  throwOnExhausted?: boolean;
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  /** Whether the operation was successful */
  success: boolean;
  /** The result of the operation if successful */
  result?: T;
  /** The error if the operation failed */
  error?: any;
  /** The number of attempts made */
  attempts: number;
  /** The total time spent in milliseconds */
  totalTimeMs: number;
  /** Whether the circuit breaker was open */
  circuitBreakerOpen?: boolean;
}

/**
 * Helper class for retrying operations with exponential backoff
 */
export class RetryHelper {
  private static instance: RetryHelper;
  
  // Default options
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_INITIAL_BACKOFF_MS = 1000; // 1 second
  private readonly DEFAULT_MAX_BACKOFF_MS = 30000; // 30 seconds
  private readonly DEFAULT_BACKOFF_FACTOR = 2;
  private readonly DEFAULT_JITTER_FACTOR = 0.2; // 20% jitter
  private readonly DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

  private constructor() {}

  static getInstance(): RetryHelper {
    if (!RetryHelper.instance) {
      RetryHelper.instance = new RetryHelper();
    }
    return RetryHelper.instance;
  }

  /**
   * Retry an operation with exponential backoff
   * @param operation The operation to retry
   * @param options Retry options
   * @returns Promise that resolves to the retry result
   */
  async retry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const context = options.context || 'RetryHelper';
    
    // Set up options with defaults
    const maxRetries = options.maxRetries ?? this.DEFAULT_MAX_RETRIES;
    const initialBackoffMs = options.initialBackoffMs ?? this.DEFAULT_INITIAL_BACKOFF_MS;
    const maxBackoffMs = options.maxBackoffMs ?? this.DEFAULT_MAX_BACKOFF_MS;
    const backoffFactor = options.backoffFactor ?? this.DEFAULT_BACKOFF_FACTOR;
    const jitterFactor = options.jitterFactor ?? this.DEFAULT_JITTER_FACTOR;
    const timeoutMs = options.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
    const throwOnExhausted = options.throwOnExhausted ?? true;
    
    // Get the circuit breaker if specified
    let circuitBreaker: CircuitBreaker | undefined;
    if (options.circuitBreaker) {
      if (typeof options.circuitBreaker === 'string') {
        circuitBreaker = circuitBreakerManager.getCircuitBreaker(options.circuitBreaker);
      } else {
        circuitBreaker = options.circuitBreaker;
      }
    }
    
    // Function to determine if an error is retryable
    const isRetryableError = options.isRetryableError || this.defaultIsRetryableError;
    
    let lastError: any = null;
    let backoffTime = initialBackoffMs;
    let attempts = 0;
    
    // Check if circuit breaker is open
    if (circuitBreaker && circuitBreaker.isOpen()) {
      const error = new Error(`Circuit breaker ${circuitBreaker.getStats().name} is open`);
      
      logService.log('warn', `Operation rejected by circuit breaker`, {
        context,
        circuitBreaker: circuitBreaker.getStats().name
      }, 'RetryHelper');
      
      eventBus.emit('retry:rejected', {
        context,
        circuitBreaker: circuitBreaker.getStats().name,
        error
      });
      
      return {
        success: false,
        error,
        attempts: 0,
        totalTimeMs: Date.now() - startTime,
        circuitBreakerOpen: true
      };
    }
    
    // Retry loop
    for (attempts = 1; attempts <= maxRetries + 1; attempts++) {
      try {
        // Execute the operation with timeout
        const result = await this.executeWithTimeout(operation, timeoutMs);
        
        // Record success in circuit breaker
        if (circuitBreaker) {
          await circuitBreaker.execute(() => Promise.resolve());
        }
        
        // Log success
        logService.log('debug', `Operation succeeded on attempt ${attempts}`, {
          context,
          attempts
        }, 'RetryHelper');
        
        // Emit success event
        eventBus.emit('retry:success', {
          context,
          attempts,
          totalTimeMs: Date.now() - startTime
        });
        
        // Return success result
        return {
          success: true,
          result,
          attempts,
          totalTimeMs: Date.now() - startTime
        };
      } catch (error) {
        lastError = error;
        
        // Log the error
        logService.log('warn', `Operation failed on attempt ${attempts}/${maxRetries + 1}`, {
          context,
          error: error instanceof Error ? error.message : String(error),
          attempts,
          isRetryable: isRetryableError(error),
          remainingRetries: maxRetries + 1 - attempts
        }, 'RetryHelper');
        
        // If this was the last attempt, break
        if (attempts > maxRetries) {
          break;
        }
        
        // Check if the error is retryable
        if (!isRetryableError(error)) {
          logService.log('warn', `Non-retryable error, giving up`, {
            context,
            error: error instanceof Error ? error.message : String(error)
          }, 'RetryHelper');
          
          break;
        }
        
        // Calculate backoff time with jitter
        const jitter = 1 + (Math.random() * jitterFactor * 2 - jitterFactor);
        const actualBackoff = Math.min(backoffTime * jitter, maxBackoffMs);
        
        logService.log('debug', `Retrying in ${actualBackoff}ms (attempt ${attempts}/${maxRetries + 1})`, {
          context,
          backoffTime: actualBackoff
        }, 'RetryHelper');
        
        // Wait for backoff period
        await new Promise(resolve => setTimeout(resolve, actualBackoff));
        
        // Increase backoff for next attempt
        backoffTime = Math.min(backoffTime * backoffFactor, maxBackoffMs);
      }
    }
    
    // If we get here, all retries failed
    logService.log('error', `Operation failed after ${attempts - 1} retries`, {
      context,
      error: lastError instanceof Error ? lastError.message : String(lastError)
    }, 'RetryHelper');
    
    // Emit failure event
    eventBus.emit('retry:failure', {
      context,
      attempts: attempts - 1,
      totalTimeMs: Date.now() - startTime,
      error: lastError
    });
    
    // Throw the last error if requested
    if (throwOnExhausted) {
      throw lastError;
    }
    
    // Return failure result
    return {
      success: false,
      error: lastError,
      attempts: attempts - 1,
      totalTimeMs: Date.now() - startTime
    };
  }

  /**
   * Execute an operation with a timeout
   * @param operation The operation to execute
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise that resolves to the operation result
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        
        // Clean up the timeout if the operation completes
        timeoutPromise.finally(() => clearTimeout(timeoutId));
      });
      
      // Race the operation against the timeout
      Promise.race([operation(), timeoutPromise])
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Default function to determine if an error is retryable
   * @param error The error to check
   * @returns True if the error is retryable
   */
  private defaultIsRetryableError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    
    // Network errors are generally retryable
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('socket') ||
      errorMessage.includes('dns') ||
      errorMessage.includes('unreachable') ||
      errorMessage.includes('temporary')
    ) {
      return true;
    }
    
    // Service errors may be retryable
    if (
      errorMessage.includes('503') ||
      errorMessage.includes('service unavailable') ||
      errorMessage.includes('429') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('overloaded') ||
      errorMessage.includes('try again')
    ) {
      return true;
    }
    
    // Validation errors are generally not retryable
    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('404') ||
      errorMessage.includes('400') ||
      errorMessage.includes('bad request')
    ) {
      return false;
    }
    
    // Default to not retryable for unknown errors
    return false;
  }

  /**
   * Retry multiple operations in parallel
   * @param operations Array of operations to retry
   * @param options Retry options
   * @returns Promise that resolves to an array of retry results
   */
  async retryAll<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>[]> {
    return Promise.all(operations.map(operation => this.retry(operation, options)));
  }

  /**
   * Retry multiple operations in sequence
   * @param operations Array of operations to retry
   * @param options Retry options
   * @returns Promise that resolves to an array of retry results
   */
  async retrySequential<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>[]> {
    const results: RetryResult<T>[] = [];
    
    for (const operation of operations) {
      const result = await this.retry(operation, options);
      results.push(result);
      
      // If an operation fails and throwOnExhausted is false, continue with the next operation
      if (!result.success && options.throwOnExhausted === false) {
        continue;
      }
      
      // If an operation fails and throwOnExhausted is true, stop and return the results so far
      if (!result.success && options.throwOnExhausted !== false) {
        break;
      }
    }
    
    return results;
  }
}

export const retryHelper = RetryHelper.getInstance();
