use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::db::SupabaseClient;
use crate::error::ApiError;
use crate::services::market_service::MarketService;
use crate::services::exchange_service::ExchangeService;
use crate::api::middleware::extract_user_id;

#[derive(Debug, Serialize, Deserialize)]
pub struct CandleRequest {
    pub timeframe: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderBookRequest {
    pub limit: Option<usize>,
}

// Get market data for all symbols
pub async fn get_market_data(
    req: HttpRequest,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Create services
    let exchange_service = ExchangeService::new(true);
    let market_service = MarketService::new(web::Data::new(exchange_service).into_inner());
    
    // Get market data
    let market_data = market_service.get_all_market_data();
    
    Ok(HttpResponse::Ok().json(market_data))
}

// Get market data for a specific symbol
pub async fn get_symbol_market_data(
    req: HttpRequest,
    path: web::Path<String>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get symbol from path
    let symbol = path.into_inner();
    
    // Create services
    let exchange_service = ExchangeService::new(true);
    let market_service = MarketService::new(web::Data::new(exchange_service).into_inner());
    
    // Get market data
    let market_data = market_service.get_market_data(&symbol).await?;
    
    Ok(HttpResponse::Ok().json(market_data))
}

// Get candles for a symbol
pub async fn get_candles(
    req: HttpRequest,
    path: web::Path<String>,
    query: web::Query<CandleRequest>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get symbol from path
    let symbol = path.into_inner();
    
    // Get query parameters
    let timeframe = query.timeframe.clone().unwrap_or_else(|| "1h".to_string());
    let limit = query.limit.unwrap_or(100);
    
    // Create services
    let exchange_service = ExchangeService::new(true);
    let market_service = MarketService::new(web::Data::new(exchange_service).into_inner());
    
    // Get candles
    let candles = market_service.get_candles(&symbol, &timeframe, limit).await?;
    
    Ok(HttpResponse::Ok().json(candles))
}

// Get order book for a symbol
pub async fn get_orderbook(
    req: HttpRequest,
    path: web::Path<String>,
    query: web::Query<OrderBookRequest>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get symbol from path
    let symbol = path.into_inner();
    
    // Get query parameters
    let limit = query.limit.unwrap_or(20);
    
    // Create services
    let exchange_service = ExchangeService::new(true);
    let market_service = MarketService::new(web::Data::new(exchange_service).into_inner());
    
    // Get order book
    let orderbook = market_service.get_orderbook(&symbol, limit).await?;
    
    Ok(HttpResponse::Ok().json(orderbook))
}

// Get ticker for a symbol
pub async fn get_ticker(
    req: HttpRequest,
    path: web::Path<String>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get symbol from path
    let symbol = path.into_inner();
    
    // Create services
    let exchange_service = ExchangeService::new(true);
    let market_service = MarketService::new(web::Data::new(exchange_service).into_inner());
    
    // Get ticker
    let ticker = market_service.get_ticker(&symbol).await?;
    
    Ok(HttpResponse::Ok().json(ticker))
}

// Get market state for a symbol
pub async fn get_market_state(
    req: HttpRequest,
    path: web::Path<String>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get symbol from path
    let symbol = path.into_inner();
    
    // Create services
    let exchange_service = ExchangeService::new(true);
    let market_service = MarketService::new(web::Data::new(exchange_service).into_inner());
    
    // Get market state
    let market_state = market_service.get_market_state(&symbol).await?;
    
    Ok(HttpResponse::Ok().json(market_state))
}
