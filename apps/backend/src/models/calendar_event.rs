use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::entities::calendar_events;

#[derive(Debug, Deserialize)]
pub struct CreateCalendarEventRequest {
    pub encrypted_data: String,
    pub iv: String,
    pub salt: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCalendarEventRequest {
    pub encrypted_data: Option<String>,
    pub iv: Option<String>,
    pub salt: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CalendarEventResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub encrypted_data: String,
    pub iv: String,
    pub salt: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<calendar_events::Model> for CalendarEventResponse {
    fn from(event: calendar_events::Model) -> Self {
        Self {
            id: event.id,
            user_id: event.user_id,
            encrypted_data: event.encrypted_data,
            iv: event.iv,
            salt: event.salt,
            created_at: event.created_at.naive_utc().and_utc(),
            updated_at: event.updated_at.naive_utc().and_utc(),
        }
    }
}
