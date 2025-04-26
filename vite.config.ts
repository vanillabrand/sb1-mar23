import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
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
        }
      },
      // Reduce chunk size warnings threshold
      chunkSizeWarningLimit: 1000
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'chart.js', 'framer-motion']
    },
    // Enable gzip compression
    preview: {
      port: 5173,
      host: '0.0.0.0'
    }
  };
});
