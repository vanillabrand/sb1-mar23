use actix::{Actor, ActorContext, AsyncContext, StreamHandler};
use actix_web_actors::ws;
use std::time::{Duration, Instant};
use crate::ws::messages::WsMessage;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

pub struct WsSession {
    hb: Instant,
}

impl WsSession {
    pub fn new() -> Self {
        Self { hb: Instant::now() }
    }

    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                println!("WebSocket Client heartbeat failed, disconnecting!");
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }
}

impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.hb(ctx);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                let text = text.trim();
                if let Ok(message) = serde_json::from_str::<WsMessage>(text) {
                    match message.message_type.as_str() {
                        "subscribe" => {
                            ctx.text(serde_json::to_string(&WsMessage {
                                message_type: "subscribed".to_string(),
                                data: serde_json::json!({"status": "success"}),
                            }).unwrap_or_default());
                        }
                        "unsubscribe" => {
                            ctx.text(serde_json::to_string(&WsMessage {
                                message_type: "unsubscribed".to_string(),
                                data: serde_json::json!({"status": "success"}),
                            }).unwrap_or_default());
                        }
                        _ => {
                            ctx.text(serde_json::to_string(&WsMessage {
                                message_type: "error".to_string(),
                                data: serde_json::json!({"error": "Unknown message type"}),
                            }).unwrap_or_default());
                        }
                    }
                }
            }
            Ok(ws::Message::Binary(bin)) => ctx.binary(bin),
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => ctx.stop(),
        }
    }
}
