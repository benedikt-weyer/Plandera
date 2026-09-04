use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    response::Json,
};
use sea_orm::*;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    entities::{prelude::*, can_do_list},
    errors::Result,
    middleware::auth::AuthUser,
    models::{
        can_do_list::{CreateCanDoItemRequest, UpdateCanDoItemRequest, CanDoItemResponse},
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

#[derive(Debug, Deserialize)]
pub struct CanDoListQuery {
    pub project_id: Option<Uuid>,
}

pub async fn list_items(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    Query(query): Query<CanDoListQuery>,
) -> Result<Json<ApiResponse<Vec<CanDoItemResponse>>>> {
    let mut find = CanDoList::find().filter(can_do_list::Column::UserId.eq(auth_user.0.id));
    
    if let Some(project_id) = query.project_id {
        find = find.filter(can_do_list::Column::ProjectId.eq(project_id));
    }
    
    let items = find
        .order_by_asc(can_do_list::Column::DisplayOrder)
        .order_by_desc(can_do_list::Column::CreatedAt)
        .all(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let response: Vec<CanDoItemResponse> = items.into_iter().map(|item| item.into()).collect();
    Ok(Json(ApiResponse::new(response)))
}

pub async fn get_item(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<CanDoItemResponse>>> {
    let item = CanDoList::find_by_id(id)
        .filter(can_do_list::Column::UserId.eq(auth_user.0.id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Can-do item not found".to_string()))?;

    Ok(Json(ApiResponse::new(item.into())))
}

pub async fn create_item(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    headers: HeaderMap,
    Json(request): Json<CreateCanDoItemRequest>,
) -> Result<Json<ApiResponse<CanDoItemResponse>>> {
    let connection_id = extract_connection_id(&headers);
    let display_order = request.display_order.unwrap_or(0);

    let mut item_active = can_do_list::ActiveModel::new();
    item_active.user_id = Set(auth_user.0.id);
    item_active.project_id = Set(request.project_id);
    item_active.encrypted_data = Set(request.encrypted_data);
    item_active.iv = Set(request.iv);
    item_active.salt = Set(request.salt);
    item_active.display_order = Set(display_order);

    let item = item_active.insert(&app_state.db.connection).await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    // Broadcast websocket message for can-do item creation
    tracing::info!("Can-do item created, broadcasting websocket message for user {} (excluding connection {:?})", auth_user.0.id, connection_id);
    let ws_message = WebSocketMessage {
        event_type: "INSERT".to_string(),
        table: "can_do_list".to_string(),
        user_id: auth_user.0.id,
        record_id: Some(item.id),
        data: Some(serde_json::to_value(&CanDoItemResponse::from(item.clone())).unwrap_or_default()),
    };
    app_state.ws_state.broadcast_to_user(&auth_user.0.id, ws_message, connection_id).await;

    Ok(Json(ApiResponse::with_message(item.into(), "Can-do item created successfully")))
}

pub async fn update_item(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateCanDoItemRequest>,
) -> Result<Json<ApiResponse<CanDoItemResponse>>> {
    let connection_id = extract_connection_id(&headers);
    
    let item = CanDoList::find_by_id(id)
        .filter(can_do_list::Column::UserId.eq(auth_user.0.id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Can-do item not found".to_string()))?;

    let mut item_active: can_do_list::ActiveModel = item.into();
    
    if let Some(project_id) = request.project_id {
        item_active.project_id = Set(Some(project_id));
    }
    if let Some(encrypted_data) = request.encrypted_data {
        item_active.encrypted_data = Set(encrypted_data);
    }
    if let Some(iv) = request.iv {
        item_active.iv = Set(iv);
    }
    if let Some(salt) = request.salt {
        item_active.salt = Set(salt);
    }
    if let Some(display_order) = request.display_order {
        item_active.display_order = Set(display_order);
    }

    let updated_item = item_active.update(&app_state.db.connection).await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    // Broadcast websocket message for can-do item update
    tracing::info!("Can-do item updated, broadcasting websocket message for user {} (excluding connection {:?})", auth_user.0.id, connection_id);
    let ws_message = WebSocketMessage {
        event_type: "UPDATE".to_string(),
        table: "can_do_list".to_string(),
        user_id: auth_user.0.id,
        record_id: Some(updated_item.id),
        data: Some(serde_json::to_value(&CanDoItemResponse::from(updated_item.clone())).unwrap_or_default()),
    };
    app_state.ws_state.broadcast_to_user(&auth_user.0.id, ws_message, connection_id).await;

    Ok(Json(ApiResponse::with_message(updated_item.into(), "Can-do item updated successfully")))
}

pub async fn delete_item(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>> {
    let connection_id = extract_connection_id(&headers);
    
    let result = CanDoList::delete_by_id(id)
        .filter(can_do_list::Column::UserId.eq(auth_user.0.id))
        .exec(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    if result.rows_affected == 0 {
        return Err(crate::errors::AppError::NotFound("Can-do item not found".to_string()));
    }

    // Broadcast websocket message for can-do item deletion
    tracing::info!("Can-do item deleted, broadcasting websocket message for user {} (excluding connection {:?})", auth_user.0.id, connection_id);
    let ws_message = WebSocketMessage {
        event_type: "DELETE".to_string(),
        table: "can_do_list".to_string(),
        user_id: auth_user.0.id,
        record_id: Some(id),
        data: None,
    };
    app_state.ws_state.broadcast_to_user(&auth_user.0.id, ws_message, connection_id).await;

    Ok(Json(ApiResponse::with_message((), "Can-do item deleted successfully")))
}
