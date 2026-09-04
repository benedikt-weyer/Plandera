use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::env;
use uuid::Uuid;
use chrono::{Duration, Utc};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng, SaltString};

use sea_orm::*;
use crate::errors::{AppError, Result};
use crate::models::user::{CreateUserRequest, LoginRequest, AuthResponse};
use crate::db::Database;
use crate::entities::{prelude::*, users};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // User ID
    pub email: String,
    pub exp: i64,     // Expiration time
    pub iat: i64,     // Issued at
    pub aud: String,  // Audience
    pub iss: String,  // Issuer
}

#[derive(Clone)]
pub struct AuthService {
    db: Database,
    jwt_secret: String,
    jwt_expiry_hours: i64,
}

impl AuthService {
    pub fn new(db: Database) -> Self {
        let jwt_secret = env::var("JWT_SECRET")
            .expect("JWT_SECRET environment variable must be set");
        let jwt_expiry_hours = env::var("JWT_EXPIRY_HOURS")
            .unwrap_or_else(|_| "24".to_string())
            .parse()
            .unwrap_or(24);

        Self {
            db,
            jwt_secret,
            jwt_expiry_hours,
        }
    }

    pub async fn register(&self, request: CreateUserRequest) -> Result<AuthResponse> {
        // Check if user already exists
        let existing_user = Users::find()
            .filter(users::Column::Email.eq(&request.email))
            .one(&self.db.connection)
            .await
            .map_err(|e| AppError::Database(e.into()))?;

        if existing_user.is_some() {
            return Err(AppError::Validation("User already exists".to_string()));
        }

        // Hash password
        let password_hash = self.hash_password(&request.password)?;

        // Create user
        let mut user_active: users::ActiveModel = users::ActiveModel::new();
        user_active.email = Set(request.email.clone());
        user_active.encrypted_password = Set(Some(password_hash));
        user_active.email_confirmed_at = Set(Some(chrono::Utc::now().into()));

        let user = user_active.insert(&self.db.connection).await
            .map_err(|e| AppError::Database(e.into()))?;

        // Generate JWT token
        let token = self.generate_token(&user)?;

        Ok(AuthResponse {
            access_token: token,
            token_type: "Bearer".to_string(),
            expires_in: self.jwt_expiry_hours * 3600,
            user: user.into(),
        })
    }

    pub async fn login(&self, request: LoginRequest) -> Result<AuthResponse> {
        // Find user by email
        let user = Users::find()
            .filter(users::Column::Email.eq(&request.email))
            .one(&self.db.connection)
            .await
            .map_err(|e| AppError::Database(e.into()))?
            .ok_or_else(|| AppError::Auth("Invalid credentials".to_string()))?;

        // Verify password
        if let Some(encrypted_password) = &user.encrypted_password {
            if !self.verify_password(&request.password, encrypted_password)? {
                return Err(AppError::Auth("Invalid credentials".to_string()));
            }
        } else {
            return Err(AppError::Auth("Invalid credentials".to_string()));
        }

        // Generate JWT token
        let token = self.generate_token(&user)?;

        Ok(AuthResponse {
            access_token: token,
            token_type: "Bearer".to_string(),
            expires_in: self.jwt_expiry_hours * 3600,
            user: user.into(),
        })
    }

    pub async fn get_user_from_token(&self, token: &str) -> Result<users::Model> {
        let claims = self.verify_token(token)?;
        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|_| AppError::Auth("Invalid user ID in token".to_string()))?;

        let user = Users::find_by_id(user_id)
            .one(&self.db.connection)
            .await
            .map_err(|e| AppError::Database(e.into()))?
            .ok_or_else(|| AppError::Auth("User not found".to_string()))?;

        Ok(user)
    }

    fn generate_token(&self, user: &users::Model) -> Result<String> {
        let now = Utc::now();
        let expiry = now + Duration::hours(self.jwt_expiry_hours);

        let claims = Claims {
            sub: user.id.to_string(),
            email: user.email.clone(),
            exp: expiry.timestamp(),
            iat: now.timestamp(),
            aud: "streamline-scheduler".to_string(),
            iss: "streamline-scheduler".to_string(),
        };

        let token = encode(
            &Header::new(Algorithm::HS256),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_bytes()),
        )?;

        Ok(token)
    }

    fn verify_token(&self, token: &str) -> Result<Claims> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_audience(&["streamline-scheduler"]);
        validation.set_issuer(&["streamline-scheduler"]);

        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_bytes()),
            &validation,
        )?;

        Ok(token_data.claims)
    }

    fn hash_password(&self, password: &str) -> Result<String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        
        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| AppError::Internal(format!("Failed to hash password: {}", e)))?;

        Ok(password_hash.to_string())
    }

    fn verify_password(&self, password: &str, hash: &str) -> Result<bool> {
        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| AppError::Internal(format!("Failed to parse password hash: {}", e)))?;

        let argon2 = Argon2::default();
        
        Ok(argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
    }
}
