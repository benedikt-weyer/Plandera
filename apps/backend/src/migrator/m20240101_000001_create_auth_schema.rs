use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create the auth schema for authentication-related tables
        manager
            .get_connection()
            .execute_unprepared("CREATE SCHEMA IF NOT EXISTS auth;")
            .await?;
        
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop the auth schema
        manager
            .get_connection()
            .execute_unprepared("DROP SCHEMA IF EXISTS auth CASCADE;")
            .await?;
        
        Ok(())
    }
}