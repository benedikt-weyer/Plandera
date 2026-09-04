use axum::Json;
use crate::{models::ApiResponse, errors::Result};

pub async fn health_check() -> Result<Json<ApiResponse<String>>> {
    Ok(Json(ApiResponse::new("Backend is running successfully!".to_string())))
}
