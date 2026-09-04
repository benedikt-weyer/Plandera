use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use crate::entities::users;

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub email_confirmed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub app_metadata: Value,
    pub user_metadata: Value,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub user: UserResponse,
}

impl From<users::Model> for UserResponse {
    fn from(user: users::Model) -> Self {
        Self {
            id: user.id,
            email: user.email,
            email_confirmed_at: user.email_confirmed_at.map(|dt| dt.naive_utc().and_utc()),
            created_at: user.created_at.naive_utc().and_utc(),
            updated_at: user.updated_at.naive_utc().and_utc(),
            app_metadata: user.raw_app_meta_data,
            user_metadata: user.raw_user_meta_data,
        }
    }
}
