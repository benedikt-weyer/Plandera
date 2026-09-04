use axum::extract::FromRef;
use crate::{auth::AuthService, db::Database, websocket::WebSocketState};

// Define the shared application state
#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub auth_service: AuthService,
    pub ws_state: WebSocketState,
}

// Implement FromRef so that individual services can be extracted from AppState
impl FromRef<AppState> for Database {
    fn from_ref(app_state: &AppState) -> Database {
        app_state.db.clone()
    }
}

impl FromRef<AppState> for AuthService {
    fn from_ref(app_state: &AppState) -> AuthService {
        app_state.auth_service.clone()
    }
}

impl FromRef<AppState> for WebSocketState {
    fn from_ref(app_state: &AppState) -> WebSocketState {
        app_state.ws_state.clone()
    }
}
