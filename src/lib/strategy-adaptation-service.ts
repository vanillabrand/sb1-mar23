import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { supabase } from './supabase';
import { eventBus } from './event-bus';
import { enhancedMarketDataService } from './enhanced-market-data-service';
import { config } from './config';

/**
 * Service for adapting strategies based on changing market conditions
 * Uses Deepseek to analyze market conditions and adapt strategies accordingly
 */
class StrategyAdaptationService extends EventEmitter {
  private static instance: StrategyAdaptationService;
  private activeStrategies: Map<string, any> = new Map();
  private adaptationIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly ADAPTATION_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
  private readonly MARKET_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
  private readonly DEEPSEEK_API_KEY: string;
  private initialized = false;
  private marketCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
    this._initialize();
  }

  static getInstance(): StrategyAdaptationService {
    if (!StrategyAdaptationService.instance) {
      StrategyAdaptationService.instance = new StrategyAdaptationService();
    }
    return StrategyAdaptationService.instance;
  }

  /**
   * Initialize the service
   * Public method that can be called to ensure the service is initialized
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load active strategies
      await this.loadActiveStrategies();

      // Set up subscription to strategy changes
      this.setupStrategySubscription();

      // Start market check interval
      this.startMarketCheckInterval();

      this.initialized = true;
      logService.log('info', 'Strategy adaptation service initialized', null, 'StrategyAdaptationService');
    } catch (error) {
      logService.log('error', 'Failed to initialize strategy adaptation service', error, 'StrategyAdaptationService');
      throw error; // Re-throw to allow caller to handle initialization failure
    }
  }

  /**
   * Private initialization method called from constructor
   */
  private async _initialize(): Promise<void> {
    try {
      await this.initialize();
    } catch (error) {
      logService.log('error', 'Failed to initialize strategy adaptation service from constructor', error, 'StrategyAdaptationService');
      // Don't throw from constructor initialization
    }
  }

  /**
   * Load active strategies from the database
   */
  private async loadActiveStrategies(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('status', 'active');

      if (error) {
        throw error;
      }

      if (data) {
        data.forEach(strategy => {
          this.activeStrategies.set(strategy.id, strategy);
          this.setupAdaptationInterval(strategy.id);
        });

        logService.log('info', `Loaded ${data.length} active strategies`, null, 'StrategyAdaptationService');
      }
    } catch (error) {
      logService.log('error', 'Failed to load active strategies', error, 'StrategyAdaptationService');
    }
  }

  /**
   * Set up subscription to strategy changes
   */
  private setupStrategySubscription(): void {
    supabase
      .channel('strategy_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'strategies' }, payload => {
        try {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const strategy = payload.new;

            if (strategy.status === 'active') {
              // Add or update strategy
              this.activeStrategies.set(strategy.id, strategy);
              this.setupAdaptationInterval(strategy.id);
              logService.log('info', `Strategy ${strategy.id} added to adaptation service`, null, 'StrategyAdaptationService');
            } else if (this.activeStrategies.has(strategy.id)) {
              // Remove strategy if it's no longer active
              this.activeStrategies.delete(strategy.id);
              this.clearAdaptationInterval(strategy.id);
              logService.log('info', `Strategy ${strategy.id} removed from adaptation service`, null, 'StrategyAdaptationService');
            }
          } else if (payload.eventType === 'DELETE') {
            const strategyId = payload.old.id;

            if (this.activeStrategies.has(strategyId)) {
              this.activeStrategies.delete(strategyId);
              this.clearAdaptationInterval(strategyId);
              logService.log('info', `Strategy ${strategyId} removed from adaptation service`, null, 'StrategyAdaptationService');
            }
          }
        } catch (error) {
          logService.log('error', 'Error handling strategy change', error, 'StrategyAdaptationService');
        }
      })
      .subscribe();
  }

  /**
   * Set up adaptation interval for a strategy
   * @param strategyId Strategy ID
   */
  private setupAdaptationInterval(strategyId: string): void {
    // Clear existing interval if any
    this.clearAdaptationInterval(strategyId);

    // Set up new interval
    const interval = setInterval(() => {
      this.checkAndAdaptStrategy(strategyId).catch(error => {
        logService.log('error', `Failed to adapt strategy ${strategyId}`, error, 'StrategyAdaptationService');
      });
    }, this.ADAPTATION_INTERVAL);

    this.adaptationIntervals.set(strategyId, interval);
  }

  /**
   * Clear adaptation interval for a strategy
   * @param strategyId Strategy ID
   */
  private clearAdaptationInterval(strategyId: string): void {
    const interval = this.adaptationIntervals.get(strategyId);
    if (interval) {
      clearInterval(interval);
      this.adaptationIntervals.delete(strategyId);
    }
  }

  /**
   * Start market check interval
   */
  private startMarketCheckInterval(): void {
    if (this.marketCheckInterval) {
      clearInterval(this.marketCheckInterval);
    }

    this.marketCheckInterval = setInterval(() => {
      this.checkAllStrategiesMarketFit().catch(error => {
        logService.log('error', 'Failed to check market fit for all strategies', error, 'StrategyAdaptationService');
      });
    }, this.MARKET_CHECK_INTERVAL);
  }

  /**
   * Check market fit for all active strategies
   */
  private async checkAllStrategiesMarketFit(): Promise<void> {
    try {
      logService.log('info', `Checking market fit for ${this.activeStrategies.size} strategies`, null, 'StrategyAdaptationService');

      for (const [strategyId, strategy] of this.activeStrategies.entries()) {
        try {
          await this.checkStrategyMarketFit(strategyId);
        } catch (error) {
          logService.log('error', `Failed to check market fit for strategy ${strategyId}`, error, 'StrategyAdaptationService');
        }
      }
    } catch (error) {
      logService.log('error', 'Failed to check market fit for all strategies', error, 'StrategyAdaptationService');
    }
  }

  /**
   * Check if a strategy needs adaptation based on market conditions
   * @param strategyId Strategy ID
   */
  private async checkAndAdaptStrategy(strategyId: string): Promise<void> {
    try {
      const strategy = this.activeStrategies.get(strategyId);
      if (!strategy) {
        throw new Error(`Strategy ${strategyId} not found`);
      }

      logService.log('info', `Checking if strategy ${strategyId} needs adaptation`, null, 'StrategyAdaptationService');

      // Emit event to notify that we're checking this strategy
      eventBus.emit(`strategy:checking:${strategyId}`, { strategyId });

      // Check if strategy needs adaptation
      const needsAdaptation = await this.checkIfStrategyNeedsAdaptation(strategy);

      if (needsAdaptation) {
        logService.log('info', `Strategy ${strategyId} needs adaptation`, null, 'StrategyAdaptationService');

        // Emit event to notify that we're adapting this strategy
        eventBus.emit(`strategy:adapting:${strategyId}`, { strategyId });

        // Adapt the strategy
        const adaptedStrategy = await this.adaptStrategy(strategy);

        if (adaptedStrategy) {
          // Update the strategy in the database
          const { error } = await supabase
            .from('strategies')
            .update({
              strategy_config: adaptedStrategy.strategy_config,
              updated_at: new Date().toISOString(),
              last_adapted_at: new Date().toISOString()
            })
            .eq('id', strategyId);

          if (error) {
            throw error;
          }

          // Update our local copy
          this.activeStrategies.set(strategyId, {
            ...strategy,
            strategy_config: adaptedStrategy.strategy_config,
            updated_at: new Date().toISOString(),
            last_adapted_at: new Date().toISOString()
          });

          // Emit event to notify that the strategy was adapted
          eventBus.emit(`strategy:adapted:${strategyId}`, {
            strategyId,
            strategy: adaptedStrategy
          });

          logService.log('info', `Strategy ${strategyId} adapted successfully`, null, 'StrategyAdaptationService');
        }
      } else {
        logService.log('info', `Strategy ${strategyId} does not need adaptation`, null, 'StrategyAdaptationService');

        // Emit event to notify that the strategy was checked but not adapted
        eventBus.emit(`strategy:checked:${strategyId}`, {
          strategyId,
          needsAdaptation: false
        });
      }
    } catch (error) {
      logService.log('error', `Failed to check and adapt strategy ${strategyId}`, error, 'StrategyAdaptationService');

      // Emit error event
      eventBus.emit(`strategy:error:${strategyId}`, {
        strategyId,
        error
      });
    }
  }

  /**
   * Check if a strategy needs adaptation based on market conditions
   * @param strategy Strategy object
   * @returns Whether the strategy needs adaptation
   */
  private async checkIfStrategyNeedsAdaptation(strategy: any): Promise<boolean> {
    try {
      // Get market data for the strategy
      const marketData = await enhancedMarketDataService.getStrategyMarketData(strategy);

      if (!marketData || Object.keys(marketData).length === 0) {
        logService.log('warn', `No market data available for strategy ${strategy.id}`, null, 'StrategyAdaptationService');
        return false;
      }

      // Use Deepseek to analyze if the strategy needs adaptation
      const analysis = await this.analyzeStrategyMarketFit(strategy, marketData);

      if (!analysis) {
        return false;
      }

      // Update market fit score in database
      await supabase
        .from('strategies')
        .update({
          market_fit_score: analysis.score,
          market_fit_details: analysis.details,
          last_market_fit_check: new Date().toISOString()
        })
        .eq('id', strategy.id);

      // Determine if adaptation is needed based on the score
      return analysis.score < 0.7; // If score is less than 70%, adaptation is needed
    } catch (error) {
      logService.log('error', `Failed to check if strategy ${strategy.id} needs adaptation`, error, 'StrategyAdaptationService');
      return false;
    }
  }

  /**
   * Check market fit for a strategy
   * @param strategyId Strategy ID
   */
  async checkStrategyMarketFit(strategyId: string): Promise<any> {
    try {
      // Handle empty or invalid strategy ID
      if (!strategyId || strategyId === 'placeholder') {
        logService.log('warn', 'Invalid strategy ID provided', { strategyId }, 'StrategyAdaptationService');
        return null;
      }

      // Ensure service is initialized
      if (!this.initialized) {
        await this.initialize();
      }

      let strategy = this.activeStrategies.get(strategyId);
      if (!strategy) {
        // Try to fetch the strategy from the database if not in our active strategies map
        try {
          const { data, error } = await supabase
            .from('strategies')
            .select('*')
            .eq('id', strategyId)
            .single();

          if (error || !data) {
            throw new Error(`Strategy ${strategyId} not found in database`);
          }

          // Add to active strategies if it's active
          if (data.status === 'active') {
            this.activeStrategies.set(strategyId, data);
            this.setupAdaptationInterval(strategyId);
          }

          // Use the fetched strategy
          strategy = data;
        } catch (fetchError) {
          logService.log('error', `Failed to fetch strategy ${strategyId}`, fetchError, 'StrategyAdaptationService');
          throw new Error(`Strategy ${strategyId} not found`);
        }
      }

      logService.log('info', `Checking market fit for strategy ${strategyId}`, null, 'StrategyAdaptationService');

      // Get market data for the strategy
      const marketData = await enhancedMarketDataService.getStrategyMarketData(strategy);

      if (!marketData || Object.keys(marketData).length === 0) {
        logService.log('warn', `No market data available for strategy ${strategyId}`, null, 'StrategyAdaptationService');
        return null;
      }

      // Use Deepseek to analyze market fit
      const analysis = await this.analyzeStrategyMarketFit(strategy, marketData);

      if (!analysis) {
        return null;
      }

      // Update market fit score in database
      const { error } = await supabase
        .from('strategies')
        .update({
          market_fit_score: analysis.score,
          market_fit_details: analysis.details,
          last_market_fit_check: new Date().toISOString()
        })
        .eq('id', strategyId);

      if (error) {
        throw error;
      }

      // Emit event with the analysis
      eventBus.emit(`strategy:marketFit:${strategyId}`, {
        strategyId,
        analysis
      });

      return analysis;
    } catch (error) {
      logService.log('error', `Failed to check market fit for strategy ${strategyId}`, error, 'StrategyAdaptationService');
      throw error;
    }
  }

  /**
   * Analyze strategy market fit using Deepseek
   * @param strategy Strategy object
   * @param marketData Market data for the strategy
   * @returns Analysis object with score and details
   */
  private async analyzeStrategyMarketFit(strategy: any, marketData: any): Promise<any> {
    try {
      if (!this.DEEPSEEK_API_KEY) {
        logService.log('warn', 'No Deepseek API key found, using synthetic analysis', null, 'StrategyAdaptationService');
        return this.generateSyntheticAnalysis(strategy, marketData);
      }

      // Prepare data for Deepseek
      const prompt = this.buildMarketFitPrompt(strategy, marketData);

      // Call Deepseek API with timeout and retry
      let response;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

          response = await fetch(`${config.deepseekApiUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.3,
              max_tokens: 1000
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            break; // Success, exit retry loop
          }

          // Handle rate limiting with exponential backoff
          if (response.status === 429) {
            const backoffTime = Math.pow(2, retryCount) * 1000;
            logService.log('warn', `Deepseek API rate limited, retrying in ${backoffTime}ms`, null, 'StrategyAdaptationService');
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            retryCount++;
            continue;
          }

          // For other errors, throw immediately
          throw new Error(`Deepseek API error: ${response.status}`);
        } catch (fetchError) {
          if (fetchError.name === 'AbortError') {
            logService.log('warn', 'Deepseek API request timed out', null, 'StrategyAdaptationService');
          } else {
            logService.log('error', 'Deepseek API request failed', fetchError, 'StrategyAdaptationService');
          }

          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error(`Deepseek API request failed after ${maxRetries} attempts: ${fetchError.message}`);
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!response || !response.ok) {
        throw new Error('Failed to get valid response from Deepseek API');
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error(`Failed to parse Deepseek API response: ${jsonError.message}`);
      }

      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from Deepseek');
      }

      // Extract JSON from response
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in response');
      }

      let analysis;
      try {
        analysis = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
      } catch (parseError) {
        throw new Error(`Failed to parse JSON from Deepseek response: ${parseError.message}`);
      }

      // Validate analysis
      if (!analysis.score || !analysis.details) {
        throw new Error('Invalid analysis format');
      }

      return analysis;
    } catch (error) {
      logService.log('error', `Failed to analyze strategy market fit for ${strategy.id}`, error, 'StrategyAdaptationService');
      return this.generateSyntheticAnalysis(strategy, marketData);
    }
  }

  /**
   * Generate synthetic analysis for testing
   * @param strategy Strategy object
   * @param marketData Market data for the strategy
   * @returns Synthetic analysis object
   */
  private generateSyntheticAnalysis(strategy: any, marketData: any): any {
    try {
      // Extract market conditions from the first symbol
      const symbol = strategy.selected_pairs?.[0];
      const symbolData = marketData[symbol];

      if (!symbolData) {
        return {
          score: 0.75, // Default to 75% fit
          details: {
            marketConditions: 'unknown',
            strategyAlignment: 'moderate',
            recommendations: ['No market data available for analysis']
          }
        };
      }

      // Determine market conditions
      const volatility = symbolData.volatility || 50;
      const trend = symbolData.trend || 'sideways';

      // Calculate score based on strategy risk level and market conditions
      let score = 0.75; // Default score

      const riskLevel = strategy.risk_level || strategy.riskLevel || 'medium';

      if (riskLevel === 'high' && volatility > 70) {
        // High risk strategy in high volatility market
        score = 0.9;
      } else if (riskLevel === 'high' && volatility < 30) {
        // High risk strategy in low volatility market
        score = 0.5;
      } else if (riskLevel === 'low' && volatility > 70) {
        // Low risk strategy in high volatility market
        score = 0.4;
      } else if (riskLevel === 'low' && volatility < 30) {
        // Low risk strategy in low volatility market
        score = 0.8;
      }

      // Adjust for trend
      if (trend === 'up' && (strategy.strategy_config?.bias === 'bullish' || strategy.strategy_config?.bias === 'long')) {
        score += 0.1;
      } else if (trend === 'down' && (strategy.strategy_config?.bias === 'bearish' || strategy.strategy_config?.bias === 'short')) {
        score += 0.1;
      } else if (trend !== 'sideways' && strategy.strategy_config?.bias !== trend) {
        score -= 0.1;
      }

      // Cap score between 0 and 1
      score = Math.max(0, Math.min(1, score));

      return {
        score,
        details: {
          marketConditions: `${trend} trend with ${volatility}% volatility`,
          strategyAlignment: score > 0.7 ? 'good' : (score > 0.5 ? 'moderate' : 'poor'),
          recommendations: [
            score < 0.6 ? 'Consider adapting strategy to current market conditions' : 'Strategy is well-aligned with current market conditions'
          ]
        }
      };
    } catch (error) {
      logService.log('error', 'Failed to generate synthetic analysis', error, 'StrategyAdaptationService');
      return {
        score: 0.75,
        details: {
          marketConditions: 'unknown',
          strategyAlignment: 'moderate',
          recommendations: ['Error generating analysis']
        }
      };
    }
  }

  /**
   * Adapt a strategy using Deepseek
   * @param strategy Strategy object
   * @returns Adapted strategy object
   */
  private async adaptStrategy(strategy: any): Promise<any> {
    try {
      if (!this.DEEPSEEK_API_KEY) {
        logService.log('warn', 'No Deepseek API key found, using synthetic adaptation', null, 'StrategyAdaptationService');
        return this.generateSyntheticAdaptation(strategy);
      }

      // Get market data for the strategy
      const marketData = await enhancedMarketDataService.getStrategyMarketData(strategy);

      if (!marketData || Object.keys(marketData).length === 0) {
        logService.log('warn', `No market data available for strategy ${strategy.id}`, null, 'StrategyAdaptationService');
        return this.generateSyntheticAdaptation(strategy);
      }

      // Prepare data for Deepseek
      const prompt = this.buildAdaptationPrompt(strategy, marketData);

      // Call Deepseek API
      const response = await fetch(`${config.deepseekApiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error(`Deepseek API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from Deepseek');
      }

      // Extract JSON from response
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in response');
      }

      const adaptedStrategy = JSON.parse(content.substring(jsonStart, jsonEnd + 1));

      // Validate adapted strategy
      if (!adaptedStrategy.strategy_config) {
        throw new Error('Invalid adapted strategy format');
      }

      // Preserve original strategy fields and only update strategy_config
      return {
        ...strategy,
        strategy_config: adaptedStrategy.strategy_config
      };
    } catch (error) {
      logService.log('error', `Failed to adapt strategy ${strategy.id}`, error, 'StrategyAdaptationService');
      return this.generateSyntheticAdaptation(strategy);
    }
  }

  /**
   * Generate synthetic adaptation for testing
   * @param strategy Strategy object
   * @returns Synthetic adapted strategy
   */
  private generateSyntheticAdaptation(strategy: any): any {
    try {
      // Create a deep copy of the strategy
      const adaptedStrategy = JSON.parse(JSON.stringify(strategy));

      // Make some minor adjustments to the strategy config
      if (adaptedStrategy.strategy_config) {
        // Adjust stop loss and take profit levels
        if (adaptedStrategy.strategy_config.stopLoss) {
          adaptedStrategy.strategy_config.stopLoss *= 0.9; // Tighten stop loss by 10%
        }

        if (adaptedStrategy.strategy_config.takeProfit) {
          adaptedStrategy.strategy_config.takeProfit *= 1.1; // Increase take profit by 10%
        }

        // Adjust position sizing
        if (adaptedStrategy.strategy_config.positionSize) {
          adaptedStrategy.strategy_config.positionSize *= 0.95; // Reduce position size by 5%
        }

        // Add adaptation note
        adaptedStrategy.strategy_config.lastAdaptation = {
          timestamp: Date.now(),
          reason: 'Synthetic adaptation for testing',
          changes: [
            'Adjusted stop loss and take profit levels',
            'Reduced position size'
          ]
        };
      }

      return adaptedStrategy;
    } catch (error) {
      logService.log('error', 'Failed to generate synthetic adaptation', error, 'StrategyAdaptationService');
      return strategy; // Return original strategy if adaptation fails
    }
  }

  /**
   * Build prompt for market fit analysis
   * @param strategy Strategy object
   * @param marketData Market data for the strategy
   * @returns Prompt for Deepseek
   */
  private buildMarketFitPrompt(strategy: any, marketData: any): string {
    // Extract the first few symbols for analysis (to keep prompt size reasonable)
    const symbols = strategy.selected_pairs || [];
    const symbolsToAnalyze = symbols.slice(0, 3);

    // Extract relevant market data for these symbols
    const relevantMarketData: any = {};
    symbolsToAnalyze.forEach(symbol => {
      if (marketData[symbol]) {
        relevantMarketData[symbol] = {
          currentPrice: marketData[symbol].currentPrice,
          priceChange24h: marketData[symbol].priceChange24h,
          volume24h: marketData[symbol].volume24h,
          volatility: marketData[symbol].volatility,
          trend: marketData[symbol].trend,
          // Include only the most recent candles to keep prompt size reasonable
          candles: marketData[symbol].candles['1h']?.slice(-10) || []
        };
      }
    });

    return `Analyze if this trading strategy is well-suited for current market conditions:

Strategy:
${JSON.stringify(strategy, null, 2)}

Current Market Data:
${JSON.stringify(relevantMarketData, null, 2)}

Requirements:
1. Evaluate how well the strategy fits current market conditions
2. Provide a market fit score between 0 and 1 (0 = poor fit, 1 = perfect fit)
3. Explain why the strategy does or doesn't fit current conditions
4. Provide specific recommendations for improvement if needed

Return your analysis in the following JSON format:
{
  "score": 0.75,
  "details": {
    "marketConditions": "Current market conditions summary",
    "strategyAlignment": "How well the strategy aligns with current conditions",
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"],
    "recommendations": ["Recommendation 1", "Recommendation 2"]
  }
}`;
  }

  /**
   * Build prompt for strategy adaptation
   * @param strategy Strategy object
   * @param marketData Market data for the strategy
   * @returns Prompt for Deepseek
   */
  private buildAdaptationPrompt(strategy: any, marketData: any): string {
    // Extract the first few symbols for analysis (to keep prompt size reasonable)
    const symbols = strategy.selected_pairs || [];
    const symbolsToAnalyze = symbols.slice(0, 3);

    // Extract relevant market data for these symbols
    const relevantMarketData: any = {};
    symbolsToAnalyze.forEach(symbol => {
      if (marketData[symbol]) {
        relevantMarketData[symbol] = {
          currentPrice: marketData[symbol].currentPrice,
          priceChange24h: marketData[symbol].priceChange24h,
          volume24h: marketData[symbol].volume24h,
          volatility: marketData[symbol].volatility,
          trend: marketData[symbol].trend,
          // Include only the most recent candles to keep prompt size reasonable
          candles: marketData[symbol].candles['1h']?.slice(-10) || []
        };
      }
    });

    return `Adapt this trading strategy to better fit current market conditions:

Strategy:
${JSON.stringify(strategy, null, 2)}

Current Market Data:
${JSON.stringify(relevantMarketData, null, 2)}

Requirements:
1. Preserve the original strategy's core logic and asset pairs
2. Adjust parameters to better fit current market conditions
3. Modify risk management rules if needed
4. Update entry and exit conditions based on current market trends
5. Keep the same market type (spot, margin, futures)

Focus on these adaptations:
- Adjust indicator parameters for current volatility
- Update position sizing for risk management
- Modify entry/exit rules based on market trend
- Adjust stop-loss and take-profit levels
- Add any necessary market filters

Return the adapted strategy in the following JSON format:
{
  "strategy_config": {
    // Updated strategy configuration
    // Include all original fields with modifications as needed
    "lastAdaptation": {
      "timestamp": ${Date.now()},
      "reason": "Adaptation reason",
      "changes": ["Change 1", "Change 2"]
    }
  }
}`;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Clear all adaptation intervals
    this.adaptationIntervals.forEach(interval => clearInterval(interval));
    this.adaptationIntervals.clear();

    // Clear market check interval
    if (this.marketCheckInterval) {
      clearInterval(this.marketCheckInterval);
      this.marketCheckInterval = null;
    }

    // Clear active strategies
    this.activeStrategies.clear();

    // Reset initialization flag
    this.initialized = false;

    logService.log('info', 'Strategy adaptation service cleaned up', null, 'StrategyAdaptationService');
  }
}

export const strategyAdaptationService = StrategyAdaptationService.getInstance();
