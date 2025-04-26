import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logService } from './log-service';
import { cacheService } from './cache-service';
import { eventBus } from './event-bus';

import { config } from './config';

// Supabase connection details
// Using let instead of const to allow reassignment in demo mode
let supabaseUrl = config.supabaseUrl || '';
let supabaseKey = config.supabaseAnonKey || '';

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
    // Check if Supabase URL and key are available
    if (!supabaseUrl) {
      // Check if we're in demo mode
      if (config.DEMO_MODE) {
        // In demo mode, we can use a mock URL and key
        const mockUrl = 'https://mock.supabase.co';
        const mockKey = 'mock-key';

        logService.log('warn', 'Supabase URL is missing, but running in demo mode. Using mock Supabase.', {
          mockUrl,
          demoMode: config.DEMO_MODE
        }, 'EnhancedSupabase');

        // Override the variables for demo mode
        supabaseUrl = mockUrl;
        supabaseKey = mockKey;
      } else {
        // Not in demo mode, so we need the real URL
        const errorMessage = 'Supabase URL is missing. Please check your environment variables.';
        logService.log('error', errorMessage, {
          configKeys: Object.keys(config),
          demoMode: config.DEMO_MODE
        }, 'EnhancedSupabase');
        throw new Error(errorMessage);
      }
    }

    if (!supabaseKey && !config.DEMO_MODE) {
      const errorMessage = 'Supabase key is missing. Please check your environment variables.';
      logService.log('error', errorMessage, null, 'EnhancedSupabase');
      throw new Error(errorMessage);
    }

    // Create the main client
    if (config.DEMO_MODE && (!supabaseUrl || !supabaseKey || supabaseUrl === 'https://mock.supabase.co')) {
      // In demo mode with missing credentials, create a mock client
      this.client = this.createMockClient();
      logService.log('info', 'Created mock Supabase client for demo mode', null, 'EnhancedSupabase');
    } else {
      // Create a real client
      this.client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'sb-auth-token',
          storage: localStorage
        },
        global: {
          headers: {
            'Accept': 'application/json, text/plain, */*',  // Expanded Accept header to fix 406 errors
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'X-Client-Info': 'supabase-js/2.x',
            'Prefer': 'return=representation'  // Always return representation
          }
        },
        db: {
          schema: 'public'
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      });
    }

    // Initialize connection pool
    this.initializeConnectionPool();

    // Initialize cache namespaces
    this.initializeCacheNamespaces();

    logService.log('info', 'Enhanced Supabase client initialized', {
      url: supabaseUrl.substring(0, 20) + '...' // Log partial URL for debugging
    }, 'EnhancedSupabase');
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
    // Check if we're in demo mode
    if (config.DEMO_MODE && (!supabaseUrl || !supabaseKey || supabaseUrl === 'https://mock.supabase.co')) {
      // In demo mode, always return the main client (which is a mock client)
      return this.client;
    }

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
        // On timeout, return the main client as a fallback
        logService.log('warn', 'Connection pool checkout timeout, using main client as fallback', null, 'EnhancedSupabase');
        resolve(this.client);
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
    // Skip connection pool in demo mode with mock client
    if (config.DEMO_MODE && (!supabaseUrl || !supabaseKey || supabaseUrl === 'https://mock.supabase.co')) {
      logService.log('info', 'Skipping connection pool initialization in demo mode', null, 'EnhancedSupabase');
      this.connectionPool = [];
      return;
    }

    // Create connections for the pool
    for (let i = 0; i < this.MAX_POOL_SIZE; i++) {
      const connection = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'sb-auth-token',
          storage: localStorage
        },
        global: {
          headers: {
            'Accept': 'application/json, text/plain, */*',  // Expanded Accept header to fix 406 errors
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'X-Client-Info': 'supabase-js/2.x',
            'Prefer': 'return=representation'  // Always return representation
          }
        },
        db: {
          schema: 'public'
        }
      });
      this.connectionPool.push(connection);
    }

    logService.log('info', `Initialized Supabase connection pool with ${this.MAX_POOL_SIZE} connections`, null, 'EnhancedSupabase');
  }

  /**
   * Create a mock Supabase client for demo mode
   * @returns Mock Supabase client
   */
  private createMockClient(): any {
    // Create a mock client with the same interface as the real client
    const mockClient = {
      // Mock auth methods
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'mock-user-id', email: 'demo@example.com' } }, error: null }),
        signIn: () => Promise.resolve({ data: { user: { id: 'mock-user-id', email: 'demo@example.com' } }, error: null }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: (callback: any) => {
          // Immediately call the callback with a signed-in state
          callback('SIGNED_IN', { user: { id: 'mock-user-id', email: 'demo@example.com' } });
          return { data: { subscription: { unsubscribe: () => {} } } };
        }
      },

      // Mock database methods
      from: (table: string) => {
        return {
          select: (columns: string = '*') => {
            return {
              eq: (column: string, value: any) => {
                return {
                  single: () => this.getMockData(table, column, value, true),
                  limit: (limit: number) => this.getMockData(table, column, value, false, limit),
                  order: () => ({
                    limit: (limit: number) => this.getMockData(table, column, value, false, limit)
                  }),
                  range: () => this.getMockData(table, column, value)
                };
              },
              neq: () => ({
                limit: (limit: number) => this.getMockData(table, null, null, false, limit)
              }),
              limit: (limit: number) => this.getMockData(table, null, null, false, limit),
              order: () => ({
                limit: (limit: number) => this.getMockData(table, null, null, false, limit)
              })
            };
          },
          insert: (data: any) => {
            return {
              select: () => {
                // Generate a mock ID for the inserted data
                const mockId = `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                const result = Array.isArray(data)
                  ? data.map(item => ({ ...item, id: item.id || mockId }))
                  : [{ ...data, id: data.id || mockId }];

                return Promise.resolve({ data: result, error: null });
              }
            };
          },
          update: (data: any) => {
            return {
              eq: () => ({
                select: () => Promise.resolve({ data: [{ ...data, id: 'mock-id' }], error: null })
              })
            };
          },
          delete: () => {
            return {
              eq: () => Promise.resolve({ error: null })
            };
          }
        };
      },

      // Mock storage methods
      storage: {
        from: (bucket: string) => ({
          upload: () => Promise.resolve({ data: { path: 'mock-path' }, error: null }),
          download: () => Promise.resolve({ data: new Blob(['mock data']), error: null }),
          list: () => Promise.resolve({ data: [{ name: 'mock-file.txt' }], error: null }),
          remove: () => Promise.resolve({ error: null })
        })
      }
    };

    return mockClient;
  }

  /**
   * Get mock data for a table
   * @param table Table name
   * @param column Column name for filtering
   * @param value Value for filtering
   * @param single Whether to return a single result
   * @param limit Maximum number of results
   * @returns Promise with mock data
   */
  private getMockData(table: string, column: string | null, value: any, single: boolean = false, limit: number = 10): Promise<any> {
    // Generate mock data based on the table name
    let mockData: any[] = [];

    switch (table) {
      case 'strategies':
        mockData = [
          { id: 'mock-strategy-1', name: 'Mock Strategy 1', description: 'A mock strategy', created_at: new Date().toISOString(), user_id: 'mock-user-id', status: 'active', budget: 1000 },
          { id: 'mock-strategy-2', name: 'Mock Strategy 2', description: 'Another mock strategy', created_at: new Date().toISOString(), user_id: 'mock-user-id', status: 'inactive', budget: 500 },
          { id: 'mock-strategy-3', name: 'Mock Strategy 3', description: 'Yet another mock strategy', created_at: new Date().toISOString(), user_id: 'mock-user-id', status: 'active', budget: 2000 }
        ];
        break;
      case 'trades':
        mockData = [
          { id: 'mock-trade-1', strategy_id: 'mock-strategy-1', symbol: 'BTC/USDT', side: 'buy', amount: 0.1, entry_price: 50000, status: 'open', created_at: new Date().toISOString() },
          { id: 'mock-trade-2', strategy_id: 'mock-strategy-1', symbol: 'ETH/USDT', side: 'sell', amount: 1, entry_price: 3000, status: 'closed', created_at: new Date().toISOString(), exit_price: 3100, profit: 100 },
          { id: 'mock-trade-3', strategy_id: 'mock-strategy-2', symbol: 'SOL/USDT', side: 'buy', amount: 10, entry_price: 100, status: 'open', created_at: new Date().toISOString() }
        ];
        break;
      case 'users':
        mockData = [
          { id: 'mock-user-id', email: 'demo@example.com', name: 'Demo User', created_at: new Date().toISOString() }
        ];
        break;
      default:
        mockData = [
          { id: 'mock-id-1', name: 'Mock Item 1', created_at: new Date().toISOString() },
          { id: 'mock-id-2', name: 'Mock Item 2', created_at: new Date().toISOString() },
          { id: 'mock-id-3', name: 'Mock Item 3', created_at: new Date().toISOString() }
        ];
    }

    // Filter data if column and value are provided
    if (column && value !== undefined && value !== null) {
      mockData = mockData.filter(item => item[column] === value);
    }

    // Limit the number of results
    if (mockData.length > limit) {
      mockData = mockData.slice(0, limit);
    }

    // Return a single result if requested
    if (single) {
      return Promise.resolve({ data: mockData.length > 0 ? mockData[0] : null, error: null });
    }

    return Promise.resolve({ data: mockData, error: null });
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
