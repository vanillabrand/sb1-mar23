export const config = {
  port: process.env.PORT || 3002,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
  tradingEnabled: process.env.TRADING_ENABLED === 'true',
  maxStrategiesPerProcess: parseInt(process.env.MAX_STRATEGIES_PER_PROCESS || '50', 10),
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
  marketFitCheckInterval: parseInt(process.env.MARKET_FIT_CHECK_INTERVAL || '14400000', 10), // 4 hours
  recoveryAttempts: parseInt(process.env.RECOVERY_ATTEMPTS || '3', 10),
  allowedOrigins: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174'
  ]
};