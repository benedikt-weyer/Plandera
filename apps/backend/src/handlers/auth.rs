use axum::{
    extract::State,
    response::Json,
};

use crate::{
    errors::Result,
    models::{
        user::{CreateUserRequest, LoginRequest, AuthResponse, UserResponse},
        ApiResponse,
    },
    middleware::auth::AuthUser,
    state::AppState,
};

pub async fn register(
    State(app_state): State<AppState>,
    Json(request): Json<CreateUserRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>> {
    let response = app_state.auth_service.register(request).await?;
    Ok(Json(ApiResponse::with_message(response, "User registered successfully")))
}

pub async fn login(
    State(app_state): State<AppState>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>> {
    let response = app_state.auth_service.login(request).await?;
    Ok(Json(ApiResponse::with_message(response, "Login successful")))
}

pub async fn me(
    State(_app_state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<ApiResponse<UserResponse>>> {
    let user_response = auth_user.0.into();
    Ok(Json(ApiResponse::new(user_response)))
}
