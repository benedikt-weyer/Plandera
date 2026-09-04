use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};

use crate::{
    errors::AppError,
    entities::users,
};

#[derive(Clone)]
pub struct AuthUser(pub users::Model);

pub async fn auth_middleware(
    State(app_state): State<crate::state::AppState>,
    TypedHeader(authorization): TypedHeader<Authorization<Bearer>>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = authorization.token();
    
    let user = app_state.auth_service.get_user_from_token(token).await?;
    
    // Insert the user into request extensions
    req.extensions_mut().insert(AuthUser(user));
    
    Ok(next.run(req).await)
}

// Helper to extract user from request extensions
impl axum::extract::FromRequestParts<crate::state::AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &crate::state::AppState,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or_else(|| AppError::Auth("User not found in request".to_string()))
    }
}
