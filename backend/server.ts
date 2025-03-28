import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './config.js';
import { supabase } from './lib/supabase-client.js';
import { initializeServices, serviceManager } from './services/index.js';

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'development' 
    ? ['http://localhost:5173', 'http://127.0.0.1:5173']
    : config.allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Proxy middleware for Bitmart API
app.use('/api/proxy', createProxyMiddleware({
  target: 'https://api-cloud.bitmart.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/proxy': ''
  },
  onProxyRes: (proxyRes) => {
    // Remove duplicate CORS headers
    if (proxyRes.headers['access-control-allow-origin']) {
      proxyRes.headers['access-control-allow-origin'] = '*';
    }
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  const services = serviceManager.getAllServicesStatus();
  res.json({ 
    status: 'ok',
    services
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Initialize all services
    await initializeServices();

    // Start server
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
