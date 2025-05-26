use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

use crate::db::supabase::SupabaseClient;
use crate::error::ApiError;
use crate::models::Strategy;
use crate::services::strategy_service::StrategyService;
use std::sync::Arc;
use crate::services::deepseek_service::DeepSeekService;
use crate::api::middleware::extract_user_id;

#[derive(Debug, Serialize, Deserialize)]
pub struct StrategyRequest {
    pub name: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub risk_level: Option<String>,
    pub market_type: Option<String>,
    pub selected_pairs: Option<Vec<String>>,
    pub strategy_config: Option<serde_json::Value>,
    pub status: Option<String>,
    pub user_id: Option<String>,
}

// Get all strategies
pub async fn get_strategies(
    req: HttpRequest,
    strategy_service: web::Data<Arc<StrategyService>>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let user_id = extract_user_id(&req)?;

    // Fetch strategies using service
    let strategies = strategy_service.get_strategies(&user_id).await?;

    Ok(HttpResponse::Ok().json(strategies))
}

// Get a strategy by ID
pub async fn get_strategy(
    req: HttpRequest,
    path: web::Path<String>,
    strategy_service: web::Data<Arc<StrategyService>>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;

    // Get strategy ID from path
    let strategy_id = path.into_inner();

    // Fetch strategy using service
    let strategy = strategy_service.get_strategy(&strategy_id).await?;

    Ok(HttpResponse::Ok().json(strategy))
}

// Create a new strategy
pub async fn create_strategy(
    req: HttpRequest,
    strategy_req: web::Json<StrategyRequest>,
    strategy_service: web::Data<Arc<StrategyService>>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let user_id = extract_user_id(&req)?;

    // Create strategy object
    let strategy = Strategy {
        id: Uuid::new_v4(),
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
        user_id: Uuid::parse_str(&user_id).map_err(|_| ApiError::Validation("Invalid user ID".to_string()))?,
        name: strategy_req.name.clone(),
        description: strategy_req.description.clone(),
        type_: "custom".to_string(),
        status: strategy_req.status.clone().unwrap_or_else(|| "inactive".to_string()),
        risk_level: strategy_req.risk_level.clone().unwrap_or_else(|| "medium".to_string()),
        market_type: strategy_req.market_type.clone().unwrap_or_else(|| "spot".to_string()),
        selected_pairs: strategy_req.selected_pairs.clone().unwrap_or_else(|| vec!["BTC/USDT".to_string()]),
        strategy_config: strategy_req.strategy_config.clone().unwrap_or_else(|| serde_json::json!({})),
        performance: 0.0,
        last_adapted_at: None,
        budget: 1000.0,
    };

    // Create strategy using service
    let created_strategy = strategy_service.create_strategy(strategy).await?;

    Ok(HttpResponse::Created().json(created_strategy))
}

// Update a strategy
pub async fn update_strategy(
    req: HttpRequest,
    path: web::Path<String>,
    strategy_req: web::Json<StrategyRequest>,
    strategy_service: web::Data<Arc<StrategyService>>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;

    // Get strategy ID from path
    let strategy_id = path.into_inner();

    // Get existing strategy using service
    let mut strategy = strategy_service.get_strategy(&strategy_id).await?;

    // Update strategy fields
    strategy.name = strategy_req.name.clone();
    strategy.description = strategy_req.description.clone();
    if let Some(status) = &strategy_req.status {
        strategy.status = status.clone();
    }
    if let Some(risk_level) = &strategy_req.risk_level {
        strategy.risk_level = risk_level.clone();
    }
    if let Some(market_type) = &strategy_req.market_type {
        strategy.market_type = market_type.clone();
    }
    if let Some(selected_pairs) = &strategy_req.selected_pairs {
        strategy.selected_pairs = selected_pairs.clone();
    }
    if let Some(strategy_config) = &strategy_req.strategy_config {
        strategy.strategy_config = strategy_config.clone();
    }
    strategy.updated_at = Some(chrono::Utc::now());

    // Update strategy using service
    let updated_strategy = strategy_service.update_strategy(&strategy_id, strategy).await?;

    Ok(HttpResponse::Ok().json(updated_strategy))
}

// Delete a strategy
pub async fn delete_strategy(
    req: HttpRequest,
    path: web::Path<String>,
    strategy_service: web::Data<Arc<StrategyService>>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;

    // Get strategy ID from path
    let strategy_id = path.into_inner();

    // Delete strategy using service
    strategy_service.delete_strategy(&strategy_id).await?;

    Ok(HttpResponse::NoContent().finish())
}

// Activate a strategy
pub async fn activate_strategy(
    req: HttpRequest,
    path: web::Path<String>,
    strategy_service: web::Data<Arc<StrategyService>>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;

    // Get strategy ID from path
    let strategy_id = path.into_inner();

    // Activate strategy using service
    let activated_strategy = strategy_service.activate_strategy(&strategy_id).await?;

    Ok(HttpResponse::Ok().json(activated_strategy))
}

// Deactivate a strategy
pub async fn deactivate_strategy(
    req: HttpRequest,
    path: web::Path<String>,
    strategy_service: web::Data<Arc<StrategyService>>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;

    // Get strategy ID from path
    let strategy_id = path.into_inner();

    // Deactivate strategy using service
    let deactivated_strategy = strategy_service.deactivate_strategy(&strategy_id).await?;

    Ok(HttpResponse::Ok().json(deactivated_strategy))
}

// Adapt a strategy
pub async fn adapt_strategy(
    req: HttpRequest,
    path: web::Path<String>,
    market_data: web::Json<serde_json::Value>,
    strategy_service: web::Data<Arc<StrategyService>>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;

    // Get strategy ID from path
    let strategy_id = path.into_inner();

    // Adapt strategy using service
    let adapted_strategy = strategy_service.adapt_strategy(&strategy_id, market_data.into_inner()).await?;

    Ok(HttpResponse::Ok().json(adapted_strategy))
}

// Get strategy budget
pub async fn get_strategy_budget(
    req: HttpRequest,
    path: web::Path<String>,
    strategy_service: web::Data<Arc<StrategyService>>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;

    // Get strategy ID from path
    let strategy_id = path.into_inner();

    // Fetch budget using service
    let budget = strategy_service.get_budget(&strategy_id).await?;

    Ok(HttpResponse::Ok().json(budget))
}

// Update strategy budget
pub async fn update_strategy_budget(
    req: HttpRequest,
    path: web::Path<String>,
    budget_data: web::Json<serde_json::Value>,
    strategy_service: web::Data<Arc<StrategyService>>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;

    // Get strategy ID from path
    let strategy_id = path.into_inner();

    // Parse budget data
    let total = budget_data.get("total").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let allocated = budget_data.get("allocated").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let available = budget_data.get("available").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let max_position_size = budget_data.get("max_position_size").and_then(|v| v.as_f64()).unwrap_or(0.0);

    // Create budget object
    let budget = crate::models::StrategyBudget {
        strategy_id: uuid::Uuid::parse_str(&strategy_id).map_err(|_| ApiError::Validation("Invalid strategy ID".to_string()))?,
        total,
        allocated,
        available,
        max_position_size,
        last_updated: chrono::Utc::now().timestamp(),
    };

    // Update budget using service
    let updated_budget = strategy_service.update_budget(&strategy_id, budget).await?;

    Ok(HttpResponse::Ok().json(updated_budget))
}
