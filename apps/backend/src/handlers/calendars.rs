use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::Json,
};
use sea_orm::*;
use uuid::Uuid;

use crate::{
    auth::AuthenticatedUser,
    deks,
    entities::{calendars, prelude::*},
    errors::Result,
    handlers::dek_support,
    models::{
        ApiResponse,
        calendar::{CalendarResponse, CreateCalendarRequest, UpdateCalendarRequest},
    },
    state::AppState,
    websocket::{WebSocketMessage, extract_connection_id},
};

pub async fn list_calendars(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<Vec<CalendarResponse>>>> {
    let calendars = Calendars::find()
        .filter(calendars::Column::UserId.eq(authenticated_user.owner_user_id))
        .order_by_asc(calendars::Column::CreatedAt)
        .all(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let deks_by_resource = deks::load_deks_for_resources(
        &app_state.db.connection,
        authenticated_user.principal_id,
        calendars.iter().map(|c| c.id).collect(),
    )
    .await?;

    let response: Vec<CalendarResponse> = calendars
        .into_iter()
        .filter_map(|calendar| {
            let wrapped_dek = deks_by_resource.get(&calendar.id).cloned()?;
            let mut response: CalendarResponse = calendar.into();
            response.wrapped_dek = Some(dek_support::to_wrapped_dek_payload(wrapped_dek));
            Some(response)
        })
        .collect();

    Ok(Json(ApiResponse::new(response)))
}

pub async fn get_calendar(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<CalendarResponse>>> {
    let calendar = Calendars::find_by_id(id)
        .filter(calendars::Column::UserId.eq(authenticated_user.owner_user_id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Calendar not found".to_string()))?;

    let wrapped_dek = dek_support::attach_current_wrap(
        &app_state.db.connection,
        calendar.id,
        authenticated_user.principal_id,
    )
    .await?
    .ok_or_else(|| crate::errors::AppError::NotFound("Calendar not found".to_string()))?;

    let mut response: CalendarResponse = calendar.into();
    response.wrapped_dek = Some(wrapped_dek);

    Ok(Json(ApiResponse::new(response)))
}

pub async fn create_calendar(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Json(request): Json<CreateCalendarRequest>,
) -> Result<Json<ApiResponse<CalendarResponse>>> {
    let connection_id = extract_connection_id(&headers);
    dek_support::validate_payload(
        &request.algorithm,
        &request.ciphertext_hex,
        &request.nonce_hex,
        request.version,
        "payload",
    )?;
    dek_support::require_wraps(&request.wrapped_deks)?;

    let mut calendar_active = calendars::ActiveModel::new();
    calendar_active.user_id = Set(authenticated_user.owner_user_id);
    calendar_active.algorithm = Set(request.algorithm);
    calendar_active.ciphertext_hex = Set(request.ciphertext_hex);
    calendar_active.nonce_hex = Set(request.nonce_hex);
    calendar_active.version = Set(request.version);

    let calendar = calendar_active
        .insert(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let now = chrono::Utc::now().fixed_offset();
    dek_support::insert_wraps(
        &app_state.db.connection,
        calendar.id,
        &request.wrapped_deks,
        now,
    )
    .await?;
    let own_wrap = dek_support::attach_current_wrap(
        &app_state.db.connection,
        calendar.id,
        authenticated_user.principal_id,
    )
    .await?;

    let mut response: CalendarResponse = calendar.clone().into();
    response.wrapped_dek = own_wrap;

    tracing::info!(
        "Calendar created, broadcasting websocket message for owner {} (excluding connection {:?})",
        authenticated_user.owner_user_id,
        connection_id
    );
    let ws_message = WebSocketMessage {
        event_type: "INSERT".to_string(),
        table: "calendars".to_string(),
        user_id: authenticated_user.owner_user_id,
        record_id: Some(calendar.id),
        data: Some(serde_json::to_value(&response).unwrap_or_default()),
    };
    app_state
        .ws_state
        .broadcast_to_user(&authenticated_user.owner_user_id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        response,
        "Calendar created successfully",
    )))
}

pub async fn update_calendar(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateCalendarRequest>,
) -> Result<Json<ApiResponse<CalendarResponse>>> {
    let connection_id = extract_connection_id(&headers);

    let calendar = Calendars::find_by_id(id)
        .filter(calendars::Column::UserId.eq(authenticated_user.owner_user_id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Calendar not found".to_string()))?;

    let mut calendar_active: calendars::ActiveModel = calendar.into();

    if let (Some(algorithm), Some(ciphertext_hex), Some(nonce_hex), Some(version)) = (
        &request.algorithm,
        &request.ciphertext_hex,
        &request.nonce_hex,
        request.version,
    ) {
        dek_support::validate_payload(algorithm, ciphertext_hex, nonce_hex, version, "payload")?;
        calendar_active.algorithm = Set(algorithm.clone());
        calendar_active.ciphertext_hex = Set(ciphertext_hex.clone());
        calendar_active.nonce_hex = Set(nonce_hex.clone());
        calendar_active.version = Set(version);
    }
    if let Some(is_default) = request.is_default {
        calendar_active.is_default = Set(is_default);
    }

    let updated_calendar = calendar_active
        .update(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let now = chrono::Utc::now().fixed_offset();
    if let Some(wrapped_deks) = &request.wrapped_deks {
        dek_support::require_wraps(wrapped_deks)?;
        dek_support::replace_wraps(
            &app_state.db.connection,
            updated_calendar.id,
            wrapped_deks,
            now,
        )
        .await?;
    }
    let own_wrap = dek_support::attach_current_wrap(
        &app_state.db.connection,
        updated_calendar.id,
        authenticated_user.principal_id,
    )
    .await?;

    let mut response: CalendarResponse = updated_calendar.clone().into();
    response.wrapped_dek = own_wrap;

    tracing::info!(
        "Calendar updated, broadcasting websocket message for owner {} (excluding connection {:?})",
        authenticated_user.owner_user_id,
        connection_id
    );
    let ws_message = WebSocketMessage {
        event_type: "UPDATE".to_string(),
        table: "calendars".to_string(),
        user_id: authenticated_user.owner_user_id,
        record_id: Some(updated_calendar.id),
        data: Some(serde_json::to_value(&response).unwrap_or_default()),
    };
    app_state
        .ws_state
        .broadcast_to_user(&authenticated_user.owner_user_id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        response,
        "Calendar updated successfully",
    )))
}

pub async fn delete_calendar(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>> {
    let connection_id = extract_connection_id(&headers);

    let result = Calendars::delete_by_id(id)
        .filter(calendars::Column::UserId.eq(authenticated_user.owner_user_id))
        .exec(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    if result.rows_affected == 0 {
        return Err(crate::errors::AppError::NotFound(
            "Calendar not found".to_string(),
        ));
    }
    deks::delete_wrapped_deks_for_resource(&app_state.db.connection, id).await?;

    tracing::info!(
        "Calendar deleted, broadcasting websocket message for owner {} (excluding connection {:?})",
        authenticated_user.owner_user_id,
        connection_id
    );
    let ws_message = WebSocketMessage {
        event_type: "DELETE".to_string(),
        table: "calendars".to_string(),
        user_id: authenticated_user.owner_user_id,
        record_id: Some(id),
        data: None,
    };
    app_state
        .ws_state
        .broadcast_to_user(&authenticated_user.owner_user_id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        (),
        "Calendar deleted successfully",
    )))
}
