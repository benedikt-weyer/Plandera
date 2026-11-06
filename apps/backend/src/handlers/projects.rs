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
    entities::{can_do_list, prelude::*, projects},
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

#[derive(Debug, Deserialize)]
pub struct DeleteProjectQuery {
    /// Also delete every task in the project and in its sub-projects. Without it the tasks are
    /// kept and just lose their project (they end up in the inbox).
    pub recursive: Option<bool>,
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
        project_active.parent_id = Set(parent_id);
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

/// The project and all of its descendants out of `(id, parent_id)` links, the project itself first.
/// Projects whose ancestor chain does not lead to `root_id` are not included.
fn subtree_from_links(links: &[(Uuid, Option<Uuid>)], root_id: Uuid) -> Vec<Uuid> {
    let mut children_by_parent: std::collections::HashMap<Uuid, Vec<Uuid>> =
        std::collections::HashMap::new();
    for (id, parent_id) in links {
        if let Some(parent_id) = parent_id {
            children_by_parent.entry(*parent_id).or_default().push(*id);
        }
    }

    // Breadth-first walk; `seen` guards against cycles in corrupt data.
    let mut subtree = vec![root_id];
    let mut seen: std::collections::HashSet<Uuid> = std::collections::HashSet::from([root_id]);
    let mut next = 0;
    while next < subtree.len() {
        let current = subtree[next];
        next += 1;
        for child_id in children_by_parent.get(&current).into_iter().flatten() {
            if seen.insert(*child_id) {
                subtree.push(*child_id);
            }
        }
    }

    subtree
}

async fn collect_project_subtree<C>(db: &C, owner_user_id: Uuid, root_id: Uuid) -> Result<Vec<Uuid>>
where
    C: ConnectionTrait,
{
    let links: Vec<(Uuid, Option<Uuid>)> = Projects::find()
        .filter(projects::Column::UserId.eq(owner_user_id))
        .select_only()
        .column(projects::Column::Id)
        .column(projects::Column::ParentId)
        .into_tuple()
        .all(db)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    Ok(subtree_from_links(&links, root_id))
}

pub async fn delete_project(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Query(query): Query<DeleteProjectQuery>,
) -> Result<Json<ApiResponse<()>>> {
    let connection_id = extract_connection_id(&headers);
    let owner_user_id = authenticated_user.owner_user_id;
    let recursive = query.recursive.unwrap_or(false);

    let transaction = app_state
        .db
        .connection
        .begin()
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let project_exists = Projects::find_by_id(id)
        .filter(projects::Column::UserId.eq(owner_user_id))
        .one(&transaction)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .is_some();
    if !project_exists {
        return Err(crate::errors::AppError::NotFound(
            "Project not found".to_string(),
        ));
    }

    // Sub-projects are removed by the database (ON DELETE CASCADE) in any case, so their wrapped
    // keys have to be cleaned up and other clients informed here, not only for the project itself.
    let project_ids = collect_project_subtree(&transaction, owner_user_id, id).await?;

    // Recursive delete also removes the tasks of the whole subtree. Otherwise the tasks stay and
    // lose their project (ON DELETE SET NULL).
    let task_ids: Vec<Uuid> = if recursive {
        let task_ids: Vec<Uuid> = CanDoList::find()
            .filter(can_do_list::Column::UserId.eq(owner_user_id))
            .filter(can_do_list::Column::ProjectId.is_in(project_ids.clone()))
            .select_only()
            .column(can_do_list::Column::Id)
            .into_tuple()
            .all(&transaction)
            .await
            .map_err(|e| crate::errors::AppError::Database(e.into()))?;

        if !task_ids.is_empty() {
            CanDoList::delete_many()
                .filter(can_do_list::Column::UserId.eq(owner_user_id))
                .filter(can_do_list::Column::Id.is_in(task_ids.clone()))
                .exec(&transaction)
                .await
                .map_err(|e| crate::errors::AppError::Database(e.into()))?;
            deks::delete_wrapped_deks_for_resources(&transaction, task_ids.clone()).await?;
        }
        task_ids
    } else {
        Vec::new()
    };

    let result = Projects::delete_many()
        .filter(projects::Column::UserId.eq(owner_user_id))
        .filter(projects::Column::Id.is_in(project_ids.clone()))
        .exec(&transaction)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;
    if result.rows_affected == 0 {
        return Err(crate::errors::AppError::NotFound(
            "Project not found".to_string(),
        ));
    }
    deks::delete_wrapped_deks_for_resources(&transaction, project_ids.clone()).await?;

    transaction
        .commit()
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    tracing::info!(
        "Project {} deleted (recursive: {}, {} project(s), {} task(s)), broadcasting websocket messages for owner {} (excluding connection {:?})",
        id,
        recursive,
        project_ids.len(),
        task_ids.len(),
        owner_user_id,
        connection_id
    );
    for (table, record_id) in task_ids
        .into_iter()
        .map(|task_id| ("can_do_list", task_id))
        .chain(
            project_ids
                .into_iter()
                .map(|project_id| ("projects", project_id)),
        )
    {
        let ws_message = WebSocketMessage {
            event_type: "DELETE".to_string(),
            table: table.to_string(),
            user_id: owner_user_id,
            record_id: Some(record_id),
            data: None,
        };
        app_state
            .ws_state
            .broadcast_to_user(&owner_user_id, ws_message, connection_id)
            .await;
    }

    Ok(Json(ApiResponse::with_message(
        (),
        "Project deleted successfully",
    )))
}

#[cfg(test)]
mod tests {
    use super::subtree_from_links;
    use uuid::Uuid;

    fn id() -> Uuid {
        Uuid::new_v4()
    }

    #[test]
    fn subtree_contains_the_project_and_all_descendants_root_first() {
        let (root, child_a, child_b, grandchild) = (id(), id(), id(), id());
        let (other_root, other_child) = (id(), id());
        let links = vec![
            (other_child, Some(other_root)),
            (root, None),
            (grandchild, Some(child_a)),
            (child_a, Some(root)),
            (other_root, None),
            (child_b, Some(root)),
        ];

        let subtree = subtree_from_links(&links, root);

        assert_eq!(subtree[0], root);
        assert_eq!(subtree.len(), 4);
        for expected in [root, child_a, child_b, grandchild] {
            assert!(subtree.contains(&expected));
        }
        assert!(!subtree.contains(&other_root));
        assert!(!subtree.contains(&other_child));
    }

    #[test]
    fn subtree_of_a_leaf_is_just_the_leaf() {
        let (root, leaf) = (id(), id());
        let links = vec![(root, None), (leaf, Some(root))];
        assert_eq!(subtree_from_links(&links, leaf), vec![leaf]);
    }

    #[test]
    fn subtree_of_unknown_project_is_just_that_id() {
        let unknown = id();
        assert_eq!(subtree_from_links(&[(id(), None)], unknown), vec![unknown]);
    }

    #[test]
    fn subtree_terminates_on_cyclic_data() {
        let (a, b) = (id(), id());
        let links = vec![(a, Some(b)), (b, Some(a))];

        let subtree = subtree_from_links(&links, a);

        assert_eq!(subtree.len(), 2);
        assert!(subtree.contains(&a) && subtree.contains(&b));
    }
}
