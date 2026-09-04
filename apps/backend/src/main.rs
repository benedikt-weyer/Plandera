mod auth;
mod db;
mod entities;
mod errors;
mod handlers;
mod middleware;
mod migrator;
mod models;
mod state;
mod websocket;

use axum::{
    routing::{get, post},
    Router,
};
use dotenvy::dotenv;
use sea_orm_migration::MigratorTrait;
use std::env;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use std::io::Write;

use crate::{
    auth::AuthService,
    db::Database,
    middleware::auth::auth_middleware,
    migrator::Migrator,
    state::AppState,
    websocket::WebSocketState,
};


#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables
    dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "streamline_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Streamline Backend...");
    std::io::stdout().flush().unwrap(); // force flush

    // Initialize database
    tracing::info!("Attempting to connect to database...");
    let db = Database::new().await?;
    tracing::info!("Database connected successfully");
    
    // Run migrations
    Migrator::up(&db.connection, None).await?;
    tracing::info!("Database migrations completed");

    // Initialize services
    let auth_service = AuthService::new(db.clone());
    let ws_state = WebSocketState::new();

    let app_state = AppState {
        db: db.clone(),
        auth_service: auth_service.clone(),
        ws_state: ws_state.clone(),
    };

    // Public routes (no authentication required)
    let public_app = Router::new()
        .route("/api/auth/register", post(crate::handlers::auth::register))
        .route("/api/auth/login", post(crate::handlers::auth::login))
        .route("/health", get(crate::handlers::health::health_check))
        .route("/ws", get(crate::websocket::websocket_handler))
        .with_state(app_state.clone());

    // Protected routes (authentication required)
    let protected_app = Router::new()
        .route("/api/auth/me", get(crate::handlers::auth::me))
        .route("/api/projects", 
               get(crate::handlers::projects::list_projects)
               .post(crate::handlers::projects::create_project))
        .route("/api/projects/{id}", 
               get(crate::handlers::projects::get_project)
               .put(crate::handlers::projects::update_project)
               .delete(crate::handlers::projects::delete_project))
        .route("/api/can-do-list", 
               get(crate::handlers::can_do_list::list_items)
               .post(crate::handlers::can_do_list::create_item))
        .route("/api/can-do-list/{id}", 
               get(crate::handlers::can_do_list::get_item)
               .put(crate::handlers::can_do_list::update_item)
               .delete(crate::handlers::can_do_list::delete_item))
        .route("/api/calendars", 
               get(crate::handlers::calendars::list_calendars)
               .post(crate::handlers::calendars::create_calendar))
        .route("/api/calendars/{id}", 
               get(crate::handlers::calendars::get_calendar)
               .put(crate::handlers::calendars::update_calendar)
               .delete(crate::handlers::calendars::delete_calendar))
        .route("/api/calendar-events", 
               get(crate::handlers::calendar_events::list_events)
               .post(crate::handlers::calendar_events::create_event))
        .route("/api/calendar-events/{id}", 
               get(crate::handlers::calendar_events::get_event)
               .put(crate::handlers::calendar_events::update_event)
               .delete(crate::handlers::calendar_events::delete_event))
         .route("/api/countdowns",
             get(crate::handlers::countdowns::list_countdowns)
             .post(crate::handlers::countdowns::create_countdown))
         .route("/api/countdowns/{id}",
             get(crate::handlers::countdowns::get_countdown)
             .put(crate::handlers::countdowns::update_countdown)
             .delete(crate::handlers::countdowns::delete_countdown))
        .route("/api/user-settings",
               get(crate::handlers::user_settings::get_user_settings)
               .put(crate::handlers::user_settings::update_user_settings))
        .layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            auth_middleware,
        ))
        .with_state(app_state.clone());

    // Combine the apps
    let app = Router::new()
        .merge(public_app)
        .merge(protected_app)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive()),
        );

    // Start server
    let port = env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app.into_make_service()).await?;

    Ok(())
}