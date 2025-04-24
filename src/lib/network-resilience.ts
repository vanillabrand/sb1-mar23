import { logService } from './log-service';
import { eventBus } from './event-bus';
import { circuitBreakerManager, CircuitBreaker, CircuitState } from './circuit-breaker';
import { retryHelper, RetryOptions, RetryResult } from './retry-helper';
import { networkErrorHandler } from './network-error-handler';

/**
 * Network resilience options
 */
export interface NetworkResilienceOptions extends RetryOptions {
  /** Whether to show error UI for network errors */
  showErrorUI?: boolean;
  /** Whether to emit events for network operations */
  emitEvents?: boolean;
  /** Whether to log network operations */
  logOperations?: boolean;
}

/**
 * Network operation result
 */
export interface NetworkResult<T> extends RetryResult<T> {
  /** Whether the operation was handled by the network error handler */
  errorHandled?: boolean;
}

/**
 * Network resilience service for handling network operations with retries and circuit breakers
 */
class NetworkResilience {
  private static instance: NetworkResilience;
  
  // Default options
  private readonly DEFAULT_OPTIONS: NetworkResilienceOptions = {
    maxRetries: 3,
    initialBackoffMs: 1000,
    maxBackoffMs: 30000,
    backoffFactor: 2,
    jitterFactor: 0.2,
    timeoutMs: 30000,
    throwOnExhausted: false,
    showErrorUI: true,
    emitEvents: true,
    logOperations: true
  };

  private constructor() {}

  static getInstance(): NetworkResilience {
    if (!NetworkResilience.instance) {
      NetworkResilience.instance = new NetworkResilience();
    }
    return NetworkResilience.instance;
  }

  /**
   * Execute a network operation with retries and circuit breaker
   * @param operation The operation to execute
   * @param options Network resilience options
   * @returns Promise that resolves to the network operation result
   */
  async executeNetworkOperation<T>(
    operation: () => Promise<T>,
    options: NetworkResilienceOptions = {}
  ): Promise<NetworkResult<T>> {
    const startTime = Date.now();
    const context = options.context || 'NetworkResilience';
    
    // Merge options with defaults
    const mergedOptions: NetworkResilienceOptions = {
      ...this.DEFAULT_OPTIONS,
      ...options
    };
    
    // Get or create circuit breaker
    let circuitBreaker: CircuitBreaker | undefined;
    if (typeof mergedOptions.circuitBreaker === 'string') {
      // Get existing circuit breaker by name
      circuitBreaker = circuitBreakerManager.getCircuitBreaker(mergedOptions.circuitBreaker);
      
      // Create circuit breaker if it doesn't exist
      if (!circuitBreaker) {
        circuitBreaker = circuitBreakerManager.createCircuitBreaker({
          name: mergedOptions.circuitBreaker,
          thresholds: {
            network: 3,
            service: 5,
            validation: 2,
            timeout: 4,
            unknown: 3
          },
          failureWindowMs: 60000, // 1 minute
          resetTimeoutMs: 30000, // 30 seconds
          requiredSuccesses: 2
        });
      }
    } else if (mergedOptions.circuitBreaker instanceof CircuitBreaker) {
      circuitBreaker = mergedOptions.circuitBreaker;
    }
    
    try {
      // Log operation start if enabled
      if (mergedOptions.logOperations) {
        logService.log('debug', `Starting network operation`, {
          context,
          circuitBreaker: circuitBreaker?.getStats().name,
          options: {
            maxRetries: mergedOptions.maxRetries,
            timeoutMs: mergedOptions.timeoutMs
          }
        }, 'NetworkResilience');
      }
      
      // Emit operation start event if enabled
      if (mergedOptions.emitEvents) {
        eventBus.emit('networkOperation:start', {
          context,
          circuitBreaker: circuitBreaker?.getStats().name,
          startTime
        });
      }
      
      // Execute the operation with retries
      const result = await retryHelper.retry(operation, {
        ...mergedOptions,
        circuitBreaker
      });
      
      // Log operation success if enabled
      if (mergedOptions.logOperations) {
        logService.log('debug', `Network operation succeeded`, {
          context,
          attempts: result.attempts,
          totalTimeMs: result.totalTimeMs
        }, 'NetworkResilience');
      }
      
      // Emit operation success event if enabled
      if (mergedOptions.emitEvents) {
        eventBus.emit('networkOperation:success', {
          context,
          attempts: result.attempts,
          totalTimeMs: result.totalTimeMs
        });
      }
      
      return {
        ...result,
        errorHandled: false
      };
    } catch (error) {
      // Log operation failure if enabled
      if (mergedOptions.logOperations) {
        logService.log('error', `Network operation failed`, {
          context,
          error: error instanceof Error ? error.message : String(error),
          totalTimeMs: Date.now() - startTime
        }, 'NetworkResilience');
      }
      
      // Emit operation failure event if enabled
      if (mergedOptions.emitEvents) {
        eventBus.emit('networkOperation:failure', {
          context,
          error,
          totalTimeMs: Date.now() - startTime
        });
      }
      
      // Handle network error if enabled
      let errorHandled = false;
      if (mergedOptions.showErrorUI && this.isNetworkError(error)) {
        networkErrorHandler.handleError(
          error instanceof Error ? error : new Error(String(error)),
          context
        );
        errorHandled = true;
      }
      
      // Return failure result
      return {
        success: false,
        error,
        attempts: mergedOptions.maxRetries || this.DEFAULT_OPTIONS.maxRetries!,
        totalTimeMs: Date.now() - startTime,
        errorHandled
      };
    }
  }

  /**
   * Execute multiple network operations in parallel
   * @param operations Array of operations to execute
   * @param options Network resilience options
   * @returns Promise that resolves to an array of network operation results
   */
  async executeParallel<T>(
    operations: Array<() => Promise<T>>,
    options: NetworkResilienceOptions = {}
  ): Promise<NetworkResult<T>[]> {
    return Promise.all(operations.map(operation => this.executeNetworkOperation(operation, options)));
  }

  /**
   * Execute multiple network operations in sequence
   * @param operations Array of operations to execute
   * @param options Network resilience options
   * @returns Promise that resolves to an array of network operation results
   */
  async executeSequential<T>(
    operations: Array<() => Promise<T>>,
    options: NetworkResilienceOptions = {}
  ): Promise<NetworkResult<T>[]> {
    const results: NetworkResult<T>[] = [];
    
    for (const operation of operations) {
      const result = await this.executeNetworkOperation(operation, options);
      results.push(result);
      
      // If an operation fails and stopOnFailure is true, stop and return the results so far
      if (!result.success && options.throwOnExhausted) {
        break;
      }
    }
    
    return results;
  }

  /**
   * Get all circuit breakers
   * @returns Map of circuit breaker name to circuit breaker
   */
  getAllCircuitBreakers(): Map<string, CircuitBreaker> {
    return circuitBreakerManager.getAllCircuitBreakers();
  }

  /**
   * Get a circuit breaker by name
   * @param name Circuit breaker name
   * @returns The circuit breaker or undefined if not found
   */
  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return circuitBreakerManager.getCircuitBreaker(name);
  }

  /**
   * Create a circuit breaker
   * @param name Circuit breaker name
   * @param options Circuit breaker options
   * @returns The created circuit breaker
   */
  createCircuitBreaker(name: string, options: any = {}): CircuitBreaker {
    return circuitBreakerManager.createCircuitBreaker({
      name,
      ...options
    });
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    circuitBreakerManager.resetAll();
  }

  /**
   * Force a circuit breaker to a specific state
   * @param name Circuit breaker name
   * @param state Circuit state
   */
  forceCircuitBreakerState(name: string, state: CircuitState): void {
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker(name);
    
    if (circuitBreaker) {
      circuitBreaker.forceState(state);
    }
  }

  /**
   * Check if an error is a network error
   * @param error The error to check
   * @returns True if it's a network error
   */
  private isNetworkError(error: unknown): boolean {
    return networkErrorHandler.isNetworkError(error);
  }
}

export const networkResilience = NetworkResilience.getInstance();
