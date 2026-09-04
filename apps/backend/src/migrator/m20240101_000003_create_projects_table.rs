use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Projects {
    Table,
    Id,
    UserId,
    EncryptedData,
    Iv,
    Salt,
    IsDefault,
    ParentId,
    DisplayOrder,
    IsCollapsed,
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
        // Create the projects table
        manager
            .create_table(
                Table::create()
                    .table(Projects::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Projects::Id)
                            .uuid()
                            .not_null()
                            .primary_key()
                            .extra("DEFAULT gen_random_uuid()".to_string()),
                    )
                    .col(ColumnDef::new(Projects::UserId).uuid().not_null())
                    .col(ColumnDef::new(Projects::EncryptedData).string().not_null())
                    .col(ColumnDef::new(Projects::Iv).string().not_null())
                    .col(ColumnDef::new(Projects::Salt).string().not_null())
                    .col(
                        ColumnDef::new(Projects::IsDefault)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(ColumnDef::new(Projects::ParentId).uuid())
                    .col(
                        ColumnDef::new(Projects::DisplayOrder)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(Projects::IsCollapsed)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(
                        ColumnDef::new(Projects::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .col(
                        ColumnDef::new(Projects::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-projects-user_id")
                            .from(Projects::Table, Projects::UserId)
                            .to((Alias::new("auth"), Users::Table), Users::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-projects-parent_id")
                            .from(Projects::Table, Projects::ParentId)
                            .to(Projects::Table, Projects::Id)
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
                    .name("idx-projects-user_id")
                    .table(Projects::Table)
                    .col(Projects::UserId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx-projects-parent_id")
                    .table(Projects::Table)
                    .col(Projects::ParentId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx-projects-user_display_order")
                    .table(Projects::Table)
                    .col(Projects::UserId)
                    .col(Projects::DisplayOrder)
                    .to_owned(),
            )
            .await?;

        // Create unique index for default projects per user
        manager
            .create_index(
                Index::create()
                    .name("idx-projects-user_default_unique")
                    .table(Projects::Table)
                    .col(Projects::UserId)
                    .unique()
                    .if_not_exists()
                    .and_where_option(Some(Expr::col(Projects::IsDefault).eq(true)))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Projects::Table).if_exists().to_owned())
            .await
    }
}
