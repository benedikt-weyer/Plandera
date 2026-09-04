use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    response::Json,
};
use sea_orm::*;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    entities::{prelude::*, projects},
    errors::Result,
    middleware::auth::AuthUser,
    models::{
        project::{CreateProjectRequest, UpdateProjectRequest, ProjectResponse},
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
pub struct ProjectQuery {
    pub parent_id: Option<Uuid>,
    pub all: Option<bool>,
}

pub async fn list_projects(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    Query(query): Query<ProjectQuery>,
) -> Result<Json<ApiResponse<Vec<ProjectResponse>>>> {
    let mut find = Projects::find().filter(projects::Column::UserId.eq(auth_user.0.id));
    
    // If 'all' parameter is true, return all projects regardless of parent_id
    if !query.all.unwrap_or(false) {
        match query.parent_id {
            Some(parent_id) => {
                find = find.filter(projects::Column::ParentId.eq(parent_id));
            }
            None => {
                find = find.filter(projects::Column::ParentId.is_null());
            }
        }
    }
    
    let projects = find
        .order_by_asc(projects::Column::DisplayOrder)
        .order_by_asc(projects::Column::CreatedAt)
        .all(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let response: Vec<ProjectResponse> = projects.into_iter().map(|p| p.into()).collect();
    Ok(Json(ApiResponse::new(response)))
}

pub async fn get_project(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<ProjectResponse>>> {
    let project = Projects::find_by_id(id)
        .filter(projects::Column::UserId.eq(auth_user.0.id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Project not found".to_string()))?;

    Ok(Json(ApiResponse::new(project.into())))
}

pub async fn create_project(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    headers: HeaderMap,
    Json(request): Json<CreateProjectRequest>,
) -> Result<Json<ApiResponse<ProjectResponse>>> {
    let connection_id = extract_connection_id(&headers);
    let display_order = request.display_order.unwrap_or(0);
    let is_collapsed = request.is_collapsed.unwrap_or(false);

    let mut project_active = projects::ActiveModel::new();
    project_active.user_id = Set(auth_user.0.id);
    project_active.encrypted_data = Set(request.encrypted_data);
    project_active.iv = Set(request.iv);
    project_active.salt = Set(request.salt);
    project_active.parent_id = Set(request.parent_id);
    project_active.display_order = Set(display_order);
    project_active.is_collapsed = Set(is_collapsed);

    let project = project_active.insert(&app_state.db.connection).await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    // Broadcast websocket message for project creation
    tracing::info!("Project created, broadcasting websocket message for user {} (excluding connection {:?})", auth_user.0.id, connection_id);
    let ws_message = WebSocketMessage {
        event_type: "INSERT".to_string(),
        table: "projects".to_string(),
        user_id: auth_user.0.id,
        record_id: Some(project.id),
        data: Some(serde_json::to_value(&ProjectResponse::from(project.clone())).unwrap_or_default()),
    };
    app_state.ws_state.broadcast_to_user(&auth_user.0.id, ws_message, connection_id).await;

    Ok(Json(ApiResponse::with_message(project.into(), "Project created successfully")))
}

pub async fn update_project(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateProjectRequest>,
) -> Result<Json<ApiResponse<ProjectResponse>>> {
    let connection_id = extract_connection_id(&headers);
    
    let project = Projects::find_by_id(id)
        .filter(projects::Column::UserId.eq(auth_user.0.id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Project not found".to_string()))?;

    let mut project_active: projects::ActiveModel = project.into();
    
    if let Some(encrypted_data) = request.encrypted_data {
        project_active.encrypted_data = Set(encrypted_data);
    }
    if let Some(iv) = request.iv {
        project_active.iv = Set(iv);
    }
    if let Some(salt) = request.salt {
        project_active.salt = Set(salt);
    }
    if let Some(is_default) = request.is_default {
        project_active.is_default = Set(is_default);
    }
    if let Some(parent_id) = request.parent_id {
        project_active.parent_id = Set(Some(parent_id));
    }
    if let Some(display_order) = request.display_order {
        project_active.display_order = Set(display_order);
    }
    if let Some(is_collapsed) = request.is_collapsed {
        project_active.is_collapsed = Set(is_collapsed);
    }

    let updated_project = project_active.update(&app_state.db.connection).await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    // Broadcast websocket message for project update
    tracing::info!("Project updated, broadcasting websocket message for user {} (excluding connection {:?})", auth_user.0.id, connection_id);
    let ws_message = WebSocketMessage {
        event_type: "UPDATE".to_string(),
        table: "projects".to_string(),
        user_id: auth_user.0.id,
        record_id: Some(updated_project.id),
        data: Some(serde_json::to_value(&ProjectResponse::from(updated_project.clone())).unwrap_or_default()),
    };
    app_state.ws_state.broadcast_to_user(&auth_user.0.id, ws_message, connection_id).await;

    Ok(Json(ApiResponse::with_message(updated_project.into(), "Project updated successfully")))
}

pub async fn delete_project(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>> {
    let connection_id = extract_connection_id(&headers);
    
    let result = Projects::delete_by_id(id)
        .filter(projects::Column::UserId.eq(auth_user.0.id))
        .exec(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    if result.rows_affected == 0 {
        return Err(crate::errors::AppError::NotFound("Project not found".to_string()));
    }

    // Broadcast websocket message for project deletion
    tracing::info!("Project deleted, broadcasting websocket message for user {} (excluding connection {:?})", auth_user.0.id, connection_id);
    let ws_message = WebSocketMessage {
        event_type: "DELETE".to_string(),
        table: "projects".to_string(),
        user_id: auth_user.0.id,
        record_id: Some(id),
        data: None,
    };
    app_state.ws_state.broadcast_to_user(&auth_user.0.id, ws_message, connection_id).await;

    Ok(Json(ApiResponse::with_message((), "Project deleted successfully")))
}