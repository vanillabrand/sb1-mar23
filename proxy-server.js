import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// Standard CORS handler for proxy responses
const standardCorsHandler = (proxyRes, req, _res) => {
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
  proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey, X-API-KEY, API-Key, API-Sign, api-sign, api_key, apikey, OK-ACCESS-KEY, OK-ACCESS-SIGN, OK-ACCESS-TIMESTAMP, OK-ACCESS-PASSPHRASE, CB-ACCESS-KEY, CB-ACCESS-SIGN, CB-ACCESS-TIMESTAMP, CB-ACCESS-PASSPHRASE, ACCESS-KEY, ACCESS-SIGN, ACCESS-TIMESTAMP, ACCESS-PASSPHRASE, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign, X-BM-KEY, X-BM-SIGN, X-BM-TIMESTAMP, KC-API-KEY, KC-API-SIGN, KC-API-TIMESTAMP, KC-API-PASSPHRASE, key, Key, secret, Secret, passphrase, Passphrase, apikey, ApiKey';
};

// Use a more permissive CORS configuration for development
const corsOptions = {
  origin: '*', // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 'Authorization', 'X-Requested-With',
    // Binance
    'X-MBX-APIKEY', 'x-mbx-apikey',
    // Bybit
    'X-BAPI-API-KEY', 'X-BAPI-SIGN', 'X-BAPI-TIMESTAMP', 'x-bapi-timestamp', 'x-bapi-api-key', 'x-bapi-sign',
    // Kraken
    'API-Key', 'API-Sign', 'api-sign', 'api_key', 'apikey',
    // OKX
    'OK-ACCESS-KEY', 'OK-ACCESS-SIGN', 'OK-ACCESS-TIMESTAMP', 'OK-ACCESS-PASSPHRASE',
    // Coinbase
    'CB-ACCESS-KEY', 'CB-ACCESS-SIGN', 'CB-ACCESS-TIMESTAMP', 'CB-ACCESS-PASSPHRASE',
    // BitMart
    'X-BM-KEY', 'X-BM-SIGN', 'X-BM-TIMESTAMP',
    // KuCoin
    'KC-API-KEY', 'KC-API-SIGN', 'KC-API-TIMESTAMP', 'KC-API-PASSPHRASE',
    // Generic
    'X-API-KEY', 'ACCESS-KEY', 'ACCESS-SIGN', 'ACCESS-TIMESTAMP', 'ACCESS-PASSPHRASE',
    // Additional headers
    'key', 'Key', 'secret', 'Secret', 'passphrase', 'Passphrase', 'apikey', 'ApiKey'
  ]
};

app.use(cors(corsOptions));

// Add a specific handler for Binance TestNet OPTIONS requests
app.options('/api/binanceTestnet/*', (req, res) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-MBX-APIKEY, x-mbx-apikey, key, Key, secret, Secret, apikey, ApiKey, *');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

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
      const standardHeaders = 'Content-Type, Authorization, X-Requested-With, X-MBX-APIKEY, x-mbx-apikey, X-API-KEY, API-Key, API-Sign, api-sign, OK-ACCESS-KEY, OK-ACCESS-SIGN, OK-ACCESS-TIMESTAMP, OK-ACCESS-PASSPHRASE, CB-ACCESS-KEY, CB-ACCESS-SIGN, CB-ACCESS-TIMESTAMP, CB-ACCESS-PASSPHRASE, ACCESS-KEY, ACCESS-SIGN, ACCESS-TIMESTAMP, ACCESS-PASSPHRASE, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign, X-BM-KEY, X-BM-SIGN, X-BM-TIMESTAMP, KC-API-KEY, KC-API-SIGN, KC-API-TIMESTAMP, KC-API-PASSPHRASE, *';
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
    const standardHeaders = 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign, api_key, apikey, *';
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
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-MBX-APIKEY, x-mbx-apikey, X-API-KEY, API-Key, API-Sign, api-sign, api_key, apikey, *');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).send();
});

// Add a specific handler for BitMart OPTIONS requests
app.options('/api/bitmart/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-BM-KEY, X-BM-SIGN, X-BM-TIMESTAMP, API-Key, API-Sign, api-sign, *');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).send();
});

// Add a specific handler for Kraken OPTIONS requests
app.options('/api/kraken/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, API-Key, API-Sign, api-sign, *');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).send();
});

// Add a specific handler for Coinbase OPTIONS requests
app.options('/api/coinbase/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, CB-ACCESS-KEY, CB-ACCESS-SIGN, CB-ACCESS-TIMESTAMP, CB-ACCESS-PASSPHRASE, API-Key, API-Sign, api-sign, *');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).send();
});

// Add a specific handler for OKX OPTIONS requests
app.options('/api/okx/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, OK-ACCESS-KEY, OK-ACCESS-SIGN, OK-ACCESS-TIMESTAMP, OK-ACCESS-PASSPHRASE, API-Key, API-Sign, api-sign, *');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).send();
});

// Add a specific handler for Bybit OPTIONS requests
app.options('/api/bybit/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign, API-Key, API-Sign, api-sign, *');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).send();
});

// Add a specific handler for KuCoin OPTIONS requests
app.options('/api/kucoin/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, KC-API-KEY, KC-API-SIGN, KC-API-TIMESTAMP, KC-API-PASSPHRASE, API-Key, API-Sign, api-sign, *');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
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
        'kraken': ['API-Key', 'API-Sign'],
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
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey, X-BM-KEY, X-BM-SIGN, X-BM-TIMESTAMP, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign';
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
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey';
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

      // Handle the case where the path already contains api/v3
      if (path.includes('/api/v3/')) {
        newPath = path.replace(/^\/api\/binanceTestnet\/api\/v3/, '/api/v3');
      } else {
        // Simple path rewrite: /api/binanceTestnet -> /api/v3
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
        'x-bapi-api-key', 'x-bapi-sign', 'x-bapi-timestamp',
        'key', 'Key', 'secret', 'Secret', 'apikey', 'ApiKey'
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
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-Requested-With, X-MBX-APIKEY, x-mbx-apikey, key, Key, secret, Secret, apikey, ApiKey, *';

      // Get all headers from the request
      const requestHeaders = req.headers['access-control-request-headers'] || '';

      // If there are request headers, allow them all
      if (requestHeaders) {
        proxyRes.headers['access-control-allow-headers'] = requestHeaders;
      } else {
        // Otherwise, use our standard headers
        const standardHeaders = 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign, api_key, apikey, *';
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
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey, X-BAPI-API-KEY, X-BAPI-SIGN, X-BAPI-TIMESTAMP, x-bapi-timestamp, x-bapi-api-key, x-bapi-sign, api_key, apikey, *';

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
  }
};

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Set up proxy routes for each exchange
Object.keys(exchangeProxies).forEach(exchange => {
  app.use(`/api/${exchange}`, createProxyMiddleware(exchangeProxies[exchange]));
});

// Legacy route for backward compatibility
app.use('/api', createProxyMiddleware(exchangeProxies.bitmart));

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
    binanceWs: null // Will be initialized if needed
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
      console.log(`Sending ping to client ${clientId}`);
      ws.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      }));
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  // Handle client disconnection
  ws.on('close', () => {
    console.log(`WebSocket client disconnected: ${clientId}`);

    // Clean up any Binance WebSocket connections
    const client = clients.get(clientId);
    if (client && client.binanceWs) {
      client.binanceWs.close();
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

  // Handle client disconnection
  ws.on('close', () => {
    console.log(`WebSocket client disconnected: ${clientId}`);

    // Close Binance WebSocket connection if it exists
    const client = clients.get(clientId);
    if (client && client.binanceWs) {
      client.binanceWs.close();
    }

    clients.delete(clientId);
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
  server.listen(port)
    .on('listening', () => {
      console.log(`Proxy server running on port ${port}`);
      console.log(`WebSocket server running at ws://localhost:${port}/ws`);
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
