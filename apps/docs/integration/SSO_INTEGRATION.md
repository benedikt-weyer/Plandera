# Streamline Account SSO Integration

This document explains how the Streamline Scheduler integrates with Streamline Account for Single Sign-On (SSO) authentication.

## Overview

The SSO integration allows users to sign in to Streamline Scheduler using their Streamline Account credentials. The flow uses the centralized Streamline Account authentication server to verify user identity and then creates a local session in the Streamline Scheduler.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────────┐
│   Streamline    │         │    Streamline    │         │   Streamline       │
│   Scheduler     │◄────────┤     Account      │────────►│   Scheduler        │
│   (Frontend)    │         │  (Auth Server)   │         │   (Rust Backend)   │
└─────────────────┘         └──────────────────┘         └─────────────────────┘
        │                            │                              │
        │  1. Request Login          │                              │
        ├───────────────────────────►│                              │
        │                            │                              │
        │  2. Login & Get Token      │                              │
        │◄───────────────────────────┤                              │
        │                            │                              │
        │  3. Validate Token         │                              │
        ├───────────────────────────►│                              │
        │                            │                              │
        │  4. Exchange Token         │                              │
        ├────────────────────────────┴─────────────────────────────►│
        │                                                            │
        │  5. Get Scheduler Token                                   │
        │◄───────────────────────────────────────────────────────────┤
```

## Frontend Implementation (✅ Complete)

The frontend SSO integration has been implemented with the following components:

### 1. Environment Configuration

**File**: `frontend/env.example`

```bash
# Streamline Account SSO Configuration (Optional)
NEXT_PUBLIC_AUTH_SERVER_URL=http://localhost:3001
```

### 2. SSO Utilities

**File**: `frontend/utils/auth/sso-utils.ts`

Key functions:
- `isSSOEnabled()` - Check if SSO is configured
- `redirectToSSOLogin()` - Redirect user to auth server
- `validateSSOToken()` - Validate token with auth server
- `exchangeSSOToken()` - Exchange SSO token for scheduler token

### 3. Sign-In Page

**File**: `frontend/app/(auth-pages)/sign-in/page.tsx`

- Added "Sign in with Streamline Account" button (only visible when SSO is enabled)
- Button redirects to Streamline Account login page

### 4. SSO Callback Handler

**File**: `frontend/app/(auth-pages)/auth/sso-callback/page.tsx`

Handles the OAuth-like callback flow:
1. Receives token from auth server
2. Validates token with auth server
3. Derives encryption key for client-side encryption
4. Exchanges SSO token for scheduler auth token
5. Stores scheduler token in localStorage
6. Redirects to home page

## Backend Implementation (⚠️ TODO)

The Rust backend needs to implement the following endpoint to support SSO:

### Required Endpoint: `/auth/sso-exchange`

**Purpose**: Exchange a validated Streamline Account token for a Streamline Scheduler authentication token.

**Method**: `POST`

**Request**:
```json
{
  "sso_token": "string",
  "user": {
    "id": "string",
    "name": "string",
    "email": "string"
  }
}
```

**Response** (Success - 200):
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "string",
    "email": "string",
    "created_at": "timestamp"
  }
}
```

**Response** (Error - 401):
```json
{
  "error": "Invalid SSO token"
}
```

### Implementation Steps

#### Step 1: Add SSO Configuration

In `apps/backend/.env`:
```bash
# Streamline Account SSO
AUTH_SERVER_URL=http://localhost:3001
ENABLE_SSO=true
```

#### Step 2: Create SSO Token Validation

**File**: `apps/backend/src/auth/sso.rs`

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct ValidateTokenRequest {
    token: String,
}

#[derive(Debug, Deserialize)]
struct ValidateTokenResponse {
    valid: bool,
    user: Option<SSOUser>,
    error: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct SSOUser {
    id: String,
    name: String,
    email: String,
}

pub async fn validate_sso_token(
    token: &str,
    auth_server_url: &str,
) -> Result<SSOUser, String> {
    let client = Client::new();
    
    let response = client
        .post(format!("{}/api/validate-session", auth_server_url))
        .json(&ValidateTokenRequest {
            token: token.to_string(),
        })
        .send()
        .await
        .map_err(|e| format!("Failed to validate SSO token: {}", e))?;

    let validation: ValidateTokenResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse validation response: {}", e))?;

    if validation.valid {
        validation.user.ok_or_else(|| "No user in validation response".to_string())
    } else {
        Err(validation.error.unwrap_or_else(|| "Invalid token".to_string()))
    }
}
```

#### Step 3: Add SSO Exchange Handler

**File**: `apps/backend/src/handlers/auth.rs`

```rust
use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::auth::sso::{validate_sso_token, SSOUser};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct SSOExchangeRequest {
    sso_token: String,
    user: SSOUser,
}

#[derive(Debug, Serialize)]
pub struct SSOExchangeResponse {
    token: String,
    user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    id: String,
    email: String,
    created_at: String,
}

pub async fn sso_exchange(
    State(state): State<AppState>,
    Json(payload): Json<SSOExchangeRequest>,
) -> Result<Json<SSOExchangeResponse>, (StatusCode, String)> {
    // Validate the SSO token with the auth server
    let auth_server_url = std::env::var("AUTH_SERVER_URL")
        .unwrap_or_else(|_| "http://localhost:3001".to_string());
    
    let validated_user = validate_sso_token(&payload.sso_token, &auth_server_url)
        .await
        .map_err(|e| (StatusCode::UNAUTHORIZED, e))?;

    // Verify the user data matches
    if validated_user.email != payload.user.email {
        return Err((
            StatusCode::UNAUTHORIZED,
            "User data mismatch".to_string(),
        ));
    }

    // Check if user exists in our database
    let user = match users::Entity::find()
        .filter(users::Column::Email.eq(&validated_user.email))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    {
        Some(user) => user,
        None => {
            // Create new user from SSO data
            let new_user = users::ActiveModel {
                id: Set(Uuid::new_v4().to_string()),
                email: Set(validated_user.email.clone()),
                password_hash: Set(None), // No password for SSO users
                created_at: Set(Utc::now()),
                updated_at: Set(Utc::now()),
                sso_provider: Set(Some("streamline_account".to_string())),
                sso_id: Set(Some(validated_user.id.clone())),
                ..Default::default()
            };

            new_user
                .insert(&state.db)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        }
    };

    // Generate JWT token for this user
    let token = generate_jwt_token(&user.id, &state.jwt_secret)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok(Json(SSOExchangeResponse {
        token,
        user: UserResponse {
            id: user.id,
            email: user.email,
            created_at: user.created_at.to_rfc3339(),
        },
    }))
}
```

#### Step 4: Register the Route

**File**: `apps/backend/src/main.rs` or `apps/backend/src/handlers/mod.rs`

```rust
// Add to your router
let app = Router::new()
    // ... existing routes ...
    .route("/auth/sso-exchange", post(handlers::auth::sso_exchange))
    // ... more routes ...
    .with_state(state);
```

#### Step 5: Update Database Schema

Add SSO fields to the users table:

```rust
// In your user entity/migration
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .add_column_if_not_exists(
                        ColumnDef::new(Users::SsoProvider)
                            .string()
                            .null()
                    )
                    .add_column_if_not_exists(
                        ColumnDef::new(Users::SsoId)
                            .string()
                            .null()
                    )
                    .to_owned(),
            )
            .await
    }
}
```

## User Flow

1. **User visits sign-in page**
   - Sees "Sign in with Streamline Account" button (if SSO enabled)

2. **User clicks SSO button**
   - Redirected to Streamline Account login: `https://auth.streamline.com/login?callback=https://scheduler.streamline.com/auth/sso-callback&app=scheduler`

3. **User logs in to Streamline Account**
   - Enters email and password (or already logged in)
   - Authenticates with Better Auth

4. **Auth server redirects back**
   - Redirects to: `https://scheduler.streamline.com/auth/sso-callback?token=SESSION_TOKEN`

5. **Scheduler validates token**
   - Frontend validates token with auth server
   - Receives user info (id, name, email)

6. **Scheduler exchanges token**
   - Frontend sends SSO token to scheduler backend
   - Backend validates with auth server
   - Backend creates/finds user in local database
   - Backend generates scheduler-specific JWT token

7. **User is authenticated**
   - Frontend stores scheduler JWT token
   - Derives encryption key for client-side encryption
   - Redirects to home page

## Security Considerations

1. **Token Validation**: Always validate SSO tokens with the auth server before trusting them
2. **HTTPS Only**: In production, all communication must use HTTPS
3. **Token Expiry**: Implement token expiration and refresh mechanisms
4. **CORS**: Configure proper CORS headers on both servers
5. **Callback URL Validation**: Validate callback URLs to prevent open redirects
6. **Rate Limiting**: Implement rate limiting on SSO endpoints

## Environment Variables

### Frontend
```bash
NEXT_PUBLIC_AUTH_SERVER_URL=http://localhost:3001  # Auth server URL
NEXT_PUBLIC_BACKEND_HTTP_URL=http://localhost:3001 # Scheduler backend URL
```

### Backend
```bash
AUTH_SERVER_URL=http://localhost:3001  # Auth server for SSO validation
ENABLE_SSO=true                         # Enable SSO feature
JWT_SECRET=your-jwt-secret              # For generating tokens
```

### Auth Server
```bash
NEXT_PUBLIC_STREAMLINE_SCHEDULER_URL=http://localhost:3000  # Scheduler URL
```

## Testing

### Test SSO Flow

1. Start auth server: `cd streamline-scheduler-webpage && pnpm dev` (port 3001)
2. Start scheduler backend: `cd streamline-scheduler/backend && cargo run` (port 3001)
3. Start scheduler frontend: `cd streamline-scheduler/frontend && pnpm dev` (port 3000)
4. Navigate to `http://localhost:3000/sign-in`
5. Click "Sign in with Streamline Account"
6. Should redirect to auth server, login, and return authenticated

## Troubleshooting

### "SSO not configured" error
- Check that `NEXT_PUBLIC_AUTH_SERVER_URL` is set in frontend `.env.local`

### "Failed to validate SSO token"
- Verify auth server is running
- Check AUTH_SERVER_URL in backend configuration
- Ensure network connectivity between services

### "Failed to exchange SSO token"
- Verify backend `/auth/sso-exchange` endpoint is implemented
- Check backend logs for specific errors
- Ensure backend can reach auth server for validation

## Future Enhancements

- [ ] Token refresh mechanism
- [ ] Support for multiple SSO providers
- [ ] Remember device/trusted browser feature
- [ ] SSO session management dashboard
- [ ] Audit logging for SSO events

