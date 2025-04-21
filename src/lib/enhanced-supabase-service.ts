import { SupabaseClient } from '@supabase/supabase-js';
import { logService } from './log-service';
import { cacheService } from './cache-service';
import { dbConnectionPool } from './db-connection-pool';
import { eventBus } from './event-bus';
import { demoService } from './demo-service';
import type { Database } from './supabase-types';

/**
 * Cache options for database operations
 */
export interface CacheOptions {
  /** Whether to use cache */
  enabled?: boolean;
  /** Cache TTL in milliseconds */
  ttl?: number;
  /** Cache namespace */
  namespace?: string;
  /** Cache key prefix */
  keyPrefix?: string;
}

/**
 * Enhanced Supabase service with connection pooling and caching
 */
class EnhancedSupabaseService {
  private static instance: EnhancedSupabaseService;
  private initialized = false;
  
  // Cache namespaces
  private readonly CACHE_NAMESPACES = {
    STRATEGIES: 'strategies',
    TRADES: 'trades',
    MARKET_DATA: 'market_data',
    USER_DATA: 'user_data',
    EXCHANGE_DATA: 'exchange_data',
    GENERAL: 'general'
  };
  
  // Default cache TTLs
  private readonly DEFAULT_CACHE_TTL = 60 * 1000; // 1 minute
  private readonly STRATEGIES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly TRADES_CACHE_TTL = 30 * 1000; // 30 seconds
  private readonly USER_DATA_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly EXCHANGE_DATA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): EnhancedSupabaseService {
    if (!EnhancedSupabaseService.instance) {
      EnhancedSupabaseService.instance = new EnhancedSupabaseService();
    }
    return EnhancedSupabaseService.instance;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize the database connection pool
      await dbConnectionPool.initialize();
      
      // Initialize cache namespaces
      this.initializeCacheNamespaces();
      
      this.initialized = true;
      
      logService.log('info', 'Enhanced Supabase service initialized', null, 'EnhancedSupabaseService');
    } catch (error) {
      logService.log('error', 'Failed to initialize Enhanced Supabase service', error, 'EnhancedSupabaseService');
      throw error;
    }
  }

  /**
   * Initialize cache namespaces
   */
  private initializeCacheNamespaces(): void {
    // Create cache namespaces if they don't exist
    for (const namespace of Object.values(this.CACHE_NAMESPACES)) {
      if (!cacheService.getCacheNames().includes(namespace)) {
        cacheService.createCache(namespace, {
          maxSize: 1000,
          defaultTTL: this.DEFAULT_CACHE_TTL,
          evictionPolicy: 'lru'
        });
      }
    }
    
    logService.log('debug', 'Initialized cache namespaces', null, 'EnhancedSupabaseService');
  }

  /**
   * Execute a database operation with a connection from the pool
   * @param operation Function that takes a Supabase client and returns a promise
   * @returns Promise that resolves to the result of the operation
   */
  async withConnection<T>(operation: (client: SupabaseClient<Database>) => Promise<T>): Promise<T> {
    // If in demo mode, use a mock client
    if (demoService.isInDemoMode()) {
      return this.withDemoConnection(operation);
    }
    
    // Ensure the service is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    return dbConnectionPool.withConnection(operation);
  }

  /**
   * Execute a database operation with a mock client in demo mode
   * @param operation Function that takes a Supabase client and returns a promise
   * @returns Promise that resolves to the result of the operation
   */
  private async withDemoConnection<T>(operation: (client: SupabaseClient<Database>) => Promise<T>): Promise<T> {
    try {
      // Get a real connection for the operation
      // This is needed because even in demo mode, we need to access some data
      const client = await dbConnectionPool.getConnection();
      
      try {
        // Execute the operation
        return await operation(client);
      } finally {
        // Release the connection
        dbConnectionPool.releaseConnection(client);
      }
    } catch (error) {
      logService.log('error', 'Failed to execute operation in demo mode', error, 'EnhancedSupabaseService');
      throw error;
    }
  }

  /**
   * Execute a database query with caching
   * @param tableName Table name
   * @param queryFn Function that takes a Supabase client and returns a query
   * @param cacheOptions Cache options
   * @returns Promise that resolves to the query result
   */
  async query<T>(
    tableName: string,
    queryFn: (client: SupabaseClient<Database>) => Promise<{ data: T | null; error: any }>,
    cacheOptions: CacheOptions = {}
  ): Promise<T> {
    // Determine cache namespace based on table name
    const namespace = this.getCacheNamespaceForTable(tableName);
    
    // Set up cache options
    const options: Required<CacheOptions> = {
      enabled: cacheOptions.enabled !== false,
      ttl: cacheOptions.ttl || this.getCacheTTLForNamespace(namespace),
      namespace: cacheOptions.namespace || namespace,
      keyPrefix: cacheOptions.keyPrefix || `${tableName}:`
    };
    
    // Generate a cache key based on the function and its arguments
    const cacheKey = `${options.keyPrefix}${Date.now()}`;
    
    // Check cache if enabled
    if (options.enabled) {
      const cachedResult = cacheService.get<T>(cacheKey, options.namespace);
      
      if (cachedResult) {
        logService.log('debug', `Cache hit for ${tableName} query`, { cacheKey }, 'EnhancedSupabaseService');
        return cachedResult;
      }
    }
    
    // Execute the query
    return this.withConnection(async (client) => {
      try {
        const { data, error } = await queryFn(client);
        
        if (error) {
          throw error;
        }
        
        if (data === null) {
          throw new Error(`No data returned from ${tableName} query`);
        }
        
        // Cache the result if enabled
        if (options.enabled) {
          cacheService.set(cacheKey, data, options.namespace, options.ttl);
        }
        
        return data;
      } catch (error) {
        logService.log('error', `Failed to execute query on ${tableName}`, error, 'EnhancedSupabaseService');
        throw error;
      }
    });
  }

  /**
   * Insert data into a table
   * @param tableName Table name
   * @param data Data to insert
   * @param invalidateCache Whether to invalidate cache for this table
   * @returns Promise that resolves to the inserted data
   */
  async insert<T>(
    tableName: string,
    data: any,
    invalidateCache: boolean = true
  ): Promise<T> {
    return this.withConnection(async (client) => {
      try {
        const { data: result, error } = await client
          .from(tableName)
          .insert(data)
          .select();
        
        if (error) {
          throw error;
        }
        
        if (!result || result.length === 0) {
          throw new Error(`Failed to insert data into ${tableName}`);
        }
        
        // Invalidate cache if needed
        if (invalidateCache) {
          this.invalidateTableCache(tableName);
        }
        
        // Emit event
        eventBus.emit(`${tableName}:inserted`, { data: result[0] });
        
        return result[0] as T;
      } catch (error) {
        logService.log('error', `Failed to insert data into ${tableName}`, error, 'EnhancedSupabaseService');
        throw error;
      }
    });
  }

  /**
   * Update data in a table
   * @param tableName Table name
   * @param id ID of the record to update
   * @param data Data to update
   * @param invalidateCache Whether to invalidate cache for this table
   * @returns Promise that resolves to the updated data
   */
  async update<T>(
    tableName: string,
    id: string | number,
    data: any,
    invalidateCache: boolean = true
  ): Promise<T> {
    return this.withConnection(async (client) => {
      try {
        const { data: result, error } = await client
          .from(tableName)
          .update(data)
          .eq('id', id)
          .select();
        
        if (error) {
          throw error;
        }
        
        if (!result || result.length === 0) {
          throw new Error(`Failed to update data in ${tableName} with ID ${id}`);
        }
        
        // Invalidate cache if needed
        if (invalidateCache) {
          this.invalidateTableCache(tableName);
          this.invalidateRecordCache(tableName, id);
        }
        
        // Emit event
        eventBus.emit(`${tableName}:updated`, { id, data: result[0] });
        
        return result[0] as T;
      } catch (error) {
        logService.log('error', `Failed to update data in ${tableName} with ID ${id}`, error, 'EnhancedSupabaseService');
        throw error;
      }
    });
  }

  /**
   * Delete data from a table
   * @param tableName Table name
   * @param id ID of the record to delete
   * @param invalidateCache Whether to invalidate cache for this table
   * @returns Promise that resolves to true if successful
   */
  async delete(
    tableName: string,
    id: string | number,
    invalidateCache: boolean = true
  ): Promise<boolean> {
    return this.withConnection(async (client) => {
      try {
        const { error } = await client
          .from(tableName)
          .delete()
          .eq('id', id);
        
        if (error) {
          throw error;
        }
        
        // Invalidate cache if needed
        if (invalidateCache) {
          this.invalidateTableCache(tableName);
          this.invalidateRecordCache(tableName, id);
        }
        
        // Emit event
        eventBus.emit(`${tableName}:deleted`, { id });
        
        return true;
      } catch (error) {
        logService.log('error', `Failed to delete data from ${tableName} with ID ${id}`, error, 'EnhancedSupabaseService');
        throw error;
      }
    });
  }

  /**
   * Get a record by ID
   * @param tableName Table name
   * @param id ID of the record to get
   * @param cacheOptions Cache options
   * @returns Promise that resolves to the record
   */
  async getById<T>(
    tableName: string,
    id: string | number,
    cacheOptions: CacheOptions = {}
  ): Promise<T> {
    // Set up cache key
    const cacheKey = `${tableName}:${id}`;
    
    // Determine cache namespace based on table name
    const namespace = this.getCacheNamespaceForTable(tableName);
    
    // Set up cache options
    const options: Required<CacheOptions> = {
      enabled: cacheOptions.enabled !== false,
      ttl: cacheOptions.ttl || this.getCacheTTLForNamespace(namespace),
      namespace: cacheOptions.namespace || namespace,
      keyPrefix: cacheOptions.keyPrefix || ''
    };
    
    // Check cache if enabled
    if (options.enabled) {
      const cachedResult = cacheService.get<T>(`${options.keyPrefix}${cacheKey}`, options.namespace);
      
      if (cachedResult) {
        logService.log('debug', `Cache hit for ${tableName} record ${id}`, { cacheKey }, 'EnhancedSupabaseService');
        return cachedResult;
      }
    }
    
    return this.withConnection(async (client) => {
      try {
        const { data, error } = await client
          .from(tableName)
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) {
          throw error;
        }
        
        if (!data) {
          throw new Error(`Record not found in ${tableName} with ID ${id}`);
        }
        
        // Cache the result if enabled
        if (options.enabled) {
          cacheService.set(`${options.keyPrefix}${cacheKey}`, data, options.namespace, options.ttl);
        }
        
        return data as T;
      } catch (error) {
        logService.log('error', `Failed to get record from ${tableName} with ID ${id}`, error, 'EnhancedSupabaseService');
        throw error;
      }
    });
  }

  /**
   * Get all records from a table
   * @param tableName Table name
   * @param cacheOptions Cache options
   * @returns Promise that resolves to an array of records
   */
  async getAll<T>(
    tableName: string,
    cacheOptions: CacheOptions = {}
  ): Promise<T[]> {
    // Set up cache key
    const cacheKey = `${tableName}:all`;
    
    // Determine cache namespace based on table name
    const namespace = this.getCacheNamespaceForTable(tableName);
    
    // Set up cache options
    const options: Required<CacheOptions> = {
      enabled: cacheOptions.enabled !== false,
      ttl: cacheOptions.ttl || this.getCacheTTLForNamespace(namespace),
      namespace: cacheOptions.namespace || namespace,
      keyPrefix: cacheOptions.keyPrefix || ''
    };
    
    // Check cache if enabled
    if (options.enabled) {
      const cachedResult = cacheService.get<T[]>(`${options.keyPrefix}${cacheKey}`, options.namespace);
      
      if (cachedResult) {
        logService.log('debug', `Cache hit for ${tableName} all records`, { cacheKey }, 'EnhancedSupabaseService');
        return cachedResult;
      }
    }
    
    return this.withConnection(async (client) => {
      try {
        const { data, error } = await client
          .from(tableName)
          .select('*');
        
        if (error) {
          throw error;
        }
        
        if (!data) {
          return [] as T[];
        }
        
        // Cache the result if enabled
        if (options.enabled) {
          cacheService.set(`${options.keyPrefix}${cacheKey}`, data, options.namespace, options.ttl);
        }
        
        return data as T[];
      } catch (error) {
        logService.log('error', `Failed to get all records from ${tableName}`, error, 'EnhancedSupabaseService');
        throw error;
      }
    });
  }

  /**
   * Invalidate cache for a table
   * @param tableName Table name
   */
  invalidateTableCache(tableName: string): void {
    try {
      const namespace = this.getCacheNamespaceForTable(tableName);
      
      // Clear all cache entries for this table
      const cacheKeys = cacheService.getKeys(namespace);
      
      for (const key of cacheKeys) {
        if (key.startsWith(`${tableName}:`)) {
          cacheService.delete(key, namespace);
        }
      }
      
      logService.log('debug', `Invalidated cache for table ${tableName}`, null, 'EnhancedSupabaseService');
    } catch (error) {
      logService.log('error', `Failed to invalidate cache for table ${tableName}`, error, 'EnhancedSupabaseService');
    }
  }

  /**
   * Invalidate cache for a specific record
   * @param tableName Table name
   * @param id Record ID
   */
  invalidateRecordCache(tableName: string, id: string | number): void {
    try {
      const namespace = this.getCacheNamespaceForTable(tableName);
      const cacheKey = `${tableName}:${id}`;
      
      cacheService.delete(cacheKey, namespace);
      
      logService.log('debug', `Invalidated cache for record ${tableName}:${id}`, null, 'EnhancedSupabaseService');
    } catch (error) {
      logService.log('error', `Failed to invalidate cache for record ${tableName}:${id}`, error, 'EnhancedSupabaseService');
    }
  }

  /**
   * Get cache namespace for a table
   * @param tableName Table name
   * @returns Cache namespace
   */
  private getCacheNamespaceForTable(tableName: string): string {
    // Map table names to namespaces
    if (tableName.includes('strateg')) {
      return this.CACHE_NAMESPACES.STRATEGIES;
    } else if (tableName.includes('trade')) {
      return this.CACHE_NAMESPACES.TRADES;
    } else if (tableName.includes('user') || tableName.includes('profile')) {
      return this.CACHE_NAMESPACES.USER_DATA;
    } else if (tableName.includes('exchange') || tableName.includes('market')) {
      return this.CACHE_NAMESPACES.EXCHANGE_DATA;
    } else {
      return this.CACHE_NAMESPACES.GENERAL;
    }
  }

  /**
   * Get cache TTL for a namespace
   * @param namespace Cache namespace
   * @returns Cache TTL in milliseconds
   */
  private getCacheTTLForNamespace(namespace: string): number {
    switch (namespace) {
      case this.CACHE_NAMESPACES.STRATEGIES:
        return this.STRATEGIES_CACHE_TTL;
      case this.CACHE_NAMESPACES.TRADES:
        return this.TRADES_CACHE_TTL;
      case this.CACHE_NAMESPACES.USER_DATA:
        return this.USER_DATA_CACHE_TTL;
      case this.CACHE_NAMESPACES.EXCHANGE_DATA:
        return this.EXCHANGE_DATA_CACHE_TTL;
      default:
        return this.DEFAULT_CACHE_TTL;
    }
  }

  /**
   * Get statistics about the connection pool
   * @returns Connection pool statistics
   */
  getStats(): any {
    return dbConnectionPool.getStats();
  }

  /**
   * Close the service
   */
  async close(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await dbConnectionPool.close();
      this.initialized = false;
      
      logService.log('info', 'Enhanced Supabase service closed', null, 'EnhancedSupabaseService');
    } catch (error) {
      logService.log('error', 'Failed to close Enhanced Supabase service', error, 'EnhancedSupabaseService');
      throw error;
    }
  }
}

export const enhancedSupabaseService = EnhancedSupabaseService.getInstance();
