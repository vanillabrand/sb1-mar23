use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use uuid::Uuid;
use chrono::Utc;
use serde_json::Value;
use tracing::{info, warn, error, debug};

use crate::db::SupabaseClient;
use crate::services::{
    trade_service::TradeService,
    exchange_service::ExchangeService,
    deepseek_service::DeepSeekService,
};
use crate::models::{Strategy, Trade};
use crate::error::ApiError;

pub struct TradeProcessor {
    db: Arc<SupabaseClient>,
    trade_service: Arc<TradeService>,
    exchange_service: Arc<ExchangeService>,
    deepseek_service: Arc<DeepSeekService>,
    active_trades: Arc<RwLock<HashMap<Uuid, Trade>>>,
    strategy_budgets: Arc<RwLock<HashMap<Uuid, f64>>>,
    is_running: Arc<RwLock<bool>>,
}

impl TradeProcessor {
    pub fn new(
        db: Arc<SupabaseClient>,
        trade_service: Arc<TradeService>,
        exchange_service: Arc<ExchangeService>,
        deepseek_service: Arc<DeepSeekService>,
    ) -> Self {
        Self {
            db,
            trade_service,
            exchange_service,
            deepseek_service,
            active_trades: Arc::new(RwLock::new(HashMap::new())),
            strategy_budgets: Arc::new(RwLock::new(HashMap::new())),
            is_running: Arc::new(RwLock::new(false)),
        }
    }

    pub async fn start(&self) -> Result<(), ApiError> {
        info!("💰 Starting trade processor...");

        {
            let mut is_running = self.is_running.write().await;
            *is_running = true;
        }

        // Load active trades from database
        self.load_active_trades().await?;

        info!("✅ Trade processor started");
        Ok(())
    }

    pub async fn stop(&self) -> Result<(), ApiError> {
        info!("🛑 Stopping trade processor...");

        {
            let mut is_running = self.is_running.write().await;
            *is_running = false;
        }

        info!("✅ Trade processor stopped");
        Ok(())
    }

    async fn load_active_trades(&self) -> Result<(), ApiError> {
        info!("📊 Loading active trades...");

        // Load open trades from database
        let trades = self.trade_service.get_trades(None, None).await?;

        let mut active_trades = self.active_trades.write().await;
        for trade in trades {
            if trade.status == "open" || trade.status == "pending" {
                active_trades.insert(trade.id, trade);
            }
        }

        info!("📊 Loaded {} active trades", active_trades.len());
        Ok(())
    }

    pub async fn initialize_strategy(&self, strategy: Strategy) -> Result<(), ApiError> {
        info!("🎯 Initializing trade processing for strategy {}", strategy.id);

        // Initialize budget tracking
        {
            let mut budgets = self.strategy_budgets.write().await;
            budgets.insert(strategy.id, strategy.budget);
        }

        debug!("✅ Strategy {} initialized for trade processing", strategy.id);
        Ok(())
    }

    pub async fn cleanup_strategy(&self, strategy_id: Uuid) -> Result<(), ApiError> {
        info!("🧹 Cleaning up trade processing for strategy {}", strategy_id);

        // Remove budget tracking
        {
            let mut budgets = self.strategy_budgets.write().await;
            budgets.remove(&strategy_id);
        }

        // Close any open trades for this strategy
        let mut trades_to_close = Vec::new();
        {
            let active_trades = self.active_trades.read().await;
            for trade in active_trades.values() {
                if trade.strategy_id == strategy_id {
                    trades_to_close.push(trade.id);
                }
            }
        }

        for trade_id in trades_to_close {
            if let Err(e) = self.close_trade(trade_id).await {
                warn!("Failed to close trade {} during strategy cleanup: {}", trade_id, e);
            }
        }

        debug!("✅ Strategy {} cleanup completed", strategy_id);
        Ok(())
    }

    pub async fn generate_trades_for_strategy(&self, strategy: &Strategy) -> Result<(), ApiError> {
        debug!("🎲 Generating trades for strategy {}", strategy.id);

        // Check if strategy is active
        if strategy.status != "active" {
            debug!("Strategy {} is not active, skipping trade generation", strategy.id);
            return Ok(());
        }

        // Check available budget
        let available_budget = self.get_available_budget(strategy.id).await?;
        if available_budget < 10.0 { // Minimum trade size
            debug!("Insufficient budget for strategy {}: ${}", strategy.id, available_budget);
            return Ok(());
        }

        // Get market data for strategy symbols
        let market_data = self.collect_market_data_for_strategy(strategy).await?;

        // Generate trade signals using AI
        let trade_signals = self.generate_trade_signals(strategy, &market_data, available_budget).await?;

        // Process each trade signal
        for signal in trade_signals {
            if let Err(e) = self.process_trade_signal(strategy, signal).await {
                error!("Failed to process trade signal for strategy {}: {}", strategy.id, e);
            }
        }

        debug!("✅ Trade generation completed for strategy {}", strategy.id);
        Ok(())
    }

    async fn get_available_budget(&self, strategy_id: Uuid) -> Result<f64, ApiError> {
        let budgets = self.strategy_budgets.read().await;
        Ok(budgets.get(&strategy_id).copied().unwrap_or(0.0))
    }

    async fn collect_market_data_for_strategy(&self, strategy: &Strategy) -> Result<Value, ApiError> {
        // Collect market data for all symbols in the strategy
        let mut market_data = serde_json::Map::new();

        for symbol in strategy.symbols() {
            // In a real implementation, this would fetch actual market data
            market_data.insert(symbol.clone(), serde_json::json!({
                "price": 50000.0 + (rand::random::<f64>() - 0.5) * 1000.0,
                "volume": 1000000.0,
                "volatility": 0.02,
                "trend": "neutral"
            }));
        }

        Ok(Value::Object(market_data))
    }

    async fn generate_trade_signals(&self, strategy: &Strategy, market_data: &Value, _available_budget: f64) -> Result<Vec<Value>, ApiError> {
        // Use AI service to generate trade signals
        let _signals = self.deepseek_service.generate_trades(&strategy.id.to_string(), market_data.clone()).await?;

        // For now, return mock signals
        Ok(vec![
            serde_json::json!({
                "symbol": "BTC/USDT",
                "side": "buy",
                "amount": 0.001,
                "price": 50000.0,
                "stop_loss": 49000.0,
                "take_profit": 52000.0
            })
        ])
    }

    async fn process_trade_signal(&self, strategy: &Strategy, signal: Value) -> Result<(), ApiError> {
        debug!("📈 Processing trade signal for strategy {}", strategy.id);

        // Extract trade details from signal
        let symbol = signal["symbol"].as_str().unwrap_or("BTC/USDT");
        let side = signal["side"].as_str().unwrap_or("buy");
        let amount = signal["amount"].as_f64().unwrap_or(0.001);
        let price = signal["price"].as_f64();

        // Create trade
        let trade = Trade {
            id: Uuid::new_v4(),
            user_id: strategy.user_id,
            strategy_id: strategy.id,
            symbol: symbol.to_string(),
            side: side.to_string(),
            status: "pending".to_string(),
            amount,
            entry_price: price,
            exit_price: None,
            stop_loss: signal["stop_loss"].as_f64(),
            take_profit: signal["take_profit"].as_f64(),
            trailing_stop: signal["trailing_stop"].as_f64(),
            profit: None,
            market_type: strategy.market_type.clone(),
            leverage: signal["leverage"].as_f64(),
            order_id: None,
            executed_at: None,
            closed_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            timestamp: Utc::now().timestamp_millis(),
            metadata: serde_json::json!({"generated": true}),
        };

        // Validate trade against budget
        let trade_cost = amount * price.unwrap_or(50000.0);
        let available_budget = self.get_available_budget(strategy.id).await?;

        if trade_cost > available_budget {
            warn!("Trade cost ${} exceeds available budget ${} for strategy {}",
                  trade_cost, available_budget, strategy.id);
            return Ok(());
        }

        // Create trade in database
        let created_trade = self.trade_service.create_trade(trade).await?;

        // Add to active trades
        {
            let mut active_trades = self.active_trades.write().await;
            active_trades.insert(created_trade.id, created_trade.clone());
        }

        // Update budget
        self.update_strategy_budget(strategy.id, -trade_cost).await?;

        // Execute trade if conditions are met
        if self.should_execute_immediately(&created_trade, &signal).await? {
            self.execute_trade(created_trade.id).await?;
        }

        info!("✅ Trade signal processed for strategy {}: {} {} {}",
              strategy.id, side, amount, symbol);
        Ok(())
    }

    async fn should_execute_immediately(&self, _trade: &Trade, _signal: &Value) -> Result<bool, ApiError> {
        // Determine if trade should be executed immediately
        // For now, always execute immediately in demo mode
        Ok(true)
    }

    async fn execute_trade(&self, trade_id: Uuid) -> Result<(), ApiError> {
        debug!("⚡ Executing trade {}", trade_id);

        // Execute through trade service
        let executed_trade = self.trade_service.execute_trade(&trade_id.to_string()).await?;

        // Update active trades
        {
            let mut active_trades = self.active_trades.write().await;
            active_trades.insert(trade_id, executed_trade);
        }

        debug!("✅ Trade {} executed", trade_id);
        Ok(())
    }

    async fn close_trade(&self, trade_id: Uuid) -> Result<(), ApiError> {
        debug!("🔒 Closing trade {}", trade_id);

        // Close through trade service
        let closed_trade = self.trade_service.close_trade(&trade_id.to_string()).await?;

        // Remove from active trades
        {
            let mut active_trades = self.active_trades.write().await;
            active_trades.remove(&trade_id);
        }

        // Update budget with profit/loss
        let profit = closed_trade.profit.unwrap_or(0.0);
        self.update_strategy_budget(closed_trade.strategy_id, profit).await?;

        debug!("✅ Trade {} closed with profit: ${}", trade_id, profit);
        Ok(())
    }

    async fn update_strategy_budget(&self, strategy_id: Uuid, amount: f64) -> Result<(), ApiError> {
        let mut budgets = self.strategy_budgets.write().await;
        if let Some(budget) = budgets.get_mut(&strategy_id) {
            *budget += amount;
        }
        Ok(())
    }

    pub async fn monitor_open_trades(&self) -> Result<(), ApiError> {
        debug!("👀 Monitoring open trades...");

        let trades_to_check: Vec<Trade> = {
            let active_trades = self.active_trades.read().await;
            active_trades.values().cloned().collect()
        };

        for trade in trades_to_check {
            if let Err(e) = self.check_trade_conditions(&trade).await {
                error!("Failed to check trade conditions for {}: {}", trade.id, e);
            }
        }

        debug!("✅ Trade monitoring completed");
        Ok(())
    }

    async fn check_trade_conditions(&self, trade: &Trade) -> Result<(), ApiError> {
        // Check if trade should be closed based on conditions
        if self.should_close_trade(trade).await? {
            self.close_trade(trade.id).await?;
        }
        Ok(())
    }

    async fn should_close_trade(&self, _trade: &Trade) -> Result<bool, ApiError> {
        // Implement trade closing logic (stop loss, take profit, etc.)
        // For now, randomly close some trades for demo
        Ok(rand::random::<f64>() < 0.01) // 1% chance to close
    }
}
