import { connectionPoolManager, ConnectionPool } from './connection-pool';
import { logService } from './log-service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';

/**
 * Database connection pool for Supabase
 */
class DbConnectionPool {
  private static instance: DbConnectionPool;
  private pool: ConnectionPool<SupabaseClient> | null = null;
  private readonly POOL_NAME = 'supabase-pool';
  private readonly MAX_CONNECTIONS = 10;
  private readonly MIN_CONNECTIONS = 2;
  private readonly IDLE_TIMEOUT_MS = 60000; // 1 minute
  private readonly CONNECTION_TIMEOUT_MS = 5000; // 5 seconds
  private readonly MAX_LIFETIME_MS = 3600000; // 1 hour
  private initialized = false;

  private constructor() {}

  static getInstance(): DbConnectionPool {
    if (!DbConnectionPool.instance) {
      DbConnectionPool.instance = new DbConnectionPool();
    }
    return DbConnectionPool.instance;
  }

  /**
   * Initialize the database connection pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Create the connection pool
      this.pool = connectionPoolManager.createPool<SupabaseClient>({
        name: this.POOL_NAME,
        maxConnections: this.MAX_CONNECTIONS,
        minConnections: this.MIN_CONNECTIONS,
        idleTimeoutMs: this.IDLE_TIMEOUT_MS,
        connectionTimeoutMs: this.CONNECTION_TIMEOUT_MS,
        maxLifetimeMs: this.MAX_LIFETIME_MS,
        createConnection: this.createConnection.bind(this),
        validateConnection: this.validateConnection.bind(this),
        closeConnection: this.closeConnection.bind(this)
      });

      this.initialized = true;
      
      logService.log('info', 'Database connection pool initialized', {
        poolName: this.POOL_NAME,
        maxConnections: this.MAX_CONNECTIONS,
        minConnections: this.MIN_CONNECTIONS
      }, 'DbConnectionPool');
    } catch (error) {
      logService.log('error', 'Failed to initialize database connection pool', error, 'DbConnectionPool');
      throw error;
    }
  }

  /**
   * Create a new Supabase connection
   * @returns Promise that resolves to a Supabase client
   */
  private async createConnection(): Promise<SupabaseClient> {
    try {
      // Get Supabase URL and key from config
      const supabaseUrl = config.SUPABASE_URL;
      const supabaseKey = config.SUPABASE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase URL or key not configured');
      }
      
      // Create Supabase client
      const client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: true
        }
      });
      
      // Test the connection
      const { error } = await client.from('health_check').select('*').limit(1);
      
      if (error) {
        throw error;
      }
      
      logService.log('debug', 'Created new Supabase connection', null, 'DbConnectionPool');
      
      return client;
    } catch (error) {
      logService.log('error', 'Failed to create Supabase connection', error, 'DbConnectionPool');
      throw error;
    }
  }

  /**
   * Validate a Supabase connection
   * @param client Supabase client
   * @returns Promise that resolves to true if the connection is valid
   */
  private async validateConnection(client: SupabaseClient): Promise<boolean> {
    try {
      // Test the connection with a simple query
      const { error } = await client.from('health_check').select('*').limit(1);
      
      return !error;
    } catch (error) {
      logService.log('warn', 'Supabase connection validation failed', error, 'DbConnectionPool');
      return false;
    }
  }

  /**
   * Close a Supabase connection
   * @param client Supabase client
   */
  private async closeConnection(client: SupabaseClient): Promise<void> {
    try {
      // No explicit close method in Supabase client
      // Just remove any references to the client
      
      logService.log('debug', 'Closed Supabase connection', null, 'DbConnectionPool');
    } catch (error) {
      logService.log('error', 'Failed to close Supabase connection', error, 'DbConnectionPool');
    }
  }

  /**
   * Get a connection from the pool
   * @returns Promise that resolves to a Supabase client
   */
  async getConnection(): Promise<SupabaseClient> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.pool) {
      throw new Error('Database connection pool not initialized');
    }

    return this.pool.getConnection();
  }

  /**
   * Release a connection back to the pool
   * @param client Supabase client
   */
  releaseConnection(client: SupabaseClient): void {
    if (!this.pool) {
      logService.log('warn', 'Attempted to release connection to uninitialized pool', null, 'DbConnectionPool');
      return;
    }

    this.pool.releaseConnection(client);
  }

  /**
   * Execute a database operation with a connection from the pool
   * @param operation Function that takes a Supabase client and returns a promise
   * @returns Promise that resolves to the result of the operation
   */
  async withConnection<T>(operation: (client: SupabaseClient) => Promise<T>): Promise<T> {
    let client: SupabaseClient | null = null;
    
    try {
      client = await this.getConnection();
      return await operation(client);
    } finally {
      if (client) {
        this.releaseConnection(client);
      }
    }
  }

  /**
   * Get statistics about the connection pool
   * @returns Connection pool statistics
   */
  getStats(): any {
    if (!this.pool) {
      return {
        initialized: false,
        poolName: this.POOL_NAME
      };
    }

    return this.pool.getStats();
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      await connectionPoolManager.closePool(this.POOL_NAME);
      this.pool = null;
    }
    
    this.initialized = false;
    
    logService.log('info', 'Database connection pool closed', null, 'DbConnectionPool');
  }
}

export const dbConnectionPool = DbConnectionPool.getInstance();
