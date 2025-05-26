mod api;
mod db;
mod models;
mod services;
mod ws;
mod config;
mod error;
mod background;

use actix_web::{middleware, web, App, HttpServer, HttpResponse, Result};
use actix_web_prom::PrometheusMetricsBuilder;
use dotenv::dotenv;
use std::env;
use std::sync::Arc;
use tracing::{info, warn, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// Import middleware
use api::middleware::{
    cors::create_cors,
    // rate_limit::{create_rate_limiter, RateLimitMiddlewareFactory},
    // logging::LoggingMiddlewareFactory,
    // AuthMiddlewareFactory,
};

// Import services
use services::{
    deepseek_service::DeepSeekService,
    exchange_service::ExchangeService,
    strategy_service::StrategyService,
    trade_service::TradeService,
};

// Import background processing
use background::BackgroundProcessor;

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

    info!("🚀 Starting Trading API Server");

    // Initialize metrics
    let prometheus = PrometheusMetricsBuilder::new("trading_api")
        .endpoint("/metrics")
        .build()
        .unwrap();

    // Initialize database connection (with fallback for demo)
    let db_client = match db::supabase::init_db_pool().await {
        Ok(client) => {
            info!("✅ Database connection established");
            // Perform health check
            if let Err(e) = client.health_check().await {
                warn!("Database health check failed: {}", e);
            }
            Arc::new(client)
        }
        Err(e) => {
            warn!("⚠️ Database connection failed: {}, using mock client", e);
            Arc::new(db::supabase::SupabaseClient::default())
        }
    };

    // Initialize services
    info!("🔧 Initializing services...");

    let deepseek_service = Arc::new(
        DeepSeekService::new(&*config::CONFIG).unwrap_or_else(|e| {
            warn!("Failed to initialize DeepSeek service: {}, using default", e);
            DeepSeekService::default()
        })
    );
    let exchange_service = Arc::new(ExchangeService::new());

    let strategy_service = Arc::new(StrategyService::new(
        db_client.clone(),
        deepseek_service.clone(),
    ));

    let trade_service = Arc::new(TradeService::new(
        db_client.clone(),
        exchange_service.clone(),
    ));

    // Initialize background processor
    info!("🔄 Initializing background processor...");
    let background_processor = Arc::new(BackgroundProcessor::new(
        db_client.clone(),
        strategy_service.clone(),
        trade_service.clone(),
        exchange_service.clone(),
        deepseek_service.clone(),
    ));

    // Start background processing
    if let Err(e) = background_processor.start().await {
        warn!("Failed to start background processor: {}", e);
    } else {
        info!("✅ Background processor started successfully");
    }

    // Initialize rate limiter
    // let rate_limiter = create_rate_limiter();

    // Get server configuration
    let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .expect("Invalid PORT");

    let workers = env::var("WORKERS")
        .unwrap_or_else(|_| "4".to_string())
        .parse::<usize>()
        .unwrap_or(4);

    info!("🌐 Starting server at http://{}:{} with {} workers", host, port, workers);

    // Health check endpoint
    async fn health_check() -> Result<HttpResponse> {
        Ok(HttpResponse::Ok().json(serde_json::json!({
            "status": "healthy",
            "timestamp": chrono::Utc::now().timestamp(),
            "version": env!("CARGO_PKG_VERSION"),
            "service": "trading-api"
        })))
    }

    // Start HTTP server
    HttpServer::new(move || {
        App::new()
            // Add prometheus metrics (first to capture all requests)
            .wrap(prometheus.clone())

            // Add custom middleware (temporarily disabled)
            // .wrap(LoggingMiddlewareFactory)
            // .wrap(RateLimitMiddlewareFactory::new(rate_limiter.clone()))
            // .wrap(AuthMiddlewareFactory)

            // Add built-in middleware
            .wrap(middleware::Compress::default())
            .wrap(middleware::DefaultHeaders::new()
                .add(("X-Version", env!("CARGO_PKG_VERSION")))
                .add(("X-Service", "trading-api"))
            )
            .wrap(create_cors())

            // Add shared application data
            .app_data(web::Data::new(db_client.clone()))
            .app_data(web::Data::new(strategy_service.clone()))
            .app_data(web::Data::new(trade_service.clone()))
            .app_data(web::Data::new(exchange_service.clone()))
            .app_data(web::Data::new(deepseek_service.clone()))
            .app_data(web::Data::new(background_processor.clone()))

            // Health check endpoint (no auth required)
            .route("/health", web::get().to(health_check))

            // Register API routes
            .configure(api::routes::configure)

            // Register WebSocket routes
            .configure(ws::routes::configure)
    })
    .workers(workers)
    .bind((host, port))?
    .run()
    .await
}
