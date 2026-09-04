use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Users {
    Table,
    EncryptedPassword,
    EmailConfirmedAt,
    RawAppMetaData,
    RawUserMetaData,
    IsSuperAdmin,
    AuthKeyHash,
    AuthSalt,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table((Alias::new("auth"), Users::Table))
                    .drop_column(Users::EncryptedPassword)
                    .drop_column(Users::EmailConfirmedAt)
                    .drop_column(Users::RawAppMetaData)
                    .drop_column(Users::RawUserMetaData)
                    .drop_column(Users::IsSuperAdmin)
                    .add_column(
                        ColumnDef::new(Users::AuthKeyHash)
                            .string()
                            .not_null()
                            .extra("DEFAULT ''".to_string()),
                    )
                    .add_column(ColumnDef::new(Users::AuthSalt).string())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table((Alias::new("auth"), Users::Table))
                    .drop_column(Users::AuthKeyHash)
                    .drop_column(Users::AuthSalt)
                    .add_column(ColumnDef::new(Users::EncryptedPassword).string())
                    .add_column(ColumnDef::new(Users::EmailConfirmedAt).timestamp_with_time_zone())
                    .add_column(
                        ColumnDef::new(Users::RawAppMetaData)
                            .json()
                            .not_null()
                            .extra("DEFAULT '{}'::jsonb".to_string()),
                    )
                    .add_column(
                        ColumnDef::new(Users::RawUserMetaData)
                            .json()
                            .not_null()
                            .extra("DEFAULT '{}'::jsonb".to_string()),
                    )
                    .add_column(
                        ColumnDef::new(Users::IsSuperAdmin)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .to_owned(),
            )
            .await
    }
}
