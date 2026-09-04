use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum CanDoList {
    Table,
    Id,
    UserId,
    ProjectId,
    EncryptedData,
    Iv,
    Salt,
    DisplayOrder,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Projects {
    Table,
    Id,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(CanDoList::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(CanDoList::Id)
                            .uuid()
                            .not_null()
                            .primary_key()
                            .extra("DEFAULT gen_random_uuid()".to_string()),
                    )
                    .col(ColumnDef::new(CanDoList::UserId).uuid().not_null())
                    .col(ColumnDef::new(CanDoList::ProjectId).uuid())
                    .col(ColumnDef::new(CanDoList::EncryptedData).string().not_null())
                    .col(ColumnDef::new(CanDoList::Iv).string().not_null())
                    .col(ColumnDef::new(CanDoList::Salt).string().not_null())
                    .col(
                        ColumnDef::new(CanDoList::DisplayOrder)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(CanDoList::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .col(
                        ColumnDef::new(CanDoList::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-can_do_list-user_id")
                            .from(CanDoList::Table, CanDoList::UserId)
                            .to((Alias::new("auth"), Users::Table), Users::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-can_do_list-project_id")
                            .from(CanDoList::Table, CanDoList::ProjectId)
                            .to(Projects::Table, Projects::Id)
                            .on_delete(ForeignKeyAction::SetNull)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Create indexes
        manager
            .create_index(
                Index::create()
                    .name("idx-can_do_list-user_id")
                    .table(CanDoList::Table)
                    .col(CanDoList::UserId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx-can_do_list-project_id")
                    .table(CanDoList::Table)
                    .col(CanDoList::ProjectId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx-can_do_list-user_display_order")
                    .table(CanDoList::Table)
                    .col(CanDoList::UserId)
                    .col(CanDoList::DisplayOrder)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(CanDoList::Table).if_exists().to_owned())
            .await
    }
}
