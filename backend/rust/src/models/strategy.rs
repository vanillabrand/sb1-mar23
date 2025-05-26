use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Strategy {
    #[serde(default = "Uuid::new_v4")]
    pub id: Uuid,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[serde(default = "default_type", rename = "type")]
    pub type_: String,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default = "default_risk_level")]
    pub risk_level: String,
    #[serde(default = "default_market_type")]
    pub market_type: String,
    #[serde(default = "default_selected_pairs")]
    pub selected_pairs: Vec<String>,
    #[serde(default = "default_strategy_config")]
    pub strategy_config: Value,
    #[serde(default = "default_performance")]
    pub performance: f64,
    pub last_adapted_at: Option<DateTime<Utc>>,
    #[serde(default = "default_budget")]
    pub budget: f64,
}

impl Strategy {
    pub fn symbols(&self) -> &Vec<String> {
        &self.selected_pairs
    }
}

fn default_type() -> String {
    "custom".to_string()
}

fn default_status() -> String {
    "inactive".to_string()
}

fn default_risk_level() -> String {
    "medium".to_string()
}

fn default_market_type() -> String {
    "spot".to_string()
}

fn default_selected_pairs() -> Vec<String> {
    vec!["BTC/USDT".to_string()]
}

fn default_strategy_config() -> Value {
    serde_json::json!({
        "indicatorType": "momentum",
        "entryConditions": {},
        "exitConditions": {},
        "tradeParameters": {
            "positionSize": 0.1,
            "maxOpenPositions": 1,
            "stopLoss": 2,
            "takeProfit": 4
        }
    })
}

fn default_performance() -> f64 {
    0.0
}

fn default_budget() -> f64 {
    1000.0
}
