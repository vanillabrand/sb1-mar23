import { EventEmitter } from './event-emitter';
import { logService } from './log-service';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of items in the cache
  namespace?: string; // Namespace for the cache
}

export interface CacheItem<T> {
  value: T;
  expires: number;
  lastAccessed: number;
  hitCount: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  ttl: number;
  namespace: string;
}

/**
 * In-memory cache service with TTL, LRU eviction, and namespaces
 */
class CacheService extends EventEmitter {
  private static instance: CacheService;
  private caches: Map<string, Map<string, CacheItem<any>>> = new Map();
  private stats: Map<string, { hits: number; misses: number }> = new Map();
  private options: Map<string, CacheOptions> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DEFAULT_MAX_SIZE = 1000;
  private readonly DEFAULT_NAMESPACE = 'default';
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute

  private constructor() {
    super();
    this.startCleanupInterval();
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Initialize a cache namespace with options
   * @param options Cache options
   * @returns The namespace
   */
  initializeCache(options: CacheOptions = {}): string {
    const namespace = options.namespace || this.DEFAULT_NAMESPACE;
    
    // Create the cache if it doesn't exist
    if (!this.caches.has(namespace)) {
      this.caches.set(namespace, new Map());
      this.stats.set(namespace, { hits: 0, misses: 0 });
      this.options.set(namespace, {
        ttl: options.ttl || this.DEFAULT_TTL,
        maxSize: options.maxSize || this.DEFAULT_MAX_SIZE,
        namespace
      });
      
      logService.log('info', `Initialized cache namespace: ${namespace}`, {
        ttl: options.ttl || this.DEFAULT_TTL,
        maxSize: options.maxSize || this.DEFAULT_MAX_SIZE
      }, 'CacheService');
      
      this.emit('cacheInitialized', { namespace, options });
    }
    
    return namespace;
  }

  /**
   * Get an item from the cache
   * @param key The cache key
   * @param namespace The cache namespace
   * @returns The cached value or undefined if not found or expired
   */
  get<T>(key: string, namespace: string = this.DEFAULT_NAMESPACE): T | undefined {
    // Initialize the cache if it doesn't exist
    if (!this.caches.has(namespace)) {
      this.initializeCache({ namespace });
    }
    
    const cache = this.caches.get(namespace)!;
    const stats = this.stats.get(namespace)!;
    const now = Date.now();
    
    // Check if the item exists and is not expired
    if (cache.has(key)) {
      const item = cache.get(key)!;
      
      // Check if the item is expired
      if (item.expires < now) {
        // Remove the expired item
        cache.delete(key);
        stats.misses++;
        this.emit('cacheMiss', { key, namespace, reason: 'expired' });
        return undefined;
      }
      
      // Update access time and hit count
      item.lastAccessed = now;
      item.hitCount++;
      stats.hits++;
      
      this.emit('cacheHit', { key, namespace, hitCount: item.hitCount });
      
      return item.value;
    }
    
    // Item not found
    stats.misses++;
    this.emit('cacheMiss', { key, namespace, reason: 'not_found' });
    return undefined;
  }

  /**
   * Set an item in the cache
   * @param key The cache key
   * @param value The value to cache
   * @param namespace The cache namespace
   * @param ttl Optional TTL override for this item
   * @returns The cached value
   */
  set<T>(key: string, value: T, namespace: string = this.DEFAULT_NAMESPACE, ttl?: number): T {
    // Initialize the cache if it doesn't exist
    if (!this.caches.has(namespace)) {
      this.initializeCache({ namespace });
    }
    
    const cache = this.caches.get(namespace)!;
    const options = this.options.get(namespace)!;
    const now = Date.now();
    
    // Check if we need to evict items due to size limit
    if (cache.size >= (options.maxSize || this.DEFAULT_MAX_SIZE)) {
      this.evictLRU(namespace);
    }
    
    // Calculate expiration time
    const itemTtl = ttl || options.ttl || this.DEFAULT_TTL;
    const expires = now + itemTtl;
    
    // Store the item
    cache.set(key, {
      value,
      expires,
      lastAccessed: now,
      hitCount: 0
    });
    
    this.emit('cacheSet', { key, namespace, ttl: itemTtl });
    
    return value;
  }

  /**
   * Delete an item from the cache
   * @param key The cache key
   * @param namespace The cache namespace
   * @returns True if the item was deleted, false otherwise
   */
  delete(key: string, namespace: string = this.DEFAULT_NAMESPACE): boolean {
    if (!this.caches.has(namespace)) {
      return false;
    }
    
    const cache = this.caches.get(namespace)!;
    const deleted = cache.delete(key);
    
    if (deleted) {
      this.emit('cacheDelete', { key, namespace });
    }
    
    return deleted;
  }

  /**
   * Clear all items from a cache namespace
   * @param namespace The cache namespace
   * @returns True if the cache was cleared, false if it didn't exist
   */
  clear(namespace: string = this.DEFAULT_NAMESPACE): boolean {
    if (!this.caches.has(namespace)) {
      return false;
    }
    
    const cache = this.caches.get(namespace)!;
    const size = cache.size;
    cache.clear();
    
    // Reset stats
    this.stats.set(namespace, { hits: 0, misses: 0 });
    
    this.emit('cacheClear', { namespace, itemsCleared: size });
    
    return true;
  }

  /**
   * Get cache statistics
   * @param namespace The cache namespace
   * @returns Cache statistics
   */
  getStats(namespace: string = this.DEFAULT_NAMESPACE): CacheStats | undefined {
    if (!this.caches.has(namespace)) {
      return undefined;
    }
    
    const cache = this.caches.get(namespace)!;
    const stats = this.stats.get(namespace)!;
    const options = this.options.get(namespace)!;
    
    return {
      hits: stats.hits,
      misses: stats.misses,
      size: cache.size,
      maxSize: options.maxSize || this.DEFAULT_MAX_SIZE,
      ttl: options.ttl || this.DEFAULT_TTL,
      namespace
    };
  }

  /**
   * Get all cache namespaces
   * @returns Array of namespace names
   */
  getNamespaces(): string[] {
    return Array.from(this.caches.keys());
  }

  /**
   * Get or set an item in the cache
   * @param key The cache key
   * @param getter Function to get the value if not in cache
   * @param namespace The cache namespace
   * @param ttl Optional TTL override for this item
   * @returns The cached or retrieved value
   */
  async getOrSet<T>(
    key: string,
    getter: () => Promise<T>,
    namespace: string = this.DEFAULT_NAMESPACE,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cachedValue = this.get<T>(key, namespace);
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    
    try {
      // Get the value from the source
      const value = await getter();
      
      // Cache the value
      this.set(key, value, namespace, ttl);
      
      return value;
    } catch (error) {
      logService.log('error', `Failed to get value for cache key ${key}`, error, 'CacheService');
      throw error;
    }
  }

  /**
   * Evict the least recently used item from the cache
   * @param namespace The cache namespace
   * @returns True if an item was evicted, false otherwise
   */
  private evictLRU(namespace: string): boolean {
    const cache = this.caches.get(namespace);
    if (!cache || cache.size === 0) {
      return false;
    }
    
    let lruKey: string | null = null;
    let lruTime = Infinity;
    
    // Find the least recently used item
    for (const [key, item] of cache.entries()) {
      if (item.lastAccessed < lruTime) {
        lruKey = key;
        lruTime = item.lastAccessed;
      }
    }
    
    if (lruKey) {
      cache.delete(lruKey);
      this.emit('cacheEvict', { key: lruKey, namespace, reason: 'lru' });
      return true;
    }
    
    return false;
  }

  /**
   * Start the cleanup interval to remove expired items
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredItems();
    }, this.CLEANUP_INTERVAL);
    
    logService.log('info', `Started cache cleanup interval: ${this.CLEANUP_INTERVAL}ms`, null, 'CacheService');
  }

  /**
   * Clean up expired items from all caches
   */
  private cleanupExpiredItems(): void {
    const now = Date.now();
    let totalRemoved = 0;
    
    for (const [namespace, cache] of this.caches.entries()) {
      let namespaceRemoved = 0;
      
      // Find and remove expired items
      for (const [key, item] of cache.entries()) {
        if (item.expires < now) {
          cache.delete(key);
          namespaceRemoved++;
          totalRemoved++;
        }
      }
      
      if (namespaceRemoved > 0) {
        this.emit('cacheCleanup', { namespace, itemsRemoved: namespaceRemoved });
      }
    }
    
    if (totalRemoved > 0) {
      logService.log('debug', `Cleaned up ${totalRemoved} expired cache items`, null, 'CacheService');
    }
  }
}

export const cacheService = CacheService.getInstance();
