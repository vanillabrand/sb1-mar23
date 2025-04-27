const axios = require('axios');
const querystring = require('querystring');

// Exchange API base URLs
const EXCHANGE_URLS = {
  binance: 'https://api.binance.com',
  binanceTestnet: 'https://testnet.binance.vision',
  binanceFuturesTestnet: 'https://testnet.binancefuture.com',
  coinbase: 'https://api.exchange.coinbase.com',
  coinbaseSandbox: 'https://api-public.sandbox.exchange.coinbase.com',
  kraken: 'https://api.kraken.com',
  krakenFutures: 'https://futures.kraken.com',
  bitfinex: 'https://api.bitfinex.com',
  bitfinexTestnet: 'https://api-pub.bitfinex.com',
  kucoin: 'https://api.kucoin.com',
  kucoinSandbox: 'https://openapi-sandbox.kucoin.com',
  bybit: 'https://api.bybit.com',
  bybitTestnet: 'https://api-testnet.bybit.com',
  deepseek: 'https://api.deepseek.com'
};

// API keys from environment variables
const API_KEYS = {
  binanceTestnet: process.env.VITE_BINANCE_TESTNET_API_KEY,
  binanceTestnetSecret: process.env.VITE_BINANCE_TESTNET_API_SECRET,
  binanceFuturesTestnet: process.env.VITE_BINANCE_FUTURES_TESTNET_API_KEY,
  binanceFuturesTestnetSecret: process.env.VITE_BINANCE_FUTURES_TESTNET_API_SECRET,
  deepseek: process.env.VITE_DEEPSEEK_API_KEY
};

exports.handler = async function(event, context) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey, X-API-KEY, API-Key, ACCESS-KEY, api-key, Api-Key, api_key, apikey, key, OK-ACCESS-KEY, ok-access-key, OK-ACCESS-SIGN, ok-access-sign, OK-ACCESS-TIMESTAMP, ok-access-timestamp, OK-ACCESS-PASSPHRASE, ok-access-passphrase, CB-ACCESS-KEY, cb-access-key, CB-ACCESS-SIGN, cb-access-sign, CB-ACCESS-TIMESTAMP, cb-access-timestamp, CB-ACCESS-PASSPHRASE, cb-access-passphrase, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign, api-sign, API-Sign, KC-API-KEY, KC-API-SIGN, KC-API-TIMESTAMP, KC-API-PASSPHRASE, kc-api-key, kc-api-sign, kc-api-timestamp, kc-api-passphrase, X-BM-KEY, X-BM-SIGN, X-BM-TIMESTAMP, *',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  try {
    // Parse the path to determine which API to call
    const path = event.path.replace('/.netlify/functions/proxy', '');
    const pathParts = path.split('/').filter(part => part);
    
    if (pathParts.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid API path' })
      };
    }

    // The first part of the path is the API name
    const apiName = pathParts[0];
    
    // The rest of the path is the API endpoint
    const apiPath = '/' + pathParts.slice(1).join('/');
    
    // Get the base URL for the API
    let baseUrl;
    let apiKey;
    let apiSecret;
    
    if (apiName === 'binanceTestnet') {
      baseUrl = EXCHANGE_URLS.binanceTestnet;
      apiKey = API_KEYS.binanceTestnet;
      apiSecret = API_KEYS.binanceTestnetSecret;
    } else if (apiName === 'binanceFuturesTestnet') {
      baseUrl = EXCHANGE_URLS.binanceFuturesTestnet;
      apiKey = API_KEYS.binanceFuturesTestnet;
      apiSecret = API_KEYS.binanceFuturesTestnetSecret;
    } else if (apiName === 'deepseek') {
      baseUrl = EXCHANGE_URLS.deepseek;
      apiKey = API_KEYS.deepseek;
    } else if (EXCHANGE_URLS[apiName]) {
      baseUrl = EXCHANGE_URLS[apiName];
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Unknown API: ${apiName}` })
      };
    }

    // Build the full URL
    const url = baseUrl + apiPath;
    
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    
    // Set up request options
    const options = {
      method: event.httpMethod,
      url,
      headers: {
        ...event.headers,
        'Content-Type': 'application/json'
      },
      params: queryParams
    };
    
    // Add API key to headers if available
    if (apiKey) {
      if (apiName === 'binanceTestnet' || apiName === 'binanceFuturesTestnet') {
        options.headers['X-MBX-APIKEY'] = apiKey;
      } else if (apiName === 'deepseek') {
        options.headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }
    
    // Add request body if present
    if (event.body) {
      try {
        options.data = JSON.parse(event.body);
      } catch (e) {
        options.data = event.body;
      }
    }
    
    // Make the API request
    const response = await axios(options);
    
    // Return the response
    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Content-Type': response.headers['content-type'] || 'application/json'
      },
      body: typeof response.data === 'object' ? JSON.stringify(response.data) : response.data
    };
  } catch (error) {
    console.error('Proxy error:', error);
    
    // Return error response
    return {
      statusCode: error.response?.status || 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        details: error.response?.data || 'Internal Server Error'
      })
    };
  }
};
