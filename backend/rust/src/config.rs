use lazy_static::lazy_static;
use serde::Deserialize;
use std::env;
use std::sync::Arc;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    // Server configuration
    pub host: String,
    pub port: u16,
    pub allowed_origins: Vec<String>,
    
    // Database configuration
    pub supabase_url: String,
    pub supabase_anon_key: String,
    
    // API keys
    pub deepseek_api_key: String,
    pub deepseek_api_url: String,
    
    // Exchange configuration
    pub binance_api_key: Option<String>,
    pub binance_api_secret: Option<String>,
    pub binance_testnet_api_key: Option<String>,
    pub binance_testnet_api_secret: Option<String>,
    
    // Exchange URLs
    pub binance_base_url: String,
    pub binance_testnet_base_url: String,
    pub binance_futures_testnet_base_url: String,
    pub binance_testnet_websockets_url: String,
    
    // Application configuration
    pub demo_mode: bool,
    pub trading_enabled: bool,
    pub max_strategies_per_process: usize,
    pub health_check_interval: u64,
    pub market_fit_check_interval: u64,
    pub recovery_attempts: usize,
}

impl Config {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        let mut cfg = config::Config::default();
        
        // Add in settings from environment variables (with a prefix of APP)
        // E.g. `APP_DEBUG=1 ./target/app` would set the `debug` key
        cfg.merge(config::Environment::default())?;
        
        // Deserialize the configuration
        let config = cfg.try_into::<Config>()?;
        
        Ok(config)
    }
    
    pub fn load() -> Self {
        // Load from environment variables with defaults
        Self {
            host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("PORT").unwrap_or_else(|_| "8080".to_string()).parse().unwrap_or(8080),
            allowed_origins: env::var("ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:5173,http://127.0.0.1:5173".to_string())
                .split(',')
                .map(|s| s.to_string())
                .collect(),
            
            supabase_url: env::var("VITE_SUPABASE_URL").expect("VITE_SUPABASE_URL must be set"),
            supabase_anon_key: env::var("VITE_SUPABASE_ANON_KEY").expect("VITE_SUPABASE_ANON_KEY must be set"),
            
            deepseek_api_key: env::var("VITE_DEEPSEEK_API_KEY").unwrap_or_default(),
            deepseek_api_url: env::var("DEEPSEEK_API_URL").unwrap_or_else(|_| "https://api.deepseek.com/v1/chat/completions".to_string()),
            
            binance_api_key: env::var("BINANCE_API_KEY").ok(),
            binance_api_secret: env::var("BINANCE_API_SECRET").ok(),
            binance_testnet_api_key: env::var("BINANCE_TESTNET_API_KEY").ok(),
            binance_testnet_api_secret: env::var("BINANCE_TESTNET_API_SECRET").ok(),
            
            binance_base_url: env::var("BINANCE_BASE_URL").unwrap_or_else(|_| "https://api.binance.com".to_string()),
            binance_testnet_base_url: env::var("BINANCE_TESTNET_BASE_URL").unwrap_or_else(|_| "https://testnet.binance.vision".to_string()),
            binance_futures_testnet_base_url: env::var("BINANCE_FUTURES_TESTNET_BASE_URL").unwrap_or_else(|_| "https://testnet.binancefuture.com".to_string()),
            binance_testnet_websockets_url: env::var("BINANCE_TESTNET_WEBSOCKETS_URL").unwrap_or_else(|_| "wss://testnet.binancefuture.com/ws-fapi/v1".to_string()),
            
            demo_mode: env::var("DEMO_MODE_ENABLED").unwrap_or_else(|_| "true".to_string()).parse().unwrap_or(true),
            trading_enabled: env::var("TRADING_ENABLED").unwrap_or_else(|_| "true".to_string()).parse().unwrap_or(true),
            max_strategies_per_process: env::var("MAX_STRATEGIES_PER_PROCESS").unwrap_or_else(|_| "50".to_string()).parse().unwrap_or(50),
            health_check_interval: env::var("HEALTH_CHECK_INTERVAL").unwrap_or_else(|_| "30000".to_string()).parse().unwrap_or(30000),
            market_fit_check_interval: env::var("MARKET_FIT_CHECK_INTERVAL").unwrap_or_else(|_| "14400000".to_string()).parse().unwrap_or(14400000),
            recovery_attempts: env::var("RECOVERY_ATTEMPTS").unwrap_or_else(|_| "3".to_string()).parse().unwrap_or(3),
        }
    }
}

lazy_static! {
    pub static ref CONFIG: Arc<Config> = Arc::new(Config::load());
}
