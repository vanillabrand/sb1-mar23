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
#[derive(Debug, Clone)]
pub enum ServerMessage {
    Connect(Connect),
    Disconnect(Disconnect),
    Message(Message),
    Text(String),
}

impl Serialize for ServerMessage {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            ServerMessage::Connect(c) => c.serialize(serializer),
            ServerMessage::Disconnect(d) => d.serialize(serializer),
            ServerMessage::Message(m) => m.serialize(serializer),
            ServerMessage::Text(s) => serializer.serialize_str(s),
        }
    }
}

impl ActixMessage for ServerMessage {
    type Result = ();
}

// Connect message
#[derive(Debug, Clone)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connect {
    pub id: String,
    pub addr: Recipient<ServerMessage>,
}

impl ActixMessage for Connect {
    type Result = ();
}

// Disconnect message
#[derive(Debug, Clone)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Disconnect {
    pub id: String,
}

impl From<Connect> for ServerMessage {
    fn from(connect: Connect) -> Self {
        ServerMessage::Connect(connect)
    }
}

impl From<Disconnect> for ServerMessage {
    fn from(disconnect: Disconnect) -> Self {
        ServerMessage::Disconnect(disconnect)
    }
}

impl From<Message> for ServerMessage {
    fn from(message: Message) -> Self {
        ServerMessage::Message(message)
    }
}

impl From<String> for ServerMessage {
    fn from(text: String) -> Self {
        ServerMessage::Text(text)
    }
}

impl<'a> From<&'a str> for ServerMessage {
    fn from(text: &'a str) -> Self {
        ServerMessage::Text(text.to_string())
    }
}

impl ActixMessage for Disconnect {
    type Result = ();
}

// Message from client
#[derive(Debug, Clone)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub msg: ClientMessage,
}

impl ActixMessage for Message {
    type Result = ();
}
