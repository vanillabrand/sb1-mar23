import { connectionPoolManager, ConnectionPool } from '../lib/connection-pool';

// Mock the log service
jest.mock('../lib/log-service', () => ({
  logService: {
    log: jest.fn()
  }
}));

describe('Connection Pool', () => {
  let pool: ConnectionPool<any>;
  
  // Mock connection functions
  const createConnection = jest.fn().mockImplementation(() => {
    return Promise.resolve({
      id: `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      isConnected: true
    });
  });
  
  const validateConnection = jest.fn().mockImplementation((conn) => {
    return Promise.resolve(conn.isConnected);
  });
  
  const closeConnection = jest.fn().mockImplementation(() => {
    return Promise.resolve();
  });
  
  beforeEach(() => {
    // Reset mocks
    createConnection.mockClear();
    validateConnection.mockClear();
    closeConnection.mockClear();
    
    // Create a test pool
    pool = connectionPoolManager.createPool({
      name: 'test-pool',
      maxConnections: 5,
      minConnections: 2,
      idleTimeoutMs: 1000,
      connectionTimeoutMs: 500,
      maxLifetimeMs: 5000,
      createConnection,
      validateConnection,
      closeConnection
    });
  });
  
  afterEach(async () => {
    // Close the pool
    await connectionPoolManager.closePool('test-pool');
  });
  
  test('should create a connection pool', () => {
    expect(pool).toBeDefined();
    expect(createConnection).toHaveBeenCalled();
  });
  
  test('should get a connection from the pool', async () => {
    const connection = await pool.getConnection();
    expect(connection).toBeDefined();
    expect(connection.isConnected).toBe(true);
    
    // Release the connection
    pool.releaseConnection(connection);
  });
  
  test('should reuse connections', async () => {
    // Get a connection
    const connection1 = await pool.getConnection();
    
    // Release it
    pool.releaseConnection(connection1);
    
    // Get another connection
    const connection2 = await pool.getConnection();
    
    // It should be the same connection
    expect(connection2).toBe(connection1);
    
    // Release it
    pool.releaseConnection(connection2);
  });
  
  test('should create new connections when needed', async () => {
    // Get all available connections
    const connections = await Promise.all([
      pool.getConnection(),
      pool.getConnection(),
      pool.getConnection(),
      pool.getConnection(),
      pool.getConnection()
    ]);
    
    // Should have created 5 connections
    expect(createConnection).toHaveBeenCalledTimes(5);
    
    // Release all connections
    connections.forEach(conn => pool.releaseConnection(conn));
  });
  
  test('should wait for a connection when pool is full', async () => {
    // Get all available connections
    const connections = await Promise.all([
      pool.getConnection(),
      pool.getConnection(),
      pool.getConnection(),
      pool.getConnection(),
      pool.getConnection()
    ]);
    
    // Start a timer
    const startTime = Date.now();
    
    // Try to get another connection (should wait)
    const connectionPromise = pool.getConnection();
    
    // Release a connection after a delay
    setTimeout(() => {
      pool.releaseConnection(connections[0]);
    }, 100);
    
    // Wait for the connection
    const connection = await connectionPromise;
    
    // Should have waited for the connection
    const waitTime = Date.now() - startTime;
    expect(waitTime).toBeGreaterThanOrEqual(100);
    
    // Release all connections
    connections.slice(1).forEach(conn => pool.releaseConnection(conn));
    pool.releaseConnection(connection);
  });
  
  test('should execute an operation with a connection', async () => {
    // Define a test operation
    const testOperation = jest.fn().mockImplementation(async (conn) => {
      return `Result from ${conn.id}`;
    });
    
    // Execute the operation
    const result = await pool.withConnection(testOperation);
    
    // Should have executed the operation
    expect(testOperation).toHaveBeenCalled();
    expect(result).toContain('Result from conn-');
  });
  
  test('should get pool statistics', () => {
    const stats = pool.getStats();
    
    expect(stats).toBeDefined();
    expect(stats.name).toBe('test-pool');
    expect(stats.totalConnections).toBeGreaterThanOrEqual(2); // minConnections
    expect(stats.activeConnections).toBe(0);
    expect(stats.idleConnections).toBeGreaterThanOrEqual(2); // minConnections
  });
});

describe('Connection Pool Manager', () => {
  afterEach(async () => {
    // Close all pools
    await connectionPoolManager.closeAllPools();
  });
  
  test('should create multiple pools', () => {
    // Create test pools
    const pool1 = connectionPoolManager.createPool({
      name: 'test-pool-1',
      createConnection: () => Promise.resolve({ id: 'conn-1' }),
      closeConnection: () => Promise.resolve()
    });
    
    const pool2 = connectionPoolManager.createPool({
      name: 'test-pool-2',
      createConnection: () => Promise.resolve({ id: 'conn-2' }),
      closeConnection: () => Promise.resolve()
    });
    
    expect(pool1).toBeDefined();
    expect(pool2).toBeDefined();
    
    // Get a pool by name
    const retrievedPool = connectionPoolManager.getPool('test-pool-1');
    expect(retrievedPool).toBe(pool1);
  });
  
  test('should get statistics for all pools', async () => {
    // Create test pools
    connectionPoolManager.createPool({
      name: 'stats-pool-1',
      createConnection: () => Promise.resolve({ id: 'conn-1' }),
      closeConnection: () => Promise.resolve()
    });
    
    connectionPoolManager.createPool({
      name: 'stats-pool-2',
      createConnection: () => Promise.resolve({ id: 'conn-2' }),
      closeConnection: () => Promise.resolve()
    });
    
    // Get all pool stats
    const allStats = connectionPoolManager.getAllPoolStats();
    
    expect(allStats).toBeDefined();
    expect(allStats.size).toBe(2);
    expect(allStats.has('stats-pool-1')).toBe(true);
    expect(allStats.has('stats-pool-2')).toBe(true);
  });
  
  test('should close a specific pool', async () => {
    // Create a test pool
    connectionPoolManager.createPool({
      name: 'close-test-pool',
      createConnection: () => Promise.resolve({ id: 'conn' }),
      closeConnection: () => Promise.resolve()
    });
    
    // Close the pool
    await connectionPoolManager.closePool('close-test-pool');
    
    // Should no longer exist
    const pool = connectionPoolManager.getPool('close-test-pool');
    expect(pool).toBeUndefined();
  });
});
