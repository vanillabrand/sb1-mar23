import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'stream': 'stream-browserify',
      'buffer': 'buffer',
      'process': 'process/browser',
      'http': 'stream-http',
      'https': 'https-browserify',
      'url': 'url',
      'zlib': 'browserify-zlib',
      'crypto': 'crypto-browserify',
      'events': 'events',
      'util': 'util',
      'http-proxy-agent': 'stream-http',
      'https-proxy-agent': 'https-browserify',
      'socks-proxy-agent': 'stream-http',
      'ws': 'reconnecting-websocket',
      'tls': 'stream-browserify',
      'net': 'net-browserify',
      'node:stream': 'stream-browserify',
      'node:util': 'util',
      'node:buffer': 'buffer',
      'node:net': 'net-browserify',
      'node:events': 'events',
      'node:crypto': 'crypto-browserify',
      'node:http': 'stream-http',
      'node:https': 'https-browserify',
      'node:url': 'url',
      'node:zlib': 'browserify-zlib',
      'node:tls': 'stream-browserify',
      'reconnecting-websocket': 'reconnecting-websocket/dist/reconnecting-websocket.mjs'
    }
  },
  define: {
    'process.env.NODE_DEBUG': 'false',
    'process.platform': JSON.stringify('browser'),
    'process.version': JSON.stringify('v16.0.0'),
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || 
                id.includes('framer-motion') || id.includes('recharts')) {
              return 'vendor';
            }
            if (id.includes('@supabase/supabase-js')) {
              return 'auth';
            }
            if (id.includes('decimal.js') || id.includes('technicalindicators') || id.includes('ccxt')) {
              return 'trading';
            }
            if (id.includes('lucide-react')) {
              return 'ui';
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    target: 'esnext',
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    modulePreload: {
      polyfill: true
    }
  },
  optimizeDeps: {
    include: ['ccxt', 'events', 'util', 'net-browserify', 'reconnecting-websocket'],
    esbuildOptions: {
      target: 'es2020',
      define: {
        global: 'globalThis'
      },
      platform: 'browser'
    }
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  }
});