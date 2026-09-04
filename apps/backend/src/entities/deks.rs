use sea_orm::entity::prelude::*;

/// One wrapped DEK per (resource, principal) pair, shared across every
/// resource table (can_do_list, projects, calendars, calendar_events,
/// countdowns, user_settings). `resource_id` points into whichever table
/// owns it and `user_id` means "principal id" (a user or an api user) — no
/// FK on either, since both can point at more than one table.
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq)]
#[sea_orm(table_name = "deks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub resource_id: Uuid,
    #[sea_orm(primary_key, auto_increment = false)]
    pub user_id: Uuid,
    pub kek_public_key: String,
    pub algorithm: String,
    pub kem_ciphertext_hex: String,
    pub wrapped_dek_hex: String,
    pub nonce_hex: String,
    pub version: i32,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
