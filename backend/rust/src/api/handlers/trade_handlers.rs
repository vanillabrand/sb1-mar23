use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::SupabaseClient;
use crate::error::ApiError;
use crate::models::Trade;
use crate::services::trade_service::TradeService;
use crate::services::strategy_service::StrategyService;
use crate::services::deepseek_service::DeepseekService;
use crate::services::exchange_service::ExchangeService;
use crate::api::middleware::extract_user_id;

#[derive(Debug, Serialize, Deserialize)]
pub struct TradeRequest {
    pub strategy_id: String,
    pub symbol: String,
    pub side: String,
    pub amount: f64,
    pub entry_price: Option<f64>,
    pub stop_loss: Option<f64>,
    pub take_profit: Option<f64>,
    pub trailing_stop: Option<f64>,
    pub market_type: Option<String>,
    pub leverage: Option<f64>,
}

// Get all trades
pub async fn get_trades(
    req: HttpRequest,
    query: web::Query<std::collections::HashMap<String, String>>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get query parameters
    let strategy_id = query.get("strategy_id").map(|s| s.as_str());
    let status = query.get("status").map(|s| s.as_str());
    
    // Create services
    let strategy_service = StrategyService::new(
        db.clone(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    let exchange_service = ExchangeService::new(true);
    
    let trade_service = TradeService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
        web::Data::new(exchange_service).into_inner(),
        web::Data::new(strategy_service).into_inner(),
    );
    
    // Get trades
    let trades = trade_service.get_trades(strategy_id, status).await?;
    
    Ok(HttpResponse::Ok().json(trades))
}

// Get a trade by ID
pub async fn get_trade(
    req: HttpRequest,
    path: web::Path<String>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get trade ID from path
    let trade_id = path.into_inner();
    
    // Create services
    let strategy_service = StrategyService::new(
        db.clone(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    let exchange_service = ExchangeService::new(true);
    
    let trade_service = TradeService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
        web::Data::new(exchange_service).into_inner(),
        web::Data::new(strategy_service).into_inner(),
    );
    
    // Get trade
    let trade = trade_service.get_trade(&trade_id).await?;
    
    Ok(HttpResponse::Ok().json(trade))
}

// Create a new trade
pub async fn create_trade(
    req: HttpRequest,
    trade_req: web::Json<TradeRequest>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Create trade object
    let trade = Trade {
        id: Uuid::new_v4(),
        strategy_id: Uuid::parse_str(&trade_req.strategy_id).map_err(|_| ApiError::Validation("Invalid strategy ID".to_string()))?,
        symbol: trade_req.symbol.clone(),
        side: trade_req.side.clone(),
        status: "pending".to_string(),
        amount: trade_req.amount,
        entry_price: trade_req.entry_price,
        exit_price: None,
        profit: None,
        timestamp: chrono::Utc::now().timestamp_millis(),
        created_at: chrono::Utc::now(),
        executed_at: None,
        closed_at: None,
        order_id: None,
        market_type: trade_req.market_type.clone().unwrap_or_else(|| "spot".to_string()),
        leverage: trade_req.leverage,
        stop_loss: trade_req.stop_loss,
        take_profit: trade_req.take_profit,
        trailing_stop: trade_req.trailing_stop,
        metadata: serde_json::json!({}),
    };
    
    // Create services
    let strategy_service = StrategyService::new(
        db.clone(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    let exchange_service = ExchangeService::new(true);
    
    let trade_service = TradeService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
        web::Data::new(exchange_service).into_inner(),
        web::Data::new(strategy_service).into_inner(),
    );
    
    // Create trade
    let created_trade = trade_service.create_trade(trade).await?;
    
    Ok(HttpResponse::Created().json(created_trade))
}

// Update a trade
pub async fn update_trade(
    req: HttpRequest,
    path: web::Path<String>,
    trade_req: web::Json<TradeRequest>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get trade ID from path
    let trade_id = path.into_inner();
    
    // Create services
    let strategy_service = StrategyService::new(
        db.clone(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    let exchange_service = ExchangeService::new(true);
    
    let trade_service = TradeService::new(
        db.clone(),
        web::Data::new(DeepseekService::new()).into_inner(),
        web::Data::new(exchange_service).into_inner(),
        web::Data::new(strategy_service).into_inner(),
    );
    
    // Get existing trade
    let mut trade = trade_service.get_trade(&trade_id).await?;
    
    // Update trade
    trade.symbol = trade_req.symbol.clone();
    trade.side = trade_req.side.clone();
    trade.amount = trade_req.amount;
    trade.entry_price = trade_req.entry_price;
    trade.stop_loss = trade_req.stop_loss;
    trade.take_profit = trade_req.take_profit;
    trade.trailing_stop = trade_req.trailing_stop;
    
    if let Some(market_type) = &trade_req.market_type {
        trade.market_type = market_type.clone();
    }
    
    trade.leverage = trade_req.leverage;
    
    // Update trade
    let updated_trade = trade_service.update_trade(&trade_id, trade).await?;
    
    Ok(HttpResponse::Ok().json(updated_trade))
}

// Delete a trade
pub async fn delete_trade(
    req: HttpRequest,
    path: web::Path<String>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get trade ID from path
    let trade_id = path.into_inner();
    
    // Create services
    let strategy_service = StrategyService::new(
        db.clone(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    let exchange_service = ExchangeService::new(true);
    
    let trade_service = TradeService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
        web::Data::new(exchange_service).into_inner(),
        web::Data::new(strategy_service).into_inner(),
    );
    
    // Delete trade
    trade_service.delete_trade(&trade_id).await?;
    
    Ok(HttpResponse::NoContent().finish())
}

// Execute a trade
pub async fn execute_trade(
    req: HttpRequest,
    path: web::Path<String>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get trade ID from path
    let trade_id = path.into_inner();
    
    // Create services
    let strategy_service = StrategyService::new(
        db.clone(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    let exchange_service = ExchangeService::new(true);
    
    let trade_service = TradeService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
        web::Data::new(exchange_service).into_inner(),
        web::Data::new(strategy_service).into_inner(),
    );
    
    // Execute trade
    let executed_trade = trade_service.execute_trade(&trade_id).await?;
    
    Ok(HttpResponse::Ok().json(executed_trade))
}

// Close a trade
pub async fn close_trade(
    req: HttpRequest,
    path: web::Path<String>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get trade ID from path
    let trade_id = path.into_inner();
    
    // Create services
    let strategy_service = StrategyService::new(
        db.clone(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    let exchange_service = ExchangeService::new(true);
    
    let trade_service = TradeService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
        web::Data::new(exchange_service).into_inner(),
        web::Data::new(strategy_service).into_inner(),
    );
    
    // Close trade
    let closed_trade = trade_service.close_trade(&trade_id).await?;
    
    Ok(HttpResponse::Ok().json(closed_trade))
}

// Get trades by strategy
pub async fn get_trades_by_strategy(
    req: HttpRequest,
    path: web::Path<String>,
    query: web::Query<std::collections::HashMap<String, String>>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get strategy ID from path
    let strategy_id = path.into_inner();
    
    // Get query parameters
    let status = query.get("status").map(|s| s.as_str());
    
    // Create services
    let strategy_service = StrategyService::new(
        db.clone(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    let exchange_service = ExchangeService::new(true);
    
    let trade_service = TradeService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
        web::Data::new(exchange_service).into_inner(),
        web::Data::new(strategy_service).into_inner(),
    );
    
    // Get trades
    let trades = trade_service.get_trades(Some(&strategy_id), status).await?;
    
    Ok(HttpResponse::Ok().json(trades))
}

// Generate trades for a strategy
pub async fn generate_trades(
    req: HttpRequest,
    path: web::Path<String>,
    market_data: web::Json<serde_json::Value>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get strategy ID from path
    let strategy_id = path.into_inner();
    
    // Create services
    let strategy_service = StrategyService::new(
        db.clone(),
        web::Data::new(DeepseekService::new()).into_inner(),
    );
    
    let exchange_service = ExchangeService::new(true);
    
    let trade_service = TradeService::new(
        db.into_inner(),
        web::Data::new(DeepseekService::new()).into_inner(),
        web::Data::new(exchange_service).into_inner(),
        web::Data::new(strategy_service).into_inner(),
    );
    
    // Generate trades
    let trades = trade_service.generate_trades(&strategy_id, market_data.into_inner()).await?;
    
    Ok(HttpResponse::Ok().json(trades))
}
