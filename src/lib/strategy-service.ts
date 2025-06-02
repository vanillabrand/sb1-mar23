import { supabase } from './supabase';
import { logService } from './log-service';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from './event-bus';
import { globalCacheService } from './global-cache-service';
import { StrategyManager } from './strategy-manager';
import { riskManagementService } from './risk-management-service';
import { detectMarketType, normalizeMarketType } from './market-type-detection';
import { strategySync } from './strategy-sync';
import { demoService } from './demo-service';
import { apiClient } from './api-client';
import type { Strategy, ApiStrategy, CreateStrategyData, MarketType, Json, RiskLevel } from './types';

type StrategyStatus = 'active' | 'inactive' | 'paused' | 'stopped';

class StrategyService {
  /**
   * Detects the market type from a strategy description
   */
  detectMarketTypeFromDescription(description: string): MarketType {
    return detectMarketType(description);
  }

  public async createStrategy(data: CreateStrategyData): Promise<Strategy> {
    try {
      await apiClient.initialize();
      const isDemo = demoService.isInDemoMode();

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      let userId: string;

      if (sessionError || !session?.user?.id) {
        if (isDemo) {
          userId = 'demo-user-' + Date.now().toString();
          logService.log('info', 'Using demo user ID for strategy creation', { userId }, 'StrategyService');
        } else {
          logService.log('error', 'No authenticated session found for strategy creation', { sessionError }, 'StrategyService');
          throw new Error('No authenticated session found');
        }
      } else {
        userId = session.user.id;
      }

      let marketType: MarketType;
      if (data.marketType) {
        marketType = normalizeMarketType(data.marketType);
      } else if (data.market_type) {
        marketType = normalizeMarketType(data.market_type);
      } else {
        marketType = detectMarketType(data.description || '');
      }

      logService.log('info', `Detected market type: ${marketType} for strategy`, {
        title: data.title,
        description: data.description?.substring(0, 50) + '...',
      }, 'StrategyService');

      if (marketType === 'margin' || marketType === 'futures') {
        const symbol = data.selected_pairs && data.selected_pairs.length > 0 ?
          data.selected_pairs[0] : 'BTC/USDT';

        const leverage = marketType === 'futures' && data.strategy_config?.leverage ?
          data.strategy_config.leverage : undefined;

        const marginRatio = marketType === 'margin' && data.strategy_config?.marginRatio ?
          data.strategy_config.marginRatio : undefined;

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

        if (marginLeverageValidation.recommendedValue !== undefined) {
          if (marketType === 'futures' && leverage !== undefined) {
            if (!data.strategy_config) data.strategy_config = {};
            data.strategy_config.leverage = marginLeverageValidation.recommendedValue;
            logService.log('info', `Adjusted leverage to ${marginLeverageValidation.recommendedValue}x`, null, 'StrategyService');
          } else if (marketType === 'margin' && marginRatio !== undefined) {
            if (!data.strategy_config) data.strategy_config = {};
            data.strategy_config.marginRatio = marginLeverageValidation.recommendedValue;
            logService.log('info', `Adjusted margin ratio to ${(marginLeverageValidation.recommendedValue * 100).toFixed(0)}%`, null, 'StrategyService');
          }
        }
      }

      let selectedPairs = data.selected_pairs || [];
      if (selectedPairs.length === 0 && data.strategy_config?.assets) {
        selectedPairs = data.strategy_config.assets;
      }
      if (selectedPairs.length === 0) {
        selectedPairs = ['BTC/USDT'];
      }

      selectedPairs = selectedPairs.map(pair =>
        pair.includes('_') ? pair.replace('_', '/') : pair
      );

      const strategy = {
        id: uuidv4(),
        ...data,
        name: data.name || data.title,
        type: data.type || 'custom',
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: (data.status || 'inactive') as StrategyStatus,
        performance: 0,
        selected_pairs: selectedPairs,
        strategy_config: {
          ...(data.strategy_config || {}),
          assets: selectedPairs,
          indicators: Array.isArray(data.strategy_config?.indicators) ?
            data.strategy_config.indicators : []
        },
        market_type: marketType,
        marketType: marketType
      };

      logService.log('debug', 'Creating strategy with data', {
        id: strategy.id,
        name: strategy.name,
        title: strategy.title,
        userId: session.user.id,
        marketType: strategy.marketType,
        selected_pairs: strategy.selected_pairs,
      }, 'StrategyService');

      try {
        const createdStrategy = await apiClient.createStrategy(strategy) as Strategy;
        logService.log('info', 'Successfully created strategy via API', {
          id: createdStrategy.id,
          name: createdStrategy.name,
        }, 'StrategyService');

        // Refresh caches in background
        this.refreshCachesForNewStrategy(createdStrategy).catch(error => {
          logService.log('error', 'Failed to refresh caches for new strategy', error, 'StrategyService');
        });

        return createdStrategy;
      } catch (apiError) {
        logService.log('warn', 'Failed to create strategy via API, falling back to Supabase', apiError, 'StrategyService');

        const { data, error } = await supabase
          .from('strategies')
          .insert(strategy)
          .select()
          .single();

        if (error) {
          logService.log('error', 'Failed to create strategy via Supabase', { error }, 'StrategyService');
          throw error;
        }

        return data as Strategy;
      }
    } catch (error) {
      logService.log('error', 'Failed to create strategy', { error }, 'StrategyService');
      throw error;
    }
  }

  async getStrategy(id: string): Promise<Strategy> {
    try {
      await apiClient.initialize();

      try {
        const strategy = await apiClient.getStrategy(id) as Strategy;
        logService.log('info', 'Successfully retrieved strategy from API', { id }, 'StrategyService');
        return strategy;
      } catch (apiError) {
        logService.log('warn', 'Failed to get strategy from API, falling back to Supabase', { apiError, id }, 'StrategyService');

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

        return data as Strategy;
      }
    } catch (error) {
      logService.log('error', 'Failed to get strategy', { error, id }, 'StrategyService');
      throw error;
    }
  }

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy> {
    try {
      await apiClient.initialize();

      const currentStrategy = await this.getStrategy(id);
      let marketType: MarketType;

      if (updates.marketType) {
        marketType = normalizeMarketType(updates.marketType);
      } else if (updates.market_type) {
        marketType = normalizeMarketType(updates.market_type);
      } else {
        marketType = currentStrategy.market_type || 'spot';
      }

      const riskLevel = updates.riskLevel || currentStrategy.riskLevel || 'Medium';

      if (marketType === 'margin' || marketType === 'futures') {
        const symbol = updates.selected_pairs && updates.selected_pairs.length > 0 ?
          updates.selected_pairs[0] :
          (currentStrategy.selected_pairs && currentStrategy.selected_pairs.length > 0 ?
            currentStrategy.selected_pairs[0] : 'BTC/USDT');

        const updatedConfig = updates.strategy_config || {};
        const currentConfig = currentStrategy.strategy_config || {};

        const leverage = marketType === 'futures' ?
          updatedConfig.leverage || currentConfig.leverage : undefined;

        const marginRatio = marketType === 'margin' ?
          updatedConfig.marginRatio || currentConfig.marginRatio : undefined;

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

        if (marginLeverageValidation.recommendedValue !== undefined) {
          if (marketType === 'futures' && leverage !== undefined) {
            if (!updates.strategy_config) updates.strategy_config = {...currentConfig};
            updates.strategy_config.leverage = marginLeverageValidation.recommendedValue;
          } else if (marketType === 'margin' && marginRatio !== undefined) {
            if (!updates.strategy_config) updates.strategy_config = {...currentConfig};
            updates.strategy_config.marginRatio = marginLeverageValidation.recommendedValue;
          }
        }
      }

      const safeUpdates = { ...updates };
      delete safeUpdates.id;
      delete safeUpdates.user_id;
      delete safeUpdates.created_at;

      safeUpdates.updated_at = new Date().toISOString();
      safeUpdates.market_type = marketType;

      try {
        const apiResponse = await apiClient.updateStrategy(id, safeUpdates) as Strategy;
        logService.log('info', `Successfully updated strategy ${id} via API`, null, 'StrategyService');
        return apiResponse;
      } catch (apiError) {
        logService.log('warn', 'Failed to update strategy via API, falling back to Supabase', apiError, 'StrategyService');

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

        return data as Strategy;
      }
    } catch (error) {
      logService.log('error', 'Failed to update strategy', { error, id, updates }, 'StrategyService');
      throw error;
    }
  }

  async deleteStrategy(id: string): Promise<void> {
    if (!id) {
      throw new Error('Strategy ID is required');
    }

    try {
      logService.log('info', `Deleting strategy ${id}`, null, 'StrategyService');
      await apiClient.initialize();

      const startTime = Date.now();
      eventBus.emit('strategy:deleted', { strategyId: id });

      try {
        await apiClient.deleteStrategy(id);
        const duration = Date.now() - startTime;
        logService.log('info', `Successfully deleted strategy ${id} via API in ${duration}ms`, null, 'StrategyService');
        eventBus.emit('strategy:deleted', { strategyId: id });
        return;
      } catch (apiError) {
        logService.log('warn', 'Failed to delete strategy via API, falling back to Supabase', {
          error: apiError,
          strategyId: id
        }, 'StrategyService');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user?.id) {
          throw new Error('No authenticated user found');
        }

        const userId = session.user.id;

        const { data: existingStrategy, error: checkError } = await supabase
          .from('strategies')
          .select('id, user_id')
          .eq('id', id)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.warn(`Error checking if strategy ${id} exists:`, checkError);
        }

        if (!existingStrategy) {
          console.log(`Strategy ${id} doesn't exist in database, skipping deletion`);
          eventBus.emit('strategy:deleted', { strategyId: id });
          return;
        }

        if (existingStrategy.user_id !== userId) {
          console.error(`Strategy ${id} does not belong to the current user`);
          throw new Error(`Strategy ${id} does not belong to the current user`);
        }

        try {
          console.log(`Attempting to delete trades for strategy ${id}`);
          const { error: tradesError } = await supabase
            .from('trades')
            .delete()
            .eq('strategy_id', id);

          if (tradesError) {
            console.warn(`Error deleting trades for strategy ${id}:`, tradesError);
          }

          const { error } = await supabase
            .from('strategies')
            .delete()
            .eq('id', id);

          if (error) {
            console.error(`Database error deleting strategy ${id}:`, error);
            logService.log('error', 'Database error deleting strategy', { error, id }, 'StrategyService');
            throw error;
          }

          logService.log('info', `Strategy ${id} deleted successfully`, null, 'StrategyService');
          eventBus.emit('strategy:deleted', { strategyId: id });
        } catch (error) {
          console.error(`Unexpected error deleting strategy ${id}:`, error);
          logService.log('error', 'Unexpected error deleting strategy', { error, id }, 'StrategyService');
          throw error;
        }
      }
    } catch (error) {
      logService.log('error', 'Failed to delete strategy', { error, id }, 'StrategyService');
      throw error;
    }
  }

  public async activateStrategy(id: string): Promise<Strategy> {
    try {
      const isDemo = demoService.isInDemoMode();
      if (isDemo) {
        const strategy = await this.getStrategy(id);
        return this.activateStrategyInDemoMode(strategy);
      }

      const activatedStrategy = await this.updateStrategy(id, {
        status: 'active',
        updated_at: new Date().toISOString()
      });

      eventBus.emit('strategy:activated', {
        strategyId: id,
        timestamp: Date.now()
      });

      return activatedStrategy;
    } catch (error) {
      logService.log('error', 'Failed to activate strategy', { error, id }, 'StrategyService');
      throw error;
    }
  }

  private async activateStrategyInDemoMode(strategy: Strategy): Promise<Strategy> {
    const activatedStrategy = {
      ...strategy,
      status: 'active' as StrategyStatus,
      updated_at: new Date().toISOString()
    };

    eventBus.emit('strategy:activated', {
      strategyId: strategy.id,
      timestamp: Date.now()
    });

    return activatedStrategy;
  }

  async deactivateStrategy(id: string): Promise<Strategy> {
    try {
      const deactivatedStrategy = await this.updateStrategy(id, {
        status: 'inactive',
        updated_at: new Date().toISOString()
      });

      eventBus.emit('strategy:deactivated', {
        strategyId: id,
        timestamp: Date.now()
      });

      return deactivatedStrategy;
    } catch (error) {
      logService.log('error', 'Failed to deactivate strategy', { error, id }, 'StrategyService');
      throw error;
    }
  }

  async getAllStrategies(): Promise<Strategy[]> {
    try {
      logService.log('debug', 'Fetching all strategies', null, 'StrategyService');
      const startTime = Date.now();
      await apiClient.initialize();

      try {
        const strategies = await apiClient.getStrategies() as Strategy[];
        logService.log('info', 'Successfully retrieved strategies from API', { count: strategies.length }, 'StrategyService');
        return strategies;
      } catch (apiError) {
        logService.log('warn', 'Failed to get strategies from API, falling back to Supabase', apiError, 'StrategyService');
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user?.id) {
          return [];
        }

        const { data, error } = await supabase
          .from('strategies')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) {
          logService.log('error', 'Failed to get strategies from Supabase', { error }, 'StrategyService');
          return [];
        }

        return data as Strategy[] || [];
      }
    } catch (error) {
      logService.log('error', 'Failed to get strategies', { error }, 'StrategyService');
      return [];
    }
  }

  async getActiveStrategies(): Promise<Strategy[]> {
    try {
      logService.log('debug', 'Fetching active strategies', null, 'StrategyService');
      const startTime = Date.now();
      await apiClient.initialize();

      try {
        const allStrategies = await apiClient.getStrategies() as Strategy[];
        const activeStrategies = allStrategies.filter(strategy => strategy.status === 'active');
        logService.log('info', 'Successfully retrieved active strategies from API', {
          count: activeStrategies.length,
          total: allStrategies.length
        }, 'StrategyService');
        return activeStrategies;
      } catch (apiError) {
        logService.log('warn', 'Failed to get active strategies from API, falling back to Supabase', apiError, 'StrategyService');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user?.id) {
          return [];
        }

        const { data, error } = await supabase
          .from('strategies')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) {
          logService.log('error', 'Failed to get active strategies from Supabase', { error }, 'StrategyService');
          return [];
        }

        return data as Strategy[] || [];
      }
    } catch (error) {
      logService.log('error', 'Failed to get active strategies', { error }, 'StrategyService');
      return [];
    }
  }

  /**
   * Refresh caches for a new strategy
   */
  private async refreshCachesForNewStrategy(strategy: Strategy): Promise<void> {
    if (!strategy) {
      logService.log('warn', 'No strategy provided for cache refresh', null, 'StrategyService');
      return;
    }

    try {
      logService.log('debug', `Refreshing caches for new strategy ${strategy.id}`, null, 'StrategyService');
      const startTime = Date.now();

      await globalCacheService.forceRefreshNews();

      if (strategySync?.syncAll) {
        await strategySync.syncAll();
      }

      const assetPairs = this.extractAssetPairsFromStrategy(strategy);
      if (!assetPairs || assetPairs.length === 0) {
        logService.log('info', 'No asset pairs found in strategy, skipping cache refresh',
          { strategyId: strategy.id }, 'StrategyService');
        return;
      }

      const assets = assetPairs
        .map(pair => pair.split(/[\/\_]/)[0])
        .filter(Boolean);

      if (assets.length === 0) {
        logService.log('info', 'No valid assets extracted from pairs',
          { strategyId: strategy.id, pairs: assetPairs }, 'StrategyService');
        return;
      }

      const marketInsightAssets = assets.map(asset => `${asset}_USDT`);
      await globalCacheService.forceRefreshNews();
      await globalCacheService.forceRefreshMarketInsights(marketInsightAssets);

      logService.log('info', 'Successfully refreshed caches for strategy assets',
        {
          strategyId: strategy.id,
          assets,
          durationMs: Date.now() - startTime
        }, 'StrategyService');

      eventBus.emit('strategy:caches:refreshed', {
        strategyId: strategy.id,
        assets,
        marketInsightAssets,
        timestamp: Date.now()
      });
    } catch (error) {
      logService.log('error', 'Failed to refresh caches for strategy', error, 'StrategyService');
    }
  }

  /**
   * Extract asset pairs from a strategy
   */
  private extractAssetPairsFromStrategy(strategy: Strategy): string[] {
    if (strategy.selected_pairs && strategy.selected_pairs.length > 0) {
      return strategy.selected_pairs;
    }

    if (strategy.strategy_config && strategy.strategy_config.assets) {
      return strategy.strategy_config.assets;
    }

    if (strategy.strategy_config?.config?.pairs) {
      return strategy.strategy_config.config.pairs;
    }

    return ['BTC/USDT'];
  }
}

export const strategyService = new StrategyService();
