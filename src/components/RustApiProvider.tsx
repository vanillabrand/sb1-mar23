import React, { createContext, useContext, useEffect, useState } from 'react';
import { rustApiService } from '../lib/rust-api-service';
import { apiClient } from '../lib/api-client';
import { logService } from '../lib/log-service';

interface RustApiContextType {
  isConnected: boolean;
  isInitializing: boolean;
  error: string | null;
  reconnect: () => Promise<void>;
  health: any;
  testEndpoints: () => Promise<void>;
  testResults: any;
}

const RustApiContext = createContext<RustApiContextType>({
  isConnected: false,
  isInitializing: true,
  error: null,
  reconnect: async () => {},
  health: null,
  testEndpoints: async () => {},
  testResults: null
});

export const useRustApi = () => {
  const context = useContext(RustApiContext);
  if (!context) {
    throw new Error('useRustApi must be used within a RustApiProvider');
  }
  return context;
};

interface RustApiProviderProps {
  children: React.ReactNode;
}

export function RustApiProvider({ children }: RustApiProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);

  const initializeApi = async () => {
    try {
      setIsInitializing(true);
      setError(null);

      logService.log('info', 'Initializing Rust API connection...', null, 'RustApiProvider');

      // Initialize the API client first
      await apiClient.initialize();

      // Check health
      const healthCheck = await apiClient.checkHealth();
      setHealth(healthCheck);

      if (healthCheck.status === 'ok') {
        // Initialize the Rust API service
        const success = await rustApiService.initialize();

        if (success) {
          setIsConnected(true);
          setError(null);
          logService.log('info', 'Rust API connected successfully', healthCheck, 'RustApiProvider');
        } else {
          setIsConnected(false);
          setError('Failed to initialize Rust API service');
          logService.log('warn', 'Rust API service initialization failed', null, 'RustApiProvider');
        }
      } else {
        setIsConnected(false);
        setError('Rust API health check failed');
        logService.log('warn', 'Rust API health check failed', healthCheck, 'RustApiProvider');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setIsConnected(false);
      setError(errorMessage);
      logService.log('error', 'Failed to connect to Rust API', err, 'RustApiProvider');
    } finally {
      setIsInitializing(false);
    }
  };

  const reconnect = async () => {
    await initializeApi();
  };

  const testEndpoints = async () => {
    try {
      logService.log('info', 'Testing Rust API endpoints...', null, 'RustApiProvider');
      const results: any = {};

      // Test health endpoint
      try {
        results.health = await apiClient.checkHealth();
        logService.log('info', 'Health endpoint test passed', results.health, 'RustApiProvider');
      } catch (err) {
        results.health = { error: err instanceof Error ? err.message : 'Unknown error' };
        logService.log('error', 'Health endpoint test failed', err, 'RustApiProvider');
      }

      // Test strategies endpoint
      try {
        results.strategies = await apiClient.getStrategies();
        logService.log('info', 'Strategies endpoint test passed', results.strategies, 'RustApiProvider');
      } catch (err) {
        results.strategies = { error: err instanceof Error ? err.message : 'Unknown error' };
        logService.log('error', 'Strategies endpoint test failed', err, 'RustApiProvider');
      }

      // Test trades endpoint
      try {
        results.trades = await apiClient.getTrades();
        logService.log('info', 'Trades endpoint test passed', results.trades, 'RustApiProvider');
      } catch (err) {
        results.trades = { error: err instanceof Error ? err.message : 'Unknown error' };
        logService.log('error', 'Trades endpoint test failed', err, 'RustApiProvider');
      }

      // Test create strategy endpoint
      try {
        const testStrategy = {
          name: 'API Test Strategy',
          description: 'Test strategy created by API integration test',
          type: 'scalping',
          risk_level: 'low',
          budget: 100.0,
          selected_pairs: ['BTC-USDT'],
          market_type: 'spot'
        };
        results.createStrategy = await apiClient.createStrategy(testStrategy);
        logService.log('info', 'Create strategy endpoint test passed', results.createStrategy, 'RustApiProvider');

        // Clean up - delete the test strategy
        if (results.createStrategy && results.createStrategy.id) {
          try {
            await apiClient.deleteStrategy(results.createStrategy.id);
            logService.log('info', 'Test strategy cleaned up successfully', null, 'RustApiProvider');
          } catch (cleanupErr) {
            logService.log('warn', 'Failed to clean up test strategy', cleanupErr, 'RustApiProvider');
          }
        }
      } catch (err) {
        results.createStrategy = { error: err instanceof Error ? err.message : 'Unknown error' };
        logService.log('error', 'Create strategy endpoint test failed', err, 'RustApiProvider');
      }

      setTestResults(results);
      logService.log('info', 'API endpoint testing completed', results, 'RustApiProvider');
    } catch (err) {
      logService.log('error', 'API endpoint testing failed', err, 'RustApiProvider');
      setTestResults({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  useEffect(() => {
    // Initialize on mount
    initializeApi();

    // Set up periodic health checks
    const healthCheckInterval = setInterval(async () => {
      if (isConnected) {
        try {
          const healthCheck = await apiClient.checkHealth();
          setHealth(healthCheck);

          if (healthCheck.status !== 'ok') {
            setIsConnected(false);
            setError('API health check failed');
            logService.log('warn', 'Rust API health check failed during periodic check', healthCheck, 'RustApiProvider');
          }
        } catch (err) {
          setIsConnected(false);
          setError('Health check failed');
          logService.log('error', 'Periodic health check failed', err, 'RustApiProvider');
        }
      }
    }, 30000); // Check every 30 seconds

    return () => {
      clearInterval(healthCheckInterval);
    };
  }, [isConnected]);

  const contextValue: RustApiContextType = {
    isConnected,
    isInitializing,
    error,
    reconnect,
    health,
    testEndpoints,
    testResults
  };

  return (
    <RustApiContext.Provider value={contextValue}>
      {children}
    </RustApiContext.Provider>
  );
}

// Component to display API status
export function RustApiStatus() {
  const { isConnected, isInitializing, error, reconnect, health } = useRustApi();

  if (isInitializing) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        <span>Connecting to API...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <span className="text-red-400">API Offline</span>
        <button
          onClick={reconnect}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-green-400">API Connected</span>
        {health && (
          <span className="text-xs text-gray-500">
            ({new Date(health.timestamp).toLocaleTimeString()})
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
      <span>API Status Unknown</span>
    </div>
  );
}

// Hook for components that require API connection
export function useRequireApi() {
  const { isConnected, isInitializing, error } = useRustApi();

  return {
    isReady: isConnected && !isInitializing,
    isLoading: isInitializing,
    hasError: !!error,
    error
  };
}

// Higher-order component that requires API connection
export function withRustApi<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error?: string }>
) {
  return function WrappedComponent(props: P) {
    const { isReady, isLoading, hasError, error } = useRequireApi();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-neon-turquoise border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Connecting to trading API...</p>
          </div>
        </div>
      );
    }

    if (hasError && fallback) {
      const FallbackComponent = fallback;
      return <FallbackComponent error={error} />;
    }

    if (!isReady) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-red-400 mb-4">⚠️ API Connection Required</div>
            <p className="text-gray-400 mb-4">
              This feature requires connection to the trading API.
            </p>
            <p className="text-sm text-gray-500">
              {error || 'Please check your connection and try again.'}
            </p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
