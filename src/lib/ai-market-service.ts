import { logService } from './log-service';
import { bitmartService } from './bitmart-service';
import { analyticsService } from './analytics-service';

interface MarketInsight {
  summary: string;
  sentiment: {
    primary: 'bullish' | 'bearish' | 'neutral';
    bullish: number;
    bearish: number;
    neutral: number;
  };
  recommendations: string[];
  timestamp: number;
}

class AIMarketService {
  private static instance: AIMarketService;
  private insightCache: Map<string, MarketInsight> = new Map();
  private readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes cache
  private pendingRequests: Map<string, Promise<MarketInsight>> = new Map();

  private constructor() {}

  static getInstance(): AIMarketService {
    if (!AIMarketService.instance) {
      AIMarketService.instance = new AIMarketService();
    }
    return AIMarketService.instance;
  }

  private async generateWithDeepSeek(assets: string[]): Promise<MarketInsight> {
    const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;
    
    // Check if we have a valid API key
    if (!API_KEY || API_KEY === 'your_api_key' || API_KEY.length < 10) {
      logService.log('warn', 'No valid DeepSeek API key found, using synthetic insights', null, 'AIMarketService');
      return this.generateSyntheticInsights(assets);
    }

    try {
      logService.log('info', 'Generating market insights with DeepSeek AI', { assets }, 'AIMarketService');
      
      // Get current asset data to provide to the AI
      const assetDataPromises = assets.map(async (asset) => {
        const realTimeData = bitmartService.getAssetData(asset);
        if (realTimeData) {
          return {
            symbol: asset.replace('_', '/'),
            price: realTimeData.price,
            change24h: realTimeData.change24h,
            volume24h: realTimeData.volume24h
          };
        }
        return null;
      });
      
      const assetData = (await Promise.all(assetDataPromises)).filter(data => data !== null);
      
      // Get overall market analytics
      const dashboardMetrics = analyticsService.getDashboardMetrics();
      
      // Prepare the prompt with current market data
      const prompt = `
        As a crypto market analyst, provide insightful analysis on the current market conditions based on this data:
        
        ${assetData.map(data => 
          `${data.symbol}: $${data.price.toFixed(2)} (${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%), Volume: $${data.volume24h.toLocaleString()}`
        ).join('\n')}
        
        Current Market Status:
        - Overall Risk Score: ${dashboardMetrics?.riskProfile?.current.toFixed(1) || "5.0"}/10
        - Average Win Rate: ${dashboardMetrics?.avgWinRate?.toFixed(1) || "60"}%
        - Total P&L: ${dashboardMetrics?.totalPnl?.toFixed(2) || "0"}%
        
        Format your response as a JSON object with the following structure:
        {
          "summary": "A concise paragraph summarizing current market conditions and outlook",
          "sentiment": {
            "primary": "bullish/bearish/neutral",
            "bullish": 0-100 (percentage),
            "bearish": 0-100 (percentage),
            "neutral": 0-100 (percentage)
          },
          "recommendations": [
            "Strategic recommendation 1",
            "Strategic recommendation 2",
            "Strategic recommendation 3"
          ]
        }
        
        IMPORTANT:
        1. Base your analysis on the actual data provided
        2. Keep your summary under 150 words and focused on actionable insights
        3. Ensure sentiment percentages add up to 100%
        4. Make recommendations specific to the assets mentioned
        5. Return ONLY the JSON object, no additional text or explanations
      `;

      // Call DeepSeek API
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in DeepSeek response');
      }

      // Extract JSON from the response
      let jsonStart = content.indexOf('{');
      let jsonEnd = content.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in response');
      }
      
      const jsonContent = content.substring(jsonStart, jsonEnd + 1);
      const insights = JSON.parse(jsonContent);
      
      // Validate and normalize the response
      const normalizedInsights: MarketInsight = {
        summary: insights.summary || 'Market conditions are currently evolving.',
        sentiment: {
          primary: insights.sentiment?.primary || 'neutral',
          bullish: insights.sentiment?.bullish || 33,
          bearish: insights.sentiment?.bearish || 33,
          neutral: insights.sentiment?.neutral || 34
        },
        recommendations: insights.recommendations || [
          'Monitor key support/resistance levels',
          'Consider diversifying across assets',
          'Maintain disciplined risk management'
        ],
        timestamp: Date.now()
      };
      
      logService.log('info', 'Successfully generated market insights', null, 'AIMarketService');
      return normalizedInsights;
      
    } catch (error) {
      logService.log('error', 'Failed to generate insights with DeepSeek:', error, 'AIMarketService');
      return this.generateSyntheticInsights(assets);
    }
  }

  private generateSyntheticInsights(assets: string[]): MarketInsight {
    // Generate insights based on real asset data if available
    const assetData = assets.map(asset => {
      const data = bitmartService.getAssetData(asset);
      return {
        symbol: asset.replace('_', '/'),
        price: data?.price || 0,
        change24h: data?.change24h || 0
      };
    });
    
    // Calculate overall sentiment based on real price changes
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;
    
    assetData.forEach(data => {
      if (data.change24h > 1) bullishCount++;
      else if (data.change24h < -1) bearishCount++;
      else neutralCount++;
    });
    
    const total = assetData.length || 1;
    const bullishPercent = (bullishCount / total) * 100;
    const bearishPercent = (bearishCount / total) * 100;
    const neutralPercent = 100 - bullishPercent - bearishPercent;
    
    let primarySentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (bullishPercent > bearishPercent && bullishPercent > neutralPercent) {
      primarySentiment = 'bullish';
    } else if (bearishPercent > bullishPercent && bearishPercent > neutralPercent) {
      primarySentiment = 'bearish';
    }
    
    // Generate recommendations based on sentiment
    const recommendations: string[] = [];
    
    if (primarySentiment === 'bullish') {
      recommendations.push('Focus on momentum strategies with moderate risk levels');
      recommendations.push('Look for breakout opportunities in trending assets');
      recommendations.push('Set trailing stop losses to protect profits while riding trends');
    } else if (primarySentiment === 'bearish') {
      recommendations.push('Prioritize defensive strategies and reduce exposure');
      recommendations.push('Consider hedging positions with inverse correlations');
      recommendations.push('Wait for clear reversal signals before entering new positions');
    } else {
      recommendations.push('Maintain balanced exposure with focused position sizing');
      recommendations.push('Look for range-bound trading opportunities');
      recommendations.push('Focus on assets with strong fundamentals during consolidation');
    }
    
    // Create synthetic insights
    return {
      summary: this.generateSummary(primarySentiment, assetData),
      sentiment: {
        primary: primarySentiment,
        bullish: Math.round(bullishPercent),
        bearish: Math.round(bearishPercent),
        neutral: Math.round(neutralPercent)
      },
      recommendations,
      timestamp: Date.now()
    };
  }

  private generateSummary(sentiment: string, assetData: any[]): string {
    if (assetData.length === 0) {
      return 'No asset data available to generate summary.';
    }
    
    const strongestAsset = assetData.reduce((prev, current) => 
      (current.change24h > prev.change24h) ? current : prev, { change24h: -Infinity, symbol: 'N/A' });
    
    const weakestAsset = assetData.reduce((prev, current) => 
      (current.change24h < prev.change24h) ? current : prev, { change24h: Infinity, symbol: 'N/A' });
    
    if (sentiment === 'bullish') {
      return `The market shows bullish momentum with ${strongestAsset.symbol} leading gains at ${strongestAsset.change24h.toFixed(2)}%. Technical indicators suggest continued upward pressure, though volatility remains present. Key resistance levels are being tested, with increased volume supporting potential breakouts.`;
    } else if (sentiment === 'bearish') {
      return `Market sentiment has turned bearish with ${weakestAsset.symbol} down ${Math.abs(weakestAsset.change24h).toFixed(2)}%. Selling pressure is evident across multiple timeframes, with support levels being tested. Traders should exercise caution and consider defensive positioning until clearer signals emerge.`;
    } else {
      return `The market is consolidating in a neutral pattern with mixed signals across assets. ${strongestAsset.symbol} shows relative strength while ${weakestAsset.symbol} faces pressure. Trading ranges are narrowing, suggesting potential volatility ahead as the market seeks direction.`;
    }
  }

  async getMarketInsights(assets: string[]): Promise<MarketInsight> {
    const now = Date.now();
    const cacheKey = assets.sort().join('_');
    
    // Use cached insight if valid
    const cachedInsight = this.insightCache.get(cacheKey);
    if (cachedInsight && now - cachedInsight.timestamp < this.CACHE_DURATION) {
      return cachedInsight;
    }
    
    // Check if there is a pending request for this cache key
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      try {
        return await pending;
      } catch (error) {
        logService.log('error', 'Error waiting for pending insights request', error, 'AIMarketService');
      }
    }
    
    // Generate a new insight and store the pending promise
    const newRequest = this.generateWithDeepSeek(assets);
    this.pendingRequests.set(cacheKey, newRequest);
    try {
      const insights = await newRequest;
      this.insightCache.set(cacheKey, insights);
      return insights;
    } catch (error) {
      logService.log('error', 'Error generating market insights', error, 'AIMarketService');
      throw error;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }
}

export const aiMarketService = AIMarketService.getInstance();
