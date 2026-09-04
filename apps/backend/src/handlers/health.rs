use crate::{errors::Result, models::ApiResponse};
use axum::Json;

pub async fn health_check() -> Result<Json<ApiResponse<String>>> {
    Ok(Json(ApiResponse::new(
        "Backend is running successfully!".to_string(),
    )))
}
