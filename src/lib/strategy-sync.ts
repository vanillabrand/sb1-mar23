import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { supabase } from './supabase';
import { strategyService } from './strategy-service';
import { eventBus } from './event-bus';
import { v4 as uuidv4 } from 'uuid';
import { AIService } from './ai-service';
import type { Strategy } from './supabase-types';
import { CreateStrategyData } from '../lib/types';

/**
 * Manages synchronization of trading strategies with a remote database.
 *
 * Provides a singleton class for handling real-time strategy updates,
 * including creating, updating, deleting, and tracking strategies.
 * Maintains a local cache of strategies and handles periodic synchronization.
 */
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
        this.handleRealtimeUpdate.bind(this)
      )
      .subscribe();

    console.log('Realtime subscription for strategies set up');
  }

  private async handleRealtimeUpdate(payload: any) {
    try {
      console.log('Realtime strategy update received:', payload.eventType, payload);

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
              // Add to local cache
              this.strategies.set(strategy.id, strategy);

              // Emit events
              this.emit('strategyCreated', strategy);
              eventBus.emit('strategy:created', { strategy });

              // Dispatch DOM event for legacy components
              document.dispatchEvent(new CustomEvent('strategy:create', {
                detail: { strategy }
              }));

              // Broadcast updated strategies list
              this.broadcastStrategiesUpdate();

              logService.log('info', `Strategy ${strategy.id} added via realtime update`, strategy, 'StrategySync');
            }
          } catch (error: any) {
            if (error.code !== 'PGRST116') {
              console.error('Error handling strategy insert:', error);
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
              // Update local cache
              this.strategies.set(strategy.id, strategy);

              // Emit events
              this.emit('strategyUpdated', strategy);
              eventBus.emit('strategy:updated', { strategy });

              // Dispatch DOM event for legacy components
              document.dispatchEvent(new CustomEvent('strategy:update', {
                detail: { strategy }
              }));

              // Broadcast updated strategies list
              this.broadcastStrategiesUpdate();

              logService.log('info', `Strategy ${strategy.id} updated via realtime update`, strategy, 'StrategySync');
            } else {
              this.strategies.delete(payload.new.id);
              this.emit('strategyDeleted', payload.new.id);
            }
          } catch (error: any) {
            if (error.code !== 'PGRST116') {
              console.error('Error handling strategy update:', error);
              logService.log('error', 'Error handling strategy update', error, 'StrategySync');
            }
          }
          break;
        }
        case 'DELETE':
          if (payload.old?.id) {
            // Remove from local cache
            this.strategies.delete(payload.old.id);

            // Emit events
            this.emit('strategyDeleted', payload.old.id);
            eventBus.emit('strategy:deleted', { strategyId: payload.old.id });

            // Dispatch DOM event for legacy components
            document.dispatchEvent(new CustomEvent('strategy:remove', {
              detail: { id: payload.old.id }
            }));

            // Force sync all components
            await Promise.all([
              (await import('./market-service')).marketService.initialize(),
              (await import('./trade-manager')).tradeManager.getActiveTradesForStrategy(payload.old.id)
            ]);

            // Broadcast updated strategies list
            this.broadcastStrategiesUpdate();

            logService.log('info', `Strategy ${payload.old.id} deleted via realtime update`, null, 'StrategySync');
          }
          break;
      }
    } catch (error) {
      console.error('Error handling realtime strategy update:', error);
      logService.log('error', 'Error handling realtime update', error, 'StrategySync');
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized || this.syncInProgress) {
      console.log('Strategy sync already initialized or in progress, skipping');
      // Don't force a refresh to avoid infinite loops
      return;
    }

    try {
      this.syncInProgress = true;
      console.log('Initializing strategy sync');
      logService.log('info', 'Initializing strategy sync', null, 'StrategySync');

      // Get current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user?.id) {
        console.warn('No authenticated user found, initializing in demo mode');
        logService.log('warn', 'No authenticated user found, initializing in demo mode', null, 'StrategySync');

        // Initialize with empty strategies instead of throwing an error
        this.strategies.clear();
        this.lastSyncTime = Date.now();
        this.initialized = true;
        this.emit('syncComplete');

        // Start periodic sync anyway to check for authentication later
        this.startPeriodicSync();

        return;
      }

      const userId = session.user.id;
      console.log(`Fetching strategies for user ${userId}`);
      logService.log('info', `Fetching strategies for user ${userId}`, null, 'StrategySync');

      // Get all strategies for the current user
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching strategies:', error);
        throw error;
      }

      // Clear existing cache and update it with new strategies
      this.strategies.clear();
      if (strategies) {
        strategies.forEach(strategy => {
          this.strategies.set(strategy.id, strategy);
        });
        console.log(`Loaded ${strategies.length} strategies for user ${userId}`);
        logService.log('info', `Loaded ${strategies.length} strategies for user ${userId}`, null, 'StrategySync');
      } else {
        console.log(`No strategies found for user ${userId}`);
        logService.log('info', `No strategies found for user ${userId}`, null, 'StrategySync');
      }

      this.lastSyncTime = Date.now();
      this.initialized = true;
      this.emit('syncComplete');

      // Broadcast the initial strategies list once
      this.broadcastStrategiesUpdate();

      // Start periodic sync
      this.startPeriodicSync();

      console.log('Strategy sync initialized successfully');
      logService.log('info', 'Strategy sync initialized successfully', null, 'StrategySync');
    } catch (error) {
      console.error('Failed to initialize strategy sync:', error);
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
    if (this.syncInProgress) {
      console.log('Strategy sync already in progress, skipping');
      return;
    }

    try {
      this.syncInProgress = true;
      console.log('Starting full strategy sync');
      logService.log('info', 'Starting full strategy sync', null, 'StrategySync');

      // Get current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user?.id) {
        throw new Error('No authenticated user found');
      }

      const userId = session.user.id;
      console.log(`Syncing strategies for user ${userId}`);
      logService.log('info', `Syncing strategies for user ${userId}`, null, 'StrategySync');

      // Get all strategies for the current user
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching strategies:', error);
        throw error;
      }

      // Check if there are any changes before updating
      let hasChanges = false;

      // First check if the number of strategies has changed
      if (strategies?.length !== this.strategies.size) {
        hasChanges = true;
        console.log(`Strategy count changed: DB=${strategies?.length || 0}, Cache=${this.strategies.size}`);
      }

      // Update cache with the latest strategies
      if (strategies) {
        // Clear the cache and update with fresh data
        this.strategies.clear();
        strategies.forEach(strategy => {
          this.strategies.set(strategy.id, strategy);
        });

        console.log(`Synced ${strategies.length} strategies for user ${userId}`);
        logService.log('info', `Synced ${strategies.length} strategies for user ${userId}`, null, 'StrategySync');

        // Always broadcast updates after a full sync
        hasChanges = true;
      } else {
        console.log(`No strategies found for user ${userId}`);
        logService.log('info', `No strategies found for user ${userId}`, null, 'StrategySync');

        // If we had strategies before but now have none, that's a change
        if (this.strategies.size > 0) {
          hasChanges = true;
          this.strategies.clear();
        }
      }

      this.lastSyncTime = Date.now();
      this.emit('syncComplete');

      // Broadcast updates if there were changes
      if (hasChanges) {
        console.log('Changes detected, broadcasting updated strategies list');
        this.broadcastStrategiesUpdate();
      } else {
        console.log('No changes detected in strategies');
      }

      logService.log('info', 'Full strategy sync completed', null, 'StrategySync');
    } catch (error) {
      console.error('Failed to sync all strategies:', error);
      logService.log('error', 'Failed to sync all strategies', error, 'StrategySync');
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  async createStrategy(data: CreateStrategyData): Promise<Strategy> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user?.id) {
        throw new Error('No authenticated user found');
      }

      // Generate a UUID for the strategy
      const strategyId = uuidv4();

      // Make sure title is properly capitalized
      const capitalizedTitle = data.title
        ? data.title.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        : 'New Strategy';

      // Ensure we have all required fields with proper defaults
      const strategyData = {
        id: strategyId, // Explicitly set ID to avoid null ID issues
        ...data,
        user_id: session.user.id,
        title: capitalizedTitle, // Use capitalized title
        name: data.name || capitalizedTitle, // Use capitalized title as fallback for name
        description: data.description || '',
        type: data.type || 'custom',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: data.status || 'inactive',
        performance: 0,
        // Ensure selected_pairs is properly formatted
        selected_pairs: Array.isArray(data.selected_pairs)
          ? data.selected_pairs.map(pair =>
              pair.includes('_') ? pair.replace('_', '/') : pair
            )
          : ['BTC/USDT'],
        strategy_config: data.strategy_config || {},
      };

      // Set risk_level for database compatibility - ensure both camelCase and snake_case versions
      const riskLevel = data.riskLevel || data.risk_level || 'Medium';
      strategyData.riskLevel = riskLevel;
      strategyData.risk_level = riskLevel;

      // Log the data we're trying to insert
      console.log('Creating strategy with data:', strategyData);

      // Log detailed information about the strategy data for debugging
      logService.log('info', 'Creating strategy with detailed data', {
        id: strategyData.id,
        user_id: strategyData.user_id,
        title: strategyData.title,
        name: strategyData.name,
        risk_level: strategyData.risk_level,
        riskLevel: strategyData.riskLevel,
        type: strategyData.type,
        status: strategyData.status,
        selected_pairs_count: strategyData.selected_pairs?.length || 0,
        has_strategy_config: !!strategyData.strategy_config
      }, 'StrategySync');

      // Try to create the strategy
      const { data: strategy, error } = await supabase
        .from('strategies')
        .insert(strategyData)
        .select()
        .single();

      if (error) {
        // Log detailed error information
        logService.log('error', 'Failed to create strategy in database', {
          error_code: error.code,
          error_message: error.message,
          error_details: error.details,
          error_hint: error.hint,
          userId: session.user.id,
          strategy_id: strategyId,
          title: strategyData.title,
          name: strategyData.name
        }, 'StrategySync');

        // Log the specific error for debugging
        logService.log('error', 'Failed to create strategy', error, 'StrategySync');

        // If we get any error, try a more minimal approach
        logService.log('warn', 'Error creating strategy, trying fallback approach', error, 'StrategySync');

        // Try with minimal data but keep the same ID
        const minimalData = {
            id: strategyId, // Keep the same ID
            user_id: session.user.id,
            title: capitalizedTitle, // Use the same capitalized title
            name: data.name || capitalizedTitle, // Use capitalized title as fallback for name
            description: data.description || '',
            type: data.type || 'custom',
            status: data.status || 'inactive',
            risk_level: riskLevel, // Use the same risk level
            riskLevel: riskLevel, // Include both versions for compatibility
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          console.log('Trying with minimal data:', minimalData);

          const { data: minimalStrategy, error: minimalError } = await supabase
            .from('strategies')
            .insert(minimalData)
            .select()
            .single();

          if (minimalError) {
            logService.log('error', 'Failed to create strategy with minimal data', minimalError, 'StrategySync');
            throw minimalError;
          }

          logService.log('info', 'Successfully created strategy with minimal data', null, 'StrategySync');
          return minimalStrategy;
      }

      if (!strategy) {
        // If no strategy was returned but no error occurred, create a fallback strategy object
        // Make sure all required fields are explicitly set
        const fallbackStrategy = {
          id: strategyId,
          user_id: session.user.id,
          title: capitalizedTitle,
          name: data.name || capitalizedTitle,
          description: data.description || '',
          type: data.type || 'custom',
          status: data.status || 'inactive',
          risk_level: riskLevel,
          riskLevel: riskLevel,
          selected_pairs: Array.isArray(data.selected_pairs)
            ? data.selected_pairs.map(pair =>
                pair.includes('_') ? pair.replace('_', '/') : pair
              )
            : ['BTC/USDT'],
          strategy_config: data.strategy_config || {},
          performance: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as Strategy;

        logService.log('warn', 'No strategy returned from database, using fallback', { fallbackStrategy }, 'StrategySync');

        // Update local cache with the fallback strategy
        this.strategies.set(strategyId, fallbackStrategy);

        // Emit events with the fallback strategy
        this.emit('strategyCreated', fallbackStrategy);
        eventBus.emit('strategy:created', fallbackStrategy);
        eventBus.emit('strategy:created', { strategy: fallbackStrategy });

        // Broadcast updated strategies list
        this.broadcastStrategiesUpdate();

        return fallbackStrategy;
      }

      // Update local cache
      this.strategies.set(strategy.id, strategy);

      // Emit events
      this.emit('strategyCreated', strategy);

      // Emit both the strategy object and an object with strategy property for compatibility
      eventBus.emit('strategy:created', strategy);
      eventBus.emit('strategy:created', { strategy });

      // Broadcast updated strategies list to ensure all components are in sync
      this.broadcastStrategiesUpdate();

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
      // First, remove from local cache immediately for responsive UI
      this.strategies.delete(id);

      // Then delete from database
      const { error } = await supabase
        .from('strategies')
        .delete()
        .eq('id', id);

      // Handle 406 errors silently for non-existent strategies
      if (error?.code === 'PGRST116') {
        logService.log('info', `Strategy ${id} already deleted`, null, 'StrategySync');
      } else if (error) {
        throw error;
      }

      logService.log('info', `Deleted strategy ${id}`, null, 'StrategySync');

      // Emit event to update UI - only emit once after database operation
      this.emit('strategyDeleted', id);
      eventBus.emit('strategy:deleted', { strategyId: id });

      // Broadcast updated strategies list once
      this.broadcastStrategiesUpdate();
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

  getStrategies(): Strategy[] {
    return this.getAllStrategies();
  }

  getAllStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Broadcasts the current strategies list to all subscribers
   * This ensures all components have the most up-to-date list
   */
  // Debounce timer for strategy updates
  private broadcastDebounceTimer: NodeJS.Timeout | null = null;
  private lastBroadcastTime = 0;
  private pendingBroadcast = false;
  private readonly DEBOUNCE_DELAY = 500; // Increased to 500ms to reduce flickering

  broadcastStrategiesUpdate(): void {
    try {
      // Set pending flag to track if we have a broadcast waiting
      this.pendingBroadcast = true;

      // Clear any pending broadcast
      if (this.broadcastDebounceTimer) {
        clearTimeout(this.broadcastDebounceTimer);
        this.broadcastDebounceTimer = null;
      }

      // Always use debounce to prevent rapid UI updates
      this.broadcastDebounceTimer = setTimeout(() => {
        this.doBroadcastStrategiesUpdate();
      }, this.DEBOUNCE_DELAY);

    } catch (error) {
      console.error('Error in broadcast strategy update:', error);
      logService.log('error', 'Error in broadcast strategy update', error, 'StrategySync');
    }
  }

  private doBroadcastStrategiesUpdate(): void {
    try {
      // Only proceed if we have a pending broadcast
      if (!this.pendingBroadcast) {
        return;
      }

      const strategies = this.getAllStrategies();
      console.log(`Broadcasting updated strategies list (${strategies.length} strategies)`);

      // Update last broadcast time
      this.lastBroadcastTime = Date.now();

      // Clear pending flag
      this.pendingBroadcast = false;

      // Sort strategies by creation date (newest first) to ensure consistent order
      const sortedStrategies = [...strategies].sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      // Ensure all strategies have required fields
      const completeStrategies = sortedStrategies.map(strategy => {
        return {
          ...strategy,
          name: strategy.name || strategy.title,
          title: strategy.title || strategy.name,
          description: strategy.description || '',
          riskLevel: strategy.risk_level || strategy.riskLevel || 'Medium',
          risk_level: strategy.risk_level || strategy.riskLevel || 'Medium',
          marketType: strategy.market_type || strategy.marketType || 'spot',
          market_type: strategy.market_type || strategy.marketType || 'spot',
          status: strategy.status || 'inactive',
          type: strategy.type || 'custom',
          selected_pairs: strategy.selected_pairs || ['BTC/USDT'],
          strategy_config: strategy.strategy_config || strategy.strategyConfig || {},
          created_at: strategy.created_at || new Date().toISOString(),
          updated_at: strategy.updated_at || new Date().toISOString()
        };
      });

      // Emit through the event bus for React components
      eventBus.emit('strategies:updated', completeStrategies);

      // Dispatch DOM event for legacy components
      document.dispatchEvent(new CustomEvent('strategies:updated', {
        detail: { strategies: completeStrategies }
      }));

      // Also emit through the EventEmitter for direct subscribers
      this.emit('strategiesUpdated', completeStrategies);

      // Emit app:state:updated for global state listeners
      eventBus.emit('app:state:updated', {
        component: 'strategy',
        action: 'updated',
        strategies: completeStrategies
      });

      // Schedule multiple follow-up broadcasts to ensure UI is updated
      // This helps with race conditions where components might miss the first update
      const broadcastDelays = [500, 1500, 3000];

      broadcastDelays.forEach(delay => {
        setTimeout(() => {
          if (!this.pendingBroadcast) {
            console.log(`Delayed broadcast of updated strategies (${delay}ms)`);
            eventBus.emit('strategies:updated', completeStrategies);

            // Also dispatch DOM event for legacy components
            document.dispatchEvent(new CustomEvent('strategies:updated', {
              detail: { strategies: completeStrategies }
            }));
          }
        }, delay);
      });

    } catch (error) {
      console.error('Error broadcasting strategies update:', error);
      logService.log('error', 'Error broadcasting strategies update', error, 'StrategySync');
      this.pendingBroadcast = false;
    }
  }

  hasStrategy(id: string): boolean {
    return this.strategies.has(id);
  }

  /**
   * Manually remove a strategy from the cache
   * This is useful when a strategy is deleted but still appears in the UI
   */
  removeStrategyFromCache(id: string): void {
    if (this.strategies.has(id)) {
      console.log(`Manually removing strategy ${id} from cache`);
      this.strategies.delete(id);

      // Broadcast the updated strategies list only
      // This is sufficient to update all UI components
      this.broadcastStrategiesUpdate();
    } else {
      console.log(`Strategy ${id} not found in cache, nothing to remove`);
    }
  }

  /**
   * Manually add a strategy to the cache
   * This is useful when a strategy is created but doesn't appear in the UI
   */
  addStrategyToCache(strategy: Strategy): void {
    try {
      if (!strategy || !strategy.id) {
        console.error('Attempted to add invalid strategy to cache:', strategy);
        return;
      }

      // Ensure the strategy has all required fields
      const completeStrategy = {
        ...strategy,
        // Convert snake_case to camelCase for compatibility
        name: strategy.name || strategy.title,
        title: strategy.title || strategy.name,
        description: strategy.description || '',
        riskLevel: strategy.risk_level || strategy.riskLevel || 'Medium',
        risk_level: strategy.risk_level || strategy.riskLevel || 'Medium',
        marketType: strategy.market_type || strategy.marketType || 'spot',
        market_type: strategy.market_type || strategy.marketType || 'spot',
        status: strategy.status || 'inactive',
        type: strategy.type || 'custom',
        selected_pairs: strategy.selected_pairs || ['BTC/USDT'],
        strategy_config: strategy.strategy_config || strategy.strategyConfig || {},
        created_at: strategy.created_at || new Date().toISOString(),
        updated_at: strategy.updated_at || new Date().toISOString()
      };

      if (!this.strategies.has(strategy.id)) {
        console.log(`Manually adding strategy ${strategy.id} to cache`);
        this.strategies.set(strategy.id, completeStrategy);

        // Also emit creation events
        this.emit('strategyCreated', completeStrategy);
        eventBus.emit('strategy:created', completeStrategy);
        eventBus.emit('strategy:created', { strategy: completeStrategy });
      } else {
        console.log(`Strategy ${strategy.id} already in cache, updating it`);
        this.strategies.set(strategy.id, completeStrategy);
      }

      // Force a refresh from the database to ensure we have the latest data
      setTimeout(() => {
        this.refreshStrategiesFromDatabase().then(() => {
          // Broadcast update after refresh
          this.broadcastStrategiesUpdate();
        }).catch(error => {
          console.error('Error refreshing strategies after adding to cache:', error);
          // Broadcast anyway even if refresh fails
          this.broadcastStrategiesUpdate();
        });
      }, 500);
    } catch (error) {
      console.error('Failed to add strategy to cache:', error);
      logService.log('error', 'Failed to add strategy to cache', error, 'StrategySync');
    }
  }

  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  isSyncing(): boolean {
    return this.syncInProgress;
  }

  /**
   * Refresh strategies from the database
   * This is a direct database query that bypasses the cache
   */
  public async refreshStrategiesFromDatabase(): Promise<Strategy[]> {
    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        console.log('No authenticated user found');
        return [];
      }

      const userId = session.user.id;

      console.log('Refreshing strategies from database for user:', userId);

      // Get strategies from database with explicit ordering
      const { data: strategies, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching strategies:', error);
        throw error;
      }

      console.log(`Fetched ${strategies?.length || 0} strategies from database`);

      // Clear existing cache and update it with new strategies
      this.strategies.clear();
      if (strategies && strategies.length > 0) {
        strategies.forEach(strategy => {
          // Ensure the strategy has all required fields
          const completeStrategy = {
            ...strategy,
            // Convert snake_case to camelCase for compatibility
            name: strategy.name || strategy.title,
            title: strategy.title || strategy.name,
            description: strategy.description || '',
            riskLevel: strategy.risk_level || strategy.riskLevel || 'Medium',
            risk_level: strategy.risk_level || strategy.riskLevel || 'Medium',
            marketType: strategy.market_type || strategy.marketType || 'spot',
            market_type: strategy.market_type || strategy.marketType || 'spot',
            status: strategy.status || 'inactive',
            type: strategy.type || 'custom',
            selected_pairs: strategy.selected_pairs || ['BTC/USDT'],
            strategy_config: strategy.strategy_config || strategy.strategyConfig || {},
            created_at: strategy.created_at || new Date().toISOString(),
            updated_at: strategy.updated_at || new Date().toISOString()
          };

          this.strategies.set(strategy.id, completeStrategy);
        });
        console.log(`Loaded ${strategies.length} strategies for user ${userId}`);
        logService.log('info', `Loaded ${strategies.length} strategies for user ${userId}`, null, 'StrategySync');
      } else {
        console.log(`No strategies found for user ${userId}`);
        logService.log('info', `No strategies found for user ${userId}`, null, 'StrategySync');
      }

      return strategies || [];
    } catch (error) {
      console.error('Error refreshing strategies from database:', error);
      logService.log('error', 'Error refreshing strategies from database', error, 'StrategySync');
      return [];
    }
  }

  /**
   * Pause the strategy sync process
   * This is useful when making direct database changes to prevent sync conflicts
   */
  pauseSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    this.syncInProgress = true; // Set to true to prevent new syncs from starting
    console.log('Strategy sync paused');
  }

  /**
   * Resume the strategy sync process
   */
  resumeSync(): void {
    this.syncInProgress = false;
    this.startPeriodicSync();
    console.log('Strategy sync resumed');
  }

  /**
   * Remove a strategy from the local cache
   * @param id The ID of the strategy to remove
   */
  removeFromCache(id: string): void {
    if (this.strategies.has(id)) {
      this.strategies.delete(id);
      console.log(`Strategy ${id} removed from cache`);
    } else {
      console.log(`Strategy ${id} not found in cache`);
    }
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
