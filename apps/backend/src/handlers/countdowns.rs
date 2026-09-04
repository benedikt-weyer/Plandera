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
    entities::{calendar_events, countdowns, prelude::*},
    errors::{AppError, Result},
    handlers::dek_support,
    models::{
        ApiResponse,
        countdown::{CountdownResponse, CreateCountdownRequest, UpdateCountdownRequest},
    },
    state::AppState,
    websocket::{WebSocketMessage, extract_connection_id},
};

async fn ensure_event_access(
    db: &DatabaseConnection,
    owner_user_id: Uuid,
    event_id: Uuid,
) -> Result<()> {
    let event_exists = CalendarEvents::find_by_id(event_id)
        .filter(calendar_events::Column::UserId.eq(owner_user_id))
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
    authenticated_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<Vec<CountdownResponse>>>> {
    let countdowns = Countdowns::find()
        .filter(countdowns::Column::UserId.eq(authenticated_user.owner_user_id))
        .order_by_asc(countdowns::Column::CreatedAt)
        .all(&app_state.db.connection)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    let deks_by_resource = deks::load_deks_for_resources(
        &app_state.db.connection,
        authenticated_user.principal_id,
        countdowns.iter().map(|c| c.id).collect(),
    )
    .await?;

    let response: Vec<CountdownResponse> = countdowns
        .into_iter()
        .filter_map(|countdown| {
            let wrapped_dek = deks_by_resource.get(&countdown.id).cloned()?;
            let mut response: CountdownResponse = countdown.into();
            response.wrapped_dek = Some(dek_support::to_wrapped_dek_payload(wrapped_dek));
            Some(response)
        })
        .collect();

    Ok(Json(ApiResponse::new(response)))
}

pub async fn get_countdown(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<CountdownResponse>>> {
    let countdown = Countdowns::find_by_id(id)
        .filter(countdowns::Column::UserId.eq(authenticated_user.owner_user_id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| AppError::Database(e.into()))?
        .ok_or_else(|| AppError::NotFound("Countdown not found".to_string()))?;

    let wrapped_dek = dek_support::attach_current_wrap(
        &app_state.db.connection,
        countdown.id,
        authenticated_user.principal_id,
    )
    .await?
    .ok_or_else(|| AppError::NotFound("Countdown not found".to_string()))?;

    let mut response: CountdownResponse = countdown.into();
    response.wrapped_dek = Some(wrapped_dek);

    Ok(Json(ApiResponse::new(response)))
}

pub async fn create_countdown(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Json(request): Json<CreateCountdownRequest>,
) -> Result<Json<ApiResponse<CountdownResponse>>> {
    let connection_id = extract_connection_id(&headers);
    ensure_event_access(
        &app_state.db.connection,
        authenticated_user.owner_user_id,
        request.event_id,
    )
    .await?;
    dek_support::validate_payload(
        &request.algorithm,
        &request.ciphertext_hex,
        &request.nonce_hex,
        request.version,
        "payload",
    )?;
    dek_support::require_wraps(&request.wrapped_deks)?;

    let mut countdown_active = countdowns::ActiveModel::new();
    countdown_active.user_id = Set(authenticated_user.owner_user_id);
    countdown_active.event_id = Set(request.event_id);
    countdown_active.algorithm = Set(request.algorithm);
    countdown_active.ciphertext_hex = Set(request.ciphertext_hex);
    countdown_active.nonce_hex = Set(request.nonce_hex);
    countdown_active.version = Set(request.version);

    let countdown = countdown_active
        .insert(&app_state.db.connection)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    let now = chrono::Utc::now().fixed_offset();
    dek_support::insert_wraps(
        &app_state.db.connection,
        countdown.id,
        &request.wrapped_deks,
        now,
    )
    .await?;
    let own_wrap = dek_support::attach_current_wrap(
        &app_state.db.connection,
        countdown.id,
        authenticated_user.principal_id,
    )
    .await?;

    let mut response: CountdownResponse = countdown.clone().into();
    response.wrapped_dek = own_wrap;

    let ws_message = WebSocketMessage {
        event_type: "INSERT".to_string(),
        table: "countdowns".to_string(),
        user_id: authenticated_user.owner_user_id,
        record_id: Some(countdown.id),
        data: Some(serde_json::to_value(&response).unwrap_or_default()),
    };
    app_state
        .ws_state
        .broadcast_to_user(&authenticated_user.owner_user_id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        response,
        "Countdown created successfully",
    )))
}

pub async fn update_countdown(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateCountdownRequest>,
) -> Result<Json<ApiResponse<CountdownResponse>>> {
    let connection_id = extract_connection_id(&headers);

    if let Some(event_id) = request.event_id {
        ensure_event_access(
            &app_state.db.connection,
            authenticated_user.owner_user_id,
            event_id,
        )
        .await?;
    }

    let countdown = Countdowns::find_by_id(id)
        .filter(countdowns::Column::UserId.eq(authenticated_user.owner_user_id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| AppError::Database(e.into()))?
        .ok_or_else(|| AppError::NotFound("Countdown not found".to_string()))?;

    let mut countdown_active: countdowns::ActiveModel = countdown.into();

    if let Some(event_id) = request.event_id {
        countdown_active.event_id = Set(event_id);
    }
    if let (Some(algorithm), Some(ciphertext_hex), Some(nonce_hex), Some(version)) = (
        &request.algorithm,
        &request.ciphertext_hex,
        &request.nonce_hex,
        request.version,
    ) {
        dek_support::validate_payload(algorithm, ciphertext_hex, nonce_hex, version, "payload")?;
        countdown_active.algorithm = Set(algorithm.clone());
        countdown_active.ciphertext_hex = Set(ciphertext_hex.clone());
        countdown_active.nonce_hex = Set(nonce_hex.clone());
        countdown_active.version = Set(version);
    }

    let updated_countdown = countdown_active
        .update(&app_state.db.connection)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    let now = chrono::Utc::now().fixed_offset();
    if let Some(wrapped_deks) = &request.wrapped_deks {
        dek_support::require_wraps(wrapped_deks)?;
        dek_support::replace_wraps(
            &app_state.db.connection,
            updated_countdown.id,
            wrapped_deks,
            now,
        )
        .await?;
    }
    let own_wrap = dek_support::attach_current_wrap(
        &app_state.db.connection,
        updated_countdown.id,
        authenticated_user.principal_id,
    )
    .await?;

    let mut response: CountdownResponse = updated_countdown.clone().into();
    response.wrapped_dek = own_wrap;

    let ws_message = WebSocketMessage {
        event_type: "UPDATE".to_string(),
        table: "countdowns".to_string(),
        user_id: authenticated_user.owner_user_id,
        record_id: Some(updated_countdown.id),
        data: Some(serde_json::to_value(&response).unwrap_or_default()),
    };
    app_state
        .ws_state
        .broadcast_to_user(&authenticated_user.owner_user_id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        response,
        "Countdown updated successfully",
    )))
}

pub async fn delete_countdown(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>> {
    let connection_id = extract_connection_id(&headers);

    let result = Countdowns::delete_by_id(id)
        .filter(countdowns::Column::UserId.eq(authenticated_user.owner_user_id))
        .exec(&app_state.db.connection)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    if result.rows_affected == 0 {
        return Err(AppError::NotFound("Countdown not found".to_string()));
    }
    deks::delete_wrapped_deks_for_resource(&app_state.db.connection, id).await?;

    let ws_message = WebSocketMessage {
        event_type: "DELETE".to_string(),
        table: "countdowns".to_string(),
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
        "Countdown deleted successfully",
    )))
}
