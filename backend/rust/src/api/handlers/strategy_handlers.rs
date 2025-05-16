use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::SupabaseClient;
use crate::error::ApiError;
use crate::models::{Strategy, StrategyBudget};
use crate::services::strategy_service::StrategyService;
use crate::services::deepseek_service::DeepseekService;
use crate::api::middleware::extract_user_id;

#[derive(Debug, Serialize, Deserialize)]
pub struct StrategyRequest {
    pub name: String,
    pub description: Option<String>,
    pub risk_level: Option<String>,
    pub market_type: Option<String>,
    pub selected_pairs: Option<Vec<String>>,
    pub strategy_config: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetRequest {
    pub total: f64,
    pub max_position_size: Option<f64>,
}

// Get all strategies
pub async fn get_strategies(
    req: HttpRequest,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let user_id = extract_user_id(&req)?;
    
    // Create service
    let strategy_service = StrategyService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    // Get strategies
    let strategies = strategy_service.get_strategies(&user_id).await?;
    
    Ok(HttpResponse::Ok().json(strategies))
}

// Get a strategy by ID
pub async fn get_strategy(
    req: HttpRequest,
    path: web::Path<String>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get strategy ID from path
    let strategy_id = path.into_inner();
    
    // Create service
    let strategy_service = StrategyService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    // Get strategy
    let strategy = strategy_service.get_strategy(&strategy_id).await?;
    
    Ok(HttpResponse::Ok().json(strategy))
}

// Create a new strategy
pub async fn create_strategy(
    req: HttpRequest,
    strategy_req: web::Json<StrategyRequest>,
    db: web::Data<SupabaseClient>,
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
        status: "inactive".to_string(),
        risk_level: strategy_req.risk_level.clone().unwrap_or_else(|| "medium".to_string()),
        market_type: strategy_req.market_type.clone().unwrap_or_else(|| "spot".to_string()),
        selected_pairs: strategy_req.selected_pairs.clone().unwrap_or_else(|| vec!["BTC/USDT".to_string()]),
        strategy_config: strategy_req.strategy_config.clone().unwrap_or_else(|| serde_json::json!({})),
        performance: 0.0,
        last_adapted_at: None,
    };
    
    // Create service
    let strategy_service = StrategyService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    // Create strategy
    let created_strategy = strategy_service.create_strategy(strategy).await?;
    
    Ok(HttpResponse::Created().json(created_strategy))
}

// Update a strategy
pub async fn update_strategy(
    req: HttpRequest,
    path: web::Path<String>,
    strategy_req: web::Json<StrategyRequest>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get strategy ID from path
    let strategy_id = path.into_inner();
    
    // Create service
    let strategy_service = StrategyService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    // Get existing strategy
    let mut strategy = strategy_service.get_strategy(&strategy_id).await?;
    
    // Update strategy
    strategy.name = strategy_req.name.clone();
    strategy.description = strategy_req.description.clone();
    strategy.risk_level = strategy_req.risk_level.clone().unwrap_or(strategy.risk_level);
    strategy.market_type = strategy_req.market_type.clone().unwrap_or(strategy.market_type);
    strategy.selected_pairs = strategy_req.selected_pairs.clone().unwrap_or(strategy.selected_pairs);
    
    if let Some(config) = &strategy_req.strategy_config {
        strategy.strategy_config = config.clone();
    }
    
    strategy.updated_at = Some(chrono::Utc::now());
    
    // Update strategy
    let updated_strategy = strategy_service.update_strategy(&strategy_id, strategy).await?;
    
    Ok(HttpResponse::Ok().json(updated_strategy))
}

// Delete a strategy
pub async fn delete_strategy(
    req: HttpRequest,
    path: web::Path<String>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get strategy ID from path
    let strategy_id = path.into_inner();
    
    // Create service
    let strategy_service = StrategyService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    // Delete strategy
    strategy_service.delete_strategy(&strategy_id).await?;
    
    Ok(HttpResponse::NoContent().finish())
}

// Activate a strategy
pub async fn activate_strategy(
    req: HttpRequest,
    path: web::Path<String>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get strategy ID from path
    let strategy_id = path.into_inner();
    
    // Create service
    let strategy_service = StrategyService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    // Activate strategy
    let activated_strategy = strategy_service.activate_strategy(&strategy_id).await?;
    
    Ok(HttpResponse::Ok().json(activated_strategy))
}

// Deactivate a strategy
pub async fn deactivate_strategy(
    req: HttpRequest,
    path: web::Path<String>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get strategy ID from path
    let strategy_id = path.into_inner();
    
    // Create service
    let strategy_service = StrategyService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    // Deactivate strategy
    let deactivated_strategy = strategy_service.deactivate_strategy(&strategy_id).await?;
    
    Ok(HttpResponse::Ok().json(deactivated_strategy))
}

// Adapt a strategy
pub async fn adapt_strategy(
    req: HttpRequest,
    path: web::Path<String>,
    market_data: web::Json<serde_json::Value>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get strategy ID from path
    let strategy_id = path.into_inner();
    
    // Create service
    let strategy_service = StrategyService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    // Adapt strategy
    let adapted_strategy = strategy_service.adapt_strategy(&strategy_id, market_data.into_inner()).await?;
    
    Ok(HttpResponse::Ok().json(adapted_strategy))
}

// Get strategy budget
pub async fn get_strategy_budget(
    req: HttpRequest,
    path: web::Path<String>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get strategy ID from path
    let strategy_id = path.into_inner();
    
    // Create service
    let strategy_service = StrategyService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    // Get budget
    let budget = strategy_service.get_budget(&strategy_id).await?;
    
    Ok(HttpResponse::Ok().json(budget))
}

// Update strategy budget
pub async fn update_strategy_budget(
    req: HttpRequest,
    path: web::Path<String>,
    budget_req: web::Json<BudgetRequest>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get strategy ID from path
    let strategy_id = path.into_inner();
    
    // Create service
    let strategy_service = StrategyService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    // Get current budget
    let mut budget = strategy_service.get_budget(&strategy_id).await?;
    
    // Update budget
    budget.total = budget_req.total;
    budget.available = budget_req.total - budget.allocated;
    
    if let Some(max_position_size) = budget_req.max_position_size {
        budget.max_position_size = max_position_size;
    }
    
    budget.last_updated = chrono::Utc::now().timestamp();
    
    // Update budget
    let updated_budget = strategy_service.update_budget(&strategy_id, budget).await?;
    
    Ok(HttpResponse::Ok().json(updated_budget))
}
