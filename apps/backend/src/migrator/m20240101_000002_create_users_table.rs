use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
    Email,
    EncryptedPassword,
    EmailConfirmedAt,
    CreatedAt,
    UpdatedAt,
    RawAppMetaData,
    RawUserMetaData,
    IsSuperAdmin,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table((Alias::new("auth"), Users::Table))
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Users::Id)
                            .uuid()
                            .not_null()
                            .primary_key()
                            .extra("DEFAULT gen_random_uuid()".to_string()),
                    )
                    .col(
                        ColumnDef::new(Users::Email)
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(Users::EncryptedPassword).string())
                    .col(ColumnDef::new(Users::EmailConfirmedAt).timestamp_with_time_zone())
                    .col(
                        ColumnDef::new(Users::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .col(
                        ColumnDef::new(Users::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .col(
                        ColumnDef::new(Users::RawAppMetaData)
                            .json()
                            .not_null()
                            .extra("DEFAULT '{}'::jsonb".to_string()),
                    )
                    .col(
                        ColumnDef::new(Users::RawUserMetaData)
                            .json()
                            .not_null()
                            .extra("DEFAULT '{}'::jsonb".to_string()),
                    )
                    .col(
                        ColumnDef::new(Users::IsSuperAdmin)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(
                Table::drop()
                    .table((Alias::new("auth"), Users::Table))
                    .if_exists()
                    .to_owned(),
            )
            .await
    }
}
