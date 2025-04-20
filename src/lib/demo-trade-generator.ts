import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { supabase } from './supabase';
import { eventBus } from './event-bus';
import { demoService } from './demo-service';
import { tradeManager } from './trade-manager';
import { tradeService } from './trade-service';
import { aiService } from './ai-service';
import type { Strategy } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Demo Trade Generator
 *
 * This class generates demo trades for active strategies
 * It's a simplified version of the trade generator that doesn't rely on external APIs
 */
class DemoTradeGenerator extends EventEmitter {
  private static instance: DemoTradeGenerator;
  private initialized: boolean = false;
  private readonly CHECK_FREQUENCY = 10000; // 10 seconds - increased frequency for more active trading
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

          // Check custom exit conditions if defined
          if (!closeReason && trade.metadata?.exitConditions && Array.isArray(trade.metadata.exitConditions)) {
            for (const condition of trade.metadata.exitConditions) {
              // Parse exit conditions
              if (typeof condition === 'string') {
                // Check for take profit condition
                if (condition.includes('Take profit at')) {
                  const priceMatch = condition.match(/Take profit at ([\d.]+)/);
                  if (priceMatch && priceMatch[1]) {
                    const targetPrice = parseFloat(priceMatch[1]);
                    if ((side === 'buy' && currentPrice >= targetPrice) ||
                        (side === 'sell' && currentPrice <= targetPrice)) {
                      closeReason = 'take_profit_condition';
                      profit = side === 'buy' ?
                        (currentPrice - entryPrice) * trade.quantity :
                        (entryPrice - currentPrice) * trade.quantity;
                      break;
                    }
                  }
                // Check for stop loss condition
                } else if (condition.includes('Stop loss at')) {
                  const priceMatch = condition.match(/Stop loss at ([\d.]+)/);
                  if (priceMatch && priceMatch[1]) {
                    const stopPrice = parseFloat(priceMatch[1]);
                    if ((side === 'buy' && currentPrice <= stopPrice) ||
                        (side === 'sell' && currentPrice >= stopPrice)) {
                      closeReason = 'stop_loss_condition';
                      profit = side === 'buy' ?
                        (currentPrice - entryPrice) * trade.quantity :
                        (entryPrice - currentPrice) * trade.quantity;
                      break;
                    }
                  }
                }
                // Add more condition types as needed
              }
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

      // Get budget for this strategy
      const budget = await tradeService.getBudget(strategy.id);
      if (!budget || budget.available <= 0) {
        logService.log('debug', `No available budget for strategy ${strategy.id}`, null, 'DemoTradeGenerator');
        return;
      }

      // Increase the chance of generating trades in demo mode (70% chance)
      if (Math.random() > 0.7) {
        logService.log('debug', `Skipping trade generation for strategy ${strategy.id} (random check)`, null, 'DemoTradeGenerator');
        return;
      }

      logService.log('info', `Generating trades for strategy ${strategy.id} with budget ${budget.available}`, null, 'DemoTradeGenerator');

      // Collect price history for all trading pairs
      const pairHistories = new Map<string, any[]>();
      for (const symbol of tradingPairs) {
        const currentPrice = this.lastPrices.get(symbol) || 0;
        if (currentPrice === 0) continue;

        const history = this.priceHistory.get(symbol) || [];
        if (history.length < 10) continue;

        pairHistories.set(symbol, history);
      }

      if (pairHistories.size === 0) {
        logService.log('debug', `No valid price history for any pairs in strategy ${strategy.id}`, null, 'DemoTradeGenerator');
        return;
      }

      // Use DeepSeek AI to analyze market conditions and generate multiple trade signals
      const aiAnalysis = await this.getMultipleTradeSignals(strategy, pairHistories, budget.available);

      if (!aiAnalysis || !aiAnalysis.trades || aiAnalysis.trades.length === 0) {
        logService.log('debug', `No trade signals generated by DeepSeek for strategy ${strategy.id}`, null, 'DemoTradeGenerator');
        return;
      }

      // Track remaining budget as we create trades
      let remainingBudget = budget.available;

      // Process each trade signal from DeepSeek
      for (const tradeSignal of aiAnalysis.trades) {
        try {
          const symbol = tradeSignal.symbol || Array.from(pairHistories.keys())[0];
          const currentPrice = this.lastPrices.get(symbol) || 0;
          if (currentPrice === 0) continue;

          // Use AI-recommended trade parameters
          const direction = tradeSignal.direction || 'Long';
          const confidence = tradeSignal.confidence || 0.7;

          // Calculate stop loss and take profit
          const stopLossPercent = tradeSignal.stopLossPercent || (direction === 'Long' ? -0.02 : 0.02);
          const takeProfitPercent = tradeSignal.takeProfitPercent || (direction === 'Long' ? 0.04 : -0.04);

          const stopLoss = currentPrice * (1 + stopLossPercent);
          const takeProfit = currentPrice * (1 + takeProfitPercent);

          // Let DeepSeek decide position size, but ensure it doesn't exceed remaining budget
          let positionSize = tradeSignal.positionSize;

          // If DeepSeek didn't specify position size, calculate it based on risk level
          if (!positionSize) {
            positionSize = this.calculatePositionSize(
              strategy,
              remainingBudget,
              currentPrice,
              confidence
            );
          } else {
            // Ensure position size doesn't exceed remaining budget
            const maxPositionSize = remainingBudget / currentPrice;
            positionSize = Math.min(positionSize, maxPositionSize);
          }

          // Skip if position size is too small
          if (positionSize < 0.0001) {
            logService.log('debug', `Position size too small for ${symbol} in strategy ${strategy.id}`, null, 'DemoTradeGenerator');
            continue;
          }

          // Calculate the cost of this trade
          const tradeCost = positionSize * currentPrice;

          // Skip if not enough budget
          if (tradeCost > remainingBudget) {
            logService.log('debug', `Not enough budget for ${symbol} trade in strategy ${strategy.id}`, null, 'DemoTradeGenerator');
            continue;
          }

          // Create trade signal
          const signal = {
            direction: direction as 'Long' | 'Short',
            confidence,
            stopLoss,
            takeProfit,
            trailingStop: tradeSignal.trailingStop || 0.01,
            rationale: tradeSignal.rationale || `Generated demo trade for ${symbol} based on ${direction === 'Long' ? 'upward' : 'downward'} price movement.`
          };

          // Generate a unique ID for this trade
          const uniqueTradeId = `${strategy.id}-${symbol}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${uuidv4().substring(0, 8)}`;

          // Create trade signal in database
          const { data: dbTradeSignal, error: signalError } = await supabase
            .from('trade_signals')
            .insert({
              id: uniqueTradeId,
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
              expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              metadata: {
                rationale: signal.rationale,
                trailingStop: signal.trailingStop,
                aiGenerated: true,
                uniqueToStrategy: strategy.id,
                batchId: aiAnalysis.batchId || Date.now(), // Group trades from the same analysis
                entryConditions: tradeSignal.entryConditions || [],
                exitConditions: tradeSignal.exitConditions || []
              }
            })
            .select()
            .single();

          if (signalError) {
            // If the table doesn't exist, create the trade directly
            if (signalError.message && signalError.message.includes('relation "trade_signals" does not exist')) {
              await this.createTrade(
                strategy,
                symbol,
                direction,
                currentPrice,
                positionSize,
                stopLoss,
                takeProfit,
                uniqueTradeId,
                tradeSignal.entryConditions,
                tradeSignal.exitConditions
              );
            } else {
              throw signalError;
            }
          } else if (dbTradeSignal) {
            // Process the signal immediately
            await this.processTradeSignal(dbTradeSignal, strategy);
          }

          // Update remaining budget
          remainingBudget -= tradeCost;

          logService.log('info', `Created AI-generated trade for ${symbol} in strategy ${strategy.id}`, {
            strategy: strategy.id,
            signal,
            tradeId: uniqueTradeId,
            positionSize,
            tradeCost,
            remainingBudget
          }, 'DemoTradeGenerator');
        } catch (tradeError) {
          logService.log('error', `Failed to create trade for signal in strategy ${strategy.id}`, tradeError, 'DemoTradeGenerator');

          // Try direct trade creation as fallback
          try {
            const uniqueTradeId = `${strategy.id}-${symbol}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            await this.createTrade(
              strategy,
              symbol,
              direction,
              currentPrice,
              positionSize,
              stopLoss,
              takeProfit,
              uniqueTradeId,
              tradeSignal.entryConditions,
              tradeSignal.exitConditions
            );

            // Update remaining budget
            remainingBudget -= tradeCost;

            logService.log('info', `Created fallback trade for ${symbol} in strategy ${strategy.id}`, {
              strategy: strategy.id,
              tradeId: uniqueTradeId
            }, 'DemoTradeGenerator');
          } catch (fallbackError) {
            logService.log('error', `Failed to create fallback trade for ${symbol} in strategy ${strategy.id}`, fallbackError, 'DemoTradeGenerator');
          }
        }
      }
    } catch (error) {
      logService.log('error', `Error checking strategy ${strategy.id} for trades`, error, 'DemoTradeGenerator');
    }
  }

  /**
   * Uses DeepSeek AI to analyze market conditions and generate multiple trade signals
   * @param strategy The strategy to generate signals for
   * @param pairHistories Map of trading pairs to their price histories
   * @param availableBudget Available budget for the strategy
   * @returns AI-generated trade signals or null if no trades are recommended
   */
  private async getMultipleTradeSignals(strategy: Strategy, pairHistories: Map<string, any[]>, availableBudget: number): Promise<any> {
    try {
      // Create a batch ID for this set of trades
      const batchId = Date.now();

      // Get strategy configuration
      const strategyConfig = strategy.strategy_config || {};

      // Get market type from strategy or detect from description
      const marketType = strategy.marketType ||
                        strategy.market_type ||
                        (strategy.description ? detectMarketType(strategy.description) : 'spot');

      logService.log('info', `Using market type ${marketType} for strategy ${strategy.id}`, {
        strategyId: strategy.id,
        marketType,
        description: strategy.description?.substring(0, 50) + '...'
      }, 'DemoTradeGenerator');

      // Prepare market data for AI analysis
      const marketData: any[] = [];

      // Convert all pair histories to a format suitable for AI analysis
      for (const [symbol, history] of pairHistories.entries()) {
        const formattedHistory = history.map((price, index) => ({
          close: price,
          timestamp: Date.now() - ((history.length - index) * 60 * 60 * 1000) // Hourly data
        }));

        marketData.push({
          asset: symbol,
          currentPrice: history[history.length - 1],
          volume24h: Math.random() * 1000000, // Simulated volume
          priceHistory: formattedHistory
        });
      }

      try {
        // Use DeepSeek AI to analyze market conditions for all pairs
        // Include market type in the analysis request
        const aiResult = await aiService.analyzeMarketConditions(
          Array.from(pairHistories.keys()).join(','),
          strategy.riskLevel || 'Medium',
          marketData,
          {
            ...strategyConfig,
            marketType: marketType, // Explicitly pass market type
            strategyId: strategy.id, // Pass strategy ID for unique trade generation
            strategyName: strategy.name || strategy.title, // Pass strategy name for context
            strategyDescription: strategy.description // Pass description for context
          }
        );

        if (!aiResult) return this.generateFallbackTradeSignals(pairHistories, availableBudget, batchId);

        // Check if DeepSeek returned multiple trade signals
        if (aiResult.trades && Array.isArray(aiResult.trades)) {
          // DeepSeek returned multiple trades, use them directly
          return {
            batchId,
            trades: aiResult.trades.map((trade: any) => ({
              symbol: trade.symbol || Array.from(pairHistories.keys())[0],
              direction: trade.direction || 'Long',
              confidence: trade.confidence || 0.7,
              positionSize: trade.positionSize,
              stopLossPercent: trade.stopLossPercent || (trade.direction === 'Long' ? -0.02 : 0.02),
              takeProfitPercent: trade.takeProfitPercent || (trade.direction === 'Long' ? 0.04 : -0.04),
              trailingStop: trade.trailingStop || 0.01,
              rationale: trade.rationale || `AI-generated ${marketType} trade for ${trade.symbol} based on ${strategy.name || strategy.title} strategy`,
              marketType: trade.marketType || marketType, // Ensure market type is included
              strategyId: strategy.id, // Include strategy ID for tracking
              leverage: trade.leverage || (marketType === 'futures' ? this.getLeverageForRiskLevel(strategy.riskLevel) : undefined),
              marginType: trade.marginType || (marketType === 'futures' ? 'cross' : undefined),
              // Include detailed entry and exit conditions
              entryConditions: trade.entryConditions || [
                `Price crosses ${trade.direction === 'Long' ? 'above' : 'below'} ${this.lastPrices.get(trade.symbol || Array.from(pairHistories.keys())[0]) || 0}`
              ],
              exitConditions: trade.exitConditions || [
                `Take profit at ${(this.lastPrices.get(trade.symbol || Array.from(pairHistories.keys())[0]) || 0) * (1 + (trade.takeProfitPercent || (trade.direction === 'Long' ? 0.04 : -0.04)))}`,
                `Stop loss at ${(this.lastPrices.get(trade.symbol || Array.from(pairHistories.keys())[0]) || 0) * (1 + (trade.stopLossPercent || (trade.direction === 'Long' ? -0.02 : 0.02)))}`
              ]
            }))
          };
        } else if (aiResult.shouldTrade) {
          // DeepSeek returned a single trade recommendation, convert to our format
          const symbol = Array.from(pairHistories.keys())[0];
          const currentPrice = this.lastPrices.get(symbol) || 0;
          const direction = aiResult.direction || 'Long';
          const stopLossPercent = aiResult.stopLossPercent || (direction === 'Long' ? -0.02 : 0.02);
          const takeProfitPercent = aiResult.takeProfitPercent || (direction === 'Long' ? 0.04 : -0.04);

          return {
            batchId,
            trades: [{
              symbol,
              direction,
              confidence: aiResult.confidence || 0.7,
              positionSize: this.calculatePositionSizeFromBudget(availableBudget, aiResult.confidence || 0.7, strategy.riskLevel || 'Medium'),
              stopLossPercent,
              takeProfitPercent,
              trailingStop: aiResult.trailingStop || 0.01,
              rationale: aiResult.rationale || `AI-generated trade signal`,
              // Include detailed entry and exit conditions
              entryConditions: aiResult.entryConditions || [
                `Price crosses ${direction === 'Long' ? 'above' : 'below'} ${currentPrice}`
              ],
              exitConditions: aiResult.exitConditions || [
                `Take profit at ${currentPrice * (1 + takeProfitPercent)}`,
                `Stop loss at ${currentPrice * (1 + stopLossPercent)}`
              ]
            }]
          };
        }

        // If DeepSeek didn't recommend any trades, generate fallback signals
        return this.generateFallbackTradeSignals(pairHistories, availableBudget, batchId);
      } catch (aiError) {
        // If AI analysis fails, log the error and return fallback signals
        logService.log('warn', 'Failed to get AI trade signals, using fallback', aiError, 'DemoTradeGenerator');
        return this.generateFallbackTradeSignals(pairHistories, availableBudget, batchId);
      }
    } catch (error) {
      logService.log('error', 'Error generating AI trade signals', error, 'DemoTradeGenerator');
      return null;
    }
  }

  /**
   * Generate fallback trade signals when DeepSeek AI fails
   * @param pairHistories Map of trading pairs to their price histories
   * @param availableBudget Available budget for the strategy
   * @param batchId Batch ID for grouping trades
   * @returns Fallback trade signals
   */
  private generateFallbackTradeSignals(pairHistories: Map<string, any[]>, availableBudget: number, batchId: number): any {
    // Decide how many trades to generate (1-3)
    const numTrades = Math.floor(Math.random() * 3) + 1;

    // Get all available pairs
    const availablePairs = Array.from(pairHistories.keys());

    // Generate trades
    const trades = [];

    // Calculate budget per trade
    const budgetPerTrade = availableBudget / numTrades;

    for (let i = 0; i < numTrades && i < availablePairs.length; i++) {
      // Select a random pair
      const randomIndex = Math.floor(Math.random() * availablePairs.length);
      const symbol = availablePairs[randomIndex];

      // Remove this pair from available pairs to avoid duplicates
      availablePairs.splice(randomIndex, 1);

      // Get current price
      const history = pairHistories.get(symbol) || [];
      const currentPrice = history[history.length - 1] || 0;
      if (currentPrice === 0) continue;

      // Generate random trade parameters
      const direction = Math.random() > 0.5 ? 'Long' : 'Short';
      const confidence = 0.5 + Math.random() * 0.3;

      // Calculate position size (10-30% of budget per trade)
      const positionSizePercent = 0.1 + Math.random() * 0.2;
      const positionSize = (budgetPerTrade * positionSizePercent) / currentPrice;

      const stopLossPercent = direction === 'Long' ? -0.02 : 0.02;
      const takeProfitPercent = direction === 'Long' ? 0.04 : -0.04;

      trades.push({
        symbol,
        direction,
        confidence,
        positionSize,
        stopLossPercent,
        takeProfitPercent,
        trailingStop: 0.01,
        rationale: `Fallback trade signal for ${symbol} due to AI analysis failure`,
        // Include detailed entry and exit conditions
        entryConditions: [
          `Price crosses ${direction === 'Long' ? 'above' : 'below'} ${currentPrice}`
        ],
        exitConditions: [
          `Take profit at ${currentPrice * (1 + takeProfitPercent)}`,
          `Stop loss at ${currentPrice * (1 + stopLossPercent)}`
        ]
      });
    }

    return {
      batchId,
      trades
    };
  }

  /**
   * Calculate position size as a percentage of available budget based on confidence and risk level
   */
  private calculatePositionSizeFromBudget(availableBudget: number, confidence: number, riskLevel: string): number {
    const riskMultiplier = {
      'Ultra Low': 0.05,
      'Low': 0.1,
      'Medium': 0.15,
      'High': 0.2,
      'Ultra High': 0.25,
      'Extreme': 0.3,
      'God Mode': 0.5
    }[riskLevel] || 0.15;

    // Base position size on risk level and confidence
    const positionSizePercent = riskMultiplier * confidence;

    // Return the position size as a percentage of available budget
    return availableBudget * positionSizePercent;
  }

  /**
   * Uses DeepSeek AI to analyze market conditions and generate a single trade signal
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
      // Extract entry/exit conditions from metadata
      const entryConditions = signal.metadata?.entryConditions || [];
      const exitConditions = signal.metadata?.exitConditions || [];

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
        testnet: demoService.isInDemoMode(), // Use TestNet in demo mode
        entryConditions,
        exitConditions
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

  /**
   * Get appropriate leverage based on risk level
   * @param riskLevel Risk level of the strategy
   * @returns Leverage value as a string (e.g., '5x')
   */
  private getLeverageForRiskLevel(riskLevel: string): string {
    switch(riskLevel) {
      case 'Ultra Low': return '1x';
      case 'Low': return '2x';
      case 'Medium': return '5x';
      case 'High': return '10x';
      case 'Ultra High': return '20x';
      case 'Extreme': return '50x';
      case 'God Mode': return '100x';
      default: return '5x';
    }
  }

  private async createTrade(
    strategy: Strategy,
    symbol: string,
    direction: string,
    currentPrice: number,
    positionSize: number,
    stopLoss: number,
    takeProfit: number,
    uniqueTradeId?: string,
    entryConditions?: string[],
    exitConditions?: string[]
  ) {
    try {
      // Create trade directly in the database
      // Store trade details in metadata since some fields aren't in the database schema
      const tradeMetadata = {
        demo: true,
        source: 'demo-generator',
        uniqueToStrategy: strategy.id, // Mark this trade as unique to this strategy
        strategyName: strategy.name || strategy.title, // Include strategy name
        marketType: strategy.marketType || strategy.market_type || 'spot', // Include market type
        entry_price: currentPrice,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        trailing_stop: 0.01,
        entry_condition: `Price crossed ${direction === 'Long' ? 'above' : 'below'} ${currentPrice}`,
        exit_condition: `${direction === 'Long' ? 'Take profit at ' + takeProfit + ' or stop loss at ' + stopLoss : 'Take profit at ' + takeProfit + ' or stop loss at ' + stopLoss}`,
        entryConditions: entryConditions || [
          `Price crossed ${direction === 'Long' ? 'above' : 'below'} ${currentPrice}`
        ],
        exitConditions: exitConditions || [
          `Take profit at ${takeProfit}`,
          `Stop loss at ${stopLoss}`
        ],
        leverage: strategy.marketType === 'futures' ? this.getLeverageForRiskLevel(strategy.riskLevel) : undefined,
        marginType: strategy.marketType === 'futures' ? 'cross' : undefined,
        tradeGeneratedAt: new Date().toISOString(),
        riskLevel: strategy.riskLevel
      };

      // Create trade in the database with only the fields that exist in the schema
      const { data: trade, error } = await supabase
        .from('trades')
        .insert({
          id: uniqueTradeId || `${strategy.id}-${symbol}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${uuidv4().substring(0, 8)}`,
          strategy_id: strategy.id,
          symbol,
          side: direction === 'Long' ? 'buy' : 'sell',
          quantity: positionSize,
          price: currentPrice,
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {
            ...tradeMetadata
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

      // Broadcast the trade via WebSocket if available
      this.broadcastTradeUpdate(strategy.id, trade);

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

  /**
   * Broadcast a trade update via WebSocket
   * @param strategyId The ID of the strategy that generated the trade
   * @param trade The trade object
   */
  private broadcastTradeUpdate(strategyId: string, trade: any): void {
    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined') {
        // Use the websocketService to broadcast the trade update
        import('./websocket-service').then(({ websocketService }) => {
          websocketService.emit('trade_update', { strategyId, trade });
        }).catch(error => {
          logService.log('error', 'Failed to import websocket service', error, 'DemoTradeGenerator');
        });
      }

      // Log the broadcast
      logService.log('debug', `Broadcasting trade update for strategy ${strategyId}`, { tradeId: trade.id }, 'DemoTradeGenerator');
    } catch (error) {
      logService.log('error', 'Failed to broadcast trade update', error, 'DemoTradeGenerator');
    }
  }

  /**
   * Add a strategy to the demo trade generator
   * @param strategy The strategy to add
   */
  async addStrategy(strategy: Strategy): Promise<void> {
    try {
      this.activeStrategies.set(strategy.id, strategy);
      logService.log('info', `Added strategy ${strategy.id} to demo trade generator`, null, 'DemoTradeGenerator');

      // Generate initial trades immediately to ensure the user sees activity
      setTimeout(() => {
        this.generateInitialTrades(strategy);
      }, 2000); // Wait 2 seconds before generating initial trades
    } catch (error) {
      logService.log('error', `Failed to add strategy ${strategy.id} to demo trade generator`, error, 'DemoTradeGenerator');
    }
  }

  /**
   * Generate initial trades for a strategy to ensure the user sees activity
   * @param strategy The strategy to generate trades for
   */
  private async generateInitialTrades(strategy: Strategy): Promise<void> {
    try {
      // Get budget for this strategy
      const budget = await tradeService.getBudget(strategy.id);
      if (!budget || budget.available <= 0) {
        logService.log('debug', `No available budget for initial trades in strategy ${strategy.id}`, null, 'DemoTradeGenerator');
        return;
      }

      // Get the trading pairs from the strategy
      const tradingPairs = strategy.selected_pairs || ['BTC/USDT'];

      // Generate 1-3 initial trades
      const numTrades = 1 + Math.floor(Math.random() * 3);
      let remainingBudget = budget.available;

      logService.log('info', `Generating ${numTrades} initial trades for strategy ${strategy.id}`, null, 'DemoTradeGenerator');

      for (let i = 0; i < numTrades; i++) {
        // Pick a random trading pair
        const symbol = tradingPairs[Math.floor(Math.random() * tradingPairs.length)];
        const currentPrice = this.lastPrices.get(symbol) || 0;
        if (currentPrice === 0) continue;

        // Randomly decide direction
        const direction = Math.random() > 0.5 ? 'Long' : 'Short';

        // Calculate stop loss and take profit
        const stopLossPercent = direction === 'Long' ? -0.02 : 0.02;
        const takeProfitPercent = direction === 'Long' ? 0.04 : -0.04;

        const stopLoss = currentPrice * (1 + stopLossPercent);
        const takeProfit = currentPrice * (1 + takeProfitPercent);

        // Calculate position size (10-20% of remaining budget)
        const positionSizePercent = 0.1 + (Math.random() * 0.1);
        const positionSize = (remainingBudget * positionSizePercent) / currentPrice;

        // Calculate trade cost
        const tradeCost = positionSize * currentPrice;

        // Skip if not enough budget
        if (tradeCost > remainingBudget) continue;

        // Create the trade directly
        await this.createTrade(
          strategy,
          symbol,
          direction,
          currentPrice,
          positionSize,
          stopLoss,
          takeProfit
        );

        // Update remaining budget
        remainingBudget -= tradeCost;

        logService.log('info', `Created initial trade for ${symbol} in strategy ${strategy.id}`, {
          direction,
          positionSize,
          currentPrice,
          tradeCost,
          remainingBudget
        }, 'DemoTradeGenerator');
      }
    } catch (error) {
      logService.log('error', `Failed to generate initial trades for strategy ${strategy.id}`, error, 'DemoTradeGenerator');
    }
  }
}

export const demoTradeGenerator = DemoTradeGenerator.getInstance();
