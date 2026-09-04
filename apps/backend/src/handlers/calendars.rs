use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::Json,
};
use sea_orm::*;
use uuid::Uuid;

use crate::{
    entities::{prelude::*, calendars},
    errors::Result,
    middleware::auth::AuthUser,
    models::{
        calendar::{CreateCalendarRequest, UpdateCalendarRequest, CalendarResponse},
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

pub async fn list_calendars(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<ApiResponse<Vec<CalendarResponse>>>> {
    let calendars = Calendars::find()
        .filter(calendars::Column::UserId.eq(auth_user.0.id))
        .order_by_asc(calendars::Column::CreatedAt)
        .all(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let response: Vec<CalendarResponse> = calendars.into_iter().map(|calendar| calendar.into()).collect();
    Ok(Json(ApiResponse::new(response)))
}

pub async fn get_calendar(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<CalendarResponse>>> {
    let calendar = Calendars::find_by_id(id)
        .filter(calendars::Column::UserId.eq(auth_user.0.id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Calendar not found".to_string()))?;

    Ok(Json(ApiResponse::new(calendar.into())))
}

pub async fn create_calendar(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    headers: HeaderMap,
    Json(request): Json<CreateCalendarRequest>,
) -> Result<Json<ApiResponse<CalendarResponse>>> {
    let connection_id = extract_connection_id(&headers);
    
    let mut calendar_active = calendars::ActiveModel::new();
    calendar_active.user_id = Set(auth_user.0.id);
    calendar_active.encrypted_data = Set(request.encrypted_data);
    calendar_active.iv = Set(request.iv);
    calendar_active.salt = Set(request.salt);

    let calendar = calendar_active.insert(&app_state.db.connection).await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    // Broadcast websocket message for calendar creation
    tracing::info!("Calendar created, broadcasting websocket message for user {} (excluding connection {:?})", auth_user.0.id, connection_id);
    let ws_message = WebSocketMessage {
        event_type: "INSERT".to_string(),
        table: "calendars".to_string(),
        user_id: auth_user.0.id,
        record_id: Some(calendar.id),
        data: Some(serde_json::to_value(&CalendarResponse::from(calendar.clone())).unwrap_or_default()),
    };
    app_state.ws_state.broadcast_to_user(&auth_user.0.id, ws_message, connection_id).await;

    Ok(Json(ApiResponse::with_message(calendar.into(), "Calendar created successfully")))
}

pub async fn update_calendar(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateCalendarRequest>,
) -> Result<Json<ApiResponse<CalendarResponse>>> {
    let connection_id = extract_connection_id(&headers);
    
    let calendar = Calendars::find_by_id(id)
        .filter(calendars::Column::UserId.eq(auth_user.0.id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Calendar not found".to_string()))?;

    let mut calendar_active: calendars::ActiveModel = calendar.into();
    
    if let Some(encrypted_data) = request.encrypted_data {
        calendar_active.encrypted_data = Set(encrypted_data);
    }
    if let Some(iv) = request.iv {
        calendar_active.iv = Set(iv);
    }
    if let Some(salt) = request.salt {
        calendar_active.salt = Set(salt);
    }
    if let Some(is_default) = request.is_default {
        calendar_active.is_default = Set(is_default);
    }

    let updated_calendar = calendar_active.update(&app_state.db.connection).await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    // Broadcast websocket message for calendar update
    tracing::info!("Calendar updated, broadcasting websocket message for user {} (excluding connection {:?})", auth_user.0.id, connection_id);
    let ws_message = WebSocketMessage {
        event_type: "UPDATE".to_string(),
        table: "calendars".to_string(),
        user_id: auth_user.0.id,
        record_id: Some(updated_calendar.id),
        data: Some(serde_json::to_value(&CalendarResponse::from(updated_calendar.clone())).unwrap_or_default()),
    };
    app_state.ws_state.broadcast_to_user(&auth_user.0.id, ws_message, connection_id).await;

    Ok(Json(ApiResponse::with_message(updated_calendar.into(), "Calendar updated successfully")))
}

pub async fn delete_calendar(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>> {
    let connection_id = extract_connection_id(&headers);
    
    let result = Calendars::delete_by_id(id)
        .filter(calendars::Column::UserId.eq(auth_user.0.id))
        .exec(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    if result.rows_affected == 0 {
        return Err(crate::errors::AppError::NotFound("Calendar not found".to_string()));
    }

    // Broadcast websocket message for calendar deletion
    tracing::info!("Calendar deleted, broadcasting websocket message for user {} (excluding connection {:?})", auth_user.0.id, connection_id);
    let ws_message = WebSocketMessage {
        event_type: "DELETE".to_string(),
        table: "calendars".to_string(),
        user_id: auth_user.0.id,
        record_id: Some(id),
        data: None,
    };
    app_state.ws_state.broadcast_to_user(&auth_user.0.id, ws_message, connection_id).await;

    Ok(Json(ApiResponse::with_message((), "Calendar deleted successfully")))
}
