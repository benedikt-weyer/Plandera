use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::Json,
};
use sea_orm::*;
use uuid::Uuid;

use crate::{
    entities::{calendar_events, countdowns, prelude::*},
    errors::{AppError, Result},
    middleware::auth::AuthUser,
    models::{
        countdown::{CountdownResponse, CreateCountdownRequest, UpdateCountdownRequest},
        ApiResponse,
    },
    state::AppState,
    websocket::WebSocketMessage,
};

fn extract_connection_id(headers: &HeaderMap) -> Option<Uuid> {
    headers
        .get("x-connection-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
}

async fn ensure_event_access(
    db: &DatabaseConnection,
    user_id: Uuid,
    event_id: Uuid,
) -> Result<()> {
    let event_exists = CalendarEvents::find_by_id(event_id)
        .filter(calendar_events::Column::UserId.eq(user_id))
        .one(db)
        .await
        .map_err(|e| AppError::Database(e.into()))?
        .is_some();

    if event_exists {
        Ok(())
    } else {
        Err(AppError::Validation(
            "Referenced calendar event was not found".to_string(),
        ))
    }
}

pub async fn list_countdowns(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<ApiResponse<Vec<CountdownResponse>>>> {
    let countdowns = Countdowns::find()
        .filter(countdowns::Column::UserId.eq(auth_user.0.id))
        .order_by_asc(countdowns::Column::CreatedAt)
        .all(&app_state.db.connection)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    let response = countdowns
        .into_iter()
        .map(CountdownResponse::from)
        .collect();

    Ok(Json(ApiResponse::new(response)))
}

pub async fn get_countdown(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<CountdownResponse>>> {
    let countdown = Countdowns::find_by_id(id)
        .filter(countdowns::Column::UserId.eq(auth_user.0.id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| AppError::Database(e.into()))?
        .ok_or_else(|| AppError::NotFound("Countdown not found".to_string()))?;

    Ok(Json(ApiResponse::new(countdown.into())))
}

pub async fn create_countdown(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    headers: HeaderMap,
    Json(request): Json<CreateCountdownRequest>,
) -> Result<Json<ApiResponse<CountdownResponse>>> {
    let connection_id = extract_connection_id(&headers);
    ensure_event_access(&app_state.db.connection, auth_user.0.id, request.event_id).await?;

    let mut countdown_active = countdowns::ActiveModel::new();
    countdown_active.user_id = Set(auth_user.0.id);
    countdown_active.event_id = Set(request.event_id);
    countdown_active.encrypted_data = Set(request.encrypted_data);
    countdown_active.iv = Set(request.iv);
    countdown_active.salt = Set(request.salt);

    let countdown = countdown_active
        .insert(&app_state.db.connection)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    let ws_message = WebSocketMessage {
        event_type: "INSERT".to_string(),
        table: "countdowns".to_string(),
        user_id: auth_user.0.id,
        record_id: Some(countdown.id),
        data: Some(serde_json::to_value(CountdownResponse::from(countdown.clone())).unwrap_or_default()),
    };
    app_state
        .ws_state
        .broadcast_to_user(&auth_user.0.id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        countdown.into(),
        "Countdown created successfully",
    )))
}

pub async fn update_countdown(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateCountdownRequest>,
) -> Result<Json<ApiResponse<CountdownResponse>>> {
    let connection_id = extract_connection_id(&headers);

    if let Some(event_id) = request.event_id {
        ensure_event_access(&app_state.db.connection, auth_user.0.id, event_id).await?;
    }

    let countdown = Countdowns::find_by_id(id)
        .filter(countdowns::Column::UserId.eq(auth_user.0.id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| AppError::Database(e.into()))?
        .ok_or_else(|| AppError::NotFound("Countdown not found".to_string()))?;

    let mut countdown_active: countdowns::ActiveModel = countdown.into();

    if let Some(event_id) = request.event_id {
        countdown_active.event_id = Set(event_id);
    }
    if let Some(encrypted_data) = request.encrypted_data {
        countdown_active.encrypted_data = Set(encrypted_data);
    }
    if let Some(iv) = request.iv {
        countdown_active.iv = Set(iv);
    }
    if let Some(salt) = request.salt {
        countdown_active.salt = Set(salt);
    }

    let updated_countdown = countdown_active
        .update(&app_state.db.connection)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    let ws_message = WebSocketMessage {
        event_type: "UPDATE".to_string(),
        table: "countdowns".to_string(),
        user_id: auth_user.0.id,
        record_id: Some(updated_countdown.id),
        data: Some(
            serde_json::to_value(CountdownResponse::from(updated_countdown.clone())).unwrap_or_default(),
        ),
    };
    app_state
        .ws_state
        .broadcast_to_user(&auth_user.0.id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        updated_countdown.into(),
        "Countdown updated successfully",
    )))
}

pub async fn delete_countdown(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>> {
    let connection_id = extract_connection_id(&headers);

    let result = Countdowns::delete_by_id(id)
        .filter(countdowns::Column::UserId.eq(auth_user.0.id))
        .exec(&app_state.db.connection)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    if result.rows_affected == 0 {
        return Err(AppError::NotFound("Countdown not found".to_string()));
    }

    let ws_message = WebSocketMessage {
        event_type: "DELETE".to_string(),
        table: "countdowns".to_string(),
        user_id: auth_user.0.id,
        record_id: Some(id),
        data: None,
    };
    app_state
        .ws_state
        .broadcast_to_user(&auth_user.0.id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        (),
        "Countdown deleted successfully",
    )))
}