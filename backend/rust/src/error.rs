use actix_web::{HttpResponse, ResponseError};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ApiError {
    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Exchange error: {0}")]
    Exchange(String),

    #[error("External API error: {0}")]
    ExternalApi(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimit(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),
}

#[derive(Serialize, Deserialize)]
struct ErrorResponse {
    error: String,
    message: String,
    status_code: u16,
}

impl ResponseError for ApiError {
    fn error_response(&self) -> HttpResponse {
        let (status_code, error_type) = match self {
            ApiError::Auth(_) => (actix_web::http::StatusCode::UNAUTHORIZED, "UNAUTHORIZED"),
            ApiError::Database(_) => (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "DATABASE_ERROR"),
            ApiError::Validation(_) => (actix_web::http::StatusCode::BAD_REQUEST, "VALIDATION_ERROR"),
            ApiError::NotFound(_) => (actix_web::http::StatusCode::NOT_FOUND, "NOT_FOUND"),
            ApiError::Exchange(_) => (actix_web::http::StatusCode::BAD_GATEWAY, "EXCHANGE_ERROR"),
            ApiError::ExternalApi(_) => (actix_web::http::StatusCode::BAD_GATEWAY, "EXTERNAL_API_ERROR"),
            ApiError::RateLimit(_) => (actix_web::http::StatusCode::TOO_MANY_REQUESTS, "RATE_LIMIT_EXCEEDED"),
            ApiError::Internal(_) => (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR"),
            ApiError::ConfigError(_) => (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "CONFIG_ERROR"),
        };

        let error_response = ErrorResponse {
            error: error_type.to_string(),
            message: self.to_string(),
            status_code: status_code.as_u16(),
        };

        HttpResponse::build(status_code).json(error_response)
    }
}

// Utility functions for error conversion
// Note: postgrest::RequestError is not available in current version
// Database errors will be handled through other error types

impl From<reqwest::Error> for ApiError {
    fn from(err: reqwest::Error) -> Self {
        ApiError::ExternalApi(err.to_string())
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(err: serde_json::Error) -> Self {
        ApiError::Validation(err.to_string())
    }
}

impl From<std::io::Error> for ApiError {
    fn from(err: std::io::Error) -> Self {
        ApiError::Internal(err.to_string())
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        ApiError::Internal(err.to_string())
    }
}
