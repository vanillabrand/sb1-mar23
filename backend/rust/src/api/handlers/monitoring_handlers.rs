use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::ApiError;
use crate::api::middleware::extract_user_id;
use crate::background::BackgroundProcessor;

#[derive(Debug, Serialize, Deserialize)]
pub struct MonitoringStatusResponse {
    pub strategy_id: String,
    pub status: String,
    pub last_check: String,
    pub next_check: String,
    pub error_count: i32,
    pub last_error: Option<String>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemStatusResponse {
    pub status: String,
    pub uptime: u64,
    pub active_strategies: usize,
    pub active_trades: usize,
    pub background_tasks: Vec<TaskStatusResponse>,
    pub memory_usage: f64,
    pub cpu_usage: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskStatusResponse {
    pub id: String,
    pub name: String,
    pub is_running: bool,
    pub last_run: Option<String>,
    pub next_run: String,
    pub run_count: u64,
    pub error_count: u64,
}

// Get monitoring status for a specific strategy
pub async fn get_strategy_monitoring_status(
    path: web::Path<String>,
    req: HttpRequest,
    background_processor: web::Data<BackgroundProcessor>,
) -> Result<HttpResponse, ApiError> {
    let strategy_id = path.into_inner();
    let _user_id = extract_user_id(&req)?;

    let strategy_uuid = Uuid::parse_str(&strategy_id)
        .map_err(|_| ApiError::Validation("Invalid strategy ID".to_string()))?;

    if let Some(status) = background_processor.get_strategy_status(strategy_uuid).await {
        let response = MonitoringStatusResponse {
            strategy_id: status.strategy_id.to_string(),
            status: status.status,
            last_check: status.last_check.to_rfc3339(),
            next_check: status.next_check.to_rfc3339(),
            error_count: status.error_count,
            last_error: status.last_error,
            metadata: status.metadata,
        };

        Ok(HttpResponse::Ok().json(response))
    } else {
        Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Strategy not found in monitoring system",
            "strategy_id": strategy_id
        })))
    }
}

// Get monitoring status for all strategies
pub async fn get_all_monitoring_statuses(
    req: HttpRequest,
    background_processor: web::Data<BackgroundProcessor>,
) -> Result<HttpResponse, ApiError> {
    let _user_id = extract_user_id(&req)?;

    let statuses = background_processor.get_all_strategy_statuses().await;
    
    let response: Vec<MonitoringStatusResponse> = statuses
        .into_iter()
        .map(|(_, status)| MonitoringStatusResponse {
            strategy_id: status.strategy_id.to_string(),
            status: status.status,
            last_check: status.last_check.to_rfc3339(),
            next_check: status.next_check.to_rfc3339(),
            error_count: status.error_count,
            last_error: status.last_error,
            metadata: status.metadata,
        })
        .collect();

    Ok(HttpResponse::Ok().json(response))
}

// Get system status
pub async fn get_system_status(
    req: HttpRequest,
    background_processor: web::Data<BackgroundProcessor>,
) -> Result<HttpResponse, ApiError> {
    let _user_id = extract_user_id(&req)?;

    // Get system metrics
    let statuses = background_processor.get_all_strategy_statuses().await;
    let active_strategies = statuses.len();

    // Mock system metrics (in a real implementation, you'd collect actual metrics)
    let response = SystemStatusResponse {
        status: "healthy".to_string(),
        uptime: 3600, // 1 hour in seconds
        active_strategies,
        active_trades: 15, // Mock value
        background_tasks: vec![
            TaskStatusResponse {
                id: "strategy_evaluation".to_string(),
                name: "Strategy Evaluation".to_string(),
                is_running: false,
                last_run: Some(chrono::Utc::now().to_rfc3339()),
                next_run: (chrono::Utc::now() + chrono::Duration::minutes(1)).to_rfc3339(),
                run_count: 120,
                error_count: 0,
            },
            TaskStatusResponse {
                id: "trade_generation".to_string(),
                name: "Trade Generation".to_string(),
                is_running: false,
                last_run: Some(chrono::Utc::now().to_rfc3339()),
                next_run: (chrono::Utc::now() + chrono::Duration::minutes(5)).to_rfc3339(),
                run_count: 24,
                error_count: 1,
            },
            TaskStatusResponse {
                id: "trade_monitoring".to_string(),
                name: "Trade Monitoring".to_string(),
                is_running: true,
                last_run: Some(chrono::Utc::now().to_rfc3339()),
                next_run: (chrono::Utc::now() + chrono::Duration::seconds(30)).to_rfc3339(),
                run_count: 240,
                error_count: 0,
            },
        ],
        memory_usage: 45.2, // Percentage
        cpu_usage: 12.8,    // Percentage
    };

    Ok(HttpResponse::Ok().json(response))
}

// Get performance metrics
pub async fn get_performance_metrics(
    req: HttpRequest,
    query: web::Query<MetricsQuery>,
) -> Result<HttpResponse, ApiError> {
    let _user_id = extract_user_id(&req)?;

    let timeframe = query.timeframe.as_deref().unwrap_or("1h");
    let strategy_id = query.strategy_id.as_deref();

    // Mock performance metrics
    let metrics = serde_json::json!({
        "timeframe": timeframe,
        "strategy_id": strategy_id,
        "metrics": {
            "total_trades": 150,
            "successful_trades": 95,
            "failed_trades": 5,
            "win_rate": 63.33,
            "total_profit": 1250.75,
            "total_loss": -320.50,
            "net_profit": 930.25,
            "average_trade_duration": 3600, // seconds
            "max_drawdown": -125.30,
            "sharpe_ratio": 1.85,
            "profit_factor": 3.9
        },
        "timestamp": chrono::Utc::now().to_rfc3339()
    });

    Ok(HttpResponse::Ok().json(metrics))
}

// Get alerts and notifications
pub async fn get_alerts(
    req: HttpRequest,
    query: web::Query<AlertQuery>,
) -> Result<HttpResponse, ApiError> {
    let _user_id = extract_user_id(&req)?;

    let severity = query.severity.as_deref();
    let limit = query.limit.unwrap_or(50).min(100);

    // Mock alerts
    let alerts = vec![
        serde_json::json!({
            "id": "alert_001",
            "type": "risk_warning",
            "severity": "medium",
            "message": "Strategy BTC-001 approaching maximum drawdown limit",
            "strategy_id": "strategy_001",
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "acknowledged": false
        }),
        serde_json::json!({
            "id": "alert_002",
            "type": "performance",
            "severity": "low",
            "message": "Strategy ETH-002 showing improved performance",
            "strategy_id": "strategy_002",
            "timestamp": (chrono::Utc::now() - chrono::Duration::minutes(30)).to_rfc3339(),
            "acknowledged": true
        }),
        serde_json::json!({
            "id": "alert_003",
            "type": "system",
            "severity": "high",
            "message": "Exchange connection experiencing high latency",
            "strategy_id": null,
            "timestamp": (chrono::Utc::now() - chrono::Duration::hours(1)).to_rfc3339(),
            "acknowledged": false
        })
    ];

    let filtered_alerts: Vec<_> = alerts
        .into_iter()
        .filter(|alert| {
            if let Some(sev) = severity {
                alert["severity"].as_str() == Some(sev)
            } else {
                true
            }
        })
        .take(limit)
        .collect();

    Ok(HttpResponse::Ok().json(filtered_alerts))
}

#[derive(Debug, Deserialize)]
pub struct MetricsQuery {
    pub timeframe: Option<String>,
    pub strategy_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AlertQuery {
    pub severity: Option<String>,
    pub limit: Option<usize>,
}
