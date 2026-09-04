use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    response::Json,
};
use sea_orm::*;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    auth::AuthenticatedUser,
    deks,
    entities::{can_do_list, prelude::*},
    errors::Result,
    handlers::dek_support,
    models::{
        ApiResponse,
        can_do_list::{CanDoItemResponse, CreateCanDoItemRequest, UpdateCanDoItemRequest},
    },
    state::AppState,
    websocket::{WebSocketMessage, extract_connection_id},
};

#[derive(Debug, Deserialize)]
pub struct CanDoListQuery {
    pub project_id: Option<Uuid>,
}

pub async fn list_items(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    Query(query): Query<CanDoListQuery>,
) -> Result<Json<ApiResponse<Vec<CanDoItemResponse>>>> {
    let mut find =
        CanDoList::find().filter(can_do_list::Column::UserId.eq(authenticated_user.owner_user_id));

    if let Some(project_id) = query.project_id {
        find = find.filter(can_do_list::Column::ProjectId.eq(project_id));
    }

    let items = find
        .order_by_asc(can_do_list::Column::DisplayOrder)
        .order_by_desc(can_do_list::Column::CreatedAt)
        .all(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let deks_by_resource = deks::load_deks_for_resources(
        &app_state.db.connection,
        authenticated_user.principal_id,
        items.iter().map(|item| item.id).collect(),
    )
    .await?;

    let response: Vec<CanDoItemResponse> = items
        .into_iter()
        .filter_map(|item| {
            let wrapped_dek = deks_by_resource.get(&item.id).cloned()?;
            let mut response: CanDoItemResponse = item.into();
            response.wrapped_dek = Some(dek_support::to_wrapped_dek_payload(wrapped_dek));
            Some(response)
        })
        .collect();

    Ok(Json(ApiResponse::new(response)))
}

pub async fn get_item(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<CanDoItemResponse>>> {
    let item = CanDoList::find_by_id(id)
        .filter(can_do_list::Column::UserId.eq(authenticated_user.owner_user_id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Can-do item not found".to_string()))?;

    let wrapped_dek = dek_support::attach_current_wrap(
        &app_state.db.connection,
        item.id,
        authenticated_user.principal_id,
    )
    .await?
    .ok_or_else(|| crate::errors::AppError::NotFound("Can-do item not found".to_string()))?;

    let mut response: CanDoItemResponse = item.into();
    response.wrapped_dek = Some(wrapped_dek);

    Ok(Json(ApiResponse::new(response)))
}

pub async fn create_item(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Json(request): Json<CreateCanDoItemRequest>,
) -> Result<Json<ApiResponse<CanDoItemResponse>>> {
    let connection_id = extract_connection_id(&headers);
    let display_order = request.display_order.unwrap_or(0);
    dek_support::validate_payload(
        &request.algorithm,
        &request.ciphertext_hex,
        &request.nonce_hex,
        request.version,
        "payload",
    )?;
    dek_support::require_wraps(&request.wrapped_deks)?;

    let mut item_active = can_do_list::ActiveModel::new();
    item_active.user_id = Set(authenticated_user.owner_user_id);
    item_active.project_id = Set(request.project_id);
    item_active.algorithm = Set(request.algorithm);
    item_active.ciphertext_hex = Set(request.ciphertext_hex);
    item_active.nonce_hex = Set(request.nonce_hex);
    item_active.version = Set(request.version);
    item_active.display_order = Set(display_order);

    let item = item_active
        .insert(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let now = chrono::Utc::now().fixed_offset();
    dek_support::insert_wraps(
        &app_state.db.connection,
        item.id,
        &request.wrapped_deks,
        now,
    )
    .await?;
    let own_wrap = dek_support::attach_current_wrap(
        &app_state.db.connection,
        item.id,
        authenticated_user.principal_id,
    )
    .await?;

    let mut response: CanDoItemResponse = item.clone().into();
    response.wrapped_dek = own_wrap;

    tracing::info!(
        "Can-do item created, broadcasting websocket message for owner {} (excluding connection {:?})",
        authenticated_user.owner_user_id,
        connection_id
    );
    let ws_message = WebSocketMessage {
        event_type: "INSERT".to_string(),
        table: "can_do_list".to_string(),
        user_id: authenticated_user.owner_user_id,
        record_id: Some(item.id),
        data: Some(serde_json::to_value(&response).unwrap_or_default()),
    };
    app_state
        .ws_state
        .broadcast_to_user(&authenticated_user.owner_user_id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        response,
        "Can-do item created successfully",
    )))
}

pub async fn update_item(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateCanDoItemRequest>,
) -> Result<Json<ApiResponse<CanDoItemResponse>>> {
    let connection_id = extract_connection_id(&headers);

    let item = CanDoList::find_by_id(id)
        .filter(can_do_list::Column::UserId.eq(authenticated_user.owner_user_id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Can-do item not found".to_string()))?;

    let mut item_active: can_do_list::ActiveModel = item.into();

    if let Some(project_id) = request.project_id {
        item_active.project_id = Set(Some(project_id));
    }
    if let (Some(algorithm), Some(ciphertext_hex), Some(nonce_hex), Some(version)) = (
        &request.algorithm,
        &request.ciphertext_hex,
        &request.nonce_hex,
        request.version,
    ) {
        dek_support::validate_payload(algorithm, ciphertext_hex, nonce_hex, version, "payload")?;
        item_active.algorithm = Set(algorithm.clone());
        item_active.ciphertext_hex = Set(ciphertext_hex.clone());
        item_active.nonce_hex = Set(nonce_hex.clone());
        item_active.version = Set(version);
    }
    if let Some(display_order) = request.display_order {
        item_active.display_order = Set(display_order);
    }

    let updated_item = item_active
        .update(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let now = chrono::Utc::now().fixed_offset();
    if let Some(wrapped_deks) = &request.wrapped_deks {
        dek_support::require_wraps(wrapped_deks)?;
        dek_support::replace_wraps(&app_state.db.connection, updated_item.id, wrapped_deks, now)
            .await?;
    }
    let own_wrap = dek_support::attach_current_wrap(
        &app_state.db.connection,
        updated_item.id,
        authenticated_user.principal_id,
    )
    .await?;

    let mut response: CanDoItemResponse = updated_item.clone().into();
    response.wrapped_dek = own_wrap;

    tracing::info!(
        "Can-do item updated, broadcasting websocket message for owner {} (excluding connection {:?})",
        authenticated_user.owner_user_id,
        connection_id
    );
    let ws_message = WebSocketMessage {
        event_type: "UPDATE".to_string(),
        table: "can_do_list".to_string(),
        user_id: authenticated_user.owner_user_id,
        record_id: Some(updated_item.id),
        data: Some(serde_json::to_value(&response).unwrap_or_default()),
    };
    app_state
        .ws_state
        .broadcast_to_user(&authenticated_user.owner_user_id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        response,
        "Can-do item updated successfully",
    )))
}

pub async fn delete_item(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>> {
    let connection_id = extract_connection_id(&headers);

    let result = CanDoList::delete_by_id(id)
        .filter(can_do_list::Column::UserId.eq(authenticated_user.owner_user_id))
        .exec(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    if result.rows_affected == 0 {
        return Err(crate::errors::AppError::NotFound(
            "Can-do item not found".to_string(),
        ));
    }
    deks::delete_wrapped_deks_for_resource(&app_state.db.connection, id).await?;

    tracing::info!(
        "Can-do item deleted, broadcasting websocket message for owner {} (excluding connection {:?})",
        authenticated_user.owner_user_id,
        connection_id
    );
    let ws_message = WebSocketMessage {
        event_type: "DELETE".to_string(),
        table: "can_do_list".to_string(),
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
        "Can-do item deleted successfully",
    )))
}
