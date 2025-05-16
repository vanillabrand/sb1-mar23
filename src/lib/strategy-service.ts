import { supabase } from './supabase';
import { logService } from './log-service';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from './event-bus';
import { globalCacheService } from './global-cache-service';
// Import the StrategyManager class directly since it's not exported as a singleton
import { StrategyManager } from './strategy-manager';
import { riskManagementService } from './risk-management-service';
import { detectMarketType, normalizeMarketType } from './market-type-detection';
import { strategySync } from './strategy-sync';
import { demoService } from './demo-service';
import { apiClient } from './api-client';
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
      // Initialize API client if not already initialized
      await apiClient.initialize();

      // Check if we're in demo mode
      const isDemo = demoService.isInDemoMode();

      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      // In demo mode, we'll use a fallback user ID if there's no authenticated session
      let userId: string;

      if (sessionError || !session?.user?.id) {
        if (isDemo) {
          // Use a fallback demo user ID in demo mode
          userId = 'demo-user-' + Date.now().toString();
          logService.log('info', 'Using demo user ID for strategy creation', { userId }, 'StrategyService');
        } else {
          // In live mode, we still require authentication
          logService.log('error', 'No authenticated session found for strategy creation', { sessionError }, 'StrategyService');
          throw new Error('No authenticated session found');
        }
      } else {
        // Use the authenticated user's ID
        userId = session.user.id;
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

      // Ensure selected_pairs is properly formatted and not empty
      let selectedPairs = data.selected_pairs || [];

      // If selected_pairs is empty, try to extract from strategy_config
      if (selectedPairs.length === 0 && data.strategy_config?.assets) {
        selectedPairs = data.strategy_config.assets;
      }

      // If still empty, add a default pair
      if (selectedPairs.length === 0) {
        selectedPairs = ['BTC/USDT'];
      }

      // Ensure pairs are in the correct format (BTC/USDT instead of BTC_USDT)
      selectedPairs = selectedPairs.map(pair =>
        pair.includes('_') ? pair.replace('_', '/') : pair
      );

      // Create the strategy object with all required fields
      const strategy = {
        id: uuidv4(),
        ...data,
        name: data.name || data.title, // Map title to name if name is not provided
        type: data.type || 'custom',  // Add default type
        user_id: userId, // Use our userId variable (either from session or demo fallback)
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: data.status || 'inactive',
        performance: 0,
        selected_pairs: selectedPairs,
        strategy_config: {
          ...(data.strategy_config || {}),
          assets: selectedPairs, // Ensure assets are also set in strategy_config
          indicators: Array.isArray(data.strategy_config?.indicators) ?
            data.strategy_config.indicators : [] // Ensure indicators is always an array
        },
        market_type: marketType,
        marketType: marketType // Also set marketType for UI components
      };

      // Log the strategy data for debugging
      logService.log('debug', 'Creating strategy with data', {
        id: strategy.id,
        name: strategy.name,
        title: strategy.title,
        userId: session.user.id,
        marketType: strategy.marketType,
        market_type: strategy.market_type,
        selected_pairs: strategy.selected_pairs,
        strategy_config: strategy.strategy_config
      }, 'StrategyService');

      try {
        // Log the strategy data for debugging
        logService.log('info', 'Creating strategy with data', {
          id: strategy.id,
          name: strategy.name || strategy.title,
          title: strategy.title || strategy.name,
          market_type: strategy.market_type || strategy.marketType,
          selected_pairs: strategy.selected_pairs
        }, 'StrategyService');

        // Ensure all required fields are set
        const completeStrategy = {
          ...strategy,
          id: strategy.id || uuidv4(),
          name: strategy.name || strategy.title || 'New Strategy',
          title: strategy.title || strategy.name || 'New Strategy',
          description: strategy.description || '',
          user_id: userId, // Use our userId variable (either from session or demo fallback)
          created_at: strategy.created_at || new Date().toISOString(),
          updated_at: strategy.updated_at || new Date().toISOString(),
          status: strategy.status || 'inactive',
          market_type: strategy.market_type || strategy.marketType || 'spot',
          selected_pairs: Array.isArray(strategy.selected_pairs) && strategy.selected_pairs.length > 0
            ? strategy.selected_pairs
            : ['BTC/USDT'],
          risk_level: strategy.risk_level || 'Medium',
          type: strategy.type || 'custom'
        };

        let createdStrategy;

        try {
          // Try to create the strategy using the API first
          const apiStrategy = await apiClient.createStrategy({
            name: completeStrategy.name,
            title: completeStrategy.title,
            description: completeStrategy.description,
            risk_level: completeStrategy.risk_level,
            market_type: completeStrategy.market_type,
            selected_pairs: completeStrategy.selected_pairs,
            strategy_config: completeStrategy.strategy_config
          });

          logService.log('info', 'Successfully created strategy via API', {
            strategyId: apiStrategy.id
          }, 'StrategyService');

          createdStrategy = apiStrategy;
        } catch (apiError) {
          logService.log('warn', 'Failed to create strategy via API, falling back to Supabase', apiError, 'StrategyService');

          // Insert the strategy directly via Supabase
          const { data: dbStrategy, error } = await supabase
            .from('strategies')
            .insert(completeStrategy)
            .select()
            .single();

          if (error) {
            logService.log('error', 'Failed to create strategy via Supabase', {
              error,
              strategy: completeStrategy
            }, 'StrategyService');
            throw error;
          }

          if (!dbStrategy) {
            throw new Error('Failed to create strategy - no data returned');
          }

          createdStrategy = dbStrategy;
        }

        logService.log('info', 'Successfully created strategy', {
          strategyId: createdStrategy.id
        }, 'StrategyService');

        return createdStrategy;
      } catch (insertError) {
        logService.log('error', 'Failed to create strategy after multiple attempts', insertError, 'StrategyService');
        throw new Error(`Failed to create strategy: ${insertError.message}`);
      }

      // Refresh news and market insights cache in the background to include the new strategy's assets
      if (createdStrategy) {
        this.refreshCachesForNewStrategy(createdStrategy).catch(error => {
          logService.log('warn', 'Failed to refresh caches for new strategy', error, 'StrategyService');
        });
      }

      // Add the strategy to the strategy sync cache
      if (createdStrategy && strategySync && typeof strategySync.addStrategyToCache === 'function') {
        try {
          strategySync.addStrategyToCache(createdStrategy);
        } catch (syncError) {
          logService.log('warn', 'Failed to add strategy to sync cache', syncError, 'StrategyService');
        }
      }

      // Emit events to update all components
      if (createdStrategy) {
        try {
          eventBus.emit('strategy:created', createdStrategy);
          eventBus.emit('strategy:created', { strategy: createdStrategy }); // Also emit with object wrapper for compatibility

          // Also dispatch a DOM event for components that don't use the event bus
          if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('strategy:created', {
              detail: { strategy: createdStrategy }
            }));
          }
        } catch (eventError) {
          logService.log('warn', 'Failed to emit strategy created events', eventError, 'StrategyService');
        }
      }

      return createdStrategy;
    } catch (error) {
      logService.log('error', 'Failed to create strategy', error, 'StrategyService');
      throw error;
    }
  }

  async getStrategy(id: string): Promise<Strategy> {
    try {
      // Initialize API client if not already initialized
      await apiClient.initialize();

      try {
        // Try to get strategy from the API first
        const strategy = await apiClient.getStrategy(id);
        logService.log('info', 'Successfully retrieved strategy from API', { id }, 'StrategyService');
        return strategy;
      } catch (apiError) {
        logService.log('warn', 'Failed to get strategy from API, falling back to Supabase', { apiError, id }, 'StrategyService');

        // Fall back to direct Supabase access
        const { data, error } = await supabase
          .from('strategies')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          logService.log('error', 'Failed to get strategy from Supabase', { error, id }, 'StrategyService');
          throw error;
        }

        if (!data) {
          throw new Error(`Strategy with ID ${id} not found`);
        }

        return data;
      }
    } catch (error) {
      logService.log('error', 'Failed to get strategy', { error, id }, 'StrategyService');
      throw error;
    }
  }

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy> {
    try {
      // Initialize API client if not already initialized
      await apiClient.initialize();

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

      // Ensure selected_pairs is properly formatted if it's being updated
      if (safeUpdates.selected_pairs) {
        // Ensure pairs are in the correct format (BTC/USDT instead of BTC_USDT)
        safeUpdates.selected_pairs = safeUpdates.selected_pairs.map((pair: string) =>
          pair.includes('_') ? pair.replace('_', '/') : pair
        );

        // If strategy_config exists, also update assets in it
        if (safeUpdates.strategy_config) {
          safeUpdates.strategy_config = {
            ...safeUpdates.strategy_config,
            assets: safeUpdates.selected_pairs,
            // Ensure indicators is always an array
            indicators: Array.isArray(safeUpdates.strategy_config.indicators) ?
              safeUpdates.strategy_config.indicators : []
          };
        } else {
          // If strategy_config doesn't exist in updates, get it from current strategy
          const currentConfig = currentStrategy.strategy_config || {};
          safeUpdates.strategy_config = {
            ...currentConfig,
            assets: safeUpdates.selected_pairs,
            // Ensure indicators is always an array
            indicators: Array.isArray(currentConfig.indicators) ?
              currentConfig.indicators : []
          };
        }
      }

      // Ensure market_type and marketType are both set if either is being updated
      if (safeUpdates.market_type || safeUpdates.marketType) {
        const updatedMarketType = safeUpdates.market_type || safeUpdates.marketType;
        safeUpdates.market_type = updatedMarketType;
        safeUpdates.marketType = updatedMarketType;
      }

      try {
        // Try to update the strategy using the API first
        const updatedStrategy = await apiClient.updateStrategy(id, safeUpdates);

        logService.log('info', `Successfully updated strategy ${id} via API`, null, 'StrategyService');
        return updatedStrategy;
      } catch (apiError) {
        logService.log('warn', 'Failed to update strategy via API, falling back to Supabase', apiError, 'StrategyService');

        // Fall back to direct Supabase access
        const { data, error } = await supabase
          .from('strategies')
          .update(safeUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          logService.log('error', 'Failed to update strategy via Supabase', { error, id, updates }, 'StrategyService');
          throw error;
        }

        if (!data) {
          throw new Error(`Strategy with ID ${id} not found or update failed`);
        }

        return data;
      }
    } catch (error) {
      logService.log('error', 'Failed to update strategy', { error, id, updates }, 'StrategyService');
      throw error;
    }
  }

  async deleteStrategy(id: string): Promise<void> {
    try {
      console.log('StrategyService: Deleting strategy', id);

      // Initialize API client if not already initialized
      await apiClient.initialize();

      // Emit event before database operation for immediate UI update
      eventBus.emit('strategy:deleted', { strategyId: id });

      try {
        // Try to delete the strategy using the API first
        await apiClient.deleteStrategy(id);

        logService.log('info', `Successfully deleted strategy ${id} via API`, null, 'StrategyService');

        // Emit event again to ensure all components are updated
        eventBus.emit('strategy:deleted', { strategyId: id });
        return;
      } catch (apiError) {
        logService.log('warn', 'Failed to delete strategy via API, falling back to Supabase', apiError, 'StrategyService');

        // Get current user session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.user?.id) {
          throw new Error('No authenticated user found');
        }

        const userId = session.user.id;

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
      }
    } catch (error) {
      console.error(`Unexpected error deleting strategy ${id}:`, error);
      logService.log('error', 'Unexpected error deleting strategy', { error, id }, 'StrategyService');

      // Don't throw the error - we want the UI to update even if there's an error
      // The strategy has already been removed from the UI at this point
    }
  }

  async activateStrategy(id: string): Promise<Strategy> {
    try {
      logService.log('info', `Attempting to activate strategy with ID: ${id}`, null, 'StrategyService');

      // Initialize API client if not already initialized
      await apiClient.initialize();

      // Check if we're in demo mode
      const isDemo = demoService.isInDemoMode();

      try {
        // Try to activate the strategy using the API first
        const activatedStrategy = await apiClient.activateStrategy(id);

        logService.log('info', `Successfully activated strategy ${id} via API`, null, 'StrategyService');

        // Emit event to notify other components
        eventBus.emit('strategy:activated', {
          strategyId: id,
          strategy: activatedStrategy,
          timestamp: Date.now()
        });

        return activatedStrategy;
      } catch (apiError) {
        logService.log('warn', 'Failed to activate strategy via API, falling back to Supabase', apiError, 'StrategyService');

        // First, get the current strategy to check if it has trading pairs
        const { data: currentStrategy, error: getError } = await supabase
          .from('strategies')
          .select('*')
          .eq('id', id)
          .single();

        if (getError) {
          logService.log('error', 'Failed to get strategy for activation', { error: getError, id }, 'StrategyService');

          // In demo mode, we can try to get the strategy from the strategy sync cache
          if (isDemo) {
            const cachedStrategy = strategySync.getStrategy(id);
            if (cachedStrategy) {
              logService.log('info', `Found strategy ${id} in cache for demo mode activation`, null, 'StrategyService');
              return this.activateStrategyInDemoMode(cachedStrategy);
            }
          }

          throw getError;
        }

        if (!currentStrategy) {
          logService.log('error', `Strategy with ID ${id} not found for activation`, null, 'StrategyService');

          // In demo mode, we can try to get the strategy from the strategy sync cache
          if (isDemo) {
            const cachedStrategy = strategySync.getStrategy(id);
            if (cachedStrategy) {
              logService.log('info', `Found strategy ${id} in cache for demo mode activation`, null, 'StrategyService');
              return this.activateStrategyInDemoMode(cachedStrategy);
            }
          }

          throw new Error(`Strategy with ID ${id} not found or activation failed`);
        }

      // Check if strategy is already active
      if (currentStrategy.status === 'active') {
        logService.log('info', `Strategy ${id} is already active, returning current state`, null, 'StrategyService');
        return currentStrategy;
      }

      // Check if the strategy has trading pairs
      let tradingPairs = [];
      let updateNeeded = false;

      // Determine the trading pairs from various possible sources
      if (currentStrategy.selected_pairs && currentStrategy.selected_pairs.length > 0) {
        tradingPairs = currentStrategy.selected_pairs;
        logService.log('info', `Strategy ${id} has selected_pairs`, { pairs: tradingPairs }, 'StrategyService');
      } else if (currentStrategy.strategy_config?.assets && currentStrategy.strategy_config.assets.length > 0) {
        tradingPairs = currentStrategy.strategy_config.assets;
        logService.log('info', `Strategy ${id} has strategy_config.assets`, { pairs: tradingPairs }, 'StrategyService');
        updateNeeded = true;
      } else if (currentStrategy.strategy_config?.config?.pairs && currentStrategy.strategy_config.config.pairs.length > 0) {
        tradingPairs = currentStrategy.strategy_config.config.pairs;
        logService.log('info', `Strategy ${id} has strategy_config.config.pairs`, { pairs: tradingPairs }, 'StrategyService');
        updateNeeded = true;
      } else {
        // No trading pairs found, add default
        tradingPairs = ['BTC/USDT'];
        logService.log('warn', `Strategy ${id} has no trading pairs, adding default BTC/USDT`, null, 'StrategyService');
        updateNeeded = true;
      }

      // Ensure pairs are in the correct format (BTC/USDT instead of BTC_USDT)
      tradingPairs = tradingPairs.map(pair =>
        pair.includes('_') ? pair.replace('_', '/') : pair
      );

      // Ensure market type is set
      let marketType = currentStrategy.market_type || currentStrategy.marketType || 'spot';

      // Update all trading pair and market type fields for consistency
      if (!currentStrategy.strategy_config) currentStrategy.strategy_config = {};
      if (!currentStrategy.strategy_config.config) currentStrategy.strategy_config.config = {};

      currentStrategy.selected_pairs = tradingPairs;
      currentStrategy.strategy_config.assets = tradingPairs;
      currentStrategy.strategy_config.config.pairs = tradingPairs;

      // Ensure indicators is always an array
      if (!Array.isArray(currentStrategy.strategy_config.indicators)) {
        currentStrategy.strategy_config.indicators = [];
        logService.log('debug', `Initialized empty indicators array for strategy ${id}`, null, 'StrategyService');
      }

      // Determine the market type to use, ensuring consistency
      const strategyMarketType = currentStrategy.market_type || currentStrategy.marketType || 'spot';

      // Update both properties for consistency
      currentStrategy.market_type = strategyMarketType;
      currentStrategy.marketType = strategyMarketType;

      updateNeeded = true; // Always update to ensure consistency

      const updateData = {
        status: 'active',
        updated_at: new Date().toISOString(),
        deactivated_at: null, // Clear deactivated_at when activating
        selected_pairs: currentStrategy.selected_pairs || [],
        strategy_config: currentStrategy.strategy_config || {},
        market_type: strategyMarketType // Use market_type for database column
      };

      // Log the market type being used
      logService.log('info', `Activating strategy with market type: ${strategyMarketType}`, {
        strategyId: id,
        originalMarketType: currentStrategy.market_type || currentStrategy.marketType
      }, 'StrategyService');

      const { data, error } = await supabase
        .from('strategies')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logService.log('error', 'Failed to activate strategy', { error, id }, 'StrategyService');

        // Check if the error is due to RLS policy or permissions
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          logService.log('error', 'Permission denied when activating strategy - likely an RLS policy issue', { error, id }, 'StrategyService');

          // Try to get the current state of the strategy
          try {
            const { data: currentState } = await supabase
              .from('strategies')
              .select('*')
              .eq('id', id)
              .single();

            if (currentState && currentState.status === 'active') {
              logService.log('info', 'Strategy appears to be active despite update error', { id }, 'StrategyService');

              // Emit event to notify other components
              eventBus.emit('strategy:activated', {
                strategyId: id,
                strategy: currentState,
                timestamp: Date.now()
              });

              return currentState;
            }
          } catch (checkError) {
            // If we can't check the current state, just throw the original error
            logService.log('error', 'Failed to check current strategy state after activation error', { error: checkError, id }, 'StrategyService');
          }
        }

        throw error;
      }

      if (!data) {
        // Try to get the current state as a fallback
        try {
          const { data: currentState } = await supabase
            .from('strategies')
            .select('*')
            .eq('id', id)
            .single();

          if (currentState && currentState.status === 'active') {
            logService.log('info', 'Strategy appears to be active despite data being null', { id }, 'StrategyService');

            // Emit event to notify other components
            eventBus.emit('strategy:activated', {
              strategyId: id,
              strategy: currentState,
              timestamp: Date.now()
            });

            return currentState;
          }
        } catch (checkError) {
          logService.log('error', 'Failed to get current strategy state after activation failure', { error: checkError, id }, 'StrategyService');
        }

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

  /**
   * Special method to activate a strategy in demo mode
   * This bypasses database operations and works with in-memory data
   * @param strategy The strategy to activate
   * @returns The activated strategy
   */
  private async activateStrategyInDemoMode(strategy: Strategy): Promise<Strategy> {
    try {
      logService.log('info', `Activating strategy ${strategy.id} in demo mode`, null, 'StrategyService');

      // Create a copy of the strategy with active status
      const activatedStrategy = {
        ...strategy,
        status: 'active',
        updated_at: new Date().toISOString(),
        deactivated_at: null
      };

      // Update the strategy in the strategy sync cache
      strategySync.addStrategyToCache(activatedStrategy);

      // Emit events to notify other components
      eventBus.emit('strategy:activated', {
        strategyId: strategy.id,
        strategy: activatedStrategy,
        timestamp: Date.now()
      });

      document.dispatchEvent(new CustomEvent('strategy:activated', {
        detail: {
          strategyId: strategy.id,
          strategy: activatedStrategy
        }
      }));

      logService.log('info', `Strategy ${strategy.id} activated successfully in demo mode`, null, 'StrategyService');

      return activatedStrategy;
    } catch (error) {
      logService.log('error', `Failed to activate strategy ${strategy.id} in demo mode`, error, 'StrategyService');
      throw error;
    }
  }

  async deactivateStrategy(id: string): Promise<Strategy> {
    try {
      // Initialize API client if not already initialized
      await apiClient.initialize();

      try {
        // Try to deactivate the strategy using the API first
        const deactivatedStrategy = await apiClient.deactivateStrategy(id);

        logService.log('info', `Successfully deactivated strategy ${id} via API`, null, 'StrategyService');

        // Emit an event to notify other components
        eventBus.emit('strategy:deactivated', {
          strategyId: id,
          strategy: deactivatedStrategy,
          timestamp: Date.now()
        });

        return deactivatedStrategy;
      } catch (apiError) {
        logService.log('warn', 'Failed to deactivate strategy via API, falling back to Supabase', apiError, 'StrategyService');

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
      }
    } catch (error) {
      logService.log('error', 'Failed to deactivate strategy', { error, id }, 'StrategyService');
      throw error;
    }
  }

  async getAllStrategies(): Promise<Strategy[]> {
    try {
      // Initialize API client if not already initialized
      await apiClient.initialize();

      try {
        // Try to get strategies from the API first
        const strategies = await apiClient.getStrategies();
        logService.log('info', 'Successfully retrieved strategies from API', { count: strategies.length }, 'StrategyService');
        return strategies;
      } catch (apiError) {
        logService.log('warn', 'Failed to get strategies from API, falling back to Supabase', apiError, 'StrategyService');

        // Fall back to direct Supabase access
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
          logService.log('error', 'Failed to get strategies from Supabase', { error }, 'StrategyService');
          throw error;
        }

        return data || [];
      }
    } catch (error) {
      logService.log('error', 'Failed to get strategies', { error }, 'StrategyService');
      return [];
    }
  }

  async getActiveStrategies(): Promise<Strategy[]> {
    try {
      // Initialize API client if not already initialized
      await apiClient.initialize();

      try {
        // Get all strategies from the API
        const allStrategies = await apiClient.getStrategies();

        // Filter for active strategies
        const activeStrategies = allStrategies.filter(strategy => strategy.status === 'active');

        logService.log('info', 'Successfully retrieved active strategies from API',
          { count: activeStrategies.length, total: allStrategies.length }, 'StrategyService');

        return activeStrategies;
      } catch (apiError) {
        logService.log('warn', 'Failed to get active strategies from API, falling back to Supabase', apiError, 'StrategyService');

        // Fall back to direct Supabase access
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
          logService.log('error', 'Failed to get active strategies from Supabase', { error }, 'StrategyService');
          throw error;
        }

        return data || [];
      }
    } catch (error) {
      logService.log('error', 'Failed to get active strategies', { error }, 'StrategyService');
      return [];
    }
  }


  /**
   * Refresh caches for a new strategy
   * This is called when a new strategy is created to ensure we have relevant news and market insights
   */
  private async refreshCachesForNewStrategy(strategy: Strategy): Promise<void> {
    try {
      // Extract asset pairs from the strategy
      const assetPairs = this.extractAssetPairsFromStrategy(strategy);

      if (!assetPairs || assetPairs.length === 0) {
        logService.log('info', 'No asset pairs found in strategy, skipping cache refresh', { strategyId: strategy.id }, 'StrategyService');
        return;
      }

      // Extract the base assets (e.g., 'BTC' from 'BTC/USDT')
      const assets = assetPairs.map(pair => {
        // Handle different pair formats (BTC/USDT, BTC_USDT, etc.)
        const parts = pair.split(/[\/\_]/);
        return parts[0]; // Return the first part (base asset)
      }).filter(Boolean); // Remove any empty strings

      if (assets.length === 0) {
        logService.log('info', 'No valid assets extracted from pairs, skipping cache refresh', { strategyId: strategy.id, pairs: assetPairs }, 'StrategyService');
        return;
      }

      logService.log('info', 'Refreshing caches for new strategy assets', { strategyId: strategy.id, assets }, 'StrategyService');

      // Prepare assets in the format needed for market insights (with _USDT suffix)
      const marketInsightAssets = assets.map(asset => `${asset}_USDT`);

      // Force a refresh of the news cache to include these assets
      await globalCacheService.forceRefreshNews(assets);
      logService.log('info', 'Successfully refreshed news for strategy assets', { strategyId: strategy.id, assets }, 'StrategyService');

      // Force a refresh of the market insights cache to include these assets
      await globalCacheService.forceRefreshMarketInsights(marketInsightAssets);
      logService.log('info', 'Successfully refreshed market insights for strategy assets', { strategyId: strategy.id, marketInsightAssets }, 'StrategyService');

      // Emit an event to notify components that caches have been refreshed
      eventBus.emit('strategy:caches:refreshed', {
        strategyId: strategy.id,
        assets,
        marketInsightAssets,
        timestamp: Date.now()
      });
    } catch (error) {
      logService.log('error', 'Failed to refresh caches for strategy', error, 'StrategyService');
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
