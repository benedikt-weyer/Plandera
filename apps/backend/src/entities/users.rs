use sea_orm::{entity::prelude::*, Set};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(schema_name = "auth", table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(unique)]
    pub email: String,
    pub encrypted_password: Option<String>,
    pub email_confirmed_at: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
    #[sea_orm(column_type = "Json")]
    pub raw_app_meta_data: Json,
    #[sea_orm(column_type = "Json")]
    pub raw_user_meta_data: Json,
    pub is_super_admin: bool,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::projects::Entity")]
    Projects,
    #[sea_orm(has_many = "super::can_do_list::Entity")]
    CanDoList,
    #[sea_orm(has_many = "super::calendars::Entity")]
    Calendars,
    #[sea_orm(has_many = "super::calendar_events::Entity")]
    CalendarEvents,
    #[sea_orm(has_many = "super::countdowns::Entity")]
    Countdowns,
}

impl Related<super::projects::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Projects.def()
    }
}

impl Related<super::can_do_list::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::CanDoList.def()
    }
}

impl Related<super::calendars::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Calendars.def()
    }
}

impl Related<super::calendar_events::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::CalendarEvents.def()
    }
}

impl Related<super::countdowns::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Countdowns.def()
    }
}

#[async_trait::async_trait]
impl ActiveModelBehavior for ActiveModel {
    fn new() -> Self {
        Self {
            id: Set(Uuid::new_v4()),
            created_at: Set(chrono::Utc::now().into()),
            updated_at: Set(chrono::Utc::now().into()),
            raw_app_meta_data: Set(serde_json::json!({})),
            raw_user_meta_data: Set(serde_json::json!({})),
            is_super_admin: Set(false),
            ..ActiveModelTrait::default()
        }
    }

    async fn before_save<C>(mut self, _db: &C, insert: bool) -> Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        if !insert {
            self.updated_at = Set(chrono::Utc::now().into());
        }
        Ok(self)
    }
}
