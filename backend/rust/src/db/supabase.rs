use crate::error::ApiError;
use crate::models::{Strategy, Trade, StrategyBudget, User};
use postgrest::Postgrest;
use serde_json::Value;
use std::env;
use tracing::{info, warn, error, debug};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Clone)]
pub struct SupabaseClient {
    client: Postgrest,
    url: String,
    anon_key: String,
    service_key: Option<String>,
}

impl SupabaseClient {
    pub fn new() -> Result<Self, ApiError> {
        let url = env::var("VITE_SUPABASE_URL")
            .map_err(|_| ApiError::ConfigError("VITE_SUPABASE_URL not set".to_string()))?;
        let anon_key = env::var("VITE_SUPABASE_ANON_KEY")
            .map_err(|_| ApiError::ConfigError("VITE_SUPABASE_ANON_KEY not set".to_string()))?;
        let service_key = env::var("SUPABASE_SERVICE_KEY").ok();

        // Use service key for server-side operations if available, otherwise use anon key
        let auth_key = service_key.as_ref().unwrap_or(&anon_key);

        let client = Postgrest::new(format!("{}/rest/v1", url))
            .insert_header("apikey", auth_key)
            .insert_header("Authorization", format!("Bearer {}", auth_key))
            .insert_header("Content-Type", "application/json")
            .insert_header("Prefer", "return=representation");

        info!("Initialized Supabase client with URL: {}", url);

        Ok(Self {
            client,
            url,
            anon_key,
            service_key,
        })
    }

    pub fn client(&self) -> &Postgrest {
        &self.client
    }

    pub async fn health_check(&self) -> Result<(), ApiError> {
        debug!("Performing Supabase health check");

        let response = self.client
            .from("strategies")
            .select("id")
            .limit(1)
            .execute()
            .await
            .map_err(|e| {
                error!("Health check failed: {}", e);
                ApiError::Database(format!("Health check failed: {}", e))
            })?;

        if response.status().is_success() {
            info!("Supabase health check passed");
            Ok(())
        } else {
            error!("Supabase health check failed with status: {}", response.status());
            Err(ApiError::Database("Health check failed".to_string()))
        }
    }

    // Create a client with user context for RLS
    pub fn with_user_context(&self, user_id: &str) -> Self {
        let mut client = self.client.clone();
        client = client.insert_header("X-User-ID", user_id);

        Self {
            client,
            url: self.url.clone(),
            anon_key: self.anon_key.clone(),
            service_key: self.service_key.clone(),
        }
    }
}

impl Default for SupabaseClient {
    fn default() -> Self {
        // Create a mock client for demo purposes
        let mock_url = "https://mock.supabase.co";
        let mock_key = "mock_key";

        let client = Postgrest::new(format!("{}/rest/v1", mock_url))
            .insert_header("apikey", mock_key)
            .insert_header("Authorization", format!("Bearer {}", mock_key))
            .insert_header("Content-Type", "application/json")
            .insert_header("Prefer", "return=representation");

        Self {
            client,
            url: mock_url.to_string(),
            anon_key: mock_key.to_string(),
            service_key: None,
        }
    }
}

// Database helper functions
pub async fn init_db_pool() -> Result<SupabaseClient, ApiError> {
    SupabaseClient::new()
}

// Strategy functions
pub async fn fetch_strategies(db: &SupabaseClient, user_id: Option<&str>) -> Result<Vec<Strategy>, ApiError> {
    debug!("Fetching strategies for user: {:?}", user_id);

    let mut query = db.client
        .from("strategies")
        .select("*");

    if let Some(uid) = user_id {
        query = query.eq("user_id", uid);
    }

    let response = query
        .order("created_at.desc")
        .execute()
        .await
        .map_err(|e| {
            error!("Failed to fetch strategies: {}", e);
            ApiError::Database(format!("Failed to fetch strategies: {}", e))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase error {}: {}", status, body);
        return Err(ApiError::Database(format!("Database error: {} - {}", status, body)));
    }

    let strategies: Vec<Strategy> = response
        .json()
        .await
        .map_err(|e| {
            error!("Failed to parse strategies response: {}", e);
            ApiError::Database(format!("Failed to parse strategies: {}", e))
        })?;

    info!("Successfully fetched {} strategies", strategies.len());
    Ok(strategies)
}

pub async fn fetch_strategy_by_id(db: &SupabaseClient, id: &str) -> Result<Strategy, ApiError> {
    debug!("Fetching strategy by ID: {}", id);

    let response = db.client
        .from("strategies")
        .select("*")
        .eq("id", id)
        .limit(1)
        .execute()
        .await
        .map_err(|e| {
            error!("Failed to fetch strategy {}: {}", id, e);
            ApiError::Database(format!("Failed to fetch strategy: {}", e))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase error {}: {}", status, body);
        return Err(ApiError::Database(format!("Database error: {} - {}", status, body)));
    }

    let strategies: Vec<Strategy> = response
        .json()
        .await
        .map_err(|e| {
            error!("Failed to parse strategy response: {}", e);
            ApiError::Database(format!("Failed to parse strategy: {}", e))
        })?;

    strategies
        .into_iter()
        .next()
        .ok_or_else(|| {
            warn!("Strategy {} not found", id);
            ApiError::NotFound(format!("Strategy with id {} not found", id))
        })
}

pub async fn create_strategy(db: &SupabaseClient, strategy: Strategy) -> Result<Strategy, ApiError> {
    debug!("Creating strategy: {}", strategy.name);

    let strategy_json = serde_json::to_string(&strategy)
        .map_err(|e| ApiError::Validation(format!("Failed to serialize strategy: {}", e)))?;

    let response = db.client
        .from("strategies")
        .insert(strategy_json)
        .execute()
        .await
        .map_err(|e| {
            error!("Failed to create strategy: {}", e);
            ApiError::Database(format!("Failed to create strategy: {}", e))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase error {}: {}", status, body);
        return Err(ApiError::Database(format!("Database error: {} - {}", status, body)));
    }

    let strategies: Vec<Strategy> = response
        .json()
        .await
        .map_err(|e| {
            error!("Failed to parse created strategy response: {}", e);
            ApiError::Database(format!("Failed to parse created strategy: {}", e))
        })?;

    let created_strategy = strategies
        .into_iter()
        .next()
        .ok_or_else(|| ApiError::Database("Failed to create strategy".to_string()))?;

    info!("Successfully created strategy with ID: {}", created_strategy.id);
    Ok(created_strategy)
}

pub async fn update_strategy(db: &SupabaseClient, id: &str, strategy: Strategy) -> Result<Strategy, ApiError> {
    debug!("Updating strategy: {}", id);

    let strategy_json = serde_json::to_string(&strategy)
        .map_err(|e| ApiError::Validation(format!("Failed to serialize strategy: {}", e)))?;

    let response = db.client
        .from("strategies")
        .eq("id", id)
        .update(strategy_json)
        .execute()
        .await
        .map_err(|e| {
            error!("Failed to update strategy {}: {}", id, e);
            ApiError::Database(format!("Failed to update strategy: {}", e))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase error {}: {}", status, body);
        return Err(ApiError::Database(format!("Database error: {} - {}", status, body)));
    }

    let strategies: Vec<Strategy> = response
        .json()
        .await
        .map_err(|e| {
            error!("Failed to parse updated strategy response: {}", e);
            ApiError::Database(format!("Failed to parse updated strategy: {}", e))
        })?;

    let updated_strategy = strategies
        .into_iter()
        .next()
        .ok_or_else(|| {
            warn!("Strategy {} not found for update", id);
            ApiError::NotFound(format!("Strategy with id {} not found", id))
        })?;

    info!("Successfully updated strategy: {}", id);
    Ok(updated_strategy)
}

pub async fn delete_strategy(db: &SupabaseClient, id: &str) -> Result<(), ApiError> {
    debug!("Deleting strategy: {}", id);

    // First, delete related trades
    let _ = db.client
        .from("trades")
        .eq("strategy_id", id)
        .delete()
        .execute()
        .await;

    // Delete strategy performance
    let _ = db.client
        .from("strategy_performance")
        .eq("strategy_id", id)
        .delete()
        .execute()
        .await;

    // Delete strategy budget
    let _ = db.client
        .from("strategy_budgets")
        .eq("strategy_id", id)
        .delete()
        .execute()
        .await;

    // Finally, delete the strategy
    let response = db.client
        .from("strategies")
        .eq("id", id)
        .delete()
        .execute()
        .await
        .map_err(|e| {
            error!("Failed to delete strategy {}: {}", id, e);
            ApiError::Database(format!("Failed to delete strategy: {}", e))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase error {}: {}", status, body);
        return Err(ApiError::Database(format!("Database error: {} - {}", status, body)));
    }

    info!("Successfully deleted strategy: {}", id);
    Ok(())
}

// Trade functions
pub async fn fetch_trades(db: &SupabaseClient, strategy_id: Option<&str>, user_id: Option<&str>) -> Result<Vec<Trade>, ApiError> {
    debug!("Fetching trades for strategy: {:?}, user: {:?}", strategy_id, user_id);

    let mut query = db.client
        .from("trades")
        .select("*");

    if let Some(sid) = strategy_id {
        query = query.eq("strategy_id", sid);
    }

    if let Some(uid) = user_id {
        query = query.eq("user_id", uid);
    }

    let response = query
        .order("created_at.desc")
        .execute()
        .await
        .map_err(|e| {
            error!("Failed to fetch trades: {}", e);
            ApiError::Database(format!("Failed to fetch trades: {}", e))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase error {}: {}", status, body);
        return Err(ApiError::Database(format!("Database error: {} - {}", status, body)));
    }

    let trades: Vec<Trade> = response
        .json()
        .await
        .map_err(|e| {
            error!("Failed to parse trades response: {}", e);
            ApiError::Database(format!("Failed to parse trades: {}", e))
        })?;

    info!("Successfully fetched {} trades", trades.len());
    Ok(trades)
}

pub async fn fetch_trade_by_id(db: &SupabaseClient, id: &str) -> Result<Trade, ApiError> {
    debug!("Fetching trade by ID: {}", id);

    let response = db.client
        .from("trades")
        .select("*")
        .eq("id", id)
        .limit(1)
        .execute()
        .await
        .map_err(|e| {
            error!("Failed to fetch trade {}: {}", id, e);
            ApiError::Database(format!("Failed to fetch trade: {}", e))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase error {}: {}", status, body);
        return Err(ApiError::Database(format!("Database error: {} - {}", status, body)));
    }

    let trades: Vec<Trade> = response
        .json()
        .await
        .map_err(|e| {
            error!("Failed to parse trade response: {}", e);
            ApiError::Database(format!("Failed to parse trade: {}", e))
        })?;

    trades
        .into_iter()
        .next()
        .ok_or_else(|| {
            warn!("Trade {} not found", id);
            ApiError::NotFound(format!("Trade with id {} not found", id))
        })
}

pub async fn create_trade(db: &SupabaseClient, trade: Trade) -> Result<Trade, ApiError> {
    debug!("Creating trade for strategy: {}", trade.strategy_id);

    let trade_json = serde_json::to_string(&trade)
        .map_err(|e| ApiError::Validation(format!("Failed to serialize trade: {}", e)))?;

    let response = db.client
        .from("trades")
        .insert(trade_json)
        .execute()
        .await
        .map_err(|e| {
            error!("Failed to create trade: {}", e);
            ApiError::Database(format!("Failed to create trade: {}", e))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase error {}: {}", status, body);
        return Err(ApiError::Database(format!("Database error: {} - {}", status, body)));
    }

    let trades: Vec<Trade> = response
        .json()
        .await
        .map_err(|e| {
            error!("Failed to parse created trade response: {}", e);
            ApiError::Database(format!("Failed to parse created trade: {}", e))
        })?;

    let created_trade = trades
        .into_iter()
        .next()
        .ok_or_else(|| ApiError::Database("Failed to create trade".to_string()))?;

    info!("Successfully created trade with ID: {}", created_trade.id);
    Ok(created_trade)
}

pub async fn update_trade(db: &SupabaseClient, id: &str, trade: Trade) -> Result<Trade, ApiError> {
    debug!("Updating trade: {}", id);

    let trade_json = serde_json::to_string(&trade)
        .map_err(|e| ApiError::Validation(format!("Failed to serialize trade: {}", e)))?;

    let response = db.client
        .from("trades")
        .eq("id", id)
        .update(trade_json)
        .execute()
        .await
        .map_err(|e| {
            error!("Failed to update trade {}: {}", id, e);
            ApiError::Database(format!("Failed to update trade: {}", e))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase error {}: {}", status, body);
        return Err(ApiError::Database(format!("Database error: {} - {}", status, body)));
    }

    let trades: Vec<Trade> = response
        .json()
        .await
        .map_err(|e| {
            error!("Failed to parse updated trade response: {}", e);
            ApiError::Database(format!("Failed to parse updated trade: {}", e))
        })?;

    let updated_trade = trades
        .into_iter()
        .next()
        .ok_or_else(|| {
            warn!("Trade {} not found for update", id);
            ApiError::NotFound(format!("Trade with id {} not found", id))
        })?;

    info!("Successfully updated trade: {}", id);
    Ok(updated_trade)
}

pub async fn delete_trade(db: &SupabaseClient, id: &str) -> Result<(), ApiError> {
    debug!("Deleting trade: {}", id);

    let response = db.client
        .from("trades")
        .eq("id", id)
        .delete()
        .execute()
        .await
        .map_err(|e| {
            error!("Failed to delete trade {}: {}", id, e);
            ApiError::Database(format!("Failed to delete trade: {}", e))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase error {}: {}", status, body);
        return Err(ApiError::Database(format!("Database error: {} - {}", status, body)));
    }

    info!("Successfully deleted trade: {}", id);
    Ok(())
}

// Budget functions
pub async fn fetch_strategy_budget(db: &SupabaseClient, strategy_id: &str) -> Result<StrategyBudget, ApiError> {
    debug!("Fetching budget for strategy: {}", strategy_id);

    let response = db.client
        .from("strategy_budgets")
        .select("*")
        .eq("strategy_id", strategy_id)
        .limit(1)
        .execute()
        .await
        .map_err(|e| {
            error!("Failed to fetch budget for strategy {}: {}", strategy_id, e);
            ApiError::Database(format!("Failed to fetch budget: {}", e))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase error {}: {}", status, body);
        return Err(ApiError::Database(format!("Database error: {} - {}", status, body)));
    }

    let budgets: Vec<StrategyBudget> = response
        .json()
        .await
        .map_err(|e| {
            error!("Failed to parse budget response: {}", e);
            ApiError::Database(format!("Failed to parse budget: {}", e))
        })?;

    budgets
        .into_iter()
        .next()
        .ok_or_else(|| {
            warn!("Budget for strategy {} not found", strategy_id);
            ApiError::NotFound(format!("Budget for strategy {} not found", strategy_id))
        })
}

pub async fn update_strategy_budget(db: &SupabaseClient, strategy_id: &str, budget: StrategyBudget) -> Result<StrategyBudget, ApiError> {
    debug!("Updating budget for strategy: {}", strategy_id);

    let budget_json = serde_json::to_string(&budget)
        .map_err(|e| ApiError::Validation(format!("Failed to serialize budget: {}", e)))?;

    let response = db.client
        .from("strategy_budgets")
        .eq("strategy_id", strategy_id)
        .update(budget_json)
        .execute()
        .await
        .map_err(|e| {
            error!("Failed to update budget for strategy {}: {}", strategy_id, e);
            ApiError::Database(format!("Failed to update budget: {}", e))
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase error {}: {}", status, body);
        return Err(ApiError::Database(format!("Database error: {} - {}", status, body)));
    }

    let budgets: Vec<StrategyBudget> = response
        .json()
        .await
        .map_err(|e| {
            error!("Failed to parse updated budget response: {}", e);
            ApiError::Database(format!("Failed to parse updated budget: {}", e))
        })?;

    let updated_budget = budgets
        .into_iter()
        .next()
        .ok_or_else(|| {
            warn!("Budget for strategy {} not found for update", strategy_id);
            ApiError::NotFound(format!("Budget for strategy {} not found", strategy_id))
        })?;

    info!("Successfully updated budget for strategy: {}", strategy_id);
    Ok(updated_budget)
}
