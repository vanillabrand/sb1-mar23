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

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logService.log('info', 'Initializing template service', null, 'TemplateService');

      // Load initial templates
      const templates = await this.getTemplatesForUser();
      
      // Initialize template cache
      this.templates.clear();
      templates.forEach(template => {
        this.templates.set(template.id, template);
      });

      this.initialized = true;
      this.emit('initialized');
      
      logService.log('info', 'Template service initialized successfully', null, 'TemplateService');
    } catch (error) {
      logService.log('error', 'Failed to initialize template service', error, 'TemplateService');
      throw error;
    }
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

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      // Create new strategy based on template
      const { data: strategy, error: strategyError } = await supabase
        .from('strategies')
        .insert({
          title: template.title,
          description: template.description,
          risk_level: template.risk_level,
          strategy_config: template.config,
          status: 'inactive',
          user_id: user.id,
          type: 'template',
          performance: 0,
          selected_pairs: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
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

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const templateService = new TemplateService();
