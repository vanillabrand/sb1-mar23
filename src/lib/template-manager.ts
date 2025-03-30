import { EventEmitter } from './event-emitter';
import { strategyTemplateGenerator } from './strategy-template-generator';
import { supabase } from './supabase';
import { logService } from './log-service';
import { config } from './config';

export class TemplateManager extends EventEmitter {
  private static instance: TemplateManager;
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly TEMPLATE_UPDATE_INTERVAL = 15 * 60 * 1000; // 15 minutes
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

      logService.log('info', 'Template manager initialized successfully', null, 'TemplateManager');
    } catch (error) {
      logService.log('error', 'Failed to initialize template manager', error, 'TemplateManager');
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
      
      // Generate new optimized templates
      const templates = await strategyTemplateGenerator.generateOptimizedTemplates();

      // Update templates in database
      const { error: deleteError } = await supabase
        .from('strategy_templates')
        .delete()
        .is('user_id', null)  // Use .is() instead of .eq() for NULL values
        .eq('type', 'system_template');

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from('strategy_templates')
        .insert(templates.map(template => ({
          ...template,
          type: 'system_template',
          user_id: null,  // This will be properly handled as SQL NULL
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })));

      if (insertError) throw insertError;

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
