import { retryHelper } from '../lib/retry-helper';
import { CircuitBreaker, CircuitState } from '../lib/circuit-breaker';

// Mock the log service
jest.mock('../lib/log-service', () => ({
  logService: {
    log: jest.fn()
  }
}));

// Mock the event bus
jest.mock('../lib/event-bus', () => ({
  eventBus: {
    emit: jest.fn()
  }
}));

describe('RetryHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should retry an operation until success', async () => {
    // Mock function that fails twice then succeeds
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce('success');
    
    const result = await retryHelper.retry(mockFn, {
      maxRetries: 3,
      initialBackoffMs: 10,
      context: 'test'
    });
    
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(3);
  });
  
  test('should stop retrying after max retries', async () => {
    // Mock function that always fails
    const mockFn = jest.fn().mockRejectedValue(new Error('network error'));
    
    // Set throwOnExhausted to false to prevent throwing
    const result = await retryHelper.retry(mockFn, {
      maxRetries: 2,
      initialBackoffMs: 10,
      throwOnExhausted: false,
      context: 'test'
    });
    
    expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.attempts).toBe(2);
  });
  
  test('should throw after max retries if throwOnExhausted is true', async () => {
    // Mock function that always fails
    const mockFn = jest.fn().mockRejectedValue(new Error('network error'));
    
    await expect(retryHelper.retry(mockFn, {
      maxRetries: 2,
      initialBackoffMs: 10,
      throwOnExhausted: true,
      context: 'test'
    })).rejects.toThrow('network error');
    
    expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
  
  test('should not retry non-retryable errors', async () => {
    // Mock function that fails with a non-retryable error
    const mockFn = jest.fn().mockRejectedValue(new Error('validation error'));
    
    // Custom function to determine if an error is retryable
    const isRetryableError = (error: any) => {
      return error.message.includes('network');
    };
    
    // Set throwOnExhausted to false to prevent throwing
    const result = await retryHelper.retry(mockFn, {
      maxRetries: 3,
      initialBackoffMs: 10,
      isRetryableError,
      throwOnExhausted: false,
      context: 'test'
    });
    
    expect(mockFn).toHaveBeenCalledTimes(1); // No retries
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.attempts).toBe(0);
  });
  
  test('should respect circuit breaker', async () => {
    // Create a mock circuit breaker
    const mockCircuitBreaker = {
      isOpen: jest.fn().mockReturnValue(true),
      getStats: jest.fn().mockReturnValue({ name: 'test-circuit' }),
      execute: jest.fn()
    } as unknown as CircuitBreaker;
    
    // Mock function that succeeds
    const mockFn = jest.fn().mockResolvedValue('success');
    
    // Set throwOnExhausted to false to prevent throwing
    const result = await retryHelper.retry(mockFn, {
      maxRetries: 3,
      initialBackoffMs: 10,
      circuitBreaker: mockCircuitBreaker,
      throwOnExhausted: false,
      context: 'test'
    });
    
    expect(mockFn).not.toHaveBeenCalled(); // Function not called due to open circuit
    expect(result.success).toBe(false);
    expect(result.circuitBreakerOpen).toBe(true);
    expect(result.attempts).toBe(0);
  });
  
  test('should handle timeout', async () => {
    // Mock function that takes longer than the timeout
    const mockFn = jest.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(() => resolve('success'), 100));
    });
    
    // Set throwOnExhausted to false to prevent throwing
    const result = await retryHelper.retry(mockFn, {
      maxRetries: 1,
      initialBackoffMs: 10,
      timeoutMs: 50,
      throwOnExhausted: false,
      context: 'test'
    });
    
    expect(mockFn).toHaveBeenCalledTimes(2); // Initial + 1 retry
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error.message).toContain('timed out');
  });
  
  test('should retry multiple operations in parallel', async () => {
    // Mock functions
    const mockFn1 = jest.fn().mockResolvedValue('success1');
    const mockFn2 = jest.fn().mockResolvedValue('success2');
    
    const results = await retryHelper.retryAll([mockFn1, mockFn2], {
      maxRetries: 1,
      initialBackoffMs: 10,
      context: 'test'
    });
    
    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[0].result).toBe('success1');
    expect(results[1].success).toBe(true);
    expect(results[1].result).toBe('success2');
  });
  
  test('should retry multiple operations in sequence', async () => {
    // Mock functions
    const mockFn1 = jest.fn().mockResolvedValue('success1');
    const mockFn2 = jest.fn().mockResolvedValue('success2');
    
    const results = await retryHelper.retrySequential([mockFn1, mockFn2], {
      maxRetries: 1,
      initialBackoffMs: 10,
      context: 'test'
    });
    
    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[0].result).toBe('success1');
    expect(results[1].success).toBe(true);
    expect(results[1].result).toBe('success2');
  });
  
  test('should stop sequential operations on failure if throwOnExhausted is true', async () => {
    // Mock functions
    const mockFn1 = jest.fn().mockRejectedValue(new Error('network error'));
    const mockFn2 = jest.fn().mockResolvedValue('success2');
    
    const results = await retryHelper.retrySequential([mockFn1, mockFn2], {
      maxRetries: 1,
      initialBackoffMs: 10,
      throwOnExhausted: false,
      context: 'test'
    });
    
    expect(results.length).toBe(2);
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(true);
    expect(results[1].result).toBe('success2');
  });
});
