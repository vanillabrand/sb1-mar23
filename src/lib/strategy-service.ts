import { supabase } from './supabase';
import { logService } from './log-service';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from './event-bus';
import { globalCacheService } from './global-cache-service';
import { newsService } from './news-service';
import { demoService } from './demo-service';
import { marketService } from './market-service';
import { exchangeService } from './exchange-service';
import { tradeService } from './trade-service';
import { tradeGenerator } from './trade-generator';
import { strategyMonitor } from './strategy-monitor';
import { tradeEngine } from './trade-engine';
import { transactionService } from './transaction-service';
import type { Strategy, CreateStrategyData, StrategyBudget } from './types';

class StrategyService {
  /**
   * Detects the market type from a strategy description
   * @param description The strategy description
   * @returns The detected market type ('spot', 'margin', or 'futures')
   */
  detectMarketType(description: string): 'spot' | 'margin' | 'futures' {
    if (!description) return 'spot'; // Default to spot if no description

    const lowerDesc = description.toLowerCase();

    // Check for futures market indicators
    if (
      lowerDesc.includes('futures') ||
      lowerDesc.includes('leverage') ||
      lowerDesc.includes('leveraged') ||
      lowerDesc.includes('perpetual') ||
      lowerDesc.includes('perp') ||
      lowerDesc.includes('contract') ||
      lowerDesc.includes('contracts') ||
      lowerDesc.includes('long position') ||
      lowerDesc.includes('short position') ||
      lowerDesc.includes('liquidation') ||
      lowerDesc.includes('funding rate') ||
      lowerDesc.includes('funding rates') ||
      lowerDesc.includes('10x') ||
      lowerDesc.includes('20x') ||
      lowerDesc.includes('50x') ||
      lowerDesc.includes('100x') ||
      lowerDesc.match(/\d+x\s+leverage/) // Pattern like "5x leverage"
    ) {
      return 'futures';
    }

    // Check for margin market indicators
    if (
      lowerDesc.includes('margin') ||
      lowerDesc.includes('borrow') ||
      lowerDesc.includes('loan') ||
      lowerDesc.includes('interest') ||
      lowerDesc.includes('collateral') ||
      lowerDesc.includes('lending') ||
      lowerDesc.includes('borrowed')
    ) {
      return 'margin';
    }

    // Default to spot market
    return 'spot';
  }

  async createStrategy(data: CreateStrategyData): Promise<Strategy> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user?.id) {
        throw new Error('No authenticated session found');
      }

      // Detect market type from description if not explicitly provided
      const marketType = data.marketType || this.detectMarketType(data.description || '');

      logService.log('info', `Detected market type: ${marketType} for strategy`, {
        title: data.title,
        description: data.description?.substring(0, 50) + '...',
      }, 'StrategyService');

      // Ensure we have a name field (required by the database schema)
      // Map title to name if name is not provided
      const strategy = {
        id: uuidv4(),
        ...data,
        name: data.name || data.title, // Map title to name if name is not provided
        type: data.type || 'custom',  // Add default type
        user_id: session.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: data.status || 'inactive',
        performance: 0,
        selected_pairs: data.selected_pairs || [],
        strategy_config: data.strategy_config || {},
        market_type: marketType
      };

      // Log the strategy data for debugging
      logService.log('debug', 'Creating strategy with data', {
        id: strategy.id,
        name: strategy.name,
        title: strategy.title,
        userId: session.user.id
      }, 'StrategyService');

      const { data: createdStrategy, error } = await supabase
        .from('strategies')
        .insert(strategy)
        .select()
        .single();

      if (error) {
        logService.log('error', 'Database error creating strategy', {
          error,
          userId: session.user.id,
          strategyData: strategy
        }, 'StrategyService');
        throw error;
      }

      if (!createdStrategy) {
        throw new Error('Failed to create strategy - no data returned');
      }

      // Refresh news cache in the background to include news for the new strategy's assets
      this.refreshNewsForStrategy(createdStrategy).catch(error => {
        logService.log('warn', 'Failed to refresh news for new strategy', error, 'StrategyService');
      });

      return createdStrategy;
    } catch (error) {
      logService.log('error', 'Failed to create strategy', error, 'StrategyService');
      throw error;
    }
  }

  async getStrategy(id: string): Promise<Strategy> {
    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        logService.log('error', 'Failed to get strategy', { error, id }, 'StrategyService');
        throw error;
      }

      if (!data) {
        throw new Error(`Strategy with ID ${id} not found`);
      }

      return data;
    } catch (error) {
      logService.log('error', 'Failed to get strategy', { error, id }, 'StrategyService');
      throw error;
    }
  }

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy> {
    try {
      // Ensure we're not updating protected fields
      const safeUpdates = { ...updates };
      delete safeUpdates.id;
      delete safeUpdates.user_id;
      delete safeUpdates.created_at;

      // Add updated timestamp
      safeUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('strategies')
        .update(safeUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logService.log('error', 'Failed to update strategy', { error, id, updates }, 'StrategyService');
        throw error;
      }

      if (!data) {
        throw new Error(`Strategy with ID ${id} not found or update failed`);
      }

      return data;
    } catch (error) {
      logService.log('error', 'Failed to update strategy', { error, id, updates }, 'StrategyService');
      throw error;
    }
  }

  async deleteStrategy(id: string): Promise<void> {
    try {
      console.log('StrategyService: Deleting strategy', id);

      // Get current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user?.id) {
        throw new Error('No authenticated user found');
      }

      const userId = session.user.id;

      // Emit event before database operation for immediate UI update
      eventBus.emit('strategy:deleted', { strategyId: id });

      // First, check if the strategy exists and belongs to the current user
      const { data: existingStrategy, error: checkError } = await supabase
        .from('strategies')
        .select('id, user_id')
        .eq('id', id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // Log the error but don't throw it - we'll still try to delete
        console.warn(`Error checking if strategy ${id} exists:`, checkError);
      }

      if (!existingStrategy) {
        // Strategy doesn't exist, but that's okay - we're trying to delete it anyway
        console.log(`Strategy ${id} doesn't exist in database, skipping deletion`);

        // Still emit the event to ensure UI is updated
        eventBus.emit('strategy:deleted', { strategyId: id });
        return;
      }

      // Verify ownership
      if (existingStrategy.user_id !== userId) {
        console.error(`Strategy ${id} does not belong to the current user`);
        throw new Error(`Strategy ${id} does not belong to the current user`);
      }

      // Delete trades first to avoid foreign key constraints
      try {
        console.log(`Deleting trades for strategy ${id}`);
        const { error: tradesError } = await supabase
          .from('trades')
          .delete()
          .eq('strategy_id', id);

        if (tradesError) {
          // Check if the error is because the trades table doesn't exist
          if (tradesError.message.includes('relation "trades" does not exist')) {
            console.log('Trades table does not exist, skipping trade deletion');
          } else {
            console.warn(`Error deleting trades for strategy ${id}:`, tradesError);
          }
        } else {
          console.log(`Successfully deleted trades for strategy ${id}`);
        }
      } catch (tradesError) {
        console.warn(`Exception deleting trades for strategy ${id}:`, tradesError);
      }

      // Delete from database
      const { error } = await supabase
        .from('strategies')
        .delete()
        .eq('id', id)
        .eq('user_id', userId); // Ensure we only delete if it belongs to the current user

      if (error) {
        // Log the error but don't throw it - the UI has already been updated
        console.error(`Database error deleting strategy ${id}:`, error);
        logService.log('error', 'Database error deleting strategy', { error, id }, 'StrategyService');

        // If it's a foreign key constraint error, it might be because of related trades
        if (error.code === '23503') { // Foreign key violation
          console.log('Foreign key constraint error - trying to remove related trades first');

          try {
            // Try to remove related trades
            const { error: tradeError } = await supabase
              .from('trades')
              .delete()
              .eq('strategy_id', id);

            if (tradeError) {
              console.error(`Error removing trades for strategy ${id}:`, tradeError);
            } else {
              // Try deleting the strategy again
              const { error: retryError } = await supabase
                .from('strategies')
                .delete()
                .eq('id', id)
                .eq('user_id', userId); // Ensure we only delete if it belongs to the current user

              if (retryError) {
                console.error(`Failed to delete strategy ${id} after removing trades:`, retryError);
              } else {
                console.log(`Successfully deleted strategy ${id} after removing trades`);
              }
            }
          } catch (tradeDeleteError) {
            console.error(`Error in trade deletion for strategy ${id}:`, tradeDeleteError);
          }
        }

        // Try a raw SQL delete as a last resort
        try {
          console.log(`Attempting raw SQL delete for strategy ${id}`);
          const { error: sqlError } = await supabase.rpc('execute_sql', {
            query: `
              DELETE FROM trades WHERE strategy_id = '${id}';
              DELETE FROM strategies WHERE id = '${id}' AND user_id = '${userId}';
            `
          });

          if (sqlError) {
            console.error(`Raw SQL delete failed: ${sqlError.message}`);
          } else {
            console.log(`Successfully deleted strategy ${id} via raw SQL`);
          }
        } catch (sqlExecError) {
          console.error(`SQL execution error: ${sqlExecError}`);
        }

        // Don't throw the error - we want the UI to update even if the database operation fails
      } else {
        logService.log('info', `Strategy ${id} deleted successfully`, null, 'StrategyService');
      }

      // Emit event again after deletion attempt to ensure all components are updated
      eventBus.emit('strategy:deleted', { strategyId: id });
    } catch (error) {
      console.error(`Unexpected error deleting strategy ${id}:`, error);
      logService.log('error', 'Unexpected error deleting strategy', { error, id }, 'StrategyService');

      // Don't throw the error - we want the UI to update even if there's an error
      // The strategy has already been removed from the UI at this point
    }
  }

  async activateStrategy(id: string): Promise<Strategy> {
    try {
      const { data, error } = await supabase
        .from('strategies')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logService.log('error', 'Failed to activate strategy', { error, id }, 'StrategyService');
        throw error;
      }

      if (!data) {
        throw new Error(`Strategy with ID ${id} not found or activation failed`);
      }

      logService.log('info', `Strategy ${id} activated successfully`, null, 'StrategyService');
      return data;
    } catch (error) {
      logService.log('error', 'Failed to activate strategy', { error, id }, 'StrategyService');
      throw error;
    }
  }

  async deactivateStrategy(id: string): Promise<Strategy> {
    try {
      logService.log('info', `Deactivating strategy ${id}`, null, 'StrategyService');

      // 1. Get all active trades for this strategy
      let activeTrades = [];
      try {
        const { data, error } = await supabase
          .from('trades')
          .select('*')
          .eq('strategy_id', id)
          .in('status', ['pending', 'executed', 'active']);

        if (error) {
          // Check if the error is because the table doesn't exist
          if (error.code === '42P01') { // PostgreSQL code for 'relation does not exist'
            logService.log('warn', 'Trades table does not exist yet. This is normal if you haven\'t created it.', null, 'StrategyService');
          } else {
            logService.log('error', 'Failed to fetch active trades for strategy', { error, id }, 'StrategyService');
          }
        } else {
          activeTrades = data || [];
        }
      } catch (err) {
        logService.log('error', 'Exception when fetching active trades', err, 'StrategyService');
      }

      // 2. Close all active trades on the exchange
      if (activeTrades && activeTrades.length > 0) {
        logService.log('info', `Closing ${activeTrades.length} active trades for strategy ${id}`, null, 'StrategyService');

        let totalProfitLoss = 0;

        for (const trade of activeTrades) {
          try {
            // Check if we're in demo mode
            const isDemo = demoService.isInDemoMode();

            // Close the trade on the exchange
            if (isDemo) {
              // Demo mode - use TestNet
              if (trade.status === 'pending' && trade.order_id) {
                try {
                  const testnetExchange = await demoService.getTestNetExchange();
                  await testnetExchange.cancelOrder(trade.symbol, trade.order_id);
                } catch (cancelError) {
                  logService.log('warn', `Failed to cancel pending order on TestNet: ${trade.order_id}`, cancelError, 'StrategyService');
                }
              }

              // Calculate profit/loss for executed trades
              if (trade.status === 'executed' || trade.status === 'active') {
                try {
                  // Get current price from market service
                  const currentPrice = await marketService.getCurrentPrice(trade.symbol);

                  // Calculate profit/loss
                  const entryPrice = trade.entry_price || 0;
                  const priceDiff = trade.side === 'buy' ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
                  const amount = trade.amount || 0;
                  const profitLoss = priceDiff * amount;

                  // Add to total profit/loss
                  totalProfitLoss += profitLoss;

                  // Update trade in database
                  await supabase
                    .from('trades')
                    .update({
                      status: 'closed',
                      exit_price: currentPrice,
                      profit: profitLoss,
                      close_reason: 'Strategy deactivated',
                      closed_at: new Date().toISOString()
                    })
                    .eq('id', trade.id);

                  logService.log('info', `Closed trade ${trade.id} with profit/loss ${profitLoss}`,
                    { symbol: trade.symbol, entryPrice, exitPrice: currentPrice }, 'StrategyService');
                } catch (closeError) {
                  logService.log('error', `Failed to close trade ${trade.id}`, closeError, 'StrategyService');
                }
              }
            } else {
              // Live mode - use real exchange
              if (trade.status === 'pending' && trade.order_id) {
                try {
                  await exchangeService.cancelOrder(trade.order_id, trade.symbol);
                } catch (cancelError) {
                  logService.log('warn', `Failed to cancel pending order on exchange: ${trade.order_id}`, cancelError, 'StrategyService');
                }
              }

              // Close executed trades
              if (trade.status === 'executed' || trade.status === 'active') {
                try {
                  // Get current price from exchange
                  const currentPrice = await exchangeService.getCurrentPrice(trade.symbol);

                  // Create market order to close position
                  const exitSide = trade.side === 'buy' ? 'sell' : 'buy';
                  await exchangeService.createOrder({
                    symbol: trade.symbol,
                    side: exitSide,
                    type: 'market',
                    amount: trade.amount,
                    entry_price: currentPrice
                  });

                  // Calculate profit/loss
                  const entryPrice = trade.entry_price || 0;
                  const priceDiff = trade.side === 'buy' ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
                  const amount = trade.amount || 0;
                  const profitLoss = priceDiff * amount;

                  // Add to total profit/loss
                  totalProfitLoss += profitLoss;

                  // Update trade in database
                  await supabase
                    .from('trades')
                    .update({
                      status: 'closed',
                      exit_price: currentPrice,
                      profit: profitLoss,
                      close_reason: 'Strategy deactivated',
                      closed_at: new Date().toISOString()
                    })
                    .eq('id', trade.id);

                  logService.log('info', `Closed trade ${trade.id} with profit/loss ${profitLoss}`,
                    { symbol: trade.symbol, entryPrice, exitPrice: currentPrice }, 'StrategyService');
                } catch (closeError) {
                  logService.log('error', `Failed to close trade ${trade.id}`, closeError, 'StrategyService');
                }
              }
            }

            // Mark any remaining trades as closed in the database
            if (trade.status !== 'closed') {
              await supabase
                .from('trades')
                .update({
                  status: 'closed',
                  close_reason: 'Strategy deactivated',
                  closed_at: new Date().toISOString()
                })
                .eq('id', trade.id);
            }
          } catch (tradeError) {
            logService.log('error', `Error processing trade ${trade.id} during strategy deactivation`, tradeError, 'StrategyService');
          }
        }

        // 3. Record the final P/L in portfolio performance
        try {
          // Get the strategy budget
          const budget = tradeService.getBudget(id);
          if (budget) {
            try {
              // Record the overall strategy deactivation transaction
              await transactionService.recordTransaction(
                'strategy_deactivation',
                totalProfitLoss,
                budget.total,
                `Strategy ${id} deactivated with final P/L: ${totalProfitLoss.toFixed(2)} USDT`,
                id,
                'strategy',
                {
                  strategy_id: id,
                  total_profit_loss: totalProfitLoss,
                  trades_closed: activeTrades.length
                }
              );
            } catch (txError) {
              logService.log('warn', 'Failed to record strategy deactivation transaction, continuing with deactivation', txError, 'StrategyService');
            }

            // Record individual trade closure transactions
            for (const trade of activeTrades) {
              if (trade.status === 'closed' && trade.profit !== undefined) {
                try {
                  await transactionService.recordTransaction(
                    'trade_closure',
                    trade.profit,
                    budget.total,
                    `Trade ${trade.id} closed due to strategy deactivation`,
                    trade.id,
                    'trade',
                    {
                      strategy_id: id,
                      trade_id: trade.id,
                      symbol: trade.symbol,
                      entry_price: trade.entry_price,
                      exit_price: trade.exit_price,
                      amount: trade.amount,
                      side: trade.side,
                      profit: trade.profit,
                      close_reason: 'Strategy deactivated'
                    }
                  );
                } catch (tradeTxError) {
                  logService.log('warn', `Failed to record trade closure transaction for trade ${trade.id}, continuing with deactivation`, tradeTxError, 'StrategyService');
                }
              }
            }

            // Record budget reset transaction
            try {
              await transactionService.recordTransaction(
                'budget_reset',
                -budget.total, // Negative amount to show budget removal
                0, // New balance is 0
                `Budget reset to 0 for strategy ${id} due to deactivation`,
                id,
                'budget',
                {
                  strategy_id: id,
                  previous_budget: budget.total,
                  new_budget: 0
                }
              );
            } catch (budgetTxError) {
              logService.log('warn', 'Failed to record budget reset transaction, continuing with deactivation', budgetTxError, 'StrategyService');
            }

            logService.log('info', `Recorded transactions for strategy ${id} deactivation`, {
              totalProfitLoss,
              tradesCount: activeTrades.length,
              budget: budget.total
            }, 'StrategyService');
          }
        } catch (txError) {
          logService.log('warn', 'Failed to record transactions for strategy deactivation', txError, 'StrategyService');
        }
      }

      // 4. Reset the budget to 0
      try {
        // Get current budget
        const currentBudget = tradeService.getBudget(id);
        if (currentBudget) {
          // Create a new budget with 0 values
          const zeroBudget = {
            total: 0,
            allocated: 0,
            available: 0,
            maxPositionSize: 0,
            lastUpdated: Date.now()
          };

          // Update the budget
          tradeService.setBudget(id, zeroBudget);

          // Update in database
          try {
            const { error } = await supabase
              .from('strategy_budgets')
              .update({
                total: 0,
                allocated: 0,
                available: 0,
                max_position_size: 0,
                last_updated: new Date().toISOString()
              })
              .eq('strategy_id', id);

            if (error) {
              // Check if the error is because the table doesn't exist
              if (error.code === '42P01') { // PostgreSQL code for 'relation does not exist'
                logService.log('warn', 'Strategy budgets table does not exist yet. This is normal if you haven\'t created it.', null, 'StrategyService');
              } else {
                logService.log('error', 'Failed to update strategy budget in database', error, 'StrategyService');
              }
            }
          } catch (dbError) {
            logService.log('warn', 'Exception when updating strategy budget', dbError, 'StrategyService');
          }

          logService.log('info', `Reset budget to 0 for strategy ${id}`, null, 'StrategyService');
        }
      } catch (budgetError) {
        logService.log('error', 'Failed to reset budget', budgetError, 'StrategyService');
      }

      // 5. Remove monitoring
      try {
        // Stop market monitoring
        await marketService.stopStrategyMonitoring(id);

        // Remove from trade generator
        tradeGenerator.removeStrategy(id);

        // Remove from strategy monitor
        strategyMonitor.removeStrategy(id);

        // Remove from trade engine
        await tradeEngine.removeStrategy(id);

        logService.log('info', `Removed monitoring for strategy ${id}`, null, 'StrategyService');
      } catch (monitorError) {
        logService.log('warn', 'Error removing monitoring, continuing with deactivation', monitorError, 'StrategyService');
      }

      // 6. Update strategy status in database
      const { data, error } = await supabase
        .from('strategies')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString(),
          deactivated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logService.log('error', 'Failed to deactivate strategy in database', { error, id }, 'StrategyService');
        throw error;
      }

      if (!data) {
        throw new Error(`Strategy with ID ${id} not found or deactivation failed`);
      }

      // 7. Emit events to notify all components
      // Core strategy events
      eventBus.emit('strategy:deactivated', {
        strategyId: id,
        totalProfitLoss: totalProfitLoss || 0,
        tradesCount: activeTrades?.length || 0,
        timestamp: Date.now()
      });

      eventBus.emit('strategy:status', {
        strategyId: id,
        status: 'inactive',
        previousStatus: 'active',
        timestamp: Date.now()
      });

      // Dashboard update events
      eventBus.emit('dashboard:refresh', {
        strategyId: id,
        action: 'deactivate',
        timestamp: Date.now()
      });

      // Portfolio update events
      eventBus.emit('portfolio:updated', {
        strategyId: id,
        action: 'deactivated',
        totalProfitLoss: totalProfitLoss || 0,
        tradesCount: activeTrades?.length || 0,
        timestamp: Date.now()
      });

      // Transaction events
      eventBus.emit('transaction:created', {
        type: 'strategy_deactivation',
        strategyId: id,
        amount: totalProfitLoss || 0,
        timestamp: Date.now()
      });

      // Trade events
      if (activeTrades && activeTrades.length > 0) {
        eventBus.emit('trades:closed', {
          strategyId: id,
          tradeIds: activeTrades.map(t => t.id),
          reason: 'strategy_deactivated',
          timestamp: Date.now()
        });
      }

      // Budget events
      eventBus.emit('budget:updated', {
        strategyId: id,
        previousBudget: tradeService.getBudget(id)?.total || 0,
        newBudget: 0,
        timestamp: Date.now()
      });

      // Global state update event
      eventBus.emit('app:state:updated', {
        component: 'strategy',
        action: 'deactivated',
        id: id,
        timestamp: Date.now()
      });

      logService.log('info', `Strategy ${id} deactivated successfully`, null, 'StrategyService');
      return data;
    } catch (error) {
      logService.log('error', 'Failed to deactivate strategy', { error, id }, 'StrategyService');
      throw error;
    }
  }

  async getAllStrategies(): Promise<Strategy[]> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user?.id) {
        throw new Error('No authenticated session found');
      }

      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        logService.log('error', 'Failed to get strategies', { error }, 'StrategyService');
        throw error;
      }

      return data || [];
    } catch (error) {
      logService.log('error', 'Failed to get strategies', { error }, 'StrategyService');
      return [];
    }
  }

  async getActiveStrategies(): Promise<Strategy[]> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user?.id) {
        throw new Error('No authenticated session found');
      }

      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        logService.log('error', 'Failed to get active strategies', { error }, 'StrategyService');
        throw error;
      }

      return data || [];
    } catch (error) {
      logService.log('error', 'Failed to get active strategies', { error }, 'StrategyService');
      return [];
    }
  }


  /**
   * Refresh news for a specific strategy
   * This is called when a new strategy is created to ensure we have relevant news
   */
  private async refreshNewsForStrategy(strategy: Strategy): Promise<void> {
    try {
      // Extract asset pairs from the strategy
      const assetPairs = this.extractAssetPairsFromStrategy(strategy);

      if (!assetPairs || assetPairs.length === 0) {
        logService.log('info', 'No asset pairs found in strategy, skipping news refresh', { strategyId: strategy.id }, 'StrategyService');
        return;
      }

      // Extract the base assets (e.g., 'BTC' from 'BTC/USDT')
      const assets = assetPairs.map(pair => {
        // Handle different pair formats (BTC/USDT, BTC_USDT, etc.)
        const parts = pair.split(/[\/\_]/);
        return parts[0]; // Return the first part (base asset)
      }).filter(Boolean); // Remove any empty strings

      if (assets.length === 0) {
        logService.log('info', 'No valid assets extracted from pairs, skipping news refresh', { strategyId: strategy.id, pairs: assetPairs }, 'StrategyService');
        return;
      }

      logService.log('info', 'Refreshing news for strategy assets', { strategyId: strategy.id, assets }, 'StrategyService');

      // Force a refresh of the news cache to include these assets
      await globalCacheService.forceRefreshNews();

      logService.log('info', 'Successfully refreshed news for strategy assets', { strategyId: strategy.id, assets }, 'StrategyService');
    } catch (error) {
      logService.log('error', 'Failed to refresh news for strategy', error, 'StrategyService');
      // Don't throw the error, just log it
    }
  }

  /**
   * Extract asset pairs from a strategy
   */
  private extractAssetPairsFromStrategy(strategy: Strategy): string[] {
    // Extract trading pairs from various possible locations
    if (strategy.selected_pairs && strategy.selected_pairs.length > 0) {
      return strategy.selected_pairs;
    }

    if (strategy.strategy_config && strategy.strategy_config.assets) {
      return strategy.strategy_config.assets;
    }

    if (strategy.strategy_config && strategy.strategy_config.config && strategy.strategy_config.config.pairs) {
      return strategy.strategy_config.config.pairs;
    }

    // Default to BTC/USDT if no pairs are found
    return ['BTC/USDT'];
  }
}

export const strategyService = new StrategyService();
