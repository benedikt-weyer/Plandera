use sea_orm::{Database as SeaDatabase, DatabaseConnection, ConnectOptions};
use std::env;
use crate::errors::Result;

#[derive(Clone)]
pub struct Database {
    pub connection: DatabaseConnection,
}

impl Database {
    pub async fn new() -> Result<Self> {
        let database_url = env::var("DATABASE_URL")
            .expect("DATABASE_URL environment variable must be set");
        
        let mut opt = ConnectOptions::new(database_url);
        opt.max_connections(10)
            .min_connections(5)
            .sqlx_logging(true);
        
        let connection = SeaDatabase::connect(opt).await
            .map_err(|e| crate::errors::AppError::Internal(format!("Database connection failed: {}", e)))?;
        
        Ok(Self { connection })
    }
}
