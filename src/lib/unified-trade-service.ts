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
   */
  async createTrade(tradeOptions: any): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    const isDemoMode = demoService.isInDemoMode();
    const strategyId = tradeOptions.strategy_id || tradeOptions.strategyId;
    const symbol = tradeOptions.symbol;
    const side = tradeOptions.side;
    const amount = tradeOptions.amount || tradeOptions.quantity;
    const price = tradeOptions.price || tradeOptions.entry_price || tradeOptions.entryPrice;

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
      const budget = await tradeService.getBudget(strategyId);
      if (!budget || budget.available <= 0) {
        throw new Error(`No available budget for strategy ${strategyId}`);
      }

      // Calculate trade cost
      const tradeCost = amount * price;
      if (tradeCost > budget.available) {
        throw new Error(`Insufficient budget for trade: ${tradeCost} > ${budget.available}`);
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
          market_type: tradeOptions.marketType || 'spot',
          margin_type: tradeOptions.marginType,
          leverage: tradeOptions.leverage
        }
      };

      // Try primary method: Insert directly into database
      try {
        const { data, error } = await supabase
          .from('trades')
          .insert(tradeData)
          .select()
          .single();

        if (error) {
          throw error;
        }

        // Reserve budget for this trade
        await tradeService.reserveBudgetForTrade(strategyId, tradeCost, tradeId);

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
    // Emit general trade created event
    eventBus.emit('trade:created', { trade });

    // Emit strategy-specific event
    eventBus.emit(`trade:created:${trade.strategy_id}`, {
      strategyId: trade.strategy_id,
      trade
    });

    // Emit internal event
    this.emit('tradeCreated', { trade });
  }

  /**
   * Handle trade created event
   */
  private handleTradeCreated(event: any): void {
    const trade = event.trade;
    if (!trade) return;

    logService.log('debug', `Handling trade created event for ${trade.id}`, { trade }, 'UnifiedTradeService');

    // Update budget allocation
    const tradeCost = trade.quantity * trade.price;
    tradeService.reserveBudgetForTrade(trade.strategy_id, tradeCost, trade.id);

    // Update wallet balances
    walletBalanceService.updateBalances();
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

    // Update wallet balances
    walletBalanceService.updateBalances();
  }
}

export const unifiedTradeService = UnifiedTradeService.getInstance();
