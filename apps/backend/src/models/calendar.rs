use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::entities::calendars;

#[derive(Debug, Deserialize)]
pub struct CreateCalendarRequest {
    pub encrypted_data: String,
    pub iv: String,
    pub salt: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCalendarRequest {
    pub encrypted_data: Option<String>,
    pub iv: Option<String>,
    pub salt: Option<String>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct CalendarResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub encrypted_data: String,
    pub iv: String,
    pub salt: String,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<calendars::Model> for CalendarResponse {
    fn from(calendar: calendars::Model) -> Self {
        Self {
            id: calendar.id,
            user_id: calendar.user_id,
            encrypted_data: calendar.encrypted_data,
            iv: calendar.iv,
            salt: calendar.salt,
            is_default: calendar.is_default,
            created_at: calendar.created_at.naive_utc().and_utc(),
            updated_at: calendar.updated_at.naive_utc().and_utc(),
        }
    }
}
