import { EventEmitter } from './event-emitter';
import { supabase } from './supabase';
import { strategyMonitor } from './strategy-monitor';
import { tradeManager } from './trade-manager';
import { marketMonitor } from './market-monitor';
import { logService } from './log-service';
import { monitoringService } from './monitoring-service';
import { aiTradeService } from './ai-trade-service';
import { config } from '../../backend/config';

class BackgroundProcessManager extends EventEmitter {
  private static instance: BackgroundProcessManager;
  private isRunning = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = config.healthCheckInterval;
  private readonly MAX_STRATEGIES = config.maxStrategiesPerProcess;
  private readonly RECOVERY_ATTEMPTS = config.recoveryAttempts;
  private readonly PROCESS_ID = `bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  private constructor() {
    super();
    this.setupErrorHandling();
  }

  static getInstance(): BackgroundProcessManager {
    if (!BackgroundProcessManager.instance) {
      BackgroundProcessManager.instance = new BackgroundProcessManager();
    }
    return BackgroundProcessManager.instance;
  }

  private setupErrorHandling() {
    process.on('uncaughtException', this.handleError.bind(this));
    process.on('unhandledRejection', this.handleError.bind(this));
  }

  private async handleError(error: Error) {
    try {
      await logService.log('error', 'Critical background process error', error, 'BackgroundProcessManager');
      await this.updateProcessStatus('error', error.message);
      
      // Attempt recovery
      await this.restartProcess();
    } catch (recoveryError) {
      console.error('Failed to handle critical error:', recoveryError);
      process.exit(1);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      await this.registerProcess();
      this.isRunning = true;

      // Initialize core services
      await Promise.all([
        marketMonitor.initialize(),
        tradeManager.initialize(),
        strategyMonitor.initialize(),
        monitoringService.initialize()
      ]);

      // Start health check
      this.startHealthCheck();

      // Start continuous monitoring
      await this.startContinuousMonitoring();

      logService.log('info', 'Background process manager started successfully', 
        { processId: this.PROCESS_ID }, 'BackgroundProcessManager');
    } catch (error) {
      await this.handleError(error as Error);
    }
  }

  private async registerProcess(): Promise<void> {
    const { error } = await supabase
      .from('background_processes')
      .upsert({
        process_id: this.PROCESS_ID,
        status: 'active',
        last_heartbeat: new Date().toISOString(),
        error_count: 0
      });

    if (error) throw error;
  }

  private async updateProcessStatus(status: 'active' | 'error' | 'stopped', errorMessage?: string): Promise<void> {
    const { error } = await supabase
      .from('background_processes')
      .update({
        status,
        last_heartbeat: new Date().toISOString(),
        last_error: errorMessage,
        error_count: errorMessage ? supabase.rpc('increment_error_count') : undefined
      })
      .eq('process_id', this.PROCESS_ID);

    if (error) throw error;
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.updateProcessStatus('active');
        await this.checkSystemHealth();
      } catch (error) {
        await this.handleError(error as Error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private async checkSystemHealth(): Promise<void> {
    // Verify all critical services are running
    const healthChecks = await Promise.all([
      marketMonitor.checkHealth(),
      tradeManager.checkHealth(),
      strategyMonitor.checkHealth(),
      monitoringService.checkHealth()
    ]);

    const unhealthyServices = healthChecks.filter(check => !check.healthy);
    if (unhealthyServices.length > 0) {
      throw new Error(`Unhealthy services detected: ${unhealthyServices.map(s => s.service).join(', ')}`);
    }
  }

  private async startContinuousMonitoring(): Promise<void> {
    // Load all active strategies with limit
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('status', 'active')
      .limit(this.MAX_STRATEGIES);

    if (error) throw error;

    if (!strategies) return;

    if (strategies.length >= this.MAX_STRATEGIES) {
      logService.log('warn', `Maximum strategy limit reached (${this.MAX_STRATEGIES})`, 
        null, 'BackgroundProcessManager');
    }

    // Initialize monitoring for each strategy
    await Promise.all(strategies.map(async (strategy) => {
      try {
        // Start market monitoring
        await marketMonitor.addStrategy(strategy);

        // Initialize trade monitoring
        await tradeManager.initializeStrategy(strategy);

        // Start continuous market fit analysis
        await this.startMarketFitAnalysis(strategy);

        logService.log('info', `Initialized monitoring for strategy ${strategy.id}`, 
          { strategy: strategy.id }, 'BackgroundProcessManager');
      } catch (error) {
        logService.log('error', `Failed to initialize strategy ${strategy.id}`, error, 'BackgroundProcessManager');
      }
    }));
  }

  private async startMarketFitAnalysis(strategy: any): Promise<void> {
    const MARKET_FIT_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

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
    }, MARKET_FIT_CHECK_INTERVAL);
  }

  private async handlePoorMarketFit(strategy: any, analysis: any): Promise<void> {
    try {
      // Log the issue
      await logService.log('warn', `Poor market fit detected for strategy ${strategy.id}`, 
        { analysis }, 'BackgroundProcessManager');

      // Update strategy status
      await supabase
        .from('strategies')
        .update({
          status: 'paused',
          pause_reason: 'Poor market fit detected',
          paused_at: new Date().toISOString()
        })
        .eq('id', strategy.id);

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

  private async restartProcess(): Promise<void> {
    try {
      this.isRunning = false;
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      let attempts = 0;
      while (attempts < this.RECOVERY_ATTEMPTS) {
        try {
          attempts++;
          await this.start();
          logService.log('info', 'Process successfully restarted', 
            { attempt: attempts }, 'BackgroundProcessManager');
          return;
        } catch (error) {
          logService.log('error', `Restart attempt ${attempts} failed`, 
            error, 'BackgroundProcessManager');
          if (attempts === this.RECOVERY_ATTEMPTS) {
            throw error;
          }
          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      await logService.log('error', 'Failed to restart process after multiple attempts', 
        error, 'BackgroundProcessManager');
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    try {
      this.isRunning = false;
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      await this.updateProcessStatus('stopped');
      
      // Clean up resources
      await Promise.all([
        marketMonitor.cleanup(),
        tradeManager.cleanup(),
        strategyMonitor.cleanup(),
        monitoringService.cleanup()
      ]);

      logService.log('info', 'Background process manager stopped successfully', 
        { processId: this.PROCESS_ID }, 'BackgroundProcessManager');
    } catch (error) {
      await this.handleError(error as Error);
    }
  }
}

export const backgroundProcessManager = BackgroundProcessManager.getInstance();
