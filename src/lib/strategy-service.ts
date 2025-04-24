import { supabase } from './supabase';
import { logService } from './log-service';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from './event-bus';
import { globalCacheService } from './global-cache-service';
// Import the StrategyManager class directly since it's not exported as a singleton
import { StrategyManager } from './strategy-manager';
import { riskManagementService } from './risk-management-service';
import { detectMarketType, normalizeMarketType } from './market-type-detection';
import type { Strategy, CreateStrategyData, StrategyBudget, MarketType } from './types';

class StrategyService {
  /**
   * Detects the market type from a strategy description
   * @param description The strategy description
   * @returns The detected market type ('spot', 'margin', or 'futures')
   * @deprecated Use the detectMarketType function from market-type-detection.ts instead
   */
  detectMarketTypeFromDescription(description: string): MarketType {
    return detectMarketType(description);
  }

  async createStrategy(data: CreateStrategyData): Promise<Strategy> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user?.id) {
        throw new Error('No authenticated session found');
      }

      // Detect market type from description if not explicitly provided
      let marketType: MarketType;

      if (data.marketType) {
        // If marketType is provided, normalize it to ensure it's valid
        marketType = normalizeMarketType(data.marketType);
      } else if (data.market_type) {
        // Support for market_type field (database field name)
        marketType = normalizeMarketType(data.market_type);
      } else {
        // Detect from description
        marketType = detectMarketType(data.description || '');
      }

      logService.log('info', `Detected market type: ${marketType} for strategy`, {
        title: data.title,
        description: data.description?.substring(0, 50) + '...',
      }, 'StrategyService');

      // Validate margin and leverage settings if applicable
      if (marketType === 'margin' || marketType === 'futures') {
        // Get the first selected pair for validation
        const symbol = data.selected_pairs && data.selected_pairs.length > 0 ?
          data.selected_pairs[0] : 'BTC/USDT';

        // Get leverage and margin settings from strategy config
        const leverage = marketType === 'futures' && data.strategy_config?.leverage ?
          data.strategy_config.leverage : undefined;

        const marginRatio = marketType === 'margin' && data.strategy_config?.marginRatio ?
          data.strategy_config.marginRatio : undefined;

        // Validate against exchange limits and risk level
        const marginLeverageValidation = await riskManagementService.validateMarginAndLeverage(
          symbol,
          marketType,
          data.riskLevel || 'Medium',
          leverage,
          marginRatio
        );

        if (!marginLeverageValidation.valid) {
          throw new Error(marginLeverageValidation.reason || 'Invalid margin or leverage settings');
        }

        // If we have a recommended value, use it
        if (marginLeverageValidation.recommendedValue !== undefined) {
          if (marketType === 'futures' && leverage !== undefined) {
            // Update leverage to recommended value
            if (!data.strategy_config) data.strategy_config = {};
            data.strategy_config.leverage = marginLeverageValidation.recommendedValue;

            logService.log('info', `Adjusted leverage to ${marginLeverageValidation.recommendedValue}x based on exchange limits and risk level`,
              null, 'StrategyService');
          } else if (marketType === 'margin' && marginRatio !== undefined) {
            // Update margin ratio to recommended value
            if (!data.strategy_config) data.strategy_config = {};
            data.strategy_config.marginRatio = marginLeverageValidation.recommendedValue;

            logService.log('info', `Adjusted margin ratio to ${(marginLeverageValidation.recommendedValue * 100).toFixed(0)}% based on exchange limits and risk level`,
              null, 'StrategyService');
          }
        }
      }

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
      // Get the current strategy to check market type and risk level
      const currentStrategy = await this.getStrategy(id);

      // Determine the market type (use updated value if provided, otherwise use current)
      let marketType: MarketType;

      if (updates.marketType) {
        // If marketType is provided in updates, normalize it
        marketType = normalizeMarketType(updates.marketType);
      } else if (updates.market_type) {
        // Support for market_type field (database field name)
        marketType = normalizeMarketType(updates.market_type);
      } else {
        // Use current strategy's market type or default to spot
        marketType = currentStrategy.market_type || 'spot';
      }

      // Determine the risk level (use updated value if provided, otherwise use current)
      const riskLevel = updates.riskLevel || currentStrategy.riskLevel || 'Medium';

      // Validate margin and leverage settings if applicable
      if (marketType === 'margin' || marketType === 'futures') {
        // Get the first selected pair for validation
        const symbol = updates.selected_pairs && updates.selected_pairs.length > 0 ?
          updates.selected_pairs[0] :
          (currentStrategy.selected_pairs && currentStrategy.selected_pairs.length > 0 ?
            currentStrategy.selected_pairs[0] : 'BTC/USDT');

        // Get leverage and margin settings from strategy config
        const updatedConfig = updates.strategy_config || {};
        const currentConfig = currentStrategy.strategy_config || {};

        const leverage = marketType === 'futures' ?
          (updatedConfig.leverage !== undefined ? updatedConfig.leverage : currentConfig.leverage) :
          undefined;

        const marginRatio = marketType === 'margin' ?
          (updatedConfig.marginRatio !== undefined ? updatedConfig.marginRatio : currentConfig.marginRatio) :
          undefined;

        // Validate against exchange limits and risk level
        const marginLeverageValidation = await riskManagementService.validateMarginAndLeverage(
          symbol,
          marketType,
          riskLevel,
          leverage,
          marginRatio
        );

        if (!marginLeverageValidation.valid) {
          throw new Error(marginLeverageValidation.reason || 'Invalid margin or leverage settings');
        }

        // If we have a recommended value, use it
        if (marginLeverageValidation.recommendedValue !== undefined) {
          if (marketType === 'futures' && leverage !== undefined) {
            // Update leverage to recommended value
            if (!updates.strategy_config) updates.strategy_config = {...currentConfig};
            updates.strategy_config.leverage = marginLeverageValidation.recommendedValue;

            logService.log('info', `Adjusted leverage to ${marginLeverageValidation.recommendedValue}x based on exchange limits and risk level`,
              null, 'StrategyService');
          } else if (marketType === 'margin' && marginRatio !== undefined) {
            // Update margin ratio to recommended value
            if (!updates.strategy_config) updates.strategy_config = {...currentConfig};
            updates.strategy_config.marginRatio = marginLeverageValidation.recommendedValue;

            logService.log('info', `Adjusted margin ratio to ${(marginLeverageValidation.recommendedValue * 100).toFixed(0)}% based on exchange limits and risk level`,
              null, 'StrategyService');
          }
        }
      }

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
      // First, get the current strategy to check if it has trading pairs
      const { data: currentStrategy, error: getError } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', id)
        .single();

      if (getError) {
        logService.log('error', 'Failed to get strategy for activation', { error: getError, id }, 'StrategyService');
        throw getError;
      }

      if (!currentStrategy) {
        throw new Error(`Strategy with ID ${id} not found`);
      }

      // Check if the strategy has trading pairs
      let tradingPairs = [];
      let updateNeeded = false;

      if (currentStrategy.selected_pairs && currentStrategy.selected_pairs.length > 0) {
        tradingPairs = currentStrategy.selected_pairs;
        logService.log('info', `Strategy ${id} has selected_pairs`, { pairs: tradingPairs }, 'StrategyService');
      } else if (currentStrategy.strategy_config?.assets && currentStrategy.strategy_config.assets.length > 0) {
        tradingPairs = currentStrategy.strategy_config.assets;
        logService.log('info', `Strategy ${id} has strategy_config.assets`, { pairs: tradingPairs }, 'StrategyService');

        // Update selected_pairs for consistency
        currentStrategy.selected_pairs = tradingPairs;
        updateNeeded = true;
      } else if (currentStrategy.strategy_config?.config?.pairs && currentStrategy.strategy_config.config.pairs.length > 0) {
        tradingPairs = currentStrategy.strategy_config.config.pairs;
        logService.log('info', `Strategy ${id} has strategy_config.config.pairs`, { pairs: tradingPairs }, 'StrategyService');

        // Update selected_pairs for consistency
        currentStrategy.selected_pairs = tradingPairs;
        updateNeeded = true;
      } else {
        // No trading pairs found, add default
        tradingPairs = ['BTC/USDT'];
        logService.log('warn', `Strategy ${id} has no trading pairs, adding default BTC/USDT`, null, 'StrategyService');

        // Update strategy with default trading pair
        currentStrategy.selected_pairs = tradingPairs;
        if (!currentStrategy.strategy_config) currentStrategy.strategy_config = {};
        currentStrategy.strategy_config.assets = tradingPairs;
        if (!currentStrategy.strategy_config.config) currentStrategy.strategy_config.config = {};
        currentStrategy.strategy_config.config.pairs = tradingPairs;
        updateNeeded = true;
      }

      // Update the strategy with active status and trading pairs if needed
      const updateData = {
        status: 'active',
        updated_at: new Date().toISOString(),
        deactivated_at: null // Clear deactivated_at when activating
      };

      if (updateNeeded) {
        updateData['selected_pairs'] = currentStrategy.selected_pairs;
        updateData['strategy_config'] = currentStrategy.strategy_config;
      }

      const { data, error } = await supabase
        .from('strategies')
        .update(updateData)
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

      logService.log('info', `Strategy ${id} activated successfully with trading pairs: ${tradingPairs.join(', ')}`, null, 'StrategyService');

      // Emit event to notify other components
      eventBus.emit('strategy:activated', {
        strategyId: id,
        strategy: data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      logService.log('error', 'Failed to activate strategy', { error, id }, 'StrategyService');
      throw error;
    }
  }

  async deactivateStrategy(id: string): Promise<Strategy> {
    try {
      // Try multiple approaches to update the database
      try {
        // First try the standard update method
        const { data: strategyData, error: strategyError } = await supabase
          .from('strategies')
          .update({
            status: 'inactive',
            updated_at: new Date().toISOString(),
            deactivated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select('*')
          .single();

        if (strategyError) {
          throw strategyError;
        }

        // Emit an event to notify other components
        eventBus.emit('strategy:deactivated', {
          strategyId: id,
          timestamp: Date.now()
        });

        return strategyData;
      } catch (updateError) {
        // If standard update fails, try raw SQL
        logService.log('warn', 'Standard update failed, trying raw SQL', updateError, 'StrategyService');

        try {
          // Try raw SQL update
          const { error: sqlError } = await supabase.rpc('execute_sql', {
            query: `
              UPDATE strategies
              SET status = 'inactive',
                  updated_at = NOW(),
                  deactivated_at = NOW()
              WHERE id = '${id}';
            `
          });

          if (sqlError) {
            throw sqlError;
          }

          // Get the updated strategy data
          const { data: updatedData, error: fetchError } = await supabase
            .from('strategies')
            .select('*')
            .eq('id', id)
            .single();

          if (fetchError) {
            throw fetchError;
          }

          // Emit an event to notify other components
          eventBus.emit('strategy:deactivated', {
            strategyId: id,
            timestamp: Date.now()
          });

          return updatedData;
        } catch (sqlError) {
          // If raw SQL fails, try RPC call as last resort
          logService.log('warn', 'Raw SQL failed, trying RPC call', sqlError, 'StrategyService');

          try {
            // Create the RPC function if it doesn't exist
            await supabase.rpc('execute_sql', {
              query: `
                CREATE OR REPLACE FUNCTION update_strategy_status(strategy_id UUID, new_status TEXT)
                RETURNS VOID AS $$
                BEGIN
                  UPDATE strategies
                  SET
                    status = new_status,
                    updated_at = NOW(),
                    deactivated_at = CASE WHEN new_status = 'inactive' THEN NOW() ELSE deactivated_at END
                  WHERE id = strategy_id;
                END;
                $$ LANGUAGE plpgsql SECURITY DEFINER;
              `
            });

            // Now call the RPC function
            const { error: rpcError } = await supabase.rpc('update_strategy_status', {
              strategy_id: id,
              new_status: 'inactive'
            });

            if (rpcError) {
              throw rpcError;
            }

            // Get the updated strategy data
            const { data: updatedData, error: fetchError } = await supabase
              .from('strategies')
              .select('*')
              .eq('id', id)
              .single();

            if (fetchError) {
              throw fetchError;
            }

            // Emit an event to notify other components
            eventBus.emit('strategy:deactivated', {
              strategyId: id,
              timestamp: Date.now()
            });

            return updatedData;
          } catch (rpcError) {
            throw rpcError;
          }
        }
      }
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
