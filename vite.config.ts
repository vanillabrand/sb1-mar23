import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Helper to get the Codespace URL
const getCodespaceUrl = () => {
  if (process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
    return `https://${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
  }
  return 'http://localhost:3000';
};

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['ccxt'],
    esbuildOptions: {
      target: 'es2020'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    target: 'es2020',
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/node_modules/]
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
    hmr: {
      clientPort: 443
    }
  },
  define: {
    'process.env.PROXY_URL': JSON.stringify(getCodespaceUrl())
  }
});
