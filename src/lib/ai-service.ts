import { EventEmitter } from './event-emitter';
import { ccxtService } from './ccxt-service';
import { marketMonitor } from './market-monitor';
import { logService } from './log-service';

export class AIService extends EventEmitter {
  private static instance: AIService;
  private TIMEOUT = 60000; // 60 seconds timeout

  private constructor() {
    super();
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async generateStrategy(
    description: string,
    riskLevel: string,
    options?: {
      assets: string[];
      timeframe?: string;
      marketType?: 'spot' | 'futures';
    }
  ): Promise<any> {
    try {
      this.emit('progress', { step: 'Analyzing strategy description...', progress: 10 });
      
      const assets = options?.assets || this.extractAssetPairs(description);
      
      this.emit('progress', { step: 'Detected trading pairs: ' + assets.join(', '), progress: 20 });

      // Gather market data for better strategy generation
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

      this.emit('progress', { step: 'Analyzing market data...', progress: 40 });

      // Generate strategy with DeepSeek
      const strategy = await this.generateWithDeepSeek(
        description,
        riskLevel,
        assets,
        marketData,
        options
      );

      this.emit('progress', { step: 'Strategy generated successfully', progress: 100 });

      return strategy;
    } catch (error) {
      logService.log('error', 'Strategy generation failed:', error);
      throw error;
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
    marketData: any[],
    options?: any
  ): Promise<any> {
    // Implementation of DeepSeek API call
    // ... your existing implementation ...
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

// Export the singleton instance
export const aiService = AIService.getInstance();
