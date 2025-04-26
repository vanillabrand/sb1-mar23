import React, { useState } from 'react';
import { logService } from '../lib/log-service';
import { config } from '../lib/config';

/**
 * Component for testing the Kraken Direct API
 */
const KrakenApiTest: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [apiSecret, setApiSecret] = useState<string>('');
  const [method, setMethod] = useState<string>('getServerTime');
  const [params, setParams] = useState<string>('{}');

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(params);
      } catch (parseError) {
        setError('Invalid JSON parameters');
        setLoading(false);
        return;
      }

      // Determine if this is a public or private API call
      const isPrivate = method.startsWith('get') &&
        ['AccountBalance', 'TradeBalance', 'OpenOrders', 'ClosedOrders', 'QueryOrders', 'TradesHistory'].some(
          privateMethod => method.includes(privateMethod)
        );

      // Map method names to API endpoints
      const methodToEndpoint = {
        getServerTime: 'public/Time',
        getAssetInfo: 'public/Assets',
        getAssetPairs: 'public/AssetPairs',
        getTicker: 'public/Ticker',
        getOHLC: 'public/OHLC',
        getOrderBook: 'public/Depth',
        getRecentTrades: 'public/Trades',
        getAccountBalance: 'private/Balance',
        getTradeBalance: 'private/TradeBalance',
        getOpenOrders: 'private/OpenOrders',
        getClosedOrders: 'private/ClosedOrders',
        queryOrdersInfo: 'private/QueryOrders',
        getTradesHistory: 'private/TradesHistory',
        addOrder: 'private/AddOrder',
        cancelOrder: 'private/CancelOrder',
        cancelAllOrders: 'private/CancelAll'
      };

      const endpoint = methodToEndpoint[method];
      if (!endpoint) {
        setError(`Unsupported method: ${method}`);
        setLoading(false);
        return;
      }

      // Construct the URL
      const baseUrl = config.getFullUrl('/api/kraken-direct');
      const url = `${baseUrl}/${endpoint}`;

      // Set up request options
      const options: RequestInit = {
        method: isPrivate ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // Add API key and secret for private API calls
      if (isPrivate) {
        if (!apiKey || !apiSecret) {
          setError('API key and secret are required for private API calls');
          setLoading(false);
          return;
        }

        // For private API calls, we need to use a more secure approach
        // The API secret should be stored securely in the user's exchange configuration
        // and not sent directly in the request

        // In a production environment, we would use a secure token or session-based approach
        // For this demo, we'll still send the API key and secret, but with a warning

        logService.log('warn', 'Sending API secret in request headers - this is not secure for production use', null, 'KrakenApiTest');

        options.headers = {
          ...options.headers,
          'API-Key': apiKey,
          'API-Secret': apiSecret
        };

        // Add body for POST requests
        options.body = JSON.stringify(parsedParams);
      } else {
        // Add query parameters for GET requests
        const queryParams = new URLSearchParams();
        Object.entries(parsedParams).forEach(([key, value]) => {
          queryParams.append(key, String(value));
        });

        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`;
        }
      }

      // Make the request
      const response = await fetch(url, options);
      const data = await response.json();

      // Check for errors
      if (data.error && data.error.length > 0) {
        throw new Error(`Kraken API error: ${data.error.join(', ')}`);
      }

      setResult(data.result || data);
      logService.log('info', `Kraken API test successful: ${method}`, { response: data }, 'KrakenApiTest');
    } catch (error) {
      setError(error.message || 'Unknown error');
      logService.log('error', `Kraken API test failed: ${method}`, error, 'KrakenApiTest');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-white">Kraken API Test</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">API Key (for private methods)</label>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600"
          placeholder="Enter API Key"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">API Secret (for private methods)</label>
        <input
          type="password"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600"
          placeholder="Enter API Secret"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">Method</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600"
        >
          <optgroup label="Public Methods">
            <option value="getServerTime">Get Server Time</option>
            <option value="getAssetInfo">Get Asset Info</option>
            <option value="getAssetPairs">Get Asset Pairs</option>
            <option value="getTicker">Get Ticker</option>
            <option value="getOHLC">Get OHLC</option>
            <option value="getOrderBook">Get Order Book</option>
            <option value="getRecentTrades">Get Recent Trades</option>
          </optgroup>
          <optgroup label="Private Methods">
            <option value="getAccountBalance">Get Account Balance</option>
            <option value="getTradeBalance">Get Trade Balance</option>
            <option value="getOpenOrders">Get Open Orders</option>
          </optgroup>
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">Parameters (JSON)</label>
        <textarea
          value={params}
          onChange={(e) => setParams(e.target.value)}
          className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 font-mono"
          rows={5}
          placeholder='{"pairs": "XBTUSDT"}'
        />
      </div>

      <button
        onClick={handleTest}
        disabled={loading}
        className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test API'}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-900 text-white rounded">
          <h3 className="font-bold">Error</h3>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-4">
          <h3 className="font-bold text-white">Result</h3>
          <pre className="p-3 bg-gray-900 text-green-400 rounded overflow-auto max-h-96 font-mono text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default KrakenApiTest;
