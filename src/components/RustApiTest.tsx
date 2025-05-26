import React, { useState, useEffect } from 'react';
import { rustApiIntegration } from '../lib/rust-api-integration';
import { ApiTestPanel } from './ApiTestPanel';
import { useRustApi } from './RustApiProvider';

export const RustApiTest: React.FC = () => {
  const { isConnected, health } = useRustApi();
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [marketData, setMarketData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testHealthCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const health = await rustApiIntegration.checkHealth();
      setHealthStatus(health);
      console.log('✅ Rust API Health Check:', health);
    } catch (err) {
      setError(`Health check failed: ${err}`);
      console.error('❌ Health check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const testMarketData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await rustApiIntegration.getMarketData('BTC-USDT');
      setMarketData(data);
      console.log('✅ Rust API Market Data:', data);
    } catch (err) {
      setError(`Market data failed: ${err}`);
      console.error('❌ Market data failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-test on component mount
    testHealthCheck();
  }, []);

  return (
    <div className="p-6 space-y-6 bg-black min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Comprehensive API Test Panel */}
        <ApiTestPanel />

        {/* Legacy Test Panel */}
        <div style={{
          padding: '20px',
          border: '2px solid #333',
          borderRadius: '8px',
          backgroundColor: '#1a1a1a',
          color: '#fff'
        }}>
          <h2>🦀 Legacy Rust API Integration Test</h2>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={testHealthCheck}
          disabled={loading}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Testing...' : 'Test Health Check'}
        </button>

        <button
          onClick={testMarketData}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Testing...' : 'Test Market Data'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#f44336',
          color: 'white',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          ❌ Error: {error}
        </div>
      )}

      {healthStatus && (
        <div style={{ marginBottom: '20px' }}>
          <h3>✅ Health Check Result:</h3>
          <pre style={{
            backgroundColor: '#2a2a2a',
            padding: '10px',
            borderRadius: '4px',
            overflow: 'auto'
          }}>
            {JSON.stringify(healthStatus, null, 2)}
          </pre>
        </div>
      )}

      {marketData && (
        <div style={{ marginBottom: '20px' }}>
          <h3>📊 Market Data Result:</h3>
          <pre style={{
            backgroundColor: '#2a2a2a',
            padding: '10px',
            borderRadius: '4px',
            overflow: 'auto'
          }}>
            {JSON.stringify(marketData, null, 2)}
          </pre>
        </div>
      )}

      <div style={{
        fontSize: '12px',
        color: '#888',
        marginTop: '20px',
        padding: '10px',
        backgroundColor: '#2a2a2a',
        borderRadius: '4px'
      }}>
        <strong>Integration Status:</strong><br/>
        • Rust API URL: http://localhost:3000<br/>
        • Frontend: http://localhost:5173<br/>
        • Health Check: {healthStatus ? '✅ Working' : '⏳ Pending'}<br/>
        • Market Data: {marketData ? '✅ Working' : '⏳ Pending'}
      </div>
        </div>
      </div>
    </div>
  );
};
