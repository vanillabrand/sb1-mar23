use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::env;
use std::sync::Arc;
use crate::error::ApiError;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    // Server configuration
    pub host: String,
    pub port: u16,
    pub allowed_origins: Vec<String>,

    // Database configuration
    pub supabase_url: String,
    pub supabase_anon_key: String,
    pub supabase_service_key: Option<String>,

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

    // Security configuration
    pub jwt_secret: String,
    pub jwt_expiration_hours: i64,
    pub bcrypt_cost: u32,
    pub rate_limit_requests_per_minute: u32,
    pub max_request_size: usize,
    pub session_timeout_minutes: u64,

    // Logging configuration
    pub log_level: String,
    pub log_format: String,
    pub log_file: Option<String>,

    // Performance configuration
    pub workers: usize,
    pub max_connections: usize,
    pub keep_alive: u64,
    pub client_timeout: u64,

    // External API configuration
    pub external_api_rate_limit: u32,
    pub external_api_timeout: u64,

    // Environment
    pub environment: String,
}

impl Config {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        // Use the new ConfigBuilder API instead of deprecated methods
        let config = config::Config::builder()
            .add_source(config::Environment::default())
            .build()?;

        // Deserialize the configuration
        let config: Config = config.try_deserialize()?;

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
            supabase_service_key: env::var("SUPABASE_SERVICE_KEY").ok(),

            deepseek_api_key: env::var("VITE_DEEPSEEK_API_KEY").unwrap_or_default(),
            deepseek_api_url: env::var("DEEPSEEK_API_URL").unwrap_or_else(|_| "https://api.deepseek.com/v1/chat/completions".to_string()),

            binance_api_key: env::var("BINANCE_API_KEY").ok(),
            binance_api_secret: env::var("BINANCE_API_SECRET").ok(),
            binance_testnet_api_key: env::var("VITE_BINANCE_TESTNET_API_KEY").ok(),
            binance_testnet_api_secret: env::var("VITE_BINANCE_TESTNET_API_SECRET").ok(),

            binance_base_url: env::var("VITE_BINANCE_BASE_URL").unwrap_or_else(|_| "https://api.binance.com".to_string()),
            binance_testnet_base_url: env::var("VITE_BINANCE_TESTNET_BASE_URL").unwrap_or_else(|_| "https://testnet.binance.vision".to_string()),
            binance_futures_testnet_base_url: env::var("VITE_BINANCE_FUTURES_TESTNET_BASE_URL").unwrap_or_else(|_| "https://testnet.binancefuture.com".to_string()),
            binance_testnet_websockets_url: env::var("VITE_BINANCE_TESTNET_WEBSOCKETS_URL").unwrap_or_else(|_| "wss://testnet.binancefuture.com/ws-fapi/v1".to_string()),

            demo_mode: env::var("DEMO_MODE_ENABLED").unwrap_or_else(|_| "true".to_string()).parse().unwrap_or(true),
            trading_enabled: env::var("TRADING_ENABLED").unwrap_or_else(|_| "true".to_string()).parse().unwrap_or(true),
            max_strategies_per_process: env::var("MAX_STRATEGIES_PER_PROCESS").unwrap_or_else(|_| "50".to_string()).parse().unwrap_or(50),
            health_check_interval: env::var("HEALTH_CHECK_INTERVAL").unwrap_or_else(|_| "30000".to_string()).parse().unwrap_or(30000),
            market_fit_check_interval: env::var("MARKET_FIT_CHECK_INTERVAL").unwrap_or_else(|_| "14400000".to_string()).parse().unwrap_or(14400000),
            recovery_attempts: env::var("RECOVERY_ATTEMPTS").unwrap_or_else(|_| "3".to_string()).parse().unwrap_or(3),

            // Security configuration
            jwt_secret: env::var("JWT_SECRET").unwrap_or_else(|_| "your-secret-key-change-in-production".to_string()),
            jwt_expiration_hours: env::var("JWT_EXPIRATION_HOURS").unwrap_or_else(|_| "24".to_string()).parse().unwrap_or(24),
            bcrypt_cost: env::var("BCRYPT_COST").unwrap_or_else(|_| "12".to_string()).parse().unwrap_or(12),
            rate_limit_requests_per_minute: env::var("RATE_LIMIT_RPM").unwrap_or_else(|_| "100".to_string()).parse().unwrap_or(100),
            max_request_size: env::var("MAX_REQUEST_SIZE").unwrap_or_else(|_| "1048576".to_string()).parse().unwrap_or(1048576), // 1MB
            session_timeout_minutes: env::var("SESSION_TIMEOUT_MINUTES").unwrap_or_else(|_| "60".to_string()).parse().unwrap_or(60),

            // Logging configuration
            log_level: env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
            log_format: env::var("LOG_FORMAT").unwrap_or_else(|_| "json".to_string()),
            log_file: env::var("LOG_FILE").ok(),

            // Performance configuration
            workers: env::var("WORKERS").unwrap_or_else(|_| "4".to_string()).parse().unwrap_or(4),
            max_connections: env::var("MAX_CONNECTIONS").unwrap_or_else(|_| "1000".to_string()).parse().unwrap_or(1000),
            keep_alive: env::var("KEEP_ALIVE").unwrap_or_else(|_| "75".to_string()).parse().unwrap_or(75),
            client_timeout: env::var("CLIENT_TIMEOUT").unwrap_or_else(|_| "5000".to_string()).parse().unwrap_or(5000),

            // External API configuration
            external_api_rate_limit: env::var("EXTERNAL_API_RATE_LIMIT").unwrap_or_else(|_| "60".to_string()).parse().unwrap_or(60),
            external_api_timeout: env::var("EXTERNAL_API_TIMEOUT").unwrap_or_else(|_| "30000".to_string()).parse().unwrap_or(30000),

            // Environment
            environment: env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string()),
        }
    }

    pub fn validate(&self) -> Result<(), ApiError> {
        // Validate server config
        if self.port == 0 {
            return Err(ApiError::ConfigError("Invalid port number".to_string()));
        }

        if self.workers == 0 {
            return Err(ApiError::ConfigError("Workers must be greater than 0".to_string()));
        }

        // Validate database config
        if self.supabase_url.is_empty() {
            return Err(ApiError::ConfigError("Supabase URL cannot be empty".to_string()));
        }

        if self.supabase_anon_key.is_empty() {
            return Err(ApiError::ConfigError("Supabase anon key cannot be empty".to_string()));
        }

        // Validate auth config
        if self.jwt_secret.len() < 32 {
            return Err(ApiError::ConfigError("JWT secret must be at least 32 characters".to_string()));
        }

        // Validate security config
        if self.allowed_origins.is_empty() {
            return Err(ApiError::ConfigError("At least one allowed origin must be specified".to_string()));
        }

        if self.rate_limit_requests_per_minute == 0 {
            return Err(ApiError::ConfigError("Rate limit must be greater than 0".to_string()));
        }

        Ok(())
    }

    pub fn is_production(&self) -> bool {
        self.environment == "production"
    }

    pub fn is_development(&self) -> bool {
        self.environment == "development"
    }

    pub fn is_testing(&self) -> bool {
        self.environment == "test"
    }

    pub fn should_use_https(&self) -> bool {
        self.is_production()
    }

    pub fn get_database_url(&self) -> String {
        format!("{}/rest/v1", self.supabase_url)
    }

    pub fn get_log_level(&self) -> tracing::Level {
        match self.log_level.to_lowercase().as_str() {
            "trace" => tracing::Level::TRACE,
            "debug" => tracing::Level::DEBUG,
            "info" => tracing::Level::INFO,
            "warn" => tracing::Level::WARN,
            "error" => tracing::Level::ERROR,
            _ => tracing::Level::INFO,
        }
    }
}

lazy_static! {
    pub static ref CONFIG: Arc<Config> = Arc::new(Config::load());
}
