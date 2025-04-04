import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'https://fluffy-disco-vj9rwppxw2x97q-5173.app.github.dev'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));

// Add OPTIONS handling for preflight requests
app.options('*', cors(corsOptions));

// Define proxy configurations for different exchanges
const exchangeProxies = {
  bitmart: {
    target: 'https://api-cloud-v2.bitmart.com',
    changeOrigin: true,
    pathRewrite: {
      '^/api/bitmart': ''
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
      proxyRes.headers['access-control-allow-origin'] = req.headers.origin || 'http://localhost:5173';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey';
    }
  },
  binance: {
    target: 'https://api.binance.com',
    changeOrigin: true,
    pathRewrite: {
      '^/api/binance': ''
    },
    onProxyReq: (proxyReq, req, _res) => {
      // Remove origin header to prevent CORS issues
      proxyReq.removeHeader('origin');
      // Add custom headers if needed
      proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
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
      proxyRes.headers['access-control-allow-origin'] = req.headers.origin || 'http://localhost:5173';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-MBX-APIKEY, x-mbx-apikey';
    }
  },
  binanceTestnet: {
    target: 'https://testnet.binance.vision',
    changeOrigin: true,
    pathRewrite: {
      '^/api/binanceTestnet': ''
    },
    onProxyReq: (proxyReq, req, _res) => {
      // Remove origin header to prevent CORS issues
      proxyReq.removeHeader('origin');
      // Add custom headers if needed
      proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Forward the Binance API key header if present
      if (req.headers['x-mbx-apikey']) {
        proxyReq.setHeader('X-MBX-APIKEY', req.headers['x-mbx-apikey']);
        console.log('Forwarding X-MBX-APIKEY header');
      }

      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
      console.log(`Proxying request to Binance TestNet: ${req.method} ${req.url}`);
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

      console.log(`Received response from Binance TestNet: ${proxyRes.statusCode}`);
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
      // Remove origin header to prevent CORS issues
      proxyReq.removeHeader('origin');
      // Add custom headers if needed
      proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Forward the Binance API key header if present
      if (req.headers['x-mbx-apikey']) {
        proxyReq.setHeader('X-MBX-APIKEY', req.headers['x-mbx-apikey']);
        console.log('Forwarding X-MBX-APIKEY header to Binance Futures');
      }

      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
      console.log(`Proxying request to Binance Futures: ${req.method} ${req.url}`);
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

  // Handle messages from clients
  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      console.log(`Received message from ${clientId}:`, parsedMessage);

      // Handle different message types
      if (parsedMessage.type === 'subscribe') {
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

// Start the server
server.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`WebSocket server running at ws://localhost:${PORT}/ws`);
});
