use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::{deks, errors::AppError};

pub mod calendar;
pub mod calendar_event;
pub mod can_do_list;
pub mod countdown;
pub mod project;

/// A payload encrypted client-side under a per-record DEK
/// (xsalsa20-poly1305).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedPayload {
    pub algorithm: String,
    pub ciphertext_hex: String,
    pub nonce_hex: String,
    pub version: i32,
}

/// A record's DEK, wrapped for one principal's ML-KEM-768 KEK.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WrappedDekPayload {
    pub user_id: uuid::Uuid,
    pub kek_public_key: String,
    pub algorithm: String,
    pub kem_ciphertext_hex: String,
    pub wrapped_dek_hex: String,
    pub nonce_hex: String,
    pub version: i32,
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

pub fn validate_encrypted_payload(
    payload: &EncryptedPayload,
    field_name: &str,
) -> crate::errors::Result<()> {
    if payload.algorithm.trim() != "xsalsa20-poly1305" {
        return Err(AppError::Validation(format!(
            "{field_name}.algorithm must be xsalsa20-poly1305"
        )));
    }

    if payload.version != 1 {
        return Err(AppError::Validation(format!(
            "{field_name}.version must be 1"
        )));
    }

    normalize_hex_field(
        &payload.ciphertext_hex,
        &format!("{field_name}.ciphertextHex"),
    )?;
    normalize_hex_field(&payload.nonce_hex, &format!("{field_name}.nonceHex"))?;

    Ok(())
}

pub fn map_wrapped_dek(payload: &WrappedDekPayload) -> crate::errors::Result<deks::WrappedDek> {
    if payload.algorithm.trim() != "ml-kem-768-encapsulated+xsalsa20-poly1305" {
        return Err(AppError::Validation(
            "wrappedDeks.algorithm must be ml-kem-768-encapsulated+xsalsa20-poly1305".to_string(),
        ));
    }

    if payload.version != 3 {
        return Err(AppError::Validation(
            "wrappedDeks.version must be 3".to_string(),
        ));
    }

    normalize_kek_public_key(&payload.kek_public_key)?;
    normalize_hex_field(&payload.wrapped_dek_hex, "wrappedDeks.wrappedDekHex")?;
    normalize_hex_field(&payload.nonce_hex, "wrappedDeks.nonceHex")?;
    normalize_exact_hex_field(
        &payload.kem_ciphertext_hex,
        "wrappedDeks.kemCiphertextHex",
        1088,
    )?;

    Ok(deks::WrappedDek {
        user_id: payload.user_id,
        kek_public_key: payload.kek_public_key.trim().to_ascii_lowercase(),
        algorithm: payload.algorithm.trim().to_owned(),
        kem_ciphertext_hex: payload.kem_ciphertext_hex.trim().to_ascii_lowercase(),
        wrapped_dek_hex: payload.wrapped_dek_hex.trim().to_ascii_lowercase(),
        nonce_hex: payload.nonce_hex.trim().to_ascii_lowercase(),
        version: payload.version,
    })
}

pub fn map_wrapped_deks(
    payloads: &[WrappedDekPayload],
) -> crate::errors::Result<Vec<deks::WrappedDek>> {
    payloads.iter().map(map_wrapped_dek).collect()
}

pub fn normalize_kek_public_key(kek_public_key: &str) -> crate::errors::Result<String> {
    const ML_KEM_768_PUBLIC_KEY_BYTES: usize = 1184;

    let normalized = kek_public_key.trim().to_ascii_lowercase();
    let decoded = hex::decode(&normalized).map_err(|_| {
        AppError::Validation("kekId must be a valid hexadecimal string".to_string())
    })?;

    if decoded.len() != ML_KEM_768_PUBLIC_KEY_BYTES {
        return Err(AppError::Validation(
            "kekId must contain an ML-KEM-768 public key".to_string(),
        ));
    }

    Ok(normalized)
}

pub fn normalize_hex_field(value: &str, field_name: &str) -> crate::errors::Result<()> {
    let normalized = value.trim().to_ascii_lowercase();

    if normalized.is_empty() {
        return Err(AppError::Validation(format!("{field_name} is required")));
    }

    hex::decode(&normalized)
        .map_err(|_| AppError::Validation(format!("{field_name} must be valid hex")))?;

    Ok(())
}

pub fn normalize_exact_hex_field(
    value: &str,
    field_name: &str,
    expected_bytes: usize,
) -> crate::errors::Result<()> {
    let normalized = value.trim().to_ascii_lowercase();

    if normalized.is_empty() {
        return Err(AppError::Validation(format!("{field_name} is required")));
    }

    let decoded = hex::decode(&normalized)
        .map_err(|_| AppError::Validation(format!("{field_name} must be valid hex")))?;

    if decoded.len() != expected_bytes {
        return Err(AppError::Validation(format!(
            "{field_name} must contain exactly {expected_bytes} bytes"
        )));
    }

    Ok(())
}
