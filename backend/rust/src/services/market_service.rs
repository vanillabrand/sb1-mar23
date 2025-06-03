use crate::error::ApiError;
use crate::models::market_data::{MarketData, Candle, OrderBook, Ticker, MarketState};
use crate::services::exchange_service::ExchangeService;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

// Cache TTL in seconds
const MARKET_DATA_TTL: u64 = 5;
const CANDLE_TTL: u64 = 60;
const ORDERBOOK_TTL: u64 = 5;
const TICKER_TTL: u64 = 5;
const MARKET_STATE_TTL: u64 = 300;

// Cache entry with expiration
struct CacheEntry<T> {
    data: T,
    expires_at: Instant,
}

impl<T> CacheEntry<T> {
    fn new(data: T, ttl: Duration) -> Self {
        Self {
            data,
            expires_at: Instant::now() + ttl,
        }
    }
    
    fn is_expired(&self) -> bool {
        Instant::now() > self.expires_at
    }
}

pub struct MarketService {
    exchange: Arc<ExchangeService>,
    market_data_cache: RwLock<HashMap<String, CacheEntry<MarketData>>>,
    candle_cache: RwLock<HashMap<String, CacheEntry<Vec<Candle>>>>,
    orderbook_cache: RwLock<HashMap<String, CacheEntry<OrderBook>>>,
    ticker_cache: RwLock<HashMap<String, CacheEntry<Ticker>>>,
    market_state_cache: RwLock<HashMap<String, CacheEntry<MarketState>>>,
}

impl MarketService {
    pub fn new(exchange: Arc<ExchangeService>) -> Self {
        Self {
            exchange,
            market_data_cache: RwLock::new(HashMap::new()),
            candle_cache: RwLock::new(HashMap::new()),
            orderbook_cache: RwLock::new(HashMap::new()),
            ticker_cache: RwLock::new(HashMap::new()),
            market_state_cache: RwLock::new(HashMap::new()),
        }
    }
    
    // Get market data for a symbol
    pub async fn get_market_data(&self, symbol: &str) -> Result<MarketData, ApiError> {
        // Check cache first
        {
            let cache = self.market_data_cache.read().unwrap();
            if let Some(entry) = cache.get(symbol) {
                if !entry.is_expired() {
                    return Ok(entry.data.clone());
                }
            }
        }
        
        // Fetch from exchange
        let ticker = self.exchange.get_ticker(symbol).await?;
        
        // Create market data
        let market_data = MarketData {
            symbol: symbol.to_string(),
            price: ticker.last,
            bid: ticker.bid,
            ask: ticker.ask,
            volume: ticker.volume,
            timestamp: ticker.timestamp as f64,
            high_24h: Some(ticker.high),
            low_24h: Some(ticker.low),
            change_24h: None, // Would need to calculate from 24h open
        };
        
        // Update cache
        {
            let mut cache = self.market_data_cache.write().unwrap();
            cache.insert(
                symbol.to_string(),
                CacheEntry::new(market_data.clone(), Duration::from_secs(MARKET_DATA_TTL)),
            );
        }
        
        Ok(market_data)
    }
    
    // Get all cached market data
    pub fn get_all_market_data(&self) -> HashMap<String, MarketData> {
        let cache = self.market_data_cache.read().unwrap();
        let mut result = HashMap::new();
        
        for (symbol, entry) in cache.iter() {
            if !entry.is_expired() {
                result.insert(symbol.clone(), entry.data.clone());
            }
        }
        
        result
    }
    
    // Get candles for a symbol
    pub async fn get_candles(&self, symbol: &str, timeframe: &str, limit: usize) -> Result<Vec<Candle>, ApiError> {
        let cache_key = format!("{}:{}:{}", symbol, timeframe, limit);
        
        // Check cache first
        {
            let cache = self.candle_cache.read().unwrap();
            if let Some(entry) = cache.get(&cache_key) {
                if !entry.is_expired() {
                    return Ok(entry.data.clone());
                }
            }
        }
        
        // Fetch from exchange
        let candles = self.exchange.get_candles(symbol, timeframe, limit).await?;
        
        // Update cache
        {
            let mut cache = self.candle_cache.write().unwrap();
            cache.insert(
                cache_key,
                CacheEntry::new(candles.clone(), Duration::from_secs(CANDLE_TTL)),
            );
        }
        
        Ok(candles)
    }
    
    // Get order book for a symbol
    pub async fn get_orderbook(&self, symbol: &str, limit: usize) -> Result<OrderBook, ApiError> {
        let cache_key = format!("{}:{}", symbol, limit);
        
        // Check cache first
        {
            let cache = self.orderbook_cache.read().unwrap();
            if let Some(entry) = cache.get(&cache_key) {
                if !entry.is_expired() {
                    return Ok(entry.data.clone());
                }
            }
        }
        
        // Fetch from exchange
        let orderbook = self.exchange.get_orderbook(symbol, limit).await?;
        
        // Update cache
        {
            let mut cache = self.orderbook_cache.write().unwrap();
            cache.insert(
                cache_key,
                CacheEntry::new(orderbook.clone(), Duration::from_secs(ORDERBOOK_TTL)),
            );
        }
        
        Ok(orderbook)
    }
    
    // Get ticker for a symbol
    pub async fn get_ticker(&self, symbol: &str) -> Result<Ticker, ApiError> {
        // Check cache first
        {
            let cache = self.ticker_cache.read().unwrap();
            if let Some(entry) = cache.get(symbol) {
                if !entry.is_expired() {
                    return Ok(entry.data.clone());
                }
            }
        }
        
        // Fetch from exchange
        let ticker = self.exchange.get_ticker(symbol).await?;
        
        // Update cache
        {
            let mut cache = self.ticker_cache.write().unwrap();
            cache.insert(
                symbol.to_string(),
                CacheEntry::new(ticker.clone(), Duration::from_secs(TICKER_TTL)),
            );
        }
        
        Ok(ticker)
    }
    
    // Get market state for a symbol
    pub async fn get_market_state(&self, symbol: &str) -> Result<MarketState, ApiError> {
        // Check cache first
        {
            let cache = self.market_state_cache.read().unwrap();
            if let Some(entry) = cache.get(symbol) {
                if !entry.is_expired() {
                    return Ok(entry.data.clone());
                }
            }
        }
        
        // Calculate market state
        let market_state = self.calculate_market_state(symbol).await?;
        
        // Update cache
        {
            let mut cache = self.market_state_cache.write().unwrap();
            cache.insert(
                symbol.to_string(),
                CacheEntry::new(market_state.clone(), Duration::from_secs(MARKET_STATE_TTL)),
            );
        }
        
        Ok(market_state)
    }
    
    // Calculate market state for a symbol
    async fn calculate_market_state(&self, symbol: &str) -> Result<MarketState, ApiError> {
        // Get candles for different timeframes
        let candles_1h = self.get_candles(symbol, "1h", 24).await?;
        let candles_4h = self.get_candles(symbol, "4h", 24).await?;
        let candles_1d = self.get_candles(symbol, "1d", 7).await?;
        
        // Calculate trend
        let trend = self.calculate_trend(&candles_1h, &candles_4h, &candles_1d);
        
        // Calculate volatility
        let volatility = self.calculate_volatility(&candles_1h);
        
        // Calculate volume change
        let volume_change = self.calculate_volume_change(&candles_1h);
        
        // Calculate support and resistance levels
        let (support_levels, resistance_levels) = self.calculate_support_resistance(&candles_1d);
        
        // Calculate indicators
        let indicators = self.calculate_indicators(&candles_1h, &candles_4h);
        
        // Create market state
        let market_state = MarketState {
            symbol: symbol.to_string(),
            trend,
            volatility,
            volume_change,
            support_levels,
            resistance_levels,
            indicators,
            timestamp: chrono::Utc::now().timestamp(),
        };
        
        Ok(market_state)
    }
    
    // Calculate trend from candles
    fn calculate_trend(&self, candles_1h: &[Candle], candles_4h: &[Candle], candles_1d: &[Candle]) -> String {
        // Simple trend calculation based on moving averages
        if candles_1h.is_empty() || candles_4h.is_empty() || candles_1d.is_empty() {
            return "neutral".to_string();
        }
        
        // Calculate short-term MA (1h)
        let ma_short = candles_1h.iter().map(|c| c.close).sum::<f64>() / candles_1h.len() as f64;
        
        // Calculate medium-term MA (4h)
        let ma_medium = candles_4h.iter().map(|c| c.close).sum::<f64>() / candles_4h.len() as f64;
        
        // Calculate long-term MA (1d)
        let ma_long = candles_1d.iter().map(|c| c.close).sum::<f64>() / candles_1d.len() as f64;
        
        // Determine trend
        if ma_short > ma_medium && ma_medium > ma_long {
            "bullish".to_string()
        } else if ma_short < ma_medium && ma_medium < ma_long {
            "bearish".to_string()
        } else {
            "neutral".to_string()
        }
    }
    
    // Calculate volatility from candles
    fn calculate_volatility(&self, candles: &[Candle]) -> f64 {
        if candles.is_empty() {
            return 0.0;
        }
        
        // Calculate average true range (ATR)
        let mut atr_sum = 0.0;
        let mut prev_close = candles[0].close;
        
        for candle in candles {
            let tr1 = candle.high - candle.low;
            let tr2 = (candle.high - prev_close).abs();
            let tr3 = (candle.low - prev_close).abs();
            
            let true_range = tr1.max(tr2).max(tr3);
            atr_sum += true_range;
            
            prev_close = candle.close;
        }
        
        let atr = atr_sum / candles.len() as f64;
        let avg_price = candles.iter().map(|c| c.close).sum::<f64>() / candles.len() as f64;
        
        // Volatility as percentage of price
        (atr / avg_price) * 100.0
    }
    
    // Calculate volume change from candles
    fn calculate_volume_change(&self, candles: &[Candle]) -> f64 {
        if candles.len() < 2 {
            return 0.0;
        }
        
        // Calculate average volume for first half
        let half_idx = candles.len() / 2;
        let first_half = &candles[0..half_idx];
        let second_half = &candles[half_idx..];
        
        let avg_volume_first = first_half.iter().map(|c| c.volume).sum::<f64>() / first_half.len() as f64;
        let avg_volume_second = second_half.iter().map(|c| c.volume).sum::<f64>() / second_half.len() as f64;
        
        // Calculate percentage change
        ((avg_volume_second - avg_volume_first) / avg_volume_first) * 100.0
    }
    
    // Calculate support and resistance levels
    fn calculate_support_resistance(&self, candles: &[Candle]) -> (Vec<f64>, Vec<f64>) {
        if candles.is_empty() {
            return (vec![], vec![]);
        }
        
        // Find local minima and maxima
        let mut support_levels = Vec::new();
        let mut resistance_levels = Vec::new();
        
        // Simple algorithm to find local minima/maxima
        for i in 1..candles.len() - 1 {
            // Local minimum (support)
            if candles[i].low < candles[i - 1].low && candles[i].low < candles[i + 1].low {
                support_levels.push(candles[i].low);
            }
            
            // Local maximum (resistance)
            if candles[i].high > candles[i - 1].high && candles[i].high > candles[i + 1].high {
                resistance_levels.push(candles[i].high);
            }
        }
        
        // Add current price area
        let current_price = candles.last().unwrap().close;
        
        // Add nearest support below current price
        if let Some(support) = support_levels.iter().filter(|&&s| s < current_price).max_by(|a, b| a.partial_cmp(b).unwrap()) {
            support_levels.push(*support);
        }
        
        // Add nearest resistance above current price
        if let Some(resistance) = resistance_levels.iter().filter(|&&r| r > current_price).min_by(|a, b| a.partial_cmp(b).unwrap()) {
            resistance_levels.push(*resistance);
        }
        
        // Remove duplicates and sort
        support_levels.sort_by(|a, b| a.partial_cmp(b).unwrap());
        support_levels.dedup_by(|a, b| (*a - *b).abs() < 0.001 * *a);
        
        resistance_levels.sort_by(|a, b| a.partial_cmp(b).unwrap());
        resistance_levels.dedup_by(|a, b| (*a - *b).abs() < 0.001 * *a);
        
        (support_levels, resistance_levels)
    }
    
    // Calculate technical indicators
    fn calculate_indicators(&self, candles_1h: &[Candle], candles_4h: &[Candle]) -> serde_json::Value {
        if candles_1h.is_empty() || candles_4h.is_empty() {
            return serde_json::json!({});
        }
        
        // Calculate RSI (14 periods)
        let rsi = self.calculate_rsi(candles_1h, 14);
        
        // Calculate MACD
        let (macd, signal, histogram) = self.calculate_macd(candles_1h);
        
        // Calculate Bollinger Bands
        let (upper_band, middle_band, lower_band) = self.calculate_bollinger_bands(candles_1h, 20, 2.0);
        
        // Return indicators as JSON
        serde_json::json!({
            "rsi": rsi,
            "macd": {
                "macd": macd,
                "signal": signal,
                "histogram": histogram
            },
            "bollinger_bands": {
                "upper": upper_band,
                "middle": middle_band,
                "lower": lower_band
            }
        })
    }
    
    // Calculate RSI
    fn calculate_rsi(&self, candles: &[Candle], periods: usize) -> f64 {
        if candles.len() <= periods {
            return 50.0; // Default neutral value
        }
        
        let mut gains = 0.0;
        let mut losses = 0.0;
        
        // Calculate initial average gain and loss
        for i in 1..=periods {
            let change = candles[i].close - candles[i - 1].close;
            if change >= 0.0 {
                gains += change;
            } else {
                losses -= change; // Make positive
            }
        }
        
        let mut avg_gain = gains / periods as f64;
        let mut avg_loss = losses / periods as f64;
        
        // Calculate RSI for remaining periods
        for i in periods + 1..candles.len() {
            let change = candles[i].close - candles[i - 1].close;
            
            if change >= 0.0 {
                avg_gain = (avg_gain * (periods - 1) as f64 + change) / periods as f64;
                avg_loss = (avg_loss * (periods - 1) as f64) / periods as f64;
            } else {
                avg_gain = (avg_gain * (periods - 1) as f64) / periods as f64;
                avg_loss = (avg_loss * (periods - 1) as f64 - change) / periods as f64;
            }
        }
        
        if avg_loss == 0.0 {
            return 100.0;
        }
        
        let rs = avg_gain / avg_loss;
        100.0 - (100.0 / (1.0 + rs))
    }
    
    // Calculate MACD
    fn calculate_macd(&self, candles: &[Candle]) -> (f64, f64, f64) {
        if candles.len() < 26 {
            return (0.0, 0.0, 0.0);
        }
        
        // Calculate EMA 12
        let ema_12 = self.calculate_ema(candles, 12);
        
        // Calculate EMA 26
        let ema_26 = self.calculate_ema(candles, 26);
        
        // Calculate MACD line
        let macd = ema_12 - ema_26;
        
        // Calculate signal line (EMA 9 of MACD)
        let signal = macd * 0.2 + macd * 0.8; // Simplified EMA calculation
        
        // Calculate histogram
        let histogram = macd - signal;
        
        (macd, signal, histogram)
    }
    
    // Calculate EMA
    fn calculate_ema(&self, candles: &[Candle], periods: usize) -> f64 {
        if candles.len() < periods {
            return candles.last().unwrap().close;
        }
        
        // Calculate SMA for initial value
        let mut sum = 0.0;
        for i in 0..periods {
            sum += candles[i].close;
        }
        let sma = sum / periods as f64;
        
        // Calculate multiplier
        let multiplier = 2.0 / (periods as f64 + 1.0);
        
        // Calculate EMA
        let mut ema = sma;
        for i in periods..candles.len() {
            ema = (candles[i].close - ema) * multiplier + ema;
        }
        
        ema
    }
    
    // Calculate Bollinger Bands
    fn calculate_bollinger_bands(&self, candles: &[Candle], periods: usize, std_dev: f64) -> (f64, f64, f64) {
        if candles.len() < periods {
            let price = candles.last().unwrap().close;
            return (price * 1.02, price, price * 0.98);
        }
        
        // Calculate SMA
        let mut sum = 0.0;
        for i in candles.len() - periods..candles.len() {
            sum += candles[i].close;
        }
        let sma = sum / periods as f64;
        
        // Calculate standard deviation
        let mut variance_sum = 0.0;
        for i in candles.len() - periods..candles.len() {
            variance_sum += (candles[i].close - sma).powi(2);
        }
        let std_deviation = (variance_sum / periods as f64).sqrt();
        
        // Calculate bands
        let upper_band = sma + (std_deviation * std_dev);
        let lower_band = sma - (std_deviation * std_dev);
        
        (upper_band, sma, lower_band)
    }
}
