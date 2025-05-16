mod api;
mod db;
mod models;
mod services;
mod ws;
mod config;
mod error;

use actix_cors::Cors;
use actix_web::{middleware, web, App, HttpServer};
use actix_web_prom::PrometheusMetricsBuilder;
use dotenv::dotenv;
use std::env;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables
    dotenv().ok();
    
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();
    
    // Initialize metrics
    let prometheus = PrometheusMetricsBuilder::new("api")
        .endpoint("/metrics")
        .build()
        .unwrap();
    
    // Initialize database connection
    let db_pool = db::init_db_pool().await.expect("Failed to initialize database connection");
    
    // Get server configuration
    let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string()).parse::<u16>().expect("Invalid PORT");
    
    tracing::info!("Starting server at http://{}:{}", host, port);
    
    // Start HTTP server
    HttpServer::new(move || {
        // Configure CORS
        let cors = Cors::default()
            .allowed_origin_fn(|origin, _req_head| {
                let origin = origin.as_bytes();
                let allowed_origins = env::var("ALLOWED_ORIGINS").unwrap_or_else(|_| "http://localhost:5173,http://127.0.0.1:5173".to_string());
                allowed_origins.split(',').any(|allowed| origin == allowed.as_bytes())
            })
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec!["Authorization", "Content-Type"])
            .supports_credentials()
            .max_age(3600);
        
        App::new()
            // Add prometheus metrics
            .wrap(prometheus.clone())
            // Add middleware
            .wrap(middleware::Logger::default())
            .wrap(middleware::Compress::default())
            .wrap(cors)
            // Add database connection pool
            .app_data(web::Data::new(db_pool.clone()))
            // Register API routes
            .configure(api::routes::configure)
            // Register WebSocket routes
            .configure(ws::routes::configure)
    })
    .bind((host, port))?
    .run()
    .await
}
