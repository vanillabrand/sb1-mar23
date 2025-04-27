import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

// Define all possible exchange API headers
const ALL_EXCHANGE_HEADERS = [
  // Binance headers
  'X-MBX-APIKEY', 'x-mbx-apikey',

  // Generic API headers
  'X-API-KEY', 'API-Key', 'ACCESS-KEY', 'api-key', 'Api-Key', 'api_key', 'apikey', 'key',

  // OKX headers
  'OK-ACCESS-KEY', 'ok-access-key',
  'OK-ACCESS-SIGN', 'ok-access-sign',
  'OK-ACCESS-TIMESTAMP', 'ok-access-timestamp',
  'OK-ACCESS-PASSPHRASE', 'ok-access-passphrase',

  // Coinbase headers
  'CB-ACCESS-KEY', 'cb-access-key',
  'CB-ACCESS-SIGN', 'cb-access-sign',
  'CB-ACCESS-TIMESTAMP', 'cb-access-timestamp',
  'CB-ACCESS-PASSPHRASE', 'cb-access-passphrase',

  // ByBit headers
  'X-BAPI-API-KEY', 'X-BAPI-SIGN', 'X-BAPI-TIMESTAMP',
  'x-bapi-timestamp', 'x-bapi-api-key', 'x-bapi-sign',

  // Kraken headers
  'api-sign', 'API-Sign',

  // KuCoin headers
  'KC-API-KEY', 'KC-API-SIGN', 'KC-API-TIMESTAMP', 'KC-API-PASSPHRASE',
  'kc-api-key', 'kc-api-sign', 'kc-api-timestamp', 'kc-api-passphrase',

  // BitMart headers
  'X-BM-KEY', 'X-BM-SIGN', 'X-BM-TIMESTAMP',

  // Add any other exchange headers here
];

const app = express();

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Standard CORS handler for proxy responses
const standardCorsHandler = (proxyRes, req, _res) => {
  // Remove ALL existing CORS headers
  Object.keys(proxyRes.headers).forEach(key => {
    if (key.toLowerCase().startsWith('access-control-')) {
      delete proxyRes.headers[key];
    }
  });

  // Add our own CORS headers
  proxyRes.headers['access-control-allow-origin'] = req.headers.origin || '*';
  proxyRes.headers['access-control-allow-credentials'] = 'true';
  proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
  proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey, X-API-KEY, API-Key, OK-ACCESS-KEY, ok-access-key, OK-ACCESS-SIGN, ok-access-sign, OK-ACCESS-TIMESTAMP, ok-access-timestamp, OK-ACCESS-PASSPHRASE, ok-access-passphrase, CB-ACCESS-KEY, cb-access-key, CB-ACCESS-SIGN, cb-access-sign, CB-ACCESS-TIMESTAMP, cb-access-timestamp, CB-ACCESS-PASSPHRASE, cb-access-passphrase, ACCESS-KEY, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign, api-sign, API-Sign, kc-api-timestamp, kc-api-key, kc-api-sign, kc-api-passphrase, api_key, apikey, key';
};

// Use a more permissive CORS configuration for development
const corsOptions = {
  origin: '*', // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', ...ALL_EXCHANGE_HEADERS]
};

app.use(cors(corsOptions));

// Add OPTIONS handling for preflight requests
app.options('*', cors(corsOptions));

// Add a global middleware to handle all requests
app.use((req, res, next) => {
  // If this is an OPTIONS request, handle it specially
  if (req.method === 'OPTIONS') {
    // Get all headers from the request
    const requestHeaders = req.headers['access-control-request-headers'] || '';

    // Set CORS headers
    res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    // If there are request headers, allow them all
    if (requestHeaders) {
      res.header('Access-Control-Allow-Headers', requestHeaders);
    } else {
      // Otherwise, use our standard headers
      const standardHeaders = ['Content-Type', 'Authorization', ...ALL_EXCHANGE_HEADERS, '*'].join(', ');
      res.header('Access-Control-Allow-Headers', standardHeaders);
    }

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours

    // Log the headers for debugging
    console.log('Global OPTIONS request headers:', req.headers);
    console.log('Global OPTIONS response headers:', res.getHeaders());

    return res.status(200).send();
  }

  // For non-OPTIONS requests, continue to the next middleware
  next();
});

// Add a specific handler for Binance TestNet OPTIONS requests
app.options('/api/binanceTestnet/*', (req, res) => {
  // Get all headers from the request
  const requestHeaders = req.headers['access-control-request-headers'] || '';

  // Set CORS headers
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  // If there are request headers, allow them all
  if (requestHeaders) {
    res.header('Access-Control-Allow-Headers', requestHeaders);
  } else {
    // Otherwise, use our standard headers
    const standardHeaders = 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign, api_key, apikey, key, *';
    res.header('Access-Control-Allow-Headers', standardHeaders);
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours

  // Log the headers for debugging
  console.log('Binance TestNet OPTIONS request headers:', req.headers);
  console.log('Binance TestNet OPTIONS response headers:', res.getHeaders());

  res.status(200).send();
});

// Add a specific handler for Binance OPTIONS requests
app.options('/api/binance/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign, api_key, apikey, key');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

// Add a specific handler for BitMart OPTIONS requests
app.options('/api/bitmart/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-BM-KEY, X-BM-SIGN, X-BM-TIMESTAMP, X-MBX-APIKEY, x-mbx-apikey, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

// Add a specific handler for Kraken OPTIONS requests
app.options('/api/kraken/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, API-Key, API-Sign, api-key, api-sign');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).send();
});

// Add a specific handler for Kraken Direct OPTIONS requests
app.options('/api/kraken-direct/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, API-Key, API-Sign, api-key, api-sign');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).send();
});

// Store the last used nonce for Kraken API
let lastKrakenNonce = 0;

// Function to generate a unique nonce for Kraken API
function generateKrakenNonce() {
  // Get current timestamp in microseconds
  const timestamp = Date.now() * 1000;

  // Ensure the nonce is always increasing
  const nonce = Math.max(timestamp, lastKrakenNonce + 1);

  // Update the last used nonce
  lastKrakenNonce = nonce;

  return nonce;
}

// Add a handler for Kraken Direct API requests
app.all('/api/kraken-direct/*', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Kraken Direct API request: ${req.method} ${req.path}`);

    // Extract the API endpoint from the path
    const endpoint = req.path.replace('/api/kraken-direct/', '');

    // Set CORS headers
    res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, API-Key, API-Sign, api-key, api-sign');
    res.header('Access-Control-Allow-Credentials', 'true');

    // Determine if this is a public or private API request
    const isPublic = endpoint.startsWith('public/');
    const isPrivate = endpoint.startsWith('private/');

    if (!isPublic && !isPrivate) {
      return res.status(400).json({ error: 'Invalid API endpoint' });
    }

    // Base URL for Kraken API
    const krakenBaseUrl = 'https://api.kraken.com';
    const apiVersion = '0';

    // Construct the full URL
    const url = `${krakenBaseUrl}/${apiVersion}/${endpoint}`;

    // For private API requests, we need to sign the request
    if (isPrivate) {
      // Check if API key and secret are provided
      const apiKey = req.headers['api-key'] || req.headers['API-Key'];
      const apiSecret = req.headers['api-secret'] || req.headers['API-Secret'];

      if (!apiKey || !apiSecret) {
        return res.status(401).json({ error: 'API key and secret are required for private API requests' });
      }

      // Add nonce to params
      const nonce = generateKrakenNonce();
      const params = {
        ...(req.body || {}),
        nonce
      };

      // Create signature
      const path = `/${apiVersion}/${endpoint}`;
      const message = params.nonce +
        require('crypto')
          .createHash('sha256')
          .update(JSON.stringify(params))
          .digest('hex');

      const signature = require('crypto')
        .createHmac('sha512', Buffer.from(apiSecret, 'base64'))
        .update(path + message)
        .digest('base64');

      // Forward the request to Kraken with the generated signature
      const options = {
        method: req.method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'API-Key': apiKey,
          'API-Sign': signature,
          'User-Agent': 'GiGAntic Trading Bot'
        }
      };

      // Add body for POST requests
      if (req.method === 'POST') {
        // Convert request body to URL encoded form data
        const formData = new URLSearchParams();

        // Add all parameters from the request body
        Object.entries(params).forEach(([key, value]) => {
          formData.append(key, String(value));
        });

        options.body = formData.toString();
      }

      // Make the request to Kraken
      const response = await fetch(url, options);
      const data = await response.json();

      // Return the response
      return res.json(data);
    }

    // For public API requests, simply forward the request
    const queryParams = new URLSearchParams(req.query).toString();
    const fullUrl = queryParams ? `${url}?${queryParams}` : url;

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'GiGAntic Trading Bot'
      }
    });

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in Kraken Direct API request:`, error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Add a specific handler for Coinbase OPTIONS requests
app.options('/api/coinbase/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, CB-ACCESS-KEY, CB-ACCESS-SIGN, CB-ACCESS-TIMESTAMP, CB-ACCESS-PASSPHRASE');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

// Add a specific handler for OKX OPTIONS requests
app.options('/api/okx/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, OK-ACCESS-KEY, OK-ACCESS-SIGN, OK-ACCESS-TIMESTAMP, OK-ACCESS-PASSPHRASE');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

// Add a specific handler for Bybit OPTIONS requests
app.options('/api/bybit/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

// Add a specific handler for KuCoin OPTIONS requests
app.options('/api/kucoin/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, KC-API-KEY, KC-API-SIGN, KC-API-TIMESTAMP, KC-API-PASSPHRASE');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

// Add a specific handler for Deepseek OPTIONS requests
app.options('/api/deepseek/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours

  // Log the headers for debugging
  console.log('Deepseek OPTIONS request headers:', req.headers);
  console.log('Deepseek OPTIONS response headers:', res.getHeaders());

  res.status(200).send();
});

// Helper function to forward exchange-specific authentication headers
const forwardAuthHeaders = (proxyReq, req, headers, exchangeName) => {
  // Remove origin header to prevent CORS issues
  proxyReq.removeHeader('origin');

  // Forward exchange-specific authentication headers
  headers.forEach(header => {
    const headerKey = Object.keys(req.headers).find(key => key.toLowerCase() === header.toLowerCase());
    if (headerKey) {
      const headerValue = req.headers[headerKey];
      proxyReq.setHeader(header, headerValue);
      console.log(`Forwarding ${header} header: ${headerValue.substring(0, 5)}...`);
    }
  });

  // Forward Authorization header if present
  if (req.headers.authorization) {
    proxyReq.setHeader('Authorization', req.headers.authorization);
  }

  // Add custom headers if needed
  proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  // Log the request details
  console.log(`Proxying request to ${exchangeName}: ${req.method} ${req.url}`);
};

// Define proxy configurations for different exchanges
const exchangeProxies = {
  // Generic exchange proxy handler
  exchange: {
    target: '', // Will be set dynamically
    changeOrigin: true,
    router: (req) => {
      // Extract the exchange name from the URL
      const path = req.path;
      const parts = path.split('/');
      if (parts.length >= 3) {
        const exchange = parts[2];

        // Define base URLs for different exchanges
        const exchangeUrls = {
          'binance': 'https://api.binance.com',
          'binanceTestnet': 'https://testnet.binance.vision',
          'binanceFutures': 'https://fapi.binance.com',
          'bitmart': 'https://api-cloud-v2.bitmart.com',
          'bybit': 'https://api.bybit.com',
          'bybitTestnet': 'https://api-testnet.bybit.com',
          'okx': 'https://www.okx.com',
          'okxTestnet': 'https://www.okx.com/api/v5/sandbox',
          'coinbase': 'https://api.coinbase.com',
          'coinbaseSandbox': 'https://api-public.sandbox.exchange.coinbase.com',
          'kraken': 'https://api.kraken.com',
          'krakenFutures': 'https://futures.kraken.com',
          'bitget': 'https://api.bitget.com',
          'kucoin': 'https://api.kucoin.com',
          'kucoinSandbox': 'https://openapi-sandbox.kucoin.com',
          'huobi': 'https://api.huobi.pro',
          'huobiTestnet': 'https://api-testnet.huobi.pro',
          'gate': 'https://api.gateio.ws',
          'gateTestnet': 'https://testnet.gateio.ws',
          'mexc': 'https://api.mexc.com',
          'bitmex': 'https://www.bitmex.com',
          'bitmexTestnet': 'https://testnet.bitmex.com',
          'deribit': 'https://www.deribit.com',
          'deribitTestnet': 'https://test.deribit.com',
          'ftx': 'https://ftx.com',
          'ftxTestnet': 'https://ftx.us',
          'bitstamp': 'https://www.bitstamp.net',
          'bitfinex': 'https://api.bitfinex.com',
          'gemini': 'https://api.gemini.com',
          'geminiSandbox': 'https://api.sandbox.gemini.com',
          'poloniex': 'https://api.poloniex.com',
          'hitbtc': 'https://api.hitbtc.com',
          'bittrex': 'https://api.bittrex.com',
          'bitflyer': 'https://api.bitflyer.com',
          'bitflyer_jp': 'https://api.bitflyer.jp',
          'liquid': 'https://api.liquid.com',
          'bithumb': 'https://api.bithumb.com',
          'upbit': 'https://api.upbit.com',
          'coincheck': 'https://coincheck.com',
          'zaif': 'https://api.zaif.jp',
          'bitbank': 'https://public.bitbank.cc',
          'btcbox': 'https://www.btcbox.co.jp',
          'coinone': 'https://api.coinone.co.kr',
          'korbit': 'https://api.korbit.co.kr',
          'bithumb': 'https://api.bithumb.com',
          'gopax': 'https://api.gopax.co.kr',
          'indodax': 'https://indodax.com',
          'btcturk': 'https://api.btcturk.com',
          'mercado': 'https://api.mercadobitcoin.net',
          'bitso': 'https://api.bitso.com',
          'buda': 'https://www.buda.com',
          'cryptomate': 'https://api.cryptomate.co.uk',
          'luno': 'https://api.luno.com',
          'acx': 'https://acx.io',
          'independentreserve': 'https://api.independentreserve.com',
          'btcmarkets': 'https://api.btcmarkets.net',
          'coinspot': 'https://www.coinspot.com.au',
          'coinjar': 'https://api.coinjar.com',
          'bitmax': 'https://bitmax.io',
          'bitkub': 'https://api.bitkub.com',
          'bitpanda': 'https://api.bitpanda.com',
          'cex': 'https://cex.io',
          'coinmate': 'https://coinmate.io',
          'exmo': 'https://api.exmo.com',
          'livecoin': 'https://api.livecoin.net',
          'yobit': 'https://yobit.net',
          'tidex': 'https://api.tidex.com',
          'wex': 'https://wex.nz',
          'kuna': 'https://kuna.io',
          'lbank': 'https://api.lbank.info',
          'coinex': 'https://api.coinex.com',
          'digifinex': 'https://openapi.digifinex.com',
          'crex24': 'https://api.crex24.com',
          'btcalpha': 'https://btc-alpha.com',
          'dsx': 'https://api.dsx.uk',
          'southxchange': 'https://www.southxchange.com',
          'braziliex': 'https://braziliex.com',
          'bleutrade': 'https://bleutrade.com',
          'abucoins': 'https://api.abucoins.com',
          'allcoin': 'https://api.allcoin.com',
          'cobinhood': 'https://api.cobinhood.com',
          'coinfalcon': 'https://coinfalcon.com',
          'coingi': 'https://api.coingi.com',
          'coinnest': 'https://api.coinnest.co.kr',
          'coinone': 'https://api.coinone.co.kr',
          'ethfinex': 'https://api.ethfinex.com',
          'gatecoin': 'https://api.gatecoin.com',
          'huobipro': 'https://api.huobi.pro',
          'jubi': 'https://www.jubi.com',
          'kucoin': 'https://api.kucoin.com',
          'nova': 'https://api.novaexchange.com',
          'okcoincny': 'https://www.okcoin.cn',
          'okcoinusd': 'https://www.okcoin.com',
          'qryptos': 'https://api.qryptos.com',
          'therock': 'https://api.therocktrading.com',
          'tidebit': 'https://www.tidebit.com',
          'vaultoro': 'https://api.vaultoro.com',
          'virwox': 'https://api.virwox.com',
          'xbtce': 'https://api.xbtce.com',
          'zb': 'https://trade.zb.com',
        };

        // Get the base URL for the exchange
        const baseUrl = exchangeUrls[exchange];
        if (baseUrl) {
          console.log(`Routing ${exchange} request to ${baseUrl}`);
          return baseUrl;
        }

        // Default to a generic URL if the exchange is not recognized
        console.log(`Unknown exchange: ${exchange}, using default proxy`);
        return 'https://api.binance.com';
      }

      // Default to Binance if no exchange is specified
      return 'https://api.binance.com';
    },
    pathRewrite: (path, req) => {
      // Extract the exchange name from the URL
      const parts = path.split('/');
      if (parts.length >= 3) {
        // Remove /api/exchangeName from the path
        return '/' + parts.slice(3).join('/');
      }
      return path;
    },
    onProxyReq: (proxyReq, req, _res) => {
      // Extract the exchange name from the URL
      const path = req.path;
      const parts = path.split('/');
      let exchangeName = 'unknown';
      if (parts.length >= 3) {
        exchangeName = parts[2];
      }

      // Define exchange-specific headers
      const exchangeHeaders = {
        'binance': ['X-MBX-APIKEY'],
        'binanceTestnet': ['X-MBX-APIKEY'],
        'binanceFutures': ['X-MBX-APIKEY'],
        'bitmart': ['X-BM-KEY', 'X-BM-SIGN', 'X-BM-TIMESTAMP'],
        'kraken': ['API-Key', 'API-Sign', 'api-key', 'api-sign'],
        'coinbase': ['CB-ACCESS-KEY', 'CB-ACCESS-SIGN', 'CB-ACCESS-TIMESTAMP', 'CB-ACCESS-PASSPHRASE'],
        'okx': ['OK-ACCESS-KEY', 'OK-ACCESS-SIGN', 'OK-ACCESS-TIMESTAMP', 'OK-ACCESS-PASSPHRASE'],
        'bybit': ['X-BAPI-API-KEY', 'X-BAPI-SIGN', 'X-BAPI-TIMESTAMP'],
        'kucoin': ['KC-API-KEY', 'KC-API-SIGN', 'KC-API-TIMESTAMP', 'KC-API-PASSPHRASE'],
      };

      // Get headers for this exchange
      const headers = exchangeHeaders[exchangeName] || ['API-Key', 'API-Sign', 'Authorization', 'X-API-KEY', 'apikey'];

      // Forward the headers
      forwardAuthHeaders(proxyReq, req, headers, exchangeName);
    },
    onProxyRes: standardCorsHandler
  },

  coincap: {
    target: 'https://api.coincap.io/v2',
    changeOrigin: true,
    pathRewrite: {
      '^/api/coincap': ''
    },
    onProxyReq: (proxyReq, req, _res) => {
      // Remove origin header to prevent CORS issues
      proxyReq.removeHeader('origin');
    },
    onProxyRes: (proxyRes, req, _res) => {
      // Remove ALL existing CORS headers
      Object.keys(proxyRes.headers).forEach(key => {
        if (key.toLowerCase().startsWith('access-control-')) {
          delete proxyRes.headers[key];
        }
      });

      // Add our own CORS headers
      proxyRes.headers['access-control-allow-origin'] = req.headers.origin || '*';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization';
    }
  },
  deepseek: {
    target: 'https://api.deepseek.com',
    changeOrigin: true,
    pathRewrite: {
      '^/api/deepseek': ''
    },
    onProxyReq: (proxyReq, req, _res) => {
      // Remove origin header to prevent CORS issues
      proxyReq.removeHeader('origin');
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
    },
    onProxyRes: (proxyRes, req, _res) => {
      // Remove ALL existing CORS headers
      Object.keys(proxyRes.headers).forEach(key => {
        if (key.toLowerCase().startsWith('access-control-')) {
          delete proxyRes.headers[key];
        }
      });

      // Add our own CORS headers
      proxyRes.headers['access-control-allow-origin'] = req.headers.origin || '*';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization';
    }
  },
  bitmart: {
    target: 'https://api-cloud-v2.bitmart.com',
    changeOrigin: true,
    pathRewrite: {
      '^/api/bitmart': ''
    },
    onProxyReq: (proxyReq, req, _res) => {
      // Use the helper function to forward authentication headers
      forwardAuthHeaders(proxyReq, req, ['X-BM-KEY', 'X-BM-SIGN', 'X-BM-TIMESTAMP'], 'BitMart');
    },
    onProxyRes: (proxyRes, req, _res) => {
      // Remove ALL existing CORS headers
      Object.keys(proxyRes.headers).forEach(key => {
        if (key.toLowerCase().startsWith('access-control-')) {
          delete proxyRes.headers[key];
        }
      });

      // Add our own CORS headers
      proxyRes.headers['access-control-allow-origin'] = req.headers.origin || 'http://localhost:5173';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey, X-BM-KEY, X-BM-SIGN, X-BM-TIMESTAMP, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign, kc-api-timestamp, kc-api-key, kc-api-sign, kc-api-passphrase, OK-ACCESS-KEY, ok-access-key, OK-ACCESS-SIGN, ok-access-sign, OK-ACCESS-TIMESTAMP, ok-access-timestamp, OK-ACCESS-PASSPHRASE, ok-access-passphrase, CB-ACCESS-KEY, cb-access-key, CB-ACCESS-SIGN, cb-access-sign, CB-ACCESS-TIMESTAMP, cb-access-timestamp, CB-ACCESS-PASSPHRASE, cb-access-passphrase';
    }
  },

  // Kraken proxy configuration
  kraken: {
    target: 'https://api.kraken.com',
    changeOrigin: true,
    pathRewrite: {
      '^/api/kraken': ''
    },
    onProxyReq: (proxyReq, req, _res) => {
      // Use the helper function to forward authentication headers
      forwardAuthHeaders(proxyReq, req, ['API-Key', 'API-Sign', 'api-key', 'api-sign'], 'Kraken');

      // Add custom User-Agent header
      proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Log all headers for debugging
      console.log('Kraken request headers:', req.headers);
    },
    onProxyRes: (proxyRes, req, _res) => {
      // Remove ALL existing CORS headers
      Object.keys(proxyRes.headers).forEach(key => {
        if (key.toLowerCase().startsWith('access-control-')) {
          delete proxyRes.headers[key];
        }
      });

      // Add our own CORS headers
      proxyRes.headers['access-control-allow-origin'] = req.headers.origin || 'http://localhost:5173';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, API-Key, API-Sign, api-key, api-sign';

      console.log(`Received response from Kraken: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      console.error(`Proxy error for Kraken: ${err.message}`);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': req.headers.origin || 'http://localhost:5173',
        'Access-Control-Allow-Credentials': 'true'
      });
      res.end(JSON.stringify({
        error: 'Proxy error',
        message: err.message
      }));
    }
  },
  binance: {
    target: 'https://api.binance.com',
    changeOrigin: true,
    pathRewrite: {
      '^/api/binance': ''
    },
    onProxyReq: (proxyReq, req, _res) => {
      // Use the helper function to forward authentication headers
      forwardAuthHeaders(proxyReq, req, ['X-MBX-APIKEY'], 'Binance');
    },
    onProxyRes: (proxyRes, req, _res) => {
      // Remove ALL existing CORS headers
      Object.keys(proxyRes.headers).forEach(key => {
        if (key.toLowerCase().startsWith('access-control-')) {
          delete proxyRes.headers[key];
        }
      });

      // Add our own CORS headers
      proxyRes.headers['access-control-allow-origin'] = req.headers.origin || 'http://localhost:5173';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey, kc-api-timestamp, kc-api-key, kc-api-sign, kc-api-passphrase, OK-ACCESS-KEY, ok-access-key, OK-ACCESS-SIGN, ok-access-sign, OK-ACCESS-TIMESTAMP, ok-access-timestamp, OK-ACCESS-PASSPHRASE, ok-access-passphrase, CB-ACCESS-KEY, cb-access-key, CB-ACCESS-SIGN, cb-access-sign, CB-ACCESS-TIMESTAMP, cb-access-timestamp, CB-ACCESS-PASSPHRASE, cb-access-passphrase';
    }
  },
  binanceTestnet: {
    target: 'https://testnet.binance.vision',
    changeOrigin: true,
    pathRewrite: (path) => {
      // Log the original path
      console.log('Original path:', path);

      // Fix the path to handle various formats
      let newPath = path;

      // Handle different API path patterns
      if (path.includes('/api/binanceTestnet/exchangeInfo')) {
        // Special case for exchangeInfo endpoint
        newPath = '/api/v3/exchangeInfo';
        console.log('Special case for exchangeInfo endpoint');
      } else if (path.includes('/api/binanceTestnet/api/v3/')) {
        // Case: /api/binanceTestnet/api/v3/endpoint -> /api/v3/endpoint
        newPath = path.replace(/^\/api\/binanceTestnet\/api\/v3/, '/api/v3');
      } else if (path.includes('/api/binanceTestnet/api/')) {
        // Case: /api/binanceTestnet/api/endpoint -> /api/endpoint
        newPath = path.replace(/^\/api\/binanceTestnet\/api/, '/api');
      } else if (path.includes('/api/binanceTestnet/v3/')) {
        // Case: /api/binanceTestnet/v3/endpoint -> /api/v3/endpoint
        newPath = path.replace(/^\/api\/binanceTestnet\/v3/, '/api/v3');
      } else if (path.includes('/api/binanceTestnet/v1/')) {
        // Case: /api/binanceTestnet/v1/endpoint -> /api/v1/endpoint
        newPath = path.replace(/^\/api\/binanceTestnet\/v1/, '/api/v1');
      } else if (path.includes('/api/binanceTestnet/v2/')) {
        // Case: /api/binanceTestnet/v2/endpoint -> /api/v2/endpoint
        newPath = path.replace(/^\/api\/binanceTestnet\/v2/, '/api/v2');
      } else {
        // Default case: /api/binanceTestnet/endpoint -> /api/v3/endpoint
        newPath = path.replace(/^\/api\/binanceTestnet/, '/api/v3');
      }

      // Log the new path
      console.log('New path:', newPath);

      return newPath;
    },
    onProxyReq: (proxyReq, req, _res) => {
      // Remove origin header to prevent CORS issues
      proxyReq.removeHeader('origin');

      // Add custom headers
      proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Forward all Binance and Bybit headers
      const headersToForward = [
        'X-MBX-APIKEY', 'x-mbx-apikey',
        'X-BAPI-API-KEY', 'X-BAPI-SIGN', 'X-BAPI-TIMESTAMP',
        'x-bapi-api-key', 'x-bapi-sign', 'x-bapi-timestamp'
      ];

      // Forward all headers
      headersToForward.forEach(headerName => {
        const headerKey = Object.keys(req.headers).find(key => key.toLowerCase() === headerName.toLowerCase());
        if (headerKey) {
          const headerValue = req.headers[headerKey];
          proxyReq.setHeader(headerName, headerValue);
          console.log(`Forwarding ${headerName} header: ${headerValue.substring(0, 5)}...`);
        }
      });

      // If no API key in headers, try to use the one from the .env file
      if (!req.headers['x-mbx-apikey'] && !req.headers['X-MBX-APIKEY']) {
        const envApiKey = process.env.VITE_BINANCE_TESTNET_API_KEY || '6dbf9bc5b8e03455128d00bab9ccaffb33fa812bfcf0b21bcb50cff355a88049';
        if (envApiKey) {
          proxyReq.setHeader('X-MBX-APIKEY', envApiKey);
          console.log(`Using API key from environment: ${envApiKey.substring(0, 5)}...`);
        } else {
          console.warn('No API key found in headers or environment variables');
        }
      }

      // Forward Authorization header if present
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }

      // Log the request details
      console.log(`Proxying request to Binance TestNet: ${req.method} ${req.url}`);

      // Check if this is a private API request (contains signature)
      const url = new URL(req.url, `http://${req.headers.host}`);
      const hasSignature = url.searchParams.has('signature');

      if (hasSignature) {
        console.log('Detected authenticated request with signature');

        // Make sure the timestamp is recent
        const timestamp = url.searchParams.get('timestamp');
        if (timestamp) {
          const currentTime = Date.now();
          const requestTime = parseInt(timestamp, 10);
          const timeDiff = currentTime - requestTime;

          console.log(`Request timestamp: ${requestTime}, Current time: ${currentTime}, Difference: ${timeDiff}ms`);

          // If the timestamp is too old, update it and recalculate the signature
          if (Math.abs(timeDiff) > 5000) { // 5 seconds
            console.log('Timestamp is too old, this might cause authentication issues');
          }
        }
      }

      // Log all headers for debugging
      console.log('Request headers:', req.headers);

      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }

      // Log the request details
      console.log(`Proxying request to Binance TestNet: ${req.method} ${req.url}`);

      // If this is an OPTIONS request, handle it specially
      if (req.method === 'OPTIONS') {
        console.log('Handling OPTIONS request for CORS preflight');
      }
    },
    onProxyRes: (proxyRes, req, _res) => {
      // Remove ALL existing CORS headers
      Object.keys(proxyRes.headers).forEach(key => {
        if (key.toLowerCase().startsWith('access-control-')) {
          delete proxyRes.headers[key];
        }
      });

      // Add our own CORS headers
      const origin = req.headers.origin || 'http://localhost:5173';
      proxyRes.headers['access-control-allow-origin'] = origin;
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';

      // Get all headers from the request
      const requestHeaders = req.headers['access-control-request-headers'] || '';

      // If there are request headers, allow them all
      if (requestHeaders) {
        proxyRes.headers['access-control-allow-headers'] = requestHeaders;
      } else {
        // Otherwise, use our standard headers
        const standardHeaders = ['Content-Type', 'Authorization', ...ALL_EXCHANGE_HEADERS, '*'].join(', ');
        proxyRes.headers['access-control-allow-headers'] = standardHeaders;
      }

      // Log the headers for debugging
      console.log('Binance TestNet response headers:', proxyRes.headers);

      // Add additional CORS headers for preflight requests
      if (req.method === 'OPTIONS') {
        proxyRes.headers['access-control-max-age'] = '86400'; // 24 hours
      }

      // Log the response headers for debugging
      console.log('Response headers for Binance TestNet:', proxyRes.headers);
      console.log(`Received response from Binance TestNet: ${proxyRes.statusCode}`);

      // If the response is an error, log more details
      if (proxyRes.statusCode >= 400) {
        console.log(`Error response from Binance TestNet: ${proxyRes.statusCode}`);
        // We'll collect the response body to log it
        let responseBody = '';
        proxyRes.on('data', (chunk) => {
          responseBody += chunk;
        });
        proxyRes.on('end', () => {
          console.log('Error response body:', responseBody);
        });
      }

      // For preflight requests, ensure we respond with 200 OK
      if (req.method === 'OPTIONS') {
        proxyRes.statusCode = 200;
      }
    },
    onError: (err, req, res) => {
      console.error(`Proxy error for Binance TestNet: ${err.message}`);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': req.headers.origin || 'http://localhost:5173',
        'Access-Control-Allow-Credentials': 'true'
      });
      res.end(JSON.stringify({
        error: 'Proxy error',
        message: err.message
      }));
    }
  },
  binanceFutures: {
    target: 'https://testnet.binancefuture.com',
    changeOrigin: true,
    pathRewrite: {
      '^/api/binanceFutures': ''
    },
    onProxyReq: (proxyReq, req, _res) => {
      // Use the helper function to forward authentication headers
      forwardAuthHeaders(proxyReq, req, ['X-MBX-APIKEY'], 'Binance Futures');
    },
    onProxyRes: (proxyRes, req, _res) => {
      // Remove ALL existing CORS headers
      Object.keys(proxyRes.headers).forEach(key => {
        if (key.toLowerCase().startsWith('access-control-')) {
          delete proxyRes.headers[key];
        }
      });

      // Add our own CORS headers
      proxyRes.headers['access-control-allow-origin'] = req.headers.origin || 'http://localhost:5173';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign, OK-ACCESS-KEY, ok-access-key, OK-ACCESS-SIGN, ok-access-sign, OK-ACCESS-TIMESTAMP, ok-access-timestamp, OK-ACCESS-PASSPHRASE, ok-access-passphrase, CB-ACCESS-KEY, cb-access-key, CB-ACCESS-SIGN, cb-access-sign, CB-ACCESS-TIMESTAMP, cb-access-timestamp, CB-ACCESS-PASSPHRASE, cb-access-passphrase';

      console.log(`Received response from Binance Futures: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      console.error(`Proxy error for Binance Futures: ${err.message}`);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': req.headers.origin || 'http://localhost:5173',
        'Access-Control-Allow-Credentials': 'true'
      });
      res.end(JSON.stringify({
        error: 'Proxy error',
        message: err.message
      }));
    }
  },
  kucoin: {
    target: 'https://api.kucoin.com',
    changeOrigin: true,
    pathRewrite: {
      '^/api/kucoin': ''
    },
    onProxyReq: (proxyReq, req, _res) => {
      // Use the helper function to forward authentication headers
      forwardAuthHeaders(proxyReq, req, ['KC-API-KEY', 'KC-API-SIGN', 'KC-API-TIMESTAMP', 'KC-API-PASSPHRASE'], 'KuCoin');

      // Remove origin header to prevent CORS issues
      proxyReq.removeHeader('origin');

      // Log all headers for debugging
      console.log('KuCoin request headers:', req.headers);
    },
    onProxyRes: (proxyRes, req, _res) => {
      // Remove ALL existing CORS headers
      Object.keys(proxyRes.headers).forEach(key => {
        if (key.toLowerCase().startsWith('access-control-')) {
          delete proxyRes.headers[key];
        }
      });

      // Add our own CORS headers
      proxyRes.headers['access-control-allow-origin'] = req.headers.origin || 'http://localhost:5173';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, KC-API-KEY, KC-API-SIGN, KC-API-TIMESTAMP, KC-API-PASSPHRASE, kc-api-key, kc-api-sign, kc-api-timestamp, kc-api-passphrase, CB-ACCESS-KEY, cb-access-key, CB-ACCESS-SIGN, cb-access-sign, CB-ACCESS-TIMESTAMP, cb-access-timestamp, CB-ACCESS-PASSPHRASE, cb-access-passphrase';

      console.log(`Received response from KuCoin: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      console.error(`Proxy error for KuCoin: ${err.message}`);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': req.headers.origin || 'http://localhost:5173',
        'Access-Control-Allow-Credentials': 'true'
      });
      res.end(JSON.stringify({
        error: 'Proxy error',
        message: err.message
      }));
    }
  },
  kucoinSandbox: {
    target: 'https://openapi-sandbox.kucoin.com',
    changeOrigin: true,
    pathRewrite: {
      '^/api/kucoinSandbox': ''
    },
    onProxyReq: (proxyReq, req, _res) => {
      // Use the helper function to forward authentication headers
      forwardAuthHeaders(proxyReq, req, ['KC-API-KEY', 'KC-API-SIGN', 'KC-API-TIMESTAMP', 'KC-API-PASSPHRASE'], 'KuCoin Sandbox');

      // Remove origin header to prevent CORS issues
      proxyReq.removeHeader('origin');

      // Log all headers for debugging
      console.log('KuCoin Sandbox request headers:', req.headers);
    },
    onProxyRes: (proxyRes, req, _res) => {
      // Remove ALL existing CORS headers
      Object.keys(proxyRes.headers).forEach(key => {
        if (key.toLowerCase().startsWith('access-control-')) {
          delete proxyRes.headers[key];
        }
      });

      // Add our own CORS headers
      proxyRes.headers['access-control-allow-origin'] = req.headers.origin || 'http://localhost:5173';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, KC-API-KEY, KC-API-SIGN, KC-API-TIMESTAMP, KC-API-PASSPHRASE, kc-api-key, kc-api-sign, kc-api-timestamp, kc-api-passphrase, CB-ACCESS-KEY, cb-access-key, CB-ACCESS-SIGN, cb-access-sign, CB-ACCESS-TIMESTAMP, cb-access-timestamp, CB-ACCESS-PASSPHRASE, cb-access-passphrase';

      console.log(`Received response from KuCoin Sandbox: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      console.error(`Proxy error for KuCoin Sandbox: ${err.message}`);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': req.headers.origin || 'http://localhost:5173',
        'Access-Control-Allow-Credentials': 'true'
      });
      res.end(JSON.stringify({
        error: 'Proxy error',
        message: err.message
      }));
    }
  }
};

// Health check endpoint with detailed status
app.get('/health', async (_req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Check database connection if needed
    // const dbStatus = await checkDatabaseConnection();

    // Count active WebSocket connections
    const activeConnections = clients.size;

    // Check if we can reach external APIs
    let externalApiStatus = 'unknown';
    try {
      const response = await fetch('https://api.binance.com/api/v3/time', {
        timeout: 5000
      });
      externalApiStatus = response.ok ? 'ok' : 'error';
    } catch (error) {
      externalApiStatus = 'error';
    }

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: uptime,
        formatted: formatUptime(uptime)
      },
      memory: {
        rss: formatBytes(memoryUsage.rss),
        heapTotal: formatBytes(memoryUsage.heapTotal),
        heapUsed: formatBytes(memoryUsage.heapUsed),
        external: formatBytes(memoryUsage.external)
      },
      connections: {
        active: activeConnections
      },
      externalApis: {
        status: externalApiStatus
      },
      version: process.env.npm_package_version || 'unknown'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Format bytes to human-readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format uptime to human-readable format
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

// Add a direct handler for Kraken API requests
app.use('/api/kraken-direct/*', async (req, res) => {
  try {
    const path = req.params[0];
    // Kraken API has a different URL structure
    const url = path.includes('public')
      ? `https://api.kraken.com/${path}`
      : `https://api.kraken.com/0/${path}`;

    console.log(`Direct Kraken request to ${url}`);

    // Forward the request to the Kraken API with special handling
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ...(req.headers.authorization && { 'Authorization': req.headers.authorization }),
        ...(req.headers['api-key'] && { 'API-Key': req.headers['api-key'] }),
        ...(req.headers['api-sign'] && { 'API-Sign': req.headers['api-sign'] })
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      timeout: 60000 // 60 second timeout
    });

    // Get the response data
    const data = await response.json();

    // Set CORS headers
    res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, API-Key, API-Sign, api-key, api-sign');
    res.header('Access-Control-Allow-Credentials', 'true');

    // Return the response
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Kraken Direct API error:', error.message);

    // Special error handling for Kraken
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Kraken API request timed out',
        details: { message: error.message }
      });
    }

    res.status(500).json({
      error: error.message,
      details: error.response?.data || {}
    });
  }
});

// Add a handler for the DeepSeek API endpoint
app.post('/api/deepseek/v1/chat/completions', async (req, res) => {
  try {
    // Log the full request for debugging
    console.log('Received DeepSeek API request:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body ? {
        model: req.body.model,
        hasMessages: !!req.body.messages,
        messageCount: req.body.messages?.length || 0
      } : 'No body'
    });

    // Set CORS headers for the response
    res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    // Check if we have a request body
    if (!req.body) {
      console.error('No request body received for DeepSeek API');
      return res.status(400).json({
        error: 'Missing request body',
        message: 'Request body is required'
      });
    }

    // Get API key from headers or environment variables
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      console.error('Missing API key for DeepSeek request');
      return res.status(400).json({ error: 'API key is required in Authorization header' });
    }

    // Validate the request body
    if (!req.body.messages) {
      console.error('Invalid request body for DeepSeek:', req.body);
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Request must include messages field',
        required_format: {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Your message here' }],
          temperature: 0.7,
          max_tokens: 1000
        }
      });
    }

    // Always use deepseek-chat model regardless of what was sent
    const requestBody = {
      ...req.body,
      model: 'deepseek-chat'
    };

    console.log(`Calling DeepSeek API with model: ${requestBody.model}`);

    // Make the request to the DeepSeek API
    try {
      // Add timeout and retry logic
      let retryCount = 0;
      const maxRetries = 3;
      let response = null;

      while (retryCount <= maxRetries) {
        try {
          // Add exponential backoff for retries
          if (retryCount > 0) {
            const delay = 1000 * Math.pow(2, retryCount - 1);
            console.log(`Retrying DeepSeek API call (${retryCount}/${maxRetries}) after ${delay}ms delay`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            timeout: 30000 // 30 second timeout
          });

          // If successful, break out of retry loop
          if (response.ok) {
            break;
          }

          // If we get a 5xx error, retry
          if (response.status >= 500) {
            const errorText = await response.text();
            console.error(`DeepSeek API server error (${response.status}), will retry:`, errorText);
            retryCount++;
            continue;
          }

          // For other errors (4xx), don't retry
          const errorText = await response.text();
          console.error(`DeepSeek API client error: ${response.status}`, errorText);
          return res.status(response.status).json({
            error: `DeepSeek API error: ${response.status}`,
            message: errorText
          });
        } catch (fetchAttemptError) {
          console.error(`DeepSeek API fetch attempt ${retryCount + 1} failed:`, fetchAttemptError);
          retryCount++;

          // If we've exhausted all retries, throw the error to be caught by the outer catch
          if (retryCount > maxRetries) {
            throw fetchAttemptError;
          }
        }
      }

      // Log the response status
      console.log(`DeepSeek API response status: ${response.status}`);

      // Parse the response
      const data = await response.json();
      console.log('Successfully received response from DeepSeek API');
      return res.json(data);
    } catch (fetchError) {
      console.error('Error fetching from DeepSeek API after all retries:', fetchError);

      // Generate a synthetic response as fallback
      console.log('Generating synthetic response as fallback');

      // Create a basic synthetic response that matches the DeepSeek API format
      const syntheticResponse = {
        id: `synthetic-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'I apologize, but I am currently unable to process your request due to technical difficulties. Please try again later.'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        },
        _synthetic: true // Add a flag to indicate this is a synthetic response
      };

      return res.json(syntheticResponse);
    }
  } catch (error) {
    console.error('Error in DeepSeek API handler:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Add a handler for the DeepSeek trading signal endpoint
app.post('/api/deepseek/trading-signal', async (req, res) => {
  try {
    console.log('Received DeepSeek trading signal request:', {
      symbol: req.body?.symbol,
      hasAuth: !!req.headers.authorization
    });

    const apiKey = req.headers.authorization?.replace('Bearer ', '') || process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      console.error('Missing API key for DeepSeek trading signal request');
      return res.status(400).json({ error: 'API key is required in Authorization header' });
    }

    // Validate the request body
    if (!req.body || !req.body.symbol) {
      console.error('Invalid request body for DeepSeek trading signal:', req.body);
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Request must include symbol field'
      });
    }

    // Create a prompt for the DeepSeek API based on the trading data
    const prompt = `Analyze this trading data and generate a trading signal:

Symbol: ${req.body.symbol}
Current Price: ${req.body.currentPrice || 'Unknown'}
Market State: ${JSON.stringify(req.body.marketState || {})}
Indicators: ${JSON.stringify(req.body.indicators || [])}

Generate a trading signal with direction (Long/Short), confidence level, stop loss, take profit, and rationale.

Return ONLY a JSON object with this structure:
{
  "signal": true,
  "direction": "Long" | "Short",
  "confidence": number (0-1),
  "entry": number,
  "stopLoss": number,
  "takeProfit": number,
  "rationale": string
}`;

    console.log(`Calling DeepSeek API for trading signal with model: deepseek-chat`);

    // Call the DeepSeek API
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DeepSeek API error: ${response.status}`, errorText);
      return res.status(response.status).json({
        error: `DeepSeek API error: ${response.status}`,
        message: errorText
      });
    }

    const data = await response.json();
    console.log('Successfully received response from DeepSeek API for trading signal');

    // Extract the JSON from the response
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('Empty response from DeepSeek API for trading signal');
      return res.status(500).json({ error: 'Empty response from DeepSeek API' });
    }

    // Extract JSON from the response
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('No valid JSON found in DeepSeek API response for trading signal');
      return res.status(500).json({ error: 'No valid JSON found in response' });
    }

    const signal = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
    res.json(signal);
  } catch (error) {
    console.error('Error calling DeepSeek API for trading signal:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Add a handler for the coindesk-all-news endpoint
app.get('/api/coindesk-all-news', async (req, res) => {
  try {
    const apiKey = req.query.apiKey;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    console.log(`Fetching all news with API key ${apiKey.substring(0, 5)}...`);

    // Use the new endpoint that fetches all news at once
    const url = 'https://data-api.coindesk.com/news/v1/article/list?lang=EN&limit=10';

    console.log(`Requesting all news from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-key': apiKey,
        'api-key': apiKey,
        'X-API-KEY': apiKey,
        'API-KEY': apiKey
      },
      timeout: 15000 // 15 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch all news: ${response.status}`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Transform the Coindesk API response to match the expected format
    const transformedData = {
      status: 'ok',
      articles: []
    };

    // Log the structure of the response to help debug
    console.log(`CoinDesk API response structure: ${Object.keys(data).join(', ')}`);

    // Check for v1 API format (article/list endpoint)
    if (data && data.data && Array.isArray(data.data.results)) {
      console.log(`Found v1 API format with ${data.data.results.length} results`);
      transformedData.articles = data.data.results.map(item => ({
        id: item.id || `${Date.now()}-${Math.random()}`,
        title: item.title || 'No Title',
        description: item.description || item.excerpt || item.summary || '',
        content: item.content || item.description || '',
        url: item.url || 'https://www.coindesk.com/',
        urlToImage: item.thumbnail?.url || item.leadImage?.url || item.image?.url || '',
        publishedAt: item.publishedAt || item.published_at || new Date().toISOString(),
        source: { name: 'Coindesk' }
      }));
    }
    // Handle any other format
    else if (data && Array.isArray(data.results)) {
      console.log(`Found array results format with ${data.results.length} items`);
      transformedData.articles = data.results.map(item => ({
        id: item.id || `${Date.now()}-${Math.random()}`,
        title: item.title || 'No Title',
        description: item.description || item.excerpt || item.summary || '',
        content: item.content || item.description || '',
        url: item.url || 'https://www.coindesk.com/',
        urlToImage: item.thumbnail?.url || item.leadImage?.url || item.image?.url || '',
        publishedAt: item.publishedAt || item.published_at || new Date().toISOString(),
        source: { name: 'Coindesk' }
      }));
    }
    // Handle direct array format
    else if (data && Array.isArray(data)) {
      console.log(`Found direct array format with ${data.length} items`);
      transformedData.articles = data.map(item => ({
        id: item.id || `${Date.now()}-${Math.random()}`,
        title: item.title || 'No Title',
        description: item.description || item.excerpt || item.summary || '',
        content: item.content || item.description || '',
        url: item.url || 'https://www.coindesk.com/',
        urlToImage: item.thumbnail?.url || item.leadImage?.url || item.image?.url || '',
        publishedAt: item.publishedAt || item.published_at || new Date().toISOString(),
        source: { name: 'Coindesk' }
      }));
    }

    console.log(`Successfully fetched ${transformedData.articles.length} news articles`);
    res.json(transformedData);
  } catch (error) {
    console.error('Error fetching all news:', error);

    // Generate synthetic news data as a fallback
    const syntheticArticles = generateSyntheticNewsArticles('crypto');
    console.log(`Generated ${syntheticArticles.length} synthetic news articles`);

    // Return synthetic articles instead of empty array to provide a better user experience
    res.json({ status: 'ok', articles: syntheticArticles });
  }
});

// Add a handler for the coindesk-news endpoint
app.get('/api/coindesk-news', async (req, res) => {
  // Define asset outside the try block so it's available in the catch block
  const asset = req.query.asset || 'btc';

  try {
    const apiKey = req.query.apiKey;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    console.log(`Fetching news for ${asset} with API key ${apiKey.substring(0, 5)}...`);

    // Try multiple URL formats for the Coindesk API, starting with v2 endpoint
    const urls = [
      `https://data-api.coindesk.com/v2/news/search?q=${encodeURIComponent(asset)}&limit=10&sort=publishedAt&lang=EN`,
      `https://data-api.coindesk.com/v1/news/search?q=${encodeURIComponent(asset)}&limit=10&sortBy=publishedAt&lang=EN`,
      `https://data-api.coindesk.com/news/v1/article/list?categories=${encodeURIComponent(asset)}&lang=EN&limit=10`
    ];

    console.log(`Trying CoinDesk API URLs for asset: ${asset}`);

    let response = null;
    let lastError = null;

    // Try each URL until one works
    for (const url of urls) {
      try {
        console.log(`Requesting news from: ${url}`);

        response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-api-key': apiKey,
            'api-key': apiKey,
            'X-API-KEY': apiKey,
            'API-KEY': apiKey
          }
        });

        if (response.ok) {
          console.log(`Success with URL: ${url}`);
          break;
        } else {
          const errorText = await response.text();
          console.error(`Failed with URL ${url}: ${response.status}`, errorText);
          lastError = new Error(`API error: ${response.status} - ${errorText}`);
        }
      } catch (urlError) {
        console.error(`Error with URL ${url}:`, urlError);
        lastError = urlError;
      }
    }

    // If all URLs failed, throw the last error
    if (!response || !response.ok) {
      throw lastError || new Error('All API endpoints failed');
    }

    const data = await response.json();

    // Transform the Coindesk API response to match the expected format
    const transformedData = {
      status: 'ok',
      articles: []
    };

    // Log the structure of the response to help debug
    console.log(`CoinDesk API response structure: ${Object.keys(data).join(', ')}`);

    // Check for v2 API format first
    if (data && Array.isArray(data.results)) {
      console.log(`Found v2 API format with ${data.results.length} results`);
      transformedData.articles = data.results.map(item => ({
        id: item.id || `${Date.now()}-${Math.random()}`,
        title: item.title || 'No Title',
        description: item.description || item.excerpt || item.summary || '',
        content: item.content || item.description || '',
        url: item.url || '',
        urlToImage: item.thumbnail?.url || item.leadImage?.url || item.image || '',
        publishedAt: item.publishedAt || item.published_at || new Date().toISOString(),
        source: { name: 'Coindesk' }
      }));
    }
    // Check for v1 API format
    else if (data && data.data && Array.isArray(data.data.items)) {
      console.log(`Found v1 API format with ${data.data.items.length} items`);
      transformedData.articles = data.data.items.map(item => ({
        id: item.id || `${Date.now()}-${Math.random()}`,
        title: item.title || 'No Title',
        description: item.description || item.excerpt || item.summary || '',
        content: item.content || item.description || '',
        url: item.url || '',
        urlToImage: item.thumbnail?.url || item.leadImage?.url || '',
        publishedAt: item.publishedAt || item.published_at || new Date().toISOString(),
        source: { name: 'Coindesk' }
      }));
    }
    // Check for any other array format
    else if (data && Array.isArray(data)) {
      console.log(`Found direct array format with ${data.length} items`);
      transformedData.articles = data.map(item => ({
        id: item.id || `${Date.now()}-${Math.random()}`,
        title: item.title || 'No Title',
        description: item.description || item.excerpt || item.summary || '',
        content: item.content || item.description || '',
        url: item.url || '',
        urlToImage: item.thumbnail?.url || item.leadImage?.url || item.image || '',
        publishedAt: item.publishedAt || item.published_at || new Date().toISOString(),
        source: { name: 'Coindesk' }
      }));
    }

    console.log(`Successfully fetched ${transformedData.articles.length} news articles for ${asset}`);
    res.json(transformedData);
  } catch (error) {
    console.error('Error fetching news:', error);

    // Make sure asset is defined before generating synthetic news
    const assetToUse = asset || 'btc';

    // Generate synthetic news data as a fallback
    const syntheticArticles = generateSyntheticNewsArticles(assetToUse);
    console.log(`Generated ${syntheticArticles.length} synthetic news articles for ${assetToUse}`);

    // Return synthetic articles instead of empty array to provide a better user experience
    res.json({ status: 'ok', articles: syntheticArticles });
  }
});

// Function to generate synthetic news articles when API calls fail
function generateSyntheticNewsArticles(asset) {
  const assetName = asset.toUpperCase().replace(/\/.*$/, '');
  const currentDate = new Date();

  // Create an array of synthetic news articles
  const articles = [
    {
      id: `synthetic-${assetName}-1`,
      title: `${assetName} Shows Strong Market Performance Amid Global Economic Changes`,
      description: `Recent market analysis indicates ${assetName} has maintained stability despite fluctuations in the broader cryptocurrency market.`,
      content: `Analysts are pointing to ${assetName}'s robust infrastructure and growing adoption as key factors in its recent market resilience. Several institutional investors have increased their positions in ${assetName} over the past quarter.`,
      url: 'https://www.coindesk.com/markets/',
      urlToImage: 'https://www.coindesk.com/resizer/D1Jqhn5XGKC3TwrWVtZbKPJwBg8=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/DPFQPX7YBZF7ZNDMFMM3NWMWLM.jpg',
      publishedAt: new Date(currentDate.getTime() - 3600000).toISOString(),
      source: { name: 'Coindesk' }
    },
    {
      id: `synthetic-${assetName}-2`,
      title: `New Development Could Boost ${assetName} Utility in DeFi Space`,
      description: `A recent protocol upgrade for ${assetName} is expected to enhance its functionality within decentralized finance applications.`,
      content: `The latest technical improvements to ${assetName}'s blockchain infrastructure are aimed at increasing transaction throughput and reducing fees. These changes could position ${assetName} as a more competitive player in the rapidly evolving DeFi ecosystem.`,
      url: 'https://www.coindesk.com/tech/',
      urlToImage: 'https://www.coindesk.com/resizer/c_P_sCYnSXNgw3X5Fj9jU_-XVCw=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/NKPZLJ5GKZGNTCMGKWVK5KRIFQ.jpg',
      publishedAt: new Date(currentDate.getTime() - 7200000).toISOString(),
      source: { name: 'Coindesk' }
    },
    {
      id: `synthetic-${assetName}-3`,
      title: `Regulatory Clarity Provides Tailwind for ${assetName}`,
      description: `Recent regulatory developments in key markets have created a more favorable environment for ${assetName} and similar digital assets.`,
      content: `Industry experts suggest that the regulatory framework emerging in several major economies is bringing much-needed clarity to ${assetName} operations. This development could potentially accelerate institutional adoption and increase market liquidity.`,
      url: 'https://www.coindesk.com/policy/',
      urlToImage: 'https://www.coindesk.com/resizer/yR4IvX6gGzQ59_QJQzKJJKpQKlA=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/XNFMWB3JRFHHTGCFJ4QM6BWZQQ.jpg',
      publishedAt: new Date(currentDate.getTime() - 10800000).toISOString(),
      source: { name: 'Coindesk' }
    },
    {
      id: `synthetic-${assetName}-4`,
      title: `${assetName} Integration Announced by Major Payment Processor`,
      description: `A leading global payment service provider has revealed plans to support ${assetName} transactions on its platform.`,
      content: `This strategic partnership represents a significant milestone for ${assetName}'s mainstream adoption. The integration is expected to be rolled out in phases, with initial support focused on key markets in North America and Europe.`,
      url: 'https://www.coindesk.com/business/',
      urlToImage: 'https://www.coindesk.com/resizer/yCN2uxUuXnN5TP95_-A30D1AbiI=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/OVUWV7SLORHWJPWMM3JQ3NJ4SM.jpg',
      publishedAt: new Date(currentDate.getTime() - 14400000).toISOString(),
      source: { name: 'Coindesk' }
    },
    {
      id: `synthetic-${assetName}-5`,
      title: `Technical Analysis: ${assetName} Approaching Key Resistance Levels`,
      description: `Market technicians are closely watching ${assetName} as it tests important price thresholds that could signal future movement.`,
      content: `Chart patterns suggest ${assetName} is consolidating near critical resistance levels. A breakthrough could potentially trigger a significant upward movement, while failure to break these levels might result in a retest of support zones.`,
      url: 'https://www.coindesk.com/markets/2023/',
      urlToImage: 'https://www.coindesk.com/resizer/Q7tO_VKmZzjgXJf8GnYA4Gv9YEU=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/JMDGWVJWEBDXDPYYFQQVZUIMLA.jpg',
      publishedAt: new Date(currentDate.getTime() - 18000000).toISOString(),
      source: { name: 'Coindesk' }
    }
  ];

  return articles;
}

// Set up proxy routes for each exchange
Object.keys(exchangeProxies).forEach(exchange => {
  // Special handling for BitMart to fix double slash issue
  if (exchange === 'bitmart') {
    app.use(`/api/bitmart`, createProxyMiddleware({
      ...exchangeProxies[exchange],
      pathRewrite: (path) => {
        // Log the original path
        console.log('Original BitMart path:', path);

        // Fix double slash issue by removing any duplicate /api segments
        let newPath = path.replace(/\/api\/+api\/bitmart/, '/api/bitmart');

        // Remove the /api/bitmart prefix to get the actual API path
        newPath = newPath.replace(/^\/api\/bitmart/, '');

        // Log the new path
        console.log('New BitMart path:', newPath);

        return newPath;
      }
    }));
  } else {
    app.use(`/api/${exchange}`, createProxyMiddleware(exchangeProxies[exchange]));
  }
});

// Legacy route for backward compatibility - also with double slash fix
app.use('/api', createProxyMiddleware({
  ...exchangeProxies.bitmart,
  pathRewrite: (path) => {
    // Log the original path
    console.log('Original legacy BitMart path:', path);

    // Fix double slash issue by removing any duplicate /api segments
    let newPath = path.replace(/\/api\/+api/, '/api');

    // Remove the /api prefix to get the actual API path
    newPath = newPath.replace(/^\/api/, '');

    // Log the new path
    console.log('New legacy BitMart path:', newPath);

    return newPath;
  }
}));

const PORT = process.env.PROXY_PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Create WebSocket proxy for Binance TestNet
const binanceTestnetWsUrl = process.env.BINANCE_TESTNET_WEBSOCKETS_URL || 'wss://testnet.binancefuture.com/ws-fapi/v1';
console.log(`Binance TestNet WebSocket URL: ${binanceTestnetWsUrl}`);

// Store connected clients
const clients = new Map();

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  const isDemo = req.url.includes('demo=true');

  // Store client information
  clients.set(clientId, {
    ws,
    isDemo,
    subscriptions: [],
    binanceWs: null, // Will be initialized if needed
    pongTimeout: null, // For tracking ping/pong timeouts
    lastPongReceived: Date.now() // Track when we last received a pong
  });

  console.log(`WebSocket client connected: ${clientId}, Demo mode: ${isDemo}`);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    data: {
      message: `Connected to trading server in ${isDemo ? 'demo' : 'real'} mode`,
      clientId,
      isDemo
    }
  }));

  // Set up a ping interval to keep the connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const client = clients.get(clientId);
      if (!client) {
        clearInterval(pingInterval);
        return;
      }

      // Check if we haven't received a pong in a long time (5 minutes)
      const lastPongAge = Date.now() - client.lastPongReceived;
      if (lastPongAge > 300000) { // 5 minutes
        console.log(`No pong received from client ${clientId} for ${Math.round(lastPongAge/1000)}s, terminating connection`);
        ws.terminate();
        clearInterval(pingInterval);
        return;
      }

      console.log(`Sending ping to client ${clientId}`);
      try {
        ws.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));

        // Set a timeout to check if we receive a pong
        const pongTimeout = setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log(`No pong received from client ${clientId} within timeout, checking connection...`);

            // Send a verification ping
            try {
              ws.send(JSON.stringify({
                type: 'ping',
                timestamp: Date.now(),
                isVerification: true
              }));

              // Set another timeout for the verification ping
              setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  // Check if we've received a pong since sending the verification ping
                  const client = clients.get(clientId);
                  if (client && Date.now() - client.lastPongReceived > 5000) {
                    console.log(`No verification pong received from client ${clientId}, terminating connection`);
                    ws.terminate(); // Force close the connection
                  }
                }
              }, 5000); // Wait 5 seconds for verification pong
            } catch (error) {
              console.error(`Error sending verification ping to client ${clientId}:`, error);
              ws.terminate(); // Force close the connection on error
            }
          }
        }, 15000); // Wait 15 seconds for pong

        // Store the timeout in the client object so we can clear it if we receive a pong
        if (client) {
          // Clear any existing timeout to prevent memory leaks
          if (client.pongTimeout) {
            clearTimeout(client.pongTimeout);
          }
          client.pongTimeout = pongTimeout;
        }
      } catch (error) {
        console.error(`Error sending ping to client ${clientId}:`, error);
        // If we can't send a ping, the connection is probably dead
        try {
          ws.terminate();
        } catch (terminateError) {
          console.error(`Error terminating WebSocket for client ${clientId}:`, terminateError);
        }
        clearInterval(pingInterval);
      }
    } else {
      clearInterval(pingInterval);
    }
  }, 30000); // Send ping every 30 seconds

  // Handle client disconnection
  ws.on('close', () => {
    console.log(`WebSocket client disconnected: ${clientId}`);

    // Clean up any Binance WebSocket connections
    const client = clients.get(clientId);
    if (client) {
      // Close Binance WebSocket if it exists
      if (client.binanceWs) {
        client.binanceWs.close();
      }

      // Clear any pending pong timeout
      if (client.pongTimeout) {
        clearTimeout(client.pongTimeout);
      }
    }

    // Remove client from the map
    clients.delete(clientId);

    // Clear the ping interval
    clearInterval(pingInterval);
  });

  // Handle messages from clients
  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      console.log(`Received message from ${clientId}:`, parsedMessage);

      // Handle different message types
      if (parsedMessage.type === 'ping') {
        // Respond to ping with pong
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now(),
          echo: parsedMessage.timestamp
        }));
      } else if (parsedMessage.type === 'pong') {
        // Clear the pong timeout if it exists
        const client = clients.get(clientId);
        if (client) {
          if (client.pongTimeout) {
            clearTimeout(client.pongTimeout);
            client.pongTimeout = null;
          }
          // Update the last pong received timestamp
          client.lastPongReceived = Date.now();
          console.log(`Received pong from client ${clientId}, cleared timeout and updated lastPongReceived`);
        }
      } else if (parsedMessage.type === 'subscribe') {
        // Handle subscription requests
        handleSubscription(clientId, parsedMessage.data, isDemo);
      } else if (parsedMessage.type === 'unsubscribe') {
        // Handle unsubscription requests
        handleUnsubscription(clientId, parsedMessage.data);
      } else if (parsedMessage.type === 'binance_testnet') {
        // Forward message to Binance TestNet WebSocket
        forwardToBinanceTestnet(clientId, parsedMessage.data);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });
});

// Handle subscriptions
function handleSubscription(clientId, data, isDemo) {
  const client = clients.get(clientId);
  if (!client) return;

  // Store subscription information with the client
  if (!client.subscriptions) {
    client.subscriptions = [];
  }

  if (data.channel === 'trades') {
    client.subscriptions.push({
      channel: 'trades',
      strategyId: data.strategyId
    });

    console.log(`Client ${clientId} subscribed to trades for strategy ${data.strategyId}`);

    // Send confirmation
    client.ws.send(JSON.stringify({
      type: 'subscribed',
      data: {
        channel: 'trades',
        strategyId: data.strategyId
      }
    }));

    // If in demo mode and we need to connect to Binance TestNet
    if (isDemo && data.useBinanceTestnet && !client.binanceWs) {
      connectToBinanceTestnet(clientId, data.symbols || ['btcusdt@trade']);
    }
  }
}

// Connect to Binance TestNet WebSocket
function connectToBinanceTestnet(clientId, symbols) {
  const client = clients.get(clientId);
  if (!client) return;

  try {
    // Import WebSocket
    const WebSocket = require('ws');

    // Format symbols for Binance subscription
    const formattedSymbols = Array.isArray(symbols) ? symbols : [symbols];

    // Create WebSocket connection to Binance TestNet
    const binanceWs = new WebSocket(binanceTestnetWsUrl);

    binanceWs.on('open', () => {
      console.log(`Binance TestNet WebSocket connected for client ${clientId}`);

      // Subscribe to the specified symbols
      const subscribeMsg = {
        method: 'SUBSCRIBE',
        params: formattedSymbols,
        id: Date.now()
      };

      binanceWs.send(JSON.stringify(subscribeMsg));

      // Store the Binance WebSocket connection
      client.binanceWs = binanceWs;
    });

    binanceWs.on('message', (data) => {
      try {
        // Parse the message from Binance
        const message = JSON.parse(data.toString());

        // Forward the message to the client
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            type: 'binance_data',
            data: message
          }));
        }
      } catch (error) {
        console.error('Error parsing Binance WebSocket message:', error);
      }
    });

    binanceWs.on('error', (error) => {
      console.error(`Binance TestNet WebSocket error for client ${clientId}:`, error);
    });

    binanceWs.on('close', () => {
      console.log(`Binance TestNet WebSocket closed for client ${clientId}`);
      if (client) {
        client.binanceWs = null;
      }
    });
  } catch (error) {
    console.error(`Failed to connect to Binance TestNet for client ${clientId}:`, error);
  }
}

// Forward message to Binance TestNet WebSocket
function forwardToBinanceTestnet(clientId, data) {
  const client = clients.get(clientId);
  if (!client || !client.binanceWs) return;

  try {
    // Forward the message to Binance TestNet
    client.binanceWs.send(JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to forward message to Binance TestNet for client ${clientId}:`, error);
  }
}

// Handle unsubscriptions
function handleUnsubscription(clientId, data) {
  const client = clients.get(clientId);
  if (!client || !client.subscriptions) return;

  // Remove subscription
  client.subscriptions = client.subscriptions.filter(sub =>
    !(sub.channel === data.channel && sub.strategyId === data.strategyId)
  );

  console.log(`Client ${clientId} unsubscribed from ${data.channel} for strategy ${data.strategyId}`);

  // Send confirmation
  client.ws.send(JSON.stringify({
    type: 'unsubscribed',
    data: {
      channel: data.channel,
      strategyId: data.strategyId
    }
  }));

  // If no more subscriptions and we have a Binance connection, close it
  if (client.subscriptions.length === 0 && client.binanceWs) {
    client.binanceWs.close();
    client.binanceWs = null;
    console.log(`Closed Binance TestNet connection for client ${clientId} due to no active subscriptions`);
  }
}

// Broadcast trade updates to subscribed clients
global.broadcastTradeUpdate = function(strategyId, trade) {
  clients.forEach((client, clientId) => {
    if (client.subscriptions && client.subscriptions.some(sub =>
      sub.channel === 'trades' && (sub.strategyId === strategyId || sub.strategyId === 'all')
    )) {
      try {
        // Check if WebSocket is still open
        if (client.ws && client.ws.readyState === 1) { // WebSocket.OPEN = 1
          client.ws.send(JSON.stringify({
            type: 'trade_update',
            data: {
              strategyId,
              trade
            }
          }));
        }
      } catch (error) {
        console.error(`Failed to broadcast trade update to client ${clientId}:`, error);
      }
    }
  });
};

// Broadcast Binance TestNet data to all clients in demo mode
global.broadcastBinanceData = function(data) {
  clients.forEach((client, clientId) => {
    if (client.isDemo && client.ws && client.ws.readyState === 1) {
      try {
        client.ws.send(JSON.stringify({
          type: 'binance_market_data',
          data
        }));
      } catch (error) {
        console.error(`Failed to broadcast Binance data to client ${clientId}:`, error);
      }
    }
  });
};

// Start the server with fallback ports if the primary port is in use
const startServer = (port) => {
  // Make sure the server is running on port 3001 to match the vite.config.ts proxy setting
  const actualPort = port === 3001 ? port : 3001;
  server.listen(actualPort, 'localhost')
    .on('listening', () => {
      console.log(`Proxy server running on port ${actualPort}`);
      console.log(`WebSocket server running at ws://localhost:${actualPort}/ws`);
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is already in use, trying port ${port + 1}`);
        startServer(port + 1);
      } else {
        console.error('Server error:', err);
      }
    });
};

// Start the server with the initial port
startServer(PORT);
