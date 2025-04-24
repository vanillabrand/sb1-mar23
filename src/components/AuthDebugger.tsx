import React, { useState, useEffect } from 'react';
import { checkAuthStatus, testTableAccess } from '../lib/auth-debug';
import { supabase } from '../lib/supabase';

export function AuthDebugger() {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [tableTestResult, setTableTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tableToTest, setTableToTest] = useState('strategy_budgets');

  const checkAuth = async () => {
    setLoading(true);
    try {
      const status = await checkAuthStatus();
      setAuthStatus(status);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthStatus({ authenticated: false, error });
    } finally {
      setLoading(false);
    }
  };

  const testTable = async () => {
    setLoading(true);
    try {
      const result = await testTableAccess(tableToTest);
      setTableTestResult(result);
    } catch (error) {
      console.error(`Error testing table ${tableToTest}:`, error);
      setTableTestResult({ success: false, error });
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Error refreshing session:', error);
        setAuthStatus({ authenticated: false, error });
      } else {
        console.log('Session refreshed:', data);
        await checkAuth();
      }
    } catch (error) {
      console.error('Exception refreshing session:', error);
      setAuthStatus({ authenticated: false, error });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <div className="bg-gunmetal-900 p-4 rounded-lg border border-gunmetal-700 shadow-lg">
      <h2 className="text-lg font-semibold text-neon-turquoise mb-4">Authentication Debugger</h2>
      
      <div className="mb-4">
        <h3 className="text-md font-medium text-white mb-2">Authentication Status</h3>
        {loading ? (
          <div className="animate-pulse text-gray-400">Loading...</div>
        ) : (
          <div className="bg-gunmetal-800 p-3 rounded-md">
            <div className="flex items-center mb-2">
              <div className={`w-3 h-3 rounded-full mr-2 ${authStatus?.authenticated ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium">
                {authStatus?.authenticated ? 'Authenticated' : 'Not Authenticated'}
              </span>
            </div>
            {authStatus?.user && (
              <div className="text-xs text-gray-300 mb-2">
                <div>User ID: {authStatus.user.id}</div>
                <div>Email: {authStatus.user.email}</div>
                {authStatus.session && (
                  <div>Session expires: {new Date(authStatus.session.expires_at * 1000).toLocaleString()}</div>
                )}
              </div>
            )}
            {authStatus?.error && (
              <div className="text-xs text-red-400 mt-1">
                Error: {typeof authStatus.error === 'string' ? authStatus.error : JSON.stringify(authStatus.error)}
              </div>
            )}
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <button 
            onClick={checkAuth}
            className="px-3 py-1 bg-neon-turquoise text-gunmetal-950 rounded-md text-xs font-medium"
            disabled={loading}
          >
            Check Auth Status
          </button>
          <button 
            onClick={refreshSession}
            className="px-3 py-1 bg-neon-yellow text-gunmetal-950 rounded-md text-xs font-medium"
            disabled={loading}
          >
            Refresh Session
          </button>
        </div>
      </div>
      
      <div className="mb-4">
        <h3 className="text-md font-medium text-white mb-2">Test Table Access</h3>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={tableToTest}
            onChange={(e) => setTableToTest(e.target.value)}
            className="flex-1 bg-gunmetal-800 border border-gunmetal-700 rounded-md px-3 py-1 text-sm text-white"
            placeholder="Table name"
          />
          <button 
            onClick={testTable}
            className="px-3 py-1 bg-neon-turquoise text-gunmetal-950 rounded-md text-xs font-medium"
            disabled={loading}
          >
            Test Access
          </button>
        </div>
        {tableTestResult && (
          <div className="bg-gunmetal-800 p-3 rounded-md">
            <div className="flex items-center mb-2">
              <div className={`w-3 h-3 rounded-full mr-2 ${tableTestResult.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium">
                {tableTestResult.success ? 'Access Successful' : 'Access Failed'}
              </span>
            </div>
            {tableTestResult.data && (
              <div className="text-xs text-gray-300 mb-2">
                Rows returned: {tableTestResult.data.length}
              </div>
            )}
            {tableTestResult.error && (
              <div className="text-xs text-red-400 mt-1">
                Error: {typeof tableTestResult.error === 'string' ? tableTestResult.error : JSON.stringify(tableTestResult.error)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
