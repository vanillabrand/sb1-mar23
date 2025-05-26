use actix_web::{web, App, HttpServer, HttpResponse, Result};
use serde_json::json;

async fn health() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "Simple Rust API is running!",
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

async fn hello() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "message": "Hello from Rust Trading API!",
        "version": "1.0.0"
    })))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Starting simple Rust API server...");
    
    HttpServer::new(|| {
        App::new()
            .route("/health", web::get().to(health))
            .route("/hello", web::get().to(hello))
            .route("/api/health", web::get().to(health))
            .route("/api/hello", web::get().to(hello))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
