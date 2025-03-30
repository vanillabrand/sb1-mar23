import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';
import { logService } from './log-service';
import { marketService } from './market-service';
import { technicalIndicators } from './technical-indicators';
import { templateService } from './template-service';
import { strategyService } from './strategy-service';
import type { RiskLevel, Strategy, StrategyTemplate } from './types';

// Using StrategyTemplate from types.ts

// Strategy template names and descriptions
const TEMPLATE_NAMES = [
  'Momentum Surge',
  'Trend Follower Pro',
  'Volatility Breakout',
  'RSI Reversal',
  'MACD Crossover',
  'Bollinger Squeeze',
  'Golden Cross Hunter',
  'Support & Resistance',
  'Volume Spike Detector',
  'Fibonacci Retracement'
];

const TEMPLATE_DESCRIPTIONS = [
  'Capitalizes on strong price momentum to enter trades in the direction of the trend.',
  'Follows established market trends using multiple timeframe analysis for confirmation.',
  'Identifies and trades breakouts from periods of low volatility for explosive moves.',
  'Spots oversold and overbought conditions using RSI for potential market reversals.',
  'Uses MACD crossovers to identify shifts in momentum and trend direction.',
  'Trades the expansion phase after periods of price consolidation within tight Bollinger Bands.',
  'Identifies long-term bullish trends when short-term moving averages cross above long-term ones.',
  'Trades bounces from key support and resistance levels with high probability setups.',
  'Detects unusual volume spikes that often precede significant price movements.',
  'Uses Fibonacci retracement levels to identify potential reversal points in trending markets.'
];

// Trading pairs to use for templates
const TRADING_PAIRS = [
  'BTC/USDT',
  'ETH/USDT',
  'SOL/USDT',
  'BNB/USDT',
  'XRP/USDT',
  'ADA/USDT'
];

// Risk levels for templates
const RISK_LEVELS: RiskLevel[] = [
  'Ultra Low',
  'Low',
  'Medium',
  'High',
  'Ultra High',
  'Extreme'
];

export class TemplateGenerator {
  private lastGenerationTime: number = 0;
  private readonly GENERATION_INTERVAL = 3600000; // 1 hour in milliseconds

  constructor() {
    // Initialize the generator
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Check if user is logged in before generating templates
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        logService.log('info', 'Skipping template generation - no logged-in user', null, 'TemplateGenerator');
        return;
      }

      // Check if we need to generate templates on startup
      const templates = await templateService.getTemplates();
      const systemTemplates = templates.filter(t => t.type === 'system_template');

      if (systemTemplates.length < 6) {
        await this.generateTemplates();
      } else {
        // Schedule next generation
        const now = Date.now();
        const oldestTemplate = systemTemplates.reduce(
          (oldest, current) => {
            const currentDate = new Date(current.updated_at).getTime();
            return currentDate < oldest ? currentDate : oldest;
          },
          Date.now()
        );

        const timeSinceLastGeneration = now - oldestTemplate;
        if (timeSinceLastGeneration >= this.GENERATION_INTERVAL) {
          await this.generateTemplates();
        } else {
          const timeToNextGeneration = this.GENERATION_INTERVAL - timeSinceLastGeneration;
          setTimeout(() => this.generateTemplates(), timeToNextGeneration);
        }
      }
    } catch (error) {
      logService.log('error', 'Failed to initialize template generator', error, 'TemplateGenerator');
    }
  }

  public async generateTemplates(): Promise<void> {
    try {
      // Check if user is logged in before generating templates
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        logService.log('info', 'Skipping template generation - no logged-in user', null, 'TemplateGenerator');
        return;
      }

      const now = Date.now();

      // Only generate templates once per hour
      if (now - this.lastGenerationTime < this.GENERATION_INTERVAL) {
        logService.log('info', 'Skipping template generation - too soon since last generation', null, 'TemplateGenerator');
        return;
      }

      logService.log('info', 'Starting template generation', null, 'TemplateGenerator');

      // Delete existing system templates
      const existingTemplates = await templateService.getTemplates();
      const systemTemplates = existingTemplates.filter(t => t.type === 'system_template');

      for (const template of systemTemplates) {
        await templateService.deleteTemplate(template.id);
      }

      // Generate 6 new templates
      const templates: Partial<StrategyTemplate>[] = [];

      for (let i = 0; i < 6; i++) {
        const template = await this.createRandomTemplate(i);
        templates.push(template);
      }

      // Save templates to database
      for (const template of templates) {
        await templateService.createTemplate(template);
      }

      this.lastGenerationTime = now;

      // Schedule next generation
      setTimeout(() => this.generateTemplates(), this.GENERATION_INTERVAL);

      logService.log('info', 'Template generation completed successfully', null, 'TemplateGenerator');
    } catch (error) {
      logService.log('error', 'Failed to generate templates', error, 'TemplateGenerator');
    }
  }

  private async createRandomTemplate(index: number): Promise<Partial<StrategyTemplate>> {
    // Use modulo to ensure we don't go out of bounds if we have fewer names than needed
    const nameIndex = index % TEMPLATE_NAMES.length;
    const descIndex = index % TEMPLATE_DESCRIPTIONS.length;
    const pairIndex = index % TRADING_PAIRS.length;
    const riskIndex = index % RISK_LEVELS.length;

    // Get current market data for the selected pair
    const pair = TRADING_PAIRS[pairIndex];

    // Generate random win rate between 40% and 75%
    const winRate = Math.round((Math.random() * 35 + 40) * 10) / 10;

    // Generate random profit factor between 1.1 and 2.5
    const profitFactor = Math.round((Math.random() * 1.4 + 1.1) * 100) / 100;

    // Generate random average profit between 0.5% and 3%
    const averageProfit = Math.round((Math.random() * 2.5 + 0.5) * 100) / 100;

    // Generate random max drawdown between 5% and 20%
    const maxDrawdown = Math.round((Math.random() * 15 + 5) * 10) / 10;

    // Create strategy config based on the template type
    const strategyConfig = this.generateStrategyConfig(nameIndex, riskIndex);

    // Add metrics to strategy config to avoid database schema issues
    strategyConfig.metrics = {
      winRate,
      profitFactor,
      averageProfit,
      maxDrawdown
    };

    // Get current user ID
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    // Create a minimal template with only essential fields
    const template: any = {
      id: uuidv4(),
      title: TEMPLATE_NAMES[nameIndex],
      description: TEMPLATE_DESCRIPTIONS[descIndex],
      risk_level: RISK_LEVELS[riskIndex],
      type: 'system_template',
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return template;
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

  public async createStrategyFromTemplate(templateId: string, userId: string): Promise<Strategy> {
    try {
      // Get the template
      const templates = await templateService.getTemplates();
      const template = templates.find(t => t.id === templateId);

      if (!template) {
        throw new Error(`Template with ID ${templateId} not found`);
      }

      // Get the risk level from template
      const riskLevel = template.riskLevel || template.risk_level || 'Medium';

      // Create a new strategy based on the template
      const strategy = await strategyService.createStrategy({
        title: template.title,
        description: template.description,
        riskLevel: riskLevel as any,
        type: 'custom', // Mark as custom since it's now owned by the user
        status: 'inactive', // Start as inactive
        selected_pairs: ['BTC/USDT'],
        strategy_config: {
          indicatorType: 'momentum',
          entryConditions: {},
          exitConditions: {}
        }
      });

      logService.log('info', `Created strategy from template ${templateId}`, { strategyId: strategy.id, userId }, 'TemplateGenerator');

      return strategy;
    } catch (error) {
      logService.log('error', `Failed to create strategy from template ${templateId}`, error, 'TemplateGenerator');
      throw error;
    }
  }

  public async copyTemplateToStrategy(templateId: string): Promise<Strategy> {
    try {
      // Get the template
      const template = await templateService.getTemplates().then(
        templates => templates.find(t => t.id === templateId)
      );

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

      // Create a new strategy based on the template
      const strategy = await strategyService.createStrategy({
        title: template.title,
        description: template.description,
        riskLevel: riskLevel as any,
        type: 'custom', // Mark as custom since it's now owned by the user
        status: 'inactive', // Start as inactive
        selected_pairs: ['BTC/USDT'],
        strategy_config: {
          indicatorType: 'momentum',
          entryConditions: {},
          exitConditions: {}
        }
      });

      logService.log('info', `Created strategy from template ${templateId}`,
        { strategyId: strategy.id, userId: session.user.id }, 'TemplateGenerator');

      return strategy;
    } catch (error) {
      logService.log('error', `Failed to create strategy from template`, error, 'TemplateGenerator');
      throw error;
    }
  }
}

export const templateGenerator = new TemplateGenerator();
