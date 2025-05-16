use crate::config::CONFIG;
use crate::error::ApiError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsItem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub url: String,
    pub image_url: Option<String>,
    pub source: String,
    pub published_at: String,
    pub categories: Vec<String>,
}

// Cache TTL in seconds
const NEWS_CACHE_TTL: u64 = 300; // 5 minutes

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

pub struct NewsService {
    news_cache: RwLock<HashMap<String, CacheEntry<Vec<NewsItem>>>>,
}

impl NewsService {
    pub fn new() -> Self {
        Self {
            news_cache: RwLock::new(HashMap::new()),
        }
    }
    
    // Get crypto news
    pub async fn get_crypto_news(&self, limit: usize) -> Result<Vec<NewsItem>, ApiError> {
        // Check cache first
        {
            let cache = self.news_cache.read().unwrap();
            if let Some(entry) = cache.get("crypto") {
                if !entry.is_expired() {
                    return Ok(entry.data.clone().into_iter().take(limit).collect());
                }
            }
        }
        
        // Fetch from API
        let news = self.fetch_crypto_news(limit).await?;
        
        // Update cache
        {
            let mut cache = self.news_cache.write().unwrap();
            cache.insert(
                "crypto".to_string(),
                CacheEntry::new(news.clone(), Duration::from_secs(NEWS_CACHE_TTL)),
            );
        }
        
        Ok(news)
    }
    
    // Fetch crypto news from API
    async fn fetch_crypto_news(&self, limit: usize) -> Result<Vec<NewsItem>, ApiError> {
        // Use CoinDesk API for crypto news
        let api_key = std::env::var("NEWS_API_KEY").unwrap_or_default();
        let api_url = std::env::var("NEWS_API_URL")
            .unwrap_or_else(|_| "https://data-api.coindesk.com/news/v1/article/list?lang=EN".to_string());
        
        let url = format!("{}&limit={}", api_url, limit);
        
        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .header("x-api-key", api_key)
            .send()
            .await
            .map_err(|e| ApiError::ExternalApi(format!("Failed to fetch crypto news: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(ApiError::ExternalApi(format!(
                "Failed to fetch crypto news: {}",
                response.status()
            )));
        }
        
        let data: serde_json::Value = response.json().await
            .map_err(|e| ApiError::ExternalApi(format!("Failed to parse crypto news: {}", e)))?;
        
        // Parse response
        let mut news = Vec::new();
        
        if let Some(articles) = data["data"].as_array() {
            for article in articles {
                let news_item = NewsItem {
                    id: article["id"].as_str().unwrap_or("").to_string(),
                    title: article["title"].as_str().unwrap_or("").to_string(),
                    description: article["description"].as_str().unwrap_or("").to_string(),
                    url: article["url"].as_str().unwrap_or("").to_string(),
                    image_url: article["thumbnail"].as_str().map(|s| s.to_string()),
                    source: "CoinDesk".to_string(),
                    published_at: article["published_at"].as_str().unwrap_or("").to_string(),
                    categories: vec!["crypto".to_string()],
                };
                
                news.push(news_item);
            }
        }
        
        Ok(news)
    }
    
    // Get general news
    pub async fn get_general_news(&self, limit: usize) -> Result<Vec<NewsItem>, ApiError> {
        // For demo purposes, generate some fake news
        let mut news = Vec::new();
        
        for i in 0..limit {
            let news_item = NewsItem {
                id: format!("news-{}", i),
                title: format!("General News Item {}", i),
                description: format!("This is a general news item {}", i),
                url: format!("https://example.com/news/{}", i),
                image_url: Some(format!("https://example.com/images/{}.jpg", i)),
                source: "Demo News".to_string(),
                published_at: chrono::Utc::now().to_rfc3339(),
                categories: vec!["general".to_string()],
            };
            
            news.push(news_item);
        }
        
        Ok(news)
    }
}
