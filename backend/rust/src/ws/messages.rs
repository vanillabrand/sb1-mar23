use actix::{Actor, Context, Handler, Message as ActixMessage, Recipient};
use serde::{Deserialize, Serialize};
use serde_json::Value;

trait RecipientExt {
    fn dummy() -> Recipient<ServerMessage>;
}

impl RecipientExt for Recipient<ServerMessage> {
    fn dummy() -> Recipient<ServerMessage> {
        struct DummyActor;
        impl Actor for DummyActor {
            type Context = Context<Self>;
        }

        impl Handler<ServerMessage> for DummyActor {
            type Result = ();

            fn handle(&mut self, _msg: ServerMessage, _ctx: &mut Context<Self>) -> Self::Result {
                // No-op
            }
        }

        Recipient::from(DummyActor.start().recipient())
    }
}

// Message from client to server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientMessage {
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(default)]
    pub data: Value,
}

// Message from server to client
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
            ServerMessage::Text(t) => serializer.serialize_str(t),
        }
    }
}

impl<'de> Deserialize<'de> for ServerMessage {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        // Implement deserialization logic here
        unimplemented!("Deserialization for ServerMessage not yet implemented")
    }
}


impl ActixMessage for ServerMessage {
    type Result = ();
}

// Connect message
#[derive(Debug, Clone, Serialize)]
pub struct Connect {
    pub id: String,
    #[serde(skip)]
    pub addr: Recipient<ServerMessage>,
}

impl<'de> Deserialize<'de> for Connect {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct ConnectDTO {
            id: String,
        }

        let dto = ConnectDTO::deserialize(deserializer)?;
        Ok(Connect {
            id: dto.id,
            addr: Recipient::dummy(), // Use dummy recipient instead
        })
    }
}

impl ActixMessage for Connect {
    type Result = ();
}

// Disconnect message
#[derive(Debug, Clone)]
pub struct Disconnect {
    pub id: String,
}

impl Serialize for Disconnect {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.id)
    }
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
pub struct Message {
    pub id: String,
    pub msg: ClientMessage,
}

impl Serialize for Message {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("Message", 2)?;
        state.serialize_field("id", &self.id)?;
        state.serialize_field("msg", &self.msg)?;
        state.end()
    }
}

impl<'de> Deserialize<'de> for Message {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct MessageHelper {
            id: String,
            msg: ClientMessage,
        }
        let helper = MessageHelper::deserialize(deserializer)?;
        Ok(Message {
            id: helper.id,
            msg: helper.msg,
        })
    }
}

impl ActixMessage for Message {
    type Result = ();
}
