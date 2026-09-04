use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{entities::calendar_events, models::WrappedDekPayload};

#[derive(Debug, Deserialize)]
pub struct CreateCalendarEventRequest {
    pub algorithm: String,
    pub ciphertext_hex: String,
    pub nonce_hex: String,
    pub version: i32,
    pub wrapped_deks: Vec<WrappedDekPayload>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCalendarEventRequest {
    pub algorithm: Option<String>,
    pub ciphertext_hex: Option<String>,
    pub nonce_hex: Option<String>,
    pub version: Option<i32>,
    pub wrapped_deks: Option<Vec<WrappedDekPayload>>,
}

#[derive(Debug, Serialize)]
pub struct CalendarEventResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub algorithm: String,
    pub ciphertext_hex: String,
    pub nonce_hex: String,
    pub version: i32,
    pub wrapped_dek: Option<WrappedDekPayload>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<calendar_events::Model> for CalendarEventResponse {
    fn from(event: calendar_events::Model) -> Self {
        Self {
            id: event.id,
            user_id: event.user_id,
            algorithm: event.algorithm,
            ciphertext_hex: event.ciphertext_hex,
            nonce_hex: event.nonce_hex,
            version: event.version,
            wrapped_dek: None,
            created_at: event.created_at.naive_utc().and_utc(),
            updated_at: event.updated_at.naive_utc().and_utc(),
        }
    }
}
