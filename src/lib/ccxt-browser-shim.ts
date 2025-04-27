/**
 * This file provides browser-compatible shims for CCXT functionality
 * that relies on Node.js-specific modules.
 */

// Create mock implementations of Node.js modules
const nodeCrypto = {
  createHmac: () => {
    throw new Error('crypto.createHmac is not supported in the browser');
  },
  createHash: () => {
    throw new Error('crypto.createHash is not supported in the browser');
  }
};

const nodeHttp = {
  request: () => {
    throw new Error('http.request is not supported in the browser');
  }
};

const nodeHttps = {
  request: () => {
    throw new Error('https.request is not supported in the browser');
  }
};

const nodeFs = {
  readFileSync: () => {
    throw new Error('fs.readFileSync is not supported in the browser');
  }
};

// Export the mock implementations
export const crypto = nodeCrypto;
export const http = nodeHttp;
export const https = nodeHttps;
export const fs = nodeFs;

// Export a browser-compatible version of CCXT
export const createBrowserCompatibleExchange = (exchangeId: string, config: any) => {
  try {
    // In a browser environment, we'll use the REST API through our proxy server
    return {
      id: exchangeId,
      name: exchangeId.charAt(0).toUpperCase() + exchangeId.slice(1),
      fetchBalance: async () => {
        throw new Error('Direct exchange API calls are not supported in the browser. Use the proxy server instead.');
      },
      fetchMarkets: async () => {
        throw new Error('Direct exchange API calls are not supported in the browser. Use the proxy server instead.');
      },
      fetchTicker: async () => {
        throw new Error('Direct exchange API calls are not supported in the browser. Use the proxy server instead.');
      },
      createOrder: async () => {
        throw new Error('Direct exchange API calls are not supported in the browser. Use the proxy server instead.');
      },
      cancelOrder: async () => {
        throw new Error('Direct exchange API calls are not supported in the browser. Use the proxy server instead.');
      }
    };
  } catch (error) {
    console.error('Error creating browser-compatible exchange:', error);
    throw error;
  }
};
