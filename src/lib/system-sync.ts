import { exchangeService } from './exchange-service';
import { logService } from './log-service';
import { strategySync } from './strategy-sync';
import { templateSync } from './template-sync';
import { marketService } from './market-service';
import { analyticsService } from './analytics-service';
import { supabase } from './supabase';
import { EventEmitter } from 'events';
import { websocketService } from './websocket-service';
import { initializationProgress } from './initialization-progress';
import { monitoringService } from './monitoring-service';
import { tradeManager } from './trade-manager';

class SystemSync extends EventEmitter {
  private static instance: SystemSync;
  private syncInProgress = false;
  private lastSyncTime = 0;
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
  }

  static getInstance(): SystemSync {
    if (!SystemSync.instance) {
      SystemSync.instance = new SystemSync();
    }
    return SystemSync.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Reset initialization progress
      initializationProgress.reset();

      // Add initialization steps
      initializationProgress.addStep('exchange', 'Exchange Connection');
      initializationProgress.addStep('websocket', 'WebSocket Connection');
      initializationProgress.addStep('strategy', 'Strategy Sync');
      initializationProgress.addStep('template', 'Template Sync');
      initializationProgress.addStep('market', 'Market Data');
      initializationProgress.addStep('analytics', 'Analytics');
      initializationProgress.addStep('monitoring', 'Monitoring Service');

      // Initialize exchange service first
      initializationProgress.startStep('exchange');
      await this.initializeExchange();
      initializationProgress.completeStep('exchange');
      
      // Initialize WebSocket connection
      initializationProgress.startStep('websocket');
      websocketService.connect();
      initializationProgress.completeStep('websocket');
      
      // Initialize strategy and template sync
      initializationProgress.startStep('strategy');
      await strategySync.initialize();
      initializationProgress.completeStep('strategy');

      initializationProgress.startStep('template');
      await templateSync.initialize();
      initializationProgress.completeStep('template');
      
      // Initialize market service
      initializationProgress.startStep('market');
      await marketService.initialize();
      initializationProgress.completeStep('market');

      // Initialize analytics service
      initializationProgress.startStep('analytics');
      await analyticsService.initialize();
      initializationProgress.completeStep('analytics');
      
      // Initialize monitoring service
      initializationProgress.startStep('monitoring');
      await monitoringService.initialize();
      initializationProgress.completeStep('monitoring');
      
      // Perform initial sync
      await this.performFullSync();
      
      // Set up periodic sync
      this.startPeriodicSync();
      
      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (event) => {
        if (event === 'SIGNED_IN') {
          await this.performFullSync();
        }
      });

      logService.log('info', 'System sync initialized successfully', null, 'SystemSync');
    } catch (error) {
      logService.log('error', 'System initialization error', error, 'SystemSync');
      throw error;
    }
  }

  private async initializeExchange(): Promise<void> {
    try {
      initializationProgress.updateStep('exchange', 25, 'Checking stored credentials');
      
      // Check for stored credentials
      const credentials = exchangeService.getCredentials();
      
      if (credentials) {
        initializationProgress.updateStep('exchange', 50, 'Initializing with stored credentials');
        // Initialize with stored credentials
        await exchangeService.initializeExchange({
          name: 'bitmart',
          apiKey: credentials.credentials!.apiKey,
          secret: credentials.credentials!.secret,
          memo: credentials.credentials?.memo,
          testnet: false
        });
      } else {
        initializationProgress.updateStep('exchange', 50, 'Initializing in demo mode');
        // Initialize in demo mode
        await exchangeService.initializeExchange({
          name: 'bitmart',
          apiKey: 'demo',
          secret: 'demo',
          memo: 'demo',
          testnet: true
        });
      }

      initializationProgress.updateStep('exchange', 100, 'Exchange connection established');
    } catch (error) {
      initializationProgress.errorStep('exchange', 'Failed to initialize exchange');
      logService.log('warn', 'Exchange initialization error', error, 'SystemSync');
      
      // Fall back to demo mode
      await exchangeService.initializeExchange({
        name: 'bitmart',
        apiKey: 'demo',
        secret: 'demo',
        memo: 'demo',
        testnet: true
      });
    }
  }

  private async performFullSync(): Promise<void> {
    if (this.syncInProgress) return;
    
    this.syncInProgress = true;
    this.emit('syncStart');

    try {
      // Sync strategies and templates
      await Promise.all([
        strategySync.syncAll(),
        templateSync.syncAll()
      ]);
      
      // Sync trades
      await this.syncTrades();
      
      // Sync market data
      await this.syncMarketData();
      
      this.lastSyncTime = Date.now();
      this.emit('syncComplete');

      logService.log('info', 'Full sync completed successfully', null, 'SystemSync');
    } catch (error) {
      logService.log('error', 'Full sync error', error, 'SystemSync');
      this.emit('syncError', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncTrades(): Promise<void> {
    try {
      // Get all active strategies
      const strategies = strategySync.getAllStrategies().filter(s => s.status === 'active');
      
      for (const strategy of strategies) {
        try {
          // Get trades for each strategy
          const { data: trades } = await supabase
            .from('strategy_trades')
            .select('*')
            .eq('strategy_id', strategy.id)
            .eq('status', 'open');

          if (trades) {
            // Update trade analytics
            await analyticsService.trackStrategy(strategy);
          }
        } catch (error) {
          logService.log('warn', `Error syncing trades for strategy ${strategy.id}`, error, 'SystemSync');
        }
      }
    } catch (error) {
      logService.log('error', 'Trade sync error', error, 'SystemSync');
      throw error;
    }
  }
  private async syncMarketData(): Promise<void> {
    try {
      // Get all unique trading pairs from active strategies
      const strategies = strategySync.getAllStrategies().filter(s => s.status === 'active');
      
      const pairs = new Set<string>();
      strategies.forEach(strategy => {
        if (typeof strategy.strategy_config === 'object' && 
            strategy.strategy_config !== null && 
            'assets' in strategy.strategy_config &&
            Array.isArray(strategy.strategy_config.assets)) {
          strategy.strategy_config.assets.forEach((asset: string) => pairs.add(asset));
        }
      });

      // Update market data for each pair
      for (const pair of pairs) {
        try {
          const ticker = await exchangeService.fetchTicker(pair);
          marketService.processMarketData({
            symbol: pair,
            price: parseFloat(ticker.last_price),
            volume: parseFloat(ticker.quote_volume_24h),
            timestamp: Date.now()
          });

          // Subscribe to WebSocket updates for this pair
          websocketService.subscribe(pair, 'spot/ticker');
        } catch (error) {
          logService.log('warn', `Error updating market data for ${pair}`, error, 'SystemSync');
        }
      }
    } catch (error) {
      logService.log('error', 'Market data sync error', error, 'SystemSync');
      throw error;
    }
  }

  private startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.performFullSync();
    }, this.SYNC_INTERVAL);

    logService.log('info', `Started periodic sync every ${this.SYNC_INTERVAL/1000} seconds`, null, 'SystemSync');
  }

  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  isSyncing(): boolean {
    return this.syncInProgress;
  }

  cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    websocketService.disconnect();
    this.syncInProgress = false;
    this.lastSyncTime = 0;
  }

  async syncWithBackgroundProcess(): Promise<void> {
    try {
      // Get latest background process state
      const { data: processes } = await supabase
        .from('background_processes')
        .select('*')
        .eq('status', 'active')
        .order('last_heartbeat', { ascending: false })
        .limit(1);

      if (!processes || processes.length === 0) {
        throw new Error('No active background process found');
      }

      const activeProcess = processes[0];

      // Verify process health
      const heartbeatAge = Date.now() - new Date(activeProcess.last_heartbeat).getTime();
      if (heartbeatAge > 60000) { // 1 minute
        throw new Error('Background process heartbeat is stale');
      }

      // Sync all active strategies
      const { data: strategies } = await supabase
        .from('strategies')
        .select('*')
        .eq('status', 'active');

      if (strategies) {
        await Promise.all(strategies.map(async (strategy) => {
          // Sync strategy state
          await strategySync.syncStrategy(strategy);

          // Sync trades
          await tradeManager.syncStrategyTrades(strategy.id);

          // Sync monitoring status
          // Get current monitoring status
          const status = await monitoringService.getMonitoringStatus(strategy.id);
          if (status) {
            await monitoringService.updateMonitoringStatus(strategy.id, {
              status: status.status,
              message: status.message,
              progress: status.progress,
              indicators: status.indicators,
              conditions: status.conditions,
              market_conditions: status.market_conditions,
              next_check: status.next_check
            });
          } else {
            // Initialize monitoring status if none exists
            await monitoringService.updateMonitoringStatus(strategy.id, {
              status: 'idle'
            });
          }
        }));
      }

      logService.log('info', 'Successfully synchronized with background process', 
        { processId: activeProcess.process_id }, 'SystemSync');
    } catch (error) {
      logService.log('error', 'Failed to sync with background process', error, 'SystemSync');
      throw error;
    }
  }
}

export const systemSync = SystemSync.getInstance();
