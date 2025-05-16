use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketData {
    pub symbol: String,
    pub price: f64,
    pub bid: f64,
    pub ask: f64,
    pub volume: f64,
    pub timestamp: f64,
    pub high_24h: Option<f64>,
    pub low_24h: Option<f64>,
    pub change_24h: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candle {
    pub symbol: String,
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBook {
    pub symbol: String,
    pub timestamp: i64,
    pub bids: Vec<(f64, f64)>, // (price, amount)
    pub asks: Vec<(f64, f64)>, // (price, amount)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ticker {
    pub symbol: String,
    pub last: f64,
    pub bid: f64,
    pub ask: f64,
    pub high: f64,
    pub low: f64,
    pub volume: f64,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub symbol: String,
    pub id: String,
    pub order_id: Option<String>,
    pub price: f64,
    pub amount: f64,
    pub cost: f64,
    pub side: String,
    pub timestamp: i64,
    pub fee: Option<Fee>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fee {
    pub cost: f64,
    pub currency: String,
    pub rate: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketState {
    pub symbol: String,
    pub trend: String,
    pub volatility: f64,
    pub volume_change: f64,
    pub support_levels: Vec<f64>,
    pub resistance_levels: Vec<f64>,
    pub indicators: serde_json::Value,
    pub timestamp: i64,
}
