import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import ccxtFixPlugin from './src/lib/vite-plugin-ccxt-fix';
import chartsFixPlugin from './src/lib/vite-plugin-charts-fix';

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
      // Custom plugin to fix chart library circular dependencies
      chartsFixPlugin(),
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
        },
        // For local development with Netlify Functions
        '/.netlify/functions': {
          target: 'http://localhost:8888',
          changeOrigin: true,
          secure: false
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
          manualChunks: (id) => {
            // Create more granular chunks for better loading
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('scheduler') || id.includes('prop-types')) {
                return 'vendor-react';
              }
              // Split chart libraries into separate chunks to avoid circular dependencies
              if (id.includes('chart.js')) {
                return 'vendor-chartjs';
              }
              if (id.includes('recharts')) {
                return 'vendor-recharts';
              }
              if (id.includes('react-chartjs-2')) {
                return 'vendor-react-chartjs';
              }
              if (id.includes('three') || id.includes('@react-three')) {
                return 'vendor-three';
              }
              if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('react-hot-toast')) {
                return 'vendor-ui';
              }
              if (id.includes('supabase')) {
                return 'vendor-supabase';
              }
              // Default vendor chunk for other node_modules
              return 'vendor';
            }
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
      chunkSizeWarningLimit: 2000,
      // Ensure proper browser compatibility
      target: 'es2015',
      // Improve CSS handling
      cssCodeSplit: true,
      // Ensure proper asset handling
      assetsInlineLimit: 4096
    },
    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'chart.js',
        'framer-motion',
        '@supabase/supabase-js',
        'three',
        '@react-three/fiber',
        'lucide-react',
        'react-hot-toast',
        'recharts'
      ],
      // Don't exclude ccxt anymore
      exclude: [],
      // Force optimization of these dependencies
      force: true,
      // Ensure proper handling of ESM/CJS interop
      esbuildOptions: {
        target: 'es2020',
        supported: {
          bigint: true
        },
        define: {
          global: 'globalThis'
        }
      }
    },
    // Enable gzip compression
    preview: {
      port: 5173,
      host: '0.0.0.0',
      // Add proxy configuration for preview server
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path
        },
        '/ws': {
          target: 'http://localhost:3001',
          ws: true,
          changeOrigin: true
        }
      }
    }
  };
});
