import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

// Helper function to validate Codespaces URLs
const isValidCodespacesOrigin = (origin) => {
  if (!origin) return false;
  return (
    origin.startsWith('https://') && (
      origin.includes('.github.dev') ||
      origin.includes('.app.github.dev') ||
      origin.includes('.preview.app.github.dev') ||
      origin.endsWith('.githubpreview.dev')
    )
  );
};

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];

    if (!origin || allowedOrigins.includes(origin) || isValidCodespacesOrigin(origin)) {
      callback(null, origin);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept']
}));

// Proxy middleware configuration
const proxyMiddleware = createProxyMiddleware({
  target: 'https://api-cloud.bitmart.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/proxy': ''
  },
  onProxyRes: (proxyRes, req, res) => {
    // Clean up CORS headers
    const origin = req.headers.origin;
    if (proxyRes.headers['access-control-allow-origin']) {
      delete proxyRes.headers['access-control-allow-origin'];
    }
    proxyRes.headers['access-control-allow-origin'] = origin || '*';
    proxyRes.headers['access-control-allow-credentials'] = 'true';
  },
  onError: (err, req, res) => {
    console.error('Proxy Error:', err);
    res.status(500).send('Proxy Error');
  }
});

// Apply proxy middleware
app.use('/api/proxy', proxyMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get the port from environment or default to 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy server running on http://0.0.0.0:${PORT}`);
});