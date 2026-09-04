//! Shared helpers every resource handler uses to attach/replace the wrapped
//! DEKs that live in the generic `deks` table alongside a resource's own
//! ciphertext columns.

use chrono::{DateTime, FixedOffset};
use sea_orm::ConnectionTrait;
use uuid::Uuid;

use crate::{
    deks,
    entities::deks as deks_entity,
    errors::Result,
    models::{EncryptedPayload, WrappedDekPayload, map_wrapped_deks, validate_encrypted_payload},
};

pub fn to_wrapped_dek_payload(model: deks_entity::Model) -> WrappedDekPayload {
    WrappedDekPayload {
        user_id: model.user_id,
        kek_public_key: model.kek_public_key,
        algorithm: model.algorithm,
        kem_ciphertext_hex: model.kem_ciphertext_hex,
        wrapped_dek_hex: model.wrapped_dek_hex,
        nonce_hex: model.nonce_hex,
        version: model.version,
    }
}

pub async fn attach_current_wrap<C>(
    db: &C,
    resource_id: Uuid,
    principal_id: Uuid,
) -> Result<Option<WrappedDekPayload>>
where
    C: ConnectionTrait,
{
    Ok(deks::find_wrapped_dek(db, resource_id, principal_id)
        .await?
        .map(to_wrapped_dek_payload))
}

/// Inserts the wraps for a brand new resource (create).
pub async fn insert_wraps<C>(
    db: &C,
    resource_id: Uuid,
    payloads: &[WrappedDekPayload],
    now: DateTime<FixedOffset>,
) -> Result<()>
where
    C: ConnectionTrait,
{
    let wraps = map_wrapped_deks(payloads)?
        .into_iter()
        .map(|wrapped_dek| deks::ResourceWrappedDek {
            resource_id,
            wrapped_dek,
        })
        .collect();

    deks::upsert_wrapped_deks(db, wraps, now).await
}

/// Replaces every wrap for a resource whose DEK was just regenerated
/// (an update that re-encrypted the payload).
pub async fn replace_wraps<C>(
    db: &C,
    resource_id: Uuid,
    payloads: &[WrappedDekPayload],
    now: DateTime<FixedOffset>,
) -> Result<()>
where
    C: ConnectionTrait,
{
    deks::delete_wrapped_deks_for_resource(db, resource_id).await?;
    insert_wraps(db, resource_id, payloads, now).await
}

pub fn validate_payload(
    algorithm: &str,
    ciphertext_hex: &str,
    nonce_hex: &str,
    version: i32,
    field_name: &str,
) -> Result<()> {
    validate_encrypted_payload(
        &EncryptedPayload {
            algorithm: algorithm.to_owned(),
            ciphertext_hex: ciphertext_hex.to_owned(),
            nonce_hex: nonce_hex.to_owned(),
            version,
        },
        field_name,
    )
}

pub fn require_wraps(payloads: &[WrappedDekPayload]) -> Result<()> {
    if payloads.is_empty() {
        return Err(crate::errors::AppError::Validation(
            "wrappedDeks must contain at least the owner's wrap".to_string(),
        ));
    }

    Ok(())
}
