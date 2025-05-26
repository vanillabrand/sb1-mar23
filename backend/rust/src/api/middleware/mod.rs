// Middleware temporarily disabled for compilation
pub mod cors;

use actix_web::HttpRequest;
use crate::error::ApiError;

// Extract user ID from request headers
pub fn extract_user_id(req: &HttpRequest) -> Result<String, ApiError> {
    // Try to get user ID from X-User-ID header (sent by frontend)
    if let Some(user_id_header) = req.headers().get("X-User-ID") {
        if let Ok(user_id) = user_id_header.to_str() {
            if !user_id.is_empty() {
                return Ok(user_id.to_string());
            }
        }
    }

    // Fallback: try to extract from Authorization header (JWT token)
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token = &auth_str[7..]; // Remove "Bearer " prefix
                // For Supabase JWT tokens, we could decode them here
                // For now, we'll use a fallback user ID
                return Ok("supabase-user".to_string());
            }
        }
    }

    // For demo purposes, return a mock user ID if no headers found
    Ok("demo-user-id".to_string())
}

/*
use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage, HttpRequest, ResponseError,
};
use futures::future::Ready;
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use std::future::{ready, Future};
use std::pin::Pin;
use std::rc::Rc;
use crate::error::ApiError;

// pub mod auth;
// pub mod rate_limit;
// pub mod logging;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // Subject (user ID)
    pub email: String,
    pub exp: usize,   // Expiration time
    pub iat: usize,   // Issued at
    pub aud: String,  // Audience
    pub iss: String,  // Issuer
}

pub fn extract_user_id(req: &HttpRequest) -> Result<String, ApiError> {
    // Try to get user ID from request extensions (set by auth middleware)
    if let Some(user_id) = req.extensions().get::<String>() {
        return Ok(user_id.clone());
    }

    // Fallback: extract from Authorization header
    let auth_header = req
        .headers()
        .get("Authorization")
        .ok_or_else(|| ApiError::Auth("Missing Authorization header".to_string()))?
        .to_str()
        .map_err(|_| ApiError::Auth("Invalid Authorization header format".to_string()))?;

    if !auth_header.starts_with("Bearer ") {
        return Err(ApiError::Auth("Invalid Authorization header format".to_string()));
    }

    let token = &auth_header[7..]; // Remove "Bearer " prefix

    // In production, you would validate the JWT token here
    // For now, we'll extract the user ID from the token payload
    extract_user_id_from_token(token)
}

fn extract_user_id_from_token(token: &str) -> Result<String, ApiError> {
    // Get JWT secret from environment
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "your-secret-key".to_string());

    let validation = Validation::new(Algorithm::HS256);

    match decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_ref()),
        &validation,
    ) {
        Ok(token_data) => Ok(token_data.claims.sub),
        Err(err) => {
            log::warn!("JWT validation failed: {}", err);
            Err(ApiError::Auth("Invalid or expired token".to_string()))
        }
    }
}

// Authentication middleware
pub struct AuthMiddleware<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for AuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();

        Box::pin(async move {
            // Skip auth for health check and public endpoints
            let path = req.path();
            if path == "/health" || path == "/metrics" || path.starts_with("/docs") {
                return service.call(req).await;
            }

            // Extract and validate user ID
            match extract_user_id(req.request()) {
                Ok(user_id) => {
                    // Store user ID in request extensions for later use
                    req.extensions_mut().insert(user_id);
                    service.call(req).await
                }
                Err(auth_error) => {
                    let response = auth_error.error_response();
                    Ok(req.into_response(response))
                }
            }
        })
    }
}

pub struct AuthMiddlewareFactory;

impl<S, B> Transform<S, ServiceRequest> for AuthMiddlewareFactory
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = AuthMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddleware {
            service: Rc::new(service),
        }))
    }
}
*/
