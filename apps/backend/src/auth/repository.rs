use sea_orm::{
    ActiveModelBehavior, ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter,
    QueryOrder, Set,
};
use uuid::Uuid;

use crate::{
    auth::PrincipalKind,
    entities::{api_users, kek_metadata, prelude::*, users},
    errors::{AppError, Result},
};

pub async fn find_user_by_email<C>(db: &C, email: &str) -> Result<Option<users::Model>>
where
    C: ConnectionTrait,
{
    Users::find()
        .filter(users::Column::Email.eq(email))
        .one(db)
        .await
        .map_err(|e| AppError::Database(e.into()))
}

pub async fn find_user_by_id<C>(db: &C, id: Uuid) -> Result<Option<users::Model>>
where
    C: ConnectionTrait,
{
    Users::find_by_id(id)
        .one(db)
        .await
        .map_err(|e| AppError::Database(e.into()))
}

pub async fn insert_user<C>(
    db: &C,
    email: String,
    auth_key_hash: String,
    auth_salt: String,
    now: chrono::DateTime<chrono::FixedOffset>,
) -> Result<users::Model>
where
    C: ConnectionTrait,
{
    let mut model = users::ActiveModel::new();
    model.email = Set(email);
    model.auth_key_hash = Set(auth_key_hash);
    model.auth_salt = Set(Some(auth_salt));
    model.created_at = Set(now);
    model.updated_at = Set(now);

    model
        .insert(db)
        .await
        .map_err(|e| AppError::Database(e.into()))
}

pub async fn update_user_auth_key_hash<C>(
    db: &C,
    user: users::Model,
    auth_key_hash: String,
) -> Result<users::Model>
where
    C: ConnectionTrait,
{
    let mut active: users::ActiveModel = user.into();
    active.auth_key_hash = Set(auth_key_hash);

    active
        .update(db)
        .await
        .map_err(|e| AppError::Database(e.into()))
}

pub async fn delete_user<C>(db: &C, id: Uuid) -> Result<()>
where
    C: ConnectionTrait,
{
    Users::delete_by_id(id)
        .exec(db)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    Ok(())
}

pub async fn find_api_user_by_username<C>(
    db: &C,
    username: &str,
) -> Result<Option<api_users::Model>>
where
    C: ConnectionTrait,
{
    ApiUsers::find()
        .filter(api_users::Column::Username.eq(username))
        .one(db)
        .await
        .map_err(|e| AppError::Database(e.into()))
}

pub async fn find_api_user_by_id<C>(db: &C, id: Uuid) -> Result<Option<api_users::Model>>
where
    C: ConnectionTrait,
{
    ApiUsers::find_by_id(id)
        .one(db)
        .await
        .map_err(|e| AppError::Database(e.into()))
}

pub async fn list_api_users_for_owner<C>(
    db: &C,
    owner_user_id: Uuid,
) -> Result<Vec<api_users::Model>>
where
    C: ConnectionTrait,
{
    ApiUsers::find()
        .filter(api_users::Column::UserId.eq(owner_user_id))
        .order_by_asc(api_users::Column::CreatedAt)
        .all(db)
        .await
        .map_err(|e| AppError::Database(e.into()))
}

pub struct NewApiUserRecord {
    pub id: Uuid,
    pub owner_user_id: Uuid,
    pub username: String,
    pub auth_key_hash: String,
    pub label_algorithm: String,
    pub label_ciphertext_hex: String,
    pub label_nonce_hex: String,
    pub label_version: i32,
    pub created_at: chrono::DateTime<chrono::FixedOffset>,
    pub updated_at: chrono::DateTime<chrono::FixedOffset>,
}

pub async fn insert_api_user<C>(db: &C, record: NewApiUserRecord) -> Result<api_users::Model>
where
    C: ConnectionTrait,
{
    let model = api_users::ActiveModel {
        id: Set(record.id),
        user_id: Set(record.owner_user_id),
        username: Set(record.username),
        auth_key_hash: Set(record.auth_key_hash),
        label_algorithm: Set(record.label_algorithm),
        label_ciphertext_hex: Set(record.label_ciphertext_hex),
        label_nonce_hex: Set(record.label_nonce_hex),
        label_version: Set(record.label_version),
        created_at: Set(record.created_at),
        updated_at: Set(record.updated_at),
    };

    model
        .insert(db)
        .await
        .map_err(|e| AppError::Database(e.into()))
}

pub async fn delete_api_user<C>(db: &C, id: Uuid) -> Result<()>
where
    C: ConnectionTrait,
{
    ApiUsers::delete_by_id(id)
        .exec(db)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    Ok(())
}

pub async fn list_kek_metadata_for_user<C>(
    db: &C,
    principal_id: Uuid,
) -> Result<Vec<kek_metadata::Model>>
where
    C: ConnectionTrait,
{
    KekMetadata::find()
        .filter(kek_metadata::Column::UserId.eq(principal_id))
        .order_by_desc(kek_metadata::Column::KekEpochVersion)
        .all(db)
        .await
        .map_err(|e| AppError::Database(e.into()))
}

pub async fn next_kek_epoch_version_for_user<C>(db: &C, principal_id: Uuid) -> Result<i32>
where
    C: ConnectionTrait,
{
    let latest = list_kek_metadata_for_user(db, principal_id).await?;
    Ok(latest
        .iter()
        .map(|metadata| metadata.kek_epoch_version)
        .max()
        .unwrap_or(0)
        + 1)
}

pub async fn insert_kek_metadata<C>(
    db: &C,
    principal_id: Uuid,
    kek_public_key: String,
    kek_epoch_version: i32,
    now: chrono::DateTime<chrono::FixedOffset>,
) -> Result<kek_metadata::Model>
where
    C: ConnectionTrait,
{
    let model = kek_metadata::ActiveModel {
        kek_public_key: Set(kek_public_key),
        user_id: Set(principal_id),
        kek_epoch_version: Set(kek_epoch_version),
        created_at: Set(now),
    };

    model
        .insert(db)
        .await
        .map_err(|e| AppError::Database(e.into()))
}

pub async fn delete_kek_metadata_for_user<C>(db: &C, principal_id: Uuid) -> Result<()>
where
    C: ConnectionTrait,
{
    KekMetadata::delete_many()
        .filter(kek_metadata::Column::UserId.eq(principal_id))
        .exec(db)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    Ok(())
}

#[derive(Clone, Debug)]
pub struct PrincipalRecord {
    pub principal_id: Uuid,
    pub owner_user_id: Uuid,
    pub kind: PrincipalKind,
    pub email: Option<String>,
    pub username: Option<String>,
}

#[derive(Clone, Debug)]
pub struct LinkedPrincipalRecord {
    pub principal: PrincipalRecord,
    pub latest_kek: kek_metadata::Model,
}

pub async fn list_linked_principals_for_owner<C>(
    db: &C,
    owner_user_id: Uuid,
) -> Result<Vec<LinkedPrincipalRecord>>
where
    C: ConnectionTrait,
{
    let mut output = Vec::new();

    let owner = find_user_by_id(db, owner_user_id)
        .await?
        .ok_or_else(|| AppError::Internal("missing owner user".to_string()))?;
    let owner_latest_kek = list_kek_metadata_for_user(db, owner.id)
        .await?
        .into_iter()
        .next()
        .ok_or_else(|| AppError::Internal("missing kek metadata for the owner".to_string()))?;

    output.push(LinkedPrincipalRecord {
        principal: PrincipalRecord {
            principal_id: owner.id,
            owner_user_id: owner.id,
            kind: PrincipalKind::User,
            email: Some(owner.email),
            username: None,
        },
        latest_kek: owner_latest_kek,
    });

    for api_user in list_api_users_for_owner(db, owner_user_id).await? {
        let latest_kek = list_kek_metadata_for_user(db, api_user.id)
            .await?
            .into_iter()
            .next()
            .ok_or_else(|| {
                AppError::Internal("missing kek metadata for the api user".to_string())
            })?;

        output.push(LinkedPrincipalRecord {
            principal: PrincipalRecord {
                principal_id: api_user.id,
                owner_user_id,
                kind: PrincipalKind::ApiUser,
                email: None,
                username: Some(api_user.username),
            },
            latest_kek,
        });
    }

    Ok(output)
}
