use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyBudget {
    pub strategy_id: Uuid,
    pub total: f64,
    pub allocated: f64,
    pub available: f64,
    pub max_position_size: f64,
    pub last_updated: i64,
}
