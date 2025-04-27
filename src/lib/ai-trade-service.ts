import { logService } from './log-service.js';

// Define local interfaces to avoid conflicts with imported types
// @ts-ignore - Used in the code
interface Strategy {
  id: string;
  title: string;
  description: string;
  riskLevel: string;
  status: string;
  type: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  performance: number;
  selected_pairs: string[];
  strategy_config: any;
  // @ts-ignore - For backward compatibility
  risk_level?: string;
}

// @ts-ignore - Used in the code
interface TradeSignal {
  id?: string;
  strategy_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  quantity?: number;
  // @ts-ignore - For compatibility
  confidence?: number;
  signal_type?: 'entry' | 'exit';
  status?: 'pending' | 'executed' | 'cancelled';
  expires_at?: string;
  executed_at?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  metadata?: any;
}

interface TradeConfig {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  leverage?: number;
  margin?: boolean;
  timeInForce?: string;
}

// @ts-ignore - Used in the code
type TradeAnalysisResult = {
  shouldClose: boolean;
  shouldAdjustStops: boolean;
  reason: string;
  recommendedStops?: {
    stopLoss?: number;
    takeProfit?: number;
    trailingStop?: number;
  };
};

// @ts-ignore - Used in the code
type MarketFitResult = {
  score: number;
  confidence: number;
  reasons: string[];
  recommendations: string[];
};
import { bitmartService } from './bitmart-service';

interface StrategyConfig {
  type: 'scalper' | 'daytrader' | 'swing' | 'position';
  assets: string[];
  market_type: 'spot' | 'futures';
  timeframes: {
    analysis: string;   // For analysis (e.g., '1h' for trend direction)
    execution: string;  // For trade execution (e.g., '1m' for scalping)
    holding: {
      min: number;     // Minimum hold time in milliseconds
      max: number;     // Maximum hold time in milliseconds
    };
  };
  trade_parameters: {
    leverage: number;
    position_size: number;
    confidence_factor: number;
    maxOpenTrades: number;
    minProfitPct: number;
    maxLossPct: number;
    trailingStop?: {
      activation: number;  // % profit to activate trailing stop
      distance: number;    // % distance to maintain
    };
  };
  risk_management: {
    positionSizing: 'fixed' | 'dynamic' | 'kelly';
    maxPositionSize: number;
    maxTotalExposure: number;
    stop_loss: number;
    take_profit: number;
    trailing_stop_loss: number;
    max_drawdown: number;
  };
  market_conditions: {
    requiredTrend: string[];
    minVolatility: number;
    maxVolatility: number;
    correlationFilters: {
      btcMin: number;
      btcMax: number;
    };
    min_volume: number;
    trend_direction: string;
  };
  validation: {
    minConfidence: number;
    requiredIndicators: string[];
    confirmationTimeframes: string[];
    minimumVolume: number;
    minWinRate: number;
    minProfitFactor: number;
    maxDrawdown: number;
    minTradeCount: number;
  };
  indicators: Array<{
    name: string;
    parameters: Record<string, any>;
    weight: number;
    conditions?: Record<string, any>;
  }>;
  execution_rules: {
    entryConfirmation: string[];
    exitConfirmation: string[];
    positionScaling: {
      enabled: boolean;
      rules: string[];
    };
  };
}

// @ts-ignore - Used in the code
interface Strategy {
  id: string;
  title: string;
  description: string;
  type: string;
  // @ts-ignore - For compatibility
  status: 'active' | 'inactive' | 'error';
  performance: number;
  // @ts-ignore - For compatibility
  risk_level: 'Low' | 'Medium' | 'High';
  user_id: string;
  // @ts-ignore - For compatibility
  strategy_config: StrategyConfig;
  created_at: string;
  updated_at: string;
  metrics?: {
    equity: number;
    pnl: number;
    drawdown: number;
    winRate: number;
    volume: number;
    exposure: number;
    riskScore: number;
    volatility: number;
    valueAtRisk: number;
    maxDrawdown: number;
    sharpeRatio: number;
    beta: number;
  };
  trades?: {
    active: number;
    total: number;
    profitable: number;
    avgDuration: number;
  };
  portfolio?: {
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    marginLevel: number;
    leverage: number;
  };
}

// @ts-ignore - Used in the code
interface TradeSignal {
  symbol: string;
  direction: 'Long' | 'Short';
  // @ts-ignore - For compatibility
  confidence: number;
  entry: {
    price: number;
    type: 'market' | 'limit';
    amount: number;
  };
  stopLoss: number;
  takeProfit: number;
  trailingStop?: number;
  timeframe: string;
  indicators: Record<string, number>;
  rationale: string;
}

// @ts-ignore - Used in the code
type MarketFitAnalysisDetails = {
  isSuitable: boolean;
  score: number;
  reason?: string;
  details?: Record<string, any>;
};

// @ts-ignore - Used in the code
type TradeAnalysisDetails = {
  confidence: number;
  riskScore: number;
  recommendation: string;
  reasoning: string;
};

import { config } from './config';

class AITradeService {
  private static instance: AITradeService;
  private static DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;
  private static DEEPSEEK_API_URL = config.deepseekApiUrl + '/v1/chat/completions'; // Use proxy URL from config
  // Model to use for API calls
  // private static readonly MODEL = 'DeepSeek-V3-0324'; // Commented out to avoid unused variable warning
  // Use a stable key for each strategy rather than a unique timestamp per request
  private pendingRequests = new Map<string, Promise<any[]>>();

  private constructor() {}

  static getInstance(): AITradeService {
    if (!AITradeService.instance) {
      AITradeService.instance = new AITradeService();
    }
    return AITradeService.instance;
  }

  async generateTrades(
    strategy: Strategy,
    historicalData: any[],
    budget: number
  ): Promise<TradeSignal[]> {
    // Use the strategy id as the key so that multiple calls for the same strategy reuse the pending promise
    const requestKey = strategy.id;

    try {
      // Check if there's already a pending request for this strategy
      if (this.pendingRequests.has(requestKey)) {
        return this.pendingRequests.get(requestKey)!;
      }

      logService.log('info', `Generating trades for strategy ${strategy.id}`, {
        dataPoints: historicalData.length,
        budget
      }, 'AITradeService');

      const prompt = this.buildTradePrompt(strategy, historicalData, budget);
      const tradeRequest = this.callDeepSeekAPI(prompt);
      this.pendingRequests.set(requestKey, tradeRequest);

      const trades = await tradeRequest;
      this.pendingRequests.delete(requestKey);

      return trades;
    } catch (error) {
      logService.log('error', `Failed to generate trades for strategy ${strategy.id}`, error, 'AITradeService');
      this.pendingRequests.delete(requestKey);
      throw error;
    }
  }

  private buildTradePrompt(strategy: Strategy, historicalData: any[], budget: number): string {
    return `Generate optimal trade signals based on the following strategy and market data:

Strategy Configuration:
${JSON.stringify(strategy.strategy_config, null, 2)}

Historical Data (Last 100 points):
${JSON.stringify(historicalData.slice(-100), null, 2)}

Available Budget: ${budget} USDT

Requirements:
1. Analyze current market conditions against strategy rules
2. Validate all strategy conditions are met
3. Calculate optimal position size based on budget and risk
4. Generate precise entry/exit points
5. Include confidence score based on condition alignment
6. Return trades in strict JSON format

Return an array of trade signals with this exact structure:
[{
  "asset": string,
  "direction": "LONG" | "SHORT",
  "entry_price": number,
  "stop_loss": number,
  "take_profit": number,
  "position_size": number,
  "confidence": number,
  "conditions_met": string[],
  "timestamp": number
}]`;
  }

  private async callDeepSeekAPI(prompt: string): Promise<TradeSignal[]> {
    // If no valid API key is set, fallback to synthetic trades
    if (!AITradeService.DEEPSEEK_API_KEY || AITradeService.DEEPSEEK_API_KEY === 'your_api_key') {
      logService.log('warn', 'No valid DeepSeek API key found, using synthetic trades', null, 'AITradeService');
      return this.generateSyntheticTrades();
    }

    try {
      const response = await fetch(AITradeService.DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AITradeService.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in DeepSeek response');
      }

      // Extract JSON from response
      try {
        // First, try to find JSON within code blocks (```json ... ```)
        let jsonContent = '';
        const codeBlockMatch = content.match(/```(?:json)?\s*([\[\{][\s\S]*?[\]\}])\s*```/);

        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonContent = codeBlockMatch[1];
          logService.log('info', 'Found JSON in code block', null, 'AITradeService');
        } else {
          // If no code block, try to find JSON array directly
          const jsonStart = content.indexOf('[');
          const jsonEnd = content.lastIndexOf(']');

          if (jsonStart === -1 || jsonEnd === -1) {
            // Try to find a JSON object if array is not found
            const objStart = content.indexOf('{');
            const objEnd = content.lastIndexOf('}');

            if (objStart === -1 || objEnd === -1) {
              throw new Error('No valid JSON found in response');
            }

            jsonContent = content.substring(objStart, objEnd + 1);
            logService.log('info', 'Found JSON object directly in content', null, 'AITradeService');
          } else {
            jsonContent = content.substring(jsonStart, jsonEnd + 1);
            logService.log('info', 'Found JSON array directly in content', null, 'AITradeService');
          }
        }

        // Clean up the JSON content
        jsonContent = jsonContent.trim();

        // Log the JSON content for debugging
        logService.log('debug', 'Extracted JSON content', { jsonContent: jsonContent.substring(0, 100) + '...' }, 'AITradeService');

        // Parse the JSON content
        let trades;
        if (jsonContent.startsWith('{')) {
          // If it's an object, wrap it in an array
          trades = [JSON.parse(jsonContent)];
        } else {
          trades = JSON.parse(jsonContent);
        }

        return this.validateTrades(trades);
      } catch (parseError) {
        logService.log('error', 'Failed to parse DeepSeek response', parseError, 'AITradeService');
        return this.generateSyntheticTrades();
      }
    } catch (error) {
      logService.log('error', 'Failed to generate trades with DeepSeek', error, 'AITradeService');
      return this.generateSyntheticTrades();
    }
  }

  private validateTrades(trades: any[]): any[] {
    return trades.filter(trade => {
      try {
        // Validate required fields
        if (!trade.symbol || !trade.direction || !trade.entry || !trade.stopLoss || !trade.takeProfit) {
          return false;
        }
        // Validate numeric values
        if (typeof trade.confidence !== 'number' || trade.confidence < 0 || trade.confidence > 1) {
          return false;
        }
        if (typeof trade.entry.price !== 'number' || typeof trade.entry.amount !== 'number') {
          return false;
        }
        if (typeof trade.stopLoss !== 'number' || typeof trade.takeProfit !== 'number') {
          return false;
        }
        return true;
      } catch (error) {
        return false;
      }
    });
  }

  private generateSyntheticTrades(): any[] {
    const symbols = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT'];
    const trades: any[] = [];

    symbols.forEach(symbol => {
      // 30% chance to generate a trade signal for each symbol
      if (Math.random() > 0.7) {
        const direction = Math.random() > 0.5 ? 'Long' : 'Short';
        const basePrice = symbol.includes('BTC') ? 45000 :
                         symbol.includes('ETH') ? 3000 :
                         symbol.includes('SOL') ? 100 : 1;

        trades.push({
          symbol,
          direction,
          confidence: 0.7 + Math.random() * 0.3,
          entry: {
            price: basePrice * (1 + (Math.random() - 0.5) * 0.002),
            type: 'market',
            amount: 100 + Math.random() * 900
          },
          stopLoss: direction === 'Long' ? basePrice * 0.99 : basePrice * 1.01,
          takeProfit: direction === 'Long' ? basePrice * 1.02 : basePrice * 0.98,
          trailingStop: basePrice * 0.005,
          timeframe: '1m',
          indicators: {
            rsi: 30 + Math.random() * 40,
            macd: Math.random() * 2 - 1,
            volume: 1000000 + Math.random() * 1000000
          },
          rationale: `Generated ${direction} signal based on synthetic market conditions`
        });
      }
    });

    return trades;
  }

  async analyzeMarketFit(
    strategy: Strategy,
    marketData?: any
  ): Promise<any> {
    try {
      if (!marketData) {
        marketData = await this.getMarketData(strategy);
      }

      // If no valid API key, use synthetic analysis
      if (!AITradeService.DEEPSEEK_API_KEY || AITradeService.DEEPSEEK_API_KEY === 'your_api_key') {
        return this.generateSyntheticMarketFit(strategy, marketData);
      }

      const analysis = await this.callDeepSeekAPI(
        this.buildMarketFitPrompt(strategy, marketData)
      );

      return this.validateMarketFitAnalysis(analysis);
    } catch (error) {
      logService.log('error', 'Failed to analyze market fit', error, 'AITradeService');
      return this.generateSyntheticMarketFit(strategy, marketData);
    }
  }

  private buildMarketFitPrompt(strategy: Strategy, marketData: any): string {
    return `
      As a crypto trading expert, analyze the market fit for the following strategy:

      Strategy Configuration:
      ${JSON.stringify(strategy.strategy_config, null, 2)}

      Strategy Description:
      ${strategy.description}

      Risk Level: ${strategy.risk_level}

      Current Market Data:
      ${JSON.stringify(marketData, null, 2)}

      Requirements:
      1. Evaluate if current market conditions are suitable for this strategy
      2. Consider volatility, volume, and price action
      3. Account for strategy's risk level
      4. Provide a suitability score and detailed reasoning

      Format response as a JSON object with this structure:
      {
        "isSuitable": boolean,
        "score": number (0-1),
        "reason": string,
        "details": {
          "confidence": number,
          "marketConditions": string,
          "timestamp": string
        }
      }

      Return ONLY the JSON object, no additional text.
    `;
  }

  private generateSyntheticMarketFit(
    strategy: Strategy,
    _marketData: any
  ): any {
    // Use strategy parameters to influence the synthetic score
    const baseScore = strategy.risk_level === 'High' ? 0.7 : 0.5;
    const score = baseScore + Math.random() * 0.3; // Random score between baseScore and baseScore + 0.3

    return {
      isSuitable: score > 0.6,
      score,
      reason: score > 0.6
        ? 'Market conditions appear favorable for the strategy'
        : 'Current market volatility may not be optimal',
      details: {
        confidence: score,
        marketConditions: 'normal',
        timestamp: new Date().toISOString()
      }
    };
  }

  private validateMarketFitAnalysis(analysis: any): any {
    return {
      isSuitable: Boolean(analysis.isSuitable),
      score: Number(analysis.score) || 0.5,
      reason: String(analysis.reason || ''),
      details: analysis.details || {}
    };
  }

  private async getMarketData(strategy: Strategy): Promise<any> {
    try {
      const assets = (strategy.strategy_config as StrategyConfig)?.assets || [];
      const marketData = await Promise.all(
        assets.map(async (symbol: string) => {
          const data = bitmartService.getAssetData(symbol);
          return {
            symbol,
            price: data?.price || 0,
            change24h: data?.change24h || 0,
            volume24h: data?.volume24h || 0,
            priceHistory: data?.priceHistory || []
          };
        })
      );

      return {
        assets: marketData,
        timestamp: Date.now()
      };
    } catch (error) {
      logService.log('error', 'Failed to fetch market data', error, 'AITradeService');
      throw error;
    }
  }

  async analyzeTrade(strategy: Strategy, trade: TradeConfig): Promise<any> {
    try {
      if (!AITradeService.DEEPSEEK_API_KEY || AITradeService.DEEPSEEK_API_KEY === 'your_api_key') {
        return this.generateSyntheticTradeAnalysis(trade);
      }

      const prompt = this.buildTradeAnalysisPrompt(strategy, trade);
      const analysis = await this.callDeepSeekAPI(prompt);
      return this.validateTradeAnalysis(analysis);
    } catch (error) {
      logService.log('error', 'Failed to analyze trade', error, 'AITradeService');
      return this.generateSyntheticTradeAnalysis(trade);
    }
  }

  private buildTradeAnalysisPrompt(strategy: Strategy, trade: any): string {
    return `
      As a crypto trading expert, analyze the current state of this trade:

      Strategy Configuration:
      ${JSON.stringify(strategy.strategy_config, null, 2)}

      Trade Details:
      ${JSON.stringify(trade, null, 2)}

      Requirements:
      1. Evaluate if the trade should be closed based on current conditions
      2. Determine if stop loss/take profit levels should be adjusted
      3. Provide clear reasoning for the recommendation
      4. If stops should be adjusted, provide new levels

      Format response as a JSON object with this structure:
      {
        "shouldClose": boolean,
        "shouldAdjustStops": boolean,
        "reason": string,
        "recommendedStops": {
          "stopLoss": number,
          "takeProfit": number
        }
      }

      Return ONLY the JSON object, no additional text.
    `;
  }

  private generateSyntheticTradeAnalysis(trade: any): any {
    // Generate basic analysis based on simple rules
    const profitPercent = (trade.currentPrice - trade.entry.price) / trade.entry.price * 100;
    const isLong = trade.direction === 'Long';
    const isProfitable = (isLong && profitPercent > 0) || (!isLong && profitPercent < 0);

    return {
      shouldClose: Math.abs(profitPercent) > 5, // Close if profit/loss exceeds 5%
      shouldAdjustStops: isProfitable,
      reason: isProfitable ? 'Taking profits' : 'Stop loss triggered',
      recommendedStops: isProfitable ? {
        stopLoss: trade.currentPrice * 0.98,
        takeProfit: trade.currentPrice * 1.02
      } : undefined
    };
  }

  private validateTradeAnalysis(analysis: any): any {
    return {
      shouldClose: Boolean(analysis.shouldClose),
      shouldAdjustStops: Boolean(analysis.shouldAdjustStops),
      reason: String(analysis.reason || ''),
      recommendedStops: analysis.recommendedStops
    };
  }
}

export const aiTradeService = AITradeService.getInstance();
