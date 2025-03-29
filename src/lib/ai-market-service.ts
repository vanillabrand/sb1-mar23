import { logService } from './log-service';
import type { MarketInsight } from './types';

class AIMarketService {
  private static instance: AIMarketService;
  private readonly API_URL = 'https://api.deepseek.com/v1/chat/completions';  // Updated endpoint
  private readonly MODEL = 'deepseek-chat';  // Updated model name
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;

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

    try {
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
            role: 'user',
            content: `Analyze the following crypto assets and return a JSON response: ${assets.join(', ')}. Include technical indicators, market sentiment, and potential opportunities. Format the response as a valid JSON object with the following structure:
{
  "timestamp": number,
  "assets": [{
    "symbol": string,
    "sentiment": "bullish" | "bearish" | "neutral",
    "signals": string[],
    "riskLevel": "low" | "medium" | "high"
  }],
  "marketConditions": {
    "trend": "bullish" | "bearish" | "sideways",
    "volatility": "low" | "medium" | "high",
    "volume": "low" | "medium" | "high"
  },
  "recommendations": string[]
}`
          }],
          temperature: 0.3,
          max_tokens: 2000,
          stream: false
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
      logService.log('error', 'Failed to generate insights with DeepSeek', error, 'AIMarketService');
      return this.generateSyntheticInsights(assets);
    }
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
    return this.generateWithDeepSeek(assets);
  }

  private parseDeepSeekResponse(response: string): any {
    try {
      // Remove any potential non-JSON content before and after the JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logService.log('error', 'Failed to parse DeepSeek response', { response, error }, 'AIMarketService');
      return null;
    }
  }
}

export const aiMarketService = AIMarketService.getInstance();
