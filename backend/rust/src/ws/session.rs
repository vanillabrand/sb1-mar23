use actix::{Actor, ActorContext, AsyncContext, Handler, StreamHandler};
use actix_web_actors::ws;
use serde_json::Value;
use std::time::{Duration, Instant};

use crate::ws::messages::{ClientMessage, ServerMessage, Connect, Disconnect, Message};
use crate::ws::server::WsServer;

// How often heartbeat pings are sent
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);
// How long before lack of client response causes a timeout
const CLIENT_TIMEOUT: Duration = Duration::from_secs(60);

pub struct WsSession {
    // Client ID
    pub id: String,
    // WebSocket server
    pub server: WsServer,
    // Last heartbeat from client
    pub last_heartbeat: Instant,
    // Client is in demo mode
    pub demo_mode: bool,
    // Subscriptions
    pub subscriptions: Vec<String>,
}

impl WsSession {
    pub fn new(id: String, server: WsServer) -> Self {
        Self {
            id,
            server,
            last_heartbeat: Instant::now(),
            demo_mode: false,
            subscriptions: Vec::new(),
        }
    }
    
    // Start heartbeat process
    fn start_heartbeat(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            // Check if client has responded to the last heartbeat
            if Instant::now().duration_since(act.last_heartbeat) > CLIENT_TIMEOUT {
                tracing::warn!("WebSocket client timeout: {}", act.id);
                
                // Notify server that client has disconnected
                act.server.send(Disconnect {
                    id: act.id.clone(),
                });
                
                // Stop the actor
                ctx.stop();
                return;
            }
            
            // Send ping
            ctx.ping(b"");
        });
    }
}

impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;
    
    fn started(&mut self, ctx: &mut Self::Context) {
        // Start heartbeat process
        self.start_heartbeat(ctx);
        
        // Register with server
        self.server.send(ws::messages::ServerMessage::Connect(Connect {
            id: self.id.clone(),
            addr: ctx.address().recipient(),
        }));
        
        // Send welcome message
        let welcome_msg = ws::messages::ServerMessage::Message(ws::messages::Message {
            id: self.id.clone(),
            msg: ws::messages::ClientMessage {
                type_: "connection".to_string(),
                data: serde_json::json!({
                    "message": "Connected to trading server",
                    "clientId": self.id,
                    "isDemo": self.demo_mode,
            }),
        };
        
        ctx.text(serde_json::to_string(&welcome_msg).unwrap());
    }
    
    fn stopping(&mut self, _: &mut Self::Context) -> actix::Running {
        // Notify server that client has disconnected
        self.server.send(ws::messages::ServerMessage::Disconnect(Disconnect {
            id: self.id.clone(),
        }));
        
        actix::Running::Stop
    }
}

// Handler for WebSocket messages
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                self.last_heartbeat = Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.last_heartbeat = Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                // Parse the message
                match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(client_msg) => {
                        // Handle the message based on its type
                        match client_msg.type_.as_str() {
                            "ping" => {
                                // Respond with pong
                                let pong_msg = ServerMessage {
                                    type_: "pong".to_string(),
                                    data: serde_json::json!({}),
                                };
                                ctx.text(serde_json::to_string(&pong_msg).unwrap());
                            }
                            "subscribe" => {
                                // Handle subscription
                                self.handle_subscription(client_msg.data, ctx);
                            }
                            "unsubscribe" => {
                                // Handle unsubscription
                                self.handle_unsubscription(client_msg.data, ctx);
                            }
                            "demo_mode" => {
                                // Set demo mode
                                if let Some(demo) = client_msg.data.get("enabled") {
                                    if let Some(demo) = demo.as_bool() {
                                        self.demo_mode = demo;
                                        
                                        // Respond with confirmation
                                        let demo_msg = ServerMessage {
                                            type_: "demo_mode".to_string(),
                                            data: serde_json::json!({
                                                "enabled": self.demo_mode,
                                            }),
                                        };
                                        ctx.text(serde_json::to_string(&demo_msg).unwrap());
                                    }
                                }
                            }
                            _ => {
                                // Forward message to server
                                self.server.send(ws::messages::ServerMessage::Message(Message {
                                    id: self.id.clone(),
                                    msg: client_msg,
                                }));
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to parse WebSocket message: {}", e);
                        
                        // Send error message
                        let error_msg = ServerMessage {
                            type_: "error".to_string(),
                            data: serde_json::json!({
                                "message": format!("Failed to parse message: {}", e),
                            }),
                        };
                        ctx.text(serde_json::to_string(&error_msg).unwrap());
                    }
                }
            }
            Ok(ws::Message::Binary(_)) => {
                tracing::warn!("Unexpected binary message from client: {}", self.id);
            }
            Ok(ws::Message::Close(reason)) => {
                tracing::info!("WebSocket closed with reason: {:?}", reason);
                ctx.close(reason);
                ctx.stop();
            }
            _ => {}
        }
    }
}

// Handler for server messages
impl Handler<ServerMessage> for WsSession {
    type Result = ();
    
    fn handle(&mut self, msg: ServerMessage, ctx: &mut Self::Context) {
        // Send message to client
        ctx.text(serde_json::to_string(&msg).unwrap());
    }
}

impl WsSession {
    // Handle subscription request
    fn handle_subscription(&mut self, data: Value, ctx: &mut ws::WebsocketContext<Self>) {
        // Extract subscription data
        let channel = data.get("channel").and_then(|v| v.as_str()).unwrap_or("");
        let strategy_id = data.get("strategyId").and_then(|v| v.as_str()).unwrap_or("");
        let symbols = data.get("symbols").and_then(|v| v.as_array()).unwrap_or(&vec![]);
        
        // Create subscription key
        let subscription_key = match channel {
            "trades" => format!("trades:{}", strategy_id),
            "market" => {
                // Subscribe to each symbol
                for symbol in symbols {
                    if let Some(symbol) = symbol.as_str() {
                        let key = format!("market:{}", symbol);
                        if !self.subscriptions.contains(&key) {
                            self.subscriptions.push(key.clone());
                            
                            // Notify server about the subscription
                            self.server.send(ws::messages::ServerMessage::Message(Message {
                                id: self.id.clone(),
                                msg: ClientMessage {
                                    type_: "subscribe".to_string(),
                                    data: serde_json::json!({
                                        "channel": "market",
                                        "symbol": symbol,
                                    }),
                                },
                            });
                        }
                    }
                }
                return;
            }
            _ => format!("{}:{}", channel, strategy_id),
        };
        
        // Add subscription if not already subscribed
        if !self.subscriptions.contains(&subscription_key) {
            self.subscriptions.push(subscription_key.clone());
            
            // Notify server about the subscription
            self.server.send(ws::messages::ServerMessage::Message(Message {
                id: self.id.clone(),
                msg: ClientMessage {
                    type_: "subscribe".to_string(),
                    data: data.clone(),
                },
            }));
            
            // Send confirmation
            let confirm_msg = ServerMessage {
                type_: "subscription".to_string(),
                data: serde_json::json!({
                    "channel": channel,
                    "strategyId": strategy_id,
                    "status": "subscribed",
                }),
            };
            ctx.text(serde_json::to_string(&confirm_msg).unwrap());
        }
    }
    
    // Handle unsubscription request
    fn handle_unsubscription(&mut self, data: Value, ctx: &mut ws::WebsocketContext<Self>) {
        // Extract subscription data
        let channel = data.get("channel").and_then(|v| v.as_str()).unwrap_or("");
        let strategy_id = data.get("strategyId").and_then(|v| v.as_str()).unwrap_or("");
        
        // Create subscription key
        let subscription_key = format!("{}:{}", channel, strategy_id);
        
        // Remove subscription if subscribed
        if let Some(pos) = self.subscriptions.iter().position(|s| s == &subscription_key) {
            self.subscriptions.remove(pos);
            
            // Notify server about the unsubscription
            self.server.send(ws::messages::ServerMessage::Message(Message {
                id: self.id.clone(),
                msg: ClientMessage {
                    type_: "unsubscribe".to_string(),
                    data: data.clone(),
                },
            }));
            
            // Send confirmation
            let confirm_msg = ServerMessage {
                type_: "subscription".to_string(),
                data: serde_json::json!({
                    "channel": channel,
                    "strategyId": strategy_id,
                    "status": "unsubscribed",
                }),
            };
            ctx.text(serde_json::to_string(&confirm_msg).unwrap());
        }
    }
}
