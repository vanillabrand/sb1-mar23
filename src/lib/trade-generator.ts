
import { EventEmitter } from './event-emitter';
import { marketMonitor } from './market-monitor';
import { tradeManager } from './trade-manager';
import { tradeService } from './trade-service';
import { bitmartService } from './bitmart-service';
import { logService } from './log-service';
import { eventBus } from './event-bus';
import { demoService } from './demo-service';
import { indicatorService } from './indicators'; // Updated to use indicatorService instead
import { marketAnalysisService } from './market-analysis-service';
import { riskManagementService } from './risk-management-service';
import { walletBalanceService } from './wallet-balance-service';
import { supabase } from './supabase';
import { unifiedTradeService } from './unified-trade-service';
import { enhancedMarketDataService } from './enhanced-market-data-service';
import { strategyAdaptationService } from './strategy-adaptation-service';
import type { Strategy, MarketAnalysis, RiskLevel, MarketRegime, MarketType, TradeOptions } from './types';
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

      // Get trading pairs from all possible locations
      let tradingPairs = [];

      if (strategy.selected_pairs && strategy.selected_pairs.length > 0) {
        tradingPairs = strategy.selected_pairs;
        logService.log('info', `Using selected_pairs for strategy ${strategy.id}`, { pairs: tradingPairs }, 'TradeGenerator');
      } else if (strategy.strategy_config?.assets && strategy.strategy_config.assets.length > 0) {
        tradingPairs = strategy.strategy_config.assets;
        logService.log('info', `Using strategy_config.assets for strategy ${strategy.id}`, { pairs: tradingPairs }, 'TradeGenerator');
      } else if (strategy.strategy_config?.config?.pairs && strategy.strategy_config.config.pairs.length > 0) {
        tradingPairs = strategy.strategy_config.config.pairs;
        logService.log('info', `Using strategy_config.config.pairs for strategy ${strategy.id}`, { pairs: tradingPairs }, 'TradeGenerator');
      } else {
        // Default to BTC/USDT if no pairs are found
        tradingPairs = ['BTC/USDT'];
        logService.log('warn', `No trading pairs found for strategy ${strategy.id}, defaulting to BTC/USDT`, null, 'TradeGenerator');

        // Update the strategy with the default pair
        strategy.selected_pairs = tradingPairs;
        if (!strategy.strategy_config) strategy.strategy_config = {};
        strategy.strategy_config.assets = tradingPairs;
        if (!strategy.strategy_config.config) strategy.strategy_config.config = {};
        strategy.strategy_config.config.pairs = tradingPairs;
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

          // Get market analysis for better trade generation
          let marketAnalysis: MarketAnalysis | undefined;
          try {
            marketAnalysis = await marketAnalysisService.getMarketAnalysis(symbol);
            logService.log('debug', `Market analysis for ${symbol}:`, {
              regime: marketAnalysis.regime,
              trend: marketAnalysis.trend,
              strength: marketAnalysis.strength,
              volatility: marketAnalysis.volatility
            }, 'TradeGenerator');

            // Check if market conditions are favorable for this strategy
            const isFavorable = this.isMarketFavorable(strategy, marketAnalysis);
            if (!isFavorable) {
              logService.log('info', `Skipping trade generation for ${symbol} - market conditions not favorable for strategy ${strategy.id}`, null, 'TradeGenerator');
              continue; // Skip to next symbol
            }
          } catch (error) {
            logService.log('warn', `Failed to get market analysis for ${symbol}, proceeding without it`, error, 'TradeGenerator');
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
            let positionSize;
            try {
              positionSize = await this.calculatePositionSize(
                strategy,
                budget.available,
                currentPrice,
                signal.confidence
              );

              // Ensure positionSize is a number, not a Promise
              if (positionSize instanceof Promise) {
                positionSize = await positionSize;
              }

              logService.log('debug', `Calculated position size for ${symbol}: ${positionSize}`, null, 'TradeGenerator');
            } catch (error) {
              logService.log('error', `Error calculating position size for ${symbol}`, error, 'TradeGenerator');
              // Use a safe default value
              positionSize = 0.001;
            }

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

                  // Get market analysis for risk management
                  let marketAnalysis: MarketAnalysis | undefined;
                  try {
                    marketAnalysis = await marketAnalysisService.getMarketAnalysis(symbol);
                  } catch (error) {
                    logService.log('warn', `Failed to get market analysis for risk calculation, using default values`, error, 'TradeGenerator');
                  }

                  // Calculate optimized stop loss and take profit using risk management service
                  const entryPrice = currentPrice * (0.98 + Math.random() * 0.04); // Vary price slightly
                  const stopLoss = signal.stopLoss ?
                    signal.stopLoss * (0.95 + Math.random() * 0.1) : // Vary the provided stop loss
                    riskManagementService.calculateStopLoss(
                      entryPrice,
                      tradeSide,
                      strategy.riskLevel,
                      marketAnalysis
                    );

                  const takeProfit = signal.takeProfit ?
                    signal.takeProfit * (0.95 + Math.random() * 0.1) : // Vary the provided take profit
                    riskManagementService.calculateTakeProfit(
                      entryPrice,
                      stopLoss,
                      tradeSide,
                      strategy.riskLevel,
                      marketAnalysis
                    );

                  // Calculate trailing stop if not provided
                  const trailingStop = signal.trailingStop ||
                    (marketAnalysis ? riskManagementService.calculateTrailingStop(marketAnalysis.volatility, strategy.riskLevel) : undefined);

                  // Create trade options
                  const tradeOptions = {
                    strategy_id: strategy.id,
                    symbol: symbol,
                    side: tradeSide,
                    type: 'market', // Default to market order
                    orderType: Math.random() > 0.3 ? 'market' : 'limit', // Mix of market and limit orders
                    entry_price: entryPrice,
                    amount: adjustedSize,
                    stop_loss: stopLoss,
                    take_profit: takeProfit,
                    trailing_stop: trailingStop,
                    testnet: true, // Always use TestNet in demo mode
                    marketType: strategy.marketType || 'spot', // Use strategy's market type
                    marginType: strategy.marketType === 'futures' ? (signal.marginType || (Math.random() > 0.5 ? 'cross' : 'isolated')) : undefined, // Set margin type for futures
                    leverage: strategy.marketType === 'futures' ? (signal.leverage || Math.floor(Math.random() * 10) + 1) : undefined, // Set leverage for futures (1-10x)
                    tradeValue: adjustedSize * currentPrice // Calculate trade value
                  };

                  // Validate the trade risk
                  const riskValidation = riskManagementService.validateTradeRisk(
                    adjustedSize,
                    entryPrice,
                    stopLoss,
                    tradeSide,
                    strategy.riskLevel,
                    strategy.marketType || 'spot',
                    availableBudget
                  );

                  if (!riskValidation.valid) {
                    logService.log('warn', `Trade risk validation failed: ${riskValidation.reason}`, null, 'TradeGenerator');
                    // We'll still create the trade in demo mode, but log the warning
                  }

                  try {
                    // Create a unique ID for the trade that won't change on re-renders
                    const tradeId = `trade-${strategy.id}-${symbol.replace('/', '')}-${i}-${Date.now()}`;

                    // Prepare trade options
                    const tradeOptions = {
                      id: tradeId,
                      strategy_id: strategy.id,
                      symbol: symbol,
                      side: tradeSide,
                      quantity: adjustedSize,
                      price: entryPrice,
                      entry_price: entryPrice,
                      stop_loss: stopLoss,
                      take_profit: takeProfit,
                      trailing_stop: trailingStop,
                      marketType: strategy.marketType || 'spot',
                      marginType: strategy.marketType === 'futures' ?
                        (signal.marginType || (Math.random() > 0.5 ? 'cross' : 'isolated')) : undefined,
                      leverage: strategy.marketType === 'futures' ?
                        (signal.leverage || Math.floor(Math.random() * 5) + 1) : undefined,
                      rationale: signal.rationale || `Generated trade for ${symbol} based on market analysis`,
                      entry_conditions: signal.entryConditions || [],
                      exit_conditions: signal.exitConditions || [],
                      riskLevel: strategy.riskLevel || 'medium'
                    };

                    // Log detailed information about the trade being created
                    logService.log('debug', `Creating trade for ${symbol} in demo mode using unified trade service`, {
                      tradeId,
                      strategyId: strategy.id,
                      symbol,
                      side: tradeSide,
                      amount: adjustedSize,
                      entryPrice,
                      stopLoss,
                      takeProfit
                    }, 'TradeGenerator');

                    // Use the unified trade service for consistent trade creation
                    const tradeResult = await unifiedTradeService.createTrade(tradeOptions);

                    if (tradeResult) {
                      tradeResults.push(tradeResult);

                      // Log successful trade creation
                      logService.log('info', `Successfully created trade for ${symbol} in demo mode`, {
                        tradeId: tradeResult.id,
                        strategyId: strategy.id,
                        symbol,
                        side: tradeSide,
                        amount: adjustedSize
                      }, 'TradeGenerator');

                      // Emit events for each trade
                      this.emitTradeEvents(strategy, tradeResult, signal, currentPrice, adjustedSize);
                    } else {
                      logService.log('warn', `Unified trade service returned null for ${symbol}`, {
                        tradeOptions
                      }, 'TradeGenerator');

                      // Create a fallback trade directly as a last resort
                      const fallbackTrade = await this.createFallbackTrade(strategy, symbol, tradeSide, entryPrice, adjustedSize, stopLoss, takeProfit, trailingStop, signal);

                      if (fallbackTrade) {
                        tradeResults.push(fallbackTrade);
                        this.emitTradeEvents(strategy, fallbackTrade, signal, currentPrice, adjustedSize);
                      }
                    }
                  } catch (error) {
                    logService.log('error', `Failed to create trade for ${symbol} using unified trade service`, error, 'TradeGenerator');

                    // Create a fallback trade directly as a last resort
                    const fallbackTrade = await this.createFallbackTrade(strategy, symbol, tradeSide, entryPrice, adjustedSize, stopLoss, takeProfit, trailingStop, signal);

                    if (fallbackTrade) {
                      tradeResults.push(fallbackTrade);
                      this.emitTradeEvents(strategy, fallbackTrade, signal, currentPrice, adjustedSize);
                    }
                  }

                  // Add a small delay between trades to avoid overwhelming the UI
                  if (i < numTrades - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }
                }

                // Use the first trade result for the rest of the function
                var tradeResult = tradeResults[0];
              } else {
                // In live mode, just create a single trade with enhanced risk management
                // Get market analysis for risk management
                let marketAnalysis: MarketAnalysis | undefined;
                try {
                  marketAnalysis = await marketAnalysisService.getMarketAnalysis(symbol);
                } catch (error) {
                  logService.log('warn', `Failed to get market analysis for risk calculation in live mode, using default values`, error, 'TradeGenerator');
                }

                // Determine trade side
                const tradeSide = signal.direction === 'Long' ? 'buy' : 'sell';

                // Calculate optimized stop loss and take profit using risk management service
                const stopLoss = signal.stopLoss || riskManagementService.calculateStopLoss(
                  currentPrice,
                  tradeSide,
                  strategy.riskLevel,
                  marketAnalysis
                );

                const takeProfit = signal.takeProfit || riskManagementService.calculateTakeProfit(
                  currentPrice,
                  stopLoss,
                  tradeSide,
                  strategy.riskLevel,
                  marketAnalysis
                );

                // Calculate trailing stop if not provided
                const trailingStop = signal.trailingStop ||
                  (marketAnalysis ? riskManagementService.calculateTrailingStop(marketAnalysis.volatility, strategy.riskLevel) : undefined);

                // Determine margin type and leverage for futures
                const marginType = strategy.marketType === 'futures' ?
                  (signal.marginType || 'cross') : undefined; // Default to cross margin for futures

                // Use conservative leverage in live mode, adjusted for volatility if available
                const leverage = strategy.marketType === 'futures' ?
                  (signal.leverage || (marketAnalysis ? Math.max(1, Math.min(3, Math.floor(10 / (marketAnalysis.volatility / 20)))) : 2)) :
                  undefined;

                const tradeOptions = {
                  strategy_id: strategy.id,
                  symbol: symbol,
                  side: tradeSide,
                  type: 'market',
                  orderType: 'market', // Default to market order in live mode for reliability
                  entry_price: currentPrice,
                  amount: positionSize,
                  stop_loss: stopLoss,
                  take_profit: takeProfit,
                  trailing_stop: trailingStop,
                  testnet: false, // Not using TestNet in live mode
                  marketType: strategy.marketType || 'spot', // Use strategy's market type
                  marginType: marginType,
                  leverage: leverage,
                  tradeValue: positionSize * currentPrice // Calculate trade value
                };

                // Validate the trade risk - in live mode, we'll only proceed if the trade passes risk validation
                const riskValidation = riskManagementService.validateTradeRisk(
                  positionSize,
                  currentPrice,
                  stopLoss,
                  tradeSide,
                  strategy.riskLevel,
                  strategy.marketType || 'spot',
                  availableBudget || 0
                );

                if (!riskValidation.valid) {
                  logService.log('error', `Trade risk validation failed in live mode: ${riskValidation.reason}`, null, 'TradeGenerator');
                  // Emit error event
                  eventBus.emit(`trade:error:${strategy.id}`, {
                    strategyId: strategy.id,
                    error: new Error(`Risk validation failed: ${riskValidation.reason}`)
                  });
                  return; // Don't proceed with the trade
                }

                // Execute the trade using the unified trade service
                try {
                  // Create a unique ID for the trade
                  const tradeId = `live-${strategy.id}-${symbol.replace('/', '')}-${Date.now()}`;

                  // Prepare trade options
                  const tradeOptions = {
                    id: tradeId,
                    strategy_id: strategy.id,
                    symbol: symbol,
                    side: tradeSide,
                    quantity: positionSize,
                    price: currentPrice,
                    entry_price: currentPrice,
                    stop_loss: stopLoss,
                    take_profit: takeProfit,
                    trailing_stop: trailingStop,
                    marketType: strategy.marketType || 'spot',
                    marginType: marginType,
                    leverage: leverage,
                    rationale: signal.rationale || 'Live trade created by trade generator',
                    entry_conditions: signal.entryConditions || [],
                    exit_conditions: signal.exitConditions || [],
                    riskLevel: strategy.riskLevel || 'medium'
                  };

                  // Log detailed information about the trade being created
                  logService.log('debug', `Creating live trade for ${symbol} using unified trade service`, {
                    tradeId,
                    strategyId: strategy.id,
                    symbol,
                    side: tradeSide,
                    amount: positionSize,
                    currentPrice,
                    stopLoss,
                    takeProfit
                  }, 'TradeGenerator');

                  // Use the unified trade service for consistent trade creation
                  var tradeResult = await unifiedTradeService.createTrade(tradeOptions);

                  // Emit events for the trade
                  this.emitTradeEvents(strategy, tradeResult, signal, currentPrice, positionSize);

                  logService.log('info', `Successfully created live trade for ${symbol}`, {
                    tradeId: tradeResult.id,
                    strategyId: strategy.id,
                    symbol,
                    side: tradeSide,
                    amount: positionSize
                  }, 'TradeGenerator');
                } catch (error) {
                  logService.log('error', `Failed to create live trade for ${symbol} using unified trade service`, error, 'TradeGenerator');

                  // We don't use fallback trades in live mode for safety reasons
                  // Instead, we'll emit an error event
                  eventBus.emit(`trade:error:${strategy.id}`, {
                    strategyId: strategy.id,
                    symbol,
                    error: new Error(`Failed to create live trade: ${error.message}`)
                  });
                }
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

              // Emit error event for UI notification
              eventBus.emit(`trade:error:${strategy.id}`, {
                strategyId: strategy.id,
                symbol,
                error: tradeError
              });

              // Try to create a fallback trade with minimal fields if in demo mode
              if (demoService.isInDemoMode()) {
                try {
                  logService.log('info', `Attempting to create fallback trade for ${symbol} in demo mode`, null, 'TradeGenerator');

                  // Use the new createFallbackTrade method for more reliable trade creation
                  const tradeSide = signal.direction === 'Long' ? 'buy' : 'sell';
                  const stopLoss = signal.stopLoss || riskManagementService.calculateStopLoss(
                    currentPrice,
                    tradeSide,
                    strategy.riskLevel
                  );
                  const takeProfit = signal.takeProfit || riskManagementService.calculateTakeProfit(
                    currentPrice,
                    stopLoss,
                    tradeSide,
                    strategy.riskLevel
                  );

                  const fallbackTrade = await this.createFallbackTrade(
                    strategy,
                    symbol,
                    tradeSide,
                    currentPrice,
                    positionSize,
                    stopLoss,
                    takeProfit,
                    signal.trailingStop,
                    signal
                  );

                  if (fallbackTrade) {
                    logService.log('info', `Created fallback trade for ${symbol}`, {
                      tradeId: fallbackTrade.id,
                      strategyId: strategy.id,
                      symbol,
                      side: tradeSide,
                      amount: positionSize
                    }, 'TradeGenerator');

                    // Emit trade created event for the fallback trade
                    eventBus.emit('trade:created', {
                      strategy,
                      trade: fallbackTrade,
                      fallback: true
                    });

                    // Also emit to strategy-specific event
                    eventBus.emit(`trade:created:${strategy.id}`, {
                      strategyId: strategy.id,
                      trade: fallbackTrade
                    });
                  } else {
                    logService.log('error', `Failed to create fallback trade for ${symbol} - createFallbackTrade returned null`, null, 'TradeGenerator');
                  }
                } catch (fallbackError) {
                  logService.log('error', `Failed to create fallback trade for ${symbol}`, fallbackError, 'TradeGenerator');
                }
              }

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

    try {
      // Ensure data is valid
      if (!data || !Array.isArray(data) || data.length === 0) {
        logService.log('warn', 'No valid data for calculating indicators', null, 'TradeGenerator');
        return indicators;
      }

      logService.log('info', `Calculating indicators for ${strategy.id} with ${data.length} data points`,
        { dataFormat: typeof data[0], firstItem: JSON.stringify(data[0]).substring(0, 100) }, 'TradeGenerator');

      // Extract prices, handling different data formats
      let closes: number[] = [];
      let highs: number[] = [];
      let lows: number[] = [];
      let volumes: number[] = [];

      // Determine data format and extract values
      if (typeof data[0].close === 'number') {
        // Object format with properties
        closes = data.map(d => d.close);
        highs = data.map(d => d.high || d.close);
        lows = data.map(d => d.low || d.close);
        volumes = data.map(d => d.volume || 0);
      } else if (Array.isArray(data[0]) && data[0].length >= 5) {
        // Array format from exchange API [timestamp, open, high, low, close, volume]
        closes = data.map(d => parseFloat(d[4]));
        highs = data.map(d => parseFloat(d[2]));
        lows = data.map(d => parseFloat(d[3]));
        volumes = data.map(d => parseFloat(d[5] || '0'));
      } else if (typeof data[0] === 'number') {
        // Simple array of prices
        closes = data as number[];
        highs = closes;
        lows = closes;
        volumes = new Array(closes.length).fill(1);
      } else {
        // Unknown format - log and return empty indicators
        logService.log('warn', 'Unknown data format for calculating indicators',
          { sampleData: JSON.stringify(data[0]).substring(0, 100) }, 'TradeGenerator');
        return indicators;
      }

      // Ensure we have enough data points for the most demanding indicator
      const minDataPoints = 26; // MACD needs at least 26 data points
      if (closes.length < minDataPoints) {
        logService.log('warn', `Not enough data points for indicators: ${closes.length}, need at least ${minDataPoints}`,
          { strategyId: strategy.id }, 'TradeGenerator');

        // If we have at least some data, we can still calculate simple indicators
        if (closes.length >= 5) {
          logService.log('info', `Calculating limited indicators with ${closes.length} data points`, null, 'TradeGenerator');

          // Calculate simple moving average with available data
          try {
            const smaConfig = {
              name: 'SMA',
              params: {
                period: Math.min(5, closes.length - 1)
              }
            };
            const sma = await indicatorService.calculateIndicator(smaConfig, closes);
            indicators.push({
              name: 'SMA',
              value: sma.value,
              timeframe: '5m'
            });
          } catch (smaError) {
            logService.log('warn', 'Failed to calculate SMA with limited data', smaError, 'TradeGenerator');
          }

          return indicators;
        }

        return indicators;
      }

      // Calculate RSI
      try {
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

        logService.log('debug', `Calculated RSI: ${rsi.value}`, null, 'TradeGenerator');
      } catch (rsiError) {
        logService.log('warn', 'Failed to calculate RSI', rsiError, 'TradeGenerator');
      }

      // Calculate MACD
      try {
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
          signal: macd.metadata?.signal || 0,
          timeframe: '5m'
        });

        logService.log('debug', `Calculated MACD: ${macd.value}, Signal: ${macd.metadata?.signal}`, null, 'TradeGenerator');
      } catch (macdError) {
        logService.log('warn', 'Failed to calculate MACD', macdError, 'TradeGenerator');
      }

      // Calculate Bollinger Bands
      try {
        const bbConfig = {
          name: 'BB',
          params: {
            period: 20
          }
        };
        const bb = await indicatorService.calculateIndicator(bbConfig, closes);
        indicators.push({
          name: 'BB',
          value: bb.value,
          timeframe: '5m',
          upper: bb.metadata?.upper,
          lower: bb.metadata?.lower
        });

        logService.log('debug', `Calculated BB: Middle: ${bb.value}, Upper: ${bb.metadata?.upper}, Lower: ${bb.metadata?.lower}`, null, 'TradeGenerator');
      } catch (bbError) {
        logService.log('warn', 'Failed to calculate Bollinger Bands', bbError, 'TradeGenerator');
      }

      // Calculate EMA (50)
      try {
        const emaConfig = {
          name: 'EMA',
          params: {
            period: 50
          }
        };
        if (closes.length >= 50) {
          const ema = await indicatorService.calculateIndicator(emaConfig, closes);
          indicators.push({
            name: 'EMA50',
            value: ema.value,
            timeframe: '5m'
          });

          logService.log('debug', `Calculated EMA50: ${ema.value}`, null, 'TradeGenerator');
        }
      } catch (emaError) {
        logService.log('warn', 'Failed to calculate EMA50', emaError, 'TradeGenerator');
      }

      // Calculate ATR if we have high/low data
      if (highs.length === lows.length && highs.length === closes.length) {
        try {
          // Create synthetic trades with high/low/close for ATR calculation
          const tradesForATR = closes.map((close, i) => ({
            price: close,
            high: highs[i],
            low: lows[i],
            timestamp: Date.now() - (closes.length - i) * 60000
          }));

          const atrConfig = {
            name: 'ATR',
            params: {
              period: 14
            }
          };
          const atr = await indicatorService.calculateIndicator(atrConfig, tradesForATR);
          indicators.push({
            name: 'ATR',
            value: atr.value,
            timeframe: '5m'
          });

          logService.log('debug', `Calculated ATR: ${atr.value}`, null, 'TradeGenerator');
        } catch (atrError) {
          logService.log('warn', 'Failed to calculate ATR', atrError, 'TradeGenerator');
        }
      }

      // Add strategy-specific indicators if configured
      if (strategy.strategy_config?.indicators && Array.isArray(strategy.strategy_config.indicators)) {
        for (const indicator of strategy.strategy_config.indicators) {
          // Skip indicators we've already calculated
          if (['RSI', 'MACD', 'BB', 'EMA50', 'ATR'].includes(indicator)) {
            continue;
          }

          try {
            logService.log('info', `Calculating strategy-specific indicator: ${indicator}`, null, 'TradeGenerator');

            // Configure indicator based on type
            let config: any;
            switch (indicator) {
              case 'STOCH':
                config = {
                  name: 'STOCH',
                  params: {
                    period: 14,
                    signalPeriod: 3
                  }
                };
                break;
              case 'CCI':
                config = {
                  name: 'CCI',
                  params: {
                    period: 20
                  }
                };
                break;
              case 'ADX':
                config = {
                  name: 'ADX',
                  params: {
                    period: 14
                  }
                };
                break;
              default:
                config = {
                  name: indicator,
                  params: {
                    period: 14
                  }
                };
            }

            // Calculate the indicator
            const result = await indicatorService.calculateIndicator(config, closes);
            indicators.push({
              name: indicator,
              value: result.value,
              timeframe: '5m',
              ...result.metadata
            });

            logService.log('debug', `Calculated ${indicator}: ${result.value}`, null, 'TradeGenerator');
          } catch (indicatorError) {
            logService.log('warn', `Failed to calculate strategy-specific indicator: ${indicator}`, indicatorError, 'TradeGenerator');
          }
        }
      }

      logService.log('info', `Successfully calculated ${indicators.length} indicators for strategy ${strategy.id}`,
        { indicators: indicators.map(i => i.name) }, 'TradeGenerator');
      return indicators;
    } catch (error) {
      logService.log('error', 'Error calculating indicators', error, 'TradeGenerator');
      return indicators;
    }
  }

  private async getHistoricalData(symbol: string): Promise<any[]> {
    try {
      logService.log('info', `Getting historical data for ${symbol}`, null, 'TradeGenerator');

      // Normalize the symbol format to ensure consistency
      const normalizedSymbol = this.normalizeSymbol(symbol);

      const endTime = Math.floor(Date.now() / 1000);
      const startTime = Math.floor((Date.now() - this.LOOKBACK_PERIOD) / 1000);

      // Try to get data from bitmart first
      try {
        const klines = await bitmartService.getKlines(normalizedSymbol, startTime, endTime, '1m');

        // Validate the data format
        if (klines && Array.isArray(klines) && klines.length > 0) {
          logService.log('info', `Retrieved ${klines.length} klines from Bitmart for ${normalizedSymbol}`, null, 'TradeGenerator');

          // Transform the data into a consistent format
          return klines.map(kline => ({
            timestamp: kline[0],
            open: parseFloat(kline[1]),
            high: parseFloat(kline[2]),
            low: parseFloat(kline[3]),
            close: parseFloat(kline[4]),
            volume: parseFloat(kline[5])
          }));
        } else {
          logService.log('warn', `Received empty or invalid klines from Bitmart for ${normalizedSymbol}`, { klines }, 'TradeGenerator');
        }
      } catch (bitmartError) {
        logService.log('warn', `Failed to get klines from Bitmart for ${normalizedSymbol}, trying fallback sources`, bitmartError, 'TradeGenerator');
      }

      // Fallback to market monitor if bitmart fails
      try {
        const marketData = marketMonitor.getMarketData(normalizedSymbol);
        if (marketData && marketData.candles && marketData.candles.length > 0) {
          logService.log('info', `Retrieved ${marketData.candles.length} candles from market monitor for ${normalizedSymbol}`, null, 'TradeGenerator');
          return marketData.candles;
        } else {
          logService.log('warn', `No candles available from market monitor for ${normalizedSymbol}`, null, 'TradeGenerator');
        }
      } catch (marketMonitorError) {
        logService.log('warn', `Failed to get data from market monitor for ${normalizedSymbol}`, marketMonitorError, 'TradeGenerator');
      }

      // Last resort: try to get data from enhanced market data service
      try {
        const enhancedData = await enhancedMarketDataService.getMarketData(normalizedSymbol, ['1m', '5m'], true);
        if (enhancedData && enhancedData.candles && enhancedData.candles['1m'] && enhancedData.candles['1m'].length > 0) {
          logService.log('info', `Retrieved ${enhancedData.candles['1m'].length} candles from enhanced market data service for ${normalizedSymbol}`, null, 'TradeGenerator');
          return enhancedData.candles['1m'];
        } else if (enhancedData && enhancedData.candles && enhancedData.candles['5m'] && enhancedData.candles['5m'].length > 0) {
          logService.log('info', `Retrieved ${enhancedData.candles['5m'].length} candles from enhanced market data service (5m) for ${normalizedSymbol}`, null, 'TradeGenerator');
          return enhancedData.candles['5m'];
        } else {
          logService.log('warn', `No candles available from enhanced market data service for ${normalizedSymbol}`, null, 'TradeGenerator');
        }
      } catch (enhancedDataError) {
        logService.log('warn', `Failed to get data from enhanced market data service for ${normalizedSymbol}`, enhancedDataError, 'TradeGenerator');
      }

      // If all attempts fail, return an empty array
      logService.log('error', `All attempts to get historical data for ${normalizedSymbol} failed`, null, 'TradeGenerator');
      return [];
    } catch (error) {
      logService.log('error', `Failed to get historical data for ${symbol}`, error, 'TradeGenerator');
      return [];
    }
  }

  /**
   * Normalize symbol format to ensure consistency across different exchanges
   */
  private normalizeSymbol(symbol: string): string {
    // If symbol doesn't contain a separator, assume it's BTC/USDT format
    if (!symbol.includes('/') && !symbol.includes('-')) {
      return 'BTC/USDT';
    }

    // Ensure consistent format with / separator
    if (symbol.includes('-')) {
      return symbol.replace('-', '/');
    }

    return symbol;
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
    entryConditions?: string[];
    exitConditions?: string[];
    marginType?: string;
    leverage?: number;
  } | null> {
    try {
      // Log that we're generating a trade signal
      logService.log('info', `Generating trade signal for ${symbol} (Strategy: ${strategy.id})`, {
        currentPrice,
        availableBudget,
        riskLevel: strategy.riskLevel,
        marketType: strategy.marketType || 'spot'
      }, 'TradeGenerator');

      // Get enhanced market data for better trade generation
      let enhancedMarketData;
      try {
        enhancedMarketData = await enhancedMarketDataService.getMarketData(symbol, ['5m', '1h', '4h'], true);
        logService.log('info', `Enhanced market data for ${symbol}:`, {
          currentPrice: enhancedMarketData.currentPrice,
          priceChange24h: enhancedMarketData.priceChange24h,
          volatility: enhancedMarketData.volatility,
          trend: enhancedMarketData.trend,
          marketConditions: enhancedMarketData.marketConditions
        }, 'TradeGenerator');
      } catch (error) {
        logService.log('warn', `Failed to get enhanced market data for ${symbol}, falling back to basic market analysis`, error, 'TradeGenerator');
      }

      // Get market analysis as fallback if enhanced data is not available
      let marketAnalysis: MarketAnalysis | undefined;
      if (!enhancedMarketData) {
        try {
          marketAnalysis = await marketAnalysisService.getMarketAnalysis(symbol, true); // Force refresh
          logService.log('info', `Market analysis for ${symbol}:`, {
            regime: marketAnalysis.regime,
            trend: marketAnalysis.trend,
            strength: marketAnalysis.strength,
            volatility: marketAnalysis.volatility,
            support: marketAnalysis.support,
            resistance: marketAnalysis.resistance
          }, 'TradeGenerator');
        } catch (error) {
          logService.log('warn', `Failed to get market analysis for ${symbol}, proceeding without it`, error, 'TradeGenerator');
        }
      }

      // Prepare a more detailed prompt for DeepSeek with enhanced market data
      const prompt = `Analyze this trading opportunity with the following context:

Strategy Configuration:
${JSON.stringify(strategy.strategy_config, null, 2)}

Current Market Data:
- Symbol: ${symbol}
- Current Price: ${enhancedMarketData?.currentPrice || currentPrice}
- Price Change 24h: ${enhancedMarketData?.priceChange24h || 'unknown'}%
- Market Trend: ${enhancedMarketData?.trend || marketAnalysis?.trend || 'neutral'}
- Volatility: ${enhancedMarketData?.volatility || marketAnalysis?.volatility || 50}/100
- Support Level: ${enhancedMarketData?.indicators?.['1h']?.supportResistance?.support || marketAnalysis?.support || 'unknown'}
- Resistance Level: ${enhancedMarketData?.indicators?.['1h']?.supportResistance?.resistance || marketAnalysis?.resistance || 'unknown'}
- Risk Level: ${strategy.riskLevel || 'Medium'}
- Available Budget: $${availableBudget ? availableBudget.toFixed(2) : 'Unknown'}
- Market Type: ${strategy.marketType || 'spot'}

Technical Indicators:
${JSON.stringify(enhancedMarketData?.indicators || indicators, null, 2)}

Historical Data (Last 10 Candles):
${JSON.stringify(enhancedMarketData?.candles?.['1h']?.slice(-10) || historicalData.slice(-10), null, 2)}

Market Conditions:
${JSON.stringify(enhancedMarketData?.marketConditions || { volatility: marketAnalysis?.volatility || 50, trend: marketAnalysis?.trend || 'neutral' }, null, 2)}

Requirements:
1. Analyze if current conditions match strategy rules
2. Consider market trend, volatility, and technical indicators
3. Calculate precise entry, exit, and risk levels appropriate for ${strategy.marketType || 'spot'} trading
4. Provide confidence score and detailed rationale
5. Ensure risk parameters match ${strategy.riskLevel || 'Medium'} risk level
6. Consider the available budget when determining position size
7. ONLY generate a trade if market conditions are favorable
8. If conditions are not favorable, return null or a confidence score below 0.5
9. For futures trades, recommend appropriate leverage (1-10x) based on volatility
10. For margin trades, specify if cross or isolated margin is more appropriate
11. Include specific entry and exit conditions based on technical indicators
12. Consider support and resistance levels for stop loss and take profit targets

Return ONLY a JSON object with this structure:
{
  "direction": "Long" | "Short",
  "confidence": number (0-1),
  "stopLoss": number (price level),
  "takeProfit": number (price level),
  "trailingStop": number (optional, percentage),
  "leverage": number (only for futures),
  "marginType": "cross" | "isolated" (only for futures/margin),
  "entryConditions": string[] (specific conditions for entry),
  "exitConditions": string[] (specific conditions for exit),
  "rationale": string (detailed explanation)
}`;

      const response = await fetch(`/api/deepseek/v1/chat/completions`, {
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

  private async calculatePositionSize(
    strategy: Strategy,
    availableBudget: number,
    currentPrice: number,
    confidence: number
  ): Promise<number> {
    // Log inputs for debugging
    logService.log('debug', `Calculating position size with inputs:`, {
      strategyId: strategy.id,
      riskLevel: strategy.riskLevel,
      availableBudget,
      currentPrice,
      confidence,
      marketType: strategy.marketType || 'spot'
    }, 'TradeGenerator');

    try {
      // Get market analysis for better position sizing
      let marketAnalysis: MarketAnalysis | undefined;
      try {
        marketAnalysis = await marketAnalysisService.getMarketAnalysis(strategy.symbol || 'BTC/USDT');
        logService.log('debug', `Market analysis for position sizing:`, {
          regime: marketAnalysis.regime,
          volatility: marketAnalysis.volatility,
          trend: marketAnalysis.trend
        }, 'TradeGenerator');
      } catch (error) {
        logService.log('warn', `Failed to get market analysis for position sizing, using default values`, error, 'TradeGenerator');
      }

      // In demo mode, use a more varied approach to generate different trade sizes
      if (demoService.isInDemoMode()) {
        // Use risk management service for position sizing with some randomness for demo mode
        const baseSize = riskManagementService.calculatePositionSize(
          availableBudget,
          currentPrice,
          strategy.riskLevel,
          strategy.marketType || 'spot',
          marketAnalysis,
          confidence
        );

        // Add some randomness to make demo trades more varied
        const randomFactor = 0.7 + (Math.random() * 0.6); // 0.7 to 1.3 random factor
        const demoPositionSize = baseSize * randomFactor;

        // Round to appropriate decimal places based on price
        const roundedSize = this.roundPositionSize(demoPositionSize, currentPrice);

        logService.log('debug', `Demo mode position size calculation:`, {
          baseSize,
          randomFactor,
          demoPositionSize,
          roundedSize
        }, 'TradeGenerator');

        return roundedSize;
      }

      // For live mode, use a more conservative approach with risk management service
      const positionSize = riskManagementService.calculatePositionSize(
        availableBudget,
        currentPrice,
        strategy.riskLevel,
        strategy.marketType || 'spot',
        marketAnalysis,
        confidence * 0.9 // Slightly reduce confidence for live mode to be more conservative
      );

      // No maximum position size restriction
      // Use the position size calculated by the risk management service directly
      const finalPositionSize = positionSize;

      // Round position size appropriately based on price
      const roundedSize = this.roundPositionSize(finalPositionSize, currentPrice);

      logService.log('debug', `Position size calculation (no maximum limit):`, {
        riskManagedSize: positionSize,
        finalPositionSize,
        roundedSize
      }, 'TradeGenerator');

      logService.log('debug', `Live mode position size calculation:`, {
        riskManagedSize: positionSize,
        finalPositionSize,
        roundedSize
      }, 'TradeGenerator');

      return roundedSize;
    } catch (error) {
      logService.log('error', `Error in advanced position size calculation, falling back to basic calculation`, error, 'TradeGenerator');

      // Fallback to basic calculation if risk management service fails
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

      // Calculate position size
      const baseSize = availableBudget * riskMultiplier * confidence;
      const positionSize = baseSize / currentPrice;
      return this.roundPositionSize(positionSize, currentPrice);
    }
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
      const response = await fetch(`/api/deepseek/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
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
   * Check if market conditions are favorable for a strategy
   * @param strategy The strategy to check
   * @param marketAnalysis The market analysis data
   */
  private isMarketFavorable(strategy: Strategy, marketAnalysis: MarketAnalysis): boolean {
    try {
      // Default to true if we can't determine
      if (!marketAnalysis) return true;

      // Get strategy risk level
      const riskLevel = strategy.riskLevel || 'Medium';

      // Check market regime compatibility
      const isRegimeCompatible = this.isRegimeCompatible(riskLevel, marketAnalysis.regime);

      // Check volatility compatibility
      const isVolatilityCompatible = this.isVolatilityCompatible(riskLevel, marketAnalysis.volatility);

      // Check trend strength compatibility
      const isTrendCompatible = this.isTrendCompatible(riskLevel, marketAnalysis.trend, marketAnalysis.strength);

      // Check liquidity compatibility
      const isLiquidityCompatible = marketAnalysis.liquidity?.score > 30; // Minimum liquidity threshold

      // Combine all factors with appropriate weights
      const regimeWeight = 0.4;
      const volatilityWeight = 0.3;
      const trendWeight = 0.2;
      const liquidityWeight = 0.1;

      const favorabilityScore =
        (isRegimeCompatible ? regimeWeight : 0) +
        (isVolatilityCompatible ? volatilityWeight : 0) +
        (isTrendCompatible ? trendWeight : 0) +
        (isLiquidityCompatible ? liquidityWeight : 0);

      // Market is favorable if score is above threshold
      return favorabilityScore >= 0.6; // 60% threshold
    } catch (error) {
      logService.log('error', 'Error determining market favorability', error, 'TradeGenerator');
      return true; // Default to true if we can't determine
    }
  }

  /**
   * Check if market regime is compatible with strategy risk level
   */
  private isRegimeCompatible(riskLevel: RiskLevel, regime: MarketRegime): boolean {
    switch (regime) {
      case 'trending':
        // Trending markets are good for most strategies
        return true;
      case 'ranging':
        // Ranging markets are good for low to medium risk strategies
        return ['Ultra Low', 'Low', 'Medium'].includes(riskLevel);
      case 'volatile':
        // Volatile markets are good for high risk strategies
        return ['High', 'Ultra High', 'Extreme', 'God Mode'].includes(riskLevel);
      case 'unknown':
      default:
        // Unknown regime - default to compatible for medium risk and below
        return ['Ultra Low', 'Low', 'Medium'].includes(riskLevel);
    }
  }

  /**
   * Check if market volatility is compatible with strategy risk level
   */
  private isVolatilityCompatible(riskLevel: RiskLevel, volatility: number): boolean {
    // Higher risk levels can handle higher volatility
    const volatilityThresholds = {
      'Ultra Low': 30,
      'Low': 40,
      'Medium': 60,
      'High': 70,
      'Ultra High': 80,
      'Extreme': 90,
      'God Mode': 100
    };

    const threshold = volatilityThresholds[riskLevel] || 60;
    return volatility <= threshold;
  }

  /**
   * Check if market trend is compatible with strategy risk level
   */
  private isTrendCompatible(riskLevel: RiskLevel, trend: 'bullish' | 'bearish' | 'neutral', strength: number): boolean {
    // For neutral trends, higher risk levels need stronger trends
    if (trend === 'neutral') {
      const strengthThresholds = {
        'Ultra Low': 20,
        'Low': 30,
        'Medium': 40,
        'High': 50,
        'Ultra High': 60,
        'Extreme': 70,
        'God Mode': 80
      };

      const threshold = strengthThresholds[riskLevel] || 40;
      return strength >= threshold;
    }

    // For bullish/bearish trends, most strategies are compatible
    return true;
  }

  /**
   * Adapt a single strategy based on current market conditions
   * Uses the strategy adaptation service for more comprehensive adaptation
   */
  private async adaptStrategy(strategy: Strategy): Promise<void> {
    try {
      const strategyId = strategy.id;
      logService.log('info', `Adapting strategy ${strategyId} to current market conditions`, null, 'TradeGenerator');

      // Use the strategy adaptation service to check and adapt the strategy
      await strategyAdaptationService.checkStrategyMarketFit(strategyId);

      // Get the trading pairs for this strategy
      const tradingPairs = strategy.selected_pairs || [];
      if (tradingPairs.length === 0) {
        logService.log('warn', `Strategy ${strategyId} has no trading pairs`, null, 'TradeGenerator');
        return;
      }

      // Analyze market conditions for each trading pair
      for (const symbol of tradingPairs) {
        try {
          // Get market analysis
          const marketAnalysis = await marketAnalysisService.getMarketAnalysis(symbol);

          // Log market analysis
          logService.log('info', `Market analysis for ${symbol} (Strategy: ${strategyId}):`, {
            regime: marketAnalysis.regime,
            trend: marketAnalysis.trend,
            strength: marketAnalysis.strength,
            volatility: marketAnalysis.volatility
          }, 'TradeGenerator');

          // Emit market analysis event
          eventBus.emit(`market:analysis:${strategyId}`, {
            strategyId,
            symbol,
            analysis: marketAnalysis
          });

          // Check if market conditions are favorable for this strategy
          const isFavorable = this.isMarketFavorable(strategy, marketAnalysis);

          // Log market favorability
          logService.log('info', `Market conditions for ${symbol} are ${isFavorable ? 'favorable' : 'unfavorable'} for strategy ${strategyId}`, {
            riskLevel: strategy.riskLevel,
            marketType: strategy.marketType || 'spot'
          }, 'TradeGenerator');

          // If market conditions are favorable, check for trading opportunities
          if (isFavorable) {
            // This will be handled by the regular checkTradingOpportunities method
            // Just update the last check time to prioritize this pair
            const state = this.monitorState.get(strategyId);
            if (state) {
              state.lastCheckTime = Date.now() - this.CHECK_FREQUENCY + 60000; // Check in 1 minute
              this.monitorState.set(strategyId, state);
            }
          }
        } catch (error) {
          logService.log('error', `Failed to analyze market for ${symbol} (Strategy: ${strategyId})`, error, 'TradeGenerator');
        }
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

      // Call the separate method to adapt the strategy with DeepSeek
      const updatedStrategy = await this.adaptStrategyWithDeepseek(strategy, strategyId, prompt);

      if (updatedStrategy) {
        // Update local cache
        this.activeStrategies.set(strategyId, updatedStrategy);

        // Emit events
        this.emit('strategyAdapted', updatedStrategy);
        eventBus.emit('strategy:updated', { strategy: updatedStrategy });
        eventBus.emit(`strategy:updated:${strategyId}`, { strategyId, strategy: updatedStrategy });

        logService.log('info', `Successfully adapted strategy ${strategyId}`, {
          oldConfig: strategy.strategy_config,
          newConfig: updatedStrategy.strategy_config
        }, 'TradeGenerator');
      } else {
        logService.log('warn', `Strategy adaptation returned no result for ${strategyId}`, null, 'TradeGenerator');
      }
    } catch (error) {
      logService.log('error', `Failed to adapt strategy ${strategy.id}`, error, 'TradeGenerator');
    }
  }

  /**
   * Adapt a strategy using DeepSeek API
   * @param strategy The strategy to adapt
   * @param strategyId The ID of the strategy
   * @param prompt The prompt to send to DeepSeek
   * @returns The updated strategy or the original strategy if adaptation fails
   */
  private async adaptStrategyWithDeepseek(strategy: Strategy, strategyId: string, prompt: string): Promise<Strategy> {
    try {
      // Call DeepSeek API
      const response = await fetch(`/api/deepseek/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from DeepSeek');
      }

      // Extract JSON from response
      try {
        // First, try to find JSON within code blocks (```json ... ```)
        let jsonContent = '';
        const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);

        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonContent = codeBlockMatch[1];
          logService.log('info', 'Found JSON in code block', null, 'TradeGenerator');
        } else {
          // If no code block, try to find JSON directly
          const jsonStart = content.indexOf('{');
          const jsonEnd = content.lastIndexOf('}');

          if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error('No valid JSON found in response');
          }

          jsonContent = content.substring(jsonStart, jsonEnd + 1);
          logService.log('info', 'Found JSON directly in content', null, 'TradeGenerator');
        }

        // Clean up the JSON content
        jsonContent = jsonContent.trim();

        // Log the JSON content for debugging
        logService.log('debug', 'Extracted JSON content', { jsonContent: jsonContent.substring(0, 100) + '...' }, 'TradeGenerator');

        const updatedConfig = JSON.parse(jsonContent);

        // Validate updated config
        if (!updatedConfig.name) {
          logService.log('warn', `Missing name in updated config for strategy ${strategyId}, using existing name`, null, 'TradeGenerator');
          updatedConfig.name = strategy.name || 'Unnamed Strategy';
        }

        if (!updatedConfig.type) {
          logService.log('warn', `Missing type in updated config for strategy ${strategyId}, using existing type`, null, 'TradeGenerator');
          updatedConfig.type = strategy.strategy_config?.type || 'custom';
        }

        if (!updatedConfig.selected_pairs || !Array.isArray(updatedConfig.selected_pairs) || updatedConfig.selected_pairs.length === 0) {
          logService.log('warn', `Missing or invalid selected_pairs in updated config for strategy ${strategyId}, using existing pairs`, null, 'TradeGenerator');
          updatedConfig.selected_pairs = strategy.selected_pairs || strategy.strategy_config?.assets || ['BTC/USDT'];
        }

        // Update strategy with new configuration
        const updatedStrategy = {
          ...strategy,
          name: updatedConfig.name,
          description: updatedConfig.description || strategy.description,
          strategy_config: {
            ...strategy.strategy_config,
            ...updatedConfig
          },
          updated_at: new Date().toISOString()
        };

        // Save updated strategy to database
        await strategyService.updateStrategy(strategyId, updatedStrategy);

        return updatedStrategy;
      } catch (jsonError) {
        logService.log('error', `Error parsing JSON from DeepSeek response for strategy ${strategyId}`, {
          error: jsonError,
          content: content.substring(0, 100) + '...'
        }, 'TradeGenerator');
        throw new Error(`Failed to parse JSON from DeepSeek response: ${jsonError.message}`);
      }
    } catch (apiError) {
      logService.log('error', `DeepSeek API error for strategy ${strategyId}`, apiError, 'TradeGenerator');

      // Return the original strategy without changes
      logService.log('info', `Keeping original strategy configuration for ${strategyId} due to API error`, null, 'TradeGenerator');
      return strategy;
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
   * Create a fallback trade when normal trade creation fails
   * This is a last resort method to ensure trades are created in demo mode
   */
  private async createFallbackTrade(
    strategy: Strategy,
    symbol: string,
    side: string,
    entryPrice: number,
    amount: number,
    stopLoss: number,
    takeProfit: number,
    trailingStop: number | undefined,
    signal: any
  ): Promise<any> {
    try {
      logService.log('info', `Creating fallback trade for ${symbol} in demo mode`, {
        strategyId: strategy.id,
        symbol,
        side,
        amount,
        entryPrice
      }, 'TradeGenerator');

      // Create a unique stable ID for the trade
      const tradeId = `fallback-${strategy.id}-${symbol.replace('/', '')}-${Date.now()}`;

      // Create a simplified trade object
      const fallbackTrade = {
        id: tradeId,
        strategy_id: strategy.id,
        symbol: symbol,
        side: side,
        type: 'market',
        amount: amount,
        price: entryPrice,
        entry_price: entryPrice,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        trailing_stop: trailingStop,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          demo: true,
          fallback: true,
          source: 'trade-generator-fallback',
          entry_price: entryPrice,
          stop_loss: stopLoss,
          take_profit: takeProfit,
          trailing_stop: trailingStop,
          rationale: signal.rationale || `Fallback trade for ${symbol}`
        }
      };

      // Try to insert the trade directly into the database
      try {
        const { data, error } = await supabase
          .from('trades')
          .insert([{
            id: tradeId,
            strategy_id: strategy.id,
            symbol: symbol,
            side: side,
            quantity: amount,
            price: entryPrice,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            metadata: {
              demo: true,
              fallback: true,
              source: 'trade-generator-fallback',
              entry_price: entryPrice,
              stop_loss: stopLoss,
              take_profit: takeProfit,
              trailing_stop: trailingStop,
              rationale: signal.rationale || `Fallback trade for ${symbol}`
            }
          }])
          .select()
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          // Reserve budget for this trade
          const tradeCost = amount * entryPrice;
          await tradeService.reserveBudgetForTrade(strategy.id, tradeCost, tradeId);

          // Update trade status to executed after a short delay
          setTimeout(async () => {
            try {
              const { error: updateError } = await supabase
                .from('trades')
                .update({
                  status: 'executed',
                  executed_at: new Date().toISOString()
                })
                .eq('id', tradeId);

              if (!updateError) {
                logService.log('info', `Updated fallback trade status to executed for ${symbol}`, {
                  tradeId
                }, 'TradeGenerator');
              } else {
                logService.log('warn', `Failed to update fallback trade status for ${symbol}`, updateError, 'TradeGenerator');
              }
            } catch (updateError) {
              logService.log('error', `Failed to update fallback trade status for ${symbol}`, updateError, 'TradeGenerator');
            }
          }, 2000);

          logService.log('info', `Successfully created fallback trade for ${symbol} in database`, {
            tradeId,
            strategyId: strategy.id,
            symbol,
            side,
            amount
          }, 'TradeGenerator');

          return data;
        }
      } catch (dbError) {
        logService.log('error', `Failed to insert fallback trade into database for ${symbol}`, dbError, 'TradeGenerator');
      }

      // If database insertion fails, return the fallback trade object
      // This ensures we always have a trade object to work with
      logService.log('info', `Returning in-memory fallback trade for ${symbol}`, {
        tradeId,
        strategyId: strategy.id
      }, 'TradeGenerator');

      // Emit an event to notify that a fallback trade was created
      eventBus.emit('trade:fallback:created', {
        strategyId: strategy.id,
        symbol,
        trade: fallbackTrade
      });

      return fallbackTrade;
    } catch (error) {
      logService.log('error', `Failed to create fallback trade for ${symbol}`, error, 'TradeGenerator');
      return null;
    }
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
