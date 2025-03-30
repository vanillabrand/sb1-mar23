import { supabase } from './supabase';
import { logService } from './log-service';
import { StrategyTemplate } from './types';
import { v4 as uuidv4 } from 'uuid';
import { strategyService } from './strategy-service';

export class TemplateService {
  async getTemplates(): Promise<StrategyTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('strategy_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
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

      return data || [];
    } catch (error) {
      logService.log('error', 'Failed to fetch user templates', error, 'TemplateService');
      throw error;
    }
  }

  async createTemplate(template: Partial<StrategyTemplate>): Promise<StrategyTemplate> {
    try {
      const { data, error } = await supabase
        .from('strategy_templates')
        .insert([{
          ...template,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
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
      const { data, error } = await supabase
        .from('strategy_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Template not found');

      return data;
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

      // Create a new strategy based on the template
      const strategy = await strategyService.createStrategy({
        title: template.title,
        description: template.description,
        riskLevel: template.riskLevel,
        type: 'custom', // Mark as custom since it's now owned by the user
        status: 'inactive', // Start as inactive
        selected_pairs: template.selected_pairs,
        strategy_config: template.strategy_config
      });

      logService.log('info', `Created strategy from template ${templateId}`,
        null, 'TemplateService');

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
        logService.log('info', 'Demo templates already exist, skipping initialization',
          { count: existingTemplates.length }, 'TemplateService');
        return;
      }

      // Create demo templates
      const demoTemplates = this.generateDemoTemplates();

      // Save templates to database
      for (const template of demoTemplates) {
        await this.createTemplate(template);
      }

      logService.log('info', 'Demo templates initialized successfully',
        { count: demoTemplates.length }, 'TemplateService');
    } catch (error) {
      logService.log('error', 'Failed to initialize demo templates', error, 'TemplateService');
      throw error;
    }
  }

  private generateDemoTemplates(): Partial<StrategyTemplate>[] {
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

    // Create 6 templates with different risk levels
    for (let i = 0; i < 6; i++) {
      const performance = Math.round((Math.random() * 30 - 5) * 10) / 10; // -5% to +25%

      templates.push({
        id: uuidv4(),
        title: names[i],
        description: descriptions[i],
        riskLevel: riskLevels[i] as any,
        type: 'system_template',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        performance,
        selected_pairs: ['BTC/USDT'],
        strategy_config: this.generateStrategyConfig(i, i),
        metrics: {
          winRate: Math.round((Math.random() * 35 + 40) * 10) / 10, // 40% to 75%
          profitFactor: Math.round((Math.random() * 1.4 + 1.1) * 100) / 100, // 1.1 to 2.5
          averageProfit: Math.round((Math.random() * 2.5 + 0.5) * 100) / 100, // 0.5% to 3%
          maxDrawdown: Math.round((Math.random() * 15 + 5) * 10) / 10 // 5% to 20%
        }
      });
    }

    return templates;
  }

  private generateStrategyConfig(templateIndex: number, riskIndex: number): any {
    // Base configuration that varies by template type
    const configs = [
      // Momentum Surge
      {
        indicatorType: 'momentum',
        entryConditions: {
          rsiPeriod: 14,
          rsiThreshold: 70 - riskIndex * 5, // Higher risk = lower threshold
          momentumPeriod: 10,
          volumeThreshold: 1.5 + riskIndex * 0.2 // Higher risk = higher volume requirement
        },
        exitConditions: {
          takeProfitPct: 3 + riskIndex * 1.5, // Higher risk = higher take profit
          stopLossPct: 2 + riskIndex * 0.8 // Higher risk = higher stop loss
        },
        timeframe: '15m'
      },

      // Trend Follower Pro
      {
        indicatorType: 'trend',
        entryConditions: {
          fastMAPeriod: 10,
          slowMAPeriod: 50,
          trendStrengthThreshold: 0.5 + riskIndex * 0.1
        },
        exitConditions: {
          takeProfitPct: 5 + riskIndex * 2,
          stopLossPct: 3 + riskIndex * 1
        },
        timeframe: '1h'
      },

      // Volatility Breakout
      {
        indicatorType: 'volatility',
        entryConditions: {
          bbPeriod: 20,
          bbDeviation: 2,
          breakoutThreshold: 0.5 + riskIndex * 0.1
        },
        exitConditions: {
          takeProfitPct: 4 + riskIndex * 2,
          stopLossPct: 2 + riskIndex * 1
        },
        timeframe: '30m'
      },

      // RSI Reversal
      {
        indicatorType: 'oscillator',
        entryConditions: {
          rsiPeriod: 14,
          oversoldThreshold: 30 + riskIndex * 2, // Higher risk = higher threshold
          overboughtThreshold: 70 - riskIndex * 2 // Higher risk = lower threshold
        },
        exitConditions: {
          takeProfitPct: 3 + riskIndex * 1,
          stopLossPct: 2 + riskIndex * 0.5
        },
        timeframe: '1h'
      },

      // MACD Crossover
      {
        indicatorType: 'momentum',
        entryConditions: {
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
          histogramThreshold: 0 + riskIndex * 0.05
        },
        exitConditions: {
          takeProfitPct: 4 + riskIndex * 1.5,
          stopLossPct: 2 + riskIndex * 1
        },
        timeframe: '4h'
      },

      // Bollinger Squeeze
      {
        indicatorType: 'volatility',
        entryConditions: {
          bbPeriod: 20,
          bbDeviation: 2,
          keltnerPeriod: 20,
          keltnerMultiplier: 1.5,
          minSqueezeLength: 10 - riskIndex // Higher risk = shorter squeeze required
        },
        exitConditions: {
          takeProfitPct: 5 + riskIndex * 2,
          stopLossPct: 3 + riskIndex * 1
        },
        timeframe: '1h'
      }
    ];

    // Use modulo to ensure we don't go out of bounds
    const configIndex = templateIndex % configs.length;
    return configs[configIndex];
  }
}

export const templateService = new TemplateService();
