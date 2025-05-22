import { supabase } from './supabase';
import { logService } from './log-service';
import { StrategyTemplate } from './types';
import { v4 as uuidv4 } from 'uuid';
import { strategyService } from './strategy-service';
import { strategySync } from './strategy-sync';
import { eventBus } from './event-bus';
import { apiCache } from './api-cache';

export class TemplateService {
  async getTemplates(forceRefresh: boolean = false): Promise<StrategyTemplate[]> {
    try {
      // Check cache first if not forcing refresh
      const cacheKey = 'templates:all';
      if (!forceRefresh) {
        const cachedTemplates = apiCache.get<StrategyTemplate[]>(cacheKey);
        if (cachedTemplates) {
          logService.log('info', 'Using cached templates', null, 'TemplateService');
          return cachedTemplates;
        }
      }

      const { data, error } = await supabase
        .from('strategy_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert database format to frontend format
      const templates = (data || []).map(template => {
        const result: any = { ...template };

        // Convert risk_level to riskLevel for frontend use
        if (template.risk_level && !template.riskLevel) {
          result.riskLevel = template.risk_level;
        }

        // Add default values for fields that might not be in the database
        if (!result.selected_pairs) {
          result.selected_pairs = ['BTC/USDT'];
        }

        if (!result.strategy_config) {
          result.strategy_config = {
            indicatorType: 'momentum',
            entryConditions: {},
            exitConditions: {}
          };
        }

        if (!result.metrics) {
          result.metrics = {
            winRate: 50,
            profitFactor: 1.5,
            averageProfit: 1.2,
            maxDrawdown: 10
          };
        }

        return result;
      });

      // Cache the templates for 5 minutes (300000 ms)
      apiCache.set(cacheKey, templates, 300000);
      logService.log('info', 'Cached templates', null, 'TemplateService');

      return templates;
    } catch (error) {
      logService.log('error', 'Failed to fetch templates', error, 'TemplateService');
      throw error;
    }
  }

  async getTemplatesForUser(userId?: string, forceRefresh: boolean = false): Promise<StrategyTemplate[]> {
    try {
      // Check cache first if not forcing refresh
      const cacheKey = userId ? `templates:user:${userId}` : 'templates:system';
      if (!forceRefresh) {
        const cachedTemplates = apiCache.get<StrategyTemplate[]>(cacheKey);
        if (cachedTemplates) {
          logService.log('info', `Using cached templates for user ${userId || 'system'}`, null, 'TemplateService');
          return cachedTemplates;
        }
      }

      let query = supabase
        .from('strategy_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.or(`user_id.eq.${userId},type.eq.system_template`);
      } else {
        query = query.eq('type', 'system_template');
      }

      const { data, error } = await query;

      if (error) throw error;

      // Convert database format to frontend format
      const templates = (data || []).map(template => {
        const result: any = { ...template };

        // Convert risk_level to riskLevel for frontend use
        if (template.risk_level && !template.riskLevel) {
          result.riskLevel = template.risk_level;
        }

        // Add default values for fields that might not be in the database
        if (!result.selected_pairs) {
          result.selected_pairs = ['BTC/USDT'];
        }

        if (!result.strategy_config) {
          result.strategy_config = {
            indicatorType: 'momentum',
            entryConditions: {},
            exitConditions: {}
          };
        }

        if (!result.metrics) {
          result.metrics = {
            winRate: 50,
            profitFactor: 1.5,
            averageProfit: 1.2,
            maxDrawdown: 10
          };
        }

        // Add market type if not present
        if (!result.marketType) {
          // Assign market types based on risk level for demo purposes
          const riskLevel = (result.riskLevel || result.risk_level || '').toLowerCase();
          if (riskLevel.includes('high') || riskLevel.includes('extreme')) {
            result.marketType = 'futures';
          } else if (riskLevel.includes('medium')) {
            result.marketType = 'margin';
          } else {
            result.marketType = 'spot';
          }
        }

        return result;
      });

      // Cache the templates for 5 minutes (300000 ms)
      apiCache.set(cacheKey, templates, 300000);
      logService.log('info', `Cached templates for user ${userId || 'system'}`, null, 'TemplateService');

      return templates;
    } catch (error) {
      logService.log('error', 'Failed to fetch user templates', error, 'TemplateService');
      throw error;
    }
  }

  async createTemplate(template: Partial<StrategyTemplate>): Promise<StrategyTemplate> {
    try {
      // Ensure required fields and defaults
      const templateData = {
        name: template.name,
        title: template.title || template.name,
        description: template.description,
        type: template.type || 'template',
        risk_level: template.riskLevel || 'Medium',
        selected_pairs: template.selected_pairs || ['BTC/USDT'],
        strategy_config: template.strategy_config || {
          indicatorType: 'momentum',
          entryConditions: {},
          exitConditions: {},
          trade_parameters: {
            position_size: 0.1
          }
        },
        status: 'active'
      };

      const { data, error } = await supabase
        .from('strategy_templates')
        .insert(templateData)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to create template');

      // Clear template caches
      apiCache.remove('templates:all');
      apiCache.remove(`templates:user:${data.user_id}`);
      apiCache.remove('templates:system');

      return this.convertDatabaseToFrontendFormat(data);
    } catch (error) {
      logService.log('error', 'Failed to create template', error, 'TemplateService');
      throw error;
    }
  }

  private convertDatabaseToFrontendFormat(dbTemplate: any): StrategyTemplate {
    return {
      id: dbTemplate.id,
      name: dbTemplate.name,
      title: dbTemplate.title || dbTemplate.name,
      description: dbTemplate.description,
      type: dbTemplate.type,
      riskLevel: dbTemplate.risk_level,
      selected_pairs: dbTemplate.selected_pairs || ['BTC/USDT'],
      strategy_config: dbTemplate.strategy_config || {
        indicatorType: 'momentum',
        entryConditions: {},
        exitConditions: {},
        trade_parameters: {
          position_size: 0.1
        }
      },
      status: dbTemplate.status,
      created_at: dbTemplate.created_at,
      updated_at: dbTemplate.updated_at
    };
  }

  async updateTemplate(id: string, updates: Partial<StrategyTemplate>): Promise<StrategyTemplate> {
    try {
      // First get the existing template
      const { data: existingTemplate, error: fetchError } = await supabase
        .from('strategy_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!existingTemplate) throw new Error('Template not found');

      // Create a minimal update object with only essential fields
      const minimalUpdates: any = {
        updated_at: new Date().toISOString()
      };

      // Update basic fields if they exist in updates
      if (updates.title) minimalUpdates.title = updates.title;
      if (updates.description) minimalUpdates.description = updates.description;
      if (updates.type) minimalUpdates.type = updates.type;

      // Handle risk level conversion
      if (updates.riskLevel || updates.risk_level) {
        minimalUpdates.risk_level = updates.riskLevel || updates.risk_level;
      }

      // Update the template with only the fields we know exist
      const { data, error } = await supabase
        .from('strategy_templates')
        .update(minimalUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Template not found after update');

      // Convert to frontend format
      const result: any = { ...data };

      // Convert risk_level to riskLevel
      if (data.risk_level && !data.riskLevel) {
        result.riskLevel = data.risk_level;
      }

      // Add default values for fields that might not be in the database
      if (!result.selected_pairs) {
        result.selected_pairs = ['BTC/USDT'];
      }

      if (!result.strategy_config) {
        result.strategy_config = {
          indicatorType: 'momentum',
          entryConditions: {},
          exitConditions: {}
        };
      }

      if (!result.metrics) {
        result.metrics = {
          winRate: 50,
          profitFactor: 1.5,
          averageProfit: 1.2,
          maxDrawdown: 10
        };
      }

      return result;
    } catch (error) {
      logService.log('error', 'Failed to update template', error, 'TemplateService');
      throw error;
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    try {
      // First get the template to know the user_id
      const { data: template, error: fetchError } = await supabase
        .from('strategy_templates')
        .select('user_id')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Delete the template
      const { error } = await supabase
        .from('strategy_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Clear template caches
      apiCache.remove('templates:all');
      if (template?.user_id) {
        apiCache.remove(`templates:user:${template.user_id}`);
      }
      apiCache.remove('templates:system');

      logService.log('info', `Deleted template ${id}`, null, 'TemplateService');
    } catch (error) {
      logService.log('error', 'Failed to delete template', error, 'TemplateService');
      throw error;
    }
  }

  async createStrategyFromTemplate(templateId: string): Promise<any> {
    try {
      // Get all templates and find the one with matching ID
      const templates = await this.getTemplates();
      const template = templates.find(t => t.id === templateId);

      if (!template) {
        throw new Error(`Template with ID ${templateId} not found`);
      }

      // Get current user
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user?.id) {
        throw new Error('No authenticated session found');
      }

      // Get the risk level from template
      const riskLevel = template.riskLevel || template.risk_level || 'Medium';

      // Use template's selected pairs if available, otherwise default to BTC/USDT
      const selectedPairs = template.selected_pairs && template.selected_pairs.length > 0
        ? template.selected_pairs
        : ['BTC/USDT'];

      // Use template's strategy config if available, otherwise create a basic one
      const strategyConfig = template.strategy_config && Object.keys(template.strategy_config).length > 0
        ? template.strategy_config
        : {
            indicatorType: 'momentum',
            entryConditions: {},
            exitConditions: {}
          };

      // Create a new strategy based on the template
      const strategy = await strategyService.createStrategy({
        title: template.title,
        name: template.title, // Explicitly set name field to match title
        description: template.description,
        riskLevel: riskLevel as any,
        type: 'custom', // Mark as custom since it's now owned by the user
        status: 'inactive', // Start as inactive
        selected_pairs: selectedPairs,
        strategy_config: strategyConfig,
        marketType: template.marketType || 'spot', // Pass the market type from the template
        market_type: template.marketType || template.market_type || 'spot' // Also set market_type for database
      });

      // Log the strategy creation for debugging
      logService.log('debug', 'Created strategy from template', {
        templateId,
        strategyId: strategy.id,
        title: template.title,
        name: strategy.name,
        marketType: strategy.marketType || strategy.market_type,
        selectedPairs: strategy.selected_pairs,
        pairsCount: strategy.selected_pairs ? strategy.selected_pairs.length : 0
      }, 'TemplateService');

      // Force a refresh of the strategy sync to ensure it's in the local cache
      await strategySync.initialize();

      // Clear any strategy-related caches
      apiCache.remove('strategies:all');
      apiCache.remove(`strategies:user:${session.user.id}`);

      // Emit events to notify components of the new strategy
      eventBus.emit('strategy:created', strategy);

      // Dispatch DOM event for legacy components
      document.dispatchEvent(new CustomEvent('strategy:created', {
        detail: { strategy }
      }));

      logService.log('info', `Created strategy from template ${templateId}`,
        { strategy }, 'TemplateService');

      return strategy;
    } catch (error) {
      logService.log('error', `Failed to create strategy from template ${templateId}`, error, 'TemplateService');
      throw error;
    }
  }

  async initializeDemoTemplates(): Promise<void> {
    try {
      // Check if we already have templates
      const existingTemplates = await this.getTemplates();

      if (existingTemplates.length > 0) {
        logService.log('info', `Demo templates already exist, skipping initialization (${existingTemplates.length} templates)`,
          null, 'TemplateService');
        return;
      }

      // Create demo templates
      const demoTemplates = await this.generateDemoTemplates();

      // Check if we have templates to create (user might not be logged in)
      if (demoTemplates.length === 0) {
        logService.log('info', 'No templates to create, skipping initialization', null, 'TemplateService');
        return;
      }

      // Save templates to database
      for (const template of demoTemplates) {
        await this.createTemplate(template);
      }

      logService.log('info', `Demo templates initialized successfully (${demoTemplates.length} templates)`,
        null, 'TemplateService');
    } catch (error) {
      logService.log('error', 'Failed to initialize demo templates', error, 'TemplateService');
      throw error;
    }
  }

  private async generateDemoTemplates(): Promise<Partial<StrategyTemplate>[]> {
    const templates = [];
    const riskLevels = ['Ultra Low', 'Low', 'Medium', 'High', 'Ultra High', 'Extreme'];
    const names = [
      'Momentum Surge',
      'Trend Follower Pro',
      'Volatility Breakout',
      'RSI Reversal',
      'MACD Crossover',
      'Bollinger Squeeze'
    ];
    const descriptions = [
      'Capitalizes on strong price momentum to enter trades in the direction of the trend.',
      'Follows established market trends using multiple timeframe analysis for confirmation.',
      'Identifies and trades breakouts from periods of low volatility for explosive moves.',
      'Spots oversold and overbought conditions using RSI for potential market reversals.',
      'Uses MACD crossovers to identify shifts in momentum and trend direction.',
      'Trades the expansion phase after periods of price consolidation within tight Bollinger Bands.'
    ];

    // Get current user ID
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
      logService.log('info', 'Skipping demo template generation - no logged-in user', null, 'TemplateService');
      return [];
    }

    // Create 6 templates with different risk levels
    for (let i = 0; i < 6; i++) {
      // No need to generate metrics anymore

      // Determine market type based on risk level
      let marketType = 'spot';
      const riskLevel = riskLevels[i].toLowerCase();
      if (riskLevel.includes('high') || riskLevel.includes('extreme')) {
        marketType = 'futures';
      } else if (riskLevel.includes('medium')) {
        marketType = 'margin';
      }

      // Create a minimal template with only essential fields
      const template: any = {
        id: uuidv4(),
        title: names[i],
        description: descriptions[i],
        risk_level: riskLevels[i] as any,
        type: 'system_template',
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        marketType: marketType
      };

      templates.push(template);
    }

    return templates;
  }

  // Removed unused generateStrategyConfig method
}

export const templateService = new TemplateService();
