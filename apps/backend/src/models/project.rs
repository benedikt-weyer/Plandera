use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::entities::projects;


#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub encrypted_data: String,
    pub iv: String,
    pub salt: String,
    pub parent_id: Option<Uuid>,
    pub display_order: Option<i32>,
    pub is_collapsed: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectRequest {
    pub encrypted_data: Option<String>,
    pub iv: Option<String>,
    pub salt: Option<String>,
    pub is_default: Option<bool>,
    pub parent_id: Option<Uuid>,
    pub display_order: Option<i32>,
    pub is_collapsed: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ProjectResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub encrypted_data: String,
    pub iv: String,
    pub salt: String,
    pub is_default: bool,
    pub parent_id: Option<Uuid>,
    pub display_order: i32,
    pub is_collapsed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<projects::Model> for ProjectResponse {
    fn from(project: projects::Model) -> Self {
        Self {
            id: project.id,
            user_id: project.user_id,
            encrypted_data: project.encrypted_data,
            iv: project.iv,
            salt: project.salt,
            is_default: project.is_default,
            parent_id: project.parent_id,
            display_order: project.display_order,
            is_collapsed: project.is_collapsed,
            created_at: project.created_at.naive_utc().and_utc(),
            updated_at: project.updated_at.naive_utc().and_utc(),
        }
    }
}
