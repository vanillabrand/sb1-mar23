import { CircuitBreaker, CircuitState, circuitBreakerManager } from '../lib/circuit-breaker';

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

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  
  beforeEach(() => {
    // Create a new circuit breaker for each test
    circuitBreaker = new CircuitBreaker({
      name: 'test-circuit',
      thresholds: {
        network: 2,
        service: 2,
        validation: 1,
        timeout: 2,
        unknown: 2
      },
      failureWindowMs: 1000,
      resetTimeoutMs: 500,
      requiredSuccesses: 2
    });
  });
  
  test('should start in closed state', () => {
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });
  
  test('should execute function when circuit is closed', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    
    const result = await circuitBreaker.execute(mockFn);
    
    expect(mockFn).toHaveBeenCalled();
    expect(result).toBe('success');
  });
  
  test('should open circuit after reaching failure threshold', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('network error'));
    
    // First failure
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('network error');
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    
    // Second failure - should open the circuit
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('network error');
    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
  });
  
  test('should reject calls when circuit is open', async () => {
    // Force circuit to open state
    circuitBreaker.forceState(CircuitState.OPEN);
    
    const mockFn = jest.fn().mockResolvedValue('success');
    
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Circuit test-circuit is open');
    expect(mockFn).not.toHaveBeenCalled();
  });
  
  test('should transition to half-open state after reset timeout', async () => {
    // Force circuit to open state
    circuitBreaker.forceState(CircuitState.OPEN);
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Should be in half-open state now
    expect(circuitBreaker.isOpen()).toBe(false);
    
    // Execute a function - should be allowed in half-open state
    const mockFn = jest.fn().mockResolvedValue('success');
    await circuitBreaker.execute(mockFn);
    
    expect(mockFn).toHaveBeenCalled();
    expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
  });
  
  test('should close circuit after required successes in half-open state', async () => {
    // Force circuit to half-open state
    circuitBreaker.forceState(CircuitState.HALF_OPEN);
    
    const mockFn = jest.fn().mockResolvedValue('success');
    
    // First success
    await circuitBreaker.execute(mockFn);
    expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
    
    // Second success - should close the circuit
    await circuitBreaker.execute(mockFn);
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });
  
  test('should open circuit immediately on failure in half-open state', async () => {
    // Force circuit to half-open state
    circuitBreaker.forceState(CircuitState.HALF_OPEN);
    
    const mockFn = jest.fn().mockRejectedValue(new Error('network error'));
    
    // Failure in half-open state - should open the circuit
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('network error');
    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
  });
  
  test('should reset circuit breaker', () => {
    // Force circuit to open state
    circuitBreaker.forceState(CircuitState.OPEN);
    
    // Reset the circuit breaker
    circuitBreaker.reset();
    
    // Should be in closed state
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });
  
  test('should track statistics', async () => {
    const successFn = jest.fn().mockResolvedValue('success');
    const failureFn = jest.fn().mockRejectedValue(new Error('network error'));
    
    // Execute some successful calls
    await circuitBreaker.execute(successFn);
    await circuitBreaker.execute(successFn);
    
    // Execute some failed calls
    await expect(circuitBreaker.execute(failureFn)).rejects.toThrow('network error');
    
    // Get stats
    const stats = circuitBreaker.getStats();
    
    expect(stats.totalCalls).toBe(3);
    expect(stats.successfulCalls).toBe(2);
    expect(stats.failedCalls).toBe(1);
    expect(stats.failures.network).toBe(1);
  });
});

describe('CircuitBreakerManager', () => {
  beforeEach(() => {
    // Reset the circuit breaker manager
    circuitBreakerManager.resetAll();
  });
  
  test('should create a circuit breaker', () => {
    const circuitBreaker = circuitBreakerManager.createCircuitBreaker({
      name: 'test-circuit'
    });
    
    expect(circuitBreaker).toBeDefined();
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });
  
  test('should get a circuit breaker by name', () => {
    // Create a circuit breaker
    circuitBreakerManager.createCircuitBreaker({
      name: 'test-circuit'
    });
    
    // Get the circuit breaker
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker('test-circuit');
    
    expect(circuitBreaker).toBeDefined();
    expect(circuitBreaker!.getState()).toBe(CircuitState.CLOSED);
  });
  
  test('should get or create a circuit breaker', () => {
    // Get or create a circuit breaker
    const circuitBreaker1 = circuitBreakerManager.getOrCreateCircuitBreaker({
      name: 'test-circuit'
    });
    
    // Get or create the same circuit breaker
    const circuitBreaker2 = circuitBreakerManager.getOrCreateCircuitBreaker({
      name: 'test-circuit'
    });
    
    expect(circuitBreaker1).toBe(circuitBreaker2);
  });
  
  test('should get all circuit breakers', () => {
    // Create some circuit breakers
    circuitBreakerManager.createCircuitBreaker({
      name: 'circuit-1'
    });
    
    circuitBreakerManager.createCircuitBreaker({
      name: 'circuit-2'
    });
    
    // Get all circuit breakers
    const circuitBreakers = circuitBreakerManager.getAllCircuitBreakers();
    
    expect(circuitBreakers.size).toBe(2);
    expect(circuitBreakers.has('circuit-1')).toBe(true);
    expect(circuitBreakers.has('circuit-2')).toBe(true);
  });
  
  test('should get statistics for all circuit breakers', () => {
    // Create some circuit breakers
    circuitBreakerManager.createCircuitBreaker({
      name: 'circuit-1'
    });
    
    circuitBreakerManager.createCircuitBreaker({
      name: 'circuit-2'
    });
    
    // Get all stats
    const stats = circuitBreakerManager.getAllStats();
    
    expect(stats.size).toBe(2);
    expect(stats.has('circuit-1')).toBe(true);
    expect(stats.has('circuit-2')).toBe(true);
  });
  
  test('should reset all circuit breakers', () => {
    // Create some circuit breakers
    const circuit1 = circuitBreakerManager.createCircuitBreaker({
      name: 'circuit-1'
    });
    
    const circuit2 = circuitBreakerManager.createCircuitBreaker({
      name: 'circuit-2'
    });
    
    // Force them to open state
    circuit1.forceState(CircuitState.OPEN);
    circuit2.forceState(CircuitState.OPEN);
    
    // Reset all circuit breakers
    circuitBreakerManager.resetAll();
    
    // Should be in closed state
    expect(circuit1.getState()).toBe(CircuitState.CLOSED);
    expect(circuit2.getState()).toBe(CircuitState.CLOSED);
  });
});
