use crate::config::CONFIG;
use crate::error::ApiError;
use crate::models::{Strategy, Trade};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeepseekRequest {
    model: String,
    messages: Vec<DeepseekMessage>,
    temperature: f64,
    max_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeepseekMessage {
    role: String,
    content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeepseekResponse {
    id: String,
    object: String,
    created: u64,
    model: String,
    choices: Vec<DeepseekChoice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeepseekChoice {
    index: u32,
    message: DeepseekMessage,
    finish_reason: String,
}

pub struct DeepseekService {
    api_key: String,
    api_url: String,
}

impl DeepseekService {
    pub fn new() -> Self {
        Self {
            api_key: CONFIG.deepseek_api_key.clone(),
            api_url: CONFIG.deepseek_api_url.clone(),
        }
    }
    
    // Generate trades for a strategy
    pub async fn generate_trades(&self, strategy: &Strategy, market_data: &Value, available_budget: f64) -> Result<Vec<Trade>, ApiError> {
        // Check if API key is available
        if self.api_key.is_empty() {
            return self.generate_synthetic_trades(strategy, available_budget);
        }
        
        // Build prompt for Deepseek
        let prompt = self.build_trade_generation_prompt(strategy, market_data, available_budget);
        
        // Call Deepseek API
        let response = self.call_deepseek_api(&prompt).await?;
        
        // Parse response
        let trades = self.parse_trades_from_response(response, strategy)?;
        
        Ok(trades)
    }
    
    // Adapt a strategy based on market conditions
    pub async fn adapt_strategy(&self, strategy: &Strategy, market_data: &Value) -> Result<Value, ApiError> {
        // Check if API key is available
        if self.api_key.is_empty() {
            return self.generate_synthetic_adaptation(strategy);
        }
        
        // Build prompt for Deepseek
        let prompt = self.build_strategy_adaptation_prompt(strategy, market_data);
        
        // Call Deepseek API
        let response = self.call_deepseek_api(&prompt).await?;
        
        // Parse response
        let adapted_config = self.parse_strategy_config_from_response(response, strategy)?;
        
        Ok(adapted_config)
    }
    
    // Call Deepseek API
    async fn call_deepseek_api(&self, prompt: &str) -> Result<String, ApiError> {
        // Prepare request
        let request = DeepseekRequest {
            model: "deepseek-chat".to_string(),
            messages: vec![
                DeepseekMessage {
                    role: "user".to_string(),
                    content: prompt.to_string(),
                },
            ],
            temperature: 0.3,
            max_tokens: 1000,
        };
        
        // Make API request
        let client = reqwest::Client::new();
        let response = client
            .post(&self.api_url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request)
            .send()
            .await
            .map_err(|e| ApiError::ExternalApi(format!("Failed to call Deepseek API: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(ApiError::ExternalApi(format!(
                "Deepseek API error: {}",
                response.status()
            )));
        }
        
        // Parse response
        let deepseek_response: DeepseekResponse = response.json().await
            .map_err(|e| ApiError::ExternalApi(format!("Failed to parse Deepseek response: {}", e)))?;
        
        if deepseek_response.choices.is_empty() {
            return Err(ApiError::ExternalApi("Empty response from Deepseek".to_string()));
        }
        
        Ok(deepseek_response.choices[0].message.content.clone())
    }
    
    // Build prompt for trade generation
    fn build_trade_generation_prompt(&self, strategy: &Strategy, market_data: &Value, available_budget: f64) -> String {
        format!(
            r#"Generate optimal trade signals based on the following strategy and market data:

Strategy Configuration:
{}

Market Data:
{}

Available Budget: {} USDT

Requirements:
1. Analyze current market conditions against strategy rules
2. Validate all strategy conditions are met
3. Calculate optimal position size based on budget and risk
4. Generate precise entry/exit points
5. Include confidence score based on condition alignment
6. Return trades in strict JSON format

Return an array of trade signals with this exact structure:
[{{
  "asset": string,
  "direction": "buy" | "sell",
  "entry_price": number,
  "stop_loss": number,
  "take_profit": number,
  "position_size": number,
  "confidence": number,
  "conditions_met": string[],
  "timestamp": number
}}]"#,
            serde_json::to_string_pretty(&strategy.strategy_config).unwrap_or_default(),
            serde_json::to_string_pretty(market_data).unwrap_or_default(),
            available_budget
        )
    }
    
    // Build prompt for strategy adaptation
    fn build_strategy_adaptation_prompt(&self, strategy: &Strategy, market_data: &Value) -> String {
        format!(
            r#"Adapt the following trading strategy based on current market conditions:

Strategy Configuration:
{}

Market Data:
{}

Requirements:
1. Analyze current market conditions
2. Identify strengths and weaknesses in the current strategy
3. Suggest improvements to entry and exit conditions
4. Optimize position sizing and risk management
5. Return the adapted strategy configuration in the same JSON format

Return the adapted strategy configuration with this exact structure:
{{
  "indicatorType": string,
  "entryConditions": object,
  "exitConditions": object,
  "tradeParameters": {{
    "positionSize": number,
    "maxOpenPositions": number,
    "stopLoss": number,
    "takeProfit": number
  }}
}}"#,
            serde_json::to_string_pretty(&strategy.strategy_config).unwrap_or_default(),
            serde_json::to_string_pretty(market_data).unwrap_or_default()
        )
    }
    
    // Parse trades from Deepseek response
    fn parse_trades_from_response(&self, response: String, strategy: &Strategy) -> Result<Vec<Trade>, ApiError> {
        // Extract JSON from response
        let json_start = response.find('[').unwrap_or(0);
        let json_end = response.rfind(']').unwrap_or(response.len());
        
        if json_start >= json_end {
            return Err(ApiError::ExternalApi("Invalid JSON in Deepseek response".to_string()));
        }
        
        let json_str = &response[json_start..=json_end];
        
        // Parse JSON
        let trade_signals: Vec<Value> = serde_json::from_str(json_str)
            .map_err(|e| ApiError::ExternalApi(format!("Failed to parse trade signals: {}", e)))?;
        
        // Convert to Trade objects
        let mut trades = Vec::new();
        
        for signal in trade_signals {
            let asset = signal["asset"].as_str().unwrap_or("").to_string();
            let direction = signal["direction"].as_str().unwrap_or("buy").to_string();
            let entry_price = signal["entry_price"].as_f64().unwrap_or(0.0);
            let stop_loss = signal["stop_loss"].as_f64().unwrap_or(0.0);
            let take_profit = signal["take_profit"].as_f64().unwrap_or(0.0);
            let position_size = signal["position_size"].as_f64().unwrap_or(0.0);
            
            // Skip invalid trades
            if asset.is_empty() || entry_price <= 0.0 || position_size <= 0.0 {
                continue;
            }
            
            let trade = Trade {
                id: Uuid::new_v4(),
                strategy_id: strategy.id,
                symbol: asset,
                side: direction,
                status: "pending".to_string(),
                amount: position_size,
                entry_price: Some(entry_price),
                exit_price: None,
                profit: None,
                timestamp: Utc::now().timestamp_millis(),
                created_at: Utc::now(),
                executed_at: None,
                closed_at: None,
                order_id: None,
                market_type: strategy.market_type.clone(),
                leverage: None,
                stop_loss: Some(stop_loss),
                take_profit: Some(take_profit),
                trailing_stop: None,
                metadata: serde_json::json!({
                    "confidence": signal["confidence"].as_f64().unwrap_or(0.5),
                    "conditions_met": signal["conditions_met"].as_array().map(|a| a.to_owned()).unwrap_or_default(),
                    "generated_by": "deepseek"
                }),
            };
            
            trades.push(trade);
        }
        
        Ok(trades)
    }
    
    // Parse strategy config from Deepseek response
    fn parse_strategy_config_from_response(&self, response: String, strategy: &Strategy) -> Result<Value, ApiError> {
        // Extract JSON from response
        let json_start = response.find('{').unwrap_or(0);
        let json_end = response.rfind('}').unwrap_or(response.len());
        
        if json_start >= json_end {
            return Err(ApiError::ExternalApi("Invalid JSON in Deepseek response".to_string()));
        }
        
        let json_str = &response[json_start..=json_end];
        
        // Parse JSON
        let adapted_config: Value = serde_json::from_str(json_str)
            .map_err(|e| ApiError::ExternalApi(format!("Failed to parse adapted strategy config: {}", e)))?;
        
        Ok(adapted_config)
    }
    
    // Generate synthetic trades for demo mode
    fn generate_synthetic_trades(&self, strategy: &Strategy, available_budget: f64) -> Result<Vec<Trade>, ApiError> {
        let mut trades = Vec::new();
        
        // Get selected pairs from strategy
        let selected_pairs = &strategy.selected_pairs;
        
        // Generate 1-3 trades
        let num_trades = rand::random::<usize>() % 3 + 1;
        
        for _ in 0..num_trades {
            // Select a random pair
            if selected_pairs.is_empty() {
                continue;
            }
            
            let pair_idx = rand::random::<usize>() % selected_pairs.len();
            let symbol = selected_pairs[pair_idx].clone();
            
            // Generate random trade details
            let side = if rand::random::<f64>() > 0.5 { "buy" } else { "sell" };
            let base_price = self.get_base_price(&symbol);
            let entry_price = base_price * (1.0 + (rand::random::<f64>() * 0.02 - 0.01));
            
            // Calculate position size (1-10% of available budget)
            let position_size_pct = rand::random::<f64>() * 0.09 + 0.01;
            let position_size = (available_budget * position_size_pct) / entry_price;
            
            // Calculate stop loss and take profit
            let stop_loss_pct = rand::random::<f64>() * 0.02 + 0.01; // 1-3%
            let take_profit_pct = rand::random::<f64>() * 0.04 + 0.02; // 2-6%
            
            let stop_loss = if side == "buy" {
                entry_price * (1.0 - stop_loss_pct)
            } else {
                entry_price * (1.0 + stop_loss_pct)
            };
            
            let take_profit = if side == "buy" {
                entry_price * (1.0 + take_profit_pct)
            } else {
                entry_price * (1.0 - take_profit_pct)
            };
            
            let trade = Trade {
                id: Uuid::new_v4(),
                strategy_id: strategy.id,
                symbol,
                side: side.to_string(),
                status: "pending".to_string(),
                amount: position_size,
                entry_price: Some(entry_price),
                exit_price: None,
                profit: None,
                timestamp: Utc::now().timestamp_millis(),
                created_at: Utc::now(),
                executed_at: None,
                closed_at: None,
                order_id: None,
                market_type: strategy.market_type.clone(),
                leverage: None,
                stop_loss: Some(stop_loss),
                take_profit: Some(take_profit),
                trailing_stop: None,
                metadata: serde_json::json!({
                    "confidence": rand::random::<f64>() * 0.5 + 0.5, // 0.5-1.0
                    "conditions_met": ["price_action", "volume", "trend"],
                    "generated_by": "synthetic"
                }),
            };
            
            trades.push(trade);
        }
        
        Ok(trades)
    }
    
    // Generate synthetic strategy adaptation
    fn generate_synthetic_adaptation(&self, strategy: &Strategy) -> Result<Value, ApiError> {
        // Start with the current strategy config
        let mut adapted_config = strategy.strategy_config.clone();
        
        // Make some random adjustments
        if let Some(trade_params) = adapted_config["tradeParameters"].as_object_mut() {
            // Adjust position size (±20%)
            if let Some(pos_size) = trade_params.get("positionSize").and_then(|v| v.as_f64()) {
                let adjustment = 1.0 + (rand::random::<f64>() * 0.4 - 0.2);
                trade_params["positionSize"] = serde_json::json!(pos_size * adjustment);
            }
            
            // Adjust stop loss (±1%)
            if let Some(stop_loss) = trade_params.get("stopLoss").and_then(|v| v.as_f64()) {
                let adjustment = 1.0 + (rand::random::<f64>() * 0.2 - 0.1);
                trade_params["stopLoss"] = serde_json::json!(stop_loss * adjustment);
            }
            
            // Adjust take profit (±2%)
            if let Some(take_profit) = trade_params.get("takeProfit").and_then(|v| v.as_f64()) {
                let adjustment = 1.0 + (rand::random::<f64>() * 0.4 - 0.2);
                trade_params["takeProfit"] = serde_json::json!(take_profit * adjustment);
            }
        }
        
        Ok(adapted_config)
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
