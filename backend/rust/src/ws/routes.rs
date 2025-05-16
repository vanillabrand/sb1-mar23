use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use uuid::Uuid;

use crate::ws::session::WsSession;
use crate::ws::server::WsServer;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/ws")
            .route(web::get().to(ws_index))
    );
    
    cfg.service(
        web::resource("/ws/{client_id}")
            .route(web::get().to(ws_client))
    );
}

async fn ws_index(
    req: HttpRequest,
    stream: web::Payload,
    srv: web::Data<WsServer>,
) -> Result<HttpResponse, Error> {
    // Generate a new client ID
    let client_id = Uuid::new_v4().to_string();
    
    // Create a new WebSocket session
    let session = WsSession::new(client_id.clone(), srv.get_ref().clone());
    
    // Start the WebSocket connection
    let resp = ws::start(session, &req, stream)?;
    
    Ok(resp)
}

async fn ws_client(
    req: HttpRequest,
    stream: web::Payload,
    path: web::Path<String>,
    srv: web::Data<WsServer>,
) -> Result<HttpResponse, Error> {
    // Get the client ID from the path
    let client_id = path.into_inner();
    
    // Create a new WebSocket session
    let session = WsSession::new(client_id, srv.get_ref().clone());
    
    // Start the WebSocket connection
    let resp = ws::start(session, &req, stream)?;
    
    Ok(resp)
}
