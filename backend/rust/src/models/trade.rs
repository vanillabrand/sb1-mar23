use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    #[serde(default = "Uuid::new_v4")]
    pub id: Uuid,
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
    pub executed_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub order_id: Option<String>,
    #[serde(default = "default_market_type")]
    pub market_type: String,
    pub leverage: Option<f64>,
    pub stop_loss: Option<f64>,
    pub take_profit: Option<f64>,
    pub trailing_stop: Option<f64>,
    #[serde(default = "default_metadata")]
    pub metadata: Value,
}

fn default_market_type() -> String {
    "spot".to_string()
}

fn default_metadata() -> Value {
    serde_json::json!({})
}
