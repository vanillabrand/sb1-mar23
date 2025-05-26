pub mod monitor;
pub mod scheduler;
pub mod trade_processor;

use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use uuid::Uuid;
use crate::db::SupabaseClient;
use crate::services::{
    strategy_service::StrategyService,
    trade_service::TradeService,
    exchange_service::ExchangeService,
    deepseek_service::DeepSeekService,
};
use crate::error::ApiError;
use tracing::{info, warn, error};

pub struct BackgroundProcessor {
    db: Arc<SupabaseClient>,
    strategy_service: Arc<StrategyService>,
    trade_service: Arc<TradeService>,
    exchange_service: Arc<ExchangeService>,
    deepseek_service: Arc<DeepSeekService>,
    active_strategies: Arc<RwLock<HashMap<Uuid, crate::models::Strategy>>>,
    monitor: Arc<monitor::StrategyMonitor>,
    scheduler: Arc<scheduler::TaskScheduler>,
    trade_processor: Arc<trade_processor::TradeProcessor>,
}

impl BackgroundProcessor {
    pub fn new(
        db: Arc<SupabaseClient>,
        strategy_service: Arc<StrategyService>,
        trade_service: Arc<TradeService>,
        exchange_service: Arc<ExchangeService>,
        deepseek_service: Arc<DeepSeekService>,
    ) -> Self {
        let active_strategies = Arc::new(RwLock::new(HashMap::new()));

        let monitor = Arc::new(monitor::StrategyMonitor::new(
            db.clone(),
            strategy_service.clone(),
            active_strategies.clone(),
        ));

        let scheduler = Arc::new(scheduler::TaskScheduler::new());

        let trade_processor = Arc::new(trade_processor::TradeProcessor::new(
            db.clone(),
            trade_service.clone(),
            exchange_service.clone(),
            deepseek_service.clone(),
        ));

        Self {
            db,
            strategy_service,
            trade_service,
            exchange_service,
            deepseek_service,
            active_strategies,
            monitor,
            scheduler,
            trade_processor,
        }
    }

    pub async fn start(&self) -> Result<(), ApiError> {
        info!("🔄 Starting background processor...");

        // Load active strategies from database
        self.load_active_strategies().await?;

        // Start strategy monitoring
        self.monitor.start().await?;

        // Start scheduled tasks
        self.scheduler.start().await?;

        // Start trade processing
        self.trade_processor.start().await?;

        // Schedule periodic tasks
        self.schedule_periodic_tasks().await?;

        info!("✅ Background processor started successfully");
        Ok(())
    }

    async fn load_active_strategies(&self) -> Result<(), ApiError> {
        info!("📊 Loading active strategies...");

        // For background processing, we'll skip loading strategies at startup
        // since we don't have a user context. Strategies will be loaded when
        // users authenticate and activate them through the API.
        info!("📊 Background processor initialized - strategies will be loaded when users authenticate");
        Ok(())
    }

    async fn schedule_periodic_tasks(&self) -> Result<(), ApiError> {
        // For now, just log that we would schedule tasks
        // In a real implementation, we'd use a proper task scheduler
        info!("⏰ Background tasks would be scheduled here");
        Ok(())
    }

    pub async fn add_strategy(&self, strategy: crate::models::Strategy) -> Result<(), ApiError> {
        info!("➕ Adding strategy {} to background processing", strategy.id);

        // Add to active strategies
        {
            let mut active_strategies = self.active_strategies.write().await;
            active_strategies.insert(strategy.id, strategy.clone());
        }

        // Add to monitor
        self.monitor.add_strategy(strategy.clone()).await?;

        // Initialize trade processing for this strategy
        self.trade_processor.initialize_strategy(strategy.clone()).await?;

        info!("✅ Strategy {} added to background processing", strategy.id);
        Ok(())
    }

    pub async fn remove_strategy(&self, strategy_id: Uuid) -> Result<(), ApiError> {
        info!("➖ Removing strategy {} from background processing", strategy_id);

        // Remove from active strategies
        {
            let mut active_strategies = self.active_strategies.write().await;
            active_strategies.remove(&strategy_id);
        }

        // Remove from monitor
        self.monitor.remove_strategy(strategy_id).await?;

        // Clean up trade processing
        self.trade_processor.cleanup_strategy(strategy_id).await?;

        info!("✅ Strategy {} removed from background processing", strategy_id);
        Ok(())
    }

    pub async fn get_strategy_status(&self, strategy_id: Uuid) -> Option<crate::models::MonitoringStatus> {
        self.monitor.get_strategy_status(strategy_id).await
    }

    pub async fn get_all_strategy_statuses(&self) -> HashMap<Uuid, crate::models::MonitoringStatus> {
        self.monitor.get_all_statuses().await
    }

    pub async fn stop(&self) -> Result<(), ApiError> {
        info!("🛑 Stopping background processor...");

        self.scheduler.stop().await?;
        self.monitor.stop().await?;
        self.trade_processor.stop().await?;

        info!("✅ Background processor stopped");
        Ok(())
    }
}
