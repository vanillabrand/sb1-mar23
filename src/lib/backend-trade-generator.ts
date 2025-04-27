import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { supabase } from './supabase';
import { marketMonitor } from './market-monitor';
import { tradeManager } from './trade-manager';
import { tradeService } from './trade-service';
import { demoService } from './demo-service';
import { eventBus } from './event-bus';
import type { Strategy } from './types';

/**
 * Backend Trade Generator
 *
 * This class handles trade generation for multiple users with many strategies
 * It uses a worker pool approach to distribute the load and prevent performance issues
 */
class BackendTradeGenerator extends EventEmitter {
  private static instance: BackendTradeGenerator;
  private initialized: boolean = false;
  private readonly CHECK_FREQUENCY = 60000; // 1 minute
  private readonly MAX_CONCURRENT_CHECKS = 5; // Maximum number of concurrent strategy checks
  private readonly STRATEGY_CHECK_TIMEOUT = 30000; // 30 seconds timeout for each strategy check

  private activeStrategies: Map<string, Strategy> = new Map();
  private strategyQueue: string[] = []; // Queue of strategy IDs to check
  private activeChecks: Set<string> = new Set(); // Set of strategy IDs currently being checked
  private checkInterval: NodeJS.Timeout | null = null;
  private lastPrices: Map<string, number> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private strategyLastCheckTime: Map<string, number> = new Map();
  private strategyCheckFrequency: Map<string, number> = new Map();

  private constructor() {
    super();
  }

  static getInstance(): BackendTradeGenerator {
    if (!BackendTradeGenerator.instance) {
      BackendTradeGenerator.instance = new BackendTradeGenerator();
    }
    return BackendTradeGenerator.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logService.log('info', 'Initializing backend trade generator', null, 'BackendTradeGenerator');

      // Initialize price history for common pairs
      this.initializePriceHistory();

      // Start the worker pool for checking strategies
      this.startWorkerPool();

      this.initialized = true;
      logService.log('info', 'Backend trade generator initialized', null, 'BackendTradeGenerator');
    } catch (error) {
      logService.log('error', 'Failed to initialize backend trade generator', error, 'BackendTradeGenerator');
      throw error;
    }
  }

  private initializePriceHistory() {
    // Initialize with some realistic starting prices
    const initialPrices = {
      'BTC/USDT': 65000,
      'ETH/USDT': 3500,
      'SOL/USDT': 150,
      'BNB/USDT': 600,
      'XRP/USDT': 0.55,
      'ADA/USDT': 0.45,
      'DOGE/USDT': 0.15,
      'SHIB/USDT': 0.00002,
      'AVAX/USDT': 35,
      'DOT/USDT': 7.5
    };

    // Set initial prices and create empty history arrays
    Object.entries(initialPrices).forEach(([symbol, price]) => {
      this.lastPrices.set(symbol, price);
      this.priceHistory.set(symbol, [price]);
    });
  }

  private startWorkerPool() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Set up interval to process the strategy queue
    this.checkInterval = setInterval(() => {
      this.processStrategyQueue();
    }, 5000); // Check the queue every 5 seconds

    logService.log('info', 'Started worker pool for trade generation', null, 'BackendTradeGenerator');
  }

  private async processStrategyQueue() {
    // If no strategies in the queue, update the queue
    if (this.strategyQueue.length === 0) {
      this.updateStrategyQueue();
    }

    // Process strategies in the queue up to the maximum concurrent limit
    while (this.strategyQueue.length > 0 && this.activeChecks.size < this.MAX_CONCURRENT_CHECKS) {
      const strategyId = this.strategyQueue.shift();
      if (!strategyId) break;

      // Skip if already being checked
      if (this.activeChecks.has(strategyId)) continue;

      // Skip if the strategy is no longer active
      if (!this.activeStrategies.has(strategyId)) continue;

      // Check if it's time to check this strategy based on its frequency
      const now = Date.now();
      const lastCheckTime = this.strategyLastCheckTime.get(strategyId) || 0;
      const checkFrequency = this.strategyCheckFrequency.get(strategyId) || this.CHECK_FREQUENCY;

      if (now - lastCheckTime < checkFrequency) {
        // Not time to check yet, put it back at the end of the queue
        this.strategyQueue.push(strategyId);
        continue;
      }

      // Mark as being checked
      this.activeChecks.add(strategyId);

      // Update last check time
      this.strategyLastCheckTime.set(strategyId, now);

      // Check the strategy with a timeout
      this.checkStrategyWithTimeout(strategyId);
    }
  }

  private updateStrategyQueue() {
    // Add all active strategies to the queue
    this.strategyQueue = Array.from(this.activeStrategies.keys());

    // Shuffle the queue to prevent always checking the same strategies first
    this.shuffleArray(this.strategyQueue);

    logService.log('debug', `Updated strategy queue with ${this.strategyQueue.length} strategies`, null, 'BackendTradeGenerator');
  }

  private shuffleArray(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  private async checkStrategyWithTimeout(strategyId: string) {
    try {
      // Create a promise that rejects after the timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Strategy check timed out')), this.STRATEGY_CHECK_TIMEOUT);
      });

      // Create the strategy check promise
      const checkPromise = this.checkStrategyForTrades(strategyId);

      // Race the promises
      await Promise.race([checkPromise, timeoutPromise]);
    } catch (error) {
      logService.log('error', `Error or timeout checking strategy ${strategyId}`, error, 'BackendTradeGenerator');
    } finally {
      // Remove from active checks
      this.activeChecks.delete(strategyId);
    }
  }

  private async checkStrategyForTrades(strategyId: string) {
    try {
      const strategy = this.activeStrategies.get(strategyId);
      if (!strategy) return;

      logService.log('debug', `Checking trade opportunities for strategy ${strategyId}`, null, 'BackendTradeGenerator');

      // Get the trading pairs from the strategy
      const tradingPairs = strategy.selected_pairs || ['BTC/USDT'];

      // For each trading pair, decide if we should generate a trade
      for (const symbol of tradingPairs) {
        try {
          // Get market data for this symbol
          const marketData = await this.getMarketData(symbol);
          if (!marketData) continue;

          // Analyze market conditions
          const marketConditions = this.analyzeMarketConditions(symbol, marketData);

          // Determine if we should generate a trade based on market conditions and strategy
          const shouldGenerateTrade = this.shouldGenerateTrade(strategy, marketConditions);

          // Only generate a trade if conditions are favorable
          if (!shouldGenerateTrade) continue;

          // Get current price
          const currentPrice = this.lastPrices.get(symbol) || 0;
          if (currentPrice === 0) continue;

          // Decide trade direction based on market conditions
          const direction = marketConditions.trend === 'up' ? 'Long' : 'Short';

          // Generate confidence based on market conditions
          const confidence = this.calculateConfidence(marketConditions);

          // Get exit conditions from strategy configuration
          const exitConditions = strategy.strategy_config?.exitConditions || {};

          // Use strategy-defined stop loss and take profit if available, otherwise use defaults
          const stopLossPercent = direction === 'Long'
            ? -(exitConditions.stopLossPercentage || 2.0) / 100
            : (exitConditions.stopLossPercentage || 2.0) / 100;

          const takeProfitPercent = direction === 'Long'
            ? (exitConditions.takeProfitPercentage || 4.0) / 100
            : -(exitConditions.takeProfitPercentage || 4.0) / 100;

          const stopLoss = currentPrice * (1 + stopLossPercent);
          const takeProfit = currentPrice * (1 + takeProfitPercent);

          // Get trailing stop if available
          const trailingStopPercent = (exitConditions.trailingStopPercentage || 1.0) / 100;

          // Get budget
          const budget = await tradeService.getBudget(strategyId);
          if (!budget || budget.available <= 0) continue;

          // Calculate position size
          const positionSize = this.calculatePositionSize(
            strategy,
            budget.available,
            currentPrice,
            confidence
          );

          // Create trade signal
          const signal = {
            direction: direction as 'Long' | 'Short',
            confidence,
            stopLoss,
            takeProfit,
            trailingStop: trailingStopPercent,
            rationale: `Generated trade for ${symbol} based on ${direction === 'Long' ? 'bullish' : 'bearish'} market conditions using ${strategy.title} strategy.`
          };

          // Create a trade in the database
          try {
            // Create trade signal in database
            const { data: tradeSignal, error: signalError } = await supabase
              .from('trade_signals')
              .insert({
                strategy_id: strategyId,
                symbol,
                side: direction === 'Long' ? 'buy' : 'sell',
                entry_price: currentPrice,
                target_price: takeProfit,
                stop_loss: stopLoss,
                quantity: positionSize,
                confidence,
                signal_type: 'entry',
                status: 'pending',
                expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes expiry
                metadata: {
                  rationale: signal.rationale,
                  trailingStop: signal.trailingStop,
                  marketConditions
                }
              })
              .select()
              .single();

            if (signalError) {
              // If the table doesn't exist, create the trade directly
              if (signalError.message && signalError.message.includes('relation "trade_signals" does not exist')) {
                await this.createTrade(strategy, symbol, direction, currentPrice, positionSize, stopLoss, takeProfit);
              } else {
                throw signalError;
              }
            } else if (tradeSignal) {
              // Process the signal immediately
              await this.processTradeSignal(tradeSignal, strategy);
            }

            logService.log('info', `Created trade signal for ${symbol}`, {
              strategy: strategyId,
              signal
            }, 'BackendTradeGenerator');
          } catch (tradeError) {
            logService.log('error', `Failed to create trade for ${symbol}`, tradeError, 'BackendTradeGenerator');

            // Try direct trade creation as fallback
            await this.createTrade(strategy, symbol, direction, currentPrice, positionSize, stopLoss, takeProfit);
          }
        } catch (error) {
          logService.log('error', `Error processing ${symbol} for strategy ${strategyId}`, error, 'BackendTradeGenerator');
        }
      }
    } catch (error) {
      logService.log('error', `Error checking strategy ${strategyId} for trades`, error, 'BackendTradeGenerator');
    }
  }

  private async getMarketData(symbol: string) {
    try {
      // Try to get data from market monitor first
      const marketData = marketMonitor.getMarketState(symbol);
      if (marketData) return marketData;

      // If no data from market monitor, get historical data
      const historicalData = await marketMonitor.getHistoricalData(symbol, 100, '1h');
      if (historicalData && historicalData.length > 0) {
        // Convert historical data to market data format
        return {
          candles: historicalData,
          ticker: {
            bid: historicalData[historicalData.length - 1].close * 0.999,
            ask: historicalData[historicalData.length - 1].close * 1.001,
            last: historicalData[historicalData.length - 1].close,
            bidVolume: 1000,
            askVolume: 1000,
            timestamp: Date.now()
          },
          trades: [],
          lastUpdate: Date.now()
        };
      }

      // If no data available, return null
      return null;
    } catch (error) {
      logService.log('error', `Failed to get market data for ${symbol}`, error, 'BackendTradeGenerator');
      return null;
    }
  }

  private analyzeMarketConditions(symbol: string, marketData: any) {
    try {
      // Extract price data from candles
      const candles = marketData.candles || [];
      if (candles.length < 10) {
        return {
          trend: 'sideways',
          volatility: 'low',
          volume: 'normal',
          strength: 0.5,
          signal: 'neutral'
        };
      }

      // Calculate price change
      const prices = candles.map((c: any) => c.close);
      const startPrice = prices[0];
      const endPrice = prices[prices.length - 1];
      const priceChange = ((endPrice - startPrice) / startPrice) * 100;

      // Calculate moving averages
      const sma20 = this.calculateSMA(prices, 20);
      const sma50 = this.calculateSMA(prices, 50);

      // Determine trend
      let trend = 'sideways';
      if (priceChange > 2 && endPrice > sma20 && sma20 > sma50) {
        trend = 'up';
      } else if (priceChange < -2 && endPrice < sma20 && sma20 < sma50) {
        trend = 'down';
      }

      // Calculate volatility
      const returns = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
      const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * 100;

      // Determine volatility level
      let volatilityLevel = 'low';
      if (volatility > 3) {
        volatilityLevel = 'high';
      } else if (volatility > 1) {
        volatilityLevel = 'medium';
      }

      // Calculate volume trend
      const volumes = candles.map((c: any) => c.volume);
      const avgVolume = this.calculateSMA(volumes, 20);
      const recentVolume = this.calculateSMA(volumes.slice(-5), 5);
      const volumeRatio = recentVolume / avgVolume;

      // Determine volume level
      let volumeLevel = 'normal';
      if (volumeRatio > 1.5) {
        volumeLevel = 'high';
      } else if (volumeRatio < 0.5) {
        volumeLevel = 'low';
      }

      // Calculate signal strength (0-1)
      let strength = 0.5; // Neutral
      if (trend === 'up') {
        strength = 0.5 + (priceChange / 10) * 0.5; // Scale up to 1 based on price change
      } else if (trend === 'down') {
        strength = 0.5 - (Math.abs(priceChange) / 10) * 0.5; // Scale down to 0 based on price change
      }
      strength = Math.max(0.1, Math.min(0.9, strength)); // Clamp between 0.1 and 0.9

      // Determine overall signal
      let signal = 'neutral';
      if (trend === 'up' && volumeLevel === 'high') {
        signal = 'strong_buy';
      } else if (trend === 'up') {
        signal = 'buy';
      } else if (trend === 'down' && volumeLevel === 'high') {
        signal = 'strong_sell';
      } else if (trend === 'down') {
        signal = 'sell';
      }

      return {
        trend,
        volatility: volatilityLevel,
        volume: volumeLevel,
        strength,
        signal,
        priceChange,
        currentPrice: endPrice
      };
    } catch (error) {
      logService.log('error', `Failed to analyze market conditions for ${symbol}`, error, 'BackendTradeGenerator');
      return {
        trend: 'sideways',
        volatility: 'low',
        volume: 'normal',
        strength: 0.5,
        signal: 'neutral'
      };
    }
  }

  private calculateSMA(values: number[], period: number): number {
    if (values.length < period) return 0;
    const sum = values.slice(-period).reduce((total, val) => total + val, 0);
    return sum / period;
  }

  private shouldGenerateTrade(strategy: Strategy, marketConditions: any): boolean {
    try {
      // Get strategy risk level
      const riskLevel = strategy.risk_level || 'Medium';

      // Get strategy configuration
      const strategyConfig = strategy.strategy_config || {};
      const indicatorType = strategyConfig.indicatorType || 'momentum';
      const entryConditions = strategyConfig.entryConditions || {};

      // Determine trade frequency based on risk level
      const tradeFrequency = {
        'Low': 0.1, // 10% chance
        'Medium': 0.2, // 20% chance
        'High': 0.3 // 30% chance
      }[riskLevel] || 0.2;

      // Base chance of generating a trade
      let tradeChance = tradeFrequency;

      // Adjust based on market conditions
      if (marketConditions.signal === 'strong_buy' || marketConditions.signal === 'strong_sell') {
        tradeChance *= 2; // Double chance for strong signals
      } else if (marketConditions.signal === 'neutral') {
        tradeChance *= 0.5; // Half chance for neutral signals
      }

      // Adjust based on volatility
      if (marketConditions.volatility === 'high') {
        if (riskLevel === 'Low') {
          tradeChance *= 0.5; // Low risk strategies avoid high volatility
        } else if (riskLevel === 'High') {
          tradeChance *= 1.5; // High risk strategies prefer high volatility
        }
      }

      // Apply strategy-specific logic based on indicator type
      switch (indicatorType) {
        case 'momentum':
          // Check momentum conditions
          if (entryConditions.momentumThreshold && Math.abs(marketConditions.priceChange) < entryConditions.momentumThreshold) {
            tradeChance *= 0.5; // Reduce chance if momentum is below threshold
          }

          // Check RSI conditions if available
          const rsiIndicator = entryConditions.indicators?.rsi;
          if (rsiIndicator && marketConditions.rsi) {
            if (marketConditions.trend === 'up' && marketConditions.rsi < rsiIndicator.oversold) {
              tradeChance *= 2; // Increase chance for oversold conditions in uptrend
            } else if (marketConditions.trend === 'down' && marketConditions.rsi > rsiIndicator.overbought) {
              tradeChance *= 2; // Increase chance for overbought conditions in downtrend
            }
          }
          break;

        case 'trend':
          // Check trend strength
          if (entryConditions.minTrendStrength && marketConditions.trendStrength < entryConditions.minTrendStrength) {
            tradeChance *= 0.3; // Significantly reduce chance if trend is weak
          }

          // Check if price is in the direction of the trend
          if (marketConditions.trend === 'up' && marketConditions.priceChange < 0) {
            tradeChance *= 0.5; // Reduce chance if price is moving against the trend
          } else if (marketConditions.trend === 'down' && marketConditions.priceChange > 0) {
            tradeChance *= 0.5; // Reduce chance if price is moving against the trend
          }
          break;

        case 'volatility':
          // Check volatility conditions
          if (marketConditions.volatility === 'low' && entryConditions.breakoutPercentage) {
            // For volatility breakout strategies, we want low volatility before a breakout
            tradeChance *= 1.5; // Increase chance in low volatility for potential breakout
          }

          // Check volume conditions
          if (entryConditions.volumeMultiplier && marketConditions.volume === 'high') {
            tradeChance *= 1.5; // Increase chance with high volume for breakout confirmation
          }
          break;

        case 'oscillator':
          // Check oscillator conditions (like RSI)
          if (entryConditions.overboughtLevel && entryConditions.oversoldLevel && marketConditions.rsi) {
            if (marketConditions.rsi < entryConditions.oversoldLevel) {
              tradeChance *= 2; // Increase chance for oversold conditions
            } else if (marketConditions.rsi > entryConditions.overboughtLevel) {
              tradeChance *= 2; // Increase chance for overbought conditions
            } else {
              tradeChance *= 0.5; // Reduce chance if RSI is in the middle range
            }
          }
          break;
      }

      // Random chance to generate a trade
      return Math.random() < tradeChance;
    } catch (error) {
      logService.log('error', 'Failed to determine if trade should be generated', error, 'BackendTradeGenerator');
      return false;
    }
  }

  private calculateConfidence(marketConditions: any): number {
    try {
      // Base confidence on signal strength
      let confidence = marketConditions.strength;

      // Adjust based on signal type
      if (marketConditions.signal === 'strong_buy' || marketConditions.signal === 'strong_sell') {
        confidence += 0.1; // Boost confidence for strong signals
      } else if (marketConditions.signal === 'neutral') {
        confidence -= 0.1; // Reduce confidence for neutral signals
      }

      // Adjust based on volatility
      if (marketConditions.volatility === 'high') {
        confidence -= 0.05; // Reduce confidence in high volatility
      } else if (marketConditions.volatility === 'low') {
        confidence += 0.05; // Increase confidence in low volatility
      }

      // Ensure confidence is between 0.3 and 0.9
      return Math.max(0.3, Math.min(0.9, confidence));
    } catch (error) {
      logService.log('error', 'Failed to calculate confidence', error, 'BackendTradeGenerator');
      return 0.5; // Default to neutral confidence
    }
  }

  private async processTradeSignal(signal: any, strategy: Strategy) {
    try {
      // Execute the trade
      const tradeOptions = {
        strategy_id: strategy.id,
        symbol: signal.symbol,
        side: signal.side,
        type: 'market',
        entry_price: signal.entry_price,
        amount: signal.quantity,
        stop_loss: signal.stop_loss,
        take_profit: signal.target_price,
        trailing_stop: signal.metadata?.trailingStop || 0,
        testnet: demoService.isInDemoMode() // Use TestNet in demo mode
      };

      // Execute the trade
      const tradeResult = await tradeManager.executeTrade(tradeOptions);

      // Update the signal status
      await supabase
        .from('trade_signals')
        .update({
          status: 'executed',
          executed_at: new Date().toISOString()
        })
        .eq('id', signal.id);

      // Emit trade created event
      this.emit('tradeCreated', {
        strategy,
        trade: tradeResult,
        signal
      });

      // Also emit to the event bus for UI components to listen
      eventBus.emit('trade:created', {
        strategy,
        trade: tradeResult,
        signal
      });

      logService.log('info', `Executed trade for ${signal.symbol}`, {
        strategy: strategy.id,
        trade: tradeResult,
        signal
      }, 'BackendTradeGenerator');
    } catch (error) {
      logService.log('error', `Failed to process trade signal for ${signal.symbol}`, error, 'BackendTradeGenerator');
    }
  }

  private async createTrade(
    strategy: Strategy,
    symbol: string,
    direction: string,
    currentPrice: number,
    positionSize: number,
    stopLoss: number,
    takeProfit: number
  ) {
    try {
      // Create trade directly in the database
      const { data: trade, error } = await supabase
        .from('trades')
        .insert({
          strategy_id: strategy.id,
          symbol,
          side: direction === 'Long' ? 'buy' : 'sell',
          quantity: positionSize,
          price: currentPrice,
          status: 'pending',
          trade_config: {
            stop_loss: stopLoss,
            take_profit: takeProfit,
            trailing_stop: trailingStopPercent,
            max_duration_hours: strategy.strategy_config?.exitConditions?.maxDurationHours || 48
          }
        })
        .select()
        .single();

      if (error) throw error;

      // Update trade status to executed after a short delay
      setTimeout(async () => {
        try {
          const { error: updateError } = await supabase
            .from('trades')
            .update({
              status: 'executed',
              executed_at: new Date().toISOString()
            })
            .eq('id', trade.id);

          if (updateError) throw updateError;

          // Emit trade updated event
          eventBus.emit('trade:updated', {
            trade: {
              ...trade,
              status: 'executed',
              executed_at: new Date().toISOString()
            }
          });

          logService.log('info', `Updated trade status to executed for ${symbol}`, {
            strategy: strategy.id,
            trade
          }, 'BackendTradeGenerator');
        } catch (updateError) {
          logService.log('error', `Failed to update trade status for ${symbol}`, updateError, 'BackendTradeGenerator');
        }
      }, 2000); // 2 second delay

      // Emit trade created event
      eventBus.emit('trade:created', {
        strategy,
        trade
      });

      logService.log('info', `Created trade for ${symbol}`, {
        strategy: strategy.id,
        trade
      }, 'BackendTradeGenerator');
    } catch (error) {
      logService.log('error', `Failed to create trade for ${symbol}`, error, 'BackendTradeGenerator');
    }
  }

  private calculatePositionSize(
    strategy: Strategy,
    availableBudget: number,
    currentPrice: number,
    confidence: number
  ): number {
    // Get risk management settings from strategy configuration
    const riskManagement = strategy.strategy_config?.riskManagement || {};

    // Get position size percentage from risk management settings or use default based on risk level
    const positionSizePercentage = riskManagement.positionSizePercentage || {
      'Ultra Low': 5,
      'Low': 10,
      'Medium': 15,
      'High': 20,
      'Ultra High': 25,
      'Extreme': 30,
      'God Mode': 50
    }[strategy.risk_level || 'Medium'] || 15;

    // Convert percentage to decimal
    const riskMultiplier = positionSizePercentage / 100;

    // Base position size on risk level and confidence
    const baseSize = availableBudget * riskMultiplier;
    const confidenceAdjustedSize = baseSize * confidence;

    // No maximum position size restriction
    const finalSize = confidenceAdjustedSize;

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

      logService.log('info', `Adding strategy ${strategy.id} to backend trade generator`, null, 'BackendTradeGenerator');

      // Add to active strategies
      this.activeStrategies.set(strategy.id, strategy);

      // Set check frequency based on risk level
      const riskLevel = strategy.risk_level || 'Medium';
      const checkFrequency = {
        'Low': 300000, // 5 minutes
        'Medium': 180000, // 3 minutes
        'High': 60000 // 1 minute
      }[riskLevel] || 180000;

      this.strategyCheckFrequency.set(strategy.id, checkFrequency);

      // Set last check time to now minus check frequency to ensure it gets checked soon
      this.strategyLastCheckTime.set(strategy.id, Date.now() - checkFrequency);

      // Add to queue for immediate check
      this.strategyQueue.unshift(strategy.id);

      logService.log('info', `Strategy ${strategy.id} added to backend trade generator`,
        { strategy }, 'BackendTradeGenerator');
    } catch (error) {
      logService.log('error', `Failed to add strategy ${strategy.id}`, error, 'BackendTradeGenerator');
      throw error;
    }
  }

  removeStrategy(strategyId: string): void {
    try {
      if (!this.activeStrategies.has(strategyId)) return;

      // Remove strategy from active list
      this.activeStrategies.delete(strategyId);

      // Remove from check frequency and last check time maps
      this.strategyCheckFrequency.delete(strategyId);
      this.strategyLastCheckTime.delete(strategyId);

      // Remove from queue if present
      this.strategyQueue = this.strategyQueue.filter(id => id !== strategyId);

      // Remove from active checks if present
      this.activeChecks.delete(strategyId);

      logService.log('info', `Strategy ${strategyId} removed from backend trade generator`, null, 'BackendTradeGenerator');
    } catch (error) {
      logService.log('error', `Error removing strategy ${strategyId}`, error, 'BackendTradeGenerator');
    }
  }

  getActiveStrategies(): Strategy[] {
    return Array.from(this.activeStrategies.values());
  }

  getActiveStrategyCount(): number {
    return this.activeStrategies.size;
  }

  getQueueLength(): number {
    return this.strategyQueue.length;
  }

  getActiveCheckCount(): number {
    return this.activeChecks.size;
  }

  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.activeStrategies.clear();
    this.strategyQueue = [];
    this.activeChecks.clear();
    this.strategyLastCheckTime.clear();
    this.strategyCheckFrequency.clear();
    this.lastPrices.clear();
    this.priceHistory.clear();
    this.initialized = false;
    logService.log('info', 'Backend trade generator cleaned up', null, 'BackendTradeGenerator');
  }
}

export const backendTradeGenerator = BackendTradeGenerator.getInstance();
