use axum::{
    extract::{Path, State},
    response::Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::{
        AuthenticatedUser, PrincipalKind,
        service::{
            ApiUserLoginCommand, ApiUserRecord, AuthSession, CreateApiUserCommand, KekMetadata,
            KekMigrationStatus, LinkedPrincipal, LoginCommand, PrincipalSummary,
            ProvisionApiUserDekCommand, RegisterCommand, RotatePasswordCommand, SaltMaterial,
        },
    },
    errors::Result,
    models::{ApiResponse, EncryptedPayload, WrappedDekPayload},
    state::AppState,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterRequest {
    pub email: String,
    pub auth_key: String,
    pub kek_public_key: String,
    pub salt_hex: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaltRequest {
    pub email: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub email: String,
    pub auth_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiUserLoginRequest {
    pub username: String,
    pub auth_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RotatePasswordRequest {
    pub kek_public_key: String,
    pub new_auth_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateApiUserRequest {
    pub api_user_id: Uuid,
    pub auth_key: String,
    pub kek_public_key: String,
    pub encrypted_label: EncryptedPayload,
    pub encrypted_label_deks: Vec<WrappedDekPayload>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvisionApiUserDeksRequest {
    pub deks: Vec<ProvisionApiUserDekEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvisionApiUserDekEntry {
    pub resource_id: Uuid,
    pub wrapped_dek: WrappedDekPayload,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KekMetadataResponse {
    pub kek_epoch_version: i32,
    pub kek_public_key: String,
}

impl From<KekMetadata> for KekMetadataResponse {
    fn from(value: KekMetadata) -> Self {
        Self {
            kek_epoch_version: value.kek_epoch_version,
            kek_public_key: value.kek_public_key,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrincipalSummaryResponse {
    pub id: Uuid,
    pub kind: PrincipalKind,
    pub email: Option<String>,
    pub username: Option<String>,
}

impl From<PrincipalSummary> for PrincipalSummaryResponse {
    fn from(value: PrincipalSummary) -> Self {
        Self {
            id: value.id,
            kind: value.kind,
            email: value.email,
            username: value.username,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkedPrincipalResponse {
    pub id: Uuid,
    pub kind: PrincipalKind,
    pub email: Option<String>,
    pub username: Option<String>,
    pub latest_kek_epoch_version: i32,
    pub latest_kek_public_key: String,
}

impl From<LinkedPrincipal> for LinkedPrincipalResponse {
    fn from(value: LinkedPrincipal) -> Self {
        Self {
            id: value.id,
            kind: value.kind,
            email: value.email,
            username: value.username,
            latest_kek_epoch_version: value.latest_kek_epoch_version,
            latest_kek_public_key: value.latest_kek_public_key,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthSessionResponse {
    pub current_principal: PrincipalSummaryResponse,
    pub kek_metadatas: Vec<KekMetadataResponse>,
    pub linked_principals: Vec<LinkedPrincipalResponse>,
    pub token: String,
    pub refresh_token: String,
    pub user_id: Uuid,
    pub email: String,
}

impl From<AuthSession> for AuthSessionResponse {
    fn from(value: AuthSession) -> Self {
        Self {
            current_principal: value.current_principal.into(),
            kek_metadatas: value.kek_metadatas.into_iter().map(Into::into).collect(),
            linked_principals: value
                .linked_principals
                .into_iter()
                .map(Into::into)
                .collect(),
            token: value.token,
            refresh_token: value.refresh_token,
            user_id: value.user_id,
            email: value.email,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaltResponse {
    pub kek_metadatas: Vec<KekMetadataResponse>,
    pub salt_hex: String,
}

impl From<SaltMaterial> for SaltResponse {
    fn from(value: SaltMaterial) -> Self {
        Self {
            kek_metadatas: value.kek_metadatas.into_iter().map(Into::into).collect(),
            salt_hex: value.salt_hex,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KekMigrationStatusResponse {
    pub all_deks_use_latest_kek: bool,
    pub latest_kek_dek_count: u64,
    pub latest_kek_epoch_version: i32,
    pub latest_kek_public_key: String,
    pub pending_dek_count: u64,
    pub total_dek_count: u64,
}

impl From<KekMigrationStatus> for KekMigrationStatusResponse {
    fn from(value: KekMigrationStatus) -> Self {
        Self {
            all_deks_use_latest_kek: value.all_deks_use_latest_kek,
            latest_kek_dek_count: value.latest_kek_dek_count,
            latest_kek_epoch_version: value.latest_kek_epoch_version,
            latest_kek_public_key: value.latest_kek_public_key,
            pending_dek_count: value.pending_dek_count,
            total_dek_count: value.total_dek_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiUserRecordResponse {
    pub created_at: String,
    pub encrypted_label: EncryptedPayload,
    pub encrypted_label_dek: WrappedDekPayload,
    pub id: Uuid,
    pub latest_kek_epoch_version: i32,
    pub latest_kek_public_key: String,
    pub updated_at: String,
    pub username: String,
}

impl From<ApiUserRecord> for ApiUserRecordResponse {
    fn from(value: ApiUserRecord) -> Self {
        Self {
            created_at: value.created_at,
            encrypted_label: value.encrypted_label,
            encrypted_label_dek: value.encrypted_label_dek,
            id: value.id,
            latest_kek_epoch_version: value.latest_kek_epoch_version,
            latest_kek_public_key: value.latest_kek_public_key,
            updated_at: value.updated_at,
            username: value.username,
        }
    }
}

pub async fn register(
    State(app_state): State<AppState>,
    Json(request): Json<RegisterRequest>,
) -> Result<Json<ApiResponse<AuthSessionResponse>>> {
    let session = app_state
        .auth_service
        .register(RegisterCommand {
            email: request.email,
            auth_key: request.auth_key,
            kek_public_key: request.kek_public_key,
            salt_hex: request.salt_hex,
        })
        .await?;

    Ok(Json(ApiResponse::with_message(
        session.into(),
        "Account created successfully",
    )))
}

pub async fn salt(
    State(app_state): State<AppState>,
    Json(request): Json<SaltRequest>,
) -> Result<Json<ApiResponse<SaltResponse>>> {
    let salt_material = app_state.auth_service.salt(&request.email).await?;
    Ok(Json(ApiResponse::new(salt_material.into())))
}

pub async fn login(
    State(app_state): State<AppState>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<ApiResponse<AuthSessionResponse>>> {
    let session = app_state
        .auth_service
        .login(LoginCommand {
            email: request.email,
            auth_key: request.auth_key,
        })
        .await?;

    Ok(Json(ApiResponse::with_message(
        session.into(),
        "Login successful",
    )))
}

pub async fn login_api_user(
    State(app_state): State<AppState>,
    Json(request): Json<ApiUserLoginRequest>,
) -> Result<Json<ApiResponse<AuthSessionResponse>>> {
    let session = app_state
        .auth_service
        .login_api_user(ApiUserLoginCommand {
            username: request.username,
            auth_key: request.auth_key,
        })
        .await?;

    Ok(Json(ApiResponse::with_message(
        session.into(),
        "Login successful",
    )))
}

pub async fn refresh(
    State(app_state): State<AppState>,
    Json(request): Json<RefreshRequest>,
) -> Result<Json<ApiResponse<AuthSessionResponse>>> {
    let session = app_state
        .auth_service
        .refresh_session(&request.refresh_token)
        .await?;
    Ok(Json(ApiResponse::new(session.into())))
}

pub async fn rotate_password(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    Json(request): Json<RotatePasswordRequest>,
) -> Result<Json<ApiResponse<AuthSessionResponse>>> {
    let session = app_state
        .auth_service
        .rotate_password(
            &authenticated_user,
            RotatePasswordCommand {
                kek_public_key: request.kek_public_key,
                new_auth_key: request.new_auth_key,
            },
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        session.into(),
        "Password updated",
    )))
}

pub async fn list_linked_principals(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<Vec<LinkedPrincipalResponse>>>> {
    let principals = app_state
        .auth_service
        .list_linked_principals(&authenticated_user)
        .await?;
    Ok(Json(ApiResponse::new(
        principals.into_iter().map(Into::into).collect(),
    )))
}

pub async fn kek_migration_status(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<KekMigrationStatusResponse>>> {
    let status = app_state
        .auth_service
        .get_kek_migration_status(&authenticated_user)
        .await?;
    Ok(Json(ApiResponse::new(status.into())))
}

pub async fn list_api_users(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<Vec<ApiUserRecordResponse>>>> {
    let api_users = app_state
        .auth_service
        .list_api_users(&authenticated_user)
        .await?;
    Ok(Json(ApiResponse::new(
        api_users.into_iter().map(Into::into).collect(),
    )))
}

pub async fn get_api_user(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<ApiUserRecordResponse>>> {
    let api_user = app_state
        .auth_service
        .get_api_user(&authenticated_user, id)
        .await?;
    Ok(Json(ApiResponse::new(api_user.into())))
}

pub async fn create_api_user(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    Json(request): Json<CreateApiUserRequest>,
) -> Result<Json<ApiResponse<ApiUserRecordResponse>>> {
    let api_user = app_state
        .auth_service
        .create_api_user(
            &authenticated_user,
            CreateApiUserCommand {
                api_user_id: request.api_user_id,
                auth_key: request.auth_key,
                kek_public_key: request.kek_public_key,
                encrypted_label: request.encrypted_label,
                encrypted_label_deks: request.encrypted_label_deks,
            },
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        api_user.into(),
        "Api user created successfully",
    )))
}

pub async fn delete_api_user(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>> {
    app_state
        .auth_service
        .delete_api_user(&authenticated_user, id)
        .await?;
    Ok(Json(ApiResponse::with_message(
        (),
        "Api user deleted successfully",
    )))
}

pub async fn provision_api_user_deks(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(request): Json<ProvisionApiUserDeksRequest>,
) -> Result<Json<ApiResponse<ApiUserRecordResponse>>> {
    let commands = request
        .deks
        .into_iter()
        .map(|entry| ProvisionApiUserDekCommand {
            resource_id: entry.resource_id,
            wrapped_dek: entry.wrapped_dek,
        })
        .collect();

    let api_user = app_state
        .auth_service
        .provision_api_user_deks(&authenticated_user, id, commands)
        .await?;

    Ok(Json(ApiResponse::with_message(
        api_user.into(),
        "Api user provisioned successfully",
    )))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeResponse {
    pub id: Uuid,
    pub owner_user_id: Uuid,
    pub kind: PrincipalKind,
    pub email: String,
}

pub async fn me(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<MeResponse>>> {
    let owner = crate::auth::repository::find_user_by_id(
        &app_state.db.connection,
        authenticated_user.owner_user_id,
    )
    .await?
    .ok_or_else(|| crate::errors::AppError::Auth("invalid bearer token".to_string()))?;

    Ok(Json(ApiResponse::new(MeResponse {
        id: authenticated_user.principal_id,
        owner_user_id: authenticated_user.owner_user_id,
        kind: authenticated_user.principal_kind,
        email: owner.email,
    })))
}

pub async fn delete_account(
    State(app_state): State<AppState>,
    authenticated_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<()>>> {
    app_state
        .auth_service
        .delete_account(&authenticated_user)
        .await?;
    Ok(Json(ApiResponse::with_message(
        (),
        "Account deleted successfully",
    )))
}
