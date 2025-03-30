import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './config';

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'development'
    ? ['http://localhost:5173', 'http://127.0.0.1:5173']
    : config.allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Exchange API proxy middleware
app.use('/api/:exchange', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const exchange = req.params.exchange;
  const targetUrl = getExchangeUrl(exchange);

  if (!targetUrl) {
    return res.status(400).json({ error: `Unsupported exchange: ${exchange}` });
  }

  createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: {
      [`^/api/${exchange}`]: '',
    },
    onProxyReq: (proxyReq, req) => {
      // Copy API key header if present
      const apiKey = req.headers['x-mbx-apikey'];
      if (apiKey) {
        proxyReq.setHeader('x-mbx-apikey', apiKey);
      }
    },
    onError: (err, _req, res) => {
      console.error('Proxy Error:', err);
      res.status(500).json({ error: 'Proxy Error', details: err.message });
    }
  })(req, res, next);
});

function getExchangeUrl(exchange: string): string | null {
  const exchanges = {
    binance: 'https://api.binance.com',
    bybit: 'https://api.bybit.com',
    bitmart: 'https://api-cloud.bitmart.com',
    // Add other exchanges as needed
  };
  return exchanges[exchange] || null;
}

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
