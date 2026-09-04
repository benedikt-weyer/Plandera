use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{entities::can_do_list, models::WrappedDekPayload};

#[derive(Debug, Deserialize)]
pub struct CreateCanDoItemRequest {
    pub project_id: Option<Uuid>,
    pub algorithm: String,
    pub ciphertext_hex: String,
    pub nonce_hex: String,
    pub version: i32,
    pub wrapped_deks: Vec<WrappedDekPayload>,
    pub display_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCanDoItemRequest {
    pub project_id: Option<Uuid>,
    pub algorithm: Option<String>,
    pub ciphertext_hex: Option<String>,
    pub nonce_hex: Option<String>,
    pub version: Option<i32>,
    pub wrapped_deks: Option<Vec<WrappedDekPayload>>,
    pub display_order: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct CanDoItemResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub project_id: Option<Uuid>,
    pub algorithm: String,
    pub ciphertext_hex: String,
    pub nonce_hex: String,
    pub version: i32,
    pub wrapped_dek: Option<WrappedDekPayload>,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<can_do_list::Model> for CanDoItemResponse {
    fn from(item: can_do_list::Model) -> Self {
        Self {
            id: item.id,
            user_id: item.user_id,
            project_id: item.project_id,
            algorithm: item.algorithm,
            ciphertext_hex: item.ciphertext_hex,
            nonce_hex: item.nonce_hex,
            version: item.version,
            wrapped_dek: None,
            display_order: item.display_order,
            created_at: item.created_at.naive_utc().and_utc(),
            updated_at: item.updated_at.naive_utc().and_utc(),
        }
    }
}
