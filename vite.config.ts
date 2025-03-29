import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Default environment variables
const defaultEnvVars = {
  'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  'process.env.NODE_DEBUG': JSON.stringify(process.env.NODE_DEBUG || 'false')
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'events': path.resolve(__dirname, './src/lib/event-emitter.ts'),
      'module': path.resolve(__dirname, './src/lib/module-shim.ts'),
      'url': path.resolve(__dirname, './src/lib/url-shim.ts'),
      'stream': path.resolve(__dirname, './src/lib/stream-shim.ts'),
      'http': path.resolve(__dirname, './src/lib/http-shim.ts'),
      'https': path.resolve(__dirname, './src/lib/https-shim.ts'),
      'assert': path.resolve(__dirname, './src/lib/assert-shim.ts'),
      'ws': path.resolve(__dirname, './src/lib/ws-shim.ts')
    }
  },
  optimizeDeps: {
    include: ['ccxt', 'axios', 'follow-redirects'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
        ...defaultEnvVars
      },
      platform: 'browser',
      target: 'es2020',
    }
  },
  define: {
    ...defaultEnvVars,
    global: 'globalThis'
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        format: 'es'
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://api-cloud-v2.bitmart.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});
