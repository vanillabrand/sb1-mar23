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

  /**
   * Public method to manually clear and regenerate templates
   * This can be called from the UI to force a refresh of the templates
   */
  async clearAndRegenerateTemplates(): Promise<void> {
    try {
      logService.log('info', 'Manually clearing and regenerating templates', null, 'TemplateManager');
      await this.generateAndSyncTemplates();
      logService.log('info', 'Successfully cleared and regenerated templates', null, 'TemplateManager');
    } catch (error) {
      logService.log('error', 'Failed to clear and regenerate templates', error, 'TemplateManager');
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

      // Insert demo templates with error handling for missing columns
      for (const template of demoTemplates) {
        try {
          const templateData = {
            title: template.title,
            description: template.description,
            type: 'system_template',
            status: 'active',
            risk_level: template.riskLevel,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // Only include optional fields if they exist in the template
            ...(template.assets && { assets: template.assets }),
            ...(template.timeframe && { timeframe: template.timeframe }),
            ...(template.entryConditions && { entry_conditions: template.entryConditions }),
            ...(template.entry_conditions && { entry_conditions: template.entry_conditions }),
            ...(template.exitConditions && { exit_conditions: template.exitConditions }),
            ...(template.riskManagement && { risk_management: template.riskManagement })
          };

          const { error: insertError } = await supabase
            .from('strategy_templates')
            .insert([templateData]);

          if (insertError) {
            // If error is about missing column, log warning and continue
            if (insertError.message && insertError.message.includes('column') && insertError.message.includes('does not exist')) {
              logService.log('warn', `Column missing in strategy_templates table: ${insertError.message}`, null, 'TemplateManager');
              continue;
            }
            throw insertError;
          }

          logService.log('info', `Successfully inserted demo template: ${template.title}`, null, 'TemplateManager');
        } catch (error) {
          logService.log('error', `Failed to insert demo template: ${template.title}`, error, 'TemplateManager');
        }
      }
    } catch (error) {
      logService.log('error', 'Database error during template sync', error, 'TemplateManager');
      throw error;
    }
  }

  private async generateAndSyncTemplates(): Promise<void> {
    if (this.isGenerating) {
      logService.log('info', 'Template generation already in progress', null, 'TemplateManager');
      return;
    }

    try {
      this.isGenerating = true;

      // Clear existing system templates before generating new ones
      try {
        logService.log('info', 'Clearing existing system templates', null, 'TemplateManager');
        const { error: deleteError } = await supabase
          .from('strategy_templates')
          .delete()
          .eq('type', 'system_template');

        if (deleteError) {
          if (deleteError.message && deleteError.message.includes('relation "strategy_templates" does not exist')) {
            logService.log('warn', 'Strategy templates table does not exist, skipping template deletion', null, 'TemplateManager');
          } else {
            logService.log('error', 'Failed to clear existing system templates', deleteError, 'TemplateManager');
          }
        } else {
          logService.log('info', 'Successfully cleared existing system templates', null, 'TemplateManager');
        }
      } catch (deleteError) {
        logService.log('error', 'Exception while clearing existing system templates', deleteError, 'TemplateManager');
      }

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
              updated_at: new Date().toISOString(),
              name: template.title || template.name || 'Strategy Template', // Ensure name field is included
              // Convert camelCase to snake_case for database columns
              ...(template.entryConditions && { entry_conditions: template.entryConditions }),
              ...(template.exitConditions && { exit_conditions: template.exitConditions }),
              ...(template.riskManagement && { risk_management: template.riskManagement })
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
                updated_at: new Date().toISOString(),
                name: template.title || template.name || 'Strategy Template', // Ensure name field is included
                // Convert camelCase to snake_case for database columns
                ...(template.entryConditions && { entry_conditions: template.entryConditions }),
                ...(template.exitConditions && { exit_conditions: template.exitConditions }),
                ...(template.riskManagement && { risk_management: template.riskManagement })
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
