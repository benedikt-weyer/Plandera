use axum::{
    extract::State,
    response::Json,
};
use sea_orm::{ActiveModelTrait, ActiveValue, EntityTrait, QueryFilter, ColumnTrait};
use serde::{Deserialize, Serialize};

use crate::{
    entities::{prelude::*, user_settings},
    errors::Result,
    middleware::auth::AuthUser,
    models::ApiResponse,
    state::AppState,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct UserSettingsRequest {
    pub encrypted_data: String,
    pub iv: String,
    pub salt: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserSettingsResponse {
    pub encrypted_data: String,
    pub iv: String,
    pub salt: String,
}

/// Get user settings
pub async fn get_user_settings(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<ApiResponse<UserSettingsResponse>>> {
    // Try to find existing settings
    let settings = UserSettings::find()
        .filter(user_settings::Column::UserId.eq(auth_user.0.id))
        .one(&app_state.db.connection)
        .await?;

    let response = match settings {
        Some(settings) => UserSettingsResponse {
            encrypted_data: settings.encrypted_data,
            iv: settings.iv,
            salt: settings.salt,
        },
        None => {
            // Return empty encrypted data if settings don't exist
            UserSettingsResponse {
                encrypted_data: String::from("{}"),
                iv: String::new(),
                salt: String::new(),
            }
        }
    };

    Ok(Json(ApiResponse {
        data: response,
        message: None,
    }))
}

/// Update user settings
pub async fn update_user_settings(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    Json(payload): Json<UserSettingsRequest>,
) -> Result<Json<ApiResponse<UserSettingsResponse>>> {
    // Check if settings already exist
    let existing_settings = UserSettings::find()
        .filter(user_settings::Column::UserId.eq(auth_user.0.id))
        .one(&app_state.db.connection)
        .await?;

    let now = chrono::Utc::now().into();

    let settings = match existing_settings {
        Some(existing) => {
            // Update existing settings
            let mut active_model: user_settings::ActiveModel = existing.into();
            active_model.encrypted_data = ActiveValue::Set(payload.encrypted_data.clone());
            active_model.iv = ActiveValue::Set(payload.iv.clone());
            active_model.salt = ActiveValue::Set(payload.salt.clone());
            active_model.updated_at = ActiveValue::Set(now);
            active_model.update(&app_state.db.connection).await?
        }
        None => {
            // Create new settings
            let active_model = user_settings::ActiveModel {
                user_id: ActiveValue::Set(auth_user.0.id),
                encrypted_data: ActiveValue::Set(payload.encrypted_data.clone()),
                iv: ActiveValue::Set(payload.iv.clone()),
                salt: ActiveValue::Set(payload.salt.clone()),
                created_at: ActiveValue::Set(now),
                updated_at: ActiveValue::Set(now),
            };
            active_model.insert(&app_state.db.connection).await?
        }
    };

    Ok(Json(ApiResponse {
        data: UserSettingsResponse {
            encrypted_data: settings.encrypted_data,
            iv: settings.iv,
            salt: settings.salt,
        },
        message: None,
    }))
}

