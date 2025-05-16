use actix_web::{dev::ServiceRequest, Error, HttpMessage, HttpRequest};
use actix_web::error::ErrorUnauthorized;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

use crate::config::CONFIG;
use crate::error::ApiError;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: u64,
    pub iat: u64,
    pub email: String,
}

// Extract user ID from request
pub fn extract_user_id(req: &HttpRequest) -> Result<String, ApiError> {
    // Get token from request
    let token = req.headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| ApiError::Auth("Missing or invalid Authorization header".to_string()))?;
    
    // Decode token
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(CONFIG.supabase_anon_key.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|e| ApiError::Auth(format!("Invalid token: {}", e)))?;
    
    Ok(token_data.claims.sub)
}

// Authentication middleware
pub async fn auth_middleware(req: ServiceRequest) -> Result<ServiceRequest, Error> {
    // Skip authentication for certain paths
    let path = req.path();
    if path == "/api/health" || path == "/metrics" || path.starts_with("/api/auth/login") {
        return Ok(req);
    }
    
    // Get token from request
    let token = req.headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| ErrorUnauthorized("Missing or invalid Authorization header"))?;
    
    // Decode token
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(CONFIG.supabase_anon_key.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| ErrorUnauthorized("Invalid token"))?;
    
    // Add user ID to request extensions
    req.extensions_mut().insert(token_data.claims.sub);
    
    Ok(req)
}
