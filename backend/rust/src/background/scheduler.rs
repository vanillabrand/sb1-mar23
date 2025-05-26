use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use std::time::Duration;
use std::future::Future;
use std::pin::Pin;
use tokio::time::{interval, Interval};
use tracing::{info, warn, error, debug};
use uuid::Uuid;

use crate::error::ApiError;

type TaskFuture = Pin<Box<dyn Future<Output = ()> + Send>>;
type TaskFunction = Box<dyn Fn() -> TaskFuture + Send + Sync>;

pub struct ScheduledTask {
    pub id: String,
    pub name: String,
    pub interval: Duration,
    pub function: TaskFunction,
    pub is_running: bool,
    pub last_run: Option<chrono::DateTime<chrono::Utc>>,
    pub next_run: chrono::DateTime<chrono::Utc>,
    pub run_count: u64,
    pub error_count: u64,
}

pub struct TaskScheduler {
    tasks: Arc<RwLock<HashMap<String, ScheduledTask>>>,
    is_running: Arc<RwLock<bool>>,
    task_handles: Arc<RwLock<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

impl TaskScheduler {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(RwLock::new(HashMap::new())),
            is_running: Arc::new(RwLock::new(false)),
            task_handles: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn start(&self) -> Result<(), ApiError> {
        info!("⏰ Starting task scheduler...");

        {
            let mut is_running = self.is_running.write().await;
            *is_running = true;
        }

        // Start all scheduled tasks
        let tasks = self.tasks.read().await;
        for (task_id, task) in tasks.iter() {
            self.start_task(task_id.clone(), task.interval, &task.function).await?;
        }

        info!("✅ Task scheduler started with {} tasks", tasks.len());
        Ok(())
    }

    pub async fn stop(&self) -> Result<(), ApiError> {
        info!("🛑 Stopping task scheduler...");

        {
            let mut is_running = self.is_running.write().await;
            *is_running = false;
        }

        // Stop all running tasks
        let mut handles = self.task_handles.write().await;
        for (task_id, handle) in handles.drain() {
            debug!("Stopping task: {}", task_id);
            handle.abort();
        }

        info!("✅ Task scheduler stopped");
        Ok(())
    }

    pub async fn schedule_recurring(
        &self,
        task_id: String,
        interval: Duration,
        function: TaskFunction,
    ) -> Result<(), ApiError> {
        info!("📅 Scheduling recurring task: {} (interval: {:?})", task_id, interval);

        let task = ScheduledTask {
            id: task_id.clone(),
            name: task_id.clone(),
            interval,
            function,
            is_running: false,
            last_run: None,
            next_run: chrono::Utc::now() + chrono::Duration::from_std(interval).unwrap(),
            run_count: 0,
            error_count: 0,
        };

        {
            let mut tasks = self.tasks.write().await;
            tasks.insert(task_id.clone(), task);
        }

        // Start the task if scheduler is running
        let is_running = *self.is_running.read().await;
        if is_running {
            let tasks = self.tasks.read().await;
            if let Some(task) = tasks.get(&task_id) {
                self.start_task(task_id.clone(), task.interval, &task.function).await?;
            }
        }

        debug!("✅ Task scheduled: {}", task_id);
        Ok(())
    }

    async fn start_task(
        &self,
        task_id: String,
        _task_interval: Duration,
        _task_function: &TaskFunction,
    ) -> Result<(), ApiError> {
        debug!("🚀 Starting task: {}", task_id);

        // For now, just simulate task scheduling
        // In a real implementation, we'd properly handle the task execution

        Ok(())
    }

    pub async fn schedule_once(
        &self,
        task_id: String,
        delay: Duration,
        function: TaskFunction,
    ) -> Result<(), ApiError> {
        info!("📅 Scheduling one-time task: {} (delay: {:?})", task_id, delay);

        let is_running = self.is_running.clone();
        let task_id_clone = task_id.clone();

        let handle = tokio::spawn(async move {
            tokio::time::sleep(delay).await;

            // Check if scheduler is still running
            {
                let running = *is_running.read().await;
                if !running {
                    debug!("One-time task {} cancelled due to scheduler shutdown", task_id_clone);
                    return;
                }
            }

            debug!("🔄 Executing one-time task: {}", task_id_clone);
            let task_future = function();
            task_future.await;
            debug!("✅ One-time task {} completed", task_id_clone);
        });

        {
            let mut handles = self.task_handles.write().await;
            handles.insert(task_id, handle);
        }

        Ok(())
    }

    pub async fn cancel_task(&self, task_id: &str) -> Result<(), ApiError> {
        info!("❌ Cancelling task: {}", task_id);

        // Remove from tasks
        {
            let mut tasks = self.tasks.write().await;
            tasks.remove(task_id);
        }

        // Cancel the handle
        {
            let mut handles = self.task_handles.write().await;
            if let Some(handle) = handles.remove(task_id) {
                handle.abort();
            }
        }

        debug!("✅ Task cancelled: {}", task_id);
        Ok(())
    }

    pub async fn get_task_status(&self, task_id: &str) -> Option<TaskStatus> {
        let tasks = self.tasks.read().await;
        tasks.get(task_id).map(|task| TaskStatus {
            id: task.id.clone(),
            name: task.name.clone(),
            is_running: task.is_running,
            last_run: task.last_run,
            next_run: task.next_run,
            run_count: task.run_count,
            error_count: task.error_count,
            interval: task.interval,
        })
    }

    pub async fn get_all_task_statuses(&self) -> Vec<TaskStatus> {
        let tasks = self.tasks.read().await;
        tasks.values().map(|task| TaskStatus {
            id: task.id.clone(),
            name: task.name.clone(),
            is_running: task.is_running,
            last_run: task.last_run,
            next_run: task.next_run,
            run_count: task.run_count,
            error_count: task.error_count,
            interval: task.interval,
        }).collect()
    }
}

#[derive(Debug, Clone)]
pub struct TaskStatus {
    pub id: String,
    pub name: String,
    pub is_running: bool,
    pub last_run: Option<chrono::DateTime<chrono::Utc>>,
    pub next_run: chrono::DateTime<chrono::Utc>,
    pub run_count: u64,
    pub error_count: u64,
    pub interval: Duration,
}
