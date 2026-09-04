use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{entities::calendars, models::WrappedDekPayload};

#[derive(Debug, Deserialize)]
pub struct CreateCalendarRequest {
    pub algorithm: String,
    pub ciphertext_hex: String,
    pub nonce_hex: String,
    pub version: i32,
    pub wrapped_deks: Vec<WrappedDekPayload>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCalendarRequest {
    pub algorithm: Option<String>,
    pub ciphertext_hex: Option<String>,
    pub nonce_hex: Option<String>,
    pub version: Option<i32>,
    pub wrapped_deks: Option<Vec<WrappedDekPayload>>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct CalendarResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub algorithm: String,
    pub ciphertext_hex: String,
    pub nonce_hex: String,
    pub version: i32,
    pub wrapped_dek: Option<WrappedDekPayload>,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<calendars::Model> for CalendarResponse {
    fn from(calendar: calendars::Model) -> Self {
        Self {
            id: calendar.id,
            user_id: calendar.user_id,
            algorithm: calendar.algorithm,
            ciphertext_hex: calendar.ciphertext_hex,
            nonce_hex: calendar.nonce_hex,
            version: calendar.version,
            wrapped_dek: None,
            is_default: calendar.is_default,
            created_at: calendar.created_at.naive_utc().and_utc(),
            updated_at: calendar.updated_at.naive_utc().and_utc(),
        }
    }
}
