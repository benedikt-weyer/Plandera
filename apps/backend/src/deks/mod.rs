//! Shared DEK-wrapping storage, used by every resource handler. A resource's
//! symmetric payload key (DEK) is never stored directly — only wrapped
//! (encrypted) once per principal (user or api user) allowed to read it, in
//! this one `deks` table shared across all resource kinds.

use sea_orm::{ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, Set, sea_query::OnConflict};
use std::collections::HashMap;
use uuid::Uuid;

use crate::{
    entities::{deks, prelude::*},
    errors::{AppError, Result},
};

#[derive(Debug, Clone)]
pub struct WrappedDek {
    pub user_id: Uuid,
    pub kek_public_key: String,
    pub algorithm: String,
    pub kem_ciphertext_hex: String,
    pub wrapped_dek_hex: String,
    pub nonce_hex: String,
    pub version: i32,
}

#[derive(Debug, Clone)]
pub struct ResourceWrappedDek {
    pub resource_id: Uuid,
    pub wrapped_dek: WrappedDek,
}

pub async fn upsert_wrapped_deks<C>(
    db: &C,
    wraps: Vec<ResourceWrappedDek>,
    now: chrono::DateTime<chrono::FixedOffset>,
) -> Result<()>
where
    C: ConnectionTrait,
{
    if wraps.is_empty() {
        return Ok(());
    }

    let models = wraps.into_iter().map(|wrap| deks::ActiveModel {
        resource_id: Set(wrap.resource_id),
        user_id: Set(wrap.wrapped_dek.user_id),
        kek_public_key: Set(wrap.wrapped_dek.kek_public_key),
        algorithm: Set(wrap.wrapped_dek.algorithm),
        kem_ciphertext_hex: Set(wrap.wrapped_dek.kem_ciphertext_hex),
        wrapped_dek_hex: Set(wrap.wrapped_dek.wrapped_dek_hex),
        nonce_hex: Set(wrap.wrapped_dek.nonce_hex),
        version: Set(wrap.wrapped_dek.version),
        created_at: Set(now),
        updated_at: Set(now),
    });

    Deks::insert_many(models)
        .on_conflict(
            OnConflict::columns([deks::Column::ResourceId, deks::Column::UserId])
                .update_columns([
                    deks::Column::KekPublicKey,
                    deks::Column::Algorithm,
                    deks::Column::KemCiphertextHex,
                    deks::Column::WrappedDekHex,
                    deks::Column::NonceHex,
                    deks::Column::Version,
                    deks::Column::UpdatedAt,
                ])
                .to_owned(),
        )
        .exec(db)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    Ok(())
}

pub async fn find_wrapped_dek<C>(
    db: &C,
    resource_id: Uuid,
    principal_id: Uuid,
) -> Result<Option<deks::Model>>
where
    C: ConnectionTrait,
{
    Deks::find()
        .filter(deks::Column::ResourceId.eq(resource_id))
        .filter(deks::Column::UserId.eq(principal_id))
        .one(db)
        .await
        .map_err(|e| AppError::Database(e.into()))
}

pub async fn load_deks_for_resources<C>(
    db: &C,
    principal_id: Uuid,
    resource_ids: Vec<Uuid>,
) -> Result<HashMap<Uuid, deks::Model>>
where
    C: ConnectionTrait,
{
    if resource_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let rows = Deks::find()
        .filter(deks::Column::ResourceId.is_in(resource_ids))
        .filter(deks::Column::UserId.eq(principal_id))
        .all(db)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    Ok(rows.into_iter().map(|row| (row.resource_id, row)).collect())
}

pub async fn delete_wrapped_deks_for_resource<C>(db: &C, resource_id: Uuid) -> Result<()>
where
    C: ConnectionTrait,
{
    Deks::delete_many()
        .filter(deks::Column::ResourceId.eq(resource_id))
        .exec(db)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    Ok(())
}

pub async fn delete_wrapped_deks_for_principal<C>(db: &C, principal_id: Uuid) -> Result<()>
where
    C: ConnectionTrait,
{
    Deks::delete_many()
        .filter(deks::Column::UserId.eq(principal_id))
        .exec(db)
        .await
        .map_err(|e| AppError::Database(e.into()))?;

    Ok(())
}
