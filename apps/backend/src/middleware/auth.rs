use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};

use crate::{auth::service::extract_bearer_token, errors::AppError};

pub async fn auth_middleware(
    State(app_state): State<crate::state::AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let (mut parts, body) = req.into_parts();
    let token = extract_bearer_token(&parts)?;
    let authenticated_user = app_state.auth_service.authenticate_access_token(token)?;

    parts.extensions.insert(authenticated_user);
    req = Request::from_parts(parts, body);

    Ok(next.run(req).await)
}
