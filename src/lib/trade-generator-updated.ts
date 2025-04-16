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
  private readonly CHECK_FREQUENCY = 60000; // 1 minute
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

      // Get the selected pairs for this strategy
      const selectedPairs = strategy.selected_pairs || [];
      if (selectedPairs.length === 0) {
        logService.log('warn', `Strategy ${strategy.id} has no selected pairs`, null, 'TradeGenerator');
        return;
      }

      // Check each pair for trading opportunities
      for (const symbol of selectedPairs) {
        try {
          // Get current market data
          const marketData = await marketMonitor.getMarketData(symbol);
          if (!marketData) {
            logService.log('warn', `No market data available for ${symbol}`, null, 'TradeGenerator');
            continue;
          }

          // Get historical data for technical analysis
          const historicalData = await this.getHistoricalData(symbol);
          if (historicalData.length === 0) {
            logService.log('warn', `No historical data available for ${symbol}`, null, 'TradeGenerator');
            continue;
          }

          // Calculate indicators
          const indicators = await this.calculateIndicators(historicalData);

          // Generate trade signal
          const currentPrice = marketData.lastPrice;
          const signal = await this.generateTradeSignal(
            strategy,
            symbol,
            indicators,
            historicalData,
            marketData,
            currentPrice
          );

          if (signal) {
            // Emit event to notify that we're generating a trade
            eventBus.emit(`trade:generating:${strategy.id}`, {
              strategyId: strategy.id,
              symbol,
              signal
            });

            // Calculate position size
            const budget = tradeService.getBudget(strategy.id);
            if (!budget || budget.total <= 0) {
              logService.log('warn', `No budget set for strategy ${strategy.id}`, null, 'TradeGenerator');
              continue;
            }

            const positionSize = this.calculatePositionSize(
              strategy,
              symbol,
              signal.direction,
              currentPrice,
              budget.total,
              signal.confidence
            );

            // Create the trade
            const trade = {
              strategyId: strategy.id,
              symbol,
              side: signal.direction === 'Long' ? 'buy' : 'sell',
              type: 'market',
              amount: positionSize,
              price: currentPrice,
              status: 'pending',
              timestamp: Date.now(),
              rationale: signal.rationale
            };

            // Submit the trade
            const createdTrade = await tradeService.createTrade(trade);
            logService.log('info', `Created trade for strategy ${strategy.id}`, { trade: createdTrade }, 'TradeGenerator');

            // Update last generated time
            const state = this.monitorState.get(strategy.id);
            if (state) {
              state.lastGeneratedTime = Date.now();
              this.monitorState.set(strategy.id, state);
            }

            // Emit event to notify that a trade was created
            eventBus.emit(`trade:created:${strategy.id}`, {
              strategyId: strategy.id,
              trade: createdTrade
            });
          }
        } catch (symbolError) {
          logService.log('error', `Error checking trade opportunities for ${symbol}:`, symbolError, 'TradeGenerator');
        }
      }
    } catch (error) {
      logService.log('error', `Error checking trade opportunities for strategy ${strategy.id}:`, error, 'TradeGenerator');
      throw error;
    }
  }

  private async calculateIndicators(historicalData: any[]): Promise<IndicatorData[]> {
    const indicators: IndicatorData[] = [];

    try {
      // Extract close prices
      const closes = historicalData.map(candle => candle.close);

      // Calculate RSI
      if (closes.length >= 14) {
        const rsiConfig = {
          name: 'RSI',
          params: {
            period: 14
          }
        };
        const rsi = await indicatorService.calculateIndicator(rsiConfig, closes);
        indicators.push({
          name: 'RSI',
          value: rsi.value,
          timeframe: '5m'
        });
      }

      // Calculate MACD
      if (closes.length >= 26) {
        const macdConfig = {
          name: 'MACD',
          params: {
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
    currentPrice: number
  ): Promise<{
    direction: 'Long' | 'Short';
    confidence: number;
    rationale: string;
  } | null> {
    try {
      // Check if we're in demo mode
      const isDemo = demoService.isDemoMode();

      // In demo mode, use the DeepSeek API to generate trade signals
      if (isDemo) {
        return this.generateDemoTradeSignal(strategy, symbol, indicators, historicalData, marketState, currentPrice);
      }

      // In real mode, use the strategy's rules to generate trade signals
      return this.generateRealTradeSignal(strategy, symbol, indicators, historicalData, marketState, currentPrice);
    } catch (error) {
      logService.log('error', `Failed to generate trade signal for ${symbol}`, error, 'TradeGenerator');
      return null;
    }
  }

  private async generateDemoTradeSignal(
    strategy: Strategy,
    symbol: string,
    indicators: any[],
    historicalData: any[],
    marketState: any,
    currentPrice: number
  ): Promise<{
    direction: 'Long' | 'Short';
    confidence: number;
    rationale: string;
  } | null> {
    try {
      // Use DeepSeek API to generate trade signals
      const apiKey = this.DEEPSEEK_API_KEY;
      if (!apiKey) {
        logService.log('warn', 'No DeepSeek API key found, using random trade signals', null, 'TradeGenerator');
        return this.generateRandomTradeSignal(symbol);
      }

      // Prepare data for DeepSeek API
      const data = {
        symbol,
        indicators,
        historicalData: historicalData.slice(-10), // Only send the last 10 candles
        marketState,
        currentPrice,
        strategy: {
          id: strategy.id,
          name: strategy.name || strategy.title,
          description: strategy.description,
          riskLevel: strategy.risk_level
        }
      };

      // Call DeepSeek API
      const response = await fetch(`${config.deepseekApiUrl}/trading-signal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API returned ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      if (!result.signal) {
        return null; // No trade signal
      }

      return {
        direction: result.signal.direction,
        confidence: result.signal.confidence,
        rationale: result.signal.rationale
      };
    } catch (error) {
      logService.log('error', 'Error generating demo trade signal', error, 'TradeGenerator');
      // Fall back to random signals
      return this.generateRandomTradeSignal(symbol);
    }
  }

  private generateRandomTradeSignal(symbol: string): {
    direction: 'Long' | 'Short';
    confidence: number;
    rationale: string;
  } | null {
    // Only generate a signal 20% of the time
    if (Math.random() > 0.2) {
      return null;
    }

    const direction = Math.random() > 0.5 ? 'Long' : 'Short';
    const confidence = 0.5 + Math.random() * 0.5; // 0.5 to 1.0

    return {
      direction,
      confidence,
      rationale: `Random ${direction} signal generated for ${symbol} with ${Math.round(confidence * 100)}% confidence.`
    };
  }

  private async generateRealTradeSignal(
    strategy: Strategy,
    symbol: string,
    indicators: any[],
    historicalData: any[],
    marketState: any,
    currentPrice: number
  ): Promise<{
    direction: 'Long' | 'Short';
    confidence: number;
    rationale: string;
  } | null> {
    // Implement real trading logic based on strategy rules
    // This is a placeholder - real implementation would use the strategy's rules
    return null;
  }

  private calculatePositionSize(
    strategy: Strategy,
    symbol: string,
    direction: 'Long' | 'Short',
    currentPrice: number,
    availableBudget: number,
    confidence: number
  ): number {
    // Risk multiplier based on strategy risk level
    const riskMultiplier = {
      'Low Risk': 0.05,
      'Medium Risk': 0.1,
      'High Risk': 0.15,
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
      if (!strategy || !strategy.id) {
        logService.log('warn', 'Attempted to add invalid strategy to trade generator', { strategy }, 'TradeGenerator');
        return;
      }

      // Add to active strategies
      this.activeStrategies.set(strategy.id, strategy);
      this.monitorState.set(strategy.id, {
        isActive: true,
        lastCheckTime: 0,
        lastGeneratedTime: null
      });

      // Emit event to notify that the strategy is being monitored
      eventBus.emit(`trade:checking:${strategy.id}`, { strategyId: strategy.id });

      // Initialize strategy monitoring
      await this.initializeStrategyMonitoring(strategy);

      // Force immediate check for trade opportunities
      await this.checkStrategyForTrades(strategy);

      logService.log('info', `Strategy ${strategy.id} added to trade generator`,
        { strategy }, 'TradeGenerator');
    } catch (error) {
      logService.log('error', `Failed to add strategy ${strategy.id}`, error, 'TradeGenerator');
      throw error;
    }
  }

  private async initializeStrategyMonitoring(strategy: Strategy): Promise<void> {
    try {
      // Initialize strategy monitoring state
      this.monitorState.set(strategy.id, {
        isActive: true,
        lastCheckTime: 0,
        lastGeneratedTime: null
      });

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

  pauseMonitoring(strategyId: string): void {
    const state = this.monitorState.get(strategyId);
    if (state) {
      state.isActive = false;
      this.monitorState.set(strategyId, state);
      logService.log('info', `Paused monitoring for strategy ${strategyId}`, null, 'TradeGenerator');
    }
  }

  resumeMonitoring(strategyId: string): void {
    const state = this.monitorState.get(strategyId);
    if (state) {
      state.isActive = true;
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
}

export const tradeGenerator = TradeGenerator.getInstance();
