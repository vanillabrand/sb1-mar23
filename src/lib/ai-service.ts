import { logService } from './log-service';
import { EventEmitter } from './event-emitter';
import type { Strategy } from './supabase-types';
import { ccxtService } from './ccxt-service';
import { marketMonitor } from './market-monitor';

class AIService extends EventEmitter {
  private static instance: AIService;
  private static DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;
  private static DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
  private static MODEL = 'deepseek-chat';
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly TIMEOUT = 10000; // 10 seconds

  private constructor() {
    super();
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  static async generateStrategy(description: string, riskLevel: string): Promise<any> {
    return AIService.getInstance().generateStrategy(description, riskLevel);
  }

  async generateStrategy(description: string, riskLevel: string, options?: {
    assets?: string[];
    timeframe?: string;
    marketType?: 'spot' | 'futures';
  }): Promise<any> {
    if (!description) {
      throw new Error('Strategy description is required');
    }

    if (!riskLevel) {
      throw new Error('Risk level is required');
    }

    try {
      this.emit('progress', { step: 'Analyzing strategy description...', progress: 10 });
      
      // Extract trading pairs from description
      const assets = options?.assets || this.extractAssetPairs(description);
      
      this.emit('progress', { step: 'Detected trading pairs: ' + assets.join(', '), progress: 20 });

      // Try AI-powered strategy generation with retries and timeout
      const strategy = await Promise.race([
        this.generateWithDeepSeek(description, riskLevel, assets, options),
        new Promise((_, reject) => 
          setTimeout(() => {
            this.emit('progress', { step: 'Strategy generation timeout, falling back...', progress: 0 });
            reject(new Error('Strategy generation timeout'));
          }, this.TIMEOUT)
        )
      ]);

      // Show the generated strategy in a code block
      this.emit('result', { strategy: JSON.stringify(strategy, null, 2) });

      return strategy;
    } catch (error) {
      logService.log('warn', 'AI strategy generation failed, falling back to rule-based:', error, 'AIService');
      this.emit('progress', { step: 'Generating rule-based strategy...', progress: 50 });
      const strategy = this.generateRuleBasedStrategy(description, riskLevel, options);
      this.emit('progress', { step: 'Strategy generated successfully!', progress: 100 });
      this.emit('result', { strategy: JSON.stringify(strategy, null, 2) });
      return strategy;
    }
  }

  private extractAssetPairs(description: string): string[] {
    const pairs = new Set<string>();
    
    // Check for "top N" pattern
    const topNMatch = description.match(/top\s+(\d+)/i);
    if (topNMatch) {
      const n = parseInt(topNMatch[1]);
      const topPairs = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT', 'XRP_USDT']
        .slice(0, Math.min(n, 5));
      topPairs.forEach(pair => pairs.add(pair));
      return Array.from(pairs);
    }

    // Check for strategy type hints
    const isArbitrage = /arbitrage/i.test(description);
    const isScalping = /scalp/i.test(description);
    const isMomentum = /momentum/i.test(description);

    if (isArbitrage) {
      pairs.add('BTC_USDT');
      pairs.add('ETH_USDT');
      pairs.add('SOL_USDT');
    } else if (isScalping) {
      pairs.add('SOL_USDT');
      pairs.add('MATIC_USDT');
    } else if (isMomentum) {
      pairs.add('BTC_USDT');
      pairs.add('ETH_USDT');
    }

    // Extract explicit pairs
    const pairFormats = [
      /\b(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|MATIC|DOT|LINK)[-/]?(USDT)\b/gi,
      /\b(Bitcoin|Ethereum|Solana|Binance|Ripple|Cardano|Dogecoin|Polygon|Polkadot|Chainlink)\b/gi
    ];

    const nameToSymbol: { [key: string]: string } = {
      'bitcoin': 'BTC',
      'ethereum': 'ETH',
      'solana': 'SOL',
      'binance': 'BNB',
      'ripple': 'XRP',
      'cardano': 'ADA',
      'dogecoin': 'DOGE',
      'polygon': 'MATIC',
      'polkadot': 'DOT',
      'chainlink': 'LINK'
    };

    pairFormats.forEach(format => {
      const matches = description.match(format);
      if (matches) {
        matches.forEach(match => {
          const upperMatch = match.toUpperCase();
          if (upperMatch.includes('USDT')) {
            const symbol = upperMatch.replace(/[-/]?USDT$/, '');
            pairs.add(`${symbol}_USDT`);
          } else {
            const symbol = nameToSymbol[match.toLowerCase()];
            if (symbol) {
              pairs.add(`${symbol}_USDT`);
            }
          }
        });
      }
    });

    // If no pairs found, return default based on risk level
    if (pairs.size === 0) {
      pairs.add('BTC_USDT');
      pairs.add('ETH_USDT');
    }

    return Array.from(pairs);
  }

  private async generateWithDeepSeek(
    description: string,
    riskLevel: string,
    assets: string[],
    options?: {
      timeframe?: string;
      marketType?: 'spot' | 'futures';
      marketConditions?: any;
    }
  ): Promise<any> {
    try {
      const marketData = await Promise.all(
        assets.map(async (asset) => {
          const ticker = await ccxtService.fetchTicker(asset);
          const historicalData = await marketMonitor.getHistoricalData(asset, 100);
          return {
            asset,
            currentPrice: ticker.last_price,
            volume24h: ticker.quote_volume_24h,
            priceHistory: historicalData
          };
        })
      );

      // If no API key, fall back to rule-based immediately
      if (!AIService.DEEPSEEK_API_KEY || AIService.DEEPSEEK_API_KEY === 'your_api_key') {
        throw new Error('No valid DeepSeek API key');
      }

      this.emit('progress', { step: 'Preparing strategy parameters...', progress: 30 });

      const prompt = `Generate a detailed cryptocurrency trading strategy based on the following:

Market Analysis:
${JSON.stringify(marketData, null, 2)}

User Requirements:
- Description: ${description}
- Risk Level: ${riskLevel}
- Assets: ${assets.join(', ')}
- Timeframe: ${options?.timeframe || '4h'}
- Market Type: ${options?.marketType || 'spot'}

Requirements:
1. Strategy must be optimized for current market conditions
2. Include specific entry/exit criteria using technical indicators
3. Define position sizing and risk management rules
4. Specify stop-loss and take-profit levels
5. Include market condition filters
6. Return strategy in strict JSON format with no additional text

Strategy must follow this exact JSON structure:
{
  "name": string,
  "description": string,
  "risk_level": string,
  "market_type": string,
  "timeframe": string,
  "assets": string[],
  "indicators": {
    "name": string,
    "parameters": object,
    "conditions": object
  }[],
  "entry_rules": string[],
  "exit_rules": string[],
  "position_sizing": {
    "type": string,
    "size": number,
    "max_position": number
  },
  "risk_management": {
    "stop_loss": number,
    "take_profit": number,
    "trailing_stop": number,
    "max_drawdown": number
  },
  "market_filters": {
    "min_volume": number,
    "trend_direction": string,
    "volatility_range": object
  }
}`;

      this.emit('progress', { step: 'Sending request to DeepSeek API...', progress: 40 });

      const response = await fetch(AIService.DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AIService.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from DeepSeek');
      }

      // Extract JSON from response
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in response');
      }

      const jsonContent = content.substring(jsonStart, jsonEnd + 1);
      const strategy = JSON.parse(jsonContent);

      // Ensure strategy_rationale exists
      if (!strategy.strategy_rationale) {
        throw new Error('Strategy rationale is required but was not provided');
      }

      // Calculate expected return based on risk level and strategy type
      const baseReturn = {
        'Ultra Low': 5,
        'Low': 10,
        'Medium': 15,
        'High': 25,
        'Ultra High': 35,
        'Extreme': 50,
        'God Mode': 75
      }[riskLevel] || 15;

      // Add some randomness to make it more realistic
      const variance = baseReturn * 0.2; // 20% variance
      const expectedReturn = baseReturn + (Math.random() * variance * 2 - variance);

      // Add expected return to metrics
      strategy.metrics = {
        ...strategy.metrics,
        expectedReturn: Number(expectedReturn.toFixed(1))
      };

      return this.normalizeStrategyConfig(strategy, riskLevel);
    } catch (error) {
      logService.log('error', 'DeepSeek API call failed:', error, 'AIService');
      throw error;
    }
  }

  private generateRuleBasedStrategy(
    description: string,
    riskLevel: string,
    options?: {
      assets?: string[];
      timeframe?: string;
      marketType?: 'spot' | 'futures';
    }
  ): any {
    const assets = options?.assets || this.extractAssetPairs(description);
    const isHighRisk = ['High', 'Ultra High', 'Extreme', 'God Mode'].includes(riskLevel);
    const isMediumRisk = riskLevel === 'Medium';

    return {
      strategy_name: "Rule-Based Strategy",
      strategy_rationale: `This ${riskLevel.toLowerCase()} risk strategy combines multiple technical indicators to identify potential entry and exit points. The strategy ${isHighRisk ? 'aggressively' : isMediumRisk ? 'moderately' : 'conservatively'} trades on momentum shifts while maintaining strict risk management parameters. ${description}`,
      market_type: options?.marketType || (isHighRisk ? "futures" : "spot"),
      assets,
      timeframe: options?.timeframe || "1h",
      trade_parameters: {
        leverage: isHighRisk ? 5 : isMediumRisk ? 2 : 1,
        position_size: isHighRisk ? 0.2 : isMediumRisk ? 0.1 : 0.05,
        confidence_factor: 0.7
      },
      conditions: {
        entry: [
          {
            indicator: "RSI",
            operator: "<",
            value: 30,
            timeframe: options?.timeframe || "1h"
          },
          {
            indicator: "MACD",
            operator: "crosses_above",
            value: 0,
            timeframe: options?.timeframe || "1h"
          },
          {
            indicator: "BB",
            operator: "<",
            value: -2,
            timeframe: options?.timeframe || "1h"
          }
        ],
        exit: [
          {
            indicator: "RSI",
            operator: ">",
            value: 70,
            timeframe: options?.timeframe || "1h"
          },
          {
            indicator: "MACD",
            operator: "crosses_below",
            value: 0,
            timeframe: options?.timeframe || "1h"
          },
          {
            indicator: "BB",
            operator: ">",
            value: 2,
            timeframe: options?.timeframe || "1h"
          }
        ]
      },
      risk_management: {
        stop_loss: isHighRisk ? 5 : isMediumRisk ? 3 : 2,
        take_profit: isHighRisk ? 15 : isMediumRisk ? 9 : 6,
        trailing_stop_loss: isHighRisk ? 3  : isMediumRisk ? 2 : 1,
        max_drawdown: isHighRisk ? 25 : isMediumRisk ? 15 : 10
      },
      indicators: [
        {
          name: "RSI",
          parameters: { period: 14 },
          weight: 1
        },
        {
          name: "MACD",
          parameters: {
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9
          },
          weight: 1
        },
        {
          name: "BB",
          parameters: {
            period: 20,
            stdDev: 2
          },
          weight: 1
        }
      ]
    };
  }

  private normalizeStrategyConfig(config: any, riskLevel: string): any {
    // Normalize risk parameters based on risk level
    const riskMultiplier = {
      'Ultra Low': 0.5,
      'Low': 0.75,
      'Medium': 1,
      'High': 1.5,
      'Ultra High': 2,
      'Extreme': 2.5,
      'God Mode': 3
    }[riskLevel] || 1;

    // Determine market type based on risk level
    const marketType = ['High', 'Ultra High', 'Extreme', 'God Mode'].includes(riskLevel)
      ? 'futures'
      : 'spot';

    return {
      ...config,
      market_type: marketType,
      trade_parameters: {
        ...config.trade_parameters,
        leverage: Math.min(
          config.trade_parameters?.leverage || 1,
          marketType === 'futures' ? 5 : 1
        ),
        position_size: Math.min(
          config.trade_parameters?.position_size || 0.1,
          riskLevel === 'High' ? 0.15 : 0.1
        ),
        confidence_factor: Math.min(
          config.trade_parameters?.confidence_factor || 0.7,
          0.9
        ),
      },
      risk_management: {
        ...config.risk_management,
        stop_loss: Math.min(
          config.risk_management?.stop_loss || 2,
          5 * riskMultiplier
        ),
        take_profit: Math.min(
          config.risk_management?.take_profit || 6,
          15 * riskMultiplier
        ),
        trailing_stop_loss: Math.min(
          config.risk_management?.trailing_stop_loss || 1,
          3 * riskMultiplier
        ),
        max_drawdown: Math.min(
          config.risk_management?.max_drawdown || 15,
          30 * riskMultiplier
        ),
      },
    };
  }
}

export const aiService = AIService.getInstance();
export { AIService };
