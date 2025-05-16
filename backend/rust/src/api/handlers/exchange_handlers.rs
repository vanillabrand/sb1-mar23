use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::db::SupabaseClient;
use crate::error::ApiError;
use crate::services::exchange_service::ExchangeService;
use crate::api::middleware::extract_user_id;

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderRequest {
    pub symbol: String,
    pub side: String,
    pub amount: f64,
    pub price: Option<f64>,
    pub is_futures: Option<bool>,
    pub leverage: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TradeRequest {
    pub symbol: String,
    pub limit: Option<usize>,
}

// Get account balance
pub async fn get_balance(
    req: HttpRequest,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Create service
    let exchange_service = ExchangeService::new(true);
    
    // Get balance
    let balance = exchange_service.get_balance().await?;
    
    Ok(HttpResponse::Ok().json(balance))
}

// Create an order
pub async fn create_order(
    req: HttpRequest,
    order_req: web::Json<OrderRequest>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Create service
    let exchange_service = ExchangeService::new(true);
    
    // Create order
    let order = exchange_service.create_order(
        &order_req.symbol,
        &order_req.side,
        order_req.amount,
        order_req.price,
        order_req.is_futures.unwrap_or(false),
        order_req.leverage,
    ).await?;
    
    Ok(HttpResponse::Created().json(order))
}

// Cancel an order
pub async fn cancel_order(
    req: HttpRequest,
    path: web::Path<String>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get order ID from path
    let order_id = path.into_inner();
    
    // Create service
    let exchange_service = ExchangeService::new(true);
    
    // Cancel order
    exchange_service.cancel_order("", &order_id).await?;
    
    Ok(HttpResponse::NoContent().finish())
}

// Get open orders
pub async fn get_open_orders(
    req: HttpRequest,
    query: web::Query<std::collections::HashMap<String, String>>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get query parameters
    let symbol = query.get("symbol").map(|s| s.as_str());
    
    // Create service
    let exchange_service = ExchangeService::new(true);
    
    // Get open orders
    let orders = exchange_service.get_open_orders(symbol).await?;
    
    Ok(HttpResponse::Ok().json(orders))
}

// Get trades
pub async fn get_trades(
    req: HttpRequest,
    query: web::Query<TradeRequest>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get query parameters
    let symbol = &query.symbol;
    let limit = query.limit.unwrap_or(100);
    
    // Create service
    let exchange_service = ExchangeService::new(true);
    
    // Get trades
    let trades = exchange_service.get_trades(symbol, limit).await?;
    
    Ok(HttpResponse::Ok().json(trades))
}
