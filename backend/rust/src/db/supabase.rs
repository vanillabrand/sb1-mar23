use crate::config::CONFIG;
use crate::error::ApiError;
use crate::models::{Strategy, Trade};
use postgrest::Postgrest;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct SupabaseClient {
    client: Postgrest,
    url: String,
    key: String,
}

impl SupabaseClient {
    pub fn client(&self) -> &Postgrest {
        &self.client
    }
}

impl SupabaseClient {
    pub fn new(url: &str, key: &str) -> Self {
        let client = Postgrest::new(url)
            .insert_header("apikey", key)
            .insert_header("Authorization", &format!("Bearer {}", key));
        
        Self {
            client,
            url: url.to_string(),
            key: key.to_string(),
        }
    }
    
    // Helper method to get a client with auth token
    pub fn with_auth(&self, auth_token: &str) -> Postgrest {
        Postgrest::new(&self.url)
            .insert_header("apikey", &self.key)
            .insert_header("Authorization", &format!("Bearer {}", auth_token))
    }
}

// Initialize the database connection pool
pub async fn init_db_pool() -> Result<Arc<SupabaseClient>, ApiError> {
    let supabase_url = format!("{}/rest/v1", CONFIG.supabase_url);
    let supabase_key = CONFIG.supabase_anon_key.clone();
    
    let client = SupabaseClient::new(&supabase_url, &supabase_key);
    
    // Test the connection with a simple count query on existing table
    let _ = client.client.from("strategies").select("count").execute().await
        .map_err(|e| ApiError::Database(format!("Failed to connect to Supabase: {}", e)))?;
    
    tracing::info!("Successfully connected to Supabase at {}", supabase_url);
    tracing::debug!("Supabase connection established with key: {}", supabase_key);
    
    Ok(Arc::new(client))
}

// Strategy CRUD operations
pub async fn fetch_strategies(db: &SupabaseClient, user_id: Option<&str>) -> Result<Vec<Strategy>, ApiError> {
    let mut query = db.client.from("strategies").select("*");
    
    if let Some(user_id) = user_id {
        query = query.eq("user_id", user_id);
    }
    
    let response = query.execute().await?;
    let strategies: Vec<Strategy> = response.json().await
        .map_err(|e| ApiError::Database(format!("Failed to parse strategies: {}", e)))?;
    
    Ok(strategies)
}

pub async fn fetch_strategy_by_id(db: &SupabaseClient, id: &str) -> Result<Strategy, ApiError> {
    let response = db.client
        .from("strategies")
        .select("*")
        .eq("id", id)
        .limit(1)
        .execute()
        .await?;
    
    let strategies: Vec<Strategy> = response.json().await
        .map_err(|e| ApiError::Database(format!("Failed to parse strategy: {}", e)))?;
    
    strategies.into_iter().next()
        .ok_or_else(|| ApiError::NotFound(format!("Strategy with ID {} not found", id)))
}

pub async fn create_strategy(db: &SupabaseClient, strategy: Strategy) -> Result<Strategy, ApiError> {
    let response = db.client
        .from("strategies")
        .insert(serde_json::to_string(&strategy)?)
        .execute()
        .await?;
    
    let strategies: Vec<Strategy> = response.json().await
        .map_err(|e| ApiError::Database(format!("Failed to parse created strategy: {}", e)))?;
    
    strategies.into_iter().next()
        .ok_or_else(|| ApiError::Database("Failed to create strategy".to_string()))
}

pub async fn update_strategy(db: &SupabaseClient, id: &str, strategy: Strategy) -> Result<Strategy, ApiError> {
    let response = db.client
        .from("strategies")
        .eq("id", id)
        .update(serde_json::to_string(&strategy)?)
        .execute()
        .await?;
    
    let strategies: Vec<Strategy> = response.json().await
        .map_err(|e| ApiError::Database(format!("Failed to parse updated strategy: {}", e)))?;
    
    strategies.into_iter().next()
        .ok_or_else(|| ApiError::NotFound(format!("Strategy with ID {} not found", id)))
}

pub async fn delete_strategy(db: &SupabaseClient, id: &str) -> Result<(), ApiError> {
    let _ = db.client
        .from("strategies")
        .eq("id", id)
        .delete()
        .execute()
        .await?;
    
    Ok(())
}

// Trade CRUD operations
pub async fn fetch_trades(db: &SupabaseClient, strategy_id: Option<&str>, status: Option<&str>) -> Result<Vec<Trade>, ApiError> {
    let mut query = db.client.from("trades").select("*");
    
    if let Some(strategy_id) = strategy_id {
        query = query.eq("strategy_id", strategy_id);
    }
    
    if let Some(status) = status {
        query = query.eq("status", status);
    }
    
    let response = query.execute().await?;
    let trades: Vec<Trade> = response.json().await
        .map_err(|e| ApiError::Database(format!("Failed to parse trades: {}", e)))?;
    
    Ok(trades)
}

pub async fn fetch_trade_by_id(db: &SupabaseClient, id: &str) -> Result<Trade, ApiError> {
    let response = db.client
        .from("trades")
        .select("*")
        .eq("id", id)
        .limit(1)
        .execute()
        .await?;
    
    let trades: Vec<Trade> = response.json().await
        .map_err(|e| ApiError::Database(format!("Failed to parse trade: {}", e)))?;
    
    trades.into_iter().next()
        .ok_or_else(|| ApiError::NotFound(format!("Trade with ID {} not found", id)))
}

pub async fn create_trade(db: &SupabaseClient, trade: Trade) -> Result<Trade, ApiError> {
    let response = db.client
        .from("trades")
        .insert(serde_json::to_string(&trade)?)
        .execute()
        .await?;
    
    let trades: Vec<Trade> = response.json().await
        .map_err(|e| ApiError::Database(format!("Failed to parse created trade: {}", e)))?;
    
    trades.into_iter().next()
        .ok_or_else(|| ApiError::Database("Failed to create trade".to_string()))
}

pub async fn update_trade(db: &SupabaseClient, id: &str, trade: Trade) -> Result<Trade, ApiError> {
    let response = db.client
        .from("trades")
        .eq("id", id)
        .update(serde_json::to_string(&trade)?)
        .execute()
        .await?;
    
    let trades: Vec<Trade> = response.json().await
        .map_err(|e| ApiError::Database(format!("Failed to parse updated trade: {}", e)))?;
    
    trades.into_iter().next()
        .ok_or_else(|| ApiError::NotFound(format!("Trade with ID {} not found", id)))
}

pub async fn delete_trade(db: &SupabaseClient, id: &str) -> Result<(), ApiError> {
    let _ = db.client
        .from("trades")
        .eq("id", id)
        .delete()
        .execute()
        .await?;
    
    Ok(())
}
