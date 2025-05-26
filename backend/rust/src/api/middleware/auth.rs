use actix_web::{HttpRequest, HttpResponse, Result};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use chrono::{Duration, Utc};
use crate::error::ApiError;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // Subject (user ID)
    pub email: String,
    pub exp: usize,   // Expiration time
    pub iat: usize,   // Issued at
    pub aud: String,  // Audience
    pub iss: String,  // Issuer
    pub role: String, // User role
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user_id: String,
    pub email: String,
    pub expires_at: i64,
}

pub struct AuthService {
    jwt_secret: String,
    jwt_expiration_hours: i64,
}

impl AuthService {
    pub fn new() -> Self {
        let jwt_secret = std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| "your-secret-key".to_string());
        let jwt_expiration_hours = std::env::var("JWT_EXPIRATION_HOURS")
            .unwrap_or_else(|_| "24".to_string())
            .parse()
            .unwrap_or(24);

        Self {
            jwt_secret,
            jwt_expiration_hours,
        }
    }

    pub fn create_token(&self, user_id: &str, email: &str, role: &str) -> Result<String, ApiError> {
        let now = Utc::now();
        let exp = now + Duration::hours(self.jwt_expiration_hours);

        let claims = Claims {
            sub: user_id.to_string(),
            email: email.to_string(),
            exp: exp.timestamp() as usize,
            iat: now.timestamp() as usize,
            aud: "trading-api".to_string(),
            iss: "trading-api".to_string(),
            role: role.to_string(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_ref()),
        )
        .map_err(|e| ApiError::Auth(format!("Failed to create token: {}", e)))
    }

    pub fn validate_token(&self, token: &str) -> Result<Claims, ApiError> {
        let validation = Validation::new(Algorithm::HS256);
        
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_ref()),
            &validation,
        )
        .map(|token_data| token_data.claims)
        .map_err(|e| ApiError::Auth(format!("Invalid token: {}", e)))
    }

    pub fn extract_token_from_header(&self, req: &HttpRequest) -> Result<String, ApiError> {
        let auth_header = req
            .headers()
            .get("Authorization")
            .ok_or_else(|| ApiError::Auth("Missing Authorization header".to_string()))?
            .to_str()
            .map_err(|_| ApiError::Auth("Invalid Authorization header format".to_string()))?;

        if !auth_header.starts_with("Bearer ") {
            return Err(ApiError::Auth("Invalid Authorization header format".to_string()));
        }

        Ok(auth_header[7..].to_string()) // Remove "Bearer " prefix
    }

    pub async fn authenticate_user(&self, email: &str, password: &str) -> Result<LoginResponse, ApiError> {
        // In a real implementation, you would:
        // 1. Hash the password and compare with stored hash
        // 2. Query the database for user credentials
        // 3. Validate the user exists and is active
        
        // For now, we'll use a mock implementation
        if email == "demo@example.com" && password == "demo123" {
            let user_id = "demo-user-id";
            let role = "user";
            
            let token = self.create_token(user_id, email, role)?;
            let expires_at = (Utc::now() + Duration::hours(self.jwt_expiration_hours)).timestamp();

            Ok(LoginResponse {
                token,
                user_id: user_id.to_string(),
                email: email.to_string(),
                expires_at,
            })
        } else {
            Err(ApiError::Auth("Invalid credentials".to_string()))
        }
    }

    pub fn refresh_token(&self, old_token: &str) -> Result<String, ApiError> {
        let claims = self.validate_token(old_token)?;
        
        // Check if token is close to expiry (within 1 hour)
        let now = Utc::now().timestamp() as usize;
        let time_until_expiry = claims.exp.saturating_sub(now);
        
        if time_until_expiry > 3600 {
            return Err(ApiError::Auth("Token is not close to expiry".to_string()));
        }

        // Create new token with same claims but updated expiry
        self.create_token(&claims.sub, &claims.email, &claims.role)
    }
}
