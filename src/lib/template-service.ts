import { EventEmitter } from './event-emitter';
import { supabase } from './supabase';
import type { StrategyTemplate } from './types';
import { logService } from './log-service';

class TemplateService extends EventEmitter {
  private templates: Map<string, StrategyTemplate> = new Map();
  private initialized: boolean = false;

  constructor() {
    super();
  }

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
  }

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

  async initializeDemoTemplates(): Promise<void> {
    try {
      // Load demo templates
      const demoTemplates = this.getDefaultDemoTemplates();
      
      // Clear existing templates and set demo ones
      this.templates.clear();
      demoTemplates.forEach(template => {
        this.templates.set(template.id, template);
      });

      this.initialized = true;
      this.emit('initialized');
    } catch (error) {
      logService.log('error', 'Failed to initialize demo templates', error, 'TemplateService');
      throw error;
    }
  }

  private getDefaultDemoTemplates(): StrategyTemplate[] {
    return [
      {
        id: 'demo-template-1',
        name: 'Basic MACD Strategy',
        description: 'A simple MACD-based trading strategy for demonstration',
        type: 'technical',
        config: {
          indicators: ['MACD', 'EMA'],
          timeframe: '1h',
          assets: ['BTC_USDT', 'ETH_USDT']
        }
      },
      // Add more demo templates as needed
    ];
  }
}

export const templateService = new TemplateService();
