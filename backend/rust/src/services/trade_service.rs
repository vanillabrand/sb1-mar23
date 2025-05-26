use crate::db::SupabaseClient;
use crate::error::ApiError;
use crate::models::Trade;
use crate::services::exchange_service::ExchangeService;
use chrono::Utc;
use rand;
use std::sync::Arc;

pub struct TradeService {
    db: Arc<SupabaseClient>,
    exchange: Arc<ExchangeService>,
}

impl TradeService {
    pub fn new(
        db: Arc<SupabaseClient>,
        exchange: Arc<ExchangeService>,
    ) -> Self {
        Self {
            db,
            exchange,
        }
    }

    // Get all trades
    pub async fn get_trades(&self, strategy_id: Option<&str>, user_id: Option<&str>) -> Result<Vec<Trade>, ApiError> {
        crate::db::fetch_trades(&self.db, strategy_id, user_id).await
    }

    // Get a trade by ID
    pub async fn get_trade(&self, id: &str) -> Result<Trade, ApiError> {
        crate::db::fetch_trade_by_id(&self.db, id).await
    }

    // Create a new trade
    pub async fn create_trade(&self, trade: Trade) -> Result<Trade, ApiError> {
        // For now, just create the trade without budget checking
        // Budget checking can be done at the service layer
        crate::db::create_trade(&self.db, trade).await
    }

    // Update a trade
    pub async fn update_trade(&self, id: &str, trade: Trade) -> Result<Trade, ApiError> {
        crate::db::update_trade(&self.db, id, trade).await
    }

    // Delete a trade
    pub async fn delete_trade(&self, id: &str) -> Result<(), ApiError> {
        crate::db::delete_trade(&self.db, id).await
    }

    // Execute a trade
    pub async fn execute_trade(&self, id: &str) -> Result<Trade, ApiError> {
        // Get the trade
        let mut trade = self.get_trade(id).await?;

        // Check if trade is already executed
        if trade.status != "pending" {
            return Err(ApiError::Validation(format!(
                "Trade {} cannot be executed because it is in {} state",
                id, trade.status
            )));
        }

        // For demo mode, just simulate execution
        trade.status = "open".to_string();
        trade.executed_at = Some(Utc::now());

        // Update in database
        self.update_trade(id, trade).await
    }

    // Close a trade
    pub async fn close_trade(&self, id: &str) -> Result<Trade, ApiError> {
        // Get the trade
        let mut trade = self.get_trade(id).await?;

        // Check if trade is open
        if trade.status != "open" {
            return Err(ApiError::Validation(format!(
                "Trade {} cannot be closed because it is in {} state",
                id, trade.status
            )));
        }

        // For demo mode, simulate closing with random profit/loss
        let entry_value = trade.amount * trade.entry_price.unwrap_or(0.0);
        let exit_price = trade.entry_price.unwrap_or(0.0) * (0.95 + rand::random::<f64>() * 0.1); // ±5% random
        let exit_value = trade.amount * exit_price;

        let profit = if trade.side == "buy" {
            exit_value - entry_value
        } else {
            entry_value - exit_value
        };

        // Update trade with closing details
        trade.status = "closed".to_string();
        trade.exit_price = Some(exit_price);
        trade.profit = Some(profit);
        trade.closed_at = Some(Utc::now());

        // Update in database
        self.update_trade(id, trade).await
    }

    pub async fn generate_trades(&self, strategy_id: &str, user_id: &str, market_data: serde_json::Value) -> Result<Vec<Trade>, ApiError> {
        // Mock implementation - generate sample trades based on market data
        let trades = vec![
            Trade {
                id: uuid::Uuid::new_v4(),
                user_id: uuid::Uuid::parse_str(user_id).map_err(|_| ApiError::Validation("Invalid user ID".to_string()))?,
                strategy_id: uuid::Uuid::parse_str(strategy_id).map_err(|_| ApiError::Validation("Invalid strategy ID".to_string()))?,
                symbol: "BTC/USDT".to_string(),
                side: "buy".to_string(),
                status: "pending".to_string(),
                amount: 0.05,
                entry_price: Some(49500.0),
                exit_price: None,
                profit: None,
                timestamp: chrono::Utc::now().timestamp_millis(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                executed_at: None,
                closed_at: None,
                order_id: None,
                market_type: "spot".to_string(),
                leverage: None,
                stop_loss: Some(48000.0),
                take_profit: Some(52000.0),
                trailing_stop: None,
                metadata: serde_json::json!({"generated_by": "deepseek", "market_data": market_data}),
            },
            Trade {
                id: uuid::Uuid::new_v4(),
                user_id: uuid::Uuid::parse_str(user_id).map_err(|_| ApiError::Validation("Invalid user ID".to_string()))?,
                strategy_id: uuid::Uuid::parse_str(strategy_id).map_err(|_| ApiError::Validation("Invalid strategy ID".to_string()))?,
                symbol: "ETH/USDT".to_string(),
                side: "sell".to_string(),
                status: "pending".to_string(),
                amount: 1.0,
                entry_price: Some(3200.0),
                exit_price: None,
                profit: None,
                timestamp: chrono::Utc::now().timestamp_millis(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                executed_at: None,
                closed_at: None,
                order_id: None,
                market_type: "spot".to_string(),
                leverage: None,
                stop_loss: Some(3300.0),
                take_profit: Some(3000.0),
                trailing_stop: None,
                metadata: serde_json::json!({"generated_by": "deepseek", "market_data": market_data}),
            }
        ];

        // Create trades in database
        let mut created_trades = Vec::new();
        for trade in trades {
            let created_trade = crate::db::create_trade(&self.db, trade).await?;
            created_trades.push(created_trade);
        }

        Ok(created_trades)
    }

}
