use actix_web::{web, HttpRequest, HttpResponse, Result};
use actix_web_actors::ws;
use crate::ws::session::WsSession;

pub async fn websocket_handler(req: HttpRequest, stream: web::Payload) -> Result<HttpResponse> {
    ws::start(WsSession::new(), &req, stream)
}

pub fn configure_ws_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/ws", web::get().to(websocket_handler));
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    configure_ws_routes(cfg);
}
