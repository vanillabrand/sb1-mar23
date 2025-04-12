import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { supabase } from './supabase';
import { marketService } from './market-service';
import { aiService } from './ai-service';
import { strategyService } from './strategy-service';
import { tradeGenerator } from './trade-generator';
import { marketMonitor } from './market-monitor';
import { eventBus } from './event-bus';
import type { Strategy } from './types';

/**
 * Service responsible for periodically updating strategies based on market conditions
 * and ensuring continuous trade generation
 */
class StrategyUpdateService extends EventEmitter {
  private static instance: StrategyUpdateService;
  
  // Update interval: 15 minutes (900,000 ms)
  private readonly UPDATE_INTERVAL = 15 * 60 * 1000;
  
  // Trade check interval: 5 minutes (300,000 ms)
  private readonly TRADE_CHECK_INTERVAL = 5 * 60 * 1000;
  
  // Active strategies being monitored
  private activeStrategies: Map<string, Strategy> = new Map();
  
  // Intervals for different monitoring tasks
  private updateInterval: NodeJS.Timeout | null = null;
  private tradeCheckInterval: NodeJS.Timeout | null = null;
  
  // Last update timestamps for each strategy
  private lastUpdateTimes: Map<string, number> = new Map();
  private lastTradeCheckTimes: Map<string, number> = new Map();
  
  // Flag to track initialization status
  private initialized = false;

  private constructor() {
    super();
  }

  static getInstance(): StrategyUpdateService {
    if (!StrategyUpdateService.instance) {
      StrategyUpdateService.instance = new StrategyUpdateService();
    }
    return StrategyUpdateService.instance;
  }

  /**
   * Initialize the service and start monitoring
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logService.log('info', 'StrategyUpdateService already initialized', null, 'StrategyUpdateService');
      return;
    }

    try {
      logService.log('info', 'Initializing StrategyUpdateService', null, 'StrategyUpdateService');
      
      // Load active strategies
      await this.loadActiveStrategies();
      
      // Start monitoring intervals
      this.startUpdateInterval();
      this.startTradeCheckInterval();
      
      // Set up real-time updates for strategy changes
      this.setupRealtimeUpdates();
      
      this.initialized = true;
      logService.log('info', 'StrategyUpdateService initialized successfully', null, 'StrategyUpdateService');
    } catch (error) {
      logService.log('error', 'Failed to initialize StrategyUpdateService', error, 'StrategyUpdateService');
      throw error;
    }
  }

  /**
   * Load all active strategies from the database
   */
  private async loadActiveStrategies(): Promise<void> {
    try {
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('status', 'active');

      if (error) {
        throw error;
      }

      if (!strategies || strategies.length === 0) {
        logService.log('info', 'No active strategies found', null, 'StrategyUpdateService');
        return;
      }

      logService.log('info', `Loaded ${strategies.length} active strategies`, null, 'StrategyUpdateService');
      
      // Add each strategy to our monitoring map
      strategies.forEach(strategy => {
        this.activeStrategies.set(strategy.id, strategy);
        this.lastUpdateTimes.set(strategy.id, 0); // Initialize with 0 to ensure first update happens immediately
        this.lastTradeCheckTimes.set(strategy.id, 0); // Initialize with 0 to ensure first check happens immediately
      });
      
      // Emit event for each strategy loaded
      this.emit('strategiesLoaded', { strategies });
    } catch (error) {
      logService.log('error', 'Failed to load active strategies', error, 'StrategyUpdateService');
      throw error;
    }
  }

  /**
   * Start the interval for updating strategies based on market conditions
   */
  private startUpdateInterval(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      try {
        // Process each active strategy
        for (const [strategyId, strategy] of this.activeStrategies.entries()) {
          try {
            const now = Date.now();
            const lastUpdateTime = this.lastUpdateTimes.get(strategyId) || 0;
            
            // Check if it's time to update this strategy (15 minutes since last update)
            if (now - lastUpdateTime >= this.UPDATE_INTERVAL) {
              await this.updateStrategy(strategy);
              this.lastUpdateTimes.set(strategyId, now);
            }
          } catch (strategyError) {
            logService.log('error', `Error updating strategy ${strategyId}`, strategyError, 'StrategyUpdateService');
            // Continue with next strategy
          }
        }
      } catch (error) {
        logService.log('error', 'Error in strategy update interval', error, 'StrategyUpdateService');
      }
    }, this.UPDATE_INTERVAL);

    logService.log('info', `Started strategy update interval (${this.UPDATE_INTERVAL / 60000} minutes)`, null, 'StrategyUpdateService');
  }

  /**
   * Start the interval for checking if trades should be generated
   */
  private startTradeCheckInterval(): void {
    if (this.tradeCheckInterval) {
      clearInterval(this.tradeCheckInterval);
    }

    this.tradeCheckInterval = setInterval(async () => {
      try {
        // Process each active strategy
        for (const [strategyId, strategy] of this.activeStrategies.entries()) {
          try {
            const now = Date.now();
            const lastCheckTime = this.lastTradeCheckTimes.get(strategyId) || 0;
            
            // Check if it's time to check for trades (5 minutes since last check)
            if (now - lastCheckTime >= this.TRADE_CHECK_INTERVAL) {
              await this.checkForTradeOpportunities(strategy);
              this.lastTradeCheckTimes.set(strategyId, now);
            }
          } catch (strategyError) {
            logService.log('error', `Error checking trade opportunities for strategy ${strategyId}`, strategyError, 'StrategyUpdateService');
            // Continue with next strategy
          }
        }
      } catch (error) {
        logService.log('error', 'Error in trade check interval', error, 'StrategyUpdateService');
      }
    }, this.TRADE_CHECK_INTERVAL);

    logService.log('info', `Started trade check interval (${this.TRADE_CHECK_INTERVAL / 60000} minutes)`, null, 'StrategyUpdateService');
  }

  /**
   * Set up real-time updates for strategy changes
   */
  private setupRealtimeUpdates(): void {
    supabase
      .channel('strategy_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'strategies' },
        async (payload) => {
          try {
            switch (payload.eventType) {
              case 'INSERT':
                if (payload.new.status === 'active') {
                  this.addStrategy(payload.new);
                }
                break;
              case 'UPDATE':
                if (payload.new.status === 'active' && !this.activeStrategies.has(payload.new.id)) {
                  // New active strategy
                  this.addStrategy(payload.new);
                } else if (payload.new.status !== 'active' && this.activeStrategies.has(payload.new.id)) {
                  // Strategy deactivated
                  this.removeStrategy(payload.new.id);
                } else if (payload.new.status === 'active' && this.activeStrategies.has(payload.new.id)) {
                  // Active strategy updated
                  this.updateStrategyData(payload.new);
                }
                break;
              case 'DELETE':
                if (this.activeStrategies.has(payload.old.id)) {
                  this.removeStrategy(payload.old.id);
                }
                break;
            }
          } catch (error) {
            logService.log('error', 'Error handling strategy update', error, 'StrategyUpdateService');
          }
        }
      )
      .subscribe();

    logService.log('info', 'Set up real-time updates for strategy changes', null, 'StrategyUpdateService');
  }

  /**
   * Add a new strategy to the monitoring list
   */
  private addStrategy(strategy: Strategy): void {
    if (strategy.status !== 'active') {
      return;
    }

    this.activeStrategies.set(strategy.id, strategy);
    this.lastUpdateTimes.set(strategy.id, 0); // Initialize with 0 to ensure first update happens immediately
    this.lastTradeCheckTimes.set(strategy.id, 0); // Initialize with 0 to ensure first check happens immediately
    
    logService.log('info', `Added strategy ${strategy.id} to monitoring`, null, 'StrategyUpdateService');
    
    // Immediately check for trade opportunities for this new strategy
    this.checkForTradeOpportunities(strategy).catch(error => {
      logService.log('error', `Error checking trade opportunities for new strategy ${strategy.id}`, error, 'StrategyUpdateService');
    });
  }

  /**
   * Remove a strategy from the monitoring list
   */
  private removeStrategy(strategyId: string): void {
    this.activeStrategies.delete(strategyId);
    this.lastUpdateTimes.delete(strategyId);
    this.lastTradeCheckTimes.delete(strategyId);
    
    logService.log('info', `Removed strategy ${strategyId} from monitoring`, null, 'StrategyUpdateService');
  }

  /**
   * Update strategy data in the monitoring list
   */
  private updateStrategyData(strategy: Strategy): void {
    this.activeStrategies.set(strategy.id, strategy);
    logService.log('info', `Updated strategy ${strategy.id} data`, null, 'StrategyUpdateService');
  }

  /**
   * Update a strategy based on current market conditions
   * Uses DeepSeek to analyze market conditions and update strategy parameters if needed
   */
  private async updateStrategy(strategy: Strategy): Promise<void> {
    try {
      logService.log('info', `Updating strategy ${strategy.id} based on market conditions`, null, 'StrategyUpdateService');
      
      // Emit event to notify that we're updating this strategy
      eventBus.emit(`strategy:updating:${strategy.id}`, { strategyId: strategy.id });
      
      // Get market data for this strategy
      const marketData = await this.getMarketDataForStrategy(strategy);
      
      if (!marketData) {
        logService.log('warn', `No market data available for strategy ${strategy.id}, skipping update`, null, 'StrategyUpdateService');
        return;
      }
      
      // Use DeepSeek to analyze market conditions and suggest strategy updates
      const analysis = await this.analyzeMarketConditions(strategy, marketData);
      
      if (!analysis || !analysis.shouldUpdate) {
        logService.log('info', `No updates needed for strategy ${strategy.id}`, null, 'StrategyUpdateService');
        return;
      }
      
      // Apply suggested updates to the strategy
      const updatedStrategy = await this.applyStrategyUpdates(strategy, analysis.updates);
      
      // Update our local copy of the strategy
      this.activeStrategies.set(strategy.id, updatedStrategy);
      
      // Emit event to notify that the strategy was updated
      eventBus.emit(`strategy:updated:${strategy.id}`, { 
        strategyId: strategy.id, 
        strategy: updatedStrategy,
        updates: analysis.updates
      });
      
      logService.log('info', `Strategy ${strategy.id} updated successfully`, { updates: analysis.updates }, 'StrategyUpdateService');
    } catch (error) {
      logService.log('error', `Failed to update strategy ${strategy.id}`, error, 'StrategyUpdateService');
      throw error;
    }
  }

  /**
   * Check for trade opportunities for a strategy
   * Ensures that trades are generated if market conditions are favorable
   */
  private async checkForTradeOpportunities(strategy: Strategy): Promise<void> {
    try {
      logService.log('info', `Checking trade opportunities for strategy ${strategy.id}`, null, 'StrategyUpdateService');
      
      // Emit event to notify that we're checking for trade opportunities
      eventBus.emit(`strategy:checking:${strategy.id}`, { strategyId: strategy.id });
      
      // Ensure the strategy is added to the trade generator
      await tradeGenerator.addStrategy(strategy);
      
      // Trigger a check for trade opportunities
      await tradeGenerator.checkTradeOpportunities(strategy.id);
      
      logService.log('info', `Completed trade opportunity check for strategy ${strategy.id}`, null, 'StrategyUpdateService');
    } catch (error) {
      logService.log('error', `Failed to check trade opportunities for strategy ${strategy.id}`, error, 'StrategyUpdateService');
      throw error;
    }
  }

  /**
   * Get market data for a strategy
   */
  private async getMarketDataForStrategy(strategy: Strategy): Promise<any> {
    try {
      // Get trading pairs from the strategy
      const tradingPairs = strategy.selected_pairs || [];
      
      if (tradingPairs.length === 0) {
        logService.log('warn', `No trading pairs found for strategy ${strategy.id}`, null, 'StrategyUpdateService');
        return null;
      }
      
      // Get market data for each trading pair
      const pairData = await Promise.all(
        tradingPairs.map(async (pair) => {
          try {
            // Get market data from market service
            const data = await marketService.getMarketData(pair);
            
            // Get additional market state from market monitor
            const state = marketMonitor.getMarketState(pair);
            
            return {
              symbol: pair,
              data,
              state
            };
          } catch (error) {
            logService.log('error', `Failed to get market data for ${pair}`, error, 'StrategyUpdateService');
            return null;
          }
        })
      );
      
      // Filter out null values
      const validPairData = pairData.filter(data => data !== null);
      
      if (validPairData.length === 0) {
        logService.log('warn', `No valid market data found for strategy ${strategy.id}`, null, 'StrategyUpdateService');
        return null;
      }
      
      return {
        strategy,
        pairs: validPairData
      };
    } catch (error) {
      logService.log('error', `Failed to get market data for strategy ${strategy.id}`, error, 'StrategyUpdateService');
      return null;
    }
  }

  /**
   * Analyze market conditions and suggest strategy updates
   * Uses DeepSeek to analyze market conditions and suggest updates
   */
  private async analyzeMarketConditions(strategy: Strategy, marketData: any): Promise<{
    shouldUpdate: boolean;
    updates: any;
  } | null> {
    try {
      // Use AI service to analyze market conditions
      const analysis = await aiService.analyzeMarketConditions(
        strategy.selected_pairs?.[0] || 'BTC/USDT',
        strategy.riskLevel || (strategy as any).risk_level || 'Medium',
        marketData
      );
      
      if (!analysis) {
        return null;
      }
      
      // Determine if strategy should be updated based on market conditions
      const shouldUpdate = analysis.shouldUpdate || false;
      
      if (!shouldUpdate) {
        return {
          shouldUpdate: false,
          updates: {}
        };
      }
      
      // Extract suggested updates from analysis
      const updates = analysis.updates || {};
      
      return {
        shouldUpdate,
        updates
      };
    } catch (error) {
      logService.log('error', `Failed to analyze market conditions for strategy ${strategy.id}`, error, 'StrategyUpdateService');
      return null;
    }
  }

  /**
   * Apply suggested updates to a strategy
   */
  private async applyStrategyUpdates(strategy: Strategy, updates: any): Promise<Strategy> {
    try {
      // Create update object with only the fields that should be updated
      const updateObject: Partial<Strategy> = {};
      
      // Apply updates to strategy configuration
      if (updates.strategy_config) {
        updateObject.strategy_config = {
          ...strategy.strategy_config,
          ...updates.strategy_config
        };
      }
      
      // Apply other updates
      if (updates.description) {
        updateObject.description = updates.description;
      }
      
      if (updates.selected_pairs) {
        updateObject.selected_pairs = updates.selected_pairs;
      }
      
      // Update the strategy in the database
      const updatedStrategy = await strategyService.updateStrategy(strategy.id, updateObject);
      
      return updatedStrategy;
    } catch (error) {
      logService.log('error', `Failed to apply updates to strategy ${strategy.id}`, error, 'StrategyUpdateService');
      throw error;
    }
  }

  /**
   * Force an immediate update of a strategy
   */
  async forceUpdateStrategy(strategyId: string): Promise<void> {
    try {
      const strategy = this.activeStrategies.get(strategyId);
      
      if (!strategy) {
        throw new Error(`Strategy ${strategyId} not found in active strategies`);
      }
      
      await this.updateStrategy(strategy);
      this.lastUpdateTimes.set(strategyId, Date.now());
      
      logService.log('info', `Forced update of strategy ${strategyId} completed`, null, 'StrategyUpdateService');
    } catch (error) {
      logService.log('error', `Failed to force update of strategy ${strategyId}`, error, 'StrategyUpdateService');
      throw error;
    }
  }

  /**
   * Force an immediate check for trade opportunities for a strategy
   */
  async forceCheckTradeOpportunities(strategyId: string): Promise<void> {
    try {
      const strategy = this.activeStrategies.get(strategyId);
      
      if (!strategy) {
        throw new Error(`Strategy ${strategyId} not found in active strategies`);
      }
      
      await this.checkForTradeOpportunities(strategy);
      this.lastTradeCheckTimes.set(strategyId, Date.now());
      
      logService.log('info', `Forced trade opportunity check for strategy ${strategyId} completed`, null, 'StrategyUpdateService');
    } catch (error) {
      logService.log('error', `Failed to force trade opportunity check for strategy ${strategyId}`, error, 'StrategyUpdateService');
      throw error;
    }
  }

  /**
   * Stop all monitoring
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.tradeCheckInterval) {
      clearInterval(this.tradeCheckInterval);
      this.tradeCheckInterval = null;
    }
    
    this.activeStrategies.clear();
    this.lastUpdateTimes.clear();
    this.lastTradeCheckTimes.clear();
    
    this.initialized = false;
    
    logService.log('info', 'StrategyUpdateService stopped', null, 'StrategyUpdateService');
  }
}

export const strategyUpdateService = StrategyUpdateService.getInstance();
