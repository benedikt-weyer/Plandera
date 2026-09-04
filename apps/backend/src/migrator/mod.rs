use sea_orm_migration::prelude::*;

pub mod m20240101_000001_create_auth_schema;
pub mod m20240101_000002_create_users_table;
pub mod m20240101_000003_create_projects_table;
pub mod m20240101_000004_create_can_do_list_table;
pub mod m20240101_000005_create_calendars_table;
pub mod m20240101_000006_create_calendar_events_table;
pub mod m20240101_000007_create_user_settings_table;
pub mod m20240101_000008_create_countdowns_table;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20240101_000001_create_auth_schema::Migration),
            Box::new(m20240101_000002_create_users_table::Migration),
            Box::new(m20240101_000003_create_projects_table::Migration),
            Box::new(m20240101_000004_create_can_do_list_table::Migration),
            Box::new(m20240101_000005_create_calendars_table::Migration),
            Box::new(m20240101_000006_create_calendar_events_table::Migration),
            Box::new(m20240101_000007_create_user_settings_table::Migration),
            Box::new(m20240101_000008_create_countdowns_table::Migration),
        ]
    }
}
