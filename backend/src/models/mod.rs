use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub mod user;
pub mod project;
pub mod can_do_list;
pub mod calendar;
pub mod calendar_event;
pub mod countdown;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    pub encrypted_data: String,
    pub iv: String,
    pub salt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimestampFields {
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Common response types
#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub data: T,
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub details: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn new(data: T) -> Self {
        Self {
            data,
            message: None,
        }
    }

    pub fn with_message(data: T, message: impl Into<String>) -> Self {
        Self {
            data,
            message: Some(message.into()),
        }
    }
}
