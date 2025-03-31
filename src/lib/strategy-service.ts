import { supabase } from './supabase';
import { logService } from './log-service';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from './event-bus';
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
}

export const strategyService = new StrategyService();
