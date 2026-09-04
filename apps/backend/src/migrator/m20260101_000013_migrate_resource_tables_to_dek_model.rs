use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Common {
    EncryptedData,
    Iv,
    Salt,
    Algorithm,
    CiphertextHex,
    NonceHex,
    Version,
}

const TABLES: [&str; 6] = [
    "can_do_list",
    "projects",
    "calendars",
    "calendar_events",
    "countdowns",
    "user_settings",
];

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        for table in TABLES {
            manager
                .alter_table(
                    Table::alter()
                        .table(Alias::new(table))
                        .drop_column(Common::EncryptedData)
                        .drop_column(Common::Iv)
                        .drop_column(Common::Salt)
                        .add_column(
                            ColumnDef::new(Common::Algorithm)
                                .string()
                                .not_null()
                                .extra("DEFAULT ''".to_string()),
                        )
                        .add_column(
                            ColumnDef::new(Common::CiphertextHex)
                                .text()
                                .not_null()
                                .extra("DEFAULT ''".to_string()),
                        )
                        .add_column(
                            ColumnDef::new(Common::NonceHex)
                                .string()
                                .not_null()
                                .extra("DEFAULT ''".to_string()),
                        )
                        .add_column(
                            ColumnDef::new(Common::Version)
                                .integer()
                                .not_null()
                                .default(1),
                        )
                        .to_owned(),
                )
                .await?;
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        for table in TABLES {
            manager
                .alter_table(
                    Table::alter()
                        .table(Alias::new(table))
                        .drop_column(Common::Algorithm)
                        .drop_column(Common::CiphertextHex)
                        .drop_column(Common::NonceHex)
                        .drop_column(Common::Version)
                        .add_column(
                            ColumnDef::new(Common::EncryptedData)
                                .string()
                                .not_null()
                                .extra("DEFAULT ''".to_string()),
                        )
                        .add_column(
                            ColumnDef::new(Common::Iv)
                                .string()
                                .not_null()
                                .extra("DEFAULT ''".to_string()),
                        )
                        .add_column(
                            ColumnDef::new(Common::Salt)
                                .string()
                                .not_null()
                                .extra("DEFAULT ''".to_string()),
                        )
                        .to_owned(),
                )
                .await?;
        }

        Ok(())
    }
}
