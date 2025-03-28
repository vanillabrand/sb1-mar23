import { supabase } from './supabase';
import { StrategyTemplate } from './types';
import { logService } from './log-service';

export const templateService = {
  async getTemplatesForUser(): Promise<StrategyTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('strategy_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StrategyTemplate[];
    } catch (error) {
      logService.log('error', 'Failed to fetch strategy templates', error);
      throw error;
    }
  },

  async createStrategyFromTemplate(templateId: string): Promise<any> {
    try {
      const { data: template, error: templateError } = await supabase
        .from('strategy_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      // Create new strategy based on template
      const { data: strategy, error: strategyError } = await supabase
        .from('strategies')
        .insert([
          {
            title: template.title,
            description: template.description,
            risk_level: template.risk_level,
            config: template.config,
            status: 'active'
          }
        ])
        .select()
        .single();

      if (strategyError) throw strategyError;
      return strategy;
    } catch (error) {
      logService.log('error', 'Failed to create strategy from template', error);
      throw error;
    }
  }
};
