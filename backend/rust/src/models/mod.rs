pub mod budget;
pub mod strategy;

pub use budget::*;
pub use strategy::*;

// Additional model definitions
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: Uuid,
    pub user_id: Uuid,
    pub strategy_id: Uuid,
    pub symbol: String,
    pub side: String,
    pub status: String,
    pub amount: f64,
    pub entry_price: Option<f64>,
    pub exit_price: Option<f64>,
    pub profit: Option<f64>,
    pub timestamp: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub executed_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub order_id: Option<String>,
    pub market_type: String,
    pub leverage: Option<f64>,
    pub stop_loss: Option<f64>,
    pub take_profit: Option<f64>,
    pub trailing_stop: Option<f64>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
    pub is_active: bool,
    pub preferences: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeConnection {
    pub id: Uuid,
    pub user_id: Uuid,
    pub exchange_name: String,
    pub api_key: String,
    pub api_secret: String,
    pub passphrase: Option<String>,
    pub sandbox: bool,
    pub is_active: bool,
    pub permissions: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_used: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyPerformance {
    pub id: Uuid,
    pub strategy_id: Uuid,
    pub total_trades: i32,
    pub winning_trades: i32,
    pub losing_trades: i32,
    pub total_profit: f64,
    pub total_loss: f64,
    pub win_rate: f64,
    pub profit_factor: f64,
    pub max_drawdown: f64,
    pub sharpe_ratio: Option<f64>,
    pub sortino_ratio: Option<f64>,
    pub calmar_ratio: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringStatus {
    pub id: Uuid,
    pub strategy_id: Uuid,
    pub status: String,
    pub last_check: DateTime<Utc>,
    pub next_check: DateTime<Utc>,
    pub error_count: i32,
    pub last_error: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKey {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub key_hash: String,
    pub permissions: Vec<String>,
    pub is_active: bool,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub mod market_data {
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct MarketData {
        pub symbol: String,
        pub price: f64,
        pub volume: f64,
        pub change_24h: f64,
        pub timestamp: i64,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct Candle {
        pub timestamp: i64,
        pub open: f64,
        pub high: f64,
        pub low: f64,
        pub close: f64,
        pub volume: f64,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct OrderBook {
        pub symbol: String,
        pub bids: Vec<(f64, f64)>,
        pub asks: Vec<(f64, f64)>,
        pub timestamp: i64,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct Ticker {
        pub symbol: String,
        pub price: f64,
        pub volume: f64,
        pub change_24h: f64,
        pub timestamp: i64,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct MarketState {
        pub symbol: String,
        pub status: String,
        pub base_asset: String,
        pub quote_asset: String,
        pub min_qty: f64,
        pub max_qty: f64,
        pub step_size: f64,
        pub tick_size: f64,
    }
}
