import { connectionPoolManager, ConnectionPool } from './connection-pool';
import { logService } from './log-service';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * API connection options
 */
export interface ApiConnectionOptions {
  /** Base URL for the API */
  baseURL: string;
  /** Default timeout for requests (ms) */
  timeout?: number;
  /** Default headers for requests */
  headers?: Record<string, string>;
  /** Whether to retry failed requests */
  retry?: boolean;
  /** Maximum number of retries */
  maxRetries?: number;
  /** Retry delay (ms) */
  retryDelay?: number;
  /** Whether to use keep-alive */
  keepAlive?: boolean;
  /** Pool name */
  poolName?: string;
}

/**
 * API connection pool for HTTP requests
 */
class ApiConnectionPool {
  private static instance: ApiConnectionPool;
  private pools: Map<string, ConnectionPool<AxiosInstance>> = new Map();
  
  // Default options
  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_RETRY_DELAY = 1000; // 1 second
  private readonly DEFAULT_MAX_CONNECTIONS = 5;
  private readonly DEFAULT_MIN_CONNECTIONS = 1;
  private readonly DEFAULT_IDLE_TIMEOUT_MS = 60000; // 1 minute
  private readonly DEFAULT_CONNECTION_TIMEOUT_MS = 5000; // 5 seconds
  private readonly DEFAULT_MAX_LIFETIME_MS = 3600000; // 1 hour

  private constructor() {}

  static getInstance(): ApiConnectionPool {
    if (!ApiConnectionPool.instance) {
      ApiConnectionPool.instance = new ApiConnectionPool();
    }
    return ApiConnectionPool.instance;
  }

  /**
   * Create a new API connection pool
   * @param options API connection options
   * @returns The pool name
   */
  createPool(options: ApiConnectionOptions): string {
    const poolName = options.poolName || `api-pool-${options.baseURL.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    if (this.pools.has(poolName)) {
      logService.log('warn', `API connection pool "${poolName}" already exists`, null, 'ApiConnectionPool');
      return poolName;
    }
    
    try {
      // Create the connection pool
      const pool = connectionPoolManager.createPool<AxiosInstance>({
        name: poolName,
        maxConnections: this.DEFAULT_MAX_CONNECTIONS,
        minConnections: this.DEFAULT_MIN_CONNECTIONS,
        idleTimeoutMs: this.DEFAULT_IDLE_TIMEOUT_MS,
        connectionTimeoutMs: this.DEFAULT_CONNECTION_TIMEOUT_MS,
        maxLifetimeMs: this.DEFAULT_MAX_LIFETIME_MS,
        createConnection: () => this.createConnection(options),
        validateConnection: (client) => this.validateConnection(client, options),
        closeConnection: (client) => this.closeConnection(client)
      });
      
      this.pools.set(poolName, pool);
      
      logService.log('info', `Created API connection pool "${poolName}"`, {
        baseURL: options.baseURL,
        maxConnections: this.DEFAULT_MAX_CONNECTIONS,
        minConnections: this.DEFAULT_MIN_CONNECTIONS
      }, 'ApiConnectionPool');
      
      return poolName;
    } catch (error) {
      logService.log('error', `Failed to create API connection pool "${poolName}"`, error, 'ApiConnectionPool');
      throw error;
    }
  }

  /**
   * Create a new API connection
   * @param options API connection options
   * @returns Promise that resolves to an Axios instance
   */
  private async createConnection(options: ApiConnectionOptions): Promise<AxiosInstance> {
    try {
      // Create Axios instance
      const axiosConfig: AxiosRequestConfig = {
        baseURL: options.baseURL,
        timeout: options.timeout || this.DEFAULT_TIMEOUT,
        headers: options.headers || {},
        // Enable keep-alive
        ...(options.keepAlive && {
          httpAgent: new (require('http').Agent)({ keepAlive: true }),
          httpsAgent: new (require('https').Agent)({ keepAlive: true })
        })
      };
      
      const client = axios.create(axiosConfig);
      
      // Add retry interceptor if enabled
      if (options.retry) {
        this.addRetryInterceptor(client, options);
      }
      
      logService.log('debug', 'Created new API connection', {
        baseURL: options.baseURL
      }, 'ApiConnectionPool');
      
      return client;
    } catch (error) {
      logService.log('error', 'Failed to create API connection', error, 'ApiConnectionPool');
      throw error;
    }
  }

  /**
   * Add retry interceptor to Axios instance
   * @param client Axios instance
   * @param options API connection options
   */
  private addRetryInterceptor(client: AxiosInstance, options: ApiConnectionOptions): void {
    const maxRetries = options.maxRetries || this.DEFAULT_MAX_RETRIES;
    const retryDelay = options.retryDelay || this.DEFAULT_RETRY_DELAY;
    
    client.interceptors.response.use(undefined, async (error) => {
      const config = error.config;
      
      // Set retry count if not set
      if (!config.retryCount) {
        config.retryCount = 0;
      }
      
      // Check if we should retry
      const shouldRetry = config.retryCount < maxRetries && this.isRetryableError(error);
      
      if (shouldRetry) {
        config.retryCount++;
        
        // Calculate delay with exponential backoff
        const delay = retryDelay * Math.pow(2, config.retryCount - 1);
        
        logService.log('debug', `Retrying API request (${config.retryCount}/${maxRetries})`, {
          url: config.url,
          method: config.method,
          delay
        }, 'ApiConnectionPool');
        
        // Wait for the delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the request
        return client(config);
      }
      
      // If we shouldn't retry, throw the error
      return Promise.reject(error);
    });
  }

  /**
   * Check if an error is retryable
   * @param error Axios error
   * @returns True if the error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.code === 'ECONNABORTED' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // 5xx errors are retryable
    if (error.response && error.response.status >= 500 && error.response.status < 600) {
      return true;
    }
    
    // 429 Too Many Requests is retryable
    if (error.response && error.response.status === 429) {
      return true;
    }
    
    return false;
  }

  /**
   * Validate an API connection
   * @param client Axios instance
   * @param options API connection options
   * @returns Promise that resolves to true if the connection is valid
   */
  private async validateConnection(client: AxiosInstance, options: ApiConnectionOptions): Promise<boolean> {
    try {
      // Make a simple request to validate the connection
      await client.get('/');
      return true;
    } catch (error) {
      // If the error is a 404, the connection is still valid
      if (error.response && error.response.status === 404) {
        return true;
      }
      
      logService.log('warn', 'API connection validation failed', {
        baseURL: options.baseURL,
        error: error.message
      }, 'ApiConnectionPool');
      
      return false;
    }
  }

  /**
   * Close an API connection
   * @param client Axios instance
   */
  private async closeConnection(client: AxiosInstance): Promise<void> {
    // No explicit close method for Axios
    // Just remove any references to the client
    
    logService.log('debug', 'Closed API connection', null, 'ApiConnectionPool');
  }

  /**
   * Get a connection from a pool
   * @param poolName Pool name
   * @returns Promise that resolves to an Axios instance
   */
  async getConnection(poolName: string): Promise<AxiosInstance> {
    const pool = this.pools.get(poolName);
    
    if (!pool) {
      throw new Error(`API connection pool "${poolName}" not found`);
    }
    
    return pool.getConnection();
  }

  /**
   * Release a connection back to a pool
   * @param poolName Pool name
   * @param client Axios instance
   */
  releaseConnection(poolName: string, client: AxiosInstance): void {
    const pool = this.pools.get(poolName);
    
    if (!pool) {
      logService.log('warn', `Attempted to release connection to non-existent pool "${poolName}"`, null, 'ApiConnectionPool');
      return;
    }
    
    pool.releaseConnection(client);
  }

  /**
   * Execute an API operation with a connection from a pool
   * @param poolName Pool name
   * @param operation Function that takes an Axios instance and returns a promise
   * @returns Promise that resolves to the result of the operation
   */
  async withConnection<T>(poolName: string, operation: (client: AxiosInstance) => Promise<T>): Promise<T> {
    let client: AxiosInstance | null = null;
    
    try {
      client = await this.getConnection(poolName);
      return await operation(client);
    } finally {
      if (client) {
        this.releaseConnection(poolName, client);
      }
    }
  }

  /**
   * Get statistics about a connection pool
   * @param poolName Pool name
   * @returns Connection pool statistics
   */
  getStats(poolName: string): any {
    const pool = this.pools.get(poolName);
    
    if (!pool) {
      return {
        initialized: false,
        poolName
      };
    }
    
    return pool.getStats();
  }

  /**
   * Get statistics about all connection pools
   * @returns Map of pool name to pool statistics
   */
  getAllStats(): Map<string, any> {
    const stats = new Map<string, any>();
    
    for (const [name, pool] of this.pools.entries()) {
      stats.set(name, pool.getStats());
    }
    
    return stats;
  }

  /**
   * Close a connection pool
   * @param poolName Pool name
   */
  async closePool(poolName: string): Promise<void> {
    const pool = this.pools.get(poolName);
    
    if (pool) {
      await connectionPoolManager.closePool(poolName);
      this.pools.delete(poolName);
      
      logService.log('info', `Closed API connection pool "${poolName}"`, null, 'ApiConnectionPool');
    }
  }

  /**
   * Close all connection pools
   */
  async closeAllPools(): Promise<void> {
    const poolNames = Array.from(this.pools.keys());
    
    for (const poolName of poolNames) {
      await this.closePool(poolName);
    }
    
    logService.log('info', 'Closed all API connection pools', null, 'ApiConnectionPool');
  }
}

export const apiConnectionPool = ApiConnectionPool.getInstance();
