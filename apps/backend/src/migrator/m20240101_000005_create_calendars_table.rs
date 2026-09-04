use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Calendars {
    Table,
    Id,
    UserId,
    EncryptedData,
    Iv,
    Salt,
    IsDefault,
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
                    .table(Calendars::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Calendars::Id)
                            .uuid()
                            .not_null()
                            .primary_key()
                            .extra("DEFAULT gen_random_uuid()".to_string()),
                    )
                    .col(ColumnDef::new(Calendars::UserId).uuid().not_null())
                    .col(ColumnDef::new(Calendars::EncryptedData).string().not_null())
                    .col(ColumnDef::new(Calendars::Iv).string().not_null())
                    .col(ColumnDef::new(Calendars::Salt).string().not_null())
                    .col(
                        ColumnDef::new(Calendars::IsDefault)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(
                        ColumnDef::new(Calendars::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .col(
                        ColumnDef::new(Calendars::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-calendars-user_id")
                            .from(Calendars::Table, Calendars::UserId)
                            .to((Alias::new("auth"), Users::Table), Users::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Create indexes
        manager
            .create_index(
                Index::create()
                    .name("idx-calendars-user_id")
                    .table(Calendars::Table)
                    .col(Calendars::UserId)
                    .to_owned(),
            )
            .await?;

        // Create unique index for default calendars per user
        manager
            .create_index(
                Index::create()
                    .name("idx-calendars-user_default_unique")
                    .table(Calendars::Table)
                    .col(Calendars::UserId)
                    .unique()
                    .if_not_exists()
                    .and_where_option(Some(Expr::col(Calendars::IsDefault).eq(true)))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Calendars::Table).if_exists().to_owned())
            .await
    }
}
