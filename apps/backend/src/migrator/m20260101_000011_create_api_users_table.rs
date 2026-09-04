use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum ApiUsers {
    Table,
    Id,
    UserId,
    Username,
    AuthKeyHash,
    LabelAlgorithm,
    LabelCiphertextHex,
    LabelNonceHex,
    LabelVersion,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ApiUsers::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(ApiUsers::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(ApiUsers::UserId).uuid().not_null())
                    .col(
                        ColumnDef::new(ApiUsers::Username)
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(ApiUsers::AuthKeyHash).string().not_null())
                    .col(ColumnDef::new(ApiUsers::LabelAlgorithm).string().not_null())
                    .col(
                        ColumnDef::new(ApiUsers::LabelCiphertextHex)
                            .text()
                            .not_null(),
                    )
                    .col(ColumnDef::new(ApiUsers::LabelNonceHex).string().not_null())
                    .col(ColumnDef::new(ApiUsers::LabelVersion).integer().not_null())
                    .col(
                        ColumnDef::new(ApiUsers::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .col(
                        ColumnDef::new(ApiUsers::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-api_users-user_id")
                            .from(ApiUsers::Table, ApiUsers::UserId)
                            .to((Alias::new("auth"), Users::Table), Users::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx-api_users-user_id")
                    .table(ApiUsers::Table)
                    .col(ApiUsers::UserId)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(ApiUsers::Table).if_exists().to_owned())
            .await
    }
}
