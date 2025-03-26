import { EventEmitter } from './event-emitter';
import { supabase } from './supabase';
import { strategyMonitor } from './strategy-monitor';
import { tradeManager } from './trade-manager';
import { marketMonitor } from './market-monitor';
import { logService } from './log-service';
import { monitoringService } from './monitoring-service';
import { aiTradeService } from './ai-trade-service';
import { riskManager } from './risk-manager';
import { config } from '../../backend/config';
import { exchangeService } from './exchange-service';

class BackgroundProcessManager extends EventEmitter {
  private static instance: BackgroundProcessManager;
  private activeStrategies: Map<string, any> = new Map();
  private processIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly STRATEGY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MARKET_FIT_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
  private balanceModalShown: Set<string> = new Set();

  private constructor() {
    super();
    this.initialize();
    exchangeService.onInsufficientBalance(this.handleInsufficientBalance.bind(this));
  }

  static getInstance(): BackgroundProcessManager {
    if (!BackgroundProcessManager.instance) {
      BackgroundProcessManager.instance = new BackgroundProcessManager();
    }
    return BackgroundProcessManager.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Get all active strategies
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;

      // Initialize monitoring for each strategy
      await Promise.all(strategies.map(async (strategy) => {
        await this.initializeStrategy(strategy);
      }));

      // Start global monitoring process
      this.startGlobalMonitoring();
    } catch (error) {
      logService.log('error', 'Failed to initialize background processes', error, 'BackgroundProcessManager');
    }
  }

  private async initializeStrategy(strategy: any): Promise<void> {
    try {
      // Validate strategy configuration
      const isValid = await this.validateStrategyConfiguration(strategy);
      if (!isValid) {
        await this.pauseStrategy(strategy.id, 'Invalid strategy configuration');
        return;
      }

      // Initialize risk parameters
      await riskManager.initializeStrategyRisk(strategy);

      // Start market monitoring
      await marketMonitor.addStrategy(strategy);

      // Initialize trade monitoring
      await tradeManager.initializeStrategy(strategy);

      // Start continuous market fit analysis
      await this.startMarketFitAnalysis(strategy);

      // Start strategy-specific monitoring
      this.startStrategyMonitoring(strategy);

      this.activeStrategies.set(strategy.id, strategy);

      logService.log('info', `Initialized monitoring for strategy ${strategy.id}`, 
        { strategy: strategy.id }, 'BackgroundProcessManager');
    } catch (error) {
      logService.log('error', `Failed to initialize strategy ${strategy.id}`, error, 'BackgroundProcessManager');
    }
  }

  private async validateStrategyConfiguration(strategy: any): Promise<boolean> {
    try {
      const validationResults = await Promise.all([
        riskManager.validateRiskParameters(strategy),
        this.validateBudgetRequirements(strategy),
        this.validateMarketConditions(strategy)
      ]);

      return validationResults.every(result => result === true);
    } catch (error) {
      logService.log('error', `Strategy validation failed for ${strategy.id}`, error, 'BackgroundProcessManager');
      return false;
    }
  }

  private async validateBudgetRequirements(strategy: any): Promise<boolean> {
    const budget = await tradeManager.getAvailableBudget(strategy.id);
    const minRequired = strategy.strategy_config?.minRequiredBudget || 0;
    return budget >= minRequired;
  }

  private async validateMarketConditions(strategy: any): Promise<boolean> {
    const marketData = await marketMonitor.getStrategyMarketData(strategy);
    return await aiTradeService.validateMarketConditions(strategy, marketData);
  }

  private startStrategyMonitoring(strategy: any): void {
    const interval = setInterval(async () => {
      try {
        await this.processStrategy(strategy);
      } catch (error) {
        logService.log('error', `Error processing strategy ${strategy.id}`, error, 'BackgroundProcessManager');
      }
    }, this.STRATEGY_CHECK_INTERVAL);

    this.processIntervals.set(strategy.id, interval);
  }

  private async processStrategy(strategy: any): Promise<void> {
    try {
      // Get current market data
      const marketData = await marketMonitor.getStrategyMarketData(strategy);
      
      // Check risk limits
      const riskStatus = await riskManager.checkRiskLimits(strategy);
      if (!riskStatus.withinLimits) {
        await this.handleRiskViolation(strategy, riskStatus);
        return;
      }

      // Get available budget
      const budget = await tradeManager.getAvailableBudget(strategy.id);
      if (budget <= 0) {
        logService.log('warn', `Insufficient budget for strategy ${strategy.id}`, 
          { budget }, 'BackgroundProcessManager');
        return;
      }

      // Generate trade signals
      const signals = await aiTradeService.generateTrades(strategy, marketData, budget);

      // Validate and process signals
      for (const signal of signals) {
        const validatedSignal = await riskManager.validateTradeSignal(strategy, signal);
        if (validatedSignal) {
          await tradeManager.processTradeSignal(strategy, validatedSignal);
        }
      }
    } catch (error) {
      logService.log('error', `Error processing strategy ${strategy.id}`, error, 'BackgroundProcessManager');
    }
  }

  private async startMarketFitAnalysis(strategy: any): Promise<void> {
    setInterval(async () => {
      try {
        const marketData = await marketMonitor.getStrategyMarketData(strategy);
        const analysis = await aiTradeService.analyzeMarketFit(strategy, marketData);

        // Update strategy market fit status
        await supabase
          .from('strategies')
          .update({
            market_fit_score: analysis.score,
            market_fit_details: analysis.details,
            last_market_fit_check: new Date().toISOString()
          })
          .eq('id', strategy.id);

        // Handle poor market fit
        if (analysis.score < (strategy.strategy_config?.minMarketFitScore || 0.3)) {
          await this.handlePoorMarketFit(strategy, analysis);
        }
      } catch (error) {
        logService.log('error', `Market fit analysis failed for strategy ${strategy.id}`, 
          error, 'BackgroundProcessManager');
      }
    }, this.MARKET_FIT_CHECK_INTERVAL);
  }

  private async handleRiskViolation(strategy: any, riskStatus: any): Promise<void> {
    try {
      logService.log('warn', `Risk violation detected for strategy ${strategy.id}`, 
        { riskStatus }, 'BackgroundProcessManager');

      await this.pauseStrategy(strategy.id, `Risk violation: ${riskStatus.reason}`);

      // Close positions if required by risk status
      if (riskStatus.requiresPositionClose) {
        await tradeManager.closeAllStrategyTrades(strategy.id, 'Risk violation detected');
      }

      // Notify monitoring service
      monitoringService.emit('riskViolation', {
        strategyId: strategy.id,
        riskStatus
      });
    } catch (error) {
      logService.log('error', `Failed to handle risk violation for strategy ${strategy.id}`, 
        error, 'BackgroundProcessManager');
    }
  }

  private async handlePoorMarketFit(strategy: any, analysis: any): Promise<void> {
    try {
      await this.pauseStrategy(strategy.id, 'Poor market fit detected');

      // Close any open trades
      await tradeManager.closeAllStrategyTrades(strategy.id, 'Strategy paused due to poor market fit');

      // Notify monitoring service
      monitoringService.emit('strategyPaused', {
        strategyId: strategy.id,
        reason: 'poor_market_fit',
        analysis
      });
    } catch (error) {
      logService.log('error', `Failed to handle poor market fit for strategy ${strategy.id}`, 
        error, 'BackgroundProcessManager');
    }
  }

  private async pauseStrategy(strategyId: string, reason: string): Promise<void> {
    try {
      await supabase
        .from('strategies')
        .update({
          status: 'paused',
          pause_reason: reason,
          paused_at: new Date().toISOString()
        })
        .eq('id', strategyId);

      // Clear monitoring interval
      const interval = this.processIntervals.get(strategyId);
      if (interval) {
        clearInterval(interval);
        this.processIntervals.delete(strategyId);
      }

      this.activeStrategies.delete(strategyId);
    } catch (error) {
      logService.log('error', `Failed to pause strategy ${strategyId}`, error, 'BackgroundProcessManager');
    }
  }

  private startGlobalMonitoring(): void {
    setInterval(async () => {
      try {
        // Check for new active strategies
        const { data: strategies, error } = await supabase
          .from('strategies')
          .select('*')
          .eq('status', 'active');

        if (error) throw error;

        // Initialize new strategies
        for (const strategy of strategies) {
          if (!this.activeStrategies.has(strategy.id)) {
            await this.initializeStrategy(strategy);
          }
        }

        // Clean up inactive strategies
        for (const [strategyId, strategy] of this.activeStrategies) {
          if (!strategies.find(s => s.id === strategyId)) {
            await this.pauseStrategy(strategyId, 'Strategy no longer active');
          }
        }
      } catch (error) {
        logService.log('error', 'Global monitoring error', error, 'BackgroundProcessManager');
      }
    }, this.STRATEGY_CHECK_INTERVAL);
  }

  private async handleInsufficientBalance(marketType: string): Promise<void> {
    // Pause all strategies for this market type
    const strategies = await this.getStrategiesForMarket(marketType);
    for (const strategy of strategies) {
      if (!this.balanceModalShown.has(strategy.id)) {
        this.balanceModalShown.add(strategy.id);
        
        // Emit event for UI to show modal
        this.emit('insufficientBalance', {
          strategyId: strategy.id,
          marketType
        });

        // Pause strategy
        await this.pauseStrategy(strategy.id, {
          reason: 'Insufficient balance',
          pausedAt: new Date().toISOString()
        });
      }
    }
  }

  private async getStrategiesForMarket(marketType: string): Promise<any[]> {
    const allStrategies = await this.getActiveStrategies();
    return allStrategies.filter(s => s.strategy_config.marketType === marketType);
  }
}

export const backgroundProcessManager = BackgroundProcessManager.getInstance();
