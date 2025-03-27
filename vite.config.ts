import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@floating-ui/react',
      'reconnecting-websocket',
      'ccxt',
      'technicalindicators'
    ],
    exclude: ['fsevents']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'technicalindicators': path.resolve(__dirname, 'node_modules/technicalindicators/dist/index.js')
    }
  },
  server: {
    watch: {
      usePolling: true
    }
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/technicalindicators/, /node_modules/]
    }
  }
});
