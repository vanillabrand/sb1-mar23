use crate::db::SupabaseClient;
use crate::error::ApiError;
use crate::models::{Strategy, StrategyBudget};
use crate::services::deepseek_service::DeepseekService;
use chrono::{DateTime, Utc};
use serde_json::Value;
use std::sync::Arc;
use uuid::Uuid;

pub struct StrategyService {
    db: Arc<SupabaseClient>,
    deepseek: Arc<DeepseekService>,
}

impl StrategyService {
    pub fn new(db: Arc<SupabaseClient>, deepseek: Arc<DeepseekService>) -> Self {
        Self { db, deepseek }
    }
    
    // Get all strategies for a user
    pub async fn get_strategies(&self, user_id: &str) -> Result<Vec<Strategy>, ApiError> {
        crate::db::fetch_strategies(&self.db, Some(user_id)).await
    }
    
    // Get a strategy by ID
    pub async fn get_strategy(&self, id: &str) -> Result<Strategy, ApiError> {
        crate::db::fetch_strategy_by_id(&self.db, id).await
    }
    
    // Create a new strategy
    pub async fn create_strategy(&self, strategy: Strategy) -> Result<Strategy, ApiError> {
        let strategy = crate::db::create_strategy(&self.db, strategy).await?;
        
        // Initialize budget for the strategy
        self.initialize_budget(strategy.id.to_string().as_str()).await?;
        
        Ok(strategy)
    }
    
    // Update a strategy
    pub async fn update_strategy(&self, id: &str, strategy: Strategy) -> Result<Strategy, ApiError> {
        crate::db::update_strategy(&self.db, id, strategy).await
    }
    
    // Delete a strategy
    pub async fn delete_strategy(&self, id: &str) -> Result<(), ApiError> {
        crate::db::delete_strategy(&self.db, id).await
    }
    
    // Activate a strategy
    pub async fn activate_strategy(&self, id: &str) -> Result<Strategy, ApiError> {
        // Get the strategy
        let mut strategy = self.get_strategy(id).await?;
        
        // Update status
        strategy.status = "active".to_string();
        strategy.updated_at = Some(Utc::now());
        
        // Update in database
        self.update_strategy(id, strategy).await
    }
    
    // Deactivate a strategy
    pub async fn deactivate_strategy(&self, id: &str) -> Result<Strategy, ApiError> {
        // Get the strategy
        let mut strategy = self.get_strategy(id).await?;
        
        // Update status
        strategy.status = "inactive".to_string();
        strategy.updated_at = Some(Utc::now());
        
        // Update in database
        self.update_strategy(id, strategy).await
    }
    
    // Adapt a strategy using Deepseek
    pub async fn adapt_strategy(&self, id: &str, market_data: Value) -> Result<Strategy, ApiError> {
        // Get the strategy
        let mut strategy = self.get_strategy(id).await?;
        
        // Call Deepseek to adapt the strategy
        let adapted_config = self.deepseek.adapt_strategy(&strategy, &market_data).await?;
        
        // Update strategy with adapted configuration
        strategy.strategy_config = adapted_config;
        strategy.updated_at = Some(Utc::now());
        strategy.last_adapted_at = Some(Utc::now());
        
        // Update in database
        self.update_strategy(id, strategy).await
    }
    
    // Get budget for a strategy
    pub async fn get_budget(&self, strategy_id: &str) -> Result<StrategyBudget, ApiError> {
        let response = self.db.client
            .from("strategy_budgets")
            .select("*")
            .eq("strategy_id", strategy_id)
            .limit(1)
            .execute()
            .await
            .map_err(|e| ApiError::Database(format!("Failed to fetch budget: {}", e)))?;
        
        let budgets: Vec<StrategyBudget> = response.json().await
            .map_err(|e| ApiError::Database(format!("Failed to parse budget: {}", e)))?;
        
        budgets.into_iter().next()
            .ok_or_else(|| ApiError::NotFound(format!("Budget for strategy {} not found", strategy_id)))
    }
    
    // Update budget for a strategy
    pub async fn update_budget(&self, strategy_id: &str, budget: StrategyBudget) -> Result<StrategyBudget, ApiError> {
        let response = self.db.client
            .from("strategy_budgets")
            .eq("strategy_id", strategy_id)
            .update(serde_json::to_string(&budget)?)
            .execute()
            .await
            .map_err(|e| ApiError::Database(format!("Failed to update budget: {}", e)))?;
        
        let budgets: Vec<StrategyBudget> = response.json().await
            .map_err(|e| ApiError::Database(format!("Failed to parse updated budget: {}", e)))?;
        
        budgets.into_iter().next()
            .ok_or_else(|| ApiError::NotFound(format!("Budget for strategy {} not found", strategy_id)))
    }
    
    // Initialize budget for a strategy
    async fn initialize_budget(&self, strategy_id: &str) -> Result<StrategyBudget, ApiError> {
        // Create default budget
        let budget = StrategyBudget {
            strategy_id: Uuid::parse_str(strategy_id).map_err(|_| ApiError::Validation("Invalid strategy ID".to_string()))?,
            total: 0.0,
            allocated: 0.0,
            available: 0.0,
            max_position_size: 0.0,
            last_updated: Utc::now().timestamp(),
        };
        
        // Insert into database
        let response = self.db.client
            .from("strategy_budgets")
            .insert(serde_json::to_string(&budget)?)
            .execute()
            .await
            .map_err(|e| ApiError::Database(format!("Failed to initialize budget: {}", e)))?;
        
        let budgets: Vec<StrategyBudget> = response.json().await
            .map_err(|e| ApiError::Database(format!("Failed to parse initialized budget: {}", e)))?;
        
        budgets.into_iter().next()
            .ok_or_else(|| ApiError::Database("Failed to initialize budget".to_string()))
    }
}
