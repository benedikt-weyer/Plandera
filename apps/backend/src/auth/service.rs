use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts},
};
use chrono::Utc;
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use sea_orm::{ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, TransactionTrait};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha512};
use std::env;
use std::future::ready;
use subtle::ConstantTimeEq;
use uuid::Uuid;

use crate::{
    auth::{PrincipalKind, repository},
    db::Database,
    deks,
    entities::{deks as deks_entity, prelude::*, users},
    errors::{AppError, Result},
    models::{
        EncryptedPayload, WrappedDekPayload, map_wrapped_deks, normalize_kek_public_key,
        validate_encrypted_payload,
    },
    state::AppState,
};

pub struct RegisterCommand {
    pub email: String,
    pub auth_key: String,
    pub kek_public_key: String,
    pub salt_hex: String,
}

pub struct LoginCommand {
    pub email: String,
    pub auth_key: String,
}

pub struct ApiUserLoginCommand {
    pub username: String,
    pub auth_key: String,
}

pub struct RotatePasswordCommand {
    pub kek_public_key: String,
    pub new_auth_key: String,
}

pub struct CreateApiUserCommand {
    pub api_user_id: Uuid,
    pub auth_key: String,
    pub kek_public_key: String,
    pub encrypted_label: EncryptedPayload,
    pub encrypted_label_deks: Vec<WrappedDekPayload>,
}

pub struct ProvisionApiUserDekCommand {
    pub resource_id: Uuid,
    pub wrapped_dek: WrappedDekPayload,
}

pub struct AuthSession {
    pub current_principal: PrincipalSummary,
    pub kek_metadatas: Vec<KekMetadata>,
    pub linked_principals: Vec<LinkedPrincipal>,
    pub token: String,
    pub refresh_token: String,
    pub user_id: Uuid,
    pub email: String,
}

pub struct SaltMaterial {
    pub kek_metadatas: Vec<KekMetadata>,
    pub salt_hex: String,
}

pub struct KekMigrationStatus {
    pub all_deks_use_latest_kek: bool,
    pub latest_kek_dek_count: u64,
    pub latest_kek_epoch_version: i32,
    pub latest_kek_public_key: String,
    pub pending_dek_count: u64,
    pub total_dek_count: u64,
}

#[derive(Clone, Debug)]
pub struct KekMetadata {
    pub kek_epoch_version: i32,
    pub kek_public_key: String,
}

#[derive(Clone, Debug)]
pub struct PrincipalSummary {
    pub id: Uuid,
    pub kind: PrincipalKind,
    pub email: Option<String>,
    pub username: Option<String>,
}

#[derive(Clone, Debug)]
pub struct LinkedPrincipal {
    pub id: Uuid,
    pub kind: PrincipalKind,
    pub email: Option<String>,
    pub username: Option<String>,
    pub latest_kek_epoch_version: i32,
    pub latest_kek_public_key: String,
}

pub struct ApiUserRecord {
    pub created_at: String,
    pub encrypted_label: EncryptedPayload,
    pub encrypted_label_dek: WrappedDekPayload,
    pub id: Uuid,
    pub latest_kek_epoch_version: i32,
    pub latest_kek_public_key: String,
    pub updated_at: String,
    pub username: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Claims {
    sub: String,
    owner_user_id: String,
    email: String,
    principal_kind: PrincipalKind,
    token_type: TokenType,
    exp: usize,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum TokenType {
    Access,
    Refresh,
}

#[derive(Clone, Debug)]
pub struct AuthenticatedUser {
    pub principal_id: Uuid,
    pub owner_user_id: Uuid,
    pub principal_kind: PrincipalKind,
}

#[derive(Clone)]
pub struct AuthService {
    db: Database,
    jwt_secret: String,
    access_ttl_minutes: i64,
    refresh_ttl_minutes: i64,
}

impl AuthService {
    pub fn new(db: Database) -> Self {
        let jwt_secret =
            env::var("JWT_SECRET").expect("JWT_SECRET environment variable must be set");
        let access_ttl_minutes = env::var("JWT_ACCESS_TTL_MINUTES")
            .unwrap_or_else(|_| "15".to_string())
            .parse()
            .unwrap_or(15);
        let refresh_ttl_minutes = env::var("JWT_REFRESH_TTL_MINUTES")
            .unwrap_or_else(|_| "43200".to_string()) // 30 days
            .parse()
            .unwrap_or(43_200);

        Self {
            db,
            jwt_secret,
            access_ttl_minutes,
            refresh_ttl_minutes,
        }
    }

    pub fn authenticate_access_token(&self, token: &str) -> Result<AuthenticatedUser> {
        self.authenticate_token(token, TokenType::Access)
    }

    fn authenticate_refresh_token(&self, token: &str) -> Result<AuthenticatedUser> {
        self.authenticate_token(token, TokenType::Refresh)
    }

    fn authenticate_token(
        &self,
        token: &str,
        required_token_type: TokenType,
    ) -> Result<AuthenticatedUser> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|_| AppError::Auth("invalid bearer token".to_string()))?;

        if token_data.claims.token_type != required_token_type {
            let message = match required_token_type {
                TokenType::Access => "an access token is required",
                TokenType::Refresh => "a refresh token is required",
            };

            return Err(AppError::Auth(message.to_string()));
        }

        Ok(AuthenticatedUser {
            principal_id: Uuid::parse_str(&token_data.claims.sub)
                .map_err(|_| AppError::Auth("invalid bearer token".to_string()))?,
            owner_user_id: Uuid::parse_str(&token_data.claims.owner_user_id)
                .map_err(|_| AppError::Auth("invalid bearer token".to_string()))?,
            principal_kind: token_data.claims.principal_kind,
        })
    }

    pub async fn refresh_session(&self, refresh_token: &str) -> Result<AuthSession> {
        let authenticated_user = self.authenticate_refresh_token(refresh_token)?;

        match authenticated_user.principal_kind {
            PrincipalKind::User => {
                let user = repository::find_user_by_id(
                    &self.db.connection,
                    authenticated_user.owner_user_id,
                )
                .await?
                .ok_or_else(|| AppError::Auth("invalid bearer token".to_string()))?;
                let kek_metadatas = repository::list_kek_metadata_for_user(
                    &self.db.connection,
                    authenticated_user.principal_id,
                )
                .await?;

                self.build_auth_session(
                    &user,
                    repository::PrincipalRecord {
                        principal_id: user.id,
                        owner_user_id: user.id,
                        kind: PrincipalKind::User,
                        email: Some(user.email.clone()),
                        username: None,
                    },
                    kek_metadatas,
                )
                .await
            }
            PrincipalKind::ApiUser => {
                let api_user = repository::find_api_user_by_id(
                    &self.db.connection,
                    authenticated_user.principal_id,
                )
                .await?
                .filter(|api_user| api_user.user_id == authenticated_user.owner_user_id)
                .ok_or_else(|| AppError::Auth("invalid bearer token".to_string()))?;
                let owner_user = repository::find_user_by_id(&self.db.connection, api_user.user_id)
                    .await?
                    .ok_or_else(|| {
                        AppError::Internal("missing owner user for refresh token".to_string())
                    })?;
                let kek_metadatas =
                    repository::list_kek_metadata_for_user(&self.db.connection, api_user.id)
                        .await?;

                self.build_auth_session(
                    &owner_user,
                    repository::PrincipalRecord {
                        principal_id: api_user.id,
                        owner_user_id: api_user.user_id,
                        kind: PrincipalKind::ApiUser,
                        email: None,
                        username: Some(api_user.username.clone()),
                    },
                    kek_metadatas,
                )
                .await
            }
        }
    }

    pub async fn register(&self, command: RegisterCommand) -> Result<AuthSession> {
        let email = normalize_email(&command.email)?;
        validate_auth_key(&command.auth_key)?;
        let kek_public_key = normalize_kek_public_key(&command.kek_public_key)?;
        let auth_salt = normalize_auth_salt(&command.salt_hex)?;

        if repository::find_user_by_email(&self.db.connection, &email)
            .await?
            .is_some()
        {
            return Err(AppError::Validation(
                "an account already exists for this email".to_string(),
            ));
        }

        let now = Utc::now().fixed_offset();
        let transaction = self
            .db
            .connection
            .begin()
            .await
            .map_err(|e| AppError::Database(e.into()))?;

        let new_user = repository::insert_user(
            &transaction,
            email,
            hash_auth_key(&command.auth_key),
            auth_salt,
            now,
        )
        .await?;
        let initial_kek_metadata =
            repository::insert_kek_metadata(&transaction, new_user.id, kek_public_key, 1, now)
                .await?;

        transaction
            .commit()
            .await
            .map_err(|e| AppError::Database(e.into()))?;

        self.build_auth_session(
            &new_user,
            repository::PrincipalRecord {
                principal_id: new_user.id,
                owner_user_id: new_user.id,
                kind: PrincipalKind::User,
                email: Some(new_user.email.clone()),
                username: None,
            },
            vec![initial_kek_metadata],
        )
        .await
    }

    pub async fn salt(&self, email: &str) -> Result<SaltMaterial> {
        let email = normalize_email(email)?;

        let user = repository::find_user_by_email(&self.db.connection, &email)
            .await?
            .ok_or_else(|| AppError::Auth("invalid email or password".to_string()))?;
        let auth_salt = user
            .auth_salt
            .clone()
            .ok_or_else(|| AppError::Auth("invalid email or password".to_string()))?;

        Ok(SaltMaterial {
            kek_metadatas: repository::list_kek_metadata_for_user(&self.db.connection, user.id)
                .await?
                .into_iter()
                .map(map_kek_metadata)
                .collect(),
            salt_hex: normalize_auth_salt(&auth_salt)?,
        })
    }

    pub async fn login(&self, command: LoginCommand) -> Result<AuthSession> {
        let email = normalize_email(&command.email)?;
        validate_auth_key(&command.auth_key)?;

        let user = repository::find_user_by_email(&self.db.connection, &email)
            .await?
            .ok_or_else(|| AppError::Auth("invalid email or auth key".to_string()))?;
        assert_auth_key_matches(&command.auth_key, &user.auth_key_hash)?;

        let kek_metadatas =
            repository::list_kek_metadata_for_user(&self.db.connection, user.id).await?;

        self.build_auth_session(
            &user,
            repository::PrincipalRecord {
                principal_id: user.id,
                owner_user_id: user.id,
                kind: PrincipalKind::User,
                email: Some(user.email.clone()),
                username: None,
            },
            kek_metadatas,
        )
        .await
    }

    pub async fn login_api_user(&self, command: ApiUserLoginCommand) -> Result<AuthSession> {
        let username = normalize_username(&command.username)?;
        validate_auth_key(&command.auth_key)?;

        let api_user = repository::find_api_user_by_username(&self.db.connection, &username)
            .await?
            .ok_or_else(|| AppError::Auth("invalid username or auth key".to_string()))?;
        assert_auth_key_matches(&command.auth_key, &api_user.auth_key_hash)?;

        let owner_user = repository::find_user_by_id(&self.db.connection, api_user.user_id)
            .await?
            .ok_or_else(|| {
                AppError::Internal("missing owner user for api user login".to_string())
            })?;
        let kek_metadatas =
            repository::list_kek_metadata_for_user(&self.db.connection, api_user.id).await?;

        self.build_auth_session(
            &owner_user,
            repository::PrincipalRecord {
                principal_id: api_user.id,
                owner_user_id: api_user.user_id,
                kind: PrincipalKind::ApiUser,
                email: None,
                username: Some(api_user.username.clone()),
            },
            kek_metadatas,
        )
        .await
    }

    pub async fn rotate_password(
        &self,
        authenticated_user: &AuthenticatedUser,
        command: RotatePasswordCommand,
    ) -> Result<AuthSession> {
        require_user_principal(authenticated_user)?;

        validate_auth_key(&command.new_auth_key)?;
        let kek_public_key = normalize_kek_public_key(&command.kek_public_key)?;

        let transaction = self
            .db
            .connection
            .begin()
            .await
            .map_err(|e| AppError::Database(e.into()))?;
        let user = repository::find_user_by_id(&transaction, authenticated_user.owner_user_id)
            .await?
            .ok_or_else(|| AppError::Auth("invalid bearer token".to_string()))?;
        let next_epoch_version = repository::next_kek_epoch_version_for_user(
            &transaction,
            authenticated_user.principal_id,
        )
        .await?;
        let now = Utc::now().fixed_offset();

        let updated_user = repository::update_user_auth_key_hash(
            &transaction,
            user,
            hash_auth_key(&command.new_auth_key),
        )
        .await?;
        repository::insert_kek_metadata(
            &transaction,
            authenticated_user.principal_id,
            kek_public_key,
            next_epoch_version,
            now,
        )
        .await?;

        transaction
            .commit()
            .await
            .map_err(|e| AppError::Database(e.into()))?;

        let kek_metadatas = repository::list_kek_metadata_for_user(
            &self.db.connection,
            authenticated_user.principal_id,
        )
        .await?;

        self.build_auth_session(
            &updated_user,
            repository::PrincipalRecord {
                principal_id: updated_user.id,
                owner_user_id: updated_user.id,
                kind: PrincipalKind::User,
                email: Some(updated_user.email.clone()),
                username: None,
            },
            kek_metadatas,
        )
        .await
    }

    pub async fn list_linked_principals(
        &self,
        authenticated_user: &AuthenticatedUser,
    ) -> Result<Vec<LinkedPrincipal>> {
        repository::list_linked_principals_for_owner(
            &self.db.connection,
            authenticated_user.owner_user_id,
        )
        .await?
        .into_iter()
        .map(map_linked_principal)
        .collect()
    }

    pub async fn get_kek_migration_status(
        &self,
        authenticated_user: &AuthenticatedUser,
    ) -> Result<KekMigrationStatus> {
        let kek_metadatas = repository::list_kek_metadata_for_user(
            &self.db.connection,
            authenticated_user.principal_id,
        )
        .await?;
        let latest_kek = kek_metadatas
            .iter()
            .max_by_key(|metadata| metadata.kek_epoch_version)
            .ok_or_else(|| {
                AppError::Internal("missing kek metadata for the account".to_string())
            })?;

        let total_deks = Deks::find()
            .filter(deks_entity::Column::UserId.eq(authenticated_user.principal_id))
            .all(&self.db.connection)
            .await
            .map_err(|e| AppError::Database(e.into()))?;
        let total_latest_kek_deks = total_deks
            .iter()
            .filter(|dek| dek.kek_public_key == latest_kek.kek_public_key)
            .count() as u64;
        let pending_dek_count = (total_deks.len() as u64).saturating_sub(total_latest_kek_deks);

        Ok(KekMigrationStatus {
            all_deks_use_latest_kek: pending_dek_count == 0,
            latest_kek_dek_count: total_latest_kek_deks,
            latest_kek_epoch_version: latest_kek.kek_epoch_version,
            latest_kek_public_key: latest_kek.kek_public_key.clone(),
            pending_dek_count,
            total_dek_count: total_deks.len() as u64,
        })
    }

    pub async fn list_api_users(
        &self,
        authenticated_user: &AuthenticatedUser,
    ) -> Result<Vec<ApiUserRecord>> {
        require_user_principal(authenticated_user)?;

        let api_users = repository::list_api_users_for_owner(
            &self.db.connection,
            authenticated_user.owner_user_id,
        )
        .await?;
        let mut output = Vec::with_capacity(api_users.len());

        for api_user in api_users {
            output.push(
                self.build_api_user_record(authenticated_user.principal_id, api_user)
                    .await?,
            );
        }

        Ok(output)
    }

    pub async fn get_api_user(
        &self,
        authenticated_user: &AuthenticatedUser,
        api_user_id: Uuid,
    ) -> Result<ApiUserRecord> {
        require_user_principal(authenticated_user)?;

        let api_user = repository::find_api_user_by_id(&self.db.connection, api_user_id)
            .await?
            .filter(|api_user| api_user.user_id == authenticated_user.owner_user_id)
            .ok_or_else(|| AppError::NotFound("api user not found".to_string()))?;

        self.build_api_user_record(authenticated_user.principal_id, api_user)
            .await
    }

    pub async fn create_api_user(
        &self,
        authenticated_user: &AuthenticatedUser,
        command: CreateApiUserCommand,
    ) -> Result<ApiUserRecord> {
        require_user_principal(authenticated_user)?;
        validate_auth_key(&command.auth_key)?;
        let kek_public_key = normalize_kek_public_key(&command.kek_public_key)?;
        validate_encrypted_payload(&command.encrypted_label, "encryptedLabel")?;
        let label_deks = map_wrapped_deks(&command.encrypted_label_deks)?;

        if repository::find_api_user_by_id(&self.db.connection, command.api_user_id)
            .await?
            .is_some()
        {
            return Err(AppError::Validation(
                "an api user already exists for this id".to_string(),
            ));
        }

        let linked_principals = repository::list_linked_principals_for_owner(
            &self.db.connection,
            authenticated_user.owner_user_id,
        )
        .await?;
        let owner_principal = linked_principals
            .iter()
            .find(|principal| principal.principal.principal_id == authenticated_user.owner_user_id)
            .ok_or_else(|| AppError::Internal("missing owner principal metadata".to_string()))?;

        validate_label_deks(
            &label_deks,
            authenticated_user.owner_user_id,
            command.api_user_id,
            &owner_principal.latest_kek.kek_public_key,
            &kek_public_key,
        )?;

        let now = Utc::now().fixed_offset();
        let transaction = self
            .db
            .connection
            .begin()
            .await
            .map_err(|e| AppError::Database(e.into()))?;

        let api_user = repository::insert_api_user(
            &transaction,
            repository::NewApiUserRecord {
                id: command.api_user_id,
                owner_user_id: authenticated_user.owner_user_id,
                username: generate_api_username(command.api_user_id),
                auth_key_hash: hash_auth_key(&command.auth_key),
                label_algorithm: command.encrypted_label.algorithm.trim().to_owned(),
                label_ciphertext_hex: command
                    .encrypted_label
                    .ciphertext_hex
                    .trim()
                    .to_ascii_lowercase(),
                label_nonce_hex: command
                    .encrypted_label
                    .nonce_hex
                    .trim()
                    .to_ascii_lowercase(),
                label_version: command.encrypted_label.version,
                created_at: now,
                updated_at: now,
            },
        )
        .await?;

        repository::insert_kek_metadata(&transaction, api_user.id, kek_public_key.clone(), 1, now)
            .await?;
        deks::upsert_wrapped_deks(
            &transaction,
            label_deks
                .into_iter()
                .map(|wrapped_dek| deks::ResourceWrappedDek {
                    resource_id: api_user.id,
                    wrapped_dek,
                })
                .collect(),
            now,
        )
        .await?;

        transaction
            .commit()
            .await
            .map_err(|e| AppError::Database(e.into()))?;

        self.build_api_user_record(authenticated_user.principal_id, api_user)
            .await
    }

    pub async fn delete_api_user(
        &self,
        authenticated_user: &AuthenticatedUser,
        api_user_id: Uuid,
    ) -> Result<()> {
        require_user_principal(authenticated_user)?;

        let api_user = repository::find_api_user_by_id(&self.db.connection, api_user_id)
            .await?
            .filter(|api_user| api_user.user_id == authenticated_user.owner_user_id)
            .ok_or_else(|| AppError::NotFound("api user not found".to_string()))?;

        let transaction = self
            .db
            .connection
            .begin()
            .await
            .map_err(|e| AppError::Database(e.into()))?;

        delete_api_user_records(&transaction, api_user.id).await?;

        transaction
            .commit()
            .await
            .map_err(|e| AppError::Database(e.into()))?;

        Ok(())
    }

    pub async fn delete_account(&self, authenticated_user: &AuthenticatedUser) -> Result<()> {
        require_user_principal(authenticated_user)?;

        let transaction = self
            .db
            .connection
            .begin()
            .await
            .map_err(|e| AppError::Database(e.into()))?;

        let api_users =
            repository::list_api_users_for_owner(&transaction, authenticated_user.owner_user_id)
                .await?;
        for api_user in api_users {
            delete_api_user_records(&transaction, api_user.id).await?;
        }

        deks::delete_wrapped_deks_for_principal(&transaction, authenticated_user.owner_user_id)
            .await?;
        repository::delete_kek_metadata_for_user(&transaction, authenticated_user.owner_user_id)
            .await?;
        repository::delete_user(&transaction, authenticated_user.owner_user_id).await?;

        transaction
            .commit()
            .await
            .map_err(|e| AppError::Database(e.into()))?;

        Ok(())
    }

    pub async fn provision_api_user_deks(
        &self,
        authenticated_user: &AuthenticatedUser,
        api_user_id: Uuid,
        commands: Vec<ProvisionApiUserDekCommand>,
    ) -> Result<ApiUserRecord> {
        require_user_principal(authenticated_user)?;

        let api_user = repository::find_api_user_by_id(&self.db.connection, api_user_id)
            .await?
            .filter(|api_user| api_user.user_id == authenticated_user.owner_user_id)
            .ok_or_else(|| AppError::NotFound("api user not found".to_string()))?;
        let latest_kek = repository::list_kek_metadata_for_user(&self.db.connection, api_user.id)
            .await?
            .into_iter()
            .next()
            .ok_or_else(|| {
                AppError::Internal("missing kek metadata for the api user".to_string())
            })?;

        let mut wrapped_deks = Vec::with_capacity(commands.len());
        for command in commands {
            // A resource only counts as owned by this account if the owner
            // principal already has a wrap for it — that's how it got
            // created in the first place, so this is sufficient proof of
            // ownership without re-checking all six resource tables.
            let owner_wrap = deks::find_wrapped_dek(
                &self.db.connection,
                command.resource_id,
                authenticated_user.owner_user_id,
            )
            .await?;
            if owner_wrap.is_none() {
                return Err(AppError::Validation(
                    "resourceId must reference a resource owned by the account".to_string(),
                ));
            }

            let wrapped_dek = crate::models::map_wrapped_dek(&command.wrapped_dek)?;

            if wrapped_dek.user_id != api_user.id {
                return Err(AppError::Validation(
                    "wrappedDeks.userId must match the provisioned api user".to_string(),
                ));
            }

            if wrapped_dek.kek_public_key != latest_kek.kek_public_key {
                return Err(AppError::Validation(
                    "wrappedDeks.kekId must match the api user's latest KEK id".to_string(),
                ));
            }

            wrapped_deks.push(deks::ResourceWrappedDek {
                resource_id: command.resource_id,
                wrapped_dek,
            });
        }

        let now = Utc::now().fixed_offset();
        deks::upsert_wrapped_deks(&self.db.connection, wrapped_deks, now).await?;

        self.build_api_user_record(authenticated_user.principal_id, api_user)
            .await
    }

    async fn build_auth_session(
        &self,
        owner_user: &users::Model,
        current_principal: repository::PrincipalRecord,
        kek_metadatas: Vec<crate::entities::kek_metadata::Model>,
    ) -> Result<AuthSession> {
        let linked_principals =
            repository::list_linked_principals_for_owner(&self.db.connection, owner_user.id)
                .await?
                .into_iter()
                .map(map_linked_principal)
                .collect::<Result<Vec<_>>>()?;

        Ok(AuthSession {
            current_principal: map_principal_summary(&current_principal),
            kek_metadatas: kek_metadatas.into_iter().map(map_kek_metadata).collect(),
            linked_principals,
            token: self.issue_token(&current_principal, owner_user, TokenType::Access)?,
            refresh_token: self.issue_token(&current_principal, owner_user, TokenType::Refresh)?,
            user_id: owner_user.id,
            email: owner_user.email.clone(),
        })
    }

    async fn build_api_user_record(
        &self,
        current_principal_id: Uuid,
        api_user: crate::entities::api_users::Model,
    ) -> Result<ApiUserRecord> {
        let latest_kek = repository::list_kek_metadata_for_user(&self.db.connection, api_user.id)
            .await?
            .into_iter()
            .next()
            .ok_or_else(|| {
                AppError::Internal("missing kek metadata for the api user".to_string())
            })?;
        let encrypted_label_dek =
            deks::find_wrapped_dek(&self.db.connection, api_user.id, current_principal_id)
                .await?
                .ok_or_else(|| {
                    AppError::Internal("missing label dek for the current principal".to_string())
                })?;

        Ok(ApiUserRecord {
            created_at: api_user.created_at.to_rfc3339(),
            encrypted_label: EncryptedPayload {
                algorithm: api_user.label_algorithm,
                ciphertext_hex: api_user.label_ciphertext_hex,
                nonce_hex: api_user.label_nonce_hex,
                version: api_user.label_version,
            },
            encrypted_label_dek: WrappedDekPayload {
                user_id: encrypted_label_dek.user_id,
                kek_public_key: encrypted_label_dek.kek_public_key,
                algorithm: encrypted_label_dek.algorithm,
                kem_ciphertext_hex: encrypted_label_dek.kem_ciphertext_hex,
                wrapped_dek_hex: encrypted_label_dek.wrapped_dek_hex,
                nonce_hex: encrypted_label_dek.nonce_hex,
                version: encrypted_label_dek.version,
            },
            id: api_user.id,
            latest_kek_epoch_version: latest_kek.kek_epoch_version,
            latest_kek_public_key: latest_kek.kek_public_key,
            updated_at: api_user.updated_at.to_rfc3339(),
            username: api_user.username,
        })
    }

    fn issue_token(
        &self,
        current_principal: &repository::PrincipalRecord,
        owner_user: &users::Model,
        token_type: TokenType,
    ) -> Result<String> {
        let ttl_minutes = match token_type {
            TokenType::Access => self.access_ttl_minutes,
            TokenType::Refresh => self.refresh_ttl_minutes,
        };
        let expires_at = Utc::now()
            .checked_add_signed(chrono::Duration::minutes(ttl_minutes))
            .ok_or_else(|| {
                AppError::Internal("failed to calculate the session expiry".to_string())
            })?;
        let claims = Claims {
            sub: current_principal.principal_id.to_string(),
            owner_user_id: current_principal.owner_user_id.to_string(),
            email: owner_user.email.clone(),
            principal_kind: current_principal.kind,
            token_type,
            exp: expires_at.timestamp() as usize,
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_bytes()),
        )
        .map_err(|_| AppError::Internal("failed to issue the session token".to_string()))
    }
}

async fn delete_api_user_records<C>(db: &C, api_user_id: Uuid) -> Result<()>
where
    C: ConnectionTrait,
{
    deks::delete_wrapped_deks_for_principal(db, api_user_id).await?;
    repository::delete_kek_metadata_for_user(db, api_user_id).await?;
    repository::delete_api_user(db, api_user_id).await?;

    Ok(())
}

fn normalize_email(email: &str) -> Result<String> {
    let normalized = email.trim().to_ascii_lowercase();
    if normalized.is_empty() || !normalized.contains('@') {
        return Err(AppError::Validation(
            "a valid email address is required".to_string(),
        ));
    }

    Ok(normalized)
}

fn normalize_username(username: &str) -> Result<String> {
    let normalized = username.trim().to_ascii_lowercase();

    if normalized.is_empty() {
        return Err(AppError::Validation(
            "a valid username is required".to_string(),
        ));
    }

    Ok(normalized)
}

fn validate_auth_key(auth_key: &str) -> Result<()> {
    if auth_key.trim().len() < 32 {
        return Err(AppError::Validation(
            "authKey must be a non-empty derived key string".to_string(),
        ));
    }

    Ok(())
}

fn assert_auth_key_matches(auth_key: &str, auth_key_hash: &str) -> Result<()> {
    let supplied_hash = hash_auth_key(auth_key);
    if supplied_hash
        .as_bytes()
        .ct_eq(auth_key_hash.as_bytes())
        .unwrap_u8()
        != 1
    {
        return Err(AppError::Auth("invalid credentials".to_string()));
    }

    Ok(())
}

fn normalize_auth_salt(auth_salt: &str) -> Result<String> {
    const AUTH_SALT_BYTES: usize = 16;

    let normalized = auth_salt.trim().to_ascii_lowercase();
    let decoded = hex::decode(&normalized).map_err(|_| {
        AppError::Validation("saltHex must be a valid hexadecimal string".to_string())
    })?;

    if decoded.len() != AUTH_SALT_BYTES {
        return Err(AppError::Validation(
            "saltHex must contain a 16-byte password salt".to_string(),
        ));
    }

    Ok(normalized)
}

fn hash_auth_key(auth_key: &str) -> String {
    hex::encode(Sha512::digest(auth_key.as_bytes()))
}

fn map_kek_metadata(metadata: crate::entities::kek_metadata::Model) -> KekMetadata {
    KekMetadata {
        kek_epoch_version: metadata.kek_epoch_version,
        kek_public_key: metadata.kek_public_key,
    }
}

fn map_principal_summary(principal: &repository::PrincipalRecord) -> PrincipalSummary {
    PrincipalSummary {
        id: principal.principal_id,
        kind: principal.kind,
        email: principal.email.clone(),
        username: principal.username.clone(),
    }
}

fn map_linked_principal(
    linked_principal: repository::LinkedPrincipalRecord,
) -> Result<LinkedPrincipal> {
    Ok(LinkedPrincipal {
        id: linked_principal.principal.principal_id,
        kind: linked_principal.principal.kind,
        email: linked_principal.principal.email,
        username: linked_principal.principal.username,
        latest_kek_epoch_version: linked_principal.latest_kek.kek_epoch_version,
        latest_kek_public_key: linked_principal.latest_kek.kek_public_key,
    })
}

fn require_user_principal(authenticated_user: &AuthenticatedUser) -> Result<()> {
    if authenticated_user.principal_kind != PrincipalKind::User {
        return Err(AppError::Validation(
            "this action requires a primary user session".to_string(),
        ));
    }

    Ok(())
}

fn generate_api_username(api_user_id: Uuid) -> String {
    let compact = api_user_id.simple().to_string();
    format!("api-{}", &compact[..16])
}

fn validate_label_deks(
    wrapped_deks: &[deks::WrappedDek],
    owner_user_id: Uuid,
    api_user_id: Uuid,
    owner_kek_public_key: &str,
    api_user_kek_public_key: &str,
) -> Result<()> {
    if wrapped_deks.len() != 2 {
        return Err(AppError::Validation(
            "encryptedLabelDeks must contain exactly the owner and api user wraps".to_string(),
        ));
    }

    let owner_wrapped_dek = wrapped_deks
        .iter()
        .find(|wrapped_dek| wrapped_dek.user_id == owner_user_id)
        .ok_or_else(|| {
            AppError::Validation("encryptedLabelDeks must contain the owner wrap".to_string())
        })?;
    let api_wrapped_dek = wrapped_deks
        .iter()
        .find(|wrapped_dek| wrapped_dek.user_id == api_user_id)
        .ok_or_else(|| {
            AppError::Validation("encryptedLabelDeks must contain the api user wrap".to_string())
        })?;

    if owner_wrapped_dek.kek_public_key != owner_kek_public_key {
        return Err(AppError::Validation(
            "encryptedLabelDeks owner wrap must target the owner's latest KEK id".to_string(),
        ));
    }

    if api_wrapped_dek.kek_public_key != api_user_kek_public_key {
        return Err(AppError::Validation(
            "encryptedLabelDeks api user wrap must target the api user's KEK id".to_string(),
        ));
    }

    Ok(())
}

impl FromRequestParts<AppState> for AuthenticatedUser {
    type Rejection = AppError;

    fn from_request_parts(
        parts: &mut Parts,
        _state: &AppState,
    ) -> impl std::future::Future<Output = std::result::Result<Self, Self::Rejection>> + Send {
        let result = parts
            .extensions
            .get::<AuthenticatedUser>()
            .cloned()
            .ok_or_else(|| AppError::Auth("user not found in request".to_string()));

        ready(result)
    }
}

/// Pulls the bearer token directly out of the Authorization header — used by
/// the auth middleware itself before `AuthenticatedUser` has been inserted
/// into the request extensions.
pub fn extract_bearer_token(parts: &Parts) -> Result<&str> {
    let authorization_header = parts
        .headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| AppError::Auth("missing bearer token".to_string()))?;

    authorization_header
        .strip_prefix("Bearer ")
        .or_else(|| authorization_header.strip_prefix("bearer "))
        .ok_or_else(|| AppError::Auth("missing bearer token".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_email_trims_and_lowercases() {
        assert_eq!(
            normalize_email("  USER@Example.COM  ").unwrap(),
            "user@example.com"
        );
    }

    #[test]
    fn normalize_email_rejects_missing_at_symbol() {
        assert!(normalize_email("not-an-email").is_err());
    }

    #[test]
    fn validate_auth_key_accepts_32_character_key() {
        assert!(validate_auth_key(&"a".repeat(32)).is_ok());
    }

    #[test]
    fn validate_auth_key_rejects_short_key() {
        assert!(validate_auth_key("short-key").is_err());
    }

    #[test]
    fn normalize_auth_salt_trims_and_lowercases() {
        assert_eq!(
            normalize_auth_salt("  AABBCCDDEEFF00112233445566778899  ").unwrap(),
            "aabbccddeeff00112233445566778899"
        );
    }

    #[test]
    fn normalize_auth_salt_rejects_invalid_hex() {
        assert!(normalize_auth_salt("not-hex").is_err());
    }

    #[test]
    fn normalize_auth_salt_rejects_wrong_byte_length() {
        assert!(normalize_auth_salt("aabbccdd").is_err());
    }

    #[test]
    fn hash_auth_key_is_deterministic_and_distinguishes_input() {
        let a = hash_auth_key("client-derived-auth-key-material");
        let b = hash_auth_key("client-derived-auth-key-material");
        let c = hash_auth_key("different-material");

        assert_eq!(a, b);
        assert_ne!(a, c);
        assert_eq!(a.len(), 128); // SHA-512 hex digest
    }

    #[test]
    fn assert_auth_key_matches_rejects_wrong_key() {
        let hash = hash_auth_key("correct-key");
        assert!(assert_auth_key_matches("correct-key", &hash).is_ok());
        assert!(assert_auth_key_matches("wrong-key", &hash).is_err());
    }

    #[test]
    fn normalize_kek_public_key_requires_1184_bytes() {
        let valid = "aa".repeat(1184);
        let invalid = "aa".repeat(100);

        assert!(normalize_kek_public_key(&valid).is_ok());
        assert!(normalize_kek_public_key(&invalid).is_err());
    }

    #[test]
    fn issue_and_authenticate_access_token_round_trips() {
        let service = AuthService {
            db: Database {
                connection: sea_orm::DatabaseConnection::Disconnected,
            },
            jwt_secret: "test-secret-for-unit-tests".to_string(),
            access_ttl_minutes: 15,
            refresh_ttl_minutes: 43_200,
        };
        let owner_id = Uuid::new_v4();
        let owner = users::Model {
            id: owner_id,
            email: "person@example.com".to_string(),
            auth_key_hash: "unused".to_string(),
            auth_salt: None,
            created_at: chrono::Utc::now().fixed_offset(),
            updated_at: chrono::Utc::now().fixed_offset(),
        };
        let principal = repository::PrincipalRecord {
            principal_id: owner_id,
            owner_user_id: owner_id,
            kind: PrincipalKind::User,
            email: Some(owner.email.clone()),
            username: None,
        };

        let token = service
            .issue_token(&principal, &owner, TokenType::Access)
            .unwrap();
        let authenticated = service.authenticate_access_token(&token).unwrap();

        assert_eq!(authenticated.principal_id, owner_id);
        assert_eq!(authenticated.owner_user_id, owner_id);
        assert_eq!(authenticated.principal_kind, PrincipalKind::User);

        // A refresh token must not authenticate as an access token.
        let refresh_token = service
            .issue_token(&principal, &owner, TokenType::Refresh)
            .unwrap();
        assert!(service.authenticate_access_token(&refresh_token).is_err());
    }
}
