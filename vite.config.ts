import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import ccxtFixPlugin from './src/lib/vite-plugin-ccxt-fix';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      nodePolyfills({
        // Whether to polyfill `node:` protocol imports.
        protocolImports: true,
        // Polyfills for specific Node.js modules
        include: ['querystring', 'events', 'util', 'buffer', 'stream']
      }),
      // Custom plugin to fix CCXT static dependencies
      ccxtFixPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // Replace the entire CCXT library with our browser-compatible wrapper
        'ccxt': path.resolve(__dirname, './src/lib/ccxt-entry.js'),
        // Other aliases for specific modules
        'qs': path.resolve(__dirname, './src/lib/qs-browser-shim.js'),
        'node_modules/qs': path.resolve(__dirname, './src/lib/qs-browser-shim.js')
      }
    },
    server: {
      proxy: {
        '/api': {
          target: env.PROXY_SERVER_URL || 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path
        },
        '/ws': {
          target: env.PROXY_SERVER_URL || 'http://localhost:3001',
          ws: true,
          changeOrigin: true
        }
      },
      host: '0.0.0.0' // Allow connections from all network interfaces
    },
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      minify: mode === 'production',
      // Chunk size optimization
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            charts: ['chart.js', 'react-chartjs-2', 'recharts'],
            ui: ['framer-motion', 'lucide-react', 'react-hot-toast'],
            three: ['three', '@react-three/fiber', '@react-three/drei']
          }
        },
        // Handle Node.js built-in modules and problematic libraries
        external: [
          'http', 'https', 'url', 'assert', 'stream', 'tty', 'util', 'os', 'zlib',
          'events', 'net', 'tls', 'crypto', 'fs', 'path', 'querystring',
          'node:stream', 'node:util', 'node:buffer', 'node:*'
          // Removed 'ccxt' from external to ensure it's bundled
        ]
      },
      // Reduce chunk size warnings threshold
      chunkSizeWarningLimit: 1000
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'chart.js', 'framer-motion'],
      // Don't exclude ccxt anymore
      exclude: []
    },
    // Enable gzip compression
    preview: {
      port: 5173,
      host: '0.0.0.0'
    }
  };
});
