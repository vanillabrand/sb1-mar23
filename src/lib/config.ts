export const config = {
  nodeEnv: import.meta.env.MODE,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  tradingEnabled: import.meta.env.VITE_TRADING_ENABLED === 'true',
  maxStrategiesPerProcess: parseInt(import.meta.env.VITE_MAX_STRATEGIES_PER_PROCESS || '50', 10),
  healthCheckInterval: parseInt(import.meta.env.VITE_HEALTH_CHECK_INTERVAL || '30000', 10),
  marketFitCheckInterval: parseInt(import.meta.env.VITE_MARKET_FIT_CHECK_INTERVAL || '14400000', 10), // 4 hours
  recoveryAttempts: parseInt(import.meta.env.VITE_RECOVERY_ATTEMPTS || '3', 10),

  // API URLs
  apiBaseUrl: '/api', // Base URL for all API requests through the proxy server
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
  deepseekApiUrl: '/api/deepseek/', // Use proxy for DeepSeek API with trailing slash

  // Function to get the full URL for an API endpoint
  getFullUrl: function(endpoint: string): string {
    return `${this.proxyBaseUrl}${endpoint}`;
  }
};