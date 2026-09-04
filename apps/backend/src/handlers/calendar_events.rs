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
    entities::{calendar_events, prelude::*},
    errors::Result,
    handlers::dek_support,
    models::{
        ApiResponse,
        calendar_event::{
            CalendarEventResponse, CreateCalendarEventRequest, UpdateCalendarEventRequest,
        },
    },
    state::AppState,
    websocket::{WebSocketMessage, extract_connection_id},
};

pub async fn list_events(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<Vec<CalendarEventResponse>>>> {
    let events = CalendarEvents::find()
        .filter(calendar_events::Column::UserId.eq(authenticated_user.owner_user_id))
        .order_by_asc(calendar_events::Column::CreatedAt)
        .all(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let deks_by_resource = deks::load_deks_for_resources(
        &app_state.db.connection,
        authenticated_user.principal_id,
        events.iter().map(|event| event.id).collect(),
    )
    .await?;

    let response: Vec<CalendarEventResponse> = events
        .into_iter()
        .filter_map(|event| {
            let wrapped_dek = deks_by_resource.get(&event.id).cloned()?;
            let mut response: CalendarEventResponse = event.into();
            response.wrapped_dek = Some(dek_support::to_wrapped_dek_payload(wrapped_dek));
            Some(response)
        })
        .collect();

    Ok(Json(ApiResponse::new(response)))
}

pub async fn get_event(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<CalendarEventResponse>>> {
    let event = CalendarEvents::find_by_id(id)
        .filter(calendar_events::Column::UserId.eq(authenticated_user.owner_user_id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Calendar event not found".to_string()))?;

    let wrapped_dek = dek_support::attach_current_wrap(
        &app_state.db.connection,
        event.id,
        authenticated_user.principal_id,
    )
    .await?
    .ok_or_else(|| crate::errors::AppError::NotFound("Calendar event not found".to_string()))?;

    let mut response: CalendarEventResponse = event.into();
    response.wrapped_dek = Some(wrapped_dek);

    Ok(Json(ApiResponse::new(response)))
}

pub async fn create_event(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Json(request): Json<CreateCalendarEventRequest>,
) -> Result<Json<ApiResponse<CalendarEventResponse>>> {
    let connection_id = extract_connection_id(&headers);
    dek_support::validate_payload(
        &request.algorithm,
        &request.ciphertext_hex,
        &request.nonce_hex,
        request.version,
        "payload",
    )?;
    dek_support::require_wraps(&request.wrapped_deks)?;

    let mut event_active = calendar_events::ActiveModel::new();
    event_active.user_id = Set(authenticated_user.owner_user_id);
    event_active.algorithm = Set(request.algorithm);
    event_active.ciphertext_hex = Set(request.ciphertext_hex);
    event_active.nonce_hex = Set(request.nonce_hex);
    event_active.version = Set(request.version);

    let event = event_active
        .insert(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let now = chrono::Utc::now().fixed_offset();
    dek_support::insert_wraps(
        &app_state.db.connection,
        event.id,
        &request.wrapped_deks,
        now,
    )
    .await?;
    let own_wrap = dek_support::attach_current_wrap(
        &app_state.db.connection,
        event.id,
        authenticated_user.principal_id,
    )
    .await?;

    let mut response: CalendarEventResponse = event.clone().into();
    response.wrapped_dek = own_wrap;

    tracing::info!(
        "Calendar event created, broadcasting websocket message for owner {} (excluding connection {:?})",
        authenticated_user.owner_user_id,
        connection_id
    );
    let ws_message = WebSocketMessage {
        event_type: "INSERT".to_string(),
        table: "calendar_events".to_string(),
        user_id: authenticated_user.owner_user_id,
        record_id: Some(event.id),
        data: Some(serde_json::to_value(&response).unwrap_or_default()),
    };
    app_state
        .ws_state
        .broadcast_to_user(&authenticated_user.owner_user_id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        response,
        "Calendar event created successfully",
    )))
}

pub async fn update_event(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateCalendarEventRequest>,
) -> Result<Json<ApiResponse<CalendarEventResponse>>> {
    let connection_id = extract_connection_id(&headers);

    let event = CalendarEvents::find_by_id(id)
        .filter(calendar_events::Column::UserId.eq(authenticated_user.owner_user_id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Calendar event not found".to_string()))?;

    let mut event_active: calendar_events::ActiveModel = event.into();

    if let (Some(algorithm), Some(ciphertext_hex), Some(nonce_hex), Some(version)) = (
        &request.algorithm,
        &request.ciphertext_hex,
        &request.nonce_hex,
        request.version,
    ) {
        dek_support::validate_payload(algorithm, ciphertext_hex, nonce_hex, version, "payload")?;
        event_active.algorithm = Set(algorithm.clone());
        event_active.ciphertext_hex = Set(ciphertext_hex.clone());
        event_active.nonce_hex = Set(nonce_hex.clone());
        event_active.version = Set(version);
    }

    let updated_event = event_active
        .update(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let now = chrono::Utc::now().fixed_offset();
    if let Some(wrapped_deks) = &request.wrapped_deks {
        dek_support::require_wraps(wrapped_deks)?;
        dek_support::replace_wraps(
            &app_state.db.connection,
            updated_event.id,
            wrapped_deks,
            now,
        )
        .await?;
    }
    let own_wrap = dek_support::attach_current_wrap(
        &app_state.db.connection,
        updated_event.id,
        authenticated_user.principal_id,
    )
    .await?;

    let mut response: CalendarEventResponse = updated_event.clone().into();
    response.wrapped_dek = own_wrap;

    tracing::info!(
        "Calendar event updated, broadcasting websocket message for owner {} (excluding connection {:?})",
        authenticated_user.owner_user_id,
        connection_id
    );
    let ws_message = WebSocketMessage {
        event_type: "UPDATE".to_string(),
        table: "calendar_events".to_string(),
        user_id: authenticated_user.owner_user_id,
        record_id: Some(updated_event.id),
        data: Some(serde_json::to_value(&response).unwrap_or_default()),
    };
    app_state
        .ws_state
        .broadcast_to_user(&authenticated_user.owner_user_id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        response,
        "Calendar event updated successfully",
    )))
}

pub async fn delete_event(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>> {
    let connection_id = extract_connection_id(&headers);

    let result = CalendarEvents::delete_by_id(id)
        .filter(calendar_events::Column::UserId.eq(authenticated_user.owner_user_id))
        .exec(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    if result.rows_affected == 0 {
        return Err(crate::errors::AppError::NotFound(
            "Calendar event not found".to_string(),
        ));
    }
    deks::delete_wrapped_deks_for_resource(&app_state.db.connection, id).await?;

    tracing::info!(
        "Calendar event deleted, broadcasting websocket message for owner {} (excluding connection {:?})",
        authenticated_user.owner_user_id,
        connection_id
    );
    let ws_message = WebSocketMessage {
        event_type: "DELETE".to_string(),
        table: "calendar_events".to_string(),
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
        "Calendar event deleted successfully",
    )))
}
