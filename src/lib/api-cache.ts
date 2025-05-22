/**
 * API Cache Service
 * 
 * This service provides caching functionality for API calls to improve performance.
 * It uses a simple in-memory cache with configurable TTL (time-to-live) for each entry.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time-to-live in milliseconds
}

class ApiCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTtl: number = 60000; // Default TTL: 1 minute

  /**
   * Get data from cache if available and not expired
   * @param key Cache key
   * @returns Cached data or null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Cache entry has expired
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Set data in cache with optional TTL
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Time-to-live in milliseconds (optional, defaults to 1 minute)
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTtl): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Remove data from cache
   * @param key Cache key
   */
  remove(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Set default TTL for cache entries
   * @param ttl Time-to-live in milliseconds
   */
  setDefaultTtl(ttl: number): void {
    this.defaultTtl = ttl;
  }

  /**
   * Get the number of entries in the cache
   * @returns Number of cache entries
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if a key exists in the cache and is not expired
   * @param key Cache key
   * @returns True if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Cache entry has expired
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get all cache keys
   * @returns Array of cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Remove expired entries from cache
   * @returns Number of entries removed
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    return removed;
  }
}

// Export a singleton instance
export const apiCache = new ApiCache();
