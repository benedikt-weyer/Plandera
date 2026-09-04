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
    entities::{prelude::*, projects},
    errors::Result,
    handlers::dek_support,
    models::{
        ApiResponse,
        project::{CreateProjectRequest, ProjectResponse, UpdateProjectRequest},
    },
    state::AppState,
    websocket::{WebSocketMessage, extract_connection_id},
};

#[derive(Debug, Deserialize)]
pub struct ProjectQuery {
    pub parent_id: Option<Uuid>,
    pub all: Option<bool>,
}

pub async fn list_projects(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    Query(query): Query<ProjectQuery>,
) -> Result<Json<ApiResponse<Vec<ProjectResponse>>>> {
    let mut find =
        Projects::find().filter(projects::Column::UserId.eq(authenticated_user.owner_user_id));

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

    let deks_by_resource = deks::load_deks_for_resources(
        &app_state.db.connection,
        authenticated_user.principal_id,
        projects.iter().map(|p| p.id).collect(),
    )
    .await?;

    let response: Vec<ProjectResponse> = projects
        .into_iter()
        .filter_map(|p| {
            let wrapped_dek = deks_by_resource.get(&p.id).cloned()?;
            let mut response: ProjectResponse = p.into();
            response.wrapped_dek = Some(dek_support::to_wrapped_dek_payload(wrapped_dek));
            Some(response)
        })
        .collect();

    Ok(Json(ApiResponse::new(response)))
}

pub async fn get_project(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<ProjectResponse>>> {
    let project = Projects::find_by_id(id)
        .filter(projects::Column::UserId.eq(authenticated_user.owner_user_id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Project not found".to_string()))?;

    let wrapped_dek = dek_support::attach_current_wrap(
        &app_state.db.connection,
        project.id,
        authenticated_user.principal_id,
    )
    .await?
    .ok_or_else(|| crate::errors::AppError::NotFound("Project not found".to_string()))?;

    let mut response: ProjectResponse = project.into();
    response.wrapped_dek = Some(wrapped_dek);

    Ok(Json(ApiResponse::new(response)))
}

pub async fn create_project(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Json(request): Json<CreateProjectRequest>,
) -> Result<Json<ApiResponse<ProjectResponse>>> {
    let connection_id = extract_connection_id(&headers);
    let display_order = request.display_order.unwrap_or(0);
    let is_collapsed = request.is_collapsed.unwrap_or(false);
    dek_support::validate_payload(
        &request.algorithm,
        &request.ciphertext_hex,
        &request.nonce_hex,
        request.version,
        "payload",
    )?;
    dek_support::require_wraps(&request.wrapped_deks)?;

    let mut project_active = projects::ActiveModel::new();
    project_active.user_id = Set(authenticated_user.owner_user_id);
    project_active.algorithm = Set(request.algorithm);
    project_active.ciphertext_hex = Set(request.ciphertext_hex);
    project_active.nonce_hex = Set(request.nonce_hex);
    project_active.version = Set(request.version);
    project_active.parent_id = Set(request.parent_id);
    project_active.display_order = Set(display_order);
    project_active.is_collapsed = Set(is_collapsed);

    let project = project_active
        .insert(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let now = chrono::Utc::now().fixed_offset();
    dek_support::insert_wraps(
        &app_state.db.connection,
        project.id,
        &request.wrapped_deks,
        now,
    )
    .await?;
    let own_wrap = dek_support::attach_current_wrap(
        &app_state.db.connection,
        project.id,
        authenticated_user.principal_id,
    )
    .await?;

    let mut response: ProjectResponse = project.clone().into();
    response.wrapped_dek = own_wrap;

    tracing::info!(
        "Project created, broadcasting websocket message for owner {} (excluding connection {:?})",
        authenticated_user.owner_user_id,
        connection_id
    );
    let ws_message = WebSocketMessage {
        event_type: "INSERT".to_string(),
        table: "projects".to_string(),
        user_id: authenticated_user.owner_user_id,
        record_id: Some(project.id),
        data: Some(serde_json::to_value(&response).unwrap_or_default()),
    };
    app_state
        .ws_state
        .broadcast_to_user(&authenticated_user.owner_user_id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        response,
        "Project created successfully",
    )))
}

pub async fn update_project(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateProjectRequest>,
) -> Result<Json<ApiResponse<ProjectResponse>>> {
    let connection_id = extract_connection_id(&headers);

    let project = Projects::find_by_id(id)
        .filter(projects::Column::UserId.eq(authenticated_user.owner_user_id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Project not found".to_string()))?;

    let mut project_active: projects::ActiveModel = project.into();

    if let (Some(algorithm), Some(ciphertext_hex), Some(nonce_hex), Some(version)) = (
        &request.algorithm,
        &request.ciphertext_hex,
        &request.nonce_hex,
        request.version,
    ) {
        dek_support::validate_payload(algorithm, ciphertext_hex, nonce_hex, version, "payload")?;
        project_active.algorithm = Set(algorithm.clone());
        project_active.ciphertext_hex = Set(ciphertext_hex.clone());
        project_active.nonce_hex = Set(nonce_hex.clone());
        project_active.version = Set(version);
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

    let updated_project = project_active
        .update(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let now = chrono::Utc::now().fixed_offset();
    if let Some(wrapped_deks) = &request.wrapped_deks {
        dek_support::require_wraps(wrapped_deks)?;
        dek_support::replace_wraps(
            &app_state.db.connection,
            updated_project.id,
            wrapped_deks,
            now,
        )
        .await?;
    }
    let own_wrap = dek_support::attach_current_wrap(
        &app_state.db.connection,
        updated_project.id,
        authenticated_user.principal_id,
    )
    .await?;

    let mut response: ProjectResponse = updated_project.clone().into();
    response.wrapped_dek = own_wrap;

    tracing::info!(
        "Project updated, broadcasting websocket message for owner {} (excluding connection {:?})",
        authenticated_user.owner_user_id,
        connection_id
    );
    let ws_message = WebSocketMessage {
        event_type: "UPDATE".to_string(),
        table: "projects".to_string(),
        user_id: authenticated_user.owner_user_id,
        record_id: Some(updated_project.id),
        data: Some(serde_json::to_value(&response).unwrap_or_default()),
    };
    app_state
        .ws_state
        .broadcast_to_user(&authenticated_user.owner_user_id, ws_message, connection_id)
        .await;

    Ok(Json(ApiResponse::with_message(
        response,
        "Project updated successfully",
    )))
}

pub async fn delete_project(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>> {
    let connection_id = extract_connection_id(&headers);

    let result = Projects::delete_by_id(id)
        .filter(projects::Column::UserId.eq(authenticated_user.owner_user_id))
        .exec(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    if result.rows_affected == 0 {
        return Err(crate::errors::AppError::NotFound(
            "Project not found".to_string(),
        ));
    }
    deks::delete_wrapped_deks_for_resource(&app_state.db.connection, id).await?;

    tracing::info!(
        "Project deleted, broadcasting websocket message for owner {} (excluding connection {:?})",
        authenticated_user.owner_user_id,
        connection_id
    );
    let ws_message = WebSocketMessage {
        event_type: "DELETE".to_string(),
        table: "projects".to_string(),
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
        "Project deleted successfully",
    )))
}
