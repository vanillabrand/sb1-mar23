import { logService } from './log-service';
import type { MarketInsight } from './types';

class AIMarketService {
  private static instance: AIMarketService;
  private readonly API_URL = 'https://api.deepseek.com/v1';
  private readonly MODEL = 'deepseek-v3-0324';
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
      const response = await fetch(`${this.API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a crypto market analysis AI. Analyze market conditions and provide insights.'
            },
            {
              role: 'user',
              content: `Analyze market conditions for: ${assets.join(', ')}. Focus on key technical indicators, market sentiment, and potential trading opportunities.`
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseDeepSeekResponse(data, assets);

    } catch (error) {
      logService.log('error', 'Failed to generate insights with DeepSeek', error, 'AIMarketService');
      return this.generateSyntheticInsights(assets);
    }
  }

  private parseDeepSeekResponse(data: any, assets: string[]): MarketInsight {
    try {
      const content = data.choices[0].message.content;
      
      // Parse the AI response and structure it into MarketInsight format
      return {
        timestamp: Date.now(),
        assets: assets.map(asset => ({
          symbol: asset,
          sentiment: this.extractSentiment(content, asset),
          signals: this.extractSignals(content, asset),
          riskLevel: this.extractRiskLevel(content, asset)
        })),
        marketConditions: {
          trend: this.extractTrend(content),
          volatility: this.extractVolatility(content),
          volume: this.extractVolume(content)
        },
        recommendations: this.extractRecommendations(content)
      };
    } catch (error) {
      logService.log('error', 'Failed to parse DeepSeek response', error, 'AIMarketService');
      return this.generateSyntheticInsights(assets);
    }
  }

  // Helper methods for parsing AI response
  private extractSentiment(content: string, asset: string): 'bullish' | 'bearish' | 'neutral' {
    // Implementation for sentiment extraction
    // This is a simplified version - you might want to enhance this
    const lowercaseContent = content.toLowerCase();
    const assetMention = lowercaseContent.indexOf(asset.toLowerCase());
    
    if (assetMention === -1) return 'neutral';
    
    const context = lowercaseContent.substring(
      Math.max(0, assetMention - 50),
      Math.min(lowercaseContent.length, assetMention + 50)
    );
    
    if (context.includes('bullish')) return 'bullish';
    if (context.includes('bearish')) return 'bearish';
    return 'neutral';
  }

  private extractSignals(content: string, asset: string): string[] {
    const signals: string[] = [];
    const patterns = [
      'golden cross', 'death cross', 'breakout',
      'support', 'resistance', 'trend line',
      'divergence', 'consolidation', 'momentum'
    ];

    for (const pattern of patterns) {
      if (content.toLowerCase().includes(pattern)) {
        signals.push(pattern);
      }
    }

    return signals;
  }

  private extractRiskLevel(content: string, asset: string): 'low' | 'medium' | 'high' {
    const lowercaseContent = content.toLowerCase();
    if (lowercaseContent.includes('high risk')) return 'high';
    if (lowercaseContent.includes('low risk')) return 'low';
    return 'medium';
  }

  private extractTrend(content: string): 'uptrend' | 'downtrend' | 'sideways' {
    const lowercaseContent = content.toLowerCase();
    if (lowercaseContent.includes('uptrend')) return 'uptrend';
    if (lowercaseContent.includes('downtrend')) return 'downtrend';
    return 'sideways';
  }

  private extractVolatility(content: string): 'low' | 'medium' | 'high' {
    const lowercaseContent = content.toLowerCase();
    if (lowercaseContent.includes('high volatility')) return 'high';
    if (lowercaseContent.includes('low volatility')) return 'low';
    return 'medium';
  }

  private extractVolume(content: string): 'low' | 'medium' | 'high' {
    const lowercaseContent = content.toLowerCase();
    if (lowercaseContent.includes('high volume')) return 'high';
    if (lowercaseContent.includes('low volume')) return 'low';
    return 'medium';
  }

  private extractRecommendations(content: string): string[] {
    const recommendations: string[] = [];
    const sentences = content.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes('recommend') || 
          sentence.toLowerCase().includes('suggest') ||
          sentence.toLowerCase().includes('consider')) {
        recommendations.push(sentence.trim());
      }
    }

    return recommendations;
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
}

export const aiMarketService = AIMarketService.getInstance();
