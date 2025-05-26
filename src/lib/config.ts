export const config = {
  nodeEnv: import.meta.env.MODE,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  tradingEnabled: import.meta.env.VITE_TRADING_ENABLED === 'true',
  maxStrategiesPerProcess: parseInt(import.meta.env.VITE_MAX_STRATEGIES_PER_PROCESS || '50', 10),
  healthCheckInterval: parseInt(import.meta.env.VITE_HEALTH_CHECK_INTERVAL || '30000', 10),
  marketFitCheckInterval: parseInt(import.meta.env.VITE_MARKET_FIT_CHECK_INTERVAL || '14400000', 10), // 4 hours
  recoveryAttempts: parseInt(import.meta.env.VITE_RECOVERY_ATTEMPTS || '3', 10),

  // Performance optimization flags
  DEMO_MODE: import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.VITE_FAST_INIT === 'true' ? true : false,
  FAST_INIT: import.meta.env.VITE_FAST_INIT === 'false' ? false : true, // Default to true for faster loading
  LAZY_LOAD_SERVICES: import.meta.env.VITE_LAZY_LOAD_SERVICES === 'false' ? false : true, // Default to true for faster loading
  INITIALIZATION_TIMEOUT: parseInt(import.meta.env.VITE_INITIALIZATION_TIMEOUT || '5000', 10), // 5 seconds timeout for initialization

  // API URLs - Updated to use Rust API
  apiBaseUrl: 'http://localhost:3000/api', // Base URL for Rust Trading API
  rustApiUrl: 'http://localhost:3000', // Rust Trading API base URL
  proxyUrl: import.meta.env.VITE_PROXY_URL || '',
  proxyBaseUrl: import.meta.env.VITE_PROXY_BASE_URL || '', // Base URL for the proxy server - empty string means use relative URLs

  // External API endpoints through proxy
  binanceApiUrl: '/api/binance',
  binanceTestnetApiUrl: '/api/binanceTestnet',
  binanceFuturesApiUrl: '/api/binanceFutures',
  bitmartApiUrl: '/api/bitmart',
  coincapApiUrl: '/api/coincap',
  kucoinApiUrl: '/api/kucoin',
  kucoinSandboxApiUrl: '/api/kucoinSandbox',

  // External API endpoints (direct)
  deepseekApiUrl: '/api/deepseek', // Use proxy for DeepSeek API without trailing slash

  // Log configuration on startup
  logConfig: function() {
    console.log('Config initialized:', {
      nodeEnv: this.nodeEnv,
      tradingEnabled: this.tradingEnabled,
      apiBaseUrl: this.apiBaseUrl,
      proxyUrl: this.proxyUrl,
      proxyBaseUrl: this.proxyBaseUrl,
      deepseekApiUrl: this.deepseekApiUrl,
      fullDeepseekUrl: this.getFullUrl(this.deepseekApiUrl),
      // Performance optimization flags
      DEMO_MODE: this.DEMO_MODE,
      FAST_INIT: this.FAST_INIT,
      LAZY_LOAD_SERVICES: this.LAZY_LOAD_SERVICES,
      INITIALIZATION_TIMEOUT: this.INITIALIZATION_TIMEOUT
    });
  },

  // Function to get the full URL for an API endpoint
  getFullUrl: function(endpoint: string): string {
    // If endpoint already starts with a slash, don't add another one
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.proxyBaseUrl}${formattedEndpoint}`;
  }
};