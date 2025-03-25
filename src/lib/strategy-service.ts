import { supabase } from './supabase';
import { AIService } from './ai-service';
import { logService } from './log-service';
import { tradeService } from './trade-service';
import { marketService } from './market-service';
import { v4 as uuidv4 } from 'uuid';
import type { Database } from './supabase-types';
import type { RiskLevel } from './types';

type Strategy = Database['public']['Tables']['strategies']['Row'];

class StrategyService {
  private static instance: StrategyService;
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private strategyCache = new Map<string, Strategy>();

  private constructor() {}

  static getInstance(): StrategyService {
    if (!StrategyService.instance) {
      StrategyService.instance = new StrategyService();
    }
    return StrategyService.instance;
  }

  async validateStrategy(strategy: Strategy): Promise<string | null> {
    if (!strategy.title?.trim()) {
      return 'Strategy title is required';
    }
    if (!strategy.risk_level) {
      return 'Risk level is required';
    }
    if (!strategy.strategy_config) {
      return 'Strategy configuration is missing';
    }
    if (!strategy.strategy_config.assets?.length) {
      return 'No trading pairs configured';
    }
    if (!strategy.strategy_config.trade_parameters) {
      return 'Trading parameters not configured';
    }
    if (!strategy.strategy_config.risk_management) {
      return 'Risk management parameters not configured';
    }
    return null;
  }

  async createStrategy(data: {
    title: string;
    description: string | null;
    risk_level: RiskLevel;
    user_id: string;
  }): Promise<Strategy> {
    try {
      const strategyId = uuidv4();
      
      // Generate strategy configuration using AI
      const strategyConfig = await AIService.generateStrategy(
        data.description || data.title,
        data.risk_level
      );

      const strategyData = {
        id: strategyId,
        title: data.title,
        description: data.description,
        type: 'custom',
        status: 'inactive',
        performance: 0,
        risk_level: data.risk_level,
        user_id: data.user_id,
        strategy_config: strategyConfig,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Validate strategy before saving
      const validationError = await this.validateStrategy(strategyData);
      if (validationError) {
        throw new Error(validationError);
      }

      const { data: strategy, error } = await supabase
        .from('strategies')
        .insert(strategyData)
        .select()
        .single();

      if (error) throw error;
      if (!strategy) throw new Error('Failed to create strategy');

      // Update cache
      this.strategyCache.set(strategy.id, strategy);

      logService.log('info', 'Created new strategy', strategy, 'StrategyService');
      return strategy;
    } catch (error) {
      logService.log('error', 'Failed to create strategy', error, 'StrategyService');
      throw error;
    }
  }

  async activateStrategy(id: string): Promise<Strategy> {
    try {
      const strategy = await this.getStrategy(id);
      if (!strategy) {
        throw new Error('Strategy not found');
      }

      // Validate strategy before activation
      const validationError = await this.validateStrategy(strategy);
      if (validationError) {
        throw new Error(validationError);
      }

      // Check if budget is configured
      const budget = tradeService.getBudget(id);
      if (!budget) {
        throw new Error('Strategy budget not configured');
      }

      // Update strategy status in database
      const { data: updatedStrategy, error } = await supabase
        .from('strategies')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        // Handle 406 errors for non-existent strategies
        if (error.code === 'PGRST116') {
          this.strategyCache.delete(id);
          throw new Error('Strategy not found');
        }
        throw error;
      }

      if (!updatedStrategy) throw new Error('Failed to activate strategy');

      // Start market monitoring
      await marketService.startStrategyMonitoring(updatedStrategy);

      // Update cache
      this.strategyCache.set(id, updatedStrategy);

      logService.log('info', `Strategy ${id} activated`, updatedStrategy, 'StrategyService');
      return updatedStrategy;
    } catch (error) {
      logService.log('error', `Failed to activate strategy ${id}`, error, 'StrategyService');
      throw error;
    }
  }

  async deactivateStrategy(id: string): Promise<Strategy> {
    try {
      // Stop market monitoring first
      await marketService.stopStrategyMonitoring(id);

      // Update strategy status in database
      const { data: updatedStrategy, error } = await supabase
        .from('strategies')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        // Handle 406 errors for non-existent strategies
        if (error.code === 'PGRST116') {
          this.strategyCache.delete(id);
          throw new Error('Strategy not found');
        }
        throw error;
      }

      if (!updatedStrategy) throw new Error('Failed to deactivate strategy');

      // Clear strategy budget
      await tradeService.setBudget(id, null);

      // Update cache
      this.strategyCache.set(id, updatedStrategy);

      logService.log('info', `Strategy ${id} deactivated`, updatedStrategy, 'StrategyService');
      return updatedStrategy;
    } catch (error) {
      logService.log('error', `Failed to deactivate strategy ${id}`, error, 'StrategyService');
      throw error;
    }
  }

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy> {
    try {
      const strategy = await this.getStrategy(id);
      if (!strategy) {
        throw new Error('Strategy not found');
      }

      // If strategy is active, validate updates
      if (strategy.status === 'active') {
        const updatedStrategy = { ...strategy, ...updates };
        const validationError = await this.validateStrategy(updatedStrategy);
        if (validationError) {
          throw new Error(validationError);
        }
      }

      const { data: updatedStrategy, error } = await supabase
        .from('strategies')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        // Handle 406 errors for non-existent strategies
        if (error.code === 'PGRST116') {
          this.strategyCache.delete(id);
          throw new Error('Strategy not found');
        }
        throw error;
      }

      if (!updatedStrategy) throw new Error('Failed to update strategy');

      // Update cache
      this.strategyCache.set(id, updatedStrategy);

      // If status changed, handle activation/deactivation
      if (updates.status === 'active' && strategy.status !== 'active') {
        await this.activateStrategy(id);
      } else if (updates.status === 'inactive' && strategy.status === 'active') {
        await this.deactivateStrategy(id);
      }

      logService.log('info', `Strategy ${id} updated`, updatedStrategy, 'StrategyService');
      return updatedStrategy;
    } catch (error) {
      logService.log('error', `Failed to update strategy ${id}`, error, 'StrategyService');
      throw error;
    }
  }

  async deleteStrategy(id: string): Promise<void> {
    try {
      const strategy = await this.getStrategy(id);
      if (!strategy) {
        // If strategy doesn't exist, just clean up cache and return
        this.strategyCache.delete(id);
        return;
      }

      // If strategy is active, deactivate it first
      if (strategy.status === 'active') {
        await this.deactivateStrategy(id);
      }

      const { error } = await supabase
        .from('strategies')
        .delete()
        .eq('id', id);

      if (error) {
        // Handle 406 errors silently for non-existent strategies
        if (error.code === 'PGRST116') {
          this.strategyCache.delete(id);
          return;
        }
        throw error;
      }

      // Remove from cache
      this.strategyCache.delete(id);

      logService.log('info', `Strategy ${id} deleted`, null, 'StrategyService');
    } catch (error) {
      logService.log('error', `Failed to delete strategy ${id}`, error, 'StrategyService');
      throw error;
    }
  }

  async getStrategy(id: string): Promise<Strategy | null> {
    try {
      // Check cache first
      if (this.strategyCache.has(id)) {
        return this.strategyCache.get(id) || null;
      }

      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      // Handle 406 errors silently for non-existent strategies
      if (error?.code === 'PGRST116' || !data) {
        this.strategyCache.delete(id);
        return null;
      }

      if (error) throw error;

      if (data) {
        this.strategyCache.set(id, data);
      }

      return data;
    } catch (error) {
      logService.log('error', `Failed to get strategy ${id}`, error, 'StrategyService');
      return null;
    }
  }

  async getStrategies(): Promise<Strategy[]> {
    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Update cache
      data?.forEach(strategy => {
        this.strategyCache.set(strategy.id, strategy);
      });

      return data || [];
    } catch (error) {
      logService.log('error', 'Failed to get strategies', error, 'StrategyService');
      return [];
    }
  }

  clearCache(): void {
    this.strategyCache.clear();
  }
}

export const strategyService = StrategyService.getInstance();

export { StrategyService };