use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::db::SupabaseClient;
use crate::error::ApiError;
use crate::services::auth_service::AuthService;

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshRequest {
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenResponse {
    pub token: String,
}

// Login
pub async fn login(
    login_req: web::Json<LoginRequest>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Create service
    let auth_service = AuthService::new(db.into_inner());
    
    // Login
    let token = auth_service.login(&login_req.email, &login_req.password).await?;
    
    Ok(HttpResponse::Ok().json(TokenResponse { token }))
}

// Logout
pub async fn logout(
    req: HttpRequest,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Get token from request
    let token = req.headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| ApiError::Auth("Missing or invalid Authorization header".to_string()))?;
    
    // Create service
    let auth_service = AuthService::new(db.into_inner());
    
    // Logout
    auth_service.logout(token).await?;
    
    Ok(HttpResponse::NoContent().finish())
}

// Refresh token
pub async fn refresh_token(
    refresh_req: web::Json<RefreshRequest>,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Create service
    let auth_service = AuthService::new(db.into_inner());
    
    // Refresh token
    let token = auth_service.refresh_token(&refresh_req.token).await?;
    
    Ok(HttpResponse::Ok().json(TokenResponse { token }))
}

// Get current user
pub async fn get_current_user(
    req: HttpRequest,
    db: web::Data<SupabaseClient>,
) -> Result<HttpResponse, ApiError> {
    // Get token from request
    let token = req.headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| ApiError::Auth("Missing or invalid Authorization header".to_string()))?;
    
    // Create service
    let auth_service = AuthService::new(db.into_inner());
    
    // Get current user
    let user = auth_service.get_current_user(token).await?;
    
    Ok(HttpResponse::Ok().json(user))
}
