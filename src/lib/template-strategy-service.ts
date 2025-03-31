import { supabase } from './supabase';
import { logService } from './log-service';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from './event-bus';
import type { Strategy, CreateStrategyData } from './types';

/**
 * Service for managing template strategies
 */
class TemplateStrategyService {
  /**
   * Get all template strategies
   * @returns Array of template strategies
   */
  async getTemplateStrategies(): Promise<Strategy[]> {
    try {
      const { data, error } = await supabase
        .from('template_strategies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logService.log('error', 'Failed to get template strategies', { error }, 'TemplateStrategyService');
        throw error;
      }

      return data || [];
    } catch (error) {
      logService.log('error', 'Failed to get template strategies', { error }, 'TemplateStrategyService');
      return [];
    }
  }

  /**
   * Get a template strategy by ID
   * @param id Template strategy ID
   * @returns Template strategy
   */
  async getTemplateStrategy(id: string): Promise<Strategy | null> {
    try {
      const { data, error } = await supabase
        .from('template_strategies')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        logService.log('error', 'Failed to get template strategy', { error, id }, 'TemplateStrategyService');
        throw error;
      }

      return data;
    } catch (error) {
      logService.log('error', 'Failed to get template strategy', { error, id }, 'TemplateStrategyService');
      return null;
    }
  }

  /**
   * Copy a template strategy to the user's private collection
   * @param templateId Template strategy ID
   * @returns The newly created user strategy
   */
  async copyTemplateToUser(templateId: string): Promise<Strategy | null> {
    try {
      // Get current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user?.id) {
        throw new Error('No authenticated user found');
      }
      
      const userId = session.user.id;
      
      // Get the template strategy
      const templateStrategy = await this.getTemplateStrategy(templateId);
      
      if (!templateStrategy) {
        throw new Error(`Template strategy with ID ${templateId} not found`);
      }
      
      // Create a new strategy for the user based on the template
      const newStrategy: CreateStrategyData = {
        name: `${templateStrategy.name} (Copy)`,
        description: templateStrategy.description,
        type: 'custom', // Mark as custom since it's now owned by the user
        status: 'inactive', // Start as inactive
        selected_pairs: templateStrategy.selected_pairs || [],
        strategy_config: templateStrategy.strategy_config || {},
        performance: 0,
        user_id: userId
      };
      
      // Insert the new strategy
      const { data: createdStrategy, error } = await supabase
        .from('strategies')
        .insert({
          ...newStrategy,
          id: uuidv4(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        logService.log('error', 'Failed to copy template strategy', { error, templateId }, 'TemplateStrategyService');
        throw error;
      }
      
      if (!createdStrategy) {
        throw new Error('Failed to create strategy from template');
      }
      
      // Emit event to notify other components
      eventBus.emit('strategy:created', { strategy: createdStrategy });
      
      logService.log('info', `Template strategy ${templateId} copied to user ${userId}`, null, 'TemplateStrategyService');
      return createdStrategy;
    } catch (error) {
      logService.log('error', 'Failed to copy template strategy', { error, templateId }, 'TemplateStrategyService');
      return null;
    }
  }
}

export const templateStrategyService = new TemplateStrategyService();
