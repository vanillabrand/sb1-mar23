use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::db::SupabaseClient;
use crate::error::ApiError;
use crate::services::news_service::NewsService;
use crate::api::middleware::extract_user_id;

#[derive(Debug, Serialize, Deserialize)]
pub struct NewsRequest {
    pub limit: Option<usize>,
}

// Get all news
pub async fn get_news(
    req: HttpRequest,
    query: web::Query<NewsRequest>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get query parameters
    let limit = query.limit.unwrap_or(10);
    
    // Create service
    let news_service = NewsService::new();
    
    // Get news
    let news = news_service.get_general_news(limit).await?;
    
    Ok(HttpResponse::Ok().json(news))
}

// Get crypto news
pub async fn get_crypto_news(
    req: HttpRequest,
    query: web::Query<NewsRequest>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from request
    let _user_id = extract_user_id(&req)?;
    
    // Get query parameters
    let limit = query.limit.unwrap_or(10);
    
    // Create service
    let news_service = NewsService::new();
    
    // Get crypto news
    let news = news_service.get_crypto_news(limit).await?;
    
    Ok(HttpResponse::Ok().json(news))
}
