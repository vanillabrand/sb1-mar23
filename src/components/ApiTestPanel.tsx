import React, { useState } from 'react';
import { useRustApi } from './RustApiProvider';
import { apiClient } from '../lib/api-client';
import { logService } from '../lib/log-service';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export function ApiTestPanel() {
  const { isConnected, health, testEndpoints, testResults } = useRustApi();
  const { user, signIn } = useAuth();
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [manualTestResults, setManualTestResults] = useState<any>(null);
  const [authTestResults, setAuthTestResults] = useState<any>(null);

  const testAuthentication = async () => {
    try {
      console.log('🔍 Testing authentication...');
      const results: any = {};

      // Test 1: Check current session
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        results.currentSession = { session: !!session, user: session?.user?.id, error };
        console.log('✅ Current session check:', results.currentSession);
      } catch (err) {
        results.currentSession = { error: err instanceof Error ? err.message : 'Unknown error' };
        console.error('❌ Current session check failed:', err);
      }

      // Test 2: Test API client with current auth
      try {
        const strategies = await apiClient.getStrategies();
        results.authenticatedApiCall = { success: true, strategiesCount: strategies.length };
        console.log('✅ Authenticated API call passed:', results.authenticatedApiCall);
      } catch (err) {
        results.authenticatedApiCall = { error: err instanceof Error ? err.message : 'Unknown error' };
        console.error('❌ Authenticated API call failed:', err);
      }

      // Test 3: Sign in with test user if not authenticated
      if (!user) {
        try {
          await signIn('test@example.com', 'testpassword123');
          results.testUserSignIn = { success: true };
          console.log('✅ Test user sign in passed');
        } catch (err) {
          results.testUserSignIn = { error: err instanceof Error ? err.message : 'Unknown error' };
          console.error('❌ Test user sign in failed:', err);
        }
      } else {
        results.testUserSignIn = { alreadyAuthenticated: true, userId: user.id };
      }

      setAuthTestResults(results);
      logService.log('info', 'Authentication tests completed', results, 'ApiTestPanel');
    } catch (err) {
      console.error('❌ Authentication tests failed:', err);
      setAuthTestResults({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const runManualTests = async () => {
    setIsRunningTests(true);
    setManualTestResults(null);

    try {
      const results: any = {};

      // Test 1: Health Check
      console.log('🔍 Testing health endpoint...');
      try {
        results.health = await apiClient.checkHealth();
        console.log('✅ Health check passed:', results.health);
      } catch (err) {
        results.health = { error: err instanceof Error ? err.message : 'Unknown error' };
        console.error('❌ Health check failed:', err);
      }

      // Test 2: Get Strategies
      console.log('🔍 Testing strategies endpoint...');
      try {
        results.strategies = await apiClient.getStrategies();
        console.log('✅ Get strategies passed:', results.strategies);
      } catch (err) {
        results.strategies = { error: err instanceof Error ? err.message : 'Unknown error' };
        console.error('❌ Get strategies failed:', err);
      }

      // Test 3: Get Trades
      console.log('🔍 Testing trades endpoint...');
      try {
        results.trades = await apiClient.getTrades();
        console.log('✅ Get trades passed:', results.trades);
      } catch (err) {
        results.trades = { error: err instanceof Error ? err.message : 'Unknown error' };
        console.error('❌ Get trades failed:', err);
      }

      // Test 4: Create Strategy
      console.log('🔍 Testing create strategy endpoint...');
      try {
        const testStrategy = {
          name: 'Manual Test Strategy',
          description: 'Test strategy created by manual API test',
          type: 'scalping',
          risk_level: 'low',
          budget: 50.0,
          selected_pairs: ['ETH-USDT'],
          market_type: 'spot'
        };
        results.createStrategy = await apiClient.createStrategy(testStrategy);
        console.log('✅ Create strategy passed:', results.createStrategy);

        // Test 5: Update Strategy
        if (results.createStrategy && results.createStrategy.id) {
          console.log('🔍 Testing update strategy endpoint...');
          try {
            const updates = {
              name: 'Updated Manual Test Strategy',
              description: 'Updated test strategy',
              risk_level: 'medium',
              budget: 75.0
            };
            results.updateStrategy = await apiClient.updateStrategy(results.createStrategy.id, updates);
            console.log('✅ Update strategy passed:', results.updateStrategy);
          } catch (err) {
            results.updateStrategy = { error: err instanceof Error ? err.message : 'Unknown error' };
            console.error('❌ Update strategy failed:', err);
          }

          // Test 6: Get Single Strategy
          console.log('🔍 Testing get single strategy endpoint...');
          try {
            results.getSingleStrategy = await apiClient.getStrategy(results.createStrategy.id);
            console.log('✅ Get single strategy passed:', results.getSingleStrategy);
          } catch (err) {
            results.getSingleStrategy = { error: err instanceof Error ? err.message : 'Unknown error' };
            console.error('❌ Get single strategy failed:', err);
          }

          // Clean up - delete the test strategy
          console.log('🧹 Cleaning up test strategy...');
          try {
            await apiClient.deleteStrategy(results.createStrategy.id);
            console.log('✅ Test strategy cleaned up successfully');
            results.cleanup = { success: true };
          } catch (cleanupErr) {
            console.warn('⚠️ Failed to clean up test strategy:', cleanupErr);
            results.cleanup = { error: cleanupErr instanceof Error ? cleanupErr.message : 'Unknown error' };
          }
        }
      } catch (err) {
        results.createStrategy = { error: err instanceof Error ? err.message : 'Unknown error' };
        console.error('❌ Create strategy failed:', err);
      }

      setManualTestResults(results);
      logService.log('info', 'Manual API tests completed', results, 'ApiTestPanel');
    } catch (err) {
      console.error('❌ Manual API tests failed:', err);
      setManualTestResults({ error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsRunningTests(false);
    }
  };

  const renderTestResult = (label: string, result: any) => {
    if (!result) return null;

    const hasError = result.error;
    const isArray = Array.isArray(result);
    const isObject = typeof result === 'object' && !isArray;

    return (
      <div className="mb-4 p-3 bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2 h-2 rounded-full ${hasError ? 'bg-red-500' : 'bg-green-500'}`}></span>
          <span className="font-medium text-white">{label}</span>
        </div>
        <div className="text-sm text-gray-300 bg-gray-900 p-2 rounded overflow-auto max-h-32">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-900 rounded-lg">
      <h2 className="text-xl font-bold text-white mb-4">🧪 Rust API Integration Test</h2>

      {/* Connection Status */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">Connection Status</h3>
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {health && (
          <div className="text-sm text-gray-400">
            <div>Service: {health.service || 'Unknown'}</div>
            <div>Status: {health.status || 'Unknown'}</div>
            <div>Version: {health.version || 'Unknown'}</div>
            <div>Timestamp: {new Date(health.timestamp * 1000).toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Authentication Status */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">Authentication Status</h3>
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-3 h-3 rounded-full ${user ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className={user ? 'text-green-400' : 'text-red-400'}>
            {user ? 'Authenticated' : 'Not Authenticated'}
          </span>
        </div>
        {user && (
          <div className="text-sm text-gray-400">
            <div>User ID: {user.id}</div>
            <div>Email: {user.email}</div>
            <div>Created: {new Date(user.created_at).toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Test Controls */}
      <div className="mb-6 flex gap-4 flex-wrap">
        <button
          onClick={testAuthentication}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Test Authentication
        </button>
        <button
          onClick={testEndpoints}
          disabled={!isConnected}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          Run Provider Tests
        </button>
        <button
          onClick={runManualTests}
          disabled={!isConnected || isRunningTests}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {isRunningTests ? 'Running Tests...' : 'Run Manual Tests'}
        </button>
      </div>

      {/* Authentication Test Results */}
      {authTestResults && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Authentication Test Results</h3>
          {renderTestResult('Current Session', authTestResults.currentSession)}
          {renderTestResult('Authenticated API Call', authTestResults.authenticatedApiCall)}
          {renderTestResult('Test User Sign In', authTestResults.testUserSignIn)}
        </div>
      )}

      {/* Provider Test Results */}
      {testResults && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Provider Test Results</h3>
          {renderTestResult('Health Check', testResults.health)}
          {renderTestResult('Get Strategies', testResults.strategies)}
          {renderTestResult('Get Trades', testResults.trades)}
          {renderTestResult('Create Strategy', testResults.createStrategy)}
        </div>
      )}

      {/* Manual Test Results */}
      {manualTestResults && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Manual Test Results</h3>
          {renderTestResult('Health Check', manualTestResults.health)}
          {renderTestResult('Get Strategies', manualTestResults.strategies)}
          {renderTestResult('Get Trades', manualTestResults.trades)}
          {renderTestResult('Create Strategy', manualTestResults.createStrategy)}
          {renderTestResult('Update Strategy', manualTestResults.updateStrategy)}
          {renderTestResult('Get Single Strategy', manualTestResults.getSingleStrategy)}
          {renderTestResult('Cleanup', manualTestResults.cleanup)}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">Instructions</h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Ensure the Rust API is running on localhost:3000</li>
          <li>• Check browser console for detailed logs</li>
          <li>• Provider tests use the RustApiProvider context</li>
          <li>• Manual tests directly call the API client</li>
          <li>• All tests include cleanup to avoid data pollution</li>
        </ul>
      </div>
    </div>
  );
}
