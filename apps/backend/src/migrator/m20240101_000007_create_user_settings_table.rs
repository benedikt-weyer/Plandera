use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(UserSettings::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(UserSettings::UserId)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(UserSettings::EncryptedData).text().not_null())
                    .col(ColumnDef::new(UserSettings::Iv).text().not_null())
                    .col(ColumnDef::new(UserSettings::Salt).text().not_null())
                    .col(
                        ColumnDef::new(UserSettings::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(UserSettings::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_user_settings_user")
                            .from(UserSettings::Table, UserSettings::UserId)
                            .to((Alias::new("auth"), Users::Table), Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Create index on user_id for faster lookups
        manager
            .create_index(
                Index::create()
                    .name("idx_user_settings_user_id")
                    .table(UserSettings::Table)
                    .col(UserSettings::UserId)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(UserSettings::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum UserSettings {
    Table,
    UserId,
    EncryptedData,
    Iv,
    Salt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

