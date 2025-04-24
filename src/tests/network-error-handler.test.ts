import { networkErrorHandler, NetworkErrorHandlerOptions } from '../lib/network-error-handler';
import { eventBus } from '../lib/event-bus';

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

describe('NetworkErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    networkErrorHandler.clearLastError();
    networkErrorHandler.setModalOpen(false);
  });
  
  test('should handle a network error', () => {
    const error = new Error('Network connection failed');
    const context = 'test';
    
    networkErrorHandler.handleError(error, context);
    
    // Should set the last error
    expect(networkErrorHandler.getLastError()).toBe(error);
    
    // Should emit events
    expect(eventBus.emit).toHaveBeenCalledWith('networkError', expect.objectContaining({
      error,
      context,
      message: expect.any(String)
    }));
    
    expect(eventBus.emit).toHaveBeenCalledWith('showErrorUI', expect.objectContaining({
      message: expect.any(String),
      context,
      type: 'network',
      timestamp: expect.any(Number)
    }));
  });
  
  test('should handle a network error with custom options', () => {
    const error = new Error('Network connection failed');
    const context = 'test';
    const options: NetworkErrorHandlerOptions = {
      showErrorUI: false,
      logErrors: true,
      emitEvents: false
    };
    
    networkErrorHandler.handleError(error, context, options);
    
    // Should set the last error
    expect(networkErrorHandler.getLastError()).toBe(error);
    
    // Should not emit events
    expect(eventBus.emit).not.toHaveBeenCalledWith('networkError', expect.anything());
    expect(eventBus.emit).not.toHaveBeenCalledWith('showErrorUI', expect.anything());
  });
  
  test('should not show error UI if modal is already open', () => {
    const error = new Error('Network connection failed');
    const context = 'test';
    
    // Set modal open
    networkErrorHandler.setModalOpen(true);
    
    // Add a listener
    const listener = jest.fn();
    networkErrorHandler.addListener(listener);
    
    networkErrorHandler.handleError(error, context);
    
    // Should set the last error
    expect(networkErrorHandler.getLastError()).toBe(error);
    
    // Should emit networkError event
    expect(eventBus.emit).toHaveBeenCalledWith('networkError', expect.anything());
    
    // Should not emit showErrorUI event
    expect(eventBus.emit).not.toHaveBeenCalledWith('showErrorUI', expect.anything());
    
    // Should not call listener
    expect(listener).not.toHaveBeenCalled();
  });
  
  test('should detect network errors', () => {
    // Network errors
    expect(networkErrorHandler.isNetworkError(new Error('Network connection failed'))).toBe(true);
    expect(networkErrorHandler.isNetworkError(new Error('Failed to fetch'))).toBe(true);
    expect(networkErrorHandler.isNetworkError(new Error('Connection timeout'))).toBe(true);
    expect(networkErrorHandler.isNetworkError(new Error('CORS error'))).toBe(true);
    
    // Non-network errors
    expect(networkErrorHandler.isNetworkError(new Error('Invalid input'))).toBe(false);
    expect(networkErrorHandler.isNetworkError(new Error('Calculation error'))).toBe(false);
    expect(networkErrorHandler.isNetworkError(new Error('User not found'))).toBe(false);
    
    // Non-error objects
    expect(networkErrorHandler.isNetworkError('Network error')).toBe(false);
    expect(networkErrorHandler.isNetworkError(null)).toBe(false);
    expect(networkErrorHandler.isNetworkError(undefined)).toBe(false);
  });
  
  test('should format network error messages', () => {
    // Exchange-specific messages
    expect(networkErrorHandler.formatNetworkErrorMessage(new Error('Binance API error'))).toContain('Binance');
    expect(networkErrorHandler.formatNetworkErrorMessage(new Error('BitMart connection failed'))).toContain('BitMart');
    expect(networkErrorHandler.formatNetworkErrorMessage(new Error('Bybit API error'))).toContain('Bybit');
    
    // Error type-specific messages
    expect(networkErrorHandler.formatNetworkErrorMessage(new Error('Connection timeout'))).toContain('timed out');
    expect(networkErrorHandler.formatNetworkErrorMessage(new Error('CORS error'))).toContain('CORS');
    expect(networkErrorHandler.formatNetworkErrorMessage(new Error('SSL certificate error'))).toContain('SSL/TLS');
    expect(networkErrorHandler.formatNetworkErrorMessage(new Error('Rate limit exceeded'))).toContain('Rate limit');
    
    // Default message
    expect(networkErrorHandler.formatNetworkErrorMessage(new Error('Unknown error'))).toContain('Network connection');
  });
  
  test('should add and remove listeners', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    
    // Add listeners
    networkErrorHandler.addListener(listener1);
    networkErrorHandler.addListener(listener2);
    
    // Trigger an error
    const error = new Error('Network error');
    networkErrorHandler.handleError(error);
    
    // Both listeners should be called
    expect(listener1).toHaveBeenCalledWith(error);
    expect(listener2).toHaveBeenCalledWith(error);
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Remove one listener
    networkErrorHandler.removeListener(listener1);
    
    // Trigger another error
    const error2 = new Error('Another network error');
    networkErrorHandler.handleError(error2);
    
    // Only listener2 should be called
    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledWith(error2);
  });
});
