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

      // Generate demo templates - only use risk_level, not riskLevel
      const demoTemplates = [
        {
          title: 'Momentum Surge',
          name: 'Momentum Surge',
          description: 'Capitalizes on strong price momentum to enter trades in the direction of the trend.',
          risk_level: 'Low',
          type: 'system_template',
          selected_pairs: ['BTC/USDT'],
          strategy_config: {
            indicatorType: 'momentum',
            timeframe: '1h',
            entryConditions: {
              momentumThreshold: 0.5,
              volumeIncrease: 20,
              minPriceChange: 1.5,
              direction: 'both',
              confirmationCandles: 3,
              indicators: {
                rsi: { period: 14, overbought: 70, oversold: 30 },
                macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }
              }
            },
            exitConditions: {
              takeProfitPercentage: 3.5,
              stopLossPercentage: 2.0,
              trailingStopPercentage: 1.0,
              maxDurationHours: 48,
              exitOnMomentumReversal: true,
              rsiExitLevel: 50
            },
            riskManagement: {
              positionSizePercentage: 5,
              maxOpenTrades: 3,
              maxDailyLoss: 5
            }
          }
        },
        {
          title: 'Trend Follower Pro',
          name: 'Trend Follower Pro',
          description: 'Follows established market trends using multiple timeframe analysis for confirmation.',
          risk_level: 'Medium',
          type: 'system_template',
          selected_pairs: ['ETH/USDT'],
          strategy_config: {
            indicatorType: 'trend',
            timeframe: '4h',
            entryConditions: {
              primaryTimeframe: '4h',
              confirmationTimeframe: '1d',
              direction: 'both',
              minTrendStrength: 70,
              indicators: {
                ema: { shortPeriod: 20, longPeriod: 50, direction: 'cross' },
                adx: { period: 14, threshold: 25 },
                supertrend: { period: 10, multiplier: 3 }
              }
            },
            exitConditions: {
              takeProfitPercentage: 8.0,
              stopLossPercentage: 4.0,
              trailingStopPercentage: 2.0,
              maxDurationHours: 120,
              exitOnTrendReversal: true,
              exitOnEMACrossover: true
            },
            riskManagement: {
              positionSizePercentage: 10,
              maxOpenTrades: 5,
              maxDailyLoss: 8
            }
          }
        },
        {
          title: 'Volatility Breakout',
          name: 'Volatility Breakout',
          description: 'Identifies and trades breakouts from periods of low volatility for explosive moves.',
          risk_level: 'High',
          type: 'system_template',
          selected_pairs: ['SOL/USDT'],
          strategy_config: {
            indicatorType: 'volatility',
            timeframe: '15m',
            entryConditions: {
              volatilityPercentile: 20,
              breakoutPercentage: 3.0,
              volumeMultiplier: 2.5,
              direction: 'both',
              consolidationPeriod: 24,
              indicators: {
                bollinger: { period: 20, deviations: 2.0, squeezeThreshold: 0.1 },
                atr: { period: 14, multiplier: 1.5 },
                keltnerChannels: { period: 20, multiplier: 1.5 }
              }
            },
            exitConditions: {
              takeProfitPercentage: 15.0,
              stopLossPercentage: 7.0,
              trailingStopPercentage: 3.5,
              maxDurationHours: 24,
              exitOnVolatilityContraction: true,
              atrMultiplierExit: 2.0
            },
            riskManagement: {
              positionSizePercentage: 15,
              maxOpenTrades: 3,
              maxDailyLoss: 12
            }
          }
        },
        {
          title: 'RSI Reversal',
          name: 'RSI Reversal',
          description: 'Spots oversold and overbought conditions using RSI for potential market reversals.',
          risk_level: 'Medium',
          type: 'system_template',
          selected_pairs: ['BNB/USDT'],
          strategy_config: {
            indicatorType: 'oscillator',
            timeframe: '2h',
            entryConditions: {
              overboughtLevel: 75,
              oversoldLevel: 25,
              confirmationCandles: 2,
              direction: 'both',
              indicators: {
                rsi: { period: 14, smoothing: 3 },
                stochastic: { kPeriod: 14, dPeriod: 3, slowing: 3, overbought: 80, oversold: 20 },
                priceAction: { confirmationNeeded: true }
              }
            },
            exitConditions: {
              takeProfitPercentage: 5.0,
              stopLossPercentage: 3.0,
              trailingStopPercentage: 1.5,
              maxDurationHours: 36,
              rsiCenterCrossExit: true,
              exitLevel: 50
            },
            riskManagement: {
              positionSizePercentage: 8,
              maxOpenTrades: 4,
              maxDailyLoss: 7
            }
          }
        },
        {
          title: 'MACD Crossover',
          name: 'MACD Crossover',
          description: 'Uses MACD crossovers to identify shifts in momentum and trend direction.',
          risk_level: 'Low',
          type: 'system_template',
          selected_pairs: ['XRP/USDT'],
          strategy_config: {
            indicatorType: 'momentum',
            timeframe: '6h',
            entryConditions: {
              signalCrossover: true,
              histogramReversal: true,
              direction: 'both',
              confirmationCandles: 1,
              indicators: {
                macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
                ema: { period: 200, respectTrend: true },
                volume: { minIncrease: 10 }
              }
            },
            exitConditions: {
              takeProfitPercentage: 4.0,
              stopLossPercentage: 2.5,
              trailingStopPercentage: 1.2,
              maxDurationHours: 72,
              exitOnOppositeSignal: true,
              macdHistogramReversal: true
            },
            riskManagement: {
              positionSizePercentage: 6,
              maxOpenTrades: 5,
              maxDailyLoss: 5
            }
          }
        },
        {
          title: 'Bollinger Squeeze',
          name: 'Bollinger Squeeze',
          description: 'Trades the expansion phase after periods of price consolidation within tight Bollinger Bands.',
          risk_level: 'High',
          type: 'system_template',
          selected_pairs: ['ADA/USDT'],
          strategy_config: {
            indicatorType: 'volatility',
            timeframe: '30m',
            entryConditions: {
              bandwidthThreshold: 0.1,
              expansionPercentage: 2.5,
              direction: 'both',
              minimumContractionPeriod: 12,
              indicators: {
                bollinger: { period: 20, deviations: 2.0 },
                keltner: { period: 20, atrMultiplier: 1.5 },
                momentum: { indicator: 'rsi', period: 14, threshold: 50 }
              }
            },
            exitConditions: {
              takeProfitPercentage: 12.0,
              stopLossPercentage: 6.0,
              trailingStopPercentage: 3.0,
              maxDurationHours: 48,
              bandwidthExpansionExit: 2.0,
              priceRetracementExit: 0.5
            },
            riskManagement: {
              positionSizePercentage: 12,
              maxOpenTrades: 3,
              maxDailyLoss: 10
            }
          }
        }
      ];

      // Insert demo templates
      for (const template of demoTemplates) {
        try {
          // First try with both risk_level and riskLevel
          const { error: insertError } = await supabase
            .from('strategy_templates')
            .insert({
              ...template,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (insertError) {
            logService.log('error', 'Failed to insert demo template', insertError, 'TemplateManager');

            // If the error is related to riskLevel, try without it
            if (insertError.message && insertError.message.includes('riskLevel')) {
              const simplifiedTemplate = { ...template };
              delete simplifiedTemplate.riskLevel;

              const { error: retryError } = await supabase
                .from('strategy_templates')
                .insert({
                  ...simplifiedTemplate,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });

              if (retryError) {
                logService.log('error', 'Failed to insert simplified demo template', retryError, 'TemplateManager');
              } else {
                logService.log('info', 'Successfully inserted simplified demo template', null, 'TemplateManager');
              }
            }
          } else {
            logService.log('info', 'Successfully inserted demo template', null, 'TemplateManager');
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
              updated_at: new Date().toISOString(),
              name: template.title || template.name || 'Strategy Template' // Ensure name field is included
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
                name: template.title || template.name || 'Strategy Template' // Ensure name field is included
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
