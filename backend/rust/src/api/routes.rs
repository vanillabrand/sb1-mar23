use actix_web::web;
use crate::api::handlers::{
    trade_handlers,
    exchange_handlers,
    strategy_handlers,
    market_handlers,
    monitoring_handlers,
};

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            // Health check
            .route("/health", web::get().to(health_check))

            // Strategy routes
            .service(
                web::scope("/strategies")
                    .route("", web::get().to(strategy_handlers::get_strategies))
                    .route("", web::post().to(strategy_handlers::create_strategy))
                    .route("/{id}", web::get().to(strategy_handlers::get_strategy))
                    .route("/{id}", web::put().to(strategy_handlers::update_strategy))
                    .route("/{id}", web::delete().to(strategy_handlers::delete_strategy))
                    .route("/{id}/activate", web::post().to(strategy_handlers::activate_strategy))
                    .route("/{id}/deactivate", web::post().to(strategy_handlers::deactivate_strategy))
                    .route("/{id}/adapt", web::post().to(strategy_handlers::adapt_strategy))
                    .route("/{id}/budget", web::get().to(strategy_handlers::get_strategy_budget))
                    .route("/{id}/budget", web::put().to(strategy_handlers::update_strategy_budget))
            )

            // Trade routes
            .service(
                web::scope("/trades")
                    .route("", web::get().to(trade_handlers::get_trades))
                    .route("", web::post().to(trade_handlers::create_trade))
                    .route("/{id}", web::get().to(trade_handlers::get_trade))
                    .route("/{id}", web::put().to(trade_handlers::update_trade))
                    .route("/{id}", web::delete().to(trade_handlers::delete_trade))
                    .route("/{id}/execute", web::post().to(trade_handlers::execute_trade))
                    .route("/{id}/close", web::post().to(trade_handlers::close_trade))
                    .route("/strategy/{strategy_id}", web::get().to(trade_handlers::get_trades_by_strategy))
                    .route("/strategy/{strategy_id}/generate", web::post().to(trade_handlers::generate_trades))
            )

            // Exchange routes
            .service(
                web::scope("/exchange")
                    .route("/balance", web::get().to(exchange_handlers::get_balance))
                    .route("/order", web::post().to(exchange_handlers::create_order))
                    .route("/order/{id}", web::delete().to(exchange_handlers::cancel_order))
                    .route("/orders", web::get().to(exchange_handlers::get_open_orders))
                    .route("/trades", web::get().to(exchange_handlers::get_trades))
            )

            // Market data routes
            .service(
                web::scope("/market")
                    .route("/data/{symbol}", web::get().to(market_handlers::get_market_data))
                    .route("/candles/{symbol}", web::get().to(market_handlers::get_candles))
                    .route("/tickers", web::get().to(market_handlers::get_tickers))
                    .route("/orderbook/{symbol}", web::get().to(market_handlers::get_orderbook))
            )

            // Monitoring routes
            .service(
                web::scope("/monitoring")
                    .route("/strategies/{id}", web::get().to(monitoring_handlers::get_strategy_monitoring_status))
                    .route("/strategies", web::get().to(monitoring_handlers::get_all_monitoring_statuses))
                    .route("/system", web::get().to(monitoring_handlers::get_system_status))
                    .route("/metrics", web::get().to(monitoring_handlers::get_performance_metrics))
                    .route("/alerts", web::get().to(monitoring_handlers::get_alerts))
            )
    );
}

// Health check handler
async fn health_check() -> actix_web::HttpResponse {
    actix_web::HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}
