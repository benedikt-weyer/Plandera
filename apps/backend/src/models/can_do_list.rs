use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::entities::can_do_list;

#[derive(Debug, Deserialize)]
pub struct CreateCanDoItemRequest {
    pub project_id: Option<Uuid>,
    pub encrypted_data: String,
    pub iv: String,
    pub salt: String,
    pub display_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCanDoItemRequest {
    pub project_id: Option<Uuid>,
    pub encrypted_data: Option<String>,
    pub iv: Option<String>,
    pub salt: Option<String>,
    pub display_order: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct CanDoItemResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub project_id: Option<Uuid>,
    pub encrypted_data: String,
    pub iv: String,
    pub salt: String,
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
            encrypted_data: item.encrypted_data,
            iv: item.iv,
            salt: item.salt,
            display_order: item.display_order,
            created_at: item.created_at.naive_utc().and_utc(),
            updated_at: item.updated_at.naive_utc().and_utc(),
        }
    }
}
