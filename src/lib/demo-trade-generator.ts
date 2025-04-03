import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { supabase } from './supabase';
import { eventBus } from './event-bus';
import { demoService } from './demo-service';
import { tradeManager } from './trade-manager';
import { tradeService } from './trade-service';
import { aiService } from './ai-service';
import type { Strategy } from './types';

/**
 * Demo Trade Generator
 *
 * This class generates demo trades for active strategies
 * It's a simplified version of the trade generator that doesn't rely on external APIs
 */
class DemoTradeGenerator extends EventEmitter {
  private static instance: DemoTradeGenerator;
  private initialized: boolean = false;
  private readonly CHECK_FREQUENCY = 15000; // 15 seconds - increased frequency for more active trading
  private activeStrategies: Map<string, Strategy> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private lastPrices: Map<string, number> = new Map();
  private priceHistory: Map<string, number[]> = new Map();

  private constructor() {
    super();
  }

  static getInstance(): DemoTradeGenerator {
    if (!DemoTradeGenerator.instance) {
      DemoTradeGenerator.instance = new DemoTradeGenerator();
    }
    return DemoTradeGenerator.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logService.log('info', 'Initializing demo trade generator', null, 'DemoTradeGenerator');

      // Initialize price history for common pairs
      this.initializePriceHistory();

      // Start periodic check for trading opportunities
      this.startPeriodicCheck();

      this.initialized = true;
      logService.log('info', 'Demo trade generator initialized', null, 'DemoTradeGenerator');
    } catch (error) {
      logService.log('error', 'Failed to initialize demo trade generator', error, 'DemoTradeGenerator');
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

  private startPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Immediately run the first check
    this.updatePrices().then(() => this.checkTradingOpportunities());

    // Set up interval for subsequent checks
    this.checkInterval = setInterval(async () => {
      try {
        await this.updatePrices();
        await this.checkTradingOpportunities();
        logService.log('debug', 'Completed periodic check for trading opportunities', null, 'DemoTradeGenerator');
      } catch (error) {
        logService.log('error', 'Error in periodic check', error, 'DemoTradeGenerator');
      }
    }, this.CHECK_FREQUENCY);

    logService.log('info', `Started checking for trading opportunities (every ${this.CHECK_FREQUENCY / 1000}s)`, null, 'DemoTradeGenerator');
  }

  private async updatePrices() {
    // Update prices with realistic movements
    for (const [symbol, lastPrice] of this.lastPrices.entries()) {
      // Generate a random price movement between -2% and +2%
      const changePercent = (Math.random() * 4 - 2) / 100;
      const newPrice = lastPrice * (1 + changePercent);

      // Update last price
      this.lastPrices.set(symbol, newPrice);

      // Update price history (keep last 100 prices)
      const history = this.priceHistory.get(symbol) || [];
      history.push(newPrice);
      if (history.length > 100) {
        history.shift();
      }
      this.priceHistory.set(symbol, history);

      // Check for trades that need to be updated based on price movement
      await this.checkTradeUpdates(symbol, newPrice);
    }
  }

  /**
   * Check if any trades need to be updated based on price movements
   * This simulates the monitoring of entry/exit conditions
   */
  private async checkTradeUpdates(symbol: string, currentPrice: number) {
    try {
      // Get all open trades for this symbol
      const { data: openTrades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('symbol', symbol)
        .eq('status', 'open');

      if (error) throw error;
      if (!openTrades || openTrades.length === 0) return;

      // Check each trade for take profit or stop loss triggers
      for (const trade of openTrades) {
        try {
          const side = trade.side;
          const takeProfit = trade.take_profit;
          const stopLoss = trade.stop_loss;
          const entryPrice = trade.entry_price || trade.price;

          // Check if take profit or stop loss has been hit
          let closeReason = null;
          let profit = 0;

          if (side === 'buy') {
            // For long positions
            if (currentPrice >= takeProfit) {
              closeReason = 'take_profit';
              profit = (currentPrice - entryPrice) * trade.quantity;
            } else if (currentPrice <= stopLoss) {
              closeReason = 'stop_loss';
              profit = (currentPrice - entryPrice) * trade.quantity;
            }
          } else {
            // For short positions
            if (currentPrice <= takeProfit) {
              closeReason = 'take_profit';
              profit = (entryPrice - currentPrice) * trade.quantity;
            } else if (currentPrice >= stopLoss) {
              closeReason = 'stop_loss';
              profit = (entryPrice - currentPrice) * trade.quantity;
            }
          }

          // If a close condition was met, update the trade
          if (closeReason) {
            await supabase
              .from('trades')
              .update({
                status: 'closed',
                close_reason: closeReason,
                closed_at: new Date().toISOString(),
                exit_price: currentPrice,
                profit: profit,
                updated_at: new Date().toISOString()
              })
              .eq('id', trade.id);

            logService.log('info', `Closed trade ${trade.id} due to ${closeReason}`, {
              trade,
              currentPrice,
              profit
            }, 'DemoTradeGenerator');

            // Emit trade updated event
            eventBus.emit('trade:update', {
              id: trade.id,
              status: 'closed',
              closeReason,
              exitPrice: currentPrice,
              profit
            });
          }
        } catch (tradeError) {
          logService.log('error', `Error updating trade ${trade.id}`, tradeError, 'DemoTradeGenerator');
        }
      }
    } catch (error) {
      logService.log('error', `Error checking trade updates for ${symbol}`, error, 'DemoTradeGenerator');
    }
  }

  private async checkTradingOpportunities() {
    if (this.activeStrategies.size === 0) return;

    logService.log('debug', `Checking trading opportunities for ${this.activeStrategies.size} strategies`, null, 'DemoTradeGenerator');

    for (const [strategyId, strategy] of this.activeStrategies.entries()) {
      try {
        // Check for trade opportunities
        await this.checkStrategyForTrades(strategy);
      } catch (error) {
        logService.log('error', `Error checking trading opportunities for strategy ${strategyId}:`, error, 'DemoTradeGenerator');
      }
    }
  }

  private async checkStrategyForTrades(strategy: Strategy) {
    try {
      logService.log('debug', `Checking trade opportunities for strategy ${strategy.id}`, null, 'DemoTradeGenerator');

      // Get the trading pairs from the strategy
      const tradingPairs = strategy.selected_pairs || ['BTC/USDT'];

      // For each trading pair, decide if we should generate a trade
      for (const symbol of tradingPairs) {
        try {
          // Increase trade generation probability to 40%
          if (Math.random() > 0.4) continue;

          // Get current price
          const currentPrice = this.lastPrices.get(symbol) || 0;
          if (currentPrice === 0) continue;

          // Get price history
          const history = this.priceHistory.get(symbol) || [];
          if (history.length < 10) continue;

          // Use DeepSeek AI to analyze market conditions and generate trade signal
          let aiAnalysis = await this.getAITradeSignal(strategy, symbol, history);

          // If AI doesn't recommend a trade, still have a chance to generate one
          if (!aiAnalysis || !aiAnalysis.shouldTrade) {
            // 30% chance to generate a trade anyway
            if (Math.random() > 0.3) continue;

            // Create a fallback analysis
            aiAnalysis = {
              shouldTrade: true,
              direction: Math.random() > 0.5 ? 'Long' : 'Short',
              confidence: 0.5 + Math.random() * 0.3,
              stopLossPercent: Math.random() > 0.5 ? -0.02 : 0.02,
              takeProfitPercent: Math.random() > 0.5 ? 0.04 : -0.04,
              trailingStop: 0.01,
              rationale: `Generated fallback trade for ${symbol} based on market conditions`
            };
          }

          // Use AI-recommended trade parameters or fallback to calculated values
          const direction = aiAnalysis.direction || (currentPrice > history[history.length - 10] ? 'Long' : 'Short');

          // Use AI-recommended confidence or calculate based on volatility
          const volatility = Math.max(0.01, Math.min(0.2, Math.abs(currentPrice - history[history.length - 10]) / history[history.length - 10]));
          const confidence = aiAnalysis.confidence || (0.5 + volatility * 2); // Scale to 0.5-0.9 range

          // Use AI-recommended stop loss and take profit or fallback to calculated values
          const stopLossPercent = aiAnalysis.stopLossPercent || (direction === 'Long' ? -0.02 : 0.02); // 2% stop loss
          const takeProfitPercent = aiAnalysis.takeProfitPercent || (direction === 'Long' ? 0.04 : -0.04); // 4% take profit

          const stopLoss = currentPrice * (1 + stopLossPercent);
          const takeProfit = currentPrice * (1 + takeProfitPercent);

          // Get budget
          const budget = await tradeService.getBudget(strategy.id);
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
            trailingStop: aiAnalysis.trailingStop || 0.01, // Use AI recommendation or default to 1% trailing stop
            rationale: aiAnalysis.rationale || `Generated demo trade for ${symbol} based on ${direction === 'Long' ? 'upward' : 'downward'} price movement.`
          };

          // Create a trade in the database
          try {
            // Create trade signal in database
            const { data: tradeSignal, error: signalError } = await supabase
              .from('trade_signals')
              .insert({
                strategy_id: strategy.id,
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
                  aiGenerated: true // Mark as AI-generated
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

            logService.log('info', `Created AI-generated trade signal for ${symbol}`, {
              strategy: strategy.id,
              signal
            }, 'DemoTradeGenerator');
          } catch (tradeError) {
            logService.log('error', `Failed to create trade for ${symbol}`, tradeError, 'DemoTradeGenerator');

            // Try direct trade creation as fallback
            await this.createTrade(strategy, symbol, direction, currentPrice, positionSize, stopLoss, takeProfit);
          }
        } catch (error) {
          logService.log('error', `Error processing ${symbol} for strategy ${strategy.id}`, error, 'DemoTradeGenerator');
        }
      }
    } catch (error) {
      logService.log('error', `Error checking strategy ${strategy.id} for trades`, error, 'DemoTradeGenerator');
    }
  }

  /**
   * Uses DeepSeek AI to analyze market conditions and generate trade signals
   * @param strategy The strategy to generate signals for
   * @param symbol The trading pair symbol
   * @param priceHistory Historical price data
   * @returns AI-generated trade signal or null if no trade is recommended
   */
  private async getAITradeSignal(strategy: Strategy, symbol: string, priceHistory: any[]): Promise<any> {
    try {
      // Convert price history to a format suitable for AI analysis
      const formattedHistory = priceHistory.map((price, index) => ({
        close: price,
        timestamp: Date.now() - ((priceHistory.length - index) * 60 * 60 * 1000) // Hourly data
      }));

      // Get strategy configuration
      const strategyConfig = strategy.strategy_config || {};

      // Prepare market data for AI analysis
      const marketData = [{
        asset: symbol,
        currentPrice: priceHistory[priceHistory.length - 1],
        volume24h: Math.random() * 1000000, // Simulated volume
        priceHistory: formattedHistory
      }];

      try {
        // Use DeepSeek AI to analyze market conditions
        const aiResult = await aiService.analyzeMarketConditions(
          symbol,
          strategy.riskLevel || 'Medium',
          marketData,
          strategyConfig
        );

        if (!aiResult) return null;

        // Extract trade signal from AI analysis
        return {
          shouldTrade: aiResult.shouldTrade || Math.random() > 0.7, // 30% chance of trade if AI doesn't specify
          direction: aiResult.direction || (Math.random() > 0.5 ? 'Long' : 'Short'),
          confidence: aiResult.confidence || (0.5 + Math.random() * 0.5),
          stopLossPercent: aiResult.stopLossPercent,
          takeProfitPercent: aiResult.takeProfitPercent,
          trailingStop: aiResult.trailingStop,
          rationale: aiResult.rationale || `AI-generated trade signal for ${symbol}`
        };
      } catch (aiError) {
        // If AI analysis fails, log the error and return a fallback signal
        logService.log('warn', 'Failed to get AI trade signal, using fallback', aiError, 'DemoTradeGenerator');

        // Return a fallback signal with 30% chance of recommending a trade
        return {
          shouldTrade: Math.random() > 0.7,
          direction: Math.random() > 0.5 ? 'Long' : 'Short',
          confidence: 0.5 + Math.random() * 0.5,
          stopLossPercent: null,
          takeProfitPercent: null,
          trailingStop: null,
          rationale: `Fallback trade signal for ${symbol} due to AI analysis failure`
        };
      }
    } catch (error) {
      logService.log('error', 'Error generating AI trade signal', error, 'DemoTradeGenerator');
      return null;
    }
  }

  private async processTradeSignal(signal: any, strategy: Strategy) {
    try {
      // Execute the trade
      const tradeOptions = {
        strategy_id: strategy.id,
        symbol: signal.symbol,
        side: signal.side,
        type: 'market' as 'market', // Type assertion to fix type compatibility
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
      }, 'DemoTradeGenerator');
    } catch (error) {
      logService.log('error', `Failed to process trade signal for ${signal.symbol}`, error, 'DemoTradeGenerator');
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
          entry_price: currentPrice,
          stop_loss: stopLoss,
          take_profit: takeProfit,
          trailing_stop: 0.01,
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {
            demo: true,
            source: 'demo-generator',
            entry_condition: `Price crossed ${direction === 'Long' ? 'above' : 'below'} ${currentPrice}`,
            exit_condition: `${direction === 'Long' ? 'Take profit at ' + takeProfit + ' or stop loss at ' + stopLoss : 'Take profit at ' + takeProfit + ' or stop loss at ' + stopLoss}`
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
          }, 'DemoTradeGenerator');
        } catch (updateError) {
          logService.log('error', `Failed to update trade status for ${symbol}`, updateError, 'DemoTradeGenerator');
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
      }, 'DemoTradeGenerator');
    } catch (error) {
      logService.log('error', `Failed to create trade for ${symbol}`, error, 'DemoTradeGenerator');
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
    }[strategy.riskLevel || 'Medium'] || 0.15;

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
}

export const demoTradeGenerator = DemoTradeGenerator.getInstance();
