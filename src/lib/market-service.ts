import { EventEmitter } from './event-emitter';
import { tradeGenerator } from './trade-generator';
import { tradeManager } from './trade-manager';
import { marketMonitor } from './market-monitor';
import { analyticsService } from './analytics-service';
import { tradeService } from './trade-service';
import { supabase } from './supabase';
import { logService } from './log-service';
import type { Strategy } from './supabase-types';
import type { MarketData } from './types';

class MarketService extends EventEmitter {
  private static instance: MarketService;
  private strategies: Map<string, Strategy> = new Map();
  private monitoredAssets: Set<string> = new Set();
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    super();
    this.setupEventListeners();
  }

  static getInstance(): MarketService {
    if (!MarketService.instance) {
      MarketService.instance = new MarketService();
    }
    return MarketService.instance;
  }

  private setupEventListeners() {
    tradeGenerator.on('tradeOpportunity', (data) => {
      this.emit('tradeOpportunity', data);
    });

    tradeManager.on('tradeExecuted', (data) => {
      this.emit('tradeExecuted', data);
      this.emit('strategyUpdate', { strategyId: data.trade.strategy_id });
    });

    marketMonitor.on('marketUpdate', (data) => {
      this.emit('marketUpdate', data);
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        logService.log('info', 'Initializing market service', null, 'MarketService');

        // Initialize required services in parallel
        await Promise.all([
          marketMonitor.initialize(),
          analyticsService.initialize(),
          tradeManager.initialize(),
          tradeGenerator.initialize()
        ]);

        // Load active strategies
        const { data: strategies } = await supabase
          .from('strategies')
          .select('*')
          .eq('status', 'active');

        if (strategies) {
          // Initialize monitoring for each active strategy
          for (const strategy of strategies) {
            await this.trackStrategy(strategy);
          }
        }

        this.isInitialized = true;
        logService.log('info', 'Market service initialized successfully', null, 'MarketService');
        resolve();
      } catch (error) {
        this.isInitialized = false;
        logService.log('error', 'Failed to initialize market service', error, 'MarketService');
        reject(error);
      } finally {
        this.initializationPromise = null;
      }
    });

    return this.initializationPromise;
  }

  private async trackStrategy(strategy: Strategy) {
    try {
      if (!strategy.strategy_config?.assets) {
        throw new Error('Strategy has no configured trading pairs');
      }

      // Store strategy
      this.strategies.set(strategy.id, strategy);

      // Add all strategy assets to monitoring
      for (const asset of strategy.strategy_config.assets) {
        await this.addAsset(asset);
      }

      // Initialize services
      await Promise.all([
        tradeGenerator.addStrategy(strategy),
        tradeManager.initializeStrategy(strategy),
        analyticsService.trackStrategy(strategy)
      ]);

      logService.log('info', `Successfully started monitoring for strategy: ${strategy.id}`, null, 'MarketService');
    } catch (error) {
      logService.log('error', `Failed to track strategy: ${strategy.id}`, error, 'MarketService');
      // Clean up if initialization fails
      this.strategies.delete(strategy.id);
      throw error;
    }
  }

  async addAsset(symbol: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logService.log('info', `Adding asset to monitor: ${symbol}`, null, 'MarketService');

      this.monitoredAssets.add(symbol);
      await marketMonitor.addAsset(symbol);

      logService.log('info', `Successfully added asset: ${symbol}`, null, 'MarketService');
    } catch (error) {
      logService.log('error', `Failed to add asset: ${symbol}`, error, 'MarketService');
      throw error;
    }
  }

  async removeAsset(symbol: string): Promise<void> {
    try {
      logService.log('info', `Removing asset from monitor: ${symbol}`, null, 'MarketService');

      this.monitoredAssets.delete(symbol);
      marketMonitor.removeAsset(symbol);

      logService.log('info', `Successfully removed asset: ${symbol}`, null, 'MarketService');
    } catch (error) {
      logService.log('error', `Failed to remove asset: ${symbol}`, error, 'MarketService');
      throw error;
    }
  }

  async startStrategyMonitoring(strategy: Strategy): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logService.log('info', `Starting monitoring for strategy: ${strategy.id}`, null, 'MarketService');

      // Ensure strategy is not already being monitored
      if (this.strategies.has(strategy.id)) {
        await this.stopStrategyMonitoring(strategy.id);
      }

      // Validate strategy configuration
      if (!strategy.strategy_config?.assets || strategy.strategy_config.assets.length === 0) {
        throw new Error('Strategy has no configured trading pairs');
      }

      // Store strategy
      this.strategies.set(strategy.id, strategy);

      // Add all strategy assets to monitoring first
      for (const asset of strategy.strategy_config.assets) {
        await this.addAsset(asset);
      }

      // Initialize services after assets are monitored
      await Promise.all([
        tradeGenerator.addStrategy(strategy),
        tradeManager.initializeStrategy(strategy),
        analyticsService.trackStrategy(strategy)
      ]);

      logService.log('info', `Successfully started monitoring for strategy: ${strategy.id}`, null, 'MarketService');
      this.emit('strategyUpdate', { strategyId: strategy.id, status: 'active' });
    } catch (error) {
      logService.log('error', `Failed to start monitoring for strategy: ${strategy.id}`, error, 'MarketService');
      // Clean up if initialization fails
      this.strategies.delete(strategy.id);
      throw error;
    }
  }

  async stopStrategyMonitoring(strategyId: string): Promise<void> {
    try {
      logService.log('info', `Stopping monitoring for strategy: ${strategyId}`, null, 'MarketService');

      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        // Handle non-existent strategy silently
        logService.log('info', `Strategy ${strategyId} not found, already stopped`, null, 'MarketService');
        return;
      }

      // Remove strategy assets from monitoring if no other strategy uses them
      if (strategy.strategy_config?.assets) {
        for (const asset of strategy.strategy_config.assets) {
          const isUsedByOtherStrategy = Array.from(this.strategies.values())
            .some(s => s.id !== strategyId && s.strategy_config?.assets?.includes(asset));

          if (!isUsedByOtherStrategy) {
            await this.removeAsset(asset);
          }
        }
      }

      // Remove from trade generator
      tradeGenerator.removeStrategy(strategyId);

      // Close all open trades
      const openTrades = tradeManager.getActiveTradesForStrategy(strategyId);
      for (const trade of openTrades) {
        await tradeManager.closeTrade(trade.id);
      }

      // Clear strategy budget
      await tradeService.setBudget(strategyId, null);

      // Remove from monitored strategies
      this.strategies.delete(strategyId);

      logService.log('info', `Successfully stopped monitoring for strategy: ${strategyId}`, null, 'MarketService');
      this.emit('strategyUpdate', { strategyId, status: 'inactive' });
    } catch (error) {
      logService.log('error', `Failed to stop monitoring for strategy: ${strategyId}`, error, 'MarketService');
      throw error;
    }
  }

  async deleteStrategy(strategyId: string): Promise<void> {
    try {
      logService.log('info', `Starting deletion process for strategy ${strategyId}`, null, 'MarketService');
      
      // Emit deletion event immediately to update UI
      this.emit('strategyDeleted', strategyId);
      
      // Clean up local state immediately
      this.strategies.delete(strategyId);

      // Stop monitoring if active
      if (this.isStrategyActive(strategyId)) {
        await this.stopStrategyMonitoring(strategyId);
      }

      // Clear budget
      await tradeService.setBudget(strategyId, null);

      // Delete strategy and all related data
      const { error: deleteError } = await supabase
        .from('strategies')
        .delete()
        .eq('id', strategyId);

      if (deleteError) {
        throw deleteError;
      }

      logService.log('info', `Successfully deleted strategy ${strategyId}`, null, 'MarketService');
    } catch (error) {
      // Restore local state if deletion failed
      const { data: strategy } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', strategyId)
        .single();

      if (strategy) {
        this.strategies.set(strategyId, strategy);
        this.emit('strategyUpdated', strategy);
      }
      
      logService.log('error', `Error deleting strategy ${strategyId}:`, error, 'MarketService');
      throw error;
    }
  }

  processMarketData(data: MarketData): void {
    this.emit('marketData', data);
  }

  isStrategyActive(strategyId: string): boolean {
    return this.strategies.has(strategyId);
  }

  getActiveStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  getMonitoredAssets(): string[] {
    return Array.from(this.monitoredAssets);
  }

  cleanup() {
    for (const strategyId of this.strategies.keys()) {
      this.stopStrategyMonitoring(strategyId).catch(error => {
        logService.log('error', `Failed to clean up strategy: ${strategyId}`, error, 'MarketService');
      });
    }

    this.strategies.clear();
    this.monitoredAssets.clear();
    this.isInitialized = false;

    // Clean up all services
    tradeGenerator.cleanup();
    tradeManager.cleanup();
    marketMonitor.cleanup();
    analyticsService.cleanup();
    tradeService.clearAllBudgets();
  }
}

export const marketService = MarketService.getInstance();