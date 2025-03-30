import { supabase } from './supabase';
import { logService } from './log-service';
import { v4 as uuidv4 } from 'uuid';
import type { Strategy, CreateStrategyData } from './types';

class StrategyService {
  async createStrategy(data: CreateStrategyData): Promise<Strategy> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user?.id) {
        throw new Error('No authenticated session found');
      }

      const strategy = {
        id: uuidv4(),
        ...data,
        type: data.type || 'custom',  // Add default type
        user_id: session.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: data.status || 'inactive',
        performance: 0,
        selected_pairs: data.selected_pairs || [],
        strategy_config: data.strategy_config || {}
      };

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
      const { error } = await supabase
        .from('strategies')
        .delete()
        .eq('id', id);

      if (error) {
        logService.log('error', 'Failed to delete strategy', { error, id }, 'StrategyService');
        throw error;
      }

      logService.log('info', `Strategy ${id} deleted successfully`, null, 'StrategyService');
    } catch (error) {
      logService.log('error', 'Failed to delete strategy', { error, id }, 'StrategyService');
      throw error;
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
      const { data, error } = await supabase
        .from('strategies')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logService.log('error', 'Failed to deactivate strategy', { error, id }, 'StrategyService');
        throw error;
      }

      if (!data) {
        throw new Error(`Strategy with ID ${id} not found or deactivation failed`);
      }

      logService.log('info', `Strategy ${id} deactivated successfully`, null, 'StrategyService');
      return data;
    } catch (error) {
      logService.log('error', 'Failed to deactivate strategy', { error, id }, 'StrategyService');
      throw error;
    }
  }
}

export const strategyService = new StrategyService();
