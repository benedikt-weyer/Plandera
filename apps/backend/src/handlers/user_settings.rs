use axum::{extract::State, response::Json};
use sea_orm::{ActiveModelTrait, ActiveValue, ColumnTrait, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};

use crate::{
    auth::AuthenticatedUser,
    entities::{prelude::*, user_settings},
    errors::Result,
    handlers::dek_support,
    models::{ApiResponse, WrappedDekPayload},
    state::AppState,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct UserSettingsRequest {
    pub algorithm: String,
    pub ciphertext_hex: String,
    pub nonce_hex: String,
    pub version: i32,
    pub wrapped_deks: Vec<WrappedDekPayload>,
}

#[derive(Debug, Serialize)]
pub struct UserSettingsResponse {
    pub algorithm: String,
    pub ciphertext_hex: String,
    pub nonce_hex: String,
    pub version: i32,
    pub wrapped_dek: Option<WrappedDekPayload>,
}

/// Get user settings. The singleton row's `resource_id` in the shared
/// `deks` table is the owner's user id.
pub async fn get_user_settings(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<UserSettingsResponse>>> {
    let settings = UserSettings::find()
        .filter(user_settings::Column::UserId.eq(authenticated_user.owner_user_id))
        .one(&app_state.db.connection)
        .await?;

    let response = match settings {
        Some(settings) => {
            let wrapped_dek = dek_support::attach_current_wrap(
                &app_state.db.connection,
                authenticated_user.owner_user_id,
                authenticated_user.principal_id,
            )
            .await?;

            UserSettingsResponse {
                algorithm: settings.algorithm,
                ciphertext_hex: settings.ciphertext_hex,
                nonce_hex: settings.nonce_hex,
                version: settings.version,
                wrapped_dek,
            }
        }
        None => UserSettingsResponse {
            algorithm: String::new(),
            ciphertext_hex: String::new(),
            nonce_hex: String::new(),
            version: 0,
            wrapped_dek: None,
        },
    };

    Ok(Json(ApiResponse {
        data: response,
        message: None,
    }))
}

/// Update (or create) user settings.
pub async fn update_user_settings(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    Json(payload): Json<UserSettingsRequest>,
) -> Result<Json<ApiResponse<UserSettingsResponse>>> {
    dek_support::validate_payload(
        &payload.algorithm,
        &payload.ciphertext_hex,
        &payload.nonce_hex,
        payload.version,
        "payload",
    )?;
    dek_support::require_wraps(&payload.wrapped_deks)?;

    let existing_settings = UserSettings::find()
        .filter(user_settings::Column::UserId.eq(authenticated_user.owner_user_id))
        .one(&app_state.db.connection)
        .await?;

    let now = chrono::Utc::now().into();

    let settings = match existing_settings {
        Some(existing) => {
            let mut active_model: user_settings::ActiveModel = existing.into();
            active_model.algorithm = ActiveValue::Set(payload.algorithm.clone());
            active_model.ciphertext_hex = ActiveValue::Set(payload.ciphertext_hex.clone());
            active_model.nonce_hex = ActiveValue::Set(payload.nonce_hex.clone());
            active_model.version = ActiveValue::Set(payload.version);
            active_model.updated_at = ActiveValue::Set(now);
            active_model.update(&app_state.db.connection).await?
        }
        None => {
            let active_model = user_settings::ActiveModel {
                user_id: ActiveValue::Set(authenticated_user.owner_user_id),
                algorithm: ActiveValue::Set(payload.algorithm.clone()),
                ciphertext_hex: ActiveValue::Set(payload.ciphertext_hex.clone()),
                nonce_hex: ActiveValue::Set(payload.nonce_hex.clone()),
                version: ActiveValue::Set(payload.version),
                created_at: ActiveValue::Set(now),
                updated_at: ActiveValue::Set(now),
            };
            active_model.insert(&app_state.db.connection).await?
        }
    };

    let now_fixed = chrono::Utc::now().fixed_offset();
    dek_support::replace_wraps(
        &app_state.db.connection,
        authenticated_user.owner_user_id,
        &payload.wrapped_deks,
        now_fixed,
    )
    .await?;
    let own_wrap = dek_support::attach_current_wrap(
        &app_state.db.connection,
        authenticated_user.owner_user_id,
        authenticated_user.principal_id,
    )
    .await?;

    Ok(Json(ApiResponse {
        data: UserSettingsResponse {
            algorithm: settings.algorithm,
            ciphertext_hex: settings.ciphertext_hex,
            nonce_hex: settings.nonce_hex,
            version: settings.version,
            wrapped_dek: own_wrap,
        },
        message: None,
    }))
}
