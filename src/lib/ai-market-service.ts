import { logService } from './log-service';
import type { MarketInsight } from './types';
import { config } from './config';

class AIMarketService {
  private static instance: AIMarketService;
  private readonly API_URL = config.getFullUrl(config.deepseekApiUrl + '/v1/chat/completions');  // Use full proxy URL
  private readonly MODEL = 'deepseek-chat';  // Updated model name
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;

  // Cache to store recent API responses
  private cache: Map<string, {data: MarketInsight, timestamp: number}> = new Map();
  // Cache TTL in milliseconds (30 minutes)
  private readonly CACHE_TTL = 30 * 60 * 1000;
  // Flag to track if a request is in progress for a specific set of assets
  private inProgressRequests: Map<string, Promise<MarketInsight>> = new Map();

  private constructor() {}

  static getInstance(): AIMarketService {
    if (!AIMarketService.instance) {
      AIMarketService.instance = new AIMarketService();
    }
    return AIMarketService.instance;
  }

  private async generateWithDeepSeek(assets: string[]): Promise<MarketInsight> {
    const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;

    if (!API_KEY || API_KEY === 'your_api_key' || API_KEY.length < 10) {
      logService.log('warn', 'No valid DeepSeek API key found, using synthetic insights', null, 'AIMarketService');
      return this.generateSyntheticInsights(assets);
    }

    let retries = 0;

    while (retries <= this.MAX_RETRIES) {
      try {
        // Add exponential backoff for retries
        if (retries > 0) {
          const delay = this.RETRY_DELAY * Math.pow(2, retries - 1);
          logService.log('info', `Retrying DeepSeek API call (${retries}/${this.MAX_RETRIES}) after ${delay}ms delay`, null, 'AIMarketService');
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [{
            role: 'system',
            content: 'You are a crypto market analyst. Provide concise, accurate market insights in JSON format only. Keep explanations brief and focus on key indicators.'
          }, {
            role: 'user',
            content: `Analyze these crypto assets: ${assets.join(', ')}. Return ONLY a JSON object with this structure:
{
  "timestamp": ${Date.now()},
  "assets": [{
    "symbol": string,
    "sentiment": "bullish" | "bearish" | "neutral",
    "signals": string[], // 1-3 brief signals
    "riskLevel": "low" | "medium" | "high"
  }],
  "marketConditions": {
    "trend": "bullish" | "bearish" | "sideways",
    "volatility": "low" | "medium" | "high",
    "volume": "low" | "medium" | "high"
  },
  "recommendations": string[] // 2-3 brief recommendations
}`
          }],
          temperature: 0.2,
          max_tokens: 1000,
          stream: false,
          timeout: 10
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logService.log('error', `DeepSeek API error response: ${errorText}`, null, 'AIMarketService');
        throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from DeepSeek API');
      }

      const content = data.choices[0].message.content;
      let parsedContent: MarketInsight;

      try {
        // Extract JSON from the response text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON object found in response');
        }
        parsedContent = JSON.parse(jsonMatch[0]);
      } catch (e) {
        logService.log('error', 'Failed to parse DeepSeek response', { content, error: e }, 'AIMarketService');
        throw new Error('Failed to parse DeepSeek response as JSON');
      }

      return this.validateMarketInsight(parsedContent);

    } catch (error) {
      logService.log('error', `DeepSeek API call failed (attempt ${retries + 1}/${this.MAX_RETRIES + 1})`, error, 'AIMarketService');

      // Increment retry counter
      retries++;

      // If we've exhausted all retries, fall back to synthetic data
      if (retries > this.MAX_RETRIES) {
        logService.log('warn', 'All DeepSeek API retries exhausted, using synthetic insights', null, 'AIMarketService');
        return this.generateSyntheticInsights(assets);
      }

      // Continue to next retry iteration
    }
    }

    // This should never be reached, but TypeScript requires a return statement
    return this.generateSyntheticInsights(assets);
  }

  private validateMarketInsight(insight: MarketInsight): MarketInsight {
    if (typeof insight !== 'object' || insight === null) {
      throw new Error('Invalid MarketInsight format');
    }

    if (typeof insight.timestamp !== 'number') {
      throw new Error('Invalid timestamp format');
    }

    if (!Array.isArray(insight.assets) || insight.assets.length === 0) {
      throw new Error('Invalid assets format');
    }

    insight.assets.forEach(asset => {
      if (typeof asset.symbol !== 'string' || !asset.symbol) {
        throw new Error('Invalid asset symbol');
      }

      if (!['bullish', 'bearish', 'neutral'].includes(asset.sentiment)) {
        throw new Error('Invalid asset sentiment');
      }

      if (!Array.isArray(asset.signals)) {
        throw new Error('Invalid asset signals format');
      }

      if (!['low', 'medium', 'high'].includes(asset.riskLevel)) {
        throw new Error('Invalid asset risk level');
      }
    });

    if (typeof insight.marketConditions !== 'object' || insight.marketConditions === null) {
      throw new Error('Invalid market conditions format');
    }

    if (!['bullish', 'bearish', 'sideways'].includes(insight.marketConditions.trend)) {
      throw new Error('Invalid market trend');
    }

    if (!['low', 'medium', 'high'].includes(insight.marketConditions.volatility)) {
      throw new Error('Invalid market volatility');
    }

    if (!['low', 'medium', 'high'].includes(insight.marketConditions.volume)) {
      throw new Error('Invalid market volume');
    }

    if (!Array.isArray(insight.recommendations)) {
      throw new Error('Invalid recommendations format');
    }

    return insight;
  }

  private generateSyntheticInsights(assets: string[]): MarketInsight {
    // Fallback method when AI generation fails
    return {
      timestamp: Date.now(),
      assets: assets.map(asset => ({
        symbol: asset,
        sentiment: 'neutral',
        signals: ['Generated synthetically'],
        riskLevel: 'medium'
      })),
      marketConditions: {
        trend: 'sideways',
        volatility: 'medium',
        volume: 'medium'
      },
      recommendations: ['Consider waiting for clearer market signals']
    };
  }

  async getMarketInsights(assets: string[]): Promise<MarketInsight> {
    // Sort assets to ensure consistent cache keys
    const sortedAssets = [...assets].sort();
    const cacheKey = sortedAssets.join(',');

    // Check if we have a valid cache entry
    const cachedData = this.cache.get(cacheKey);
    const now = Date.now();

    if (cachedData && (now - cachedData.timestamp) < this.CACHE_TTL) {
      logService.log('info', 'Using cached market insights', null, 'AIMarketService');
      return cachedData.data;
    }

    // Check if there's already a request in progress for these assets
    if (this.inProgressRequests.has(cacheKey)) {
      logService.log('info', 'Reusing in-progress market insights request', null, 'AIMarketService');
      return this.inProgressRequests.get(cacheKey)!;
    }

    // Create a new request and store it
    const requestPromise = this.fetchMarketInsights(sortedAssets, cacheKey);
    this.inProgressRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }

  private async fetchMarketInsights(assets: string[], cacheKey: string): Promise<MarketInsight> {
    try {
      // Generate insights
      const insights = await this.generateWithDeepSeek(assets);

      // Cache the result
      this.cache.set(cacheKey, {
        data: insights,
        timestamp: Date.now()
      });

      return insights;
    } finally {
      // Always remove the in-progress request when done
      this.inProgressRequests.delete(cacheKey);
    }
  }

  // End of class
}

export const aiMarketService = AIMarketService.getInstance();
