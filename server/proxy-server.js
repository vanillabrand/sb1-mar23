const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const crypto = require('crypto');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PROXY_PORT || 3001;

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'X-MBX-APIKEY', 'x-testnet', 'x-api-key']
}));

// Handle OPTIONS requests for CORS preflight
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-MBX-APIKEY, x-testnet, x-api-key');
  res.sendStatus(200);
});

// Parse JSON request bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Helper function to fix double slashes in paths
const fixDoublePaths = (path) => {
  // Fix double slash issue
  return path.replace(/\/api\/+/g, '/api/');
};

// News API proxy endpoint (legacy endpoint - keep for backward compatibility)
app.get('/api/news', async (req, res) => {
  try {
    // Fix any double slashes in the path
    const fixedPath = fixDoublePaths(req.path);
    console.log(`Original news path: ${req.path}`);
    console.log(`Fixed news path: ${fixedPath}`);

    const { asset, apiKey } = req.query;

    if (!asset || !apiKey) {
      return res.status(400).json({ error: 'Missing required parameters: asset and apiKey' });
    }

    console.log(`Fetching news for asset: ${asset} with API key: ${apiKey.substring(0, 5)}...`);

    // Get the base URL from environment variables or use default
    const baseUrl = process.env.NEWS_API_URL || 'https://data-api.coindesk.com/news/v1/article/list?lang=EN&limit=10';

    // Construct the URL for the Coindesk API
    const url = `${baseUrl}&categories=${encodeURIComponent(asset)}`;
    console.log(`News API URL: ${url}`);

    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');

    // Make the request to the Coindesk API
    const response = await axios.get(url, {
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json'
      }
    });

    console.log(`News API response status: ${response.status}`);
    console.log(`News API response data length: ${response.data ? (Array.isArray(response.data) ? response.data.length : 'Not an array') : 'No data'}`);

    // Return the data from the Coindesk API
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying news request:', error.message);
    console.error('Error details:', error.response ? error.response.data : 'No response data');

    // Return a more detailed error response
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch news data',
      details: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });
  }
});

// Dedicated Coindesk News API proxy endpoint
app.get('/api/coindesk-news', async (req, res) => {
  try {
    // Fix any double slashes in the path
    const fixedPath = fixDoublePaths(req.path);
    console.log(`Original coindesk news path: ${req.path}`);
    console.log(`Fixed coindesk news path: ${fixedPath}`);

    const { asset, apiKey } = req.query;

    if (!asset || !apiKey) {
      return res.status(400).json({ error: 'Missing required parameters: asset and apiKey' });
    }

    console.log(`Fetching Coindesk news for asset: ${asset} with API key: ${apiKey.substring(0, 5)}...`);

    // Get the base URL from environment variables or use default
    const baseUrl = process.env.NEWS_API_URL || 'https://data-api.coindesk.com/v1/news';

    // Construct the URL for the Coindesk API with proper parameters
    const url = new URL(baseUrl);
    url.searchParams.append('lang', 'EN');
    url.searchParams.append('limit', '10');
    url.searchParams.append('sortBy', 'publishedAt');
    url.searchParams.append('tags', encodeURIComponent(asset.toLowerCase()));
    
    console.log(`Coindesk News API URL: ${url.toString()}`);

    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');

    // Make the request to the Coindesk API
    const response = await axios.get(url.toString(), {
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json'
      }
    });

    console.log(`Coindesk News API response status: ${response.status}`);
    console.log(`Coindesk News API response data length: ${response.data ? (Array.isArray(response.data) ? response.data.length : 'Not an array') : 'No data'}`);

    // Return the data from the Coindesk API
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying Coindesk news request:', error.message);
    console.error('Error details:', error.response ? error.response.data : 'No response data');

    // Return a more detailed error response
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch news data from Coindesk API',
      details: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });
  }
});

// Binance API proxy endpoint
app.all('/api/binance/*', async (req, res) => {
  try {
    // Fix any double slashes in the path
    const fixedPath = fixDoublePaths(req.path);
    console.log(`Original path: ${req.path}`);
    console.log(`Fixed path: ${fixedPath}`);

    // Extract the Binance API endpoint from the URL
    const endpoint = fixedPath.replace('/api/binance/', '');
    const isTestnet = req.query.testnet === 'true';

    // Determine the base URL based on whether it's testnet or not
    const baseUrl = isTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';

    console.log(`Proxying request to ${baseUrl}/${endpoint} (TestNet: ${isTestnet})`);
    console.log(`Query params:`, req.query);

    // Set CORS headers to allow the TestNet header
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-MBX-APIKEY, x-testnet');

    // Get API key and secret from request headers
    const apiKey = req.headers['x-mbx-apikey'] || req.query.apiKey;
    const apiSecret = req.headers['x-mbx-apisecret'] || req.query.apiSecret;

    if (!apiKey) {
      return res.status(400).json({ error: 'Missing API key' });
    }

    // Prepare request parameters
    const method = req.method;
    let url = `${baseUrl}/${endpoint}`;
    let data = {};

    // Handle query parameters
    if (method === 'GET' || method === 'DELETE') {
      // For GET and DELETE requests, parameters are in the query string
      const params = { ...req.query };
      delete params.testnet;
      delete params.apiKey;
      delete params.apiSecret;

      // Add timestamp parameter for signed endpoints
      if (apiSecret) {
        params.timestamp = Date.now();

        // Create signature
        const queryString = Object.keys(params)
          .map(key => `${key}=${params[key]}`)
          .join('&');

        const signature = crypto
          .createHmac('sha256', apiSecret)
          .update(queryString)
          .digest('hex');

        params.signature = signature;
      }

      // Append parameters to URL
      const queryString = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');

      if (queryString) {
        url += `?${queryString}`;
      }
    } else {
      // For POST, PUT, etc., parameters are in the request body
      data = { ...req.body };

      // Add timestamp parameter for signed endpoints
      if (apiSecret) {
        data.timestamp = Date.now();

        // Create signature
        const queryString = Object.keys(data)
          .map(key => `${key}=${data[key]}`)
          .join('&');

        const signature = crypto
          .createHmac('sha256', apiSecret)
          .update(queryString)
          .digest('hex');

        data.signature = signature;
      }
    }

    console.log(`Proxying ${method} request to ${url}`);

    // Make the request to the Binance API
    const response = await axios({
      method,
      url,
      data: method !== 'GET' && method !== 'DELETE' ? data : undefined,
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    // Return the data from the Binance API
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying Binance request:', error.message);

    // Return a more detailed error response
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch data from Binance API',
      details: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });
  }
});

// Dedicated Binance TestNet API proxy endpoint
app.all('/api/binanceTestnet/*', async (req, res) => {
  try {
    // Fix any double slashes in the path
    const fixedPath = fixDoublePaths(req.path);
    console.log(`Original path: ${req.path}`);
    console.log(`Fixed path: ${fixedPath}`);

    // Extract the Binance TestNet API endpoint from the URL
    const endpoint = fixedPath.replace('/api/binanceTestnet/', '');

    // Always use TestNet URL
    const baseUrl = 'https://testnet.binance.vision';

    console.log(`Proxying TestNet request to ${baseUrl}/${endpoint}`);
    console.log(`Query params:`, req.query);

    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-MBX-APIKEY');

    // Get API key and secret from request headers or environment variables
    const apiKey = req.headers['x-mbx-apikey'] ||
                  req.query.apiKey ||
                  process.env.VITE_BINANCE_TESTNET_API_KEY ||
                  '6dbf9bc5b8e03455128d00bab9ccaffb33fa812bfcf0b21bcb50cff355a88049';

    const apiSecret = req.headers['x-mbx-apisecret'] ||
                     req.query.apiSecret ||
                     process.env.VITE_BINANCE_TESTNET_API_SECRET ||
                     '4024ffff209db1b0681f8276fb9ba8425ae3883fc15176b622c11e7c4c8d53df';

    // Prepare request parameters
    const method = req.method;
    let url = `${baseUrl}/${endpoint}`;
    let data = {};

    // Handle query parameters
    if (method === 'GET' || method === 'DELETE') {
      // For GET and DELETE requests, parameters are in the query string
      const params = { ...req.query };
      delete params.apiKey;
      delete params.apiSecret;

      // Add timestamp parameter for signed endpoints
      if (apiSecret) {
        params.timestamp = Date.now();

        // Create signature
        const queryString = Object.keys(params)
          .map(key => `${key}=${params[key]}`)
          .join('&');

        const signature = crypto
          .createHmac('sha256', apiSecret)
          .update(queryString)
          .digest('hex');

        params.signature = signature;
      }

      // Append parameters to URL
      const queryString = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');

      if (queryString) {
        url += `?${queryString}`;
      }
    } else {
      // For POST, PUT, etc., parameters are in the request body
      data = { ...req.body };

      // Add timestamp parameter for signed endpoints
      if (apiSecret) {
        data.timestamp = Date.now();

        // Create signature
        const queryString = Object.keys(data)
          .map(key => `${key}=${data[key]}`)
          .join('&');

        const signature = crypto
          .createHmac('sha256', apiSecret)
          .update(queryString)
          .digest('hex');

        data.signature = signature;
      }
    }

    console.log(`Proxying ${method} request to ${url}`);

    // Make the request to the Binance TestNet API
    const response = await axios({
      method,
      url,
      data: method !== 'GET' && method !== 'DELETE' ? data : undefined,
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    // Return the data from the Binance TestNet API
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying Binance TestNet request:', error.message);

    // Return a more detailed error response
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch data from Binance TestNet API',
      details: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
