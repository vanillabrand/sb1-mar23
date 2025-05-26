use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::error::ApiError;
use crate::api::middleware::extract_user_id;

#[derive(Debug, Serialize, Deserialize)]
pub struct MarketData {
    pub symbol: String,
    pub price: f64,
    pub bid: f64,
    pub ask: f64,
    pub high24h: f64,
    pub low24h: f64,
    pub volume24h: f64,
    pub change24h: f64,
    pub last_update: i64,
    pub source: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Candle {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

// Get market data for a symbol
pub async fn get_market_data(
    path: web::Path<String>,
    req: HttpRequest,
) -> Result<HttpResponse, ApiError> {
    let symbol = path.into_inner();
    let _user_id = extract_user_id(&req)?;

    // Mock market data
    let base_price = match symbol.as_str() {
        "BTC/USDT" => 50000.0,
        "ETH/USDT" => 3200.0,
        "ADA/USDT" => 0.45,
        "SOL/USDT" => 120.0,
        _ => 100.0,
    };

    let market_data = MarketData {
        symbol: symbol.clone(),
        price: base_price + (rand::random::<f64>() - 0.5) * base_price * 0.02,
        bid: base_price * 0.999,
        ask: base_price * 1.001,
        high24h: base_price * 1.05,
        low24h: base_price * 0.95,
        volume24h: 1000000.0 + rand::random::<f64>() * 500000.0,
        change24h: (rand::random::<f64>() - 0.5) * 0.1,
        last_update: chrono::Utc::now().timestamp(),
        source: "binance".to_string(),
    };

    Ok(HttpResponse::Ok().json(market_data))
}

// Get candles for a symbol
pub async fn get_candles(
    path: web::Path<String>,
    query: web::Query<CandleQuery>,
    req: HttpRequest,
) -> Result<HttpResponse, ApiError> {
    let symbol = path.into_inner();
    let _user_id = extract_user_id(&req)?;

    let timeframe = query.timeframe.as_deref().unwrap_or("1h");
    let limit = query.limit.unwrap_or(100).min(1000);

    // Generate mock candle data
    let mut candles = Vec::new();
    let base_price = match symbol.as_str() {
        "BTC/USDT" => 50000.0,
        "ETH/USDT" => 3200.0,
        "ADA/USDT" => 0.45,
        "SOL/USDT" => 120.0,
        _ => 100.0,
    };

    let interval_seconds = match timeframe {
        "1m" => 60,
        "5m" => 300,
        "15m" => 900,
        "30m" => 1800,
        "1h" => 3600,
        "4h" => 14400,
        "1d" => 86400,
        _ => 3600,
    };

    let now = chrono::Utc::now().timestamp();
    
    for i in 0..limit {
        let timestamp = now - (i as i64 * interval_seconds);
        let price_variation = (rand::random::<f64>() - 0.5) * base_price * 0.02;
        let open = base_price + price_variation;
        let close = open + (rand::random::<f64>() - 0.5) * base_price * 0.01;
        let high = open.max(close) + rand::random::<f64>() * base_price * 0.005;
        let low = open.min(close) - rand::random::<f64>() * base_price * 0.005;
        let volume = 1000.0 + rand::random::<f64>() * 5000.0;

        candles.push(Candle {
            timestamp,
            open,
            high,
            low,
            close,
            volume,
        });
    }

    // Reverse to get chronological order
    candles.reverse();

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "symbol": symbol,
        "timeframe": timeframe,
        "candles": candles
    })))
}

// Get ticker data for multiple symbols
pub async fn get_tickers(
    query: web::Query<TickerQuery>,
    req: HttpRequest,
) -> Result<HttpResponse, ApiError> {
    let _user_id = extract_user_id(&req)?;

    let symbols = query.symbols.as_deref().unwrap_or("BTC/USDT,ETH/USDT,ADA/USDT");
    let symbol_list: Vec<&str> = symbols.split(',').collect();

    let mut tickers = Vec::new();

    for symbol in symbol_list {
        let base_price = match symbol {
            "BTC/USDT" => 50000.0,
            "ETH/USDT" => 3200.0,
            "ADA/USDT" => 0.45,
            "SOL/USDT" => 120.0,
            _ => 100.0,
        };

        tickers.push(serde_json::json!({
            "symbol": symbol,
            "price": base_price + (rand::random::<f64>() - 0.5) * base_price * 0.02,
            "change24h": (rand::random::<f64>() - 0.5) * 0.1,
            "volume24h": 1000000.0 + rand::random::<f64>() * 500000.0,
            "timestamp": chrono::Utc::now().timestamp()
        }));
    }

    Ok(HttpResponse::Ok().json(tickers))
}

// Get order book for a symbol
pub async fn get_orderbook(
    path: web::Path<String>,
    query: web::Query<OrderbookQuery>,
    req: HttpRequest,
) -> Result<HttpResponse, ApiError> {
    let symbol = path.into_inner();
    let _user_id = extract_user_id(&req)?;

    let limit = query.limit.unwrap_or(20).min(100);

    let base_price = match symbol.as_str() {
        "BTC/USDT" => 50000.0,
        "ETH/USDT" => 3200.0,
        "ADA/USDT" => 0.45,
        "SOL/USDT" => 120.0,
        _ => 100.0,
    };

    // Generate mock order book
    let mut bids = Vec::new();
    let mut asks = Vec::new();

    for i in 0..limit {
        let bid_price = base_price - (i as f64 * base_price * 0.0001);
        let ask_price = base_price + (i as f64 * base_price * 0.0001);
        let quantity = 1.0 + rand::random::<f64>() * 10.0;

        bids.push([bid_price, quantity]);
        asks.push([ask_price, quantity]);
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "symbol": symbol,
        "bids": bids,
        "asks": asks,
        "timestamp": chrono::Utc::now().timestamp()
    })))
}

#[derive(Debug, Deserialize)]
pub struct CandleQuery {
    pub timeframe: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct TickerQuery {
    pub symbols: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OrderbookQuery {
    pub limit: Option<usize>,
}
