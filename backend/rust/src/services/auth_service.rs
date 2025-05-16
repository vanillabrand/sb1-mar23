use crate::config::CONFIG;
use crate::db::SupabaseClient;
use crate::error::ApiError;
use crate::models::User;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: u64,
    pub iat: u64,
    pub email: String,
}

pub struct AuthService {
    db: Arc<SupabaseClient>,
}

impl AuthService {
    pub fn new(db: Arc<SupabaseClient>) -> Self {
        Self { db }
    }
    
    // Login user
    pub async fn login(&self, email: &str, password: &str) -> Result<String, ApiError> {
        // In a real implementation, this would call Supabase Auth API
        // For now, we'll just generate a token
        
        // Check if user exists
        let user = self.get_user_by_email(email).await?;
        
        // Generate token
        let token = self.generate_token(&user)?;
        
        Ok(token)
    }
    
    // Logout user
    pub async fn logout(&self, token: &str) -> Result<(), ApiError> {
        // In a real implementation, this would call Supabase Auth API
        // For now, we'll just return success
        
        Ok(())
    }
    
    // Refresh token
    pub async fn refresh_token(&self, token: &str) -> Result<String, ApiError> {
        // Validate token
        let claims = self.validate_token(token)?;
        
        // Get user
        let user = self.get_user_by_id(&claims.sub).await?;
        
        // Generate new token
        let new_token = self.generate_token(&user)?;
        
        Ok(new_token)
    }
    
    // Get current user
    pub async fn get_current_user(&self, token: &str) -> Result<User, ApiError> {
        // Validate token
        let claims = self.validate_token(token)?;
        
        // Get user
        let user = self.get_user_by_id(&claims.sub).await?;
        
        Ok(user)
    }
    
    // Get user by ID
    async fn get_user_by_id(&self, id: &str) -> Result<User, ApiError> {
        let response = self.db.client
            .from("users")
            .select("*")
            .eq("id", id)
            .limit(1)
            .execute()
            .await
            .map_err(|e| ApiError::Database(format!("Failed to fetch user: {}", e)))?;
        
        let users: Vec<User> = response.json().await
            .map_err(|e| ApiError::Database(format!("Failed to parse user: {}", e)))?;
        
        users.into_iter().next()
            .ok_or_else(|| ApiError::NotFound(format!("User with ID {} not found", id)))
    }
    
    // Get user by email
    async fn get_user_by_email(&self, email: &str) -> Result<User, ApiError> {
        let response = self.db.client
            .from("users")
            .select("*")
            .eq("email", email)
            .limit(1)
            .execute()
            .await
            .map_err(|e| ApiError::Database(format!("Failed to fetch user: {}", e)))?;
        
        let users: Vec<User> = response.json().await
            .map_err(|e| ApiError::Database(format!("Failed to parse user: {}", e)))?;
        
        users.into_iter().next()
            .ok_or_else(|| ApiError::NotFound(format!("User with email {} not found", email)))
    }
    
    // Generate JWT token
    fn generate_token(&self, user: &User) -> Result<String, ApiError> {
        // Get current time
        let now = SystemTime::now().duration_since(UNIX_EPOCH)
            .map_err(|e| ApiError::Internal(format!("Failed to get system time: {}", e)))?
            .as_secs();
        
        // Create claims
        let claims = Claims {
            sub: user.id.to_string(),
            exp: now + 24 * 60 * 60, // 24 hours
            iat: now,
            email: user.email.clone(),
        };
        
        // Generate token
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(CONFIG.supabase_anon_key.as_bytes()),
        )
        .map_err(|e| ApiError::Internal(format!("Failed to generate token: {}", e)))?;
        
        Ok(token)
    }
    
    // Validate JWT token
    fn validate_token(&self, token: &str) -> Result<Claims, ApiError> {
        // Decode token
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(CONFIG.supabase_anon_key.as_bytes()),
            &Validation::new(Algorithm::HS256),
        )
        .map_err(|e| ApiError::Auth(format!("Invalid token: {}", e)))?;
        
        Ok(token_data.claims)
    }
}
