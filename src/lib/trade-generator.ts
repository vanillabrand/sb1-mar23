
import { EventEmitter } from './event-emitter';
import { marketMonitor } from './market-monitor';
import { tradeManager } from './trade-manager';
import { tradeService } from './trade-service';
import { bitmartService } from './bitmart-service';
import { logService } from './log-service';
import { eventBus } from './event-bus';
import { demoService } from './demo-service';
import { indicatorService } from './indicators'; // Updated to use indicatorService instead
import type { Strategy } from './supabase-types';
import { config } from './config';

interface IndicatorData {
  name: string;
  value: number;
  signal?: number;
  timeframe: string;
}

class TradeGenerator extends EventEmitter {
  private static instance: TradeGenerator;
  private initialized: boolean = false;
  private readonly CHECK_FREQUENCY = 300000; // 5 minutes
  private readonly STRATEGY_ADAPTATION_INTERVAL = 180000; // 3 minutes
  private readonly LOOKBACK_PERIOD = 86400000; // 24 hours
  private activeStrategies: Map<string, Strategy> = new Map();
  private monitorState: Map<string, {
    isActive: boolean;
    lastCheckTime: number;
    lastGeneratedTime: number | null;
  }> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;

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

    // Set up interval for checking trading opportunities
    this.checkInterval = setInterval(() => {
      this.checkTradingOpportunities();
    }, this.CHECK_FREQUENCY);

    // Set up interval for strategy adaptation
    setInterval(() => {
      this.adaptActiveStrategies();
    }, this.STRATEGY_ADAPTATION_INTERVAL);

    // Subscribe to market analysis events for immediate trade generation
    eventBus.subscribe('market:tradingOpportunity', (analysis) => {
      this.handleTradingOpportunity(analysis);
    });

    logService.log('info', `Started checking for trading opportunities (every ${this.CHECK_FREQUENCY / 1000}s)`, null, 'TradeGenerator');
    logService.log('info', `Started strategy adaptation (every ${this.STRATEGY_ADAPTATION_INTERVAL / 60000} minutes)`, null, 'TradeGenerator');
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

        // Emit event to notify that we're checking this strategy
        eventBus.emit(`trade:checking:${strategyId}`, { strategyId });

        // Check for trade opportunities
        await this.checkStrategyForTrades(strategy);
      } catch (error) {
        logService.log('error', `Error checking trading opportunities for strategy ${strategyId}:`, error, 'TradeGenerator');
        // Emit error event
        eventBus.emit(`trade:error:${strategyId}`, { strategyId, error });
      }
    }
  }

  private async checkStrategyForTrades(strategy: Strategy) {
    try {
      logService.log('debug', `Checking trade opportunities for strategy ${strategy.id}`, null, 'TradeGenerator');

      if (!strategy.strategy_config?.assets) {
        throw new Error('Strategy has no configured trading pairs');
      }

      // Check if the strategy has available budget before proceeding
      const budget = await tradeService.getBudget(strategy.id);
      if (!budget || budget.available <= 0) {
        logService.log('warn', `Strategy ${strategy.id} has no available budget, skipping trade generation`, null, 'TradeGenerator');
        // Emit event to notify that we're skipping this strategy due to no budget
        eventBus.emit(`trade:error:${strategy.id}`, {
          strategyId: strategy.id,
          error: new Error('No available budget for trading')
        });

        // Also emit a budget update event to ensure UI is in sync
        if (budget) {
          eventBus.emit('budgetUpdated', {
            budgets: { [strategy.id]: {
              total: budget.total,
              allocated: budget.allocated,
              available: budget.available,
              profit: 0,
              profitPercentage: 0,
              allocationPercentage: budget.total > 0 ? (budget.allocated / budget.total) * 100 : 0
            }},
            availableBalance: walletBalanceService.getAvailableBalance()
          });
        }

        return; // Skip this strategy
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
          const marketState = marketMonitor.getMarketState(strategy.id);
          if (!marketState) {
            // If no market state exists for this strategy, initialize it
            await marketMonitor.updateMarketData(strategy);
            continue; // Skip this iteration and try again next time
          }

          // Calculate indicators
          const indicators = await this.calculateIndicators(strategy, historicalData);

          // Calculate budget before generating signal
          const budget = await tradeService.getBudget(strategy.id);
          if (!budget || budget.available <= 0) {
            logService.log('warn', `Strategy ${strategy.id} has no available budget for ${symbol}, skipping trade`, null, 'TradeGenerator');
            continue;
          }

          // Log budget information for debugging
          logService.log('info', `Budget for strategy ${strategy.id}: total=${budget.total}, available=${budget.available}, allocated=${budget.allocated}`, null, 'TradeGenerator');

          // Generate trade signal with budget information
          const signal = await this.generateTradeSignal(
            strategy,
            symbol,
            indicators,
            historicalData,
            marketState,
            currentPrice,
            budget.available
          );

          if (signal) {
            // Emit event to notify that we're generating a trade
            eventBus.emit(`trade:generating:${strategy.id}`, {
              strategyId: strategy.id,
              symbol,
              signal
            });

            // Calculate position size using the budget we already retrieved

            let positionSize = this.calculatePositionSize(
              strategy,
              budget.available,
              currentPrice,
              signal.confidence
            );

            // Check if position size is too small
            let positionValue = positionSize * currentPrice;
            const MIN_TRADE_VALUE = 5; // Minimum $5 trade as per exchange requirements

            if (positionValue < MIN_TRADE_VALUE) {
              logService.log('warn', `Calculated position size too small for ${symbol}: ${positionSize.toFixed(5)} (value: $${positionValue.toFixed(2)})`, null, 'TradeGenerator');

              // Instead of skipping, adjust to minimum size
              positionSize = MIN_TRADE_VALUE / currentPrice;
              positionValue = MIN_TRADE_VALUE; // Update position value to match
              logService.log('info', `Adjusted position size to minimum for ${symbol}: ${positionSize.toFixed(5)} (value: $${positionValue.toFixed(2)})`, null, 'TradeGenerator');
            }

            // Create a real trade instead of just emitting an event
            try {
              // Import dynamically to avoid circular dependencies
              const { tradeManager } = await import('./trade-manager');

              // Check if we're in demo mode
              const isDemoMode = demoService.isInDemoMode();

              // In demo mode, create multiple trades with different sizes to show variety
              if (isDemoMode) {
                logService.log('info', `Demo mode: Generating multiple trades for ${symbol}`, null, 'TradeGenerator');

                // Create an array to hold all trade results
                const tradeResults = [];

                // Number of trades to generate in demo mode (2-4 trades)
                const numTrades = 2 + Math.floor(Math.random() * 3);

                // Generate multiple trades with different sizes
                for (let i = 0; i < numTrades; i++) {
                  // Vary the position size for each trade (50-150% of calculated size)
                  const sizeMultiplier = 0.5 + Math.random();
                  const adjustedSize = positionSize * sizeMultiplier;

                  // Vary the side (buy/sell) for some trades to show variety
                  const tradeSide = (i === 0) ? // First trade uses the signal direction
                    (signal.direction === 'Long' ? 'buy' : 'sell') :
                    (Math.random() > 0.3 ? (signal.direction === 'Long' ? 'sell' : 'buy') : (signal.direction === 'Long' ? 'buy' : 'sell')); // Other trades might flip

                  // Create trade options
                  const tradeOptions = {
                    strategy_id: strategy.id,
                    symbol: symbol,
                    side: tradeSide,
                    type: 'market',
                    entry_price: currentPrice * (0.98 + Math.random() * 0.04), // Vary price slightly
                    amount: adjustedSize,
                    stop_loss: signal.stopLoss * (0.95 + Math.random() * 0.1), // Vary stop loss
                    take_profit: signal.takeProfit * (0.95 + Math.random() * 0.1), // Vary take profit
                    trailing_stop: signal.trailingStop,
                    testnet: true // Always use TestNet in demo mode
                  };

                  // Execute the trade
                  const tradeResult = await tradeManager.executeTrade(tradeOptions);
                  tradeResults.push(tradeResult);

                  // Emit events for each trade
                  this.emitTradeEvents(strategy, tradeResult, signal, currentPrice, adjustedSize);

                  // Add a small delay between trades to avoid overwhelming the UI
                  if (i < numTrades - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }
                }

                // Use the first trade result for the rest of the function
                var tradeResult = tradeResults[0];
              } else {
                // In live mode, just create a single trade
                const tradeOptions = {
                  strategy_id: strategy.id,
                  symbol: symbol,
                  side: signal.direction === 'Long' ? 'buy' : 'sell',
                  type: 'market',
                  entry_price: currentPrice,
                  amount: positionSize,
                  stop_loss: signal.stopLoss,
                  take_profit: signal.takeProfit,
                  trailing_stop: signal.trailingStop,
                  testnet: false // Not using TestNet in live mode
                };

                // Execute the trade
                var tradeResult = await tradeManager.executeTrade(tradeOptions);

                // Emit events for the trade
                this.emitTradeEvents(strategy, tradeResult, signal, currentPrice, positionSize);
              }

              // For backward compatibility, emit events for the first/only trade
              if (!isDemoMode) {
                // These events are now handled by emitTradeEvents for each trade
                // This code is kept for backward compatibility with existing code
                this.emit('tradeCreated', {
                  strategy,
                  trade: tradeResult,
                  signal: {
                    ...signal,
                    entry: {
                      price: currentPrice,
                      type: 'market',
                      amount: positionSize
                    }
                  }
                });

                // Also emit to the event bus for UI components to listen
                eventBus.emit('trade:created', {
                  strategy,
                  trade: tradeResult,
                  signal: {
                    ...signal,
                    entry: {
                      price: currentPrice,
                      type: 'market',
                      amount: positionSize
                    }
                  }
                });
              }

              // Emit strategy-specific event for UI components to listen
              eventBus.emit(`trade:created:${strategy.id}`, {
                strategyId: strategy.id,
                trade: tradeResult
              });

              // Update last generated time
              const state = this.monitorState.get(strategy.id);
              if (state) {
                state.lastGeneratedTime = Date.now();
                this.monitorState.set(strategy.id, state);
              }

              logService.log('info', `Created trade for ${symbol}`, {
                strategy: strategy.id,
                trade: tradeResult,
                signal
              }, 'TradeGenerator');
            } catch (tradeError) {
              logService.log('error', `Failed to create trade for ${symbol}`, tradeError, 'TradeGenerator');

              // Still emit the opportunity for monitoring purposes
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
            }
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
        const rsiConfig = {
          type: 'RSI',
          period: 14,
          parameters: {}
        };
        const rsi = await indicatorService.calculateIndicator(rsiConfig, closes);
        indicators.push({
          name: 'RSI',
          value: rsi.value,
          timeframe: '5m'
        });
      }

      // Calculate MACD
      if (strategy.strategy_config?.indicators?.includes('MACD')) {
        const macdConfig = {
          type: 'MACD',
          period: null,
          parameters: {
            fast_period: 12,
            slow_period: 26,
            signal_period: 9
          }
        };
        const macd = await indicatorService.calculateIndicator(macdConfig, closes);
        indicators.push({
          name: 'MACD',
          value: macd.value,
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
    currentPrice: number,
    availableBudget?: number
  ): Promise<{
    direction: 'Long' | 'Short';
    confidence: number;
    stopLoss: number;
    takeProfit: number;
    trailingStop?: number;
    rationale: string;
  } | null> {
    try {
      // Log that we're generating a trade signal
      logService.log('info', `Generating trade signal for ${symbol} (Strategy: ${strategy.id})`, {
        currentPrice,
        availableBudget,
        riskLevel: strategy.riskLevel
      }, 'TradeGenerator');

      // Prepare a more detailed prompt for DeepSeek
      const prompt = `Analyze this trading opportunity and generate a precise trade signal:

Strategy Configuration:
${JSON.stringify(strategy.strategy_config, null, 2)}

Current Market Data:
- Symbol: ${symbol}
- Current Price: ${currentPrice}
- Market State: ${JSON.stringify(marketState)}
- Risk Level: ${strategy.riskLevel || 'Medium'}
- Available Budget: $${availableBudget ? availableBudget.toFixed(2) : 'Unknown'}

Technical Indicators:
${JSON.stringify(indicators, null, 2)}

Historical Data (Last 10 Candles):
${JSON.stringify(historicalData.slice(-10), null, 2)}

Requirements:
1. Analyze if current conditions match strategy rules
2. Consider market state and indicators
3. Calculate precise entry, exit, and risk levels
4. Provide confidence score and detailed rationale
5. Ensure risk parameters match ${strategy.riskLevel || 'Medium'} risk level
6. Consider the available budget when determining position size
7. ONLY generate a trade if market conditions are favorable
8. If conditions are not favorable, return null or a confidence score below 0.5

Return ONLY a JSON object with this structure:
{
  "direction": "Long" | "Short",
  "confidence": number (0-1),
  "stopLoss": number (price level),
  "takeProfit": number (price level),
  "trailingStop": number (optional, percentage),
  "rationale": string (detailed explanation)
}`;

      const response = await fetch(config.getFullUrl(`${config.deepseekApiUrl}v1/chat/completions`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'DeepSeek-V3-0324',
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
    // Log inputs for debugging
    logService.log('debug', `Calculating position size with inputs:`, {
      strategyId: strategy.id,
      riskLevel: strategy.riskLevel,
      availableBudget,
      currentPrice,
      confidence
    }, 'TradeGenerator');

    // Get risk multiplier based on risk level
    const riskMultiplier = {
      'Ultra Low': 0.05,
      'Low': 0.1,
      'Medium': 0.15,
      'High': 0.2,
      'Ultra High': 0.25,
      'Extreme': 0.3,
      'God Mode': 0.5
    }[strategy.riskLevel] || 0.15;

    // In demo mode, use a more varied approach to generate different trade sizes
    if (demoService.isInDemoMode()) {
      // Add some randomness to make demo trades more varied
      const randomFactor = 0.7 + (Math.random() * 0.6); // 0.7 to 1.3 random factor

      // For demo mode, use a percentage of available budget with some randomness
      // This ensures we don't always use the same position size
      const demoBaseSize = availableBudget * riskMultiplier * randomFactor;

      // Apply confidence adjustment
      const demoConfidenceAdjustedSize = demoBaseSize * confidence;

      // Ensure we don't use more than 50% of available budget for a single trade in demo mode
      const demoMaxSize = availableBudget * 0.5;
      const demoFinalSize = Math.min(demoConfidenceAdjustedSize, demoMaxSize);

      // Calculate position size in asset units
      const demoPositionSize = demoFinalSize / currentPrice;

      // Round to appropriate decimal places based on price
      const roundedSize = this.roundPositionSize(demoPositionSize, currentPrice);

      logService.log('debug', `Demo mode position size calculation:`, {
        riskMultiplier,
        randomFactor,
        demoBaseSize,
        demoConfidenceAdjustedSize,
        demoMaxSize,
        demoFinalSize,
        demoPositionSize,
        roundedSize
      }, 'TradeGenerator');

      return roundedSize;
    }

    // For live mode, use a more conservative approach
    // Base position size on risk level and confidence
    const baseSize = availableBudget * riskMultiplier;
    const confidenceAdjustedSize = baseSize * confidence;

    // Get max position size from strategy config or use default
    const configMaxPositionSize = strategy.strategy_config?.trade_parameters?.position_size;
    const maxPositionSize = configMaxPositionSize !== undefined ? configMaxPositionSize : 0.1;

    // Ensure position size doesn't exceed max allowed
    const finalSize = Math.min(confidenceAdjustedSize, availableBudget * maxPositionSize);

    // Calculate actual position size in asset units
    const positionSize = finalSize / currentPrice;

    // Round position size appropriately based on price
    const roundedSize = this.roundPositionSize(positionSize, currentPrice);

    logService.log('debug', `Live mode position size calculation:`, {
      riskMultiplier,
      baseSize,
      confidenceAdjustedSize,
      maxPositionSize,
      finalSize,
      positionSize,
      roundedSize
    }, 'TradeGenerator');

    return roundedSize;
  }

  /**
   * Round position size appropriately based on asset price
   */
  private roundPositionSize(positionSize: number, price: number): number {
    // For high-value assets like BTC, round to more decimal places
    if (price >= 10000) {
      // For BTC: round to 6 decimal places (0.000001 BTC precision)
      return Math.floor(positionSize * 1e6) / 1e6;
    } else if (price >= 1000) {
      // For ETH and similar: round to 5 decimal places
      return Math.floor(positionSize * 1e5) / 1e5;
    } else if (price >= 100) {
      // For mid-priced assets: round to 4 decimal places
      return Math.floor(positionSize * 1e4) / 1e4;
    } else if (price >= 10) {
      // For lower-priced assets: round to 3 decimal places
      return Math.floor(positionSize * 1e3) / 1e3;
    } else if (price >= 1) {
      // For very low-priced assets: round to 2 decimal places
      return Math.floor(positionSize * 1e2) / 1e2;
    } else {
      // For extremely low-priced assets (like SHIB): round to 0 decimal places
      return Math.floor(positionSize);
    }
  }

  /**
   * Helper method to emit trade events for a newly created trade
   * @param strategy The strategy that generated the trade
   * @param trade The trade that was created
   * @param signal The signal that triggered the trade
   * @param price The current price of the asset
   * @param amount The amount of the asset being traded
   */
  private emitTradeEvents(
    strategy: Strategy,
    trade: any,
    signal: any,
    price: number,
    amount: number
  ): void {
    // Emit trade created event
    this.emit('tradeCreated', {
      strategy,
      trade,
      signal: {
        ...signal,
        entry: {
          price,
          type: 'market',
          amount
        }
      }
    });

    // Also emit to the event bus for UI components to listen
    eventBus.emit('trade:created', {
      strategy,
      trade,
      signal: {
        ...signal,
        entry: {
          price,
          type: 'market',
          amount
        }
      }
    });

    // Emit strategy-specific event for UI components to listen
    eventBus.emit(`trade:created:${strategy.id}`, {
      strategyId: strategy.id,
      trade
    });

    // Log the trade creation
    logService.log('info', `Created trade for ${trade.symbol} (Strategy: ${strategy.id})`, {
      trade,
      signal
    }, 'TradeGenerator');
  }

  /**
   * Handle trading opportunity from market analysis
   */
  private async handleTradingOpportunity(analysis: any): Promise<void> {
    try {
      const { symbol, strategyId, price, opportunityDetails } = analysis;

      if (!opportunityDetails) return;

      // Get the strategy
      const strategy = this.activeStrategies.get(strategyId);
      if (!strategy) {
        logService.log('warn', `Strategy ${strategyId} not found for trading opportunity`, null, 'TradeGenerator');
        return;
      }

      logService.log('info', `Processing trading opportunity for ${symbol} (Strategy: ${strategyId})`,
        { direction: opportunityDetails.direction, confidence: opportunityDetails.confidence },
        'TradeGenerator');

      // Generate trade using DeepSeek
      await this.generateTradeWithDeepSeek(
        strategy,
        symbol,
        price,
        opportunityDetails.direction === 'long' ? 'Long' : 'Short',
        opportunityDetails.confidence,
        opportunityDetails.rationale
      );
    } catch (error) {
      logService.log('error', 'Failed to handle trading opportunity', error, 'TradeGenerator');
    }
  }

  /**
   * Generate trade using DeepSeek API
   */
  private async generateTradeWithDeepSeek(
    strategy: Strategy,
    symbol: string,
    currentPrice: number,
    direction: 'Long' | 'Short',
    confidence: number,
    rationale: string
  ): Promise<void> {
    try {
      // Prepare prompt for DeepSeek
      const prompt = `Generate a detailed trade for the following opportunity:

Strategy Configuration:
${JSON.stringify(strategy.strategy_config, null, 2)}

Trading Opportunity:
- Symbol: ${symbol}
- Current Price: ${currentPrice}
- Direction: ${direction}
- Confidence: ${confidence}
- Rationale: ${rationale}
- Risk Level: ${strategy.risk_level}

Requirements:
1. Calculate precise entry price, stop loss, and take profit levels
2. Determine position size based on risk level (${strategy.risk_level})
3. Provide detailed entry and exit conditions
4. Include risk management parameters
5. Explain the trade rationale

Return ONLY a JSON object with this structure:
{
  "symbol": "${symbol}",
  "direction": "Long" | "Short",
  "entry": {
    "price": number,
    "type": "market" | "limit",
    "conditions": string[]
  },
  "exit": {
    "stopLoss": number,
    "takeProfit": number,
    "trailingStop": number (optional),
    "conditions": string[]
  },
  "positionSize": number,
  "riskRewardRatio": number,
  "rationale": string,
  "riskParameters": {
    "maxLoss": number,
    "maxDrawdown": number
  }
}`;

      // Call DeepSeek API
      const response = await fetch(config.getFullUrl(`${config.deepseekApiUrl}v1/chat/completions`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'DeepSeek-V3-0324',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 800
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

      const tradeDetails = JSON.parse(content.substring(jsonStart, jsonEnd + 1));

      // Validate trade details
      if (!tradeDetails.symbol || !tradeDetails.direction || !tradeDetails.entry || !tradeDetails.exit) {
        throw new Error('Invalid trade details format');
      }

      // Create trade
      const trade = {
        id: `trade-${Date.now()}-${Math.floor(Math.random() * 1000000)}-${Math.random().toString(36).substring(2, 15)}`,
        strategy_id: strategy.id,
        symbol: tradeDetails.symbol,
        side: tradeDetails.direction === 'Long' ? 'buy' : 'sell',
        type: tradeDetails.entry.type || 'market',
        status: 'open',
        entry_price: tradeDetails.entry.price || currentPrice,
        stop_loss: tradeDetails.exit.stopLoss,
        take_profit: tradeDetails.exit.takeProfit,
        trailing_stop: tradeDetails.exit.trailingStop,
        position_size: tradeDetails.positionSize,
        entry_conditions: tradeDetails.entry.conditions,
        exit_conditions: tradeDetails.exit.conditions,
        rationale: tradeDetails.rationale,
        risk_reward_ratio: tradeDetails.riskRewardRatio,
        timestamp: Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Save trade to database
      await tradeService.createTrade(trade);

      // Emit events
      this.emit('tradeGenerated', { strategy, trade });
      eventBus.emit('trade:created', { strategy, trade });
      eventBus.emit(`trade:created:${strategy.id}`, { strategyId: strategy.id, trade });

      logService.log('info', `Generated trade for ${symbol} using DeepSeek`, { trade }, 'TradeGenerator');
    } catch (error) {
      logService.log('error', `Failed to generate trade with DeepSeek for ${symbol}`, error, 'TradeGenerator');
    }
  }

  /**
   * Adapt active strategies based on current market conditions
   */
  private async adaptActiveStrategies(): Promise<void> {
    try {
      if (this.activeStrategies.size === 0) return;

      logService.log('info', `Adapting ${this.activeStrategies.size} active strategies to current market conditions`, null, 'TradeGenerator');

      // Process each active strategy
      for (const [strategyId, strategy] of this.activeStrategies.entries()) {
        try {
          await this.adaptStrategy(strategy);
        } catch (error) {
          logService.log('error', `Failed to adapt strategy ${strategyId}`, error, 'TradeGenerator');
        }
      }

      logService.log('info', 'Strategy adaptation completed', null, 'TradeGenerator');
    } catch (error) {
      logService.log('error', 'Failed to adapt active strategies', error, 'TradeGenerator');
    }
  }

  /**
   * Adapt a single strategy based on current market conditions
   */
  private async adaptStrategy(strategy: Strategy): Promise<void> {
    try {
      const strategyId = strategy.id;
      logService.log('info', `Adapting strategy ${strategyId} to current market conditions`, null, 'TradeGenerator');

      // Get the trading pairs for this strategy
      const tradingPairs = strategy.selected_pairs || [];
      if (tradingPairs.length === 0) {
        logService.log('warn', `Strategy ${strategyId} has no trading pairs`, null, 'TradeGenerator');
        return;
      }

      // Get historical data for each pair
      const historicalDataBySymbol: Record<string, any[]> = {};
      for (const symbol of tradingPairs) {
        try {
          // Get historical data from market monitor
          const marketData = marketMonitor.getMarketData(symbol);
          if (marketData && marketData.candles && marketData.candles.length > 0) {
            historicalDataBySymbol[symbol] = marketData.candles;
          } else {
            // Fallback to getting candles directly
            const candles = await bitmartService.getKlines(symbol, Math.floor((Date.now() - 86400000) / 1000), Math.floor(Date.now() / 1000), '1h');
            historicalDataBySymbol[symbol] = candles.map(kline => ({
              timestamp: kline[0],
              open: parseFloat(kline[1]),
              high: parseFloat(kline[2]),
              low: parseFloat(kline[3]),
              close: parseFloat(kline[4]),
              volume: parseFloat(kline[5])
            }));
          }
        } catch (error) {
          logService.log('error', `Failed to get historical data for ${symbol}`, error, 'TradeGenerator');
        }
      }

      // Get current market conditions
      const marketConditions = {};
      for (const symbol of tradingPairs) {
        try {
          const state = marketMonitor.getMarketState(symbol);
          if (state) {
            marketConditions[symbol] = state;
          }
        } catch (error) {
          logService.log('error', `Failed to get market state for ${symbol}`, error, 'TradeGenerator');
        }
      }

      // Prepare prompt for DeepSeek
      const prompt = `Analyze this trading strategy and adapt it to current market conditions:

Strategy Configuration:
${JSON.stringify(strategy.strategy_config, null, 2)}

Strategy Details:
- ID: ${strategy.id}
- Name: ${strategy.name || 'Unnamed Strategy'}
- Risk Level: ${strategy.riskLevel || 'Medium'}
- Status: ${strategy.status || 'active'}

Current Market Conditions:
${JSON.stringify(marketConditions, null, 2)}

Historical Market Data (Sample):
${JSON.stringify(Object.fromEntries(Object.entries(historicalDataBySymbol).map(([symbol, data]) => [symbol, data.slice(-5)])), null, 2)}

Requirements:
1. Analyze the strategy's performance in current market conditions
2. Suggest optimizations to improve performance
3. Adapt entry and exit conditions based on current market trends
4. Adjust risk parameters if needed
5. Keep the strategy's core approach and risk level consistent
6. ONLY make changes if they will improve performance
7. If current configuration is optimal, return it unchanged

Return ONLY a JSON object with the updated strategy configuration:
{
  "name": string,
  "description": string,
  "type": string,
  "indicators": string[],
  "selected_pairs": string[],
  "entry_conditions": {
    // Strategy-specific entry conditions
  },
  "exit_conditions": {
    // Strategy-specific exit conditions
  },
  "risk_parameters": {
    // Risk management parameters
  },
  "rationale": string
}`;

      // Call DeepSeek API
      const response = await fetch(config.getFullUrl(`${config.deepseekApiUrl}v1/chat/completions`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'DeepSeek-V3-0324',
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
        throw new Error('Empty response from DeepSeek');
      }

      // Extract JSON from response
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in response');
      }

      const updatedConfig = JSON.parse(content.substring(jsonStart, jsonEnd + 1));

      // Validate updated config
      if (!updatedConfig.name || !updatedConfig.type || !updatedConfig.selected_pairs) {
        throw new Error('Invalid updated strategy configuration');
      }

      // Update strategy with new configuration
      const updatedStrategy = {
        ...strategy,
        name: updatedConfig.name,
        description: updatedConfig.description,
        strategy_config: {
          ...strategy.strategy_config,
          ...updatedConfig
        },
        updated_at: new Date().toISOString()
      };

      // Save updated strategy to database
      await strategyService.updateStrategy(strategyId, updatedStrategy);

      // Update local cache
      this.activeStrategies.set(strategyId, updatedStrategy);

      // Emit events
      this.emit('strategyAdapted', updatedStrategy);
      eventBus.emit('strategy:updated', { strategy: updatedStrategy });
      eventBus.emit(`strategy:updated:${strategyId}`, { strategyId, strategy: updatedStrategy });

      logService.log('info', `Successfully adapted strategy ${strategyId}`, {
        oldConfig: strategy.strategy_config,
        newConfig: updatedConfig
      }, 'TradeGenerator');
    } catch (error) {
      logService.log('error', `Failed to adapt strategy ${strategy.id}`, error, 'TradeGenerator');
    }
  }

  async addStrategy(strategy: Strategy): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Ensure strategy has assets configured
      if (!strategy.strategy_config) {
        strategy.strategy_config = {};
      }

      if (!strategy.strategy_config.assets) {
        // Try to get assets from selected_pairs
        if (strategy.selected_pairs && strategy.selected_pairs.length > 0) {
          strategy.strategy_config.assets = strategy.selected_pairs;
        } else {
          // Default to BTC/USDT if no assets are found
          strategy.strategy_config.assets = ['BTC/USDT'];
          logService.log('warn', `No assets found for strategy ${strategy.id}, defaulting to BTC/USDT`, null, 'TradeGenerator');
        }
      }

      logService.log('info', `Adding strategy ${strategy.id} to trade generator`, null, 'TradeGenerator');

      // Add to active strategies and initialize monitoring state
      this.activeStrategies.set(strategy.id, strategy);
      this.monitorState.set(strategy.id, {
        isActive: true,
        lastCheckTime: 0, // Force immediate check
        lastGeneratedTime: null
      });

      // Emit initial checking event to update UI
      eventBus.emit(`trade:checking:${strategy.id}`, { strategyId: strategy.id });

      // Force immediate check for trade opportunities
      setTimeout(() => {
        this.checkStrategyForTrades(strategy).catch(error => {
          logService.log('error', `Error in initial trade check for strategy ${strategy.id}`, error, 'TradeGenerator');
        });
      }, 1000);

      // Subscribe to market data for each asset
      for (const symbol of strategy.strategy_config.assets) {
        try {
          // Try to subscribe via bitmartService if available
          if (typeof bitmartService.subscribeToSymbol === 'function') {
            await bitmartService.subscribeToSymbol(symbol);
            logService.log('info', `Subscribed to ${symbol} via bitmartService`, null, 'TradeGenerator');
          } else {
            // Fall back to market monitor if bitmartService subscription is not available
            logService.log('info', `bitmartService.subscribeToSymbol not available, using marketMonitor for ${symbol}`, null, 'TradeGenerator');
          }

          // Always add to market monitor
          await marketMonitor.addAsset(symbol);
        } catch (subscribeError) {
          logService.log('warn', `Failed to subscribe to ${symbol}, continuing with other assets`, subscribeError, 'TradeGenerator');
          // Continue with other assets
        }
      }

      // Force immediate check for trade opportunities
      await this.checkStrategyForTrades(strategy);

      logService.log('info', `Strategy ${strategy.id} added to trade generator`,
        { strategy }, 'TradeGenerator');
    } catch (error) {
      logService.log('error', `Failed to add strategy ${strategy.id}`, error, 'TradeGenerator');
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

  // Check if a strategy is being monitored
  isStrategyMonitored(strategyId: string): boolean {
    const state = this.monitorState.get(strategyId);
    return !!state && state.isActive;
  }

  // Get the last time a strategy was checked for trade opportunities
  getLastCheckTime(strategyId: string): number | null {
    const state = this.monitorState.get(strategyId);
    return state ? state.lastCheckTime : null;
  }

  // Get the last time a trade was generated for a strategy
  getLastGeneratedTime(strategyId: string): number | null {
    const state = this.monitorState.get(strategyId);
    return state ? state.lastGeneratedTime : null;
  }

  /**
   * Public method to check trade opportunities for a specific strategy
   * This allows external components to trigger a trade check
   * @param strategyId The ID of the strategy to check
   */
  async checkTradeOpportunities(strategyId: string): Promise<void> {
    try {
      const strategy = this.activeStrategies.get(strategyId);
      if (!strategy) {
        logService.log('warn', `Strategy ${strategyId} not found for trade opportunity check`, null, 'TradeGenerator');
        return;
      }

      // Update last check time
      const state = this.monitorState.get(strategyId);
      if (state) {
        state.lastCheckTime = Date.now();
        this.monitorState.set(strategyId, state);
      }

      // Emit event to notify that we're checking this strategy
      eventBus.emit(`trade:checking:${strategyId}`, { strategyId });

      // Check for trade opportunities
      await this.checkStrategyForTrades(strategy);

      logService.log('info', `Completed trade opportunity check for strategy ${strategyId}`, null, 'TradeGenerator');
    } catch (error) {
      logService.log('error', `Error checking trade opportunities for strategy ${strategyId}`, error, 'TradeGenerator');
      // Emit error event
      eventBus.emit(`trade:error:${strategyId}`, { strategyId, error });
    }
  }
}

export const tradeGenerator = TradeGenerator.getInstance();
