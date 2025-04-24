import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { eventBus } from './event-bus';

/**
 * Circuit breaker state
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Error category for circuit breaker
 */
export type ErrorCategory = 'network' | 'service' | 'validation' | 'timeout' | 'unknown';

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /** Name of the circuit breaker */
  name: string;
  /** Failure thresholds for different error categories */
  thresholds?: {
    [key in ErrorCategory]?: number;
  };
  /** Time window for counting failures (ms) */
  failureWindowMs?: number;
  /** Time to wait before transitioning from OPEN to HALF_OPEN (ms) */
  resetTimeoutMs?: number;
  /** Number of consecutive successes required to close the circuit */
  requiredSuccesses?: number;
  /** Maximum number of calls allowed in HALF_OPEN state */
  halfOpenMaxCalls?: number;
  /** Function to determine if an error is retryable */
  isRetryableError?: (error: any) => boolean;
  /** Function to categorize an error */
  categorizeError?: (error: any) => ErrorCategory;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  /** Name of the circuit breaker */
  name: string;
  /** Current state */
  state: CircuitState;
  /** Failure counts by category */
  failures: {
    [key in ErrorCategory]: number;
  };
  /** Total failures */
  totalFailures: number;
  /** Consecutive successes in HALF_OPEN state */
  consecutiveSuccesses: number;
  /** Required successes to close the circuit */
  requiredSuccesses: number;
  /** Timestamp of last state change */
  lastStateChange: number;
  /** Timestamp of last failure */
  lastFailure: number;
  /** Timestamp of last success */
  lastSuccess: number;
  /** Total calls */
  totalCalls: number;
  /** Successful calls */
  successfulCalls: number;
  /** Failed calls */
  failedCalls: number;
  /** Calls prevented by open circuit */
  preventedCalls: number;
}

/**
 * Generic circuit breaker implementation
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: { [key in ErrorCategory]: number } = {
    network: 0,
    service: 0,
    validation: 0,
    timeout: 0,
    unknown: 0
  };
  private totalFailures: number = 0;
  private consecutiveSuccesses: number = 0;
  private lastStateChange: number = Date.now();
  private lastFailure: number = 0;
  private lastSuccess: number = 0;
  private halfOpenCallCount: number = 0;
  private totalCalls: number = 0;
  private successfulCalls: number = 0;
  private failedCalls: number = 0;
  private preventedCalls: number = 0;
  
  // Default options
  private readonly options: Required<CircuitBreakerOptions>;
  private readonly DEFAULT_THRESHOLDS: { [key in ErrorCategory]: number } = {
    network: 5,
    service: 3,
    validation: 2,
    timeout: 4,
    unknown: 3
  };
  private readonly DEFAULT_FAILURE_WINDOW_MS = 60000; // 1 minute
  private readonly DEFAULT_RESET_TIMEOUT_MS = 30000; // 30 seconds
  private readonly DEFAULT_REQUIRED_SUCCESSES = 2;
  private readonly DEFAULT_HALF_OPEN_MAX_CALLS = 3;

  /**
   * Create a new circuit breaker
   * @param options Circuit breaker options
   */
  constructor(options: CircuitBreakerOptions) {
    super();
    
    // Set default options
    this.options = {
      name: options.name,
      thresholds: { ...this.DEFAULT_THRESHOLDS, ...options.thresholds },
      failureWindowMs: options.failureWindowMs || this.DEFAULT_FAILURE_WINDOW_MS,
      resetTimeoutMs: options.resetTimeoutMs || this.DEFAULT_RESET_TIMEOUT_MS,
      requiredSuccesses: options.requiredSuccesses || this.DEFAULT_REQUIRED_SUCCESSES,
      halfOpenMaxCalls: options.halfOpenMaxCalls || this.DEFAULT_HALF_OPEN_MAX_CALLS,
      isRetryableError: options.isRetryableError || this.defaultIsRetryableError,
      categorizeError: options.categorizeError || this.defaultCategorizeError
    };
    
    logService.log('info', `Created circuit breaker: ${this.options.name}`, {
      thresholds: this.options.thresholds,
      failureWindowMs: this.options.failureWindowMs,
      resetTimeoutMs: this.options.resetTimeoutMs,
      requiredSuccesses: this.options.requiredSuccesses
    }, 'CircuitBreaker');
  }

  /**
   * Execute a function with circuit breaker protection
   * @param fn Function to execute
   * @returns Promise that resolves to the function result
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.isOpen()) {
      this.preventedCalls++;
      const error = new Error(`Circuit ${this.options.name} is open`);
      this.emit('rejected', { name: this.options.name, error });
      eventBus.emit(`circuitBreaker:${this.options.name}:rejected`, { error });
      throw error;
    }
    
    // Check if we've reached the maximum calls in half-open state
    if (this.state === CircuitState.HALF_OPEN && this.halfOpenCallCount >= this.options.halfOpenMaxCalls) {
      this.preventedCalls++;
      const error = new Error(`Circuit ${this.options.name} has reached maximum calls in half-open state`);
      this.emit('rejected', { name: this.options.name, error });
      eventBus.emit(`circuitBreaker:${this.options.name}:rejected`, { error });
      throw error;
    }
    
    // Increment call counters
    this.totalCalls++;
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCallCount++;
    }
    
    try {
      // Execute the function
      const result = await fn();
      
      // Record success
      this.recordSuccess();
      
      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(error);
      
      // Re-throw the error
      throw error;
    }
  }

  /**
   * Record a successful operation
   */
  private recordSuccess(): void {
    this.successfulCalls++;
    this.lastSuccess = Date.now();
    
    // If we're in half-open state, track consecutive successes
    if (this.state === CircuitState.HALF_OPEN) {
      this.consecutiveSuccesses++;
      
      // If we've had enough consecutive successes, close the circuit
      if (this.consecutiveSuccesses >= this.options.requiredSuccesses) {
        this.closeCircuit();
      }
    }
    
    this.emit('success', { name: this.options.name });
    eventBus.emit(`circuitBreaker:${this.options.name}:success`, {});
  }

  /**
   * Record a failed operation
   * @param error The error that occurred
   */
  private recordFailure(error: any): void {
    const now = Date.now();
    const timeSinceLastFailure = now - this.lastFailure;
    const errorCategory = this.options.categorizeError(error);
    
    this.failedCalls++;
    
    // If it's been a while since the last failure, reset the counters
    if (timeSinceLastFailure >= this.options.failureWindowMs) {
      this.resetFailureCounters();
    }
    
    // Increment the appropriate failure counter
    this.failures[errorCategory]++;
    this.totalFailures++;
    this.lastFailure = now;
    this.consecutiveSuccesses = 0; // Reset consecutive successes
    
    // If we're in half-open state, any failure immediately opens the circuit
    if (this.state === CircuitState.HALF_OPEN) {
      this.openCircuit();
      return;
    }
    
    // Check if we've reached the threshold for this error category
    if (this.failures[errorCategory] >= this.options.thresholds[errorCategory]) {
      this.openCircuit();
      return;
    }
    
    // Also check total failures as a fallback
    const avgThreshold = Object.values(this.options.thresholds).reduce((sum, val) => sum + val, 0) / 5;
    if (this.totalFailures >= avgThreshold * 2) {
      this.openCircuit();
      return;
    }
    
    this.emit('failure', { name: this.options.name, error, category: errorCategory });
    eventBus.emit(`circuitBreaker:${this.options.name}:failure`, { error, category: errorCategory });
  }

  /**
   * Reset failure counters
   */
  private resetFailureCounters(): void {
    this.failures.network = 0;
    this.failures.service = 0;
    this.failures.validation = 0;
    this.failures.timeout = 0;
    this.failures.unknown = 0;
    this.totalFailures = 0;
  }

  /**
   * Open the circuit
   */
  private openCircuit(): void {
    const now = Date.now();
    this.state = CircuitState.OPEN;
    this.lastStateChange = now;
    this.consecutiveSuccesses = 0;
    
    // Schedule transition to half-open state
    setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.options.resetTimeoutMs);
    
    logService.log('warn', `Circuit ${this.options.name} opened due to multiple failures`, {
      failures: this.failures,
      thresholds: this.options.thresholds,
      totalFailures: this.totalFailures,
      resetTimeoutMs: this.options.resetTimeoutMs
    }, 'CircuitBreaker');
    
    this.emit('open', { name: this.options.name, failures: { ...this.failures }, totalFailures: this.totalFailures });
    eventBus.emit(`circuitBreaker:${this.options.name}:open`, { failures: { ...this.failures }, totalFailures: this.totalFailures });
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    // Only transition if still open
    if (this.state !== CircuitState.OPEN) {
      return;
    }
    
    const now = Date.now();
    this.state = CircuitState.HALF_OPEN;
    this.lastStateChange = now;
    this.halfOpenCallCount = 0;
    
    logService.log('info', `Circuit ${this.options.name} transitioned to half-open state`, null, 'CircuitBreaker');
    
    this.emit('halfOpen', { name: this.options.name });
    eventBus.emit(`circuitBreaker:${this.options.name}:halfOpen`, {});
  }

  /**
   * Close the circuit
   */
  private closeCircuit(): void {
    const now = Date.now();
    this.state = CircuitState.CLOSED;
    this.lastStateChange = now;
    this.resetFailureCounters();
    this.consecutiveSuccesses = 0;
    this.halfOpenCallCount = 0;
    
    logService.log('info', `Circuit ${this.options.name} closed after successful operations`, null, 'CircuitBreaker');
    
    this.emit('close', { name: this.options.name });
    eventBus.emit(`circuitBreaker:${this.options.name}:close`, {});
  }

  /**
   * Check if the circuit is open
   * @returns True if the circuit is open
   */
  isOpen(): boolean {
    // If in OPEN state, check if it's time to transition to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      const timeInOpenState = now - this.lastStateChange;
      
      if (timeInOpenState >= this.options.resetTimeoutMs) {
        this.transitionToHalfOpen();
        return false;
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Get the current state of the circuit
   * @returns Circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   * @returns Circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      name: this.options.name,
      state: this.state,
      failures: { ...this.failures },
      totalFailures: this.totalFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      requiredSuccesses: this.options.requiredSuccesses,
      lastStateChange: this.lastStateChange,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      totalCalls: this.totalCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.failedCalls,
      preventedCalls: this.preventedCalls
    };
  }

  /**
   * Force the circuit to a specific state
   * @param state Circuit state
   */
  forceState(state: CircuitState): void {
    const now = Date.now();
    this.state = state;
    this.lastStateChange = now;
    
    if (state === CircuitState.CLOSED) {
      this.resetFailureCounters();
      this.consecutiveSuccesses = 0;
      this.halfOpenCallCount = 0;
    } else if (state === CircuitState.HALF_OPEN) {
      this.halfOpenCallCount = 0;
    }
    
    logService.log('info', `Circuit ${this.options.name} forced to ${state} state`, null, 'CircuitBreaker');
    
    this.emit('forceState', { name: this.options.name, state });
    eventBus.emit(`circuitBreaker:${this.options.name}:forceState`, { state });
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    const now = Date.now();
    this.state = CircuitState.CLOSED;
    this.lastStateChange = now;
    this.resetFailureCounters();
    this.consecutiveSuccesses = 0;
    this.halfOpenCallCount = 0;
    this.totalCalls = 0;
    this.successfulCalls = 0;
    this.failedCalls = 0;
    this.preventedCalls = 0;
    
    logService.log('info', `Circuit ${this.options.name} reset`, null, 'CircuitBreaker');
    
    this.emit('reset', { name: this.options.name });
    eventBus.emit(`circuitBreaker:${this.options.name}:reset`, {});
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
   * Default function to categorize an error
   * @param error The error to categorize
   * @returns Error category
   */
  private defaultCategorizeError(error: any): ErrorCategory {
    const errorMessage = error?.message?.toLowerCase() || '';
    
    // Network errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('socket') ||
      errorMessage.includes('dns') ||
      errorMessage.includes('unreachable')
    ) {
      return 'network';
    }
    
    // Timeout errors
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('timed out')
    ) {
      return 'timeout';
    }
    
    // Service errors
    if (
      errorMessage.includes('service') ||
      errorMessage.includes('server') ||
      errorMessage.includes('503') ||
      errorMessage.includes('502') ||
      errorMessage.includes('500') ||
      errorMessage.includes('429') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('overloaded')
    ) {
      return 'service';
    }
    
    // Validation errors
    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('404') ||
      errorMessage.includes('400') ||
      errorMessage.includes('bad request') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('401') ||
      errorMessage.includes('403')
    ) {
      return 'validation';
    }
    
    // Default to unknown
    return 'unknown';
  }
}

/**
 * Circuit breaker manager for managing multiple circuit breakers
 */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {}

  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  /**
   * Create a new circuit breaker
   * @param options Circuit breaker options
   * @returns The created circuit breaker
   */
  createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
    if (this.circuitBreakers.has(options.name)) {
      throw new Error(`Circuit breaker ${options.name} already exists`);
    }
    
    const circuitBreaker = new CircuitBreaker(options);
    this.circuitBreakers.set(options.name, circuitBreaker);
    
    return circuitBreaker;
  }

  /**
   * Get a circuit breaker by name
   * @param name Circuit breaker name
   * @returns The circuit breaker or undefined if not found
   */
  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  /**
   * Get or create a circuit breaker
   * @param options Circuit breaker options
   * @returns The circuit breaker
   */
  getOrCreateCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
    const existingCircuitBreaker = this.circuitBreakers.get(options.name);
    
    if (existingCircuitBreaker) {
      return existingCircuitBreaker;
    }
    
    return this.createCircuitBreaker(options);
  }

  /**
   * Get all circuit breakers
   * @returns Map of circuit breaker name to circuit breaker
   */
  getAllCircuitBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Get statistics for all circuit breakers
   * @returns Map of circuit breaker name to statistics
   */
  getAllStats(): Map<string, CircuitBreakerStats> {
    const stats = new Map<string, CircuitBreakerStats>();
    
    for (const [name, circuitBreaker] of this.circuitBreakers.entries()) {
      stats.set(name, circuitBreaker.getStats());
    }
    
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
    
    logService.log('info', 'Reset all circuit breakers', null, 'CircuitBreakerManager');
  }
}

export const circuitBreakerManager = CircuitBreakerManager.getInstance();
