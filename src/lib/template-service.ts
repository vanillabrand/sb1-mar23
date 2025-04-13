import { supabase } from './supabase';
import { logService } from './log-service';
import { StrategyTemplate } from './types';
import { v4 as uuidv4 } from 'uuid';
import { strategyService } from './strategy-service';
import { strategySync } from './strategy-sync';
import { eventBus } from './event-bus';

export class TemplateService {
  async getTemplates(): Promise<StrategyTemplate[]> {
    try {
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

      return templates;
    } catch (error) {
      logService.log('error', 'Failed to fetch templates', error, 'TemplateService');
      throw error;
    }
  }

  async getTemplatesForUser(userId?: string): Promise<StrategyTemplate[]> {
    try {
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

      return templates;
    } catch (error) {
      logService.log('error', 'Failed to fetch user templates', error, 'TemplateService');
      throw error;
    }
  }

  async createTemplate(template: Partial<StrategyTemplate>): Promise<StrategyTemplate> {
    try {
      // Create a minimal template object with only the fields we know exist in the database
      // Based on the error messages, we know these fields exist
      const minimalTemplate: any = {
        id: template.id || uuidv4(),
        title: template.title,
        description: template.description,
        type: template.type || 'system_template',
        user_id: template.user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        name: template.title || 'Strategy Template' // Add name field which is required
      };

      // Add risk_level if it exists in the template
      if (template.riskLevel || template.risk_level) {
        minimalTemplate.risk_level = template.riskLevel || template.risk_level;
      }

      // Add assets if they exist in the template
      if (template.assets || (template.selected_pairs && template.selected_pairs.length > 0)) {
        minimalTemplate.assets = template.assets || template.selected_pairs;
      }

      // Log the template we're trying to create
      logService.log('info', 'Creating template with minimal data', minimalTemplate, 'TemplateService');

      const { data, error } = await supabase
        .from('strategy_templates')
        .insert([minimalTemplate])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No data returned from template creation');

      return data;
    } catch (error) {
      logService.log('error', 'Failed to create template', error, 'TemplateService');
      throw error;
    }
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
      const { error } = await supabase
        .from('strategy_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
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
        marketType: template.marketType || 'spot' // Pass the market type from the template
      });

      // Log the strategy creation for debugging
      logService.log('debug', 'Created strategy from template', {
        templateId,
        strategyId: strategy.id,
        title: template.title,
        name: strategy.name
      }, 'TemplateService');

      // Force a refresh of the strategy sync to ensure it's in the local cache
      await strategySync.initialize();

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
