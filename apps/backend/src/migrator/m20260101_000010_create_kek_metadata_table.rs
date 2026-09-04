use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum KekMetadata {
    Table,
    KekPublicKey,
    UserId,
    KekEpochVersion,
    CreatedAt,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(KekMetadata::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(KekMetadata::KekPublicKey)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(KekMetadata::UserId).uuid().not_null())
                    .col(
                        ColumnDef::new(KekMetadata::KekEpochVersion)
                            .integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(KekMetadata::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx-kek_metadata-user_id")
                    .table(KekMetadata::Table)
                    .col(KekMetadata::UserId)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(
                Table::drop()
                    .table(KekMetadata::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await
    }
}
