use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{entities::projects, models::WrappedDekPayload};

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub algorithm: String,
    pub ciphertext_hex: String,
    pub nonce_hex: String,
    pub version: i32,
    pub wrapped_deks: Vec<WrappedDekPayload>,
    pub parent_id: Option<Uuid>,
    pub display_order: Option<i32>,
    pub is_collapsed: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectRequest {
    pub algorithm: Option<String>,
    pub ciphertext_hex: Option<String>,
    pub nonce_hex: Option<String>,
    pub version: Option<i32>,
    pub wrapped_deks: Option<Vec<WrappedDekPayload>>,
    pub is_default: Option<bool>,
    pub parent_id: Option<Uuid>,
    pub display_order: Option<i32>,
    pub is_collapsed: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ProjectResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub algorithm: String,
    pub ciphertext_hex: String,
    pub nonce_hex: String,
    pub version: i32,
    pub wrapped_dek: Option<WrappedDekPayload>,
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
            algorithm: project.algorithm,
            ciphertext_hex: project.ciphertext_hex,
            nonce_hex: project.nonce_hex,
            version: project.version,
            wrapped_dek: None,
            is_default: project.is_default,
            parent_id: project.parent_id,
            display_order: project.display_order,
            is_collapsed: project.is_collapsed,
            created_at: project.created_at.naive_utc().and_utc(),
            updated_at: project.updated_at.naive_utc().and_utc(),
        }
    }
}
