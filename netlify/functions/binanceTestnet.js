const axios = require('axios');
const crypto = require('crypto');

exports.handler = async function(event, context) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MBX-APIKEY',
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
    // Get the API key and secret from environment variables
    const apiKey = process.env.VITE_BINANCE_TESTNET_API_KEY;
    const apiSecret = process.env.VITE_BINANCE_TESTNET_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Binance TestNet API credentials not configured' })
      };
    }

    // Parse the path to get the Binance API endpoint
    const path = event.path.replace('/.netlify/functions/binanceTestnet', '');
    
    // Build the full URL
    const baseUrl = 'https://testnet.binance.vision';
    const url = baseUrl + path;
    
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    
    // Add timestamp for signed endpoints
    const needsSignature = !path.includes('/api/v3/ping') && 
                          !path.includes('/api/v3/time') && 
                          !path.includes('/api/v3/exchangeInfo');
    
    if (needsSignature) {
      queryParams.timestamp = Date.now();
      
      // Create the signature
      const queryString = Object.keys(queryParams)
        .map(key => `${key}=${queryParams[key]}`)
        .join('&');
      
      const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');
      
      queryParams.signature = signature;
    }
    
    // Set up request options
    const options = {
      method: event.httpMethod,
      url,
      headers: {
        'Content-Type': 'application/json',
        'X-MBX-APIKEY': apiKey
      },
      params: queryParams
    };
    
    // Add request body if present
    if (event.body && (event.httpMethod === 'POST' || event.httpMethod === 'PUT')) {
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
    console.error('Binance TestNet API error:', error);
    
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
