use crate::db::SupabaseClient;
use crate::error::ApiError;
use crate::models::{Strategy, Trade, StrategyBudget};
use crate::services::deepseek_service::DeepseekService;
use crate::services::exchange_service::ExchangeService;
use crate::services::strategy_service::StrategyService;
use chrono::{DateTime, Utc};
use serde_json::Value;
use std::sync::Arc;
use uuid::Uuid;

pub struct TradeService {
    db: Arc<SupabaseClient>,
    deepseek: Arc<DeepseekService>,
    exchange: Arc<ExchangeService>,
    strategy_service: Arc<StrategyService>,
}

impl TradeService {
    pub fn new(
        db: Arc<SupabaseClient>,
        deepseek: Arc<DeepseekService>,
        exchange: Arc<ExchangeService>,
        strategy_service: Arc<StrategyService>,
    ) -> Self {
        Self {
            db,
            deepseek,
            exchange,
            strategy_service,
        }
    }
    
    // Get all trades
    pub async fn get_trades(&self, strategy_id: Option<&str>, status: Option<&str>) -> Result<Vec<Trade>, ApiError> {
        crate::db::fetch_trades(&self.db, strategy_id, status).await
    }
    
    // Get a trade by ID
    pub async fn get_trade(&self, id: &str) -> Result<Trade, ApiError> {
        crate::db::fetch_trade_by_id(&self.db, id).await
    }
    
    // Create a new trade
    pub async fn create_trade(&self, trade: Trade) -> Result<Trade, ApiError> {
        // Check if there's enough budget
        let strategy_id = trade.strategy_id.to_string();
        let budget = self.strategy_service.get_budget(&strategy_id).await?;
        
        let trade_cost = trade.amount * trade.entry_price.unwrap_or(0.0);
        
        if trade_cost > budget.available {
            return Err(ApiError::Validation(format!(
                "Not enough budget. Required: {}, Available: {}",
                trade_cost, budget.available
            )));
        }
        
        // Create the trade
        let trade = crate::db::create_trade(&self.db, trade).await?;
        
        // Update budget
        let mut updated_budget = budget;
        updated_budget.allocated += trade_cost;
        updated_budget.available -= trade_cost;
        updated_budget.last_updated = Utc::now().timestamp();
        
        self.strategy_service.update_budget(&strategy_id, updated_budget).await?;
        
        Ok(trade)
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
        
        // Execute the trade on the exchange
        let order = self.exchange.create_order(
            &trade.symbol,
            &trade.side,
            trade.amount,
            trade.entry_price,
            trade.market_type == "futures",
            trade.leverage,
        ).await?;
        
        // Update trade with execution details
        trade.status = "open".to_string();
        trade.entry_price = Some(order.price);
        trade.executed_at = Some(Utc::now());
        trade.order_id = Some(order.id.clone());
        
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
        
        // Get current price
        let ticker = self.exchange.get_ticker(&trade.symbol).await?;
        
        // Close the trade on the exchange
        let close_side = if trade.side == "buy" { "sell" } else { "buy" };
        
        let order = self.exchange.create_order(
            &trade.symbol,
            close_side,
            trade.amount,
            None,
            trade.market_type == "futures",
            trade.leverage,
        ).await?;
        
        // Calculate profit/loss
        let entry_value = trade.amount * trade.entry_price.unwrap_or(0.0);
        let exit_value = trade.amount * order.price;
        
        let profit = if trade.side == "buy" {
            exit_value - entry_value
        } else {
            entry_value - exit_value
        };
        
        // Update trade with closing details
        trade.status = "closed".to_string();
        trade.exit_price = Some(order.price);
        trade.profit = Some(profit);
        trade.closed_at = Some(Utc::now());
        
        // Update in database
        let updated_trade = self.update_trade(id, trade).await?;
        
        // Update budget
        let strategy_id = updated_trade.strategy_id.to_string();
        let mut budget = self.strategy_service.get_budget(&strategy_id).await?;
        
        let trade_cost = updated_trade.amount * updated_trade.entry_price.unwrap_or(0.0);
        
        budget.allocated -= trade_cost;
        budget.available += trade_cost + updated_trade.profit.unwrap_or(0.0);
        budget.last_updated = Utc::now().timestamp();
        
        self.strategy_service.update_budget(&strategy_id, budget).await?;
        
        Ok(updated_trade)
    }
    
    // Generate trades for a strategy
    pub async fn generate_trades(&self, strategy_id: &str, market_data: Value) -> Result<Vec<Trade>, ApiError> {
        // Get the strategy
        let strategy = self.strategy_service.get_strategy(strategy_id).await?;
        
        // Get the budget
        let budget = self.strategy_service.get_budget(strategy_id).await?;
        
        // Call Deepseek to generate trades
        let trades = self.deepseek.generate_trades(&strategy, &market_data, budget.available).await?;
        
        // Create trades in database
        let mut created_trades = Vec::new();
        let mut total_cost = 0.0;
        
        for trade in trades {
            // Check if there's enough budget left
            let trade_cost = trade.amount * trade.entry_price.unwrap_or(0.0);
            
            if total_cost + trade_cost > budget.available {
                continue; // Skip this trade
            }
            
            // Create the trade
            let created_trade = self.create_trade(trade).await?;
            
            total_cost += trade_cost;
            created_trades.push(created_trade);
        }
        
        Ok(created_trades)
    }
}
