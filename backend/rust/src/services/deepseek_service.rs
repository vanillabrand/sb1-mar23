use crate::error::ApiError;
use crate::config::Config;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct DeepSeekRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub temperature: f32,
    pub max_tokens: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct DeepSeekResponse {
    pub choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
pub struct Choice {
    pub message: Message,
}

pub struct DeepSeekService {
    client: Client,
    api_key: String,
    api_url: String,
}

impl DeepSeekService {
    pub fn new(config: &Config) -> Result<Self, ApiError> {
        if config.deepseek_api_key.is_empty() {
            return Err(ApiError::ConfigError("DEEPSEEK_API_KEY not set".to_string()));
        }

        Ok(Self {
            client: Client::new(),
            api_key: config.deepseek_api_key.clone(),
            api_url: config.deepseek_api_url.clone(),
        })
    }
}

impl Default for DeepSeekService {
    fn default() -> Self {
        Self {
            client: Client::new(),
            api_key: "mock_api_key".to_string(),
            api_url: "https://api.deepseek.com/v1/chat/completions".to_string(),
        }
    }
}

impl DeepSeekService {
    pub async fn generate_market_insight(&self, market_data: &str) -> Result<String, ApiError> {
        let request = DeepSeekRequest {
            model: "deepseek-chat".to_string(),
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: "You are a cryptocurrency market analyst. Provide concise market insights based on the given data.".to_string(),
                },
                Message {
                    role: "user".to_string(),
                    content: format!("Analyze this market data and provide insights: {}", market_data),
                },
            ],
            temperature: 0.7,
            max_tokens: 500,
        };

        let response = self
            .client
            .post(&self.api_url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| ApiError::ExternalApi(format!("DeepSeek API error: {}", e)))?;

        if !response.status().is_success() {
            return Err(ApiError::ExternalApi(format!(
                "DeepSeek API returned status: {}",
                response.status()
            )));
        }

        let deepseek_response: DeepSeekResponse = response
            .json()
            .await
            .map_err(|e| ApiError::ExternalApi(format!("Failed to parse DeepSeek response: {}", e)))?;

        Ok(deepseek_response
            .choices
            .first()
            .map(|choice| choice.message.content.clone())
            .unwrap_or_else(|| "No insight generated".to_string()))
    }

    pub async fn generate_trade_signal(&self, strategy_data: &str) -> Result<String, ApiError> {
        let request = DeepSeekRequest {
            model: "deepseek-chat".to_string(),
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: "You are a trading strategy AI. Generate trading signals based on strategy parameters.".to_string(),
                },
                Message {
                    role: "user".to_string(),
                    content: format!("Generate a trading signal for this strategy: {}", strategy_data),
                },
            ],
            temperature: 0.5,
            max_tokens: 300,
        };

        let response = self
            .client
            .post(&self.api_url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| ApiError::ExternalApi(format!("DeepSeek API error: {}", e)))?;

        if !response.status().is_success() {
            return Err(ApiError::ExternalApi(format!(
                "DeepSeek API returned status: {}",
                response.status()
            )));
        }

        let deepseek_response: DeepSeekResponse = response
            .json()
            .await
            .map_err(|e| ApiError::ExternalApi(format!("Failed to parse DeepSeek response: {}", e)))?;

        Ok(deepseek_response
            .choices
            .first()
            .map(|choice| choice.message.content.clone())
            .unwrap_or_else(|| "No signal generated".to_string()))
    }

    pub async fn adapt_strategy(&self, _strategy: &crate::models::Strategy, _market_data: &serde_json::Value) -> Result<serde_json::Value, ApiError> {
        // Mock implementation - in real scenario, this would call DeepSeek API
        Ok(serde_json::json!({
            "adapted": true,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))
    }

    pub async fn generate_trades(&self, _strategy_id: &str, _market_data: serde_json::Value) -> Result<Vec<crate::models::Trade>, ApiError> {
        // Mock implementation - in real scenario, this would call DeepSeek API
        Ok(vec![])
    }
}


