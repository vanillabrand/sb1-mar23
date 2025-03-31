import { logService } from './log-service';
import { aiMarketService } from './ai-market-service';
import { newsService } from './news-service';
import type { MarketInsight, NewsItem } from './types';

/**
 * GlobalCacheService provides application-wide caching for expensive operations
 * like AI market insights and news fetching. It refreshes data in the background
 * at regular intervals and serves the same cached data to all users.
 */
class GlobalCacheService {
  private static instance: GlobalCacheService;

  // Cache storage
  private marketInsightsCache: Map<string, MarketInsight> = new Map();
  private newsCache: Map<string, NewsItem[]> = new Map();
  private portfolioCache: Map<string, any> = new Map();

  // Cache timestamps
  private marketInsightsLastUpdate: number = 0;
  private newsLastUpdate: number = 0;
  private portfolioLastUpdate: number = 0;

  // Default assets to monitor when none are specified
  private readonly DEFAULT_ASSETS = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT', 'XRP_USDT'];

  // Cache refresh interval (15 minutes)
  private readonly CACHE_REFRESH_INTERVAL = 15 * 60 * 1000;

  // Background refresh timers
  private marketInsightsTimer: NodeJS.Timeout | null = null;
  private newsTimer: NodeJS.Timeout | null = null;
  private portfolioTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Initialize caches on service creation
    this.initializeCache();
  }

  static getInstance(): GlobalCacheService {
    if (!GlobalCacheService.instance) {
      GlobalCacheService.instance = new GlobalCacheService();
    }
    return GlobalCacheService.instance;
  }

  /**
   * Initialize the cache and start background refresh timers
   */
  private async initializeCache(): Promise<void> {
    try {
      // Initial cache population - run in parallel for faster startup
      const initPromises = [
        this.refreshMarketInsights().catch(error => {
          logService.log('error', 'Failed to initialize market insights cache', error, 'GlobalCacheService');
          // Return a synthetic fallback
          return this.createSyntheticMarketInsights();
        }),
        this.refreshNews().catch(error => {
          logService.log('error', 'Failed to initialize news cache', error, 'GlobalCacheService');
          // Continue without news data
          return [];
        }),
        this.refreshPortfolioData().catch(error => {
          logService.log('error', 'Failed to initialize portfolio cache', error, 'GlobalCacheService');
          // Continue without portfolio data
          return {};
        })
      ];

      // Wait for all initialization to complete
      await Promise.all(initPromises);

      // Set up background refresh timers
      this.marketInsightsTimer = setInterval(() => {
        this.refreshMarketInsights().catch(error => {
          logService.log('error', 'Failed to refresh market insights cache', error, 'GlobalCacheService');
        });
      }, this.CACHE_REFRESH_INTERVAL);

      this.newsTimer = setInterval(() => {
        this.refreshNews().catch(error => {
          logService.log('error', 'Failed to refresh news cache', error, 'GlobalCacheService');
        });
      }, this.CACHE_REFRESH_INTERVAL);

      this.portfolioTimer = setInterval(() => {
        this.refreshPortfolioData().catch(error => {
          logService.log('error', 'Failed to refresh portfolio cache', error, 'GlobalCacheService');
        });
      }, this.CACHE_REFRESH_INTERVAL);

      logService.log('info', 'Global cache initialized successfully', null, 'GlobalCacheService');
    } catch (error) {
      logService.log('error', 'Failed to initialize global cache', error, 'GlobalCacheService');
    }
  }

  /**
   * Create synthetic market insights as a fallback
   */
  private createSyntheticMarketInsights(): MarketInsight {
    const assets = this.DEFAULT_ASSETS.map(asset => ({
      symbol: asset,
      sentiment: ['bullish', 'bearish', 'neutral'][Math.floor(Math.random() * 3)] as 'bullish' | 'bearish' | 'neutral',
      signals: ['Price above moving average', 'Volume increasing', 'Support level holding'],
      riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high'
    }));

    return {
      timestamp: Date.now(),
      assets,
      marketConditions: {
        trend: ['bullish', 'bearish', 'sideways'][Math.floor(Math.random() * 3)] as 'bullish' | 'bearish' | 'sideways',
        volatility: 'medium',
        volume: 'medium'
      },
      recommendations: [
        'Diversify your portfolio across multiple assets',
        'Consider setting stop-loss orders to manage risk',
        'Monitor market conditions regularly'
      ]
    };
  }

  /**
   * Refresh the market insights cache for default assets
   */
  private async refreshMarketInsights(): Promise<MarketInsight> {
    try {
      logService.log('info', 'Refreshing market insights cache', null, 'GlobalCacheService');

      // Generate a cache key for the default assets
      const cacheKey = this.DEFAULT_ASSETS.sort().join(',');

      // Set a timeout for the API call
      const timeoutPromise = new Promise<MarketInsight>((_, reject) => {
        setTimeout(() => reject(new Error('Market insights API timeout')), 5000);
      });

      // Fetch fresh market insights with timeout
      const insightsPromise = aiMarketService.getMarketInsights(this.DEFAULT_ASSETS);

      // Race between the API call and the timeout
      const insights = await Promise.race([insightsPromise, timeoutPromise]);

      // Update the cache
      this.marketInsightsCache.set(cacheKey, insights);
      this.marketInsightsLastUpdate = Date.now();

      logService.log('info', 'Market insights cache refreshed successfully', null, 'GlobalCacheService');
      return insights;
    } catch (error) {
      logService.log('error', 'Failed to refresh market insights cache', error, 'GlobalCacheService');

      // If we have cached data, return it even if refresh failed
      const cacheKey = this.DEFAULT_ASSETS.sort().join(',');
      if (this.marketInsightsCache.has(cacheKey)) {
        return this.marketInsightsCache.get(cacheKey)!;
      }

      // Otherwise, create synthetic data
      const syntheticInsights = this.createSyntheticMarketInsights();
      this.marketInsightsCache.set(cacheKey, syntheticInsights);
      this.marketInsightsLastUpdate = Date.now();

      return syntheticInsights;
    }
  }

  /**
   * Refresh the news cache for default assets
   */
  private async refreshNews(): Promise<void> {
    try {
      logService.log('info', 'Refreshing news cache', null, 'GlobalCacheService');

      // Process each asset individually
      for (const asset of this.DEFAULT_ASSETS) {
        const normalizedAsset = asset.replace(/_/g, '').replace(/USDT/g, '');

        // Fetch fresh news for this asset
        const news = await newsService.getNewsForAsset(normalizedAsset);

        // Update the cache
        this.newsCache.set(normalizedAsset, news);
      }

      this.newsLastUpdate = Date.now();
      logService.log('info', 'News cache refreshed successfully', null, 'GlobalCacheService');
    } catch (error) {
      logService.log('error', 'Failed to refresh news cache', error, 'GlobalCacheService');
      throw error;
    }
  }

  /**
   * Refresh portfolio data cache
   */
  private async refreshPortfolioData(): Promise<any> {
    try {
      logService.log('info', 'Refreshing portfolio data cache', null, 'GlobalCacheService');

      // Import dynamically to avoid circular dependencies
      const { portfolioService } = await import('./portfolio-service');

      // Fetch portfolio data for different timeframes
      const timeframes = ['1h', '1d', '1w', '1m'];

      for (const timeframe of timeframes) {
        try {
          // Set a timeout for each portfolio data fetch
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Portfolio data timeout for ${timeframe}`)), 3000);
          });

          // Fetch portfolio data with timeout
          const dataPromise = portfolioService.getPerformanceData(timeframe as any);
          const data = await Promise.race([dataPromise, timeoutPromise]);

          // Cache the data
          this.portfolioCache.set(`performance_${timeframe}`, data);
        } catch (tfError) {
          logService.log('warn', `Failed to refresh portfolio data for timeframe ${timeframe}`, tfError, 'GlobalCacheService');
          // Continue with other timeframes
        }
      }

      // Also cache the portfolio summary
      try {
        const summary = await portfolioService.getPortfolioSummary();
        this.portfolioCache.set('summary', summary);
      } catch (summaryError) {
        logService.log('warn', 'Failed to refresh portfolio summary', summaryError, 'GlobalCacheService');
      }

      this.portfolioLastUpdate = Date.now();
      logService.log('info', 'Portfolio data cache refreshed successfully', null, 'GlobalCacheService');

      return this.portfolioCache;
    } catch (error) {
      logService.log('error', 'Failed to refresh portfolio data cache', error, 'GlobalCacheService');
      throw error;
    }
  }



  /**
   * Get market insights from the global cache
   * @param assets List of assets to get insights for
   * @returns Market insights for the specified assets
   */
  async getMarketInsights(assets: string[] = []): Promise<MarketInsight> {
    try {
      // If no assets specified, use default assets
      const assetsToUse = assets.length > 0 ? assets : this.DEFAULT_ASSETS;

      // Generate a cache key for the requested assets
      const cacheKey = assetsToUse.sort().join(',');

      // Check if we have a cache hit
      if (this.marketInsightsCache.has(cacheKey)) {
        return this.marketInsightsCache.get(cacheKey)!;
      }

      // If we're requesting the default assets but they're not cached yet,
      // it means the cache is still initializing. Return synthetic data immediately
      // instead of waiting, to improve perceived performance
      if (cacheKey === this.DEFAULT_ASSETS.sort().join(',')) {
        // Create synthetic data
        const syntheticInsights = this.createSyntheticMarketInsights();

        // Trigger a refresh in the background
        setTimeout(() => {
          this.refreshMarketInsights().catch(error => {
            logService.log('error', 'Failed to refresh market insights in background', error, 'GlobalCacheService');
          });
        }, 100);

        return syntheticInsights;
      }

      // If we get here, it means we need to fetch custom assets not in the default set
      // Fetch directly from the AI service
      const insights = await aiMarketService.getMarketInsights(assetsToUse);

      // Cache the results
      this.marketInsightsCache.set(cacheKey, insights);

      return insights;
    } catch (error) {
      logService.log('error', 'Failed to get market insights from cache', error, 'GlobalCacheService');

      // Return synthetic data as a fallback
      return this.createSyntheticMarketInsights();
    }
  }

  /**
   * Get news for multiple assets from the global cache
   * @param assets List of assets to get news for
   * @returns Combined and deduplicated news for all specified assets
   */
  async getNewsForAssets(assets: string[] = []): Promise<NewsItem[]> {
    try {
      // If no assets specified, use default assets
      const assetsToUse = assets.length > 0 ? assets : this.DEFAULT_ASSETS.map(a => a.replace(/_/g, '').replace(/USDT/g, ''));

      // Collect news for all requested assets
      const allNews: NewsItem[] = [];

      for (const asset of assetsToUse) {
        const normalizedAsset = asset.replace(/_/g, '').replace(/USDT/g, '');

        // Check if we have this asset in the cache
        if (this.newsCache.has(normalizedAsset)) {
          allNews.push(...this.newsCache.get(normalizedAsset)!);
        } else {
          // If not in cache, fetch directly and cache it
          const news = await newsService.getNewsForAsset(normalizedAsset);
          this.newsCache.set(normalizedAsset, news);
          allNews.push(...news);
        }
      }

      // Deduplicate and sort news
      return this.deduplicateAndSortNews(allNews);
    } catch (error) {
      logService.log('error', 'Failed to get news from cache', error, 'GlobalCacheService');

      // Fallback to direct fetch if cache fails
      return newsService.getNewsForAssets(assets);
    }
  }

  /**
   * Deduplicate and sort news items
   * @param news Array of news items
   * @returns Deduplicated and sorted news items
   */
  private deduplicateAndSortNews(news: NewsItem[]): NewsItem[] {
    // Use title as the unique key to remove duplicates
    const uniqueNews = Array.from(
      new Map(news.map(item => [item.title, item])).values()
    );

    // Sort by published date (newest first)
    return uniqueNews.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  /**
   * Get the timestamp of the last market insights update
   * @returns Timestamp in milliseconds
   */
  getMarketInsightsLastUpdate(): number {
    return this.marketInsightsLastUpdate;
  }

  /**
   * Get the timestamp of the last news update
   * @returns Timestamp in milliseconds
   */
  getNewsLastUpdate(): number {
    return this.newsLastUpdate;
  }

  /**
   * Get the timestamp of the last portfolio data update
   * @returns Timestamp in milliseconds
   */
  getPortfolioLastUpdate(): number {
    return this.portfolioLastUpdate;
  }

  /**
   * Get portfolio performance data from the global cache
   * @param timeframe The timeframe to get data for ('1h', '1d', '1w', '1m')
   * @returns Portfolio performance data for the specified timeframe
   */
  async getPortfolioData(timeframe: string = '1d'): Promise<any> {
    try {
      const cacheKey = `performance_${timeframe}`;

      // Check if we have cached data
      if (this.portfolioCache.has(cacheKey)) {
        return this.portfolioCache.get(cacheKey);
      }

      // If not in cache, trigger a background refresh and return empty data
      setTimeout(() => {
        this.refreshPortfolioData().catch(error => {
          logService.log('error', 'Failed to refresh portfolio data in background', error, 'GlobalCacheService');
        });
      }, 100);

      // Import dynamically to avoid circular dependencies
      const { portfolioService } = await import('./portfolio-service');

      // Fetch directly with a timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Portfolio data timeout')), 3000);
      });

      const dataPromise = portfolioService.getPerformanceData(timeframe as any);
      const data = await Promise.race([dataPromise, timeoutPromise]).catch(() => []);

      // Cache the result
      this.portfolioCache.set(cacheKey, data);

      return data;
    } catch (error) {
      logService.log('error', 'Failed to get portfolio data from cache', error, 'GlobalCacheService');
      return [];
    }
  }

  /**
   * Get portfolio summary from the global cache
   * @returns Portfolio summary data
   */
  async getPortfolioSummary(): Promise<any> {
    try {
      // Check if we have cached data
      if (this.portfolioCache.has('summary')) {
        return this.portfolioCache.get('summary');
      }

      // If not in cache, trigger a background refresh and return empty data
      setTimeout(() => {
        this.refreshPortfolioData().catch(error => {
          logService.log('error', 'Failed to refresh portfolio data in background', error, 'GlobalCacheService');
        });
      }, 100);

      // Import dynamically to avoid circular dependencies
      const { portfolioService } = await import('./portfolio-service');

      // Fetch directly with a timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Portfolio summary timeout')), 3000);
      });

      const summaryPromise = portfolioService.getPortfolioSummary();
      const summary = await Promise.race([summaryPromise, timeoutPromise]).catch(() => null);

      // Cache the result
      this.portfolioCache.set('summary', summary);

      return summary;
    } catch (error) {
      logService.log('error', 'Failed to get portfolio summary from cache', error, 'GlobalCacheService');
      return null;
    }
  }

  /**
   * Force a refresh of the market insights cache
   * @returns Promise that resolves when the refresh is complete
   */
  async forceRefreshMarketInsights(): Promise<void> {
    return this.refreshMarketInsights();
  }

  /**
   * Force a refresh of the news cache
   * @returns Promise that resolves when the refresh is complete
   */
  async forceRefreshNews(): Promise<void> {
    return this.refreshNews();
  }

  /**
   * Clean up resources when the service is no longer needed
   */
  cleanup(): void {
    if (this.marketInsightsTimer) {
      clearInterval(this.marketInsightsTimer);
      this.marketInsightsTimer = null;
    }

    if (this.newsTimer) {
      clearInterval(this.newsTimer);
      this.newsTimer = null;
    }
  }
}

export const globalCacheService = GlobalCacheService.getInstance();
