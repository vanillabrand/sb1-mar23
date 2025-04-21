import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logService } from './log-service';
import { cacheService } from './cache-service';
import { eventBus } from './event-bus';

// Supabase connection details
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY || '';

// Cache namespaces
const CACHE_NAMESPACES = {
  STRATEGIES: 'strategies',
  TRADES: 'trades',
  MARKET_DATA: 'market_data',
  USER_DATA: 'user_data',
  EXCHANGE_DATA: 'exchange_data'
};

// Cache TTLs (in milliseconds)
const CACHE_TTLS = {
  STRATEGIES: 5 * 60 * 1000, // 5 minutes
  TRADES: 30 * 1000, // 30 seconds
  MARKET_DATA: 10 * 1000, // 10 seconds
  USER_DATA: 5 * 60 * 1000, // 5 minutes
  EXCHANGE_DATA: 60 * 1000 // 1 minute
};

/**
 * Enhanced Supabase client with connection pooling and caching
 */
class EnhancedSupabase {
  private static instance: EnhancedSupabase;
  private client: SupabaseClient;
  private connectionPool: SupabaseClient[] = [];
  private readonly MAX_POOL_SIZE = 5;
  private readonly POOL_CHECKOUT_TIMEOUT = 5000; // 5 seconds
  private readonly CACHE_ENABLED = true;

  private constructor() {
    // Create the main client
    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });

    // Initialize connection pool
    this.initializeConnectionPool();

    // Initialize cache namespaces
    this.initializeCacheNamespaces();

    logService.log('info', 'Enhanced Supabase client initialized', null, 'EnhancedSupabase');
  }

  static getInstance(): EnhancedSupabase {
    if (!EnhancedSupabase.instance) {
      EnhancedSupabase.instance = new EnhancedSupabase();
    }
    return EnhancedSupabase.instance;
  }

  /**
   * Get the Supabase client
   * @returns Supabase client
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Get a connection from the pool
   * @returns Promise that resolves to a Supabase client
   */
  async getConnection(): Promise<SupabaseClient> {
    // If pool is disabled or empty, return the main client
    if (this.connectionPool.length === 0) {
      return this.client;
    }

    // Try to get an available connection
    const connection = this.connectionPool.shift();
    if (connection) {
      return connection;
    }

    // If no connections are available, wait for one to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection pool checkout timeout'));
      }, this.POOL_CHECKOUT_TIMEOUT);

      const checkInterval = setInterval(() => {
        if (this.connectionPool.length > 0) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve(this.connectionPool.shift()!);
        }
      }, 100);
    });
  }

  /**
   * Release a connection back to the pool
   * @param connection Supabase client to release
   */
  releaseConnection(connection: SupabaseClient): void {
    // If it's the main client, do nothing
    if (connection === this.client) {
      return;
    }

    // Add the connection back to the pool
    this.connectionPool.push(connection);
  }

  /**
   * Initialize the connection pool
   */
  private initializeConnectionPool(): void {
    // Create connections for the pool
    for (let i = 0; i < this.MAX_POOL_SIZE; i++) {
      const connection = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      this.connectionPool.push(connection);
    }

    logService.log('info', `Initialized Supabase connection pool with ${this.MAX_POOL_SIZE} connections`, null, 'EnhancedSupabase');
  }

  /**
   * Initialize cache namespaces
   */
  private initializeCacheNamespaces(): void {
    // Initialize cache namespaces with appropriate TTLs
    cacheService.initializeCache({
      namespace: CACHE_NAMESPACES.STRATEGIES,
      ttl: CACHE_TTLS.STRATEGIES,
      maxSize: 100
    });

    cacheService.initializeCache({
      namespace: CACHE_NAMESPACES.TRADES,
      ttl: CACHE_TTLS.TRADES,
      maxSize: 500
    });

    cacheService.initializeCache({
      namespace: CACHE_NAMESPACES.MARKET_DATA,
      ttl: CACHE_TTLS.MARKET_DATA,
      maxSize: 200
    });

    cacheService.initializeCache({
      namespace: CACHE_NAMESPACES.USER_DATA,
      ttl: CACHE_TTLS.USER_DATA,
      maxSize: 50
    });

    cacheService.initializeCache({
      namespace: CACHE_NAMESPACES.EXCHANGE_DATA,
      ttl: CACHE_TTLS.EXCHANGE_DATA,
      maxSize: 100
    });

    logService.log('info', 'Initialized Supabase cache namespaces', null, 'EnhancedSupabase');
  }

  /**
   * Get strategies with caching
   * @param options Query options
   * @returns Promise that resolves to strategies
   */
  async getStrategies(options: { status?: string; limit?: number } = {}): Promise<any[]> {
    const cacheKey = `strategies:${JSON.stringify(options)}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const connection = await this.getConnection();
        try {
          let query = connection.from('strategies').select('*');

          if (options.status) {
            query = query.eq('status', options.status);
          }

          if (options.limit) {
            query = query.limit(options.limit);
          }

          const { data, error } = await query.order('created_at', { ascending: false });

          if (error) {
            throw error;
          }

          return data || [];
        } finally {
          this.releaseConnection(connection);
        }
      },
      CACHE_NAMESPACES.STRATEGIES
    );
  }

  /**
   * Get a strategy by ID with caching
   * @param id Strategy ID
   * @returns Promise that resolves to the strategy
   */
  async getStrategy(id: string): Promise<any> {
    const cacheKey = `strategy:${id}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const connection = await this.getConnection();
        try {
          const { data, error } = await connection
            .from('strategies')
            .select('*')
            .eq('id', id)
            .single();

          if (error) {
            throw error;
          }

          return data;
        } finally {
          this.releaseConnection(connection);
        }
      },
      CACHE_NAMESPACES.STRATEGIES
    );
  }

  /**
   * Get trades for a strategy with caching
   * @param strategyId Strategy ID
   * @param options Query options
   * @returns Promise that resolves to trades
   */
  async getTradesForStrategy(strategyId: string, options: { status?: string; limit?: number } = {}): Promise<any[]> {
    const cacheKey = `trades:strategy:${strategyId}:${JSON.stringify(options)}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const connection = await this.getConnection();
        try {
          let query = connection.from('trades').select('*').eq('strategy_id', strategyId);

          if (options.status) {
            query = query.eq('status', options.status);
          }

          if (options.limit) {
            query = query.limit(options.limit);
          }

          const { data, error } = await query.order('created_at', { ascending: false });

          if (error) {
            throw error;
          }

          return data || [];
        } finally {
          this.releaseConnection(connection);
        }
      },
      CACHE_NAMESPACES.TRADES,
      CACHE_TTLS.TRADES
    );
  }

  /**
   * Get trades for a symbol with caching
   * @param symbol Trading pair symbol
   * @param options Query options
   * @returns Promise that resolves to trades
   */
  async getTradesForSymbol(symbol: string, options: { status?: string; limit?: number } = {}): Promise<any[]> {
    const cacheKey = `trades:symbol:${symbol}:${JSON.stringify(options)}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const connection = await this.getConnection();
        try {
          let query = connection.from('trades').select('*').eq('symbol', symbol);

          if (options.status) {
            query = query.eq('status', options.status);
          }

          if (options.limit) {
            query = query.limit(options.limit);
          }

          const { data, error } = await query.order('created_at', { ascending: false });

          if (error) {
            throw error;
          }

          return data || [];
        } finally {
          this.releaseConnection(connection);
        }
      },
      CACHE_NAMESPACES.TRADES,
      CACHE_TTLS.TRADES
    );
  }

  /**
   * Get market data with caching
   * @param symbol Trading pair symbol
   * @param timeframe Timeframe (e.g., '1h', '1d')
   * @param limit Number of candles to retrieve
   * @returns Promise that resolves to market data
   */
  async getMarketData(symbol: string, timeframe: string, limit: number = 100): Promise<any[]> {
    const cacheKey = `market_data:${symbol}:${timeframe}:${limit}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const connection = await this.getConnection();
        try {
          const { data, error } = await connection
            .from('market_data')
            .select('*')
            .eq('symbol', symbol)
            .eq('timeframe', timeframe)
            .order('timestamp', { ascending: false })
            .limit(limit);

          if (error) {
            throw error;
          }

          return data || [];
        } finally {
          this.releaseConnection(connection);
        }
      },
      CACHE_NAMESPACES.MARKET_DATA,
      CACHE_TTLS.MARKET_DATA
    );
  }

  /**
   * Get exchange data with caching
   * @param exchangeId Exchange ID
   * @returns Promise that resolves to exchange data
   */
  async getExchangeData(exchangeId: string): Promise<any> {
    const cacheKey = `exchange_data:${exchangeId}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const connection = await this.getConnection();
        try {
          const { data, error } = await connection
            .from('exchanges')
            .select('*')
            .eq('id', exchangeId)
            .single();

          if (error) {
            throw error;
          }

          return data;
        } finally {
          this.releaseConnection(connection);
        }
      },
      CACHE_NAMESPACES.EXCHANGE_DATA,
      CACHE_TTLS.EXCHANGE_DATA
    );
  }

  /**
   * Get user data with caching
   * @param userId User ID
   * @returns Promise that resolves to user data
   */
  async getUserData(userId: string): Promise<any> {
    const cacheKey = `user_data:${userId}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const connection = await this.getConnection();
        try {
          const { data, error } = await connection
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

          if (error) {
            throw error;
          }

          return data;
        } finally {
          this.releaseConnection(connection);
        }
      },
      CACHE_NAMESPACES.USER_DATA,
      CACHE_TTLS.USER_DATA
    );
  }

  /**
   * Invalidate cache for a specific key
   * @param key Cache key
   * @param namespace Cache namespace
   */
  invalidateCache(key: string, namespace: string): void {
    cacheService.delete(key, namespace);
    logService.log('debug', `Invalidated cache for ${namespace}:${key}`, null, 'EnhancedSupabase');
  }

  /**
   * Invalidate all caches for a namespace
   * @param namespace Cache namespace
   */
  invalidateCacheNamespace(namespace: string): void {
    cacheService.clear(namespace);
    logService.log('info', `Invalidated all caches for namespace ${namespace}`, null, 'EnhancedSupabase');
  }

  /**
   * Get cache statistics
   * @returns Cache statistics for all namespaces
   */
  getCacheStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const namespace of Object.values(CACHE_NAMESPACES)) {
      stats[namespace] = cacheService.getStats(namespace);
    }
    
    return stats;
  }
}

// Export the enhanced Supabase instance
export const enhancedSupabase = EnhancedSupabase.getInstance();

// Export the client for backward compatibility
export const supabase = enhancedSupabase.getClient();
