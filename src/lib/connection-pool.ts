import { EventEmitter } from './event-emitter';
import { logService } from './log-service';

/**
 * Connection pool options
 */
export interface ConnectionPoolOptions<T> {
  /** Maximum number of connections in the pool */
  maxConnections?: number;
  /** Minimum number of connections to keep in the pool */
  minConnections?: number;
  /** Maximum time (ms) a connection can be idle before being removed */
  idleTimeoutMs?: number;
  /** Maximum time (ms) to wait for a connection before timing out */
  connectionTimeoutMs?: number;
  /** Maximum lifetime (ms) of a connection before it's recycled */
  maxLifetimeMs?: number;
  /** Function to create a new connection */
  createConnection: () => Promise<T>;
  /** Function to validate a connection is still valid */
  validateConnection?: (connection: T) => Promise<boolean>;
  /** Function to close a connection */
  closeConnection: (connection: T) => Promise<void>;
  /** Name of the pool for logging */
  name?: string;
}

/**
 * Connection with metadata
 */
interface PooledConnection<T> {
  /** The actual connection */
  connection: T;
  /** When the connection was created */
  createdAt: number;
  /** When the connection was last used */
  lastUsedAt: number;
  /** Whether the connection is currently in use */
  inUse: boolean;
  /** Number of times this connection has been used */
  useCount: number;
}

/**
 * Connection pool statistics
 */
export interface ConnectionPoolStats {
  /** Name of the pool */
  name: string;
  /** Total number of connections in the pool */
  totalConnections: number;
  /** Number of active connections */
  activeConnections: number;
  /** Number of idle connections */
  idleConnections: number;
  /** Number of connection requests */
  connectionRequests: number;
  /** Number of connection timeouts */
  connectionTimeouts: number;
  /** Number of connection errors */
  connectionErrors: number;
  /** Number of connections created */
  connectionsCreated: number;
  /** Number of connections closed */
  connectionsClosed: number;
  /** Average wait time for a connection (ms) */
  averageWaitTime: number;
  /** Maximum wait time for a connection (ms) */
  maxWaitTime: number;
  /** Average connection lifetime (ms) */
  averageLifetime: number;
  /** Maximum connection lifetime (ms) */
  maxLifetime: number;
}

/**
 * Generic connection pool for managing and reusing connections
 */
export class ConnectionPool<T> extends EventEmitter {
  private connections: PooledConnection<T>[] = [];
  private waitingClients: Array<{
    resolve: (connection: T) => void;
    reject: (error: Error) => void;
    startTime: number;
  }> = [];
  private maintenanceInterval: NodeJS.Timeout | null = null;
  private closed = false;
  private stats = {
    connectionRequests: 0,
    connectionTimeouts: 0,
    connectionErrors: 0,
    connectionsCreated: 0,
    connectionsClosed: 0,
    waitTimes: [] as number[],
    lifetimes: [] as number[]
  };

  // Default options
  private readonly options: Required<ConnectionPoolOptions<T>>;
  private readonly DEFAULT_MAX_CONNECTIONS = 10;
  private readonly DEFAULT_MIN_CONNECTIONS = 2;
  private readonly DEFAULT_IDLE_TIMEOUT_MS = 30000; // 30 seconds
  private readonly DEFAULT_CONNECTION_TIMEOUT_MS = 5000; // 5 seconds
  private readonly DEFAULT_MAX_LIFETIME_MS = 3600000; // 1 hour
  private readonly MAINTENANCE_INTERVAL_MS = 10000; // 10 seconds

  /**
   * Create a new connection pool
   * @param options Connection pool options
   */
  constructor(options: ConnectionPoolOptions<T>) {
    super();

    // Set default options
    this.options = {
      maxConnections: options.maxConnections || this.DEFAULT_MAX_CONNECTIONS,
      minConnections: options.minConnections || this.DEFAULT_MIN_CONNECTIONS,
      idleTimeoutMs: options.idleTimeoutMs || this.DEFAULT_IDLE_TIMEOUT_MS,
      connectionTimeoutMs: options.connectionTimeoutMs || this.DEFAULT_CONNECTION_TIMEOUT_MS,
      maxLifetimeMs: options.maxLifetimeMs || this.DEFAULT_MAX_LIFETIME_MS,
      createConnection: options.createConnection,
      validateConnection: options.validateConnection || (async () => true),
      closeConnection: options.closeConnection,
      name: options.name || 'ConnectionPool'
    };

    // Validate options
    if (this.options.minConnections > this.options.maxConnections) {
      throw new Error('minConnections cannot be greater than maxConnections');
    }

    // Start maintenance interval
    this.startMaintenanceInterval();

    // Initialize minimum connections
    this.initializeMinConnections();

    logService.log('info', `Connection pool "${this.options.name}" created`, {
      maxConnections: this.options.maxConnections,
      minConnections: this.options.minConnections,
      idleTimeoutMs: this.options.idleTimeoutMs,
      connectionTimeoutMs: this.options.connectionTimeoutMs,
      maxLifetimeMs: this.options.maxLifetimeMs
    }, 'ConnectionPool');
  }

  /**
   * Initialize the minimum number of connections
   */
  private async initializeMinConnections(): Promise<void> {
    try {
      const connectionsToCreate = this.options.minConnections - this.connections.length;
      
      if (connectionsToCreate <= 0) {
        return;
      }

      logService.log('info', `Initializing ${connectionsToCreate} connections for pool "${this.options.name}"`, null, 'ConnectionPool');

      const connectionPromises: Promise<void>[] = [];
      
      for (let i = 0; i < connectionsToCreate; i++) {
        connectionPromises.push(this.createNewConnection());
      }

      await Promise.all(connectionPromises);
    } catch (error) {
      logService.log('error', `Failed to initialize minimum connections for pool "${this.options.name}"`, error, 'ConnectionPool');
    }
  }

  /**
   * Start the maintenance interval
   */
  private startMaintenanceInterval(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }

    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance();
    }, this.MAINTENANCE_INTERVAL_MS);
  }

  /**
   * Perform maintenance on the connection pool
   */
  private async performMaintenance(): Promise<void> {
    if (this.closed) {
      return;
    }

    try {
      const now = Date.now();
      const idleConnections = this.connections.filter(conn => !conn.inUse);
      const connectionsToRemove: PooledConnection<T>[] = [];

      // Check for idle connections to remove
      for (const conn of idleConnections) {
        // Don't remove connections if we're at or below minConnections
        if (this.connections.length <= this.options.minConnections) {
          break;
        }

        // Remove connections that have been idle for too long
        if (now - conn.lastUsedAt > this.options.idleTimeoutMs) {
          connectionsToRemove.push(conn);
          continue;
        }

        // Remove connections that have exceeded their lifetime
        if (now - conn.createdAt > this.options.maxLifetimeMs) {
          connectionsToRemove.push(conn);
          continue;
        }

        // Validate the connection
        try {
          const isValid = await this.options.validateConnection(conn.connection);
          if (!isValid) {
            connectionsToRemove.push(conn);
          }
        } catch (error) {
          logService.log('warn', `Connection validation failed in pool "${this.options.name}"`, error, 'ConnectionPool');
          connectionsToRemove.push(conn);
        }
      }

      // Remove connections
      for (const conn of connectionsToRemove) {
        await this.removeConnection(conn);
      }

      // Create new connections if needed
      const connectionsToCreate = this.options.minConnections - this.connections.length;
      
      if (connectionsToCreate > 0) {
        logService.log('info', `Creating ${connectionsToCreate} new connections for pool "${this.options.name}"`, null, 'ConnectionPool');
        
        for (let i = 0; i < connectionsToCreate; i++) {
          await this.createNewConnection();
        }
      }

      // Check for waiting clients
      this.processWaitingClients();
    } catch (error) {
      logService.log('error', `Error during connection pool maintenance for "${this.options.name}"`, error, 'ConnectionPool');
    }
  }

  /**
   * Create a new connection
   */
  private async createNewConnection(): Promise<void> {
    if (this.closed) {
      return;
    }

    try {
      // Don't create more connections than maxConnections
      if (this.connections.length >= this.options.maxConnections) {
        return;
      }

      const connection = await this.options.createConnection();
      
      this.connections.push({
        connection,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        inUse: false,
        useCount: 0
      });

      this.stats.connectionsCreated++;
      
      this.emit('connectionCreated', { poolName: this.options.name });
      
      logService.log('debug', `Created new connection in pool "${this.options.name}"`, {
        totalConnections: this.connections.length
      }, 'ConnectionPool');
    } catch (error) {
      this.stats.connectionErrors++;
      logService.log('error', `Failed to create connection in pool "${this.options.name}"`, error, 'ConnectionPool');
      throw error;
    }
  }

  /**
   * Remove a connection from the pool
   * @param pooledConnection The connection to remove
   */
  private async removeConnection(pooledConnection: PooledConnection<T>): Promise<void> {
    try {
      // Remove from the pool
      const index = this.connections.indexOf(pooledConnection);
      
      if (index !== -1) {
        this.connections.splice(index, 1);
      }

      // Close the connection
      await this.options.closeConnection(pooledConnection.connection);
      
      this.stats.connectionsClosed++;
      
      // Calculate lifetime
      const lifetime = Date.now() - pooledConnection.createdAt;
      this.stats.lifetimes.push(lifetime);
      
      // Keep only the last 100 lifetimes
      if (this.stats.lifetimes.length > 100) {
        this.stats.lifetimes.shift();
      }
      
      this.emit('connectionClosed', { 
        poolName: this.options.name,
        lifetime,
        useCount: pooledConnection.useCount
      });
      
      logService.log('debug', `Removed connection from pool "${this.options.name}"`, {
        totalConnections: this.connections.length,
        lifetime,
        useCount: pooledConnection.useCount
      }, 'ConnectionPool');
    } catch (error) {
      logService.log('error', `Failed to remove connection from pool "${this.options.name}"`, error, 'ConnectionPool');
    }
  }

  /**
   * Process waiting clients
   */
  private processWaitingClients(): void {
    // No waiting clients
    if (this.waitingClients.length === 0) {
      return;
    }

    // Get available connections
    const availableConnections = this.connections.filter(conn => !conn.inUse);
    
    // Process waiting clients
    while (this.waitingClients.length > 0 && availableConnections.length > 0) {
      const client = this.waitingClients.shift();
      const connection = availableConnections.shift();
      
      if (client && connection) {
        // Mark connection as in use
        connection.inUse = true;
        connection.lastUsedAt = Date.now();
        connection.useCount++;
        
        // Calculate wait time
        const waitTime = Date.now() - client.startTime;
        this.stats.waitTimes.push(waitTime);
        
        // Keep only the last 100 wait times
        if (this.stats.waitTimes.length > 100) {
          this.stats.waitTimes.shift();
        }
        
        // Resolve the client's promise
        client.resolve(connection.connection);
        
        logService.log('debug', `Assigned connection to waiting client in pool "${this.options.name}"`, {
          waitTime,
          totalConnections: this.connections.length,
          waitingClients: this.waitingClients.length
        }, 'ConnectionPool');
      }
    }
  }

  /**
   * Get a connection from the pool
   * @returns Promise that resolves to a connection
   */
  async getConnection(): Promise<T> {
    if (this.closed) {
      throw new Error(`Connection pool "${this.options.name}" is closed`);
    }

    this.stats.connectionRequests++;

    // Check for available connection
    const availableConnection = this.connections.find(conn => !conn.inUse);
    
    if (availableConnection) {
      // Mark connection as in use
      availableConnection.inUse = true;
      availableConnection.lastUsedAt = Date.now();
      availableConnection.useCount++;
      
      logService.log('debug', `Got connection from pool "${this.options.name}"`, {
        totalConnections: this.connections.length,
        activeConnections: this.connections.filter(conn => conn.inUse).length
      }, 'ConnectionPool');
      
      return availableConnection.connection;
    }

    // Create new connection if possible
    if (this.connections.length < this.options.maxConnections) {
      await this.createNewConnection();
      return this.getConnection();
    }

    // Wait for a connection to become available
    return new Promise<T>((resolve, reject) => {
      const startTime = Date.now();
      
      // Add to waiting clients
      this.waitingClients.push({ resolve, reject, startTime });
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        // Remove from waiting clients
        const index = this.waitingClients.findIndex(client => 
          client.resolve === resolve && client.reject === reject);
        
        if (index !== -1) {
          this.waitingClients.splice(index, 1);
        }
        
        this.stats.connectionTimeouts++;
        
        const error = new Error(`Timeout waiting for connection in pool "${this.options.name}"`);
        reject(error);
        
        logService.log('warn', `Connection timeout in pool "${this.options.name}"`, {
          waitTime: Date.now() - startTime,
          waitingClients: this.waitingClients.length
        }, 'ConnectionPool');
      }, this.options.connectionTimeoutMs);
      
      // Clear timeout when resolved or rejected
      const clearTimeoutWrapper = (fn: Function) => (...args: any[]) => {
        clearTimeout(timeoutId);
        return fn(...args);
      };
      
      resolve = clearTimeoutWrapper(resolve);
      reject = clearTimeoutWrapper(reject);
    });
  }

  /**
   * Release a connection back to the pool
   * @param connection The connection to release
   */
  releaseConnection(connection: T): void {
    if (this.closed) {
      // If the pool is closed, just close the connection
      this.options.closeConnection(connection).catch(error => {
        logService.log('error', `Failed to close connection in pool "${this.options.name}"`, error, 'ConnectionPool');
      });
      return;
    }

    // Find the connection in the pool
    const pooledConnection = this.connections.find(conn => conn.connection === connection);
    
    if (!pooledConnection) {
      logService.log('warn', `Attempted to release a connection not in pool "${this.options.name}"`, null, 'ConnectionPool');
      return;
    }

    // Mark connection as not in use
    pooledConnection.inUse = false;
    pooledConnection.lastUsedAt = Date.now();
    
    logService.log('debug', `Released connection back to pool "${this.options.name}"`, {
      totalConnections: this.connections.length,
      activeConnections: this.connections.filter(conn => conn.inUse).length
    }, 'ConnectionPool');
    
    // Process waiting clients
    this.processWaitingClients();
  }

  /**
   * Get statistics about the connection pool
   * @returns Connection pool statistics
   */
  getStats(): ConnectionPoolStats {
    const activeConnections = this.connections.filter(conn => conn.inUse).length;
    const idleConnections = this.connections.length - activeConnections;
    
    // Calculate average and max wait times
    const averageWaitTime = this.stats.waitTimes.length > 0
      ? this.stats.waitTimes.reduce((sum, time) => sum + time, 0) / this.stats.waitTimes.length
      : 0;
    
    const maxWaitTime = this.stats.waitTimes.length > 0
      ? Math.max(...this.stats.waitTimes)
      : 0;
    
    // Calculate average and max lifetimes
    const averageLifetime = this.stats.lifetimes.length > 0
      ? this.stats.lifetimes.reduce((sum, time) => sum + time, 0) / this.stats.lifetimes.length
      : 0;
    
    const maxLifetime = this.stats.lifetimes.length > 0
      ? Math.max(...this.stats.lifetimes)
      : 0;
    
    return {
      name: this.options.name,
      totalConnections: this.connections.length,
      activeConnections,
      idleConnections,
      connectionRequests: this.stats.connectionRequests,
      connectionTimeouts: this.stats.connectionTimeouts,
      connectionErrors: this.stats.connectionErrors,
      connectionsCreated: this.stats.connectionsCreated,
      connectionsClosed: this.stats.connectionsClosed,
      averageWaitTime,
      maxWaitTime,
      averageLifetime,
      maxLifetime
    };
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    // Stop maintenance interval
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }

    // Reject all waiting clients
    for (const client of this.waitingClients) {
      client.reject(new Error(`Connection pool "${this.options.name}" is closing`));
    }
    
    this.waitingClients = [];

    // Close all connections
    const closePromises = this.connections.map(conn => {
      try {
        return this.options.closeConnection(conn.connection);
      } catch (error) {
        logService.log('error', `Failed to close connection in pool "${this.options.name}"`, error, 'ConnectionPool');
        return Promise.resolve();
      }
    });

    await Promise.all(closePromises);
    
    this.connections = [];
    
    logService.log('info', `Connection pool "${this.options.name}" closed`, {
      stats: this.getStats()
    }, 'ConnectionPool');
    
    this.emit('poolClosed', { poolName: this.options.name });
  }
}

/**
 * Connection pool manager for managing multiple connection pools
 */
class ConnectionPoolManager {
  private static instance: ConnectionPoolManager;
  private pools: Map<string, ConnectionPool<any>> = new Map();

  private constructor() {}

  static getInstance(): ConnectionPoolManager {
    if (!ConnectionPoolManager.instance) {
      ConnectionPoolManager.instance = new ConnectionPoolManager();
    }
    return ConnectionPoolManager.instance;
  }

  /**
   * Create a new connection pool
   * @param options Connection pool options
   * @returns The created connection pool
   */
  createPool<T>(options: ConnectionPoolOptions<T>): ConnectionPool<T> {
    const poolName = options.name || 'pool-' + Date.now();
    
    if (this.pools.has(poolName)) {
      throw new Error(`Connection pool "${poolName}" already exists`);
    }
    
    const pool = new ConnectionPool<T>(options);
    this.pools.set(poolName, pool);
    
    return pool;
  }

  /**
   * Get a connection pool by name
   * @param name Pool name
   * @returns The connection pool or undefined if not found
   */
  getPool<T>(name: string): ConnectionPool<T> | undefined {
    return this.pools.get(name) as ConnectionPool<T> | undefined;
  }

  /**
   * Close a connection pool
   * @param name Pool name
   */
  async closePool(name: string): Promise<void> {
    const pool = this.pools.get(name);
    
    if (pool) {
      await pool.close();
      this.pools.delete(name);
    }
  }

  /**
   * Close all connection pools
   */
  async closeAllPools(): Promise<void> {
    const closePromises = Array.from(this.pools.values()).map(pool => pool.close());
    await Promise.all(closePromises);
    this.pools.clear();
  }

  /**
   * Get statistics for all connection pools
   * @returns Map of pool name to pool statistics
   */
  getAllPoolStats(): Map<string, ConnectionPoolStats> {
    const stats = new Map<string, ConnectionPoolStats>();
    
    for (const [name, pool] of this.pools.entries()) {
      stats.set(name, pool.getStats());
    }
    
    return stats;
  }
}

export const connectionPoolManager = ConnectionPoolManager.getInstance();
