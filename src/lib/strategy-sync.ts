import { EventEmitter } from './event-emitter';
import { supabase } from './supabase';
import { logService } from './log-service';
import { v4 as uuidv4 } from 'uuid';
import { AIService } from Q Q './ai-service';
import type { Strategy } from './supabase-types';

class StrategySync extends EventEmitter {
  private static instance: StrategySync;
  private strategies = new Map<string, Strategy>();
  private syncInProgress = false;
  private initialized = false;
  private lastSyncTime = 0;
  private readonly SYNC_INTERVAL = 300000; // 5 minutes
  private syncIntervalId: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.setupRealtimeSubscription();
  }

  static getInstance(): StrategySync {
    if (!StrategySync.instance) {
      StrategySync.instance = new StrategySync();
    }
    return StrategySync.instance;
  }

  private setupRealtimeSubscription() {
    supabase
      .channel('strategy_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'strategies' },
        async (payload) => {
          try {
            switch (payload.eventType) {
              case 'DELETE':
                if (payload.old?.id) {
                  this.strategies.delete(payload.old.id);
                  this.emit('strategyDeleted', payload.old.id);
                  
                  // Force sync all components
                  await Promise.all([
                    marketService.syncStrategies(),
                    tradeManager.syncTrades()
                  ]);
                }
                break;
              case 'UPDATE':
              case 'INSERT':
                await this.initialize(); // Full sync
                break;
            }
          } catch (error) {
            logService.log('error', 'Error handling realtime update', error, 'StrategySync');
          }
        }
      )
      .subscribe();
  }

  private async handleRealtimeUpdate(payload: any) {
    try {
      switch (payload.eventType) {
        case 'INSERT': {
          if (this.strategies.has(payload.new.id)) {
            return;
          }

          try {
            const { data: strategy } = await supabase
              .from('strategies')
              .select('*')
              .eq('id', payload.new.id)
              .maybeSingle();

            if (strategy) {
              this.strategies.set(strategy.id, strategy);
              this.emit('strategyUpdated', strategy);
              logService.log('info', `Strategy ${strategy.id} added via realtime update`, strategy, 'StrategySync');
            }
          } catch (error: any) {
            if (error.code !== 'PGRST116') {
              logService.log('error', 'Error handling strategy insert', error, 'StrategySync');
            }
          }
          break;
        }
        case 'UPDATE': {
          try {
            const { data: strategy } = await supabase
              .from('strategies')
              .select('*')
              .eq('id', payload.new.id)
              .maybeSingle();

            if (strategy) {
              this.strategies.set(strategy.id, strategy);
              this.emit('strategyUpdated', strategy);
              logService.log('info', `Strategy ${strategy.id} updated via realtime update`, strategy, 'StrategySync');
            } else {
              this.strategies.delete(payload.new.id);
              this.emit('strategyDeleted', payload.new.id);
            }
          } catch (error: any) {
            if (error.code !== 'PGRST116') {
              logService.log('error', 'Error handling strategy update', error, 'StrategySync');
            }
          }
          break;
        }
        case 'DELETE':
          if (payload.old?.id) {
            this.strategies.delete(payload.old.id);
            this.emit('strategyDeleted', payload.old.id);
            logService.log('info', `Strategy ${payload.old.id} deleted via realtime update`, null, 'StrategySync');
          }
          break;
      }
    } catch (error) {
      logService.log('error', 'Error handling realtime update', error, 'StrategySync');
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized || this.syncInProgress) return;
    
    try {
      this.syncInProgress = true;
      logService.log('info', 'Initializing strategy sync', null, 'StrategySync');

      // Get all strategies
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Clear existing cache and update it with new strategies
      this.strategies.clear();
      if (strategies) {
        strategies.forEach(strategy => {
          this.strategies.set(strategy.id, strategy);
        });
      }

      this.lastSyncTime = Date.now();
      this.initialized = true;
      this.emit('syncComplete');

      // Start periodic sync
      this.startPeriodicSync();

      logService.log('info', 'Strategy sync initialized successfully', null, 'StrategySync');
    } catch (error) {
      logService.log('error', 'Failed to initialize strategy sync', error, 'StrategySync');
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  private startPeriodicSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }
    this.syncIntervalId = setInterval(() => {
      if (Date.now() - this.lastSyncTime >= this.SYNC_INTERVAL) {
        this.syncAll();
      }
    }, this.SYNC_INTERVAL);
  }

  async syncAll(): Promise<void> {
    if (this.syncInProgress) return;
    
    try {
      this.syncInProgress = true;
      logService.log('info', 'Starting full strategy sync', null, 'StrategySync');

      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Update cache with the latest strategies
      if (strategies) {
        this.strategies.clear();
        strategies.forEach(strategy => {
          this.strategies.set(strategy.id, strategy);
        });
      }

      this.lastSyncTime = Date.now();
      this.emit('syncComplete');
      logService.log('info', 'Full strategy sync completed', null, 'StrategySync');
    } catch (error) {
      logService.log('error', 'Failed to sync all strategies', error, 'StrategySync');
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  async createStrategy(data: {
    title: string;
    description: string | null;
    risk_level: string;
    user_id: string;
    type?: string;
    status?: string;
    performance?: number;
    strategy_config?: any;
  }): Promise<Strategy> {
    try {
      const strategyId = uuidv4();

      // Create strategy in database
      const { data: strategy, error } = await supabase
        .from('strategies')
        .insert({
          ...data,
          id: strategyId,
          type: data.type || 'custom',
          status: data.status || 'inactive',
          performance: data.performance || 0,
          strategy_config: data.strategy_config,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      if (!strategy) throw new Error('Failed to create strategy');

      // Add to local cache
      this.strategies.set(strategy.id, strategy);
      this.emit('strategyUpdated', strategy);

      logService.log('info', 'Created new strategy', strategy, 'StrategySync');
      return strategy;
    } catch (error) {
      logService.log('error', 'Failed to create strategy', error, 'StrategySync');
      throw error;
    }
  }

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy> {
    try {
      const { data: strategy, error } = await supabase
        .from('strategies')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        // Handle 406 errors for non-existent strategies
        if (error.code === 'PGRST116') {
          this.strategies.delete(id);
          throw new Error('Strategy not found');
        }
        throw error;
      }

      if (!strategy) {
        throw new Error('Strategy not found');
      }

      // Update local cache
      this.strategies.set(id, strategy);
      this.emit('strategyUpdated', strategy);

      logService.log('info', `Updated strategy ${id}`, strategy, 'StrategySync');
      return strategy;
    } catch (error) {
      logService.log('error', `Failed to update strategy ${id}`, error, 'StrategySync');
      throw error;
    }
  }

  async deleteStrategy(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('strategies')
        .delete()
        .eq('id', id);

      // Handle 406 errors silently for non-existent strategies
      if (error?.code === 'PGRST116') {
        this.strategies.delete(id);
        logService.log('info', `Strategy ${id} already deleted`, null, 'StrategySync');
        return;
      }

      if (error) throw error;

      // Remove from local cache
      this.strategies.delete(id);
      this.emit('strategyDeleted', id);

      logService.log('info', `Deleted strategy ${id}`, null, 'StrategySync');
    } catch (error) {
      logService.log('error', `Failed to delete strategy ${id}`, error, 'StrategySync');
      throw error;
    }
  }

  async clearAllStrategies(): Promise<void> {
    try {
      const { error } = await supabase
        .from('strategies')
        .delete()
        .neq('id', '');

      if (error) throw error;

      // Clear local cache
      this.strategies.clear();
      this.emit('allStrategiesCleared');

      logService.log('info', 'Cleared all strategies', null, 'StrategySync');
    } catch (error) {
      logService.log('error', 'Failed to clear all strategies', error, 'StrategySync');
      throw error;
    }
  }

  getAllStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  hasStrategy(id: string): boolean {
    return this.strategies.has(id);
  }

  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  isSyncing(): boolean {
    return this.syncInProgress;
  }

  cleanup() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    this.strategies.clear();
    this.syncInProgress = false;
    this.initialized = false;
    this.lastSyncTime = 0;
  }
}

export const strategySync = StrategySync.getInstance();
