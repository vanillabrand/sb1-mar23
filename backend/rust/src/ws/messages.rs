use actix::{Message as ActixMessage, Recipient};
use serde::{Deserialize, Serialize};
use serde_json::Value;

// Message from client to server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientMessage {
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(default)]
    pub data: Value,
}

// Message from server to client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerMessage {
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(default)]
    pub data: Value,
}

impl ActixMessage for ServerMessage {
    type Result = ();
}

// Connect message
#[derive(Debug, Clone)]
pub struct Connect {
    pub id: String,
    pub addr: Recipient<ServerMessage>,
}

impl ActixMessage for Connect {
    type Result = ();
}

// Disconnect message
#[derive(Debug, Clone)]
pub struct Disconnect {
    pub id: String,
}

impl ActixMessage for Disconnect {
    type Result = ();
}

// Message from client
#[derive(Debug, Clone)]
pub struct Message {
    pub id: String,
    pub msg: ClientMessage,
}

impl ActixMessage for Message {
    type Result = ();
}

// WebSocket message type for session handling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsMessage {
    #[serde(rename = "type")]
    pub message_type: String,
    #[serde(default)]
    pub data: Value,
}
