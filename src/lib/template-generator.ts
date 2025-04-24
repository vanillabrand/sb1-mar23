import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';
import { logService } from './log-service';
import { marketService } from './market-service';
import { technicalIndicators } from './technical-indicators';
import { templateService } from './template-service';
import { strategyService } from './strategy-service';
import { strategySync } from './strategy-sync';
import { eventBus } from './event-bus';
import { strategyMetricsCalculator } from './strategy-metrics-calculator';
import { detectMarketType, normalizeMarketType } from './market-type-detection';
import type { RiskLevel, Strategy, StrategyTemplate, MarketType } from './types';

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
  'Medium Low',
  'Medium',
  'Medium High',
  'High',
  'Very High',
  'Ultra High',
  'Extreme',
  'Maximum'
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

    // Create a temporary strategy object to calculate metrics
    const tempStrategy = {
      riskLevel: RISK_LEVELS[riskIndex],
      strategy_config: this.generateStrategyConfig(nameIndex, riskIndex)
    };

    // Calculate realistic metrics using our calculator
    const winRate = strategyMetricsCalculator.calculateWinRate(tempStrategy as any);
    const averageProfit = strategyMetricsCalculator.calculatePotentialProfit(tempStrategy as any);

    // Generate profit factor based on win rate and average profit
    const profitFactor = Math.round((winRate / 50 * averageProfit / 8) * 100) / 100 + 1;

    // Generate max drawdown based on risk level
    const maxDrawdown = Math.round((5 + riskIndex * 2.5) * 10) / 10;

    // Create strategy config based on the template type
    const strategyConfig = this.generateStrategyConfig(nameIndex, riskIndex);

    // Add metrics to strategy config to avoid database schema issues
    strategyConfig.metrics = {
      winRate,
      profitFactor,
      averageProfit,
      potentialProfit: averageProfit, // Add potentialProfit as an alias for averageProfit
      maxDrawdown,
      takeProfit: averageProfit // Ensure takeProfit is available for UI display
    };

    // Get current user ID
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    // Determine market type based on template name and risk level
    let marketType: MarketType = 'spot';

    // Higher risk levels use more advanced market types
    if (riskIndex >= 7) { // Ultra High, Extreme, Maximum
      marketType = 'futures';
    } else if (riskIndex >= 3) { // Medium, Medium High, High, Very High
      marketType = 'margin';
    }

    // Certain strategy types suggest specific market types
    const templateName = TEMPLATE_NAMES[nameIndex].toLowerCase();
    if (templateName.includes('volatility') || templateName.includes('momentum') || templateName.includes('breakout')) {
      // These strategies often work better with leverage
      marketType = riskIndex >= 5 ? 'futures' : 'margin';
    }

    // Create a minimal template with only essential fields
    const template: any = {
      id: uuidv4(),
      title: TEMPLATE_NAMES[nameIndex],
      description: TEMPLATE_DESCRIPTIONS[descIndex],
      risk_level: RISK_LEVELS[riskIndex],
      type: 'system_template',
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      marketType: marketType,
      metrics: {
        winRate: winRate,
        potentialProfit: averageProfit,
        averageProfit: averageProfit,
        profitFactor: profitFactor,
        maxDrawdown: maxDrawdown
      },
      strategy_config: strategyConfig
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

      // Determine market type from template or detect from description
      let marketType: MarketType;
      if (template.marketType) {
        marketType = normalizeMarketType(template.marketType);
      } else if (template.market_type) {
        marketType = normalizeMarketType(template.market_type);
      } else {
        // Detect from description
        marketType = detectMarketType(template.description);
      }

      // Create a new strategy based on the template
      const strategy = await strategyService.createStrategy({
        title: template.title,
        name: template.title, // Explicitly set name field to match title
        description: template.description,
        riskLevel: riskLevel as any,
        type: 'custom', // Mark as custom since it's now owned by the user
        status: 'inactive', // Start as inactive
        selected_pairs: ['BTC/USDT'],
        marketType: marketType,
        strategy_config: {
          indicatorType: 'momentum',
          entryConditions: {},
          exitConditions: {}
        }
      });

      // Log the strategy creation for debugging
      logService.log('debug', 'Created strategy from template in createStrategyFromTemplate', {
        templateId,
        strategyId: strategy.id,
        title: template.title,
        name: strategy.name
      }, 'TemplateGenerator');

      logService.log('info', `Created strategy from template ${templateId}`, { strategyId: strategy.id, userId }, 'TemplateGenerator');

      return strategy;
    } catch (error) {
      logService.log('error', `Failed to create strategy from template ${templateId}`, error, 'TemplateGenerator');
      throw error;
    }
  }

  public async copyTemplateToStrategy(templateId: string): Promise<Strategy> {
    try {
      console.log(`TemplateGenerator: Starting to copy template ${templateId} to strategy`);

      // Get the template
      const templates = await templateService.getTemplates();
      console.log(`TemplateGenerator: Found ${templates.length} templates`);

      const template = templates.find(t => t.id === templateId);

      if (!template) {
        console.error(`TemplateGenerator: Template with ID ${templateId} not found`);
        throw new Error(`Template with ID ${templateId} not found`);
      }

      console.log(`TemplateGenerator: Found template: ${template.title}`);

      // Get current user
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user?.id) {
        console.error('TemplateGenerator: No authenticated session found');
        throw new Error('No authenticated session found');
      }

      console.log(`TemplateGenerator: User authenticated: ${session.user.id}`);

      // Get the risk level from template
      const riskLevel = template.riskLevel || template.risk_level || 'Medium';
      console.log(`TemplateGenerator: Using risk level: ${riskLevel}`);

      // Determine market type from template or detect from description
      let marketType: MarketType;
      if (template.marketType) {
        marketType = normalizeMarketType(template.marketType);
      } else if (template.market_type) {
        marketType = normalizeMarketType(template.market_type);
      } else {
        // Detect from description
        marketType = detectMarketType(template.description);
      }
      console.log(`TemplateGenerator: Using market type: ${marketType}`);

      // Get selected pairs from template or use default
      const selectedPairs = template.selected_pairs || ['BTC/USDT'];
      console.log(`TemplateGenerator: Using selected pairs: ${selectedPairs.join(', ')}`);

      // Get strategy config from template or use default
      const strategyConfig = template.strategy_config || {
        indicatorType: 'momentum',
        entryConditions: {},
        exitConditions: {}
      };
      console.log(`TemplateGenerator: Using strategy config with indicator type: ${strategyConfig.indicatorType || 'default'}`);

      // Create a new strategy based on the template
      console.log('TemplateGenerator: Creating strategy with data:', {
        title: template.title,
        name: template.title,
        description: template.description,
        riskLevel,
        marketType,
        selectedPairs
      });

      // Create strategy directly with supabase to avoid any potential issues
      const newStrategy = {
        id: uuidv4(),
        user_id: session.user.id,
        title: template.title,
        name: template.title, // Explicitly set name field to match title
        description: template.description,
        risk_level: riskLevel,
        type: 'custom', // Mark as custom since it's now owned by the user
        status: 'inactive', // Start as inactive
        selected_pairs: selectedPairs,
        market_type: marketType,
        strategy_config: strategyConfig,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('TemplateGenerator: Inserting strategy into database');
      const { data: strategy, error: insertError } = await supabase
        .from('strategies')
        .insert(newStrategy)
        .select()
        .single();

      if (insertError) {
        console.error('TemplateGenerator: Error inserting strategy:', insertError);
        throw insertError;
      }

      if (!strategy) {
        console.error('TemplateGenerator: No strategy returned after insert');
        throw new Error('Failed to create strategy - no data returned');
      }

      console.log(`TemplateGenerator: Strategy created with ID: ${strategy.id}`);

      // Log the strategy creation for debugging
      logService.log('debug', 'Created strategy from template in copyTemplateToStrategy', {
        templateId,
        strategyId: strategy.id,
        title: template.title,
        name: strategy.name
      }, 'TemplateGenerator');

      // Emit events to update UI immediately
      console.log('TemplateGenerator: Emitting strategy:created event with strategy:', strategy.id);
      eventBus.emit('strategy:created', strategy);
      eventBus.emit('strategy:created', { strategy }); // Also emit with object wrapper for compatibility

      document.dispatchEvent(new CustomEvent('strategy:created', {
        detail: { strategy }
      }));

      // Force a refresh of all strategies
      console.log('TemplateGenerator: Forcing refresh of all strategies');
      try {
        await strategySync.initialize();
      } catch (syncError) {
        console.error('TemplateGenerator: Error initializing strategy sync:', syncError);
        // Continue even if sync fails
      }

      // Get the latest strategies and broadcast them
      const allStrategies = strategySync.getAllStrategies();
      console.log('TemplateGenerator: Broadcasting updated strategies list:', allStrategies.length, 'strategies');

      // Add the new strategy to the sync cache if it's not already there
      if (!strategySync.hasStrategy(strategy.id)) {
        console.log(`TemplateGenerator: Adding strategy ${strategy.id} to sync cache`);
        strategySync['strategies'].set(strategy.id, strategy);
      }

      // Broadcast updates
      eventBus.emit('strategies:updated', allStrategies);
      document.dispatchEvent(new CustomEvent('strategies:updated', {
        detail: { strategies: allStrategies }
      }));

      // Add a delayed broadcast to ensure all components catch the update
      setTimeout(() => {
        console.log('TemplateGenerator: Delayed broadcast of updated strategies');
        eventBus.emit('strategies:updated', strategySync.getAllStrategies());
        document.dispatchEvent(new CustomEvent('strategies:updated', {
          detail: { strategies: strategySync.getAllStrategies() }
        }));
      }, 500);

      logService.log('info', `Created strategy from template ${templateId}`,
        { strategyId: strategy.id, userId: session.user.id }, 'TemplateGenerator');

      return strategy;
    } catch (error) {
      console.error('TemplateGenerator: Failed to create strategy from template:', error);
      logService.log('error', `Failed to create strategy from template`, error, 'TemplateGenerator');
      throw error;
    }
  }
}

export const templateGenerator = new TemplateGenerator();
