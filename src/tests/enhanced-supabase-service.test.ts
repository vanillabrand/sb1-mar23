import { enhancedSupabaseService } from '../lib/enhanced-supabase-service';
import { dbConnectionPool } from '../lib/db-connection-pool';
import { cacheService } from '../lib/cache-service';
import { eventBus } from '../lib/event-bus';

// Mock dependencies
jest.mock('../lib/db-connection-pool', () => ({
  dbConnectionPool: {
    initialize: jest.fn().mockResolvedValue(undefined),
    withConnection: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      name: 'supabase-pool',
      totalConnections: 5,
      activeConnections: 2,
      idleConnections: 3
    }),
    close: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('../lib/cache-service', () => ({
  cacheService: {
    getCacheNames: jest.fn().mockReturnValue([]),
    createCache: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    getKeys: jest.fn().mockReturnValue(['strategies:1', 'strategies:2'])
  }
}));

jest.mock('../lib/event-bus', () => ({
  eventBus: {
    emit: jest.fn()
  }
}));

jest.mock('../lib/log-service', () => ({
  logService: {
    log: jest.fn()
  }
}));

jest.mock('../lib/demoService', () => ({
  demoService: {
    isInDemoMode: jest.fn().mockReturnValue(false)
  }
}));

describe('Enhanced Supabase Service', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await enhancedSupabaseService.initialize();
  });
  
  afterEach(async () => {
    await enhancedSupabaseService.close();
  });
  
  test('should initialize the service', async () => {
    expect(dbConnectionPool.initialize).toHaveBeenCalled();
    expect(cacheService.createCache).toHaveBeenCalled();
  });
  
  test('should execute a query with connection pooling', async () => {
    // Mock the withConnection method
    const mockResult = { id: 1, name: 'Test Strategy' };
    (dbConnectionPool.withConnection as jest.Mock).mockImplementation(async (callback) => {
      // Mock the Supabase client
      const mockClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockResult,
          error: null
        })
      };
      
      // Call the callback with the mock client
      return callback(mockClient);
    });
    
    // Execute a query
    const result = await enhancedSupabaseService.getById('strategies', 1);
    
    // Verify the result
    expect(result).toEqual(mockResult);
    expect(dbConnectionPool.withConnection).toHaveBeenCalled();
  });
  
  test('should cache query results', async () => {
    // Mock the cache hit
    (cacheService.get as jest.Mock).mockReturnValue({ id: 1, name: 'Cached Strategy' });
    
    // Execute a query
    const result = await enhancedSupabaseService.getById('strategies', 1);
    
    // Verify the result came from cache
    expect(result).toEqual({ id: 1, name: 'Cached Strategy' });
    expect(cacheService.get).toHaveBeenCalled();
    expect(dbConnectionPool.withConnection).not.toHaveBeenCalled();
  });
  
  test('should invalidate cache for a table', async () => {
    // Invalidate cache
    enhancedSupabaseService.invalidateTableCache('strategies');
    
    // Verify cache was invalidated
    expect(cacheService.getKeys).toHaveBeenCalled();
    expect(cacheService.delete).toHaveBeenCalled();
  });
  
  test('should get connection pool statistics', () => {
    const stats = enhancedSupabaseService.getStats();
    
    expect(stats).toBeDefined();
    expect(stats.name).toBe('supabase-pool');
    expect(stats.totalConnections).toBe(5);
    expect(stats.activeConnections).toBe(2);
    expect(stats.idleConnections).toBe(3);
  });
  
  test('should insert data and emit event', async () => {
    // Mock the withConnection method
    const mockResult = { id: 1, name: 'New Strategy' };
    (dbConnectionPool.withConnection as jest.Mock).mockImplementation(async (callback) => {
      // Mock the Supabase client
      const mockClient = {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [mockResult],
          error: null
        })
      };
      
      // Call the callback with the mock client
      return callback(mockClient);
    });
    
    // Insert data
    const result = await enhancedSupabaseService.insert('strategies', { name: 'New Strategy' });
    
    // Verify the result
    expect(result).toEqual(mockResult);
    expect(dbConnectionPool.withConnection).toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenCalledWith('strategies:inserted', { data: mockResult });
  });
  
  test('should update data and emit event', async () => {
    // Mock the withConnection method
    const mockResult = { id: 1, name: 'Updated Strategy' };
    (dbConnectionPool.withConnection as jest.Mock).mockImplementation(async (callback) => {
      // Mock the Supabase client
      const mockClient = {
        from: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [mockResult],
          error: null
        })
      };
      
      // Call the callback with the mock client
      return callback(mockClient);
    });
    
    // Update data
    const result = await enhancedSupabaseService.update('strategies', 1, { name: 'Updated Strategy' });
    
    // Verify the result
    expect(result).toEqual(mockResult);
    expect(dbConnectionPool.withConnection).toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenCalledWith('strategies:updated', { id: 1, data: mockResult });
  });
  
  test('should delete data and emit event', async () => {
    // Mock the withConnection method
    (dbConnectionPool.withConnection as jest.Mock).mockImplementation(async (callback) => {
      // Mock the Supabase client
      const mockClient = {
        from: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: null
        })
      };
      
      // Call the callback with the mock client
      return callback(mockClient);
    });
    
    // Delete data
    const result = await enhancedSupabaseService.delete('strategies', 1);
    
    // Verify the result
    expect(result).toBe(true);
    expect(dbConnectionPool.withConnection).toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenCalledWith('strategies:deleted', { id: 1 });
  });
});
