pub mod repository;
pub mod service;

pub use service::{AuthService, AuthenticatedUser};

use serde::{Deserialize, Serialize};

/// Which kind of principal a session belongs to. A user is the primary
/// account (owns the master password); an api user is a secondary,
/// scoped-access principal the owner can create and grant access to
/// specific resources.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PrincipalKind {
    User,
    ApiUser,
}
