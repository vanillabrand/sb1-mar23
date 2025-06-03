use actix::{Actor, Context, Handler, Recipient};
use std::collections::{HashMap, HashSet};
use std::sync::RwLock;
use uuid::Uuid;

use crate::ws::messages::{Connect, Disconnect, Message, ServerMessage};

pub struct WsServer {
    // Client sessions
    sessions: RwLock<HashMap<String, Recipient<ServerMessage>>>,
    // Subscriptions: channel -> client_ids
    subscriptions: RwLock<HashMap<String, HashSet<String>>>,
}

impl Clone for WsServer {
    fn clone(&self) -> Self {
        let sessions = self.sessions.read().unwrap().clone();
        let subscriptions = self.subscriptions.read().unwrap().clone();
        
        WsServer {
            sessions: RwLock::new(sessions),
            subscriptions: RwLock::new(subscriptions),
        }
    }
}

impl WsServer {
    pub fn send(&self, msg: ServerMessage) {
        match msg {
            ServerMessage::Connect(Connect { id, addr }) => {
                if let Ok(mut sessions) = self.sessions.write() {
                    sessions.insert(id.clone(), addr);
                }
            },
            ServerMessage::Disconnect(Disconnect { id }) => {
                if let Ok(mut sessions) = self.sessions.write() {
                    sessions.remove(&id);
                }
                self.remove_client_from_all_subscriptions(&id);
            },
            ServerMessage::Message(Message { id, msg }) => {
                if let Ok(sessions) = self.sessions.read() {
                    if let Some(addr) = sessions.get(&id) {
                        let _ = addr.do_send(ServerMessage::Message(Message { id, msg }));
                    }
                }
            },
            ServerMessage::Text(text) => {
                if let Ok(sessions) = self.sessions.read() {
                    for addr in sessions.values() {
                        let _ = addr.do_send(ServerMessage::Text(text.clone()));
                    }
                }
            }
        }
    }
}

impl WsServer {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
            subscriptions: RwLock::new(HashMap::new()),
        }
    }
    
    // Send message to a specific client
    pub fn send_message(&self, client_id: &str, message: ServerMessage) {
        if let Ok(sessions) = self.sessions.read() {
            if let Some(addr) = sessions.get(client_id) {
                let _ = addr.do_send(message);
            }
        }
    }
    
    // Send message to all clients subscribed to a channel
    pub fn broadcast(&self, channel: &str, message: ServerMessage) {
        if let Ok(subscriptions) = self.subscriptions.read() {
            if let Some(clients) = subscriptions.get(channel) {
                for client_id in clients {
                    self.send_message(client_id, message.clone());
                }
            }
        }
    }
    
    // Add client to a subscription
    fn add_subscription(&self, channel: &str, client_id: &str) {
        if let Ok(mut subscriptions) = self.subscriptions.write() {
            let clients = subscriptions.entry(channel.to_string()).or_insert_with(HashSet::new);
            clients.insert(client_id.to_string());
        }
    }
    
    // Remove client from a subscription
    fn remove_subscription(&self, channel: &str, client_id: &str) {
        if let Ok(mut subscriptions) = self.subscriptions.write() {
            if let Some(clients) = subscriptions.get_mut(channel) {
                clients.remove(client_id);
                
                // Remove channel if no clients are subscribed
                if clients.is_empty() {
                    subscriptions.remove(channel);
                }
            }
        }
    }
    
    // Remove client from all subscriptions
    fn remove_client_from_all_subscriptions(&self, client_id: &str) {
        // Collect channels to remove client from
        let channels: Vec<String> = if let Ok(subscriptions) = self.subscriptions.read() {
            subscriptions
                .iter()
                .filter(|(_, clients)| clients.contains(client_id))
                .map(|(channel, _)| channel.clone())
                .collect()
        } else {
            Vec::new()
        };
        
        // Remove client from each channel
        for channel in channels {
            self.remove_subscription(&channel, client_id);
        }
    }
}

impl Actor for WsServer {
    type Context = Context<Self>;
}

// Handler for Connect message
impl Handler<Connect> for WsServer {
    type Result = ();
    
    fn handle(&mut self, msg: Connect, _: &mut Self::Context) {
        // Add client to sessions
        if let Ok(mut sessions) = self.sessions.write() {
            sessions.insert(msg.id.clone(), msg.addr);
        }
        
        tracing::info!("Client connected: {}", msg.id);
    }
}

// Handler for Disconnect message
impl Handler<Disconnect> for WsServer {
    type Result = ();
    
    fn handle(&mut self, msg: Disconnect, _: &mut Self::Context) {
        // Remove client from sessions
        if let Ok(mut sessions) = self.sessions.write() {
            sessions.remove(&msg.id);
        }
        
        // Remove client from all subscriptions
        self.remove_client_from_all_subscriptions(&msg.id);
        
        tracing::info!("Client disconnected: {}", msg.id);
    }
}

// Handler for Message
impl Handler<Message> for WsServer {
    type Result = ();
    
    fn handle(&mut self, msg: Message, _: &mut Self::Context) {
        match msg.msg.type_.as_str() {
            "subscribe" => {
                // Handle subscription
                if let Some(channel) = msg.msg.data.get("channel").and_then(|v| v.as_str()) {
                    let strategy_id = msg.msg.data.get("strategyId").and_then(|v| v.as_str()).unwrap_or("");
                    let subscription_key = format!("{}:{}", channel, strategy_id);
                    
                    // Add client to subscription
                    self.add_subscription(&subscription_key, &msg.id);
                    
                    tracing::info!("Client {} subscribed to {}", msg.id, subscription_key);
                }
            }
            "unsubscribe" => {
                // Handle unsubscription
                if let Some(channel) = msg.msg.data.get("channel").and_then(|v| v.as_str()) {
                    let strategy_id = msg.msg.data.get("strategyId").and_then(|v| v.as_str()).unwrap_or("");
                    let subscription_key = format!("{}:{}", channel, strategy_id);
                    
                    // Remove client from subscription
                    self.remove_subscription(&subscription_key, &msg.id);
                    
                    tracing::info!("Client {} unsubscribed from {}", msg.id, subscription_key);
                }
            }
            _ => {
                // Handle other messages
                tracing::debug!("Received message from client {}: {:?}", msg.id, msg.msg);
            }
        }
    }
}
