use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use crate::auth::AuthService;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketMessage {
    pub event_type: String,
    pub table: String,
    pub user_id: Uuid,
    pub record_id: Option<Uuid>,
    pub data: Option<serde_json::Value>,
}

#[derive(Clone)]
pub struct WebSocketConnection {
    pub tx: broadcast::Sender<WebSocketMessage>,
    pub connection_id: Uuid,
}

#[derive(Clone)]
pub struct WebSocketState {
    pub connections: Arc<RwLock<HashMap<Uuid, Vec<WebSocketConnection>>>>,
}

impl WebSocketState {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_connection(&self, user_id: Uuid, connection_id: Uuid, tx: broadcast::Sender<WebSocketMessage>) {
        let mut connections = self.connections.write().await;
        let conn = WebSocketConnection { tx, connection_id };
        connections.entry(user_id).or_insert_with(Vec::new).push(conn);
    }

    pub async fn remove_connection(&self, user_id: &Uuid, connection_id: &Uuid) {
        let mut connections = self.connections.write().await;
        if let Some(user_conns) = connections.get_mut(user_id) {
            user_conns.retain(|conn| &conn.connection_id != connection_id);
            if user_conns.is_empty() {
                connections.remove(user_id);
            }
        }
    }

    pub async fn broadcast_to_user(&self, user_id: &Uuid, message: WebSocketMessage, exclude_connection_id: Option<Uuid>) {
        let connections = self.connections.read().await;
        tracing::info!("Broadcasting WebSocket message to user {}: {:?}, excluding connection: {:?}", user_id, message, exclude_connection_id);
        
        if let Some(user_conns) = connections.get(user_id) {
            let mut sent_count = 0;
            for conn in user_conns {
                // Skip the connection that initiated the update
                if let Some(exclude_id) = exclude_connection_id {
                    if conn.connection_id == exclude_id {
                        tracing::info!("Skipping connection {} (initiator of the update)", exclude_id);
                        continue;
                    }
                }
                
                if let Err(e) = conn.tx.send(message.clone()) {
                    tracing::warn!("Failed to send WebSocket message to connection {}: {}", conn.connection_id, e);
                } else {
                    sent_count += 1;
                }
            }
            tracing::info!("Successfully sent WebSocket message to {} out of {} connections for user {}", sent_count, user_conns.len(), user_id);
        } else {
            tracing::warn!("No WebSocket connections found for user {}", user_id);
            tracing::info!("Active connections: {:?}", connections.keys().collect::<Vec<_>>());
        }
    }
}

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(app_state): State<crate::state::AppState>,
) -> Response {
    let auth_service = app_state.auth_service.clone();
    let ws_state = app_state.ws_state.clone();
    ws.on_upgrade(move |socket| websocket_connection(socket, auth_service, ws_state))
}

async fn websocket_connection(
    socket: WebSocket,
    auth_service: AuthService,
    ws_state: WebSocketState,
) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = broadcast::channel::<WebSocketMessage>(100);
    
    // Generate a unique connection ID for this WebSocket
    let connection_id = Uuid::new_v4();
    
    // Handle authentication
    let mut user_id: Option<Uuid> = None;
    
    // Authentication flow
    if let Some(msg) = receiver.next().await {
        if let Ok(Message::Text(text)) = msg {
            if let Ok(auth_msg) = serde_json::from_str::<serde_json::Value>(&text) {
                if let Some(token) = auth_msg.get("token").and_then(|t| t.as_str()) {
                    if let Ok(user) = auth_service.get_user_from_token(token).await {
                        user_id = Some(user.id);
                        tracing::info!("WebSocket authentication successful for user: {} with connection_id: {}", user.id, connection_id);
                        ws_state.add_connection(user.id, connection_id, tx.clone()).await;
                        
                        // Send authentication success with connection_id
                        let auth_response = serde_json::json!({
                            "type": "auth_success",
                            "user_id": user.id,
                            "connection_id": connection_id
                        });
                        
                        if sender.send(Message::Text(auth_response.to_string().into())).await.is_err() {
                            tracing::error!("Failed to send auth success message to user: {}", user.id);
                            return;
                        }
                        tracing::info!("Sent auth success message to user: {} with connection_id: {}", user.id, connection_id);
                    } else {
                        tracing::warn!("WebSocket authentication failed for token");
                    }
                }
            }
        }
    }
    
    if user_id.is_none() {
        // Authentication failed
        let auth_error = serde_json::json!({
            "type": "auth_error",
            "message": "Authentication failed"
        });
        
        let _ = sender.send(Message::Text(auth_error.to_string().into())).await;
        return;
    }
    
    let user_id = user_id.unwrap();
    
    // Spawn task to handle outgoing messages
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
    });
    
    // Handle incoming messages
    let mut recv_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    // Handle incoming messages (e.g., subscriptions)
                    tracing::debug!("Received WebSocket message: {}", text);
                },
                Ok(Message::Close(_)) => {
                    break;
                },
                _ => {}
            }
        }
    });
    
    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
        },
        _ = (&mut recv_task) => {
            send_task.abort();
        }
    }
    
    // Clean up connection
    ws_state.remove_connection(&user_id, &connection_id).await;
    tracing::info!("WebSocket connection closed for user: {} with connection_id: {}", user_id, connection_id);
}
