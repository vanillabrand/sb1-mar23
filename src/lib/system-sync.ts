import { supabase } from './supabase';
import { exchangeService } from './exchange-service';
import { marketService } from './market-service';
import { analyticsService } from './analytics-service';
import { strategySync } from './strategy-sync';
import { templateSync } from './template-sync';
import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { websocketService } from './websocket-service';
import { initializationProgress } from './initialization-progress';
import { monitoringService } from './monitoring-service';

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
          apiKey: credentials.apiKey,
          secret: credentials.secret,
          memo: credentials.memo,
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
            await analyticsService.updateTradeMetrics(strategy.id, trades);
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
        if (strategy.strategy_config?.assets) {
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
}

export const systemSync = SystemSync.getInstance();