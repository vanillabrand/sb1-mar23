import { logService } from './log-service';
import type { Strategy } from './supabase-types';
import type { TradeConfig } from './types';

interface TradeSignal {
  symbol: string;
  direction: 'Long' | 'Short';
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

class AITradeService {
  private static instance: AITradeService;
  private static DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;
  private static DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
  // Use a stable key for each strategy rather than a unique timestamp per request
  private pendingRequests = new Map<string, Promise<TradeSignal[]>>();

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
    return `
      As a crypto trading expert, analyze the following data and generate trade signals:

      Strategy Configuration:
      ${JSON.stringify(strategy.strategy_config, null, 2)}

      Strategy Description:
      ${strategy.description}

      Risk Level: ${strategy.risk_level}
      Available Budget: ${budget} USDT

      Historical Market Data (last minute):
      ${JSON.stringify(historicalData.slice(-60), null, 2)}

      Requirements:
      1. Generate trade signals based on strategy rules and market conditions
      2. Consider risk level when determining position sizes
      3. Include stop loss and take profit levels
      4. Provide confidence score and rationale for each trade
      5. Ensure position sizes respect available budget
      6. Include relevant technical indicators

      Format response as a JSON array of trade signals with this structure:
      {
        "symbol": string,
        "direction": "Long" | "Short",
        "confidence": number (0-1),
        "entry": {
          "price": number,
          "type": "market" | "limit",
          "amount": number
        },
        "stopLoss": number,
        "takeProfit": number,
        "trailingStop": number (optional),
        "timeframe": string,
        "indicators": object,
        "rationale": string
      }

      Return ONLY the JSON array, no additional text.
    `;
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

      // Extract JSON from response by locating the first "[" and the last "]"
      const jsonStart = content.indexOf('[');
      const jsonEnd = content.lastIndexOf(']');

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON array found in response');
      }

      const jsonContent = content.substring(jsonStart, jsonEnd + 1);
      const trades = JSON.parse(jsonContent);

      return this.validateTrades(trades);
    } catch (error) {
      logService.log('error', 'Failed to generate trades with DeepSeek', error, 'AITradeService');
      return this.generateSyntheticTrades();
    }
  }

  private validateTrades(trades: any[]): TradeSignal[] {
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

  private generateSyntheticTrades(): TradeSignal[] {
    const symbols = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT'];
    const trades: TradeSignal[] = [];

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
}

export const aiTradeService = AITradeService.getInstance();
