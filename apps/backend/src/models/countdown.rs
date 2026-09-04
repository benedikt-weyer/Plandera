use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{entities::countdowns, models::WrappedDekPayload};

#[derive(Debug, Deserialize)]
pub struct CreateCountdownRequest {
    pub event_id: Uuid,
    pub algorithm: String,
    pub ciphertext_hex: String,
    pub nonce_hex: String,
    pub version: i32,
    pub wrapped_deks: Vec<WrappedDekPayload>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCountdownRequest {
    pub event_id: Option<Uuid>,
    pub algorithm: Option<String>,
    pub ciphertext_hex: Option<String>,
    pub nonce_hex: Option<String>,
    pub version: Option<i32>,
    pub wrapped_deks: Option<Vec<WrappedDekPayload>>,
}

#[derive(Debug, Serialize)]
pub struct CountdownResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub event_id: Uuid,
    pub algorithm: String,
    pub ciphertext_hex: String,
    pub nonce_hex: String,
    pub version: i32,
    pub wrapped_dek: Option<WrappedDekPayload>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<countdowns::Model> for CountdownResponse {
    fn from(countdown: countdowns::Model) -> Self {
        Self {
            id: countdown.id,
            user_id: countdown.user_id,
            event_id: countdown.event_id,
            algorithm: countdown.algorithm,
            ciphertext_hex: countdown.ciphertext_hex,
            nonce_hex: countdown.nonce_hex,
            version: countdown.version,
            wrapped_dek: None,
            created_at: countdown.created_at.naive_utc().and_utc(),
            updated_at: countdown.updated_at.naive_utc().and_utc(),
        }
    }
}
