import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

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

const proxyMiddleware = createProxyMiddleware({
  target: 'https://api-cloud-v2.bitmart.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api': ''
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
    proxyRes.headers['access-control-allow-headers'] = '*';
  }
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply the proxy middleware to all /api routes
app.use('/api', proxyMiddleware);

const PORT = process.env.PROXY_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
