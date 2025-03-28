export const config = {
  nodeEnv: import.meta.env.MODE,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  tradingEnabled: import.meta.env.VITE_TRADING_ENABLED === 'true',
  maxStrategiesPerProcess: parseInt(import.meta.env.VITE_MAX_STRATEGIES_PER_PROCESS || '50', 10),
  healthCheckInterval: parseInt(import.meta.env.VITE_HEALTH_CHECK_INTERVAL || '30000', 10),
  marketFitCheckInterval: parseInt(import.meta.env.VITE_MARKET_FIT_CHECK_INTERVAL || '14400000', 10), // 4 hours
  recoveryAttempts: parseInt(import.meta.env.VITE_RECOVERY_ATTEMPTS || '3', 10)
};