import { EventEmitter } from './event-emitter';
import { strategyTemplateGenerator } from './strategy-template-generator';
import { supabase } from './supabase';
import { logService } from './log-service';
import { config } from './config';

export class TemplateManager extends EventEmitter {
  private static instance: TemplateManager;
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly TEMPLATE_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes - more frequent updates for demo
  private isGenerating = false;

  private constructor() {
    super();
  }

  static getInstance(): TemplateManager {
    if (!TemplateManager.instance) {
      TemplateManager.instance = new TemplateManager();
    }
    return TemplateManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Generate templates immediately on startup
      await this.generateAndSyncTemplates();

      // Setup periodic updates
      this.startPeriodicUpdates();

      // Setup realtime subscriptions for template updates
      this.setupRealtimeSubscriptions();

      // Generate demo templates if no templates exist
      await this.generateDemoTemplatesIfNeeded();

      logService.log('info', 'Template manager initialized successfully', null, 'TemplateManager');
    } catch (error) {
      logService.log('error', 'Failed to initialize template manager', error, 'TemplateManager');
      throw error;
    }
  }

  // Public method to generate demo templates if needed
  async generateDemoTemplatesIfNeeded(): Promise<void> {
    try {
      // Check if any templates exist
      const { data: existingTemplates, error } = await supabase
        .from('strategy_templates')
        .select('id')
        .limit(1);

      if (error) {
        if (error.message && error.message.includes('relation "strategy_templates" does not exist')) {
          logService.log('warn', 'Strategy templates table does not exist, skipping demo template generation', null, 'TemplateManager');
          return;
        }
        throw error;
      }

      // If templates already exist, don't generate demo templates
      if (existingTemplates && existingTemplates.length > 0) {
        logService.log('info', 'Templates already exist, skipping demo template generation', null, 'TemplateManager');
        return;
      }

      // Generate demo templates
      const demoTemplates = [
        {
          title: 'Momentum Surge',
          description: 'Capitalizes on strong price momentum to enter trades in the direction of the trend.',
          risk_level: 'Low',
          riskLevel: 'Low',
          type: 'system_template',
          selected_pairs: ['BTC/USDT'],
          strategy_config: { indicatorType: 'momentum', entryConditions: {}, exitConditions: {} }
        },
        {
          title: 'Trend Follower Pro',
          description: 'Follows established market trends using multiple timeframe analysis for confirmation.',
          risk_level: 'Medium',
          riskLevel: 'Medium',
          type: 'system_template',
          selected_pairs: ['ETH/USDT'],
          strategy_config: { indicatorType: 'trend', entryConditions: {}, exitConditions: {} }
        },
        {
          title: 'Volatility Breakout',
          description: 'Identifies and trades breakouts from periods of low volatility for explosive moves.',
          risk_level: 'High',
          riskLevel: 'High',
          type: 'system_template',
          selected_pairs: ['SOL/USDT'],
          strategy_config: { indicatorType: 'volatility', entryConditions: {}, exitConditions: {} }
        },
        {
          title: 'RSI Reversal',
          description: 'Spots oversold and overbought conditions using RSI for potential market reversals.',
          risk_level: 'Medium',
          riskLevel: 'Medium',
          type: 'system_template',
          selected_pairs: ['BNB/USDT'],
          strategy_config: { indicatorType: 'oscillator', entryConditions: {}, exitConditions: {} }
        },
        {
          title: 'MACD Crossover',
          description: 'Uses MACD crossovers to identify shifts in momentum and trend direction.',
          risk_level: 'Low',
          riskLevel: 'Low',
          type: 'system_template',
          selected_pairs: ['XRP/USDT'],
          strategy_config: { indicatorType: 'momentum', entryConditions: {}, exitConditions: {} }
        },
        {
          title: 'Bollinger Squeeze',
          description: 'Trades the expansion phase after periods of price consolidation within tight Bollinger Bands.',
          risk_level: 'High',
          riskLevel: 'High',
          type: 'system_template',
          selected_pairs: ['ADA/USDT'],
          strategy_config: { indicatorType: 'volatility', entryConditions: {}, exitConditions: {} }
        }
      ];

      // Insert demo templates
      for (const template of demoTemplates) {
        try {
          const { error: insertError } = await supabase
            .from('strategy_templates')
            .insert({
              ...template,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (insertError) {
            logService.log('error', 'Failed to insert demo template', insertError, 'TemplateManager');
          }
        } catch (insertError) {
          logService.log('error', 'Exception inserting demo template', insertError, 'TemplateManager');
        }
      }

      logService.log('info', 'Successfully generated demo templates', null, 'TemplateManager');
    } catch (error) {
      logService.log('error', 'Failed to generate demo templates', error, 'TemplateManager');
    }
  }

  private async generateAndSyncTemplates(): Promise<void> {
    if (this.isGenerating) {
      logService.log('info', 'Template generation already in progress', null, 'TemplateManager');
      return;
    }

    try {
      this.isGenerating = true;

      // Generate new optimized templates
      const templates = await strategyTemplateGenerator.generateOptimizedTemplates();

      // Update templates in database
      try {
        // First, check if the user_id column exists
        let deleteError;
        try {
          const { error } = await supabase
            .from('strategy_templates')
            .delete()
            .is('user_id', null)  // Use .is() instead of .eq() for NULL values
            .eq('type', 'system_template');

          deleteError = error;

          // If we get a column does not exist error, try without the user_id filter
          if (error && error.message && error.message.includes('column "strategy_templates.user_id" does not exist')) {
            logService.log('warn', 'user_id column does not exist in strategy_templates table', null, 'TemplateManager');
            console.warn('user_id column does not exist in strategy_templates table. Using type filter only.');

            // Try again without the user_id filter
            const { error: retryError } = await supabase
              .from('strategy_templates')
              .delete()
              .eq('type', 'system_template');

            if (retryError) {
              deleteError = retryError;
            } else {
              deleteError = null; // Clear the error if retry succeeded
            }
          }
        } catch (error) {
          deleteError = error;
        }

        // Check if the error is because the strategy_templates table doesn't exist
        if (deleteError) {
          if (deleteError.message && deleteError.message.includes('relation "strategy_templates" does not exist')) {
            logService.log('warn', 'Strategy templates table does not exist, skipping template sync', null, 'TemplateManager');
            console.warn('Strategy templates table does not exist. Please run the database setup script.');
            return;
          } else {
            throw deleteError;
          }
        }

        // Now handle the insert, taking into account the possible missing user_id column
        let insertError;
        try {
          // First try with user_id
          const { error } = await supabase
            .from('strategy_templates')
            .insert(templates.map(template => ({
              ...template,
              type: 'system_template',
              user_id: null,  // This will be properly handled as SQL NULL
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })));

          insertError = error;

          // If we get a column does not exist error, try without the user_id
          if (error && error.message && error.message.includes('column "user_id" of relation "strategy_templates" does not exist')) {
            logService.log('warn', 'user_id column does not exist in strategy_templates table', null, 'TemplateManager');
            console.warn('user_id column does not exist in strategy_templates table. Inserting without user_id.');

            // Try again without the user_id
            const { error: retryError } = await supabase
              .from('strategy_templates')
              .insert(templates.map(template => ({
                ...template,
                type: 'system_template',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })));

            if (retryError) {
              insertError = retryError;
            } else {
              insertError = null; // Clear the error if retry succeeded
            }
          }
        } catch (error) {
          insertError = error;
        }

        if (insertError) {
          if (insertError.message && insertError.message.includes('relation "strategy_templates" does not exist')) {
            logService.log('warn', 'Strategy templates table does not exist, skipping template sync', null, 'TemplateManager');
            console.warn('Strategy templates table does not exist. Please run the database setup script.');
            return;
          } else {
            throw insertError;
          }
        }
      } catch (dbError) {
        logService.log('error', 'Database error during template sync', dbError, 'TemplateManager');
        console.error('Database error during template sync:', dbError);
        return;
      }

      this.emit('templatesUpdated', templates);

      logService.log('info', 'Successfully generated and synced templates',
        { count: templates.length },
        'TemplateManager'
      );
    } catch (error) {
      logService.log('error', 'Failed to generate and sync templates', error, 'TemplateManager');
      throw error;
    } finally {
      this.isGenerating = false;
    }
  }

  private startPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(
      () => this.generateAndSyncTemplates(),
      this.TEMPLATE_UPDATE_INTERVAL
    );
  }

  private setupRealtimeSubscriptions(): void {
    supabase
      .channel('strategy_templates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'strategy_templates',
          filter: 'type=eq.system_template'
        },
        (payload) => {
          this.emit('templateChange', payload);
        }
      )
      .subscribe();
  }

  async copyTemplateToUserStrategy(templateId: string, userId: string): Promise<void> {
    try {
      // Get the template
      const { data: template, error: templateError } = await supabase
        .from('strategy_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      // Create new strategy from template
      const { error: strategyError } = await supabase
        .from('strategies')
        .insert({
          user_id: userId,
          title: `Copy of ${template.title}`,
          description: template.description,
          config: template.strategy_config,
          risk_level: template.risk_level,
          status: 'inactive', // Start as inactive for safety
          template_id: templateId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (strategyError) throw strategyError;

      logService.log('info', 'Successfully copied template to user strategy',
        { templateId, userId },
        'TemplateManager'
      );
    } catch (error) {
      logService.log('error', 'Failed to copy template to user strategy', error, 'TemplateManager');
      throw error;
    }
  }

  cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}

export const templateManager = TemplateManager.getInstance();
