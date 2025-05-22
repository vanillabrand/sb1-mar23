/**
 * Cached API Service
 * 
 * This service provides cached API calls to improve performance.
 * It uses the ApiCache service to cache API responses.
 */

import { apiCache } from './api-cache';
import { logService } from './log-service';

interface CachedApiOptions {
  ttl?: number;
  forceRefresh?: boolean;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
}

class CachedApiService {
  /**
   * Fetch data from API with caching
   * @param url API URL
   * @param options Cache options
   * @returns Promise with API response data
   */
  async fetch<T>(url: string, options: CachedApiOptions = {}): Promise<T> {
    const {
      ttl,
      forceRefresh = false,
      headers = {},
      method = 'GET',
      body
    } = options;

    // Generate cache key based on URL and method
    const cacheKey = `${method}:${url}`;

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedData = apiCache.get<T>(cacheKey);
      if (cachedData) {
        logService.log('info', `Cache hit for ${cacheKey}`, null, 'CachedApiService');
        return cachedData;
      }
    }

    try {
      // Make API request
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as T;

      // Cache the response
      apiCache.set(cacheKey, data, ttl);
      logService.log('info', `Cached API response for ${cacheKey}`, null, 'CachedApiService');

      return data;
    } catch (error) {
      logService.log('error', `API request failed for ${cacheKey}`, error, 'CachedApiService');
      throw error;
    }
  }

  /**
   * Clear cache for a specific URL
   * @param url API URL
   * @param method HTTP method
   */
  clearCache(url: string, method: string = 'GET'): void {
    const cacheKey = `${method}:${url}`;
    apiCache.remove(cacheKey);
    logService.log('info', `Cleared cache for ${cacheKey}`, null, 'CachedApiService');
  }

  /**
   * Clear all API cache
   */
  clearAllCache(): void {
    apiCache.clear();
    logService.log('info', 'Cleared all API cache', null, 'CachedApiService');
  }
}

// Export a singleton instance
export const cachedApiService = new CachedApiService();
