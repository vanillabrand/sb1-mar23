import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000'
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Proxy middleware configuration
const proxyMiddleware = createProxyMiddleware({
  target: 'https://api-cloud.bitmart.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/proxy': ''
  },
  onProxyRes: (proxyRes, req, res) => {
    proxyRes.headers['access-control-allow-origin'] = req.headers.origin || 'http://localhost:5173';
    proxyRes.headers['access-control-allow-credentials'] = 'true';
    proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-Requested-With';
  },
  onError: (err, req, res) => {
    console.error('Proxy Error:', err);
    res.status(500).json({ error: 'Proxy Error', message: err.message });
  }
});

// Apply proxy to all routes under /api/proxy
app.use('/api/proxy', proxyMiddleware);

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy server running on http://0.0.0.0:${PORT}`);
});
