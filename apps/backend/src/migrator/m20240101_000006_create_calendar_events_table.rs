use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum CalendarEvents {
    Table,
    Id,
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

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(CalendarEvents::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(CalendarEvents::Id)
                            .uuid()
                            .not_null()
                            .primary_key()
                            .extra("DEFAULT gen_random_uuid()".to_string()),
                    )
                    .col(ColumnDef::new(CalendarEvents::UserId).uuid().not_null())
                    .col(ColumnDef::new(CalendarEvents::EncryptedData).string().not_null())
                    .col(ColumnDef::new(CalendarEvents::Iv).string().not_null())
                    .col(ColumnDef::new(CalendarEvents::Salt).string().not_null())
                    .col(
                        ColumnDef::new(CalendarEvents::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .col(
                        ColumnDef::new(CalendarEvents::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-calendar_events-user_id")
                            .from(CalendarEvents::Table, CalendarEvents::UserId)
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
                    .name("idx-calendar_events-user_id")
                    .table(CalendarEvents::Table)
                    .col(CalendarEvents::UserId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(CalendarEvents::Table).if_exists().to_owned())
            .await
    }
}
