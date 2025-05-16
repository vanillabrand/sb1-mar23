use crate::config::CONFIG;
use crate::error::ApiError;
use crate::models::market_data::{Candle, OrderBook, Ticker, Trade as MarketTrade};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    pub symbol: String,
    pub side: String,
    pub type_: String,
    pub price: f64,
    pub amount: f64,
    pub filled: f64,
    pub status: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Balance {
    pub asset: String,
    pub free: f64,
    pub used: f64,
    pub total: f64,
}

pub struct ExchangeService {
    demo_mode: bool,
    active_orders: Mutex<HashMap<String, Order>>,
}

impl ExchangeService {
    pub fn new(demo_mode: bool) -> Self {
        Self {
            demo_mode,
            active_orders: Mutex::new(HashMap::new()),
        }
    }
    
    // Get ticker for a symbol
    pub async fn get_ticker(&self, symbol: &str) -> Result<Ticker, ApiError> {
        if self.demo_mode {
            return self.get_demo_ticker(symbol);
        }
        
        // Normalize symbol format
        let normalized_symbol = self.normalize_symbol(symbol);
        
        // Make API request to exchange
        let url = format!("{}/api/v3/ticker/24hr?symbol={}", CONFIG.binance_base_url, normalized_symbol);
        
        let response = reqwest::get(&url).await?;
        
        if !response.status().is_success() {
            return Err(ApiError::Exchange(format!(
                "Failed to get ticker for {}: {}",
                symbol, response.status()
            )));
        }
        
        let data: serde_json::Value = response.json().await?;
        
        // Parse response
        let ticker = Ticker {
            symbol: symbol.to_string(),
            last: data["lastPrice"].as_str().unwrap_or("0").parse().unwrap_or(0.0),
            bid: data["bidPrice"].as_str().unwrap_or("0").parse().unwrap_or(0.0),
            ask: data["askPrice"].as_str().unwrap_or("0").parse().unwrap_or(0.0),
            high: data["highPrice"].as_str().unwrap_or("0").parse().unwrap_or(0.0),
            low: data["lowPrice"].as_str().unwrap_or("0").parse().unwrap_or(0.0),
            volume: data["volume"].as_str().unwrap_or("0").parse().unwrap_or(0.0),
            timestamp: data["closeTime"].as_i64().unwrap_or(chrono::Utc::now().timestamp_millis()),
        };
        
        Ok(ticker)
    }
    
    // Get candles for a symbol
    pub async fn get_candles(&self, symbol: &str, timeframe: &str, limit: usize) -> Result<Vec<Candle>, ApiError> {
        if self.demo_mode {
            return self.get_demo_candles(symbol, timeframe, limit);
        }
        
        // Normalize symbol format
        let normalized_symbol = self.normalize_symbol(symbol);
        
        // Map timeframe to interval
        let interval = match timeframe {
            "1m" => "1m",
            "5m" => "5m",
            "15m" => "15m",
            "30m" => "30m",
            "1h" => "1h",
            "4h" => "4h",
            "1d" => "1d",
            "1w" => "1w",
            _ => "1h",
        };
        
        // Make API request to exchange
        let url = format!(
            "{}/api/v3/klines?symbol={}&interval={}&limit={}",
            CONFIG.binance_base_url, normalized_symbol, interval, limit
        );
        
        let response = reqwest::get(&url).await?;
        
        if !response.status().is_success() {
            return Err(ApiError::Exchange(format!(
                "Failed to get candles for {}: {}",
                symbol, response.status()
            )));
        }
        
        let data: Vec<Vec<serde_json::Value>> = response.json().await?;
        
        // Parse response
        let mut candles = Vec::new();
        
        for item in data {
            if item.len() < 6 {
                continue;
            }
            
            let candle = Candle {
                symbol: symbol.to_string(),
                timestamp: item[0].as_i64().unwrap_or(0),
                open: item[1].as_str().unwrap_or("0").parse().unwrap_or(0.0),
                high: item[2].as_str().unwrap_or("0").parse().unwrap_or(0.0),
                low: item[3].as_str().unwrap_or("0").parse().unwrap_or(0.0),
                close: item[4].as_str().unwrap_or("0").parse().unwrap_or(0.0),
                volume: item[5].as_str().unwrap_or("0").parse().unwrap_or(0.0),
            };
            
            candles.push(candle);
        }
        
        Ok(candles)
    }
    
    // Get order book for a symbol
    pub async fn get_orderbook(&self, symbol: &str, limit: usize) -> Result<OrderBook, ApiError> {
        if self.demo_mode {
            return self.get_demo_orderbook(symbol, limit);
        }
        
        // Normalize symbol format
        let normalized_symbol = self.normalize_symbol(symbol);
        
        // Make API request to exchange
        let url = format!(
            "{}/api/v3/depth?symbol={}&limit={}",
            CONFIG.binance_base_url, normalized_symbol, limit
        );
        
        let response = reqwest::get(&url).await?;
        
        if !response.status().is_success() {
            return Err(ApiError::Exchange(format!(
                "Failed to get order book for {}: {}",
                symbol, response.status()
            )));
        }
        
        let data: serde_json::Value = response.json().await?;
        
        // Parse response
        let mut bids = Vec::new();
        let mut asks = Vec::new();
        
        if let Some(bids_array) = data["bids"].as_array() {
            for bid in bids_array {
                if let (Some(price), Some(amount)) = (bid[0].as_str(), bid[1].as_str()) {
                    if let (Ok(price), Ok(amount)) = (price.parse::<f64>(), amount.parse::<f64>()) {
                        bids.push((price, amount));
                    }
                }
            }
        }
        
        if let Some(asks_array) = data["asks"].as_array() {
            for ask in asks_array {
                if let (Some(price), Some(amount)) = (ask[0].as_str(), ask[1].as_str()) {
                    if let (Ok(price), Ok(amount)) = (price.parse::<f64>(), amount.parse::<f64>()) {
                        asks.push((price, amount));
                    }
                }
            }
        }
        
        let orderbook = OrderBook {
            symbol: symbol.to_string(),
            timestamp: data["lastUpdateId"].as_i64().unwrap_or(chrono::Utc::now().timestamp_millis()),
            bids,
            asks,
        };
        
        Ok(orderbook)
    }
    
    // Get account balance
    pub async fn get_balance(&self) -> Result<HashMap<String, Balance>, ApiError> {
        if self.demo_mode {
            return self.get_demo_balance();
        }
        
        // In a real implementation, this would make an authenticated API request to the exchange
        Err(ApiError::Exchange("Not implemented for real exchange".to_string()))
    }
    
    // Create an order
    pub async fn create_order(
        &self,
        symbol: &str,
        side: &str,
        amount: f64,
        price: Option<f64>,
        is_futures: bool,
        leverage: Option<f64>,
    ) -> Result<Order, ApiError> {
        if self.demo_mode {
            return self.create_demo_order(symbol, side, amount, price, is_futures, leverage);
        }
        
        // In a real implementation, this would make an authenticated API request to the exchange
        Err(ApiError::Exchange("Not implemented for real exchange".to_string()))
    }
    
    // Cancel an order
    pub async fn cancel_order(&self, symbol: &str, order_id: &str) -> Result<(), ApiError> {
        if self.demo_mode {
            return self.cancel_demo_order(order_id);
        }
        
        // In a real implementation, this would make an authenticated API request to the exchange
        Err(ApiError::Exchange("Not implemented for real exchange".to_string()))
    }
    
    // Get open orders
    pub async fn get_open_orders(&self, symbol: Option<&str>) -> Result<Vec<Order>, ApiError> {
        if self.demo_mode {
            return self.get_demo_open_orders(symbol);
        }
        
        // In a real implementation, this would make an authenticated API request to the exchange
        Err(ApiError::Exchange("Not implemented for real exchange".to_string()))
    }
    
    // Get trades
    pub async fn get_trades(&self, symbol: &str, limit: usize) -> Result<Vec<MarketTrade>, ApiError> {
        if self.demo_mode {
            return self.get_demo_trades(symbol, limit);
        }
        
        // Normalize symbol format
        let normalized_symbol = self.normalize_symbol(symbol);
        
        // Make API request to exchange
        let url = format!(
            "{}/api/v3/trades?symbol={}&limit={}",
            CONFIG.binance_base_url, normalized_symbol, limit
        );
        
        let response = reqwest::get(&url).await?;
        
        if !response.status().is_success() {
            return Err(ApiError::Exchange(format!(
                "Failed to get trades for {}: {}",
                symbol, response.status()
            )));
        }
        
        let data: Vec<serde_json::Value> = response.json().await?;
        
        // Parse response
        let mut trades = Vec::new();
        
        for item in data {
            let price = item["price"].as_str().unwrap_or("0").parse().unwrap_or(0.0);
            let amount = item["qty"].as_str().unwrap_or("0").parse().unwrap_or(0.0);
            
            let trade = MarketTrade {
                symbol: symbol.to_string(),
                id: item["id"].as_i64().unwrap_or(0).to_string(),
                order_id: Some(item["orderId"].as_i64().unwrap_or(0).to_string()),
                price,
                amount,
                cost: price * amount,
                side: if item["isBuyerMaker"].as_bool().unwrap_or(false) { "sell".to_string() } else { "buy".to_string() },
                timestamp: item["time"].as_i64().unwrap_or(chrono::Utc::now().timestamp_millis()),
                fee: None,
            };
            
            trades.push(trade);
        }
        
        Ok(trades)
    }
    
    // Normalize symbol format
    fn normalize_symbol(&self, symbol: &str) -> String {
        symbol.replace("/", "")
    }
    
    // Demo mode implementations
    fn get_demo_ticker(&self, symbol: &str) -> Result<Ticker, ApiError> {
        // Generate random ticker data
        let base_price = self.get_base_price(symbol);
        let variation = base_price * 0.01; // 1% variation
        
        let ticker = Ticker {
            symbol: symbol.to_string(),
            last: base_price + (rand::random::<f64>() * 2.0 - 1.0) * variation,
            bid: base_price - variation / 2.0,
            ask: base_price + variation / 2.0,
            high: base_price + variation,
            low: base_price - variation,
            volume: rand::random::<f64>() * 1000.0 + 100.0,
            timestamp: chrono::Utc::now().timestamp_millis(),
        };
        
        Ok(ticker)
    }
    
    fn get_demo_candles(&self, symbol: &str, timeframe: &str, limit: usize) -> Result<Vec<Candle>, ApiError> {
        let base_price = self.get_base_price(symbol);
        let variation = base_price * 0.05; // 5% variation
        
        let mut candles = Vec::new();
        let now = chrono::Utc::now().timestamp_millis();
        
        // Calculate interval in milliseconds
        let interval = match timeframe {
            "1m" => 60 * 1000,
            "5m" => 5 * 60 * 1000,
            "15m" => 15 * 60 * 1000,
            "30m" => 30 * 60 * 1000,
            "1h" => 60 * 60 * 1000,
            "4h" => 4 * 60 * 60 * 1000,
            "1d" => 24 * 60 * 60 * 1000,
            "1w" => 7 * 24 * 60 * 60 * 1000,
            _ => 60 * 60 * 1000,
        };
        
        let mut current_price = base_price;
        
        for i in 0..limit {
            let timestamp = now - (limit as i64 - i as i64) * interval;
            
            // Generate random price movement
            let price_change = (rand::random::<f64>() * 2.0 - 1.0) * variation / (limit as f64).sqrt();
            current_price += price_change;
            
            // Ensure price doesn't go negative
            if current_price < 0.0 {
                current_price = base_price * 0.1;
            }
            
            // Generate candle
            let open = current_price;
            let close = current_price + (rand::random::<f64>() * 2.0 - 1.0) * variation / (limit as f64).sqrt();
            let high = open.max(close) + rand::random::<f64>() * variation / (limit as f64).sqrt();
            let low = open.min(close) - rand::random::<f64>() * variation / (limit as f64).sqrt();
            
            let candle = Candle {
                symbol: symbol.to_string(),
                timestamp,
                open,
                high,
                low,
                close,
                volume: rand::random::<f64>() * 1000.0 + 100.0,
            };
            
            candles.push(candle);
            
            // Update current price for next candle
            current_price = close;
        }
        
        Ok(candles)
    }
    
    fn get_demo_orderbook(&self, symbol: &str, limit: usize) -> Result<OrderBook, ApiError> {
        let base_price = self.get_base_price(symbol);
        let spread = base_price * 0.001; // 0.1% spread
        
        let mut bids = Vec::new();
        let mut asks = Vec::new();
        
        // Generate bids (buy orders)
        for i in 0..limit {
            let price = base_price - spread - (i as f64) * base_price * 0.0001;
            let amount = rand::random::<f64>() * 10.0 + 0.1;
            bids.push((price, amount));
        }
        
        // Generate asks (sell orders)
        for i in 0..limit {
            let price = base_price + spread + (i as f64) * base_price * 0.0001;
            let amount = rand::random::<f64>() * 10.0 + 0.1;
            asks.push((price, amount));
        }
        
        let orderbook = OrderBook {
            symbol: symbol.to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            bids,
            asks,
        };
        
        Ok(orderbook)
    }
    
    fn get_demo_balance(&self) -> Result<HashMap<String, Balance>, ApiError> {
        let mut balances = HashMap::new();
        
        // Add some common assets
        balances.insert("BTC".to_string(), Balance {
            asset: "BTC".to_string(),
            free: 1.0,
            used: 0.2,
            total: 1.2,
        });
        
        balances.insert("ETH".to_string(), Balance {
            asset: "ETH".to_string(),
            free: 10.0,
            used: 2.0,
            total: 12.0,
        });
        
        balances.insert("USDT".to_string(), Balance {
            asset: "USDT".to_string(),
            free: 10000.0,
            used: 1000.0,
            total: 11000.0,
        });
        
        Ok(balances)
    }
    
    fn create_demo_order(
        &self,
        symbol: &str,
        side: &str,
        amount: f64,
        price: Option<f64>,
        is_futures: bool,
        leverage: Option<f64>,
    ) -> Result<Order, ApiError> {
        let ticker = self.get_demo_ticker(symbol)?;
        
        // Use provided price or current market price
        let order_price = price.unwrap_or_else(|| {
            if side == "buy" {
                ticker.ask
            } else {
                ticker.bid
            }
        });
        
        // Create order
        let order = Order {
            id: Uuid::new_v4().to_string(),
            symbol: symbol.to_string(),
            side: side.to_string(),
            type_: if price.is_some() { "limit".to_string() } else { "market".to_string() },
            price: order_price,
            amount,
            filled: 0.0,
            status: "open".to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
        };
        
        // Store order
        let mut orders = self.active_orders.lock().unwrap();
        orders.insert(order.id.clone(), order.clone());
        
        Ok(order)
    }
    
    fn cancel_demo_order(&self, order_id: &str) -> Result<(), ApiError> {
        let mut orders = self.active_orders.lock().unwrap();
        
        if orders.remove(order_id).is_none() {
            return Err(ApiError::NotFound(format!("Order {} not found", order_id)));
        }
        
        Ok(())
    }
    
    fn get_demo_open_orders(&self, symbol: Option<&str>) -> Result<Vec<Order>, ApiError> {
        let orders = self.active_orders.lock().unwrap();
        
        let mut result = Vec::new();
        
        for (_, order) in orders.iter() {
            if let Some(sym) = symbol {
                if order.symbol != sym {
                    continue;
                }
            }
            
            result.push(order.clone());
        }
        
        Ok(result)
    }
    
    fn get_demo_trades(&self, symbol: &str, limit: usize) -> Result<Vec<MarketTrade>, ApiError> {
        let base_price = self.get_base_price(symbol);
        let variation = base_price * 0.01; // 1% variation
        
        let mut trades = Vec::new();
        let now = chrono::Utc::now().timestamp_millis();
        
        for i in 0..limit {
            let timestamp = now - i as i64 * 1000; // 1 second between trades
            let price = base_price + (rand::random::<f64>() * 2.0 - 1.0) * variation;
            let amount = rand::random::<f64>() * 1.0 + 0.01;
            let side = if rand::random::<f64>() > 0.5 { "buy" } else { "sell" };
            
            let trade = MarketTrade {
                symbol: symbol.to_string(),
                id: (timestamp % 1000000).to_string(),
                order_id: None,
                price,
                amount,
                cost: price * amount,
                side: side.to_string(),
                timestamp,
                fee: None,
            };
            
            trades.push(trade);
        }
        
        Ok(trades)
    }
    
    // Get base price for a symbol
    fn get_base_price(&self, symbol: &str) -> f64 {
        // Return realistic base prices for common symbols
        match symbol {
            "BTC/USDT" => 50000.0,
            "ETH/USDT" => 3000.0,
            "BNB/USDT" => 500.0,
            "SOL/USDT" => 100.0,
            "ADA/USDT" => 0.5,
            "XRP/USDT" => 0.6,
            "DOT/USDT" => 20.0,
            "DOGE/USDT" => 0.1,
            "AVAX/USDT" => 30.0,
            "MATIC/USDT" => 1.0,
            _ => 100.0,
        }
    }
}
