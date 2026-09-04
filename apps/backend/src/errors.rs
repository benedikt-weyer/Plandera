use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(Box<dyn std::error::Error + Send + Sync>),
    
    #[error("Authentication error: {0}")]
    Auth(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    
    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("SeaORM error: {0}")]
    SeaOrm(#[from] sea_orm::DbErr),
    
    #[error("Internal server error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::Database(ref err) => {
                tracing::error!("Database error: {:?}", err);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error occurred")
            }
            AppError::Auth(_) => (StatusCode::UNAUTHORIZED, "Authentication failed"),
            AppError::Validation(_) => (StatusCode::BAD_REQUEST, "Validation failed"),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "Resource not found"),
            AppError::Jwt(_) => (StatusCode::UNAUTHORIZED, "Invalid token"),
            AppError::Serialization(_) => (StatusCode::BAD_REQUEST, "Invalid data format"),
            AppError::SeaOrm(ref err) => {
                tracing::error!("SeaORM error: {:?}", err);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database operation failed")
            }
            AppError::Internal(ref err) => {
                tracing::error!("Internal error: {:?}", err);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
            }
        };

        let body = Json(json!({
            "error": error_message,
            "details": self.to_string()
        }));

        (status, body).into_response()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
