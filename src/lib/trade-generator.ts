import { EventEmitter } from './event-emitter';
import { marketMonitor } from './market-monitor';
import { tradeManager } from './trade-manager';
import { tradeService } from './trade-service';
import { bitmartService } from './bitmart-service';
import { logService } from './log-service';
import { technicalIndicators } from '@/lib/technical-indicators';
import type { Strategy } from './supabase-types';

interface IndicatorData {
  name: string;
  value: number;
  signal?: number;
  timeframe: string;
}

class TradeGenerator extends EventEmitter {
  private static instance: TradeGenerator;
  private initialized: boolean = false;
  private readonly CHECK_FREQUENCY = 60000; // 1 minute
  private readonly LOOKBACK_PERIOD = 86400000; // 24 hours
  private activeStrategies: Map<string, Strategy> = new Map();
  private monitorState: Map<string, { isActive: boolean; lastCheckTime: number }> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
  }

  static getInstance(): TradeGenerator {
    if (!TradeGenerator.instance) {
      TradeGenerator.instance = new TradeGenerator();
    }
    return TradeGenerator.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      logService.log('info', 'Initializing trade generator', null, 'TradeGenerator');
      
      // Start periodic check for trading opportunities
      this.startPeriodicCheck();
      
      this.initialized = true;
      logService.log('info', 'Trade generator initialized', null, 'TradeGenerator');
    } catch (error) {
      logService.log('error', 'Failed to initialize trade generator', error, 'TradeGenerator');
      throw error;
    }
  }

  private startPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkTradingOpportunities();
    }, this.CHECK_FREQUENCY);
    
    logService.log('info', `Started checking for trading opportunities (every ${this.CHECK_FREQUENCY / 1000}s)`, null, 'TradeGenerator');
  }

  private async checkTradingOpportunities() {
    if (this.activeStrategies.size === 0) return;
    
    logService.log('debug', `Checking trading opportunities for ${this.activeStrategies.size} strategies`, null, 'TradeGenerator');
    
    for (const [strategyId, strategy] of this.activeStrategies.entries()) {
      try {
        const state = this.monitorState.get(strategyId);
        if (!state || !state.isActive) continue;
        
        // Skip if checked too recently
        const now = Date.now();
        if (now - state.lastCheckTime < this.CHECK_FREQUENCY) continue;
        
        // Update last check time
        state.lastCheckTime = now;
        this.monitorState.set(strategyId, state);

        // Check for trade opportunities
        await this.checkStrategyForTrades(strategy);
      } catch (error) {
        logService.log('error', `Error checking trading opportunities for strategy ${strategyId}:`, error, 'TradeGenerator');
      }
    }
  }

  private async checkStrategyForTrades(strategy: Strategy) {
    try {
      logService.log('debug', `Checking trade opportunities for strategy ${strategy.id}`, null, 'TradeGenerator');

      if (!strategy.strategy_config?.assets) {
        throw new Error('Strategy has no configured trading pairs');
      }
      
      // Check each asset for trading opportunities
      for (const symbol of strategy.strategy_config.assets) {
        try {
          // Get historical data
          const historicalData = await this.getHistoricalData(symbol);
          if (!historicalData || historicalData.length === 0) continue;

          // Get current market data
          const ticker = await bitmartService.getTicker(symbol);
          const currentPrice = parseFloat(ticker.last_price);
          
          // Get market state
          const marketState = marketMonitor.getMarketState(symbol);
          if (!marketState) continue;

          // Calculate indicators
          const indicators = await this.calculateIndicators(strategy, historicalData);

          // Generate trade signal
          const signal = await this.generateTradeSignal(
            strategy,
            symbol,
            indicators,
            historicalData,
            marketState,
            currentPrice
          );

          if (signal) {
            // Calculate position size
            const budget = await tradeService.getBudget(strategy.id);
            if (!budget || budget.available <= 0) continue;

            const positionSize = this.calculatePositionSize(
              strategy,
              budget.available,
              currentPrice,
              signal.confidence
            );

            // Emit trade opportunity
            this.emit('tradeOpportunity', {
              strategy,
              signal: {
                ...signal,
                entry: {
                  price: currentPrice,
                  type: 'market',
                  amount: positionSize
                }
              }
            });

            logService.log('info', `Generated trade signal for ${symbol}`, {
              strategy: strategy.id,
              signal
            }, 'TradeGenerator');
          }
        } catch (error) {
          logService.log('error', `Error processing ${symbol} for strategy ${strategy.id}`, error, 'TradeGenerator');
        }
      }
    } catch (error) {
      logService.log('error', `Error checking strategy ${strategy.id} for trades`, error, 'TradeGenerator');
    }
  }

  private async updateMonitorState(
    strategyId: string,
    update: Partial<MonitorState>
  ): Promise<void> {
    const currentState = this.monitorState.get(strategyId) || {
      isActive: false,
      lastCheckTime: 0
    };
    
    this.monitorState.set(strategyId, {
      ...currentState,
      ...update
    });
  }

  private async evaluateConditions(strategy: Strategy, indicators: any[], marketState: any) {
    const conditions = [];
    
    // Evaluate RSI conditions
    if (indicators.RSI) {
      conditions.push({
        name: 'RSI',
        value: indicators.RSI,
        target: 30,
        met: indicators.RSI < 30 || indicators.RSI > 70
      });
    }
    
    // Evaluate MACD conditions
    if (indicators.MACD && indicators.signal) {
      conditions.push({
        name: 'MACD Crossover',
        value: indicators.MACD,
        target: indicators.signal,
        met: Math.abs(indicators.MACD - indicators.signal) > 0
      });
    }
    
    // Add more conditions based on strategy configuration...
    
    return conditions;
  }

  private async calculateIndicators(strategy: Strategy, data: any[]): Promise<IndicatorData[]> {
    const indicators: IndicatorData[] = [];
    const closes = data.map(d => d.close);

    try {
      // Calculate RSI
      if (strategy.strategy_config?.indicators?.includes('RSI')) {
        const rsi = await technicalIndicators.calculateRSI(closes, 14);
        indicators.push({
          name: 'RSI',
          value: rsi,
          timeframe: '5m'
        });
      }

      // Calculate MACD
      if (strategy.strategy_config?.indicators?.includes('MACD')) {
        const macd = await technicalIndicators.calculateMACD(closes, 12, 26, 9);
        indicators.push({
          name: 'MACD',
          value: macd.macd,
          signal: macd.signal,
          timeframe: '5m'
        });
      }

      // Add more indicators as needed...

      return indicators;
    } catch (error) {
      logService.log('error', 'Error calculating indicators', error, 'TradeGenerator');
      return indicators;
    }
  }

  private async getHistoricalData(symbol: string): Promise<any[]> {
    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = Math.floor((Date.now() - this.LOOKBACK_PERIOD) / 1000);

      const klines = await bitmartService.getKlines(symbol, startTime, endTime, '1m');
      return klines.map(kline => ({
        timestamp: kline[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5])
      }));
    } catch (error) {
      logService.log('error', `Failed to get historical data for ${symbol}`, error, 'TradeGenerator');
      return [];
    }
  }

  private async generateTradeSignal(
    strategy: Strategy,
    symbol: string,
    indicators: any[],
    historicalData: any[],
    marketState: any,
    currentPrice: number
  ): Promise<{
    direction: 'Long' | 'Short';
    confidence: number;
    stopLoss: number;
    takeProfit: number;
    trailingStop?: number;
    rationale: string;
  } | null> {
    try {
      const prompt = `Analyze this trading opportunity and generate a precise trade signal:

Strategy Configuration:
${JSON.stringify(strategy.strategy_config, null, 2)}

Current Market Data:
- Symbol: ${symbol}
- Current Price: ${currentPrice}
- Market State: ${JSON.stringify(marketState)}
- Risk Level: ${strategy.risk_level}

Technical Indicators:
${JSON.stringify(indicators, null, 2)}

Historical Data (Last 5 Minutes):
${JSON.stringify(historicalData.slice(-5), null, 2)}

Requirements:
1. Analyze if current conditions match strategy rules
2. Consider market state and indicators
3. Calculate precise entry, exit, and risk levels
4. Provide confidence score and detailed rationale
5. Ensure risk parameters match ${strategy.risk_level} risk level

Return ONLY a JSON object with this structure:
{
  "direction": "Long" | "Short",
  "confidence": number (0-1),
  "stopLoss": number (price level),
  "takeProfit": number (price level),
  "trailingStop": number (optional, percentage),
  "rationale": string (detailed explanation)
}`;

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 500
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

      const signal = JSON.parse(content.substring(jsonStart, jsonEnd + 1));

      // Validate signal
      if (!signal.direction || !signal.confidence || !signal.stopLoss || !signal.takeProfit || !signal.rationale) {
        throw new Error('Invalid trade signal format');
      }

      return signal;
    } catch (error) {
      logService.log('error', 'Failed to generate trade signal', error, 'TradeGenerator');
      return null;
    }
  }

  private calculatePositionSize(
    strategy: Strategy,
    availableBudget: number,
    currentPrice: number,
    confidence: number
  ): number {
    const riskMultiplier = {
      'Ultra Low': 0.05,
      'Low': 0.1,
      'Medium': 0.15,
      'High': 0.2,
      'Ultra High': 0.25,
      'Extreme': 0.3,
      'God Mode': 0.5
    }[strategy.risk_level] || 0.15;

    // Base position size on risk level and confidence
    const baseSize = availableBudget * riskMultiplier;
    const confidenceAdjustedSize = baseSize * confidence;

    // Ensure position size doesn't exceed max allowed
    const maxPositionSize = strategy.strategy_config?.trade_parameters?.position_size || 0.1;
    const finalSize = Math.min(confidenceAdjustedSize, availableBudget * maxPositionSize);

    // Calculate actual position size in asset units
    const positionSize = finalSize / currentPrice;

    // Round to 8 decimal places for crypto
    return Math.floor(positionSize * 1e8) / 1e8;
  }

  async addStrategy(strategy: Strategy): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!strategy.strategy_config?.assets) {
        throw new Error('Strategy has no assets configured');
      }
      
      logService.log('info', `Adding strategy ${strategy.id} to trade generator`, null, 'TradeGenerator');
      
      // Add to active strategies and initialize monitoring state
      this.activeStrategies.set(strategy.id, strategy);
      this.monitorState.set(strategy.id, {
        isActive: true,
        lastCheckTime: 0 // Force immediate check
      });
      
      // Subscribe to market data for each asset
      for (const symbol of strategy.strategy_config.assets) {
        bitmartService.subscribeToSymbol(symbol);
        await marketMonitor.addAsset(symbol);
      }
      
      // Force immediate trade check for new strategies
      await this.checkStrategyForTrades(strategy);
      
      logService.log('info', `Strategy ${strategy.id} added to trade generator`, null, 'TradeGenerator');
    } catch (error) {
      logService.log('error', `Failed to add strategy ${strategy.id} to trade generator`, error, 'TradeGenerator');
      throw error;
    }
  }

  removeStrategy(strategyId: string): void {
    try {
      const strategy = this.activeStrategies.get(strategyId);
      if (!strategy) return;

      // Remove strategy from active lists
      this.activeStrategies.delete(strategyId);
      this.monitorState.delete(strategyId);

      // Unsubscribe from market data if no other strategy uses the asset
      if (strategy.strategy_config?.assets) {
        for (const asset of strategy.strategy_config.assets) {
          const isUsedByOtherStrategy = Array.from(this.activeStrategies.values())
            .some(s => s.strategy_config?.assets?.includes(asset));
          if (!isUsedByOtherStrategy) {
            bitmartService.unsubscribeFromSymbol(asset);
            marketMonitor.removeAsset(asset);
          }
        }
      }

      logService.log('info', `Strategy ${strategyId} removed from trade generator`, null, 'TradeGenerator');
    } catch (error) {
      logService.log('error', `Error removing strategy ${strategyId}`, error, 'TradeGenerator');
    }
  }

  getActiveStrategies(): Strategy[] {
    return Array.from(this.activeStrategies.values());
  }

  isMonitoringStrategy(strategyId: string): boolean {
    const state = this.monitorState.get(strategyId);
    return !!state && state.isActive;
  }

  pauseStrategy(strategyId: string): void {
    const state = this.monitorState.get(strategyId);
    if (state) {
      state.isActive = false;
      this.monitorState.set(strategyId, state);
      logService.log('info', `Paused monitoring for strategy ${strategyId}`, null, 'TradeGenerator');
    }
  }

  resumeStrategy(strategyId: string): void {
    const state = this.monitorState.get(strategyId);
    if (state) {
      state.isActive = true;
      state.lastCheckTime = Date.now() - this.CHECK_FREQUENCY; // Allow immediate check
      this.monitorState.set(strategyId, state);
      logService.log('info', `Resumed monitoring for strategy ${strategyId}`, null, 'TradeGenerator');
    }
  }

  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.activeStrategies.clear();
    this.monitorState.clear();
    this.initialized = false;
    logService.log('info', 'Trade generator cleaned up', null, 'TradeGenerator');
  }
}

export const tradeGenerator = TradeGenerator.getInstance();
