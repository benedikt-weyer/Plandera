use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::entities::countdowns;

#[derive(Debug, Deserialize)]
pub struct CreateCountdownRequest {
    pub event_id: Uuid,
    pub encrypted_data: String,
    pub iv: String,
    pub salt: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCountdownRequest {
    pub event_id: Option<Uuid>,
    pub encrypted_data: Option<String>,
    pub iv: Option<String>,
    pub salt: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CountdownResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub event_id: Uuid,
    pub encrypted_data: String,
    pub iv: String,
    pub salt: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<countdowns::Model> for CountdownResponse {
    fn from(countdown: countdowns::Model) -> Self {
        Self {
            id: countdown.id,
            user_id: countdown.user_id,
            event_id: countdown.event_id,
            encrypted_data: countdown.encrypted_data,
            iv: countdown.iv,
            salt: countdown.salt,
            created_at: countdown.created_at.naive_utc().and_utc(),
            updated_at: countdown.updated_at.naive_utc().and_utc(),
        }
    }
}