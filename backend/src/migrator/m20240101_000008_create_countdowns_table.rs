use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Countdowns {
    Table,
    Id,
    UserId,
    EventId,
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

#[derive(DeriveIden)]
enum CalendarEvents {
    Table,
    Id,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Countdowns::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Countdowns::Id)
                            .uuid()
                            .not_null()
                            .primary_key()
                            .extra("DEFAULT gen_random_uuid()".to_string()),
                    )
                    .col(ColumnDef::new(Countdowns::UserId).uuid().not_null())
                    .col(ColumnDef::new(Countdowns::EventId).uuid().not_null())
                    .col(ColumnDef::new(Countdowns::EncryptedData).string().not_null())
                    .col(ColumnDef::new(Countdowns::Iv).string().not_null())
                    .col(ColumnDef::new(Countdowns::Salt).string().not_null())
                    .col(
                        ColumnDef::new(Countdowns::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .col(
                        ColumnDef::new(Countdowns::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-countdowns-user_id")
                            .from(Countdowns::Table, Countdowns::UserId)
                            .to((Alias::new("auth"), Users::Table), Users::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-countdowns-event_id")
                            .from(Countdowns::Table, Countdowns::EventId)
                            .to(CalendarEvents::Table, CalendarEvents::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx-countdowns-user_id")
                    .table(Countdowns::Table)
                    .col(Countdowns::UserId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx-countdowns-event_id")
                    .table(Countdowns::Table)
                    .col(Countdowns::EventId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Countdowns::Table).if_exists().to_owned())
            .await
    }
}