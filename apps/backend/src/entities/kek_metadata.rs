use sea_orm::entity::prelude::*;

/// One row per KEK (ML-KEM-768 public key) a principal (user or api user) has
/// ever registered. `user_id` here means "principal id" — it may point at
/// either `auth.users.id` or `api_users.id`, so there is no FK.
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq)]
#[sea_orm(table_name = "kek_metadata")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub kek_public_key: String,
    pub user_id: Uuid,
    pub kek_epoch_version: i32,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
