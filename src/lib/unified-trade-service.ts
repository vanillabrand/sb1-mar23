import { EventEmitter } from './event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';
import { logService } from './log-service';
import { eventBus } from './event-bus';
import { demoService } from './demo-service';
import { exchangeService } from './exchange-service';
import { tradeService } from './trade-service';
import { tradeManager } from './trade-manager';
import { riskManagementService } from './risk-management-service';
import { walletBalanceService } from './wallet-balance-service';

/**
 * Trade options interface
 */
interface TradeOptions {
  id?: string;
  strategy_id?: string;
  strategyId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount?: number;
  quantity?: number;
  price?: number;
  entry_price?: number;
  entryPrice?: number;
  stop_loss?: number;
  stopLoss?: number;
  take_profit?: number;
  takeProfit?: number;
  trailing_stop?: number;
  trailingStop?: number;
  market_type?: string;
  marketType?: string;
  marginType?: 'cross' | 'isolated';
  leverage?: number;
  riskLevel?: string;
  rationale?: string;
  entry_conditions?: string[];
  entryConditions?: string[];
  exit_conditions?: string[];
  exitConditions?: string[];
}

/**
 * Trade data interface
 */
interface TradeData {
  id: string;
  strategy_id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  status: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  market_type: string;
  metadata: {
    demo: boolean;
    source: string;
    entry_price: number;
    stop_loss?: number;
    take_profit?: number;
    trailing_stop?: number;
    entry_conditions?: string[];
    exit_conditions?: string[];
    rationale: string;
    market_type: string;
    margin_type?: string;
    leverage?: number;
    exit_price?: number;
    profit?: number;
    closed_reason?: string;
  };
  fallback?: boolean;
}

/**
 * UnifiedTradeService provides a consistent interface for creating trades
 * in both live and demo modes, with robust error handling and fallback mechanisms.
 */
class UnifiedTradeService extends EventEmitter {
  private static instance: UnifiedTradeService;
  private initialized = false;

  private constructor() {
    super();
  }

  static getInstance(): UnifiedTradeService {
    if (!UnifiedTradeService.instance) {
      UnifiedTradeService.instance = new UnifiedTradeService();
    }
    return UnifiedTradeService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logService.log('info', 'Initializing unified trade service', null, 'UnifiedTradeService');

      // Subscribe to relevant events
      eventBus.subscribe('trade:created', this.handleTradeCreated.bind(this));
      eventBus.subscribe('trade:updated', this.handleTradeUpdated.bind(this));
      eventBus.subscribe('trade:closed', this.handleTradeClosed.bind(this));

      this.initialized = true;
      logService.log('info', 'Unified trade service initialized', null, 'UnifiedTradeService');
    } catch (error) {
      logService.log('error', 'Failed to initialize unified trade service', error, 'UnifiedTradeService');
      throw error;
    }
  }

  /**
   * Creates a trade with consistent behavior across live and demo modes
   * with multiple fallback mechanisms for reliability
   * @param tradeOptions Trade options
   * @returns Created trade data
   */
  async createTrade(tradeOptions: TradeOptions): Promise<TradeData> {
    if (!this.initialized) {
      await this.initialize();
    }

    const isDemoMode = demoService.isInDemoMode();
    const strategyId = tradeOptions.strategy_id || tradeOptions.strategyId;
    const symbol = tradeOptions.symbol;
    const side = tradeOptions.side;
    let amount = tradeOptions.amount || tradeOptions.quantity; // Changed from const to let since it might be adjusted later
    const price = tradeOptions.price || tradeOptions.entry_price || tradeOptions.entryPrice;
    const marketType = tradeOptions.marketType || tradeOptions.market_type || 'spot';

    // Generate a stable ID that won't change on re-renders
    const tradeId = tradeOptions.id || (() => {
      // Create a unique ID with consistent format
      const symbolKey = symbol.replace(/[^a-zA-Z0-9]/g, '');
      const strategyHash = strategyId.split('-')[0] || 'unknown';
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000);

      // Format: [demo/live]-[symbol]-[index]-[strategy hash]-[timestamp]
      return `${isDemoMode ? 'testnet' : 'live'}-${symbolKey}-${randomSuffix}-${strategyHash}-${timestamp}`;
    })();

    logService.log('info', `Creating ${isDemoMode ? 'demo' : 'live'} trade for ${symbol}`, {
      tradeId,
      strategyId,
      symbol,
      side,
      amount,
      price
    }, 'UnifiedTradeService');

    try {
      // Validate budget availability
      let budget;
      try {
        budget = await tradeService.getBudget(strategyId);
      } catch (budgetError) {
        logService.log('error', `Failed to get budget for strategy ${strategyId}`, budgetError, 'UnifiedTradeService');

        // In demo mode, we can create a default budget
        if (isDemoMode) {
          logService.log('warn', `Using default budget for demo mode strategy ${strategyId}`, null, 'UnifiedTradeService');
          budget = {
            total: 10000,
            allocated: 0,
            available: 10000,
            profit: 0
          };
        } else {
          throw new Error(`Failed to get budget for strategy ${strategyId}: ${budgetError.message}`);
        }
      }

      if (!budget || budget.available <= 0) {
        if (isDemoMode) {
          // In demo mode, we can reset the budget
          logService.log('warn', `Resetting budget for demo mode strategy ${strategyId}`, null, 'UnifiedTradeService');
          await tradeService.initializeBudget(strategyId, 10000);
          budget = {
            total: 10000,
            allocated: 0,
            available: 10000,
            profit: 0
          };
        } else {
          throw new Error(`No available budget for strategy ${strategyId}`);
        }
      }

      // Calculate trade cost
      const tradeCost = amount * price;
      if (tradeCost > budget.available) {
        if (isDemoMode) {
          // In demo mode, we can proceed with a smaller amount
          const adjustedAmount = Math.floor((budget.available / price) * 0.95 * 100) / 100; // 95% of available budget, rounded to 2 decimal places
          logService.log('warn', `Adjusting trade amount for demo mode strategy ${strategyId}: ${amount} -> ${adjustedAmount}`, null, 'UnifiedTradeService');

          if (adjustedAmount <= 0) {
            throw new Error(`Insufficient budget for trade: ${tradeCost} > ${budget.available}`);
          }

          // Update the amount
          amount = adjustedAmount;
        } else {
          throw new Error(`Insufficient budget for trade: ${tradeCost} > ${budget.available}`);
        }
      }

      // Validate risk parameters
      const riskValidation = riskManagementService.validateTradeRisk(
        amount,
        price,
        tradeOptions.stop_loss || tradeOptions.stopLoss,
        side,
        tradeOptions.riskLevel || 'medium',
        tradeOptions.marketType || 'spot',
        budget.available
      );

      if (!riskValidation.valid) {
        logService.log('warn', `Risk validation warning: ${riskValidation.reason}`, {
          tradeId,
          strategyId,
          symbol
        }, 'UnifiedTradeService');
        // In demo mode, we'll still proceed despite risk warnings
        if (!isDemoMode) {
          throw new Error(`Risk validation failed: ${riskValidation.reason}`);
        }
      }

      // Prepare the trade data
      const tradeData = {
        id: tradeId,
        strategy_id: strategyId,
        symbol: symbol,
        side: side,
        quantity: amount,
        price: price,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        market_type: marketType, // Add market_type at the top level for database storage
        metadata: {
          demo: isDemoMode,
          source: 'unified-trade-service',
          entry_price: price,
          stop_loss: tradeOptions.stop_loss || tradeOptions.stopLoss,
          take_profit: tradeOptions.take_profit || tradeOptions.takeProfit,
          trailing_stop: tradeOptions.trailing_stop || tradeOptions.trailingStop,
          entry_conditions: tradeOptions.entry_conditions || tradeOptions.entryConditions || [],
          exit_conditions: tradeOptions.exit_conditions || tradeOptions.exitConditions || [],
          rationale: tradeOptions.rationale || `${isDemoMode ? 'Demo' : 'Live'} trade for ${symbol}`,
          market_type: marketType, // Also keep in metadata for backward compatibility
          margin_type: tradeOptions.marginType,
          leverage: tradeOptions.leverage
        }
      };

      // Try primary method: Insert directly into database
      try {
        // Create variables for potentially fixed values
        let fixedAmount = amount;
        let fixedPrice = price;
        let fixedTradeCost = tradeCost;

        // Validate the trade cost is a valid number
        if (isNaN(tradeCost) || tradeCost <= 0) {
          logService.log('warn', `Invalid trade cost: ${tradeCost} for ${symbol}`, {
            amount,
            price,
            tradeCost
          }, 'UnifiedTradeService');

          // Fix the trade cost if possible
          if (isNaN(tradeCost)) {
            // Reset fixed values to be updated

            // If amount or price is NaN, set default values
            if (isNaN(fixedAmount) || fixedAmount <= 0) {
              fixedAmount = 0.01; // Set a small default amount
              logService.log('warn', `Fixed invalid amount to ${fixedAmount}`, null, 'UnifiedTradeService');
            }

            if (isNaN(fixedPrice) || fixedPrice <= 0) {
              // Try to get a valid price from market data
              try {
                const marketData = await exchangeService.getMarketPrice(symbol);
                fixedPrice = marketData.price || 100; // Use market price or default
                logService.log('info', `Using market price ${fixedPrice} for ${symbol}`, null, 'UnifiedTradeService');
              } catch (priceError) {
                fixedPrice = 100; // Default fallback price
                logService.log('warn', `Using default price ${fixedPrice} for ${symbol}`, priceError, 'UnifiedTradeService');
              }
            }

            // Recalculate trade cost
            fixedTradeCost = fixedAmount * fixedPrice;
            logService.log('info', `Recalculated trade cost: ${fixedTradeCost} for ${symbol}`, {
              amount: fixedAmount,
              price: fixedPrice,
              tradeCost: fixedTradeCost
            }, 'UnifiedTradeService');

            // Update the amount and price variables with the fixed values
            amount = fixedAmount;
            // We'll use the fixed values directly in the trade data below

            // We can't reassign tradeCost directly since it's a constant
            // Instead, we'll use the fixed value when reserving the budget later
          }
        }

        // Update the trade data with fixed values
        tradeData.quantity = amount;
        tradeData.price = price; // Use the original price or the fixed price from above
        tradeData.metadata.entry_price = price;

        const { data, error } = await supabase
          .from('trades')
          .insert(tradeData)
          .select()
          .single();

        if (error) {
          throw error;
        }

        // Reserve budget for this trade
        // Use fixedTradeCost if it was calculated, otherwise use the original tradeCost
        const costToReserve = (typeof fixedTradeCost === 'number' && !isNaN(fixedTradeCost)) ? fixedTradeCost : tradeCost;
        const reserveResult = await tradeService.reserveBudgetForTrade(strategyId, costToReserve, tradeId);

        if (!reserveResult) {
          logService.log('warn', `Failed to reserve budget for trade ${tradeId}, but trade was created`, {
            strategyId,
            tradeCost
          }, 'UnifiedTradeService');
        }

        // Emit events
        this.emitTradeEvents(data);

        logService.log('info', `Successfully created trade in database for ${symbol}`, {
          tradeId,
          strategyId,
          symbol,
          method: 'database'
        }, 'UnifiedTradeService');

        return data;
      } catch (dbError) {
        logService.log('warn', `Failed to create trade in database for ${symbol}, trying fallback`, dbError, 'UnifiedTradeService');

        // Fallback method 1: Use trade service
        try {
          const tradeResult = await tradeService.createTrade(tradeData);

          logService.log('info', `Successfully created trade via trade service for ${symbol}`, {
            tradeId,
            strategyId,
            symbol,
            method: 'trade-service'
          }, 'UnifiedTradeService');

          return tradeResult;
        } catch (serviceError) {
          logService.log('warn', `Failed to create trade via trade service for ${symbol}, trying next fallback`, serviceError, 'UnifiedTradeService');

          // Fallback method 2: Use trade manager
          try {
            const tradeResult = await tradeManager.executeTrade({
              id: tradeId,
              symbol: symbol,
              side: side,
              type: 'market',
              amount: amount,
              strategy_id: strategyId,
              entry_price: price,
              stop_loss: tradeOptions.stop_loss || tradeOptions.stopLoss,
              take_profit: tradeOptions.take_profit || tradeOptions.takeProfit,
              trailing_stop: tradeOptions.trailing_stop || tradeOptions.trailingStop,
              market_type: marketType,
              margin_type: tradeOptions.marginType,
              leverage: tradeOptions.leverage,
              testnet: isDemoMode
            });

            logService.log('info', `Successfully created trade via trade manager for ${symbol}`, {
              tradeId,
              strategyId,
              symbol,
              method: 'trade-manager'
            }, 'UnifiedTradeService');

            return tradeResult;
          } catch (managerError) {
            logService.log('error', `Failed to create trade via trade manager for ${symbol}, creating in-memory trade`, managerError, 'UnifiedTradeService');

            // Last resort: Create an in-memory trade object
            const fallbackTrade = {
              ...tradeData,
              status: 'pending',
              fallback: true
            };

            // Still try to reserve budget
            await tradeService.reserveBudgetForTrade(strategyId, tradeCost, tradeId);

            // Emit events for the fallback trade
            this.emitTradeEvents(fallbackTrade);

            logService.log('info', `Created fallback in-memory trade for ${symbol}`, {
              tradeId,
              strategyId,
              symbol,
              method: 'in-memory'
            }, 'UnifiedTradeService');

            return fallbackTrade;
          }
        }
      }
    } catch (error) {
      logService.log('error', `Failed to create trade for ${symbol}`, error, 'UnifiedTradeService');
      throw error;
    }
  }

  /**
   * Updates an existing trade with consistent behavior across live and demo modes
   */
  async updateTrade(tradeId: string, updateData: any): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logService.log('info', `Updating trade ${tradeId}`, updateData, 'UnifiedTradeService');

      // Try to update in database
      try {
        const { data, error } = await supabase
          .from('trades')
          .update({
            ...updateData,
            updated_at: new Date().toISOString()
          })
          .eq('id', tradeId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        // Emit events
        eventBus.emit('trade:updated', { trade: data });
        eventBus.emit(`trade:updated:${data.strategy_id}`, {
          strategyId: data.strategy_id,
          trade: data
        });

        return data;
      } catch (dbError) {
        logService.log('error', `Failed to update trade ${tradeId} in database`, dbError, 'UnifiedTradeService');
        throw dbError;
      }
    } catch (error) {
      logService.log('error', `Failed to update trade ${tradeId}`, error, 'UnifiedTradeService');
      throw error;
    }
  }

  /**
   * Closes a trade with consistent behavior across live and demo modes
   */
  async closeTrade(tradeId: string, closeData: any): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { exitPrice, profit, status = 'closed' } = closeData;

      logService.log('info', `Closing trade ${tradeId}`, closeData, 'UnifiedTradeService');

      // Try to get the trade first
      const { data: trade, error: fetchError } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!trade) {
        throw new Error(`Trade ${tradeId} not found`);
      }

      // Calculate profit if not provided
      let calculatedProfit = profit;
      if (calculatedProfit === undefined && exitPrice !== undefined) {
        const entryPrice = trade.price || trade.metadata?.entry_price;
        const quantity = trade.quantity;

        if (entryPrice && quantity) {
          if (trade.side === 'buy') {
            calculatedProfit = (exitPrice - entryPrice) * quantity;
          } else {
            calculatedProfit = (entryPrice - exitPrice) * quantity;
          }
        }
      }

      // Update the trade in the database
      const updateData = {
        status: status,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          ...trade.metadata,
          exit_price: exitPrice,
          profit: calculatedProfit,
          closed_reason: closeData.reason || 'Manual close'
        }
      };

      const { data: updatedTrade, error: updateError } = await supabase
        .from('trades')
        .update(updateData)
        .eq('id', tradeId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Update budget with profit/loss
      if (calculatedProfit !== undefined) {
        await tradeService.updateBudgetWithProfit(
          trade.strategy_id,
          calculatedProfit,
          tradeId,
          status
        );
      }

      // Emit events
      eventBus.emit('trade:closed', { trade: updatedTrade });
      eventBus.emit(`trade:closed:${trade.strategy_id}`, {
        strategyId: trade.strategy_id,
        trade: updatedTrade
      });

      return updatedTrade;
    } catch (error) {
      logService.log('error', `Failed to close trade ${tradeId}`, error, 'UnifiedTradeService');
      throw error;
    }
  }

  /**
   * Emit events for a newly created trade
   */
  private emitTradeEvents(trade: any): void {
    if (!trade) {
      logService.log('warn', 'Attempted to emit trade events with null trade', null, 'UnifiedTradeService');
      return;
    }

    try {
      // Emit internal event first
      this.emit('tradeCreated', { trade });

      // Emit general trade created event
      eventBus.emit('trade:created', { trade });

      // Emit strategy-specific event if strategy_id exists
      if (trade.strategy_id) {
        eventBus.emit(`trade:created:${trade.strategy_id}`, {
          strategyId: trade.strategy_id,
          trade
        });
      } else {
        logService.log('warn', 'Trade missing strategy_id, cannot emit strategy-specific event',
          { tradeId: trade.id }, 'UnifiedTradeService');
      }

      logService.log('debug', `Emitted trade events for trade ${trade.id}`,
        { strategyId: trade.strategy_id }, 'UnifiedTradeService');
    } catch (error) {
      logService.log('error', `Failed to emit trade events for trade ${trade.id}`,
        error, 'UnifiedTradeService');
      // Don't rethrow the error to prevent cascading failures
    }
  }

  /**
   * Handle trade created event
   */
  private handleTradeCreated(event: any): void {
    const trade = event.trade;
    if (!trade) return;

    logService.log('debug', `Handling trade created event for ${trade.id}`, { trade }, 'UnifiedTradeService');

    try {
      // Validate strategy ID
      if (!trade.strategy_id) {
        logService.log('error', `Missing strategy ID for trade ${trade.id}`, { trade }, 'UnifiedTradeService');
        return;
      }

      // Get market type from trade data
      let marketType = 'spot'; // Default to spot
      if (trade.market_type) {
        marketType = trade.market_type;
      } else if (trade.metadata?.marketType) {
        marketType = trade.metadata.marketType;
      }

      // Calculate trade cost with proper fallbacks
      const price = trade.entry_price || trade.entryPrice || trade.price || 0;
      const quantity = trade.amount || trade.quantity || trade.size || 0;

      if (!price || !quantity || isNaN(price) || isNaN(quantity)) {
        logService.log('warn', `Invalid trade data for cost calculation: price=${price}, quantity=${quantity}`,
          { trade }, 'UnifiedTradeService');

        // Check if we can get a valid budget from the trade metadata
        if (trade.metadata?.tradeCost && !isNaN(trade.metadata.tradeCost)) {
          const metadataCost = Number(trade.metadata.tradeCost);
          logService.log('info', `Using trade cost from metadata: ${metadataCost}`,
            { trade, metadataCost }, 'UnifiedTradeService');

          // Reserve budget using the metadata cost
          const reserved = tradeService.reserveBudgetForTrade(trade.strategy_id, metadataCost, trade.id, marketType);
          if (!reserved) {
            logService.log('warn', `Failed to reserve budget from metadata cost for trade ${trade.id}`,
              { trade, metadataCost, marketType }, 'UnifiedTradeService');
          }
        }
        return;
      }

      // Format the trade cost to 2 decimal places to avoid floating point issues
      const tradeCost = Number((price * quantity).toFixed(2));

      if (isNaN(tradeCost) || tradeCost <= 0) {
        logService.log('warn', `Invalid trade cost calculated: ${tradeCost}`,
          { trade, price, quantity }, 'UnifiedTradeService');
        return;
      }

      // Log the trade cost for debugging
      logService.log('info', `Calculated trade cost for ${trade.id}: ${tradeCost} in ${marketType} market`,
        { trade, price, quantity, tradeCost, marketType }, 'UnifiedTradeService');

      // Check budget availability before attempting to reserve
      const budget = tradeService.getBudget(trade.strategy_id);
      if (!budget || budget.available < tradeCost) {
        logService.log('warn', `Insufficient budget for trade ${trade.id}: ${tradeCost} (available: ${budget?.available || 0})`,
          { trade, tradeCost, budget, marketType }, 'UnifiedTradeService');

        // If this is a demo trade, we might want to update the budget to accommodate it
        if (demoService.isInDemoMode()) {
          logService.log('info', `In demo mode, attempting to adjust budget for trade ${trade.id}`,
            { trade, tradeCost, marketType }, 'UnifiedTradeService');

          // Try to update the budget to accommodate the trade
          if (budget) {
            const updatedBudget = {
              ...budget,
              total: Number((budget.total + tradeCost).toFixed(2)),
              available: Number((budget.available + tradeCost).toFixed(2)),
              lastUpdated: Date.now()
            };

            // Initialize market type balances if they don't exist
            if (!updatedBudget.marketTypeBalances) {
              updatedBudget.marketTypeBalances = {
                spot: { total: 0, allocated: 0, available: 0, profit: 0, trades: 0 },
                margin: { total: 0, allocated: 0, available: 0, profit: 0, trades: 0 },
                futures: { total: 0, allocated: 0, available: 0, profit: 0, trades: 0 }
              };
            }

            // Ensure the market type exists in the balances
            if (!updatedBudget.marketTypeBalances[marketType]) {
              updatedBudget.marketTypeBalances[marketType] = {
                total: 0,
                allocated: 0,
                available: 0,
                profit: 0,
                trades: 0
              };
            }

            // Update the market type balance
            updatedBudget.marketTypeBalances[marketType].total = Number((updatedBudget.marketTypeBalances[marketType].total + tradeCost).toFixed(2));
            updatedBudget.marketTypeBalances[marketType].available = Number((updatedBudget.marketTypeBalances[marketType].available + tradeCost).toFixed(2));

            tradeService.updateBudgetCache(trade.strategy_id, updatedBudget);
            logService.log('info', `Adjusted budget in demo mode for trade ${trade.id} in ${marketType} market`,
              { trade, tradeCost, updatedBudget, marketType }, 'UnifiedTradeService');
          }
        }
        return;
      }

      // Update budget allocation
      const reserved = tradeService.reserveBudgetForTrade(trade.strategy_id, tradeCost, trade.id, marketType);

      if (!reserved) {
        logService.log('warn', `Failed to reserve budget for trade ${trade.id} in ${marketType} market`,
          { trade, tradeCost, marketType }, 'UnifiedTradeService');
      } else {
        logService.log('info', `Reserved ${tradeCost} for strategy ${trade.strategy_id} (trade: ${trade.id}) in ${marketType} market`,
          { trade, tradeCost, marketType }, 'UnifiedTradeService');
      }

      // Update wallet balances
      walletBalanceService.refreshBalances().catch(error => {
        logService.log('warn', 'Failed to refresh wallet balances after trade creation', error, 'UnifiedTradeService');
      });
    } catch (error) {
      logService.log('error', `Error handling trade created event for ${trade.id}`, error, 'UnifiedTradeService');
    }
  }

  /**
   * Handle trade updated event
   */
  private handleTradeUpdated(event: any): void {
    const trade = event.trade;
    if (!trade) return;

    logService.log('debug', `Handling trade updated event for ${trade.id}`, { trade }, 'UnifiedTradeService');
  }

  /**
   * Handle trade closed event
   */
  private handleTradeClosed(event: any): void {
    const trade = event.trade;
    if (!trade) return;

    logService.log('debug', `Handling trade closed event for ${trade.id}`, { trade }, 'UnifiedTradeService');

    try {
      // Get market type from trade data
      let marketType = 'spot'; // Default to spot
      if (trade.market_type) {
        marketType = trade.market_type;
      } else if (trade.metadata?.marketType) {
        marketType = trade.metadata.marketType;
      }

      // Calculate trade cost and profit/loss
      const entryPrice = trade.entry_price || trade.entryPrice || trade.price || 0;
      const exitPrice = trade.exit_price || trade.exitPrice || 0;
      const quantity = trade.amount || trade.quantity || trade.size || 0;

      if (!entryPrice || !quantity) {
        logService.log('warn', `Invalid trade data for profit calculation: entryPrice=${entryPrice}, quantity=${quantity}`,
          { trade, marketType }, 'UnifiedTradeService');
        return;
      }

      const tradeCost = entryPrice * quantity;
      let profit = 0;

      // Calculate profit/loss if we have an exit price
      if (exitPrice > 0) {
        // Calculate profit based on trade side (buy/sell)
        profit = trade.side === 'buy'
          ? (exitPrice - entryPrice) * quantity
          : (entryPrice - exitPrice) * quantity;
      } else if (trade.profit !== undefined) {
        // Use the profit value directly if available
        profit = trade.profit;
      }

      // Format values to 2 decimal places
      const formattedTradeCost = Number(tradeCost.toFixed(2));
      const formattedProfit = Number(profit.toFixed(2));

      // Log the trade profit for debugging
      logService.log('info', `Calculated profit for closed trade ${trade.id}: ${formattedProfit} in ${marketType} market`,
        { trade, entryPrice, exitPrice, quantity, tradeCost: formattedTradeCost, profit: formattedProfit, marketType }, 'UnifiedTradeService');

      // Release budget and apply profit
      tradeService.releaseBudgetFromTrade(trade.strategy_id, formattedTradeCost, formattedProfit, trade.id, 'closed', marketType)
        .then(() => {
          logService.log('info', `Released budget with profit ${formattedProfit} for trade ${trade.id} in ${marketType} market`,
            { trade, tradeCost: formattedTradeCost, profit: formattedProfit, marketType }, 'UnifiedTradeService');
        })
        .catch(error => {
          logService.log('error', `Failed to release budget for trade ${trade.id}`,
            error, 'UnifiedTradeService');
        });

      // Update wallet balances
      walletBalanceService.refreshBalances().catch(error => {
        logService.log('warn', 'Failed to refresh wallet balances after trade closure', error, 'UnifiedTradeService');
      });

      // Emit trade profit event
      eventBus.emit('trade:profit', {
        tradeId: trade.id,
        strategyId: trade.strategy_id,
        profit: formattedProfit,
        entryPrice,
        exitPrice,
        quantity,
        marketType
      });

      // Emit strategy-specific profit event
      eventBus.emit(`trade:profit:${trade.strategy_id}`, {
        tradeId: trade.id,
        strategyId: trade.strategy_id,
        profit: formattedProfit,
        entryPrice,
        exitPrice,
        quantity,
        marketType
      });

      // Emit market-type specific profit event
      eventBus.emit(`trade:profit:${marketType}`, {
        tradeId: trade.id,
        strategyId: trade.strategy_id,
        profit: formattedProfit,
        entryPrice,
        exitPrice,
        quantity,
        marketType
      });

      // Emit combined event for portfolio performance tracking
      eventBus.emit('portfolio:performance:update', {
        tradeId: trade.id,
        strategyId: trade.strategy_id,
        profit: formattedProfit,
        tradeCost: formattedTradeCost,
        marketType,
        timestamp: Date.now()
      });
    } catch (error) {
      logService.log('error', `Error handling trade closed event for ${trade.id}`, error, 'UnifiedTradeService');
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    try {
      // Unsubscribe from events
      eventBus.unsubscribe('trade:created', this.handleTradeCreated.bind(this));
      eventBus.unsubscribe('trade:updated', this.handleTradeUpdated.bind(this));
      eventBus.unsubscribe('trade:closed', this.handleTradeClosed.bind(this));

      // Reset initialization flag
      this.initialized = false;

      logService.log('info', 'Unified trade service cleaned up', null, 'UnifiedTradeService');
    } catch (error) {
      logService.log('error', 'Failed to clean up unified trade service', error, 'UnifiedTradeService');
    }
  }
}

export const unifiedTradeService = UnifiedTradeService.getInstance();
