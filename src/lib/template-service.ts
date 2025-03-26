import { logService } from './log-service';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { AIService } from './ai-service';
import type { StrategyTemplate, RiskLevel } from './types';
import { marketMonitor } from './market-monitor';

class TemplateService {
  private static instance: TemplateService;
  private templates: StrategyTemplate[] = [];
  private lastGenerationTime = 0;
  private readonly GENERATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly TEMPLATE_COUNT = 6;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private generationInProgress = false;

  private constructor() {
    this.startPeriodicCheck();
  }

  static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  private startPeriodicCheck() {
    setInterval(() => {
      this.checkForTemplateUpdates();
    }, 60 * 60 * 1000); // Check every hour
  }

  private async checkForTemplateUpdates() {
    try {
      const now = Date.now();
      if (now - this.lastGenerationTime >= this.GENERATION_INTERVAL) {
        await this.generateDailyTemplates();
      }
    } catch (error) {
      logService.log('error', 'Error checking for template updates', error, 'TemplateService');
    }
  }

  private async generateDailyTemplates(): Promise<void> {
    if (this.generationInProgress) return;
    
    try {
      this.generationInProgress = true;
      logService.log('info', 'Starting daily template generation', null, 'TemplateService');

      // Generate templates based on market conditions
      const templates = await this.generateTemplatesForMarket();

      // Save templates to database
      await this.saveTemplates(templates);

      // Update local cache
      this.templates = templates;
      this.lastGenerationTime = Date.now();

      logService.log('info', `Generated ${templates.length} daily templates`, null, 'TemplateService');
    } catch (error) {
      logService.log('error', 'Failed to generate daily templates', error, 'TemplateService');
      throw error;
    } finally {
      this.generationInProgress = false;
    }
  }

  private async generateTemplatesForMarket(): Promise<StrategyTemplate[]> {
    // Get market conditions from monitored assets
    const marketConditions = {
      trend: 'neutral',
      volatility: 'medium',
      majorAssets: {} as Record<string, any>,
      globalMetrics: {
        cryptoFearGreedIndex: number,
        btcDominance: number,
        totalMarketCap: number,
        volume24h: number
      },
      correlations: {
        btcCorrelation: number,
        sectorCorrelation: number
      },
      marketPhase: 'accumulation' | 'markup' | 'distribution' | 'markdown'
    };

    // Get data for major assets
    const majorAssets = ['BTC_USDT', 'ETH_USDT'];
    for (const asset of majorAssets) {
      const state = marketMonitor.getMarketState(asset);
      const data = marketMonitor.getHistoricalData(asset, 100);
      
      if (state && data.length > 0) {
        marketConditions.majorAssets[asset] = {
          state,
          currentPrice: data[data.length - 1].close,
          trend: state.trend,
          volatility: state.volatility
        };
      }
    }

    // Determine overall market trend and volatility based on major assets
    const trends = Object.values(marketConditions.majorAssets).map(asset => asset.state.trend);
    const volatilities = Object.values(marketConditions.majorAssets).map(asset => asset.state.volatility);
    
    marketConditions.trend = trends.every(t => t === 'bullish') ? 'bullish' :
                            trends.every(t => t === 'bearish') ? 'bearish' : 'mixed';
    
    marketConditions.volatility = volatilities.includes('high') ? 'high' :
                                 volatilities.every(v => v === 'low') ? 'low' : 'medium';
    const configurations = this.getBaseConfigurations();
    const templates: StrategyTemplate[] = [];

    for (const config of configurations) {
      try {
        const riskLevel = config.riskLevels[
          Math.floor(Math.random() * config.riskLevels.length)
        ] as RiskLevel;

        // Enhanced prompt with market conditions
        const prompt = `Generate a detailed cryptocurrency trading strategy with these parameters:
Description: ${config.description}
Risk Level: ${riskLevel}
Current Market Conditions:
- Overall Trend: ${marketConditions.trend}
- Volatility: ${marketConditions.volatility}
- Major Asset Performance: ${JSON.stringify(marketConditions.majorAssets)}

Requirements:
1. Strategy must be specifically adapted to current market conditions
2. Include precise entry/exit rules
3. Specify position sizing and risk management
4. Define clear technical indicators and their thresholds
5. Include market condition checks before entry
6. Return strategy in strict JSON format

Return ONLY a JSON object with no additional text.`;

        const strategyConfig = await AIService.generateStrategy(
          prompt,
          riskLevel,
          {
            timeframe: config.timeframe,
            marketType: riskLevel === 'High' ? 'futures' : 'spot',
            marketConditions // Pass market conditions to AI service
          }
        );

        templates.push({
          ...strategyConfig,
          lastUpdated: Date.now()
        });
      } catch (error) {
        logService.log('error', `Failed to generate template for config: ${config.description}`, error, 'TemplateService');
      }
    }
    return templates;
  }

  private getBaseConfigurations(): { type: string, riskLevels: RiskLevel[], timeframe: string, description: string }[] {
    return [
      {
        type: 'trend',
        riskLevels: ['Low', 'Medium'] as RiskLevel[],
        timeframe: '1h',
        description: 'Trend following strategy optimized for current market conditions'
      },
      {
        type: 'momentum',
        riskLevels: ['Medium', 'High'] as RiskLevel[],
        timeframe: '5m',
        description: 'Momentum-based strategy capturing short-term price movements'
      },
      {
        type: 'reversal',
        riskLevels: ['Medium', 'High'] as RiskLevel[],
        timeframe: '1h',
        description: 'Counter-trend strategy for market reversals'
      }
    ];
  }

  private async saveTemplates(templates: StrategyTemplate[]): Promise<void> {
    try {
      // Delete existing templates
      const { error: deleteError } = await supabase
        .from('strategy_templates')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) throw deleteError;

      // Insert new templates
      const { error: insertError } = await supabase
        .from('strategy_templates')
        .insert(templates);

      if (insertError) throw insertError;

      logService.log('info', `Saved ${templates.length} templates to database`, null, 'TemplateService');
    } catch (error) {
      logService.log('error', 'Failed to save templates', error, 'TemplateService');
      throw error;
    }
  }

  async getTemplatesForUser(): Promise<StrategyTemplate[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Get templates from database
      const { data: templates, error } = await supabase
        .from('strategy_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Update cache
      this.templates = templates || [];
      return this.templates;
    } catch (error) {
      logService.log('error', 'Failed to get templates', error, 'TemplateService');
      return this.templates; // Return cached templates as fallback
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      try {
        // Load existing templates
        const { data: templates } = await supabase
          .from('strategy_templates')
          .select('*')
          .order('created_at', { ascending: false });

        if (templates && templates.length > 0) {
          this.templates = templates;
          this.lastGenerationTime = new Date(templates[0].created_at).getTime();
        } else {
          // Generate initial templates if none exist
          await this.generateDailyTemplates();
        }

        this.initialized = true;
        logService.log('info', 'Template service initialized successfully', null, 'TemplateService');
      } catch (error) {
        logService.log('error', 'Failed to initialize template service', error, 'TemplateService');
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  async createStrategyFromTemplate(templateId: string): Promise<any> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get template
      const template = this.templates.find(t => t.id === templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Create strategy using template configuration
      const { data: strategy, error } = await supabase
        .from('strategies')
        .insert({
          title: template.title,
          description: template.description,
          risk_level: template.risk_level,
          type: 'template',
          status: 'inactive',
          strategy_config: template.config,
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      if (!strategy) throw new Error('Failed to create strategy');

      logService.log('info', 'Created strategy from template', { templateId, strategy }, 'TemplateService');
      return strategy;
    } catch (error) {
      logService.log('error', 'Failed to create strategy from template', error, 'TemplateService');
      throw error;
    }
  }

  async getTemplates(): Promise<StrategyTemplate[]> {
    return this.templates;
  }

  cleanup() {
    this.templates = [];
    this.lastGenerationTime = 0;
    this.initialized = false;
  }
}

export const templateService = TemplateService.getInstance();
