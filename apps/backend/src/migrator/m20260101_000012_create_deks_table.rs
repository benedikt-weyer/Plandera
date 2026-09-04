use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Deks {
    Table,
    ResourceId,
    UserId,
    KekPublicKey,
    Algorithm,
    KemCiphertextHex,
    WrappedDekHex,
    NonceHex,
    Version,
    CreatedAt,
    UpdatedAt,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Deks::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Deks::ResourceId).uuid().not_null())
                    .col(ColumnDef::new(Deks::UserId).uuid().not_null())
                    .col(ColumnDef::new(Deks::KekPublicKey).string().not_null())
                    .col(ColumnDef::new(Deks::Algorithm).string().not_null())
                    .col(ColumnDef::new(Deks::KemCiphertextHex).text().not_null())
                    .col(ColumnDef::new(Deks::WrappedDekHex).text().not_null())
                    .col(ColumnDef::new(Deks::NonceHex).string().not_null())
                    .col(ColumnDef::new(Deks::Version).integer().not_null())
                    .col(
                        ColumnDef::new(Deks::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .col(
                        ColumnDef::new(Deks::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .primary_key(Index::create().col(Deks::ResourceId).col(Deks::UserId))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx-deks-user_id")
                    .table(Deks::Table)
                    .col(Deks::UserId)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Deks::Table).if_exists().to_owned())
            .await
    }
}
