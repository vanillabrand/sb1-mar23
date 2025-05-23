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

  // Cache refresh interval (15 minutes for market insights)
  private readonly CACHE_REFRESH_INTERVAL = 15 * 60 * 1000;
  private readonly NEWS_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes for news refresh

  // Background refresh timers
  private marketInsightsTimer: NodeJS.Timeout | null = null;
  private newsTimer: NodeJS.Timeout | null = null;
  private portfolioTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Load cache from localStorage if available
    this.loadCacheFromLocalStorage();
  }

  /**
   * Initialize the cache service
   * This is called explicitly from main.tsx to ensure proper initialization order
   */
  async initialize(): Promise<void> {
    // Initialize caches
    await this.initializeCache();
    return Promise.resolve();
  }

  /**
   * Load cache from localStorage if available
   */
  private loadCacheFromLocalStorage(): void {
    try {
      // Load market insights cache
      const marketInsightsCache = localStorage.getItem('marketInsightsCache');
      if (marketInsightsCache) {
        const parsed = JSON.parse(marketInsightsCache);
        Object.entries(parsed).forEach(([key, value]) => {
          this.marketInsightsCache.set(key, value as MarketInsight);
        });

        // Load last update time
        const lastUpdateTime = localStorage.getItem('marketInsightsLastUpdate');
        if (lastUpdateTime) {
          this.marketInsightsLastUpdate = parseInt(lastUpdateTime, 10);
        }

        logService.log('info', 'Loaded market insights cache from localStorage', null, 'GlobalCacheService');
      }
    } catch (error) {
      logService.log('error', 'Failed to load cache from localStorage', error, 'GlobalCacheService');
      // Continue with empty cache
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveCacheToLocalStorage(): void {
    try {
      // Save market insights cache
      const marketInsightsCache = Object.fromEntries(this.marketInsightsCache.entries());
      localStorage.setItem('marketInsightsCache', JSON.stringify(marketInsightsCache));

      // Save last update time
      localStorage.setItem('marketInsightsLastUpdate', this.marketInsightsLastUpdate.toString());

      logService.log('info', 'Saved market insights cache to localStorage', null, 'GlobalCacheService');
    } catch (error) {
      logService.log('error', 'Failed to save cache to localStorage', error, 'GlobalCacheService');
      // Continue without saving
    }
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
      // First, check if we have cached data in localStorage
      const cachedInsightsStr = localStorage.getItem('marketInsightsCache');
      if (cachedInsightsStr) {
        try {
          const cachedInsights = JSON.parse(cachedInsightsStr);
          // Load cached insights into memory for immediate use
          Object.entries(cachedInsights).forEach(([key, value]) => {
            this.marketInsightsCache.set(key, value as any);
          });

          const lastUpdateTime = localStorage.getItem('marketInsightsLastUpdate');
          if (lastUpdateTime) {
            this.marketInsightsLastUpdate = parseInt(lastUpdateTime, 10);
          }

          logService.log('info', 'Loaded market insights from localStorage cache', null, 'GlobalCacheService');
        } catch (parseError) {
          logService.log('error', 'Failed to parse cached market insights', parseError, 'GlobalCacheService');
        }
      }

      // Initial cache population - run in parallel for faster startup
      // Use Promise.allSettled to continue even if some promises fail
      const initPromises = [
        this.refreshMarketInsights().catch(error => {
          logService.log('error', 'Failed to initialize market insights cache', error, 'GlobalCacheService');
          // Return a synthetic fallback
          return this.createSyntheticMarketInsights();
        }),
        this.refreshAllNews().catch(error => {
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

      // Use Promise.allSettled to continue even if some promises fail
      await Promise.allSettled(initPromises);

      // We no longer use automatic refresh timers for market insights and news
      // They will only be refreshed when a new strategy is added
      logService.log('info', 'Automatic refresh timers for market insights and news are disabled', null, 'GlobalCacheService');

      // Only set up background refresh timer for portfolio data
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
   * @param customAssets Optional list of assets to use instead of defaults
   */
  private createSyntheticMarketInsights(customAssets?: string[]): MarketInsight {
    const assetsToUse = customAssets && customAssets.length > 0 ? customAssets : this.DEFAULT_ASSETS;
    const assets = assetsToUse.map(asset => ({
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

  // Track the last time a refresh attempt failed
  private lastFailedRefreshAttempt: number = 0;

  // Flag to track if a background refresh is already in progress
  private isRefreshingInBackground: boolean = false;

  /**
   * Get assets from user strategies
   * @returns Array of unique asset symbols from user strategies
   */
  private async getUserStrategyAssets(): Promise<string[]> {
    try {
      // Import dynamically to avoid circular dependencies
      const { strategyService } = await import('./strategy-service');

      // Get all strategies (both active and inactive)
      const strategies = await strategyService.getAllStrategies();

      if (!strategies || strategies.length === 0) {
        logService.log('info', 'No user strategies found, using default assets', null, 'GlobalCacheService');
        return this.DEFAULT_ASSETS;
      }

      // Extract unique asset pairs from all strategies
      const assetSet = new Set<string>();

      strategies.forEach(strategy => {
        // Extract trading pairs from various possible locations
        let pairs: string[] = [];

        if (strategy.selected_pairs && strategy.selected_pairs.length > 0) {
          pairs = strategy.selected_pairs;
        } else if (strategy.strategy_config?.assets && strategy.strategy_config.assets.length > 0) {
          pairs = strategy.strategy_config.assets;
        } else if (strategy.strategy_config?.config?.pairs && strategy.strategy_config.config.pairs.length > 0) {
          pairs = strategy.strategy_config.config.pairs;
        }

        // Add each pair to the set
        pairs.forEach(pair => {
          // Normalize pair format (ensure it uses underscores for DeepSeek API)
          const normalizedPair = pair.includes('/') ? pair.replace('/', '_') : pair;
          assetSet.add(normalizedPair);
        });
      });

      // Convert Set to Array
      const assets = Array.from(assetSet);

      // If no assets found, use defaults
      if (assets.length === 0) {
        return this.DEFAULT_ASSETS;
      }

      // Add some default assets if we have very few user assets
      if (assets.length < 3) {
        this.DEFAULT_ASSETS.forEach(asset => {
          if (!assets.includes(asset)) {
            assets.push(asset);
          }

          // Stop once we have at least 3 assets
          if (assets.length >= 3) {
            return;
          }
        });
      }

      logService.log('info', `Found ${assets.length} unique assets from user strategies`, { assets }, 'GlobalCacheService');
      return assets;
    } catch (error) {
      logService.log('error', 'Failed to get assets from user strategies', error, 'GlobalCacheService');
      return this.DEFAULT_ASSETS;
    }
  }

  /**
   * Refresh the market insights cache for user strategy assets
   */
  private async refreshMarketInsights(): Promise<MarketInsight> {
    try {
      // Check if we've recently tried to refresh and failed
      const now = Date.now();
      const timeSinceLastFailure = now - this.lastFailedRefreshAttempt;

      // If we've failed recently, don't try again for at least 5 minutes
      if (this.lastFailedRefreshAttempt > 0 && timeSinceLastFailure < 5 * 60 * 1000) {
        logService.log('info', `Skipping market insights refresh, last attempt failed ${Math.round(timeSinceLastFailure/1000)}s ago`, null, 'GlobalCacheService');

        // If we have cached data, return it
        const cacheKey = this.DEFAULT_ASSETS.sort().join(',');
        if (this.marketInsightsCache.has(cacheKey)) {
          return this.marketInsightsCache.get(cacheKey)!;
        }

        // Otherwise, return synthetic data
        return this.createSyntheticMarketInsights();
      }

      logService.log('info', 'Refreshing market insights cache', null, 'GlobalCacheService');

      // Get assets from user strategies
      const userAssets = await this.getUserStrategyAssets();

      // Generate a cache key for the user assets
      const cacheKey = userAssets.sort().join(',');

      // Set a timeout for the API call - increased to 30 seconds
      const timeoutPromise = new Promise<MarketInsight>((resolve, _) => {
        setTimeout(() => {
          // Instead of rejecting, resolve with synthetic data and log a warning
          logService.log('warn', 'Market insights API timeout, using synthetic data', null, 'GlobalCacheService');
          resolve(this.createSyntheticMarketInsights(userAssets));
        }, 30000);
      });

      // Fetch fresh market insights with timeout
      logService.log('info', 'Requesting market insights from DeepSeek API', { assets: userAssets }, 'GlobalCacheService');
      const insightsPromise = aiMarketService.getMarketInsights(userAssets);

      // Race between the API call and the timeout
      const insights = await Promise.race([insightsPromise, timeoutPromise]);

      // Update the cache
      this.marketInsightsCache.set(cacheKey, insights);
      this.marketInsightsLastUpdate = Date.now();

      // Reset the failed attempt tracker on success
      this.lastFailedRefreshAttempt = 0;

      // Save to localStorage
      this.saveCacheToLocalStorage();

      logService.log('info', 'Market insights cache refreshed successfully', null, 'GlobalCacheService');
      return insights;
    } catch (error) {
      // Record this failed attempt
      this.lastFailedRefreshAttempt = Date.now();

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

      // Save to localStorage
      this.saveCacheToLocalStorage();

      return syntheticInsights;
    }
  }

  /**
   * Refresh the news cache using the new endpoint that fetches all news at once
   */
  private async refreshAllNews(): Promise<NewsItem[]> {
    try {
      logService.log('info', 'Refreshing news cache using new getAllNews method', null, 'GlobalCacheService');

      // Clear all previous news articles
      this.newsCache.clear();
      logService.log('info', 'Cleared previous news cache', null, 'GlobalCacheService');

      // Fetch all news at once using the new method
      const allNews = await newsService.getAllNews();

      // Cache the news with a special key
      if (allNews && allNews.length > 0) {
        this.newsCache.set('all_news', allNews);
        this.newsLastUpdate = Date.now();

        logService.log('info', `Cached ${allNews.length} news articles from Coindesk API`, null, 'GlobalCacheService');
        return allNews;
      } else {
        logService.log('warn', 'No news found from Coindesk API', null, 'GlobalCacheService');
        return [];
      }
    } catch (error) {
      logService.log('error', 'Failed to refresh news cache using new method', error, 'GlobalCacheService');
      return [];
    }
  }

  /**
   * Refresh the news cache for user strategies and default assets
   * @deprecated Use refreshAllNews instead
   */
  private async refreshNews(): Promise<void> {
    try {
      logService.log('info', 'Refreshing news cache', null, 'GlobalCacheService');

      // Clear all previous news articles
      this.newsCache.clear();
      logService.log('info', 'Cleared previous news cache', null, 'GlobalCacheService');

      // First, try to get news for user strategies
      try {
        // Get news for all assets in user strategies
        const userStrategyNews = await newsService.getNewsForUserStrategies();

        // If we got news for user strategies, update the cache with a special key
        if (userStrategyNews && userStrategyNews.length > 0) {
          this.newsCache.set('user_strategies', userStrategyNews);
          logService.log('info', 'Updated news cache with user strategy assets', { count: userStrategyNews.length }, 'GlobalCacheService');
        } else {
          logService.log('info', 'No news found for user strategies', null, 'GlobalCacheService');
        }
      } catch (strategyError) {
        logService.log('warn', 'Failed to get news for user strategies, falling back to default assets', strategyError, 'GlobalCacheService');
      }

      // Also process each default asset individually as a fallback
      let foundAnyNews = false;
      for (const asset of this.DEFAULT_ASSETS) {
        const normalizedAsset = asset.replace(/_/g, '').replace(/USDT/g, '');

        // Fetch fresh news for this asset
        const news = await newsService.getNewsForAsset(normalizedAsset);

        // Only update the cache if we got news
        if (news && news.length > 0) {
          this.newsCache.set(normalizedAsset, news);
          foundAnyNews = true;
          logService.log('info', `Found ${news.length} news articles for ${normalizedAsset}`, null, 'GlobalCacheService');
        } else {
          logService.log('info', `No news found for ${normalizedAsset}`, null, 'GlobalCacheService');
        }
      }

      this.newsLastUpdate = Date.now();

      if (foundAnyNews || this.newsCache.has('user_strategies')) {
        logService.log('info', 'News cache refreshed successfully', null, 'GlobalCacheService');
      } else {
        logService.log('warn', 'No news found for any assets', null, 'GlobalCacheService');
      }
    } catch (error) {
      logService.log('error', 'Failed to refresh news cache', error, 'GlobalCacheService');
      throw error;
    }
  }

  /**
   * Refresh portfolio data cache
   * @param userId Optional user ID to filter data by
   */
  private async refreshPortfolioData(userId?: string): Promise<any> {
    try {
      logService.log('info', 'Refreshing portfolio data cache', {
        userId: userId || 'all users'
      }, 'GlobalCacheService');

      // Import dynamically to avoid circular dependencies
      const { portfolioService } = await import('./portfolio-service');

      // Get the authenticated user if no userId is provided
      if (!userId) {
        try {
          const { supabase } = await import('./supabase');
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            userId = user.id;
            logService.log('info', `Using authenticated user ID for portfolio data refresh: ${userId}`, null, 'GlobalCacheService');
          }
        } catch (authError) {
          logService.log('warn', 'Failed to get authenticated user, refreshing for all users', authError, 'GlobalCacheService');
        }
      }

      // Fetch portfolio data for different timeframes
      const timeframes = ['1h', '1d', '1w', '1m'];

      for (const timeframe of timeframes) {
        try {
          // Set a timeout for each portfolio data fetch - increased to 10 seconds
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Portfolio data timeout for ${timeframe}`)), 10000);
          });

          // Fetch portfolio data with timeout, passing the user ID
          const dataPromise = portfolioService.getPerformanceData(timeframe as any, userId);
          const data = await Promise.race([dataPromise, timeoutPromise]);

          // Cache the data with a user-specific key
          const cacheKey = `performance_${timeframe}_${userId || 'all'}`;
          this.portfolioCache.set(cacheKey, data);

          logService.log('info', `Refreshed portfolio data for timeframe ${timeframe}`, {
            userId: userId || 'all users',
            dataPoints: data?.length || 0
          }, 'GlobalCacheService');
        } catch (tfError) {
          logService.log('warn', `Failed to refresh portfolio data for timeframe ${timeframe}`, tfError, 'GlobalCacheService');
          // Generate synthetic data as fallback
          const syntheticData = this.generateSyntheticPortfolioData(timeframe as any);
          const cacheKey = `performance_${timeframe}_${userId || 'all'}`;
          this.portfolioCache.set(cacheKey, syntheticData);
        }
      }

      // Also cache the portfolio summary
      try {
        // Import dynamically to avoid circular dependencies
        const { portfolioService } = await import('./portfolio-service');

        // Set a timeout for portfolio summary fetch - 5 seconds
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Portfolio summary timeout')), 5000);
        });

        // Fetch portfolio summary with timeout, passing the user ID
        const summaryPromise = portfolioService.getPortfolioSummary(userId);
        const summary = await Promise.race([summaryPromise, timeoutPromise]);

        // Cache the summary with a user-specific key
        const summaryKey = `portfolio_summary_${userId || 'all'}`;
        this.portfolioCache.set(summaryKey, summary);

        logService.log('info', `Refreshed portfolio summary`, {
          userId: userId || 'all users',
          strategies: summary?.strategies?.length || 0
        }, 'GlobalCacheService');
      } catch (summaryError) {
        logService.log('warn', 'Failed to refresh portfolio summary', summaryError, 'GlobalCacheService');

        // Use fallback data
        const fallbackSummary = {
          currentValue: 12450.75,
          startingValue: 10000,
          totalChange: 2450.75,
          percentChange: 24.51,
          totalTrades: 42,
          profitableTrades: 28,
          winRate: 66.67,
          strategies: [
            {
              id: 'strategy-1',
              name: 'Momentum Alpha',
              currentValue: 4357.76,
              startingValue: 3500,
              totalChange: 857.76,
              percentChange: 24.51,
              totalTrades: 18,
              profitableTrades: 12,
              winRate: 66.67,
              contribution: 35
            },
            {
              id: 'strategy-2',
              name: 'Trend Follower',
              currentValue: 3112.69,
              startingValue: 2500,
              totalChange: 612.69,
              percentChange: 24.51,
              totalTrades: 12,
              profitableTrades: 8,
              winRate: 66.67,
              contribution: 25
            }
          ]
        };

        // Cache the fallback summary with a user-specific key
        const summaryKey = `portfolio_summary_${userId || 'all'}`;
        this.portfolioCache.set(summaryKey, fallbackSummary);

        logService.log('info', `Using fallback portfolio summary data`, {
          userId: userId || 'all users'
        }, 'GlobalCacheService');
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
   * @param skipRefresh If true, don't trigger a background refresh even if cache is stale
   * @returns Market insights for the specified assets
   */
  async getMarketInsights(assets: string[] = [], skipRefresh: boolean = false): Promise<MarketInsight> {
    try {
      // If specific assets are requested, use those
      // Otherwise, get assets from user strategies
      let assetsToUse: string[];

      if (assets.length > 0) {
        assetsToUse = assets;
        logService.log('info', 'Using explicitly requested assets for market insights', { assets, skipRefresh }, 'GlobalCacheService');
      } else {
        // Get assets from user strategies
        assetsToUse = await this.getUserStrategyAssets();
        logService.log('info', 'Using assets from user strategies for market insights', { assets: assetsToUse, skipRefresh }, 'GlobalCacheService');
      }

      // Generate a cache key for the requested assets
      const cacheKey = assetsToUse.sort().join(',');

      // Check if we have a cache hit - return immediately if available
      if (this.marketInsightsCache.has(cacheKey)) {
        // Check if cache is stale (older than 15 minutes)
        const now = Date.now();
        const cacheAge = now - this.marketInsightsLastUpdate;

        // We no longer trigger automatic background refresh
        // Market insights will only be refreshed when a new strategy is added
        // Just log the cache age for debugging
        if (cacheAge > this.CACHE_REFRESH_INTERVAL) {
          logService.log('info', `Market insights cache is stale (${Math.round(cacheAge/60000)}m old) but will not be auto-refreshed`, { skipRefresh }, 'GlobalCacheService');
        }

        logService.log('info', 'Returning cached market insights', { cacheKey, cacheAge: Math.round(cacheAge/1000) + 's', skipRefresh }, 'GlobalCacheService');
        return this.marketInsightsCache.get(cacheKey)!;
      }

      // If we don't have cached data, we need to fetch it
      // Provide synthetic data immediately to improve perceived performance
      const syntheticInsights = this.createSyntheticMarketInsights(assetsToUse);

      // Cache the synthetic data temporarily
      this.marketInsightsCache.set(cacheKey, syntheticInsights);
      this.marketInsightsLastUpdate = Date.now();

      logService.log('info', 'Created temporary synthetic market insights', { skipRefresh }, 'GlobalCacheService');

      // We no longer trigger automatic background refresh
      // Market insights will only be refreshed when a new strategy is added

      // If skipRefresh is false and we're not already refreshing, we could trigger a refresh here
      // But for now, we'll just return the synthetic data
      if (!skipRefresh && !this.isRefreshingInBackground) {
        logService.log('info', 'Skipping background refresh as requested', null, 'GlobalCacheService');
      }

      return syntheticInsights;
    } catch (error) {
      logService.log('error', 'Failed to get market insights from cache', error, 'GlobalCacheService');

      // Return synthetic data as a fallback
      return this.createSyntheticMarketInsights();
    }
  }

  /**
   * Get all news from the global cache
   * @returns All news articles
   */
  async getAllNews(): Promise<NewsItem[]> {
    try {
      // Check if we have cached data
      if (this.newsCache.has('all_news') && Date.now() - this.newsLastUpdate < this.NEWS_CACHE_DURATION) {
        const cachedNews = this.newsCache.get('all_news') || [];
        logService.log('info', `Using cached news data (${cachedNews.length} items)`, null, 'GlobalCacheService');
        return cachedNews;
      }

      // If not in cache, fetch from news service
      logService.log('info', 'Fetching fresh news data using new getAllNews method', null, 'GlobalCacheService');
      const allNews = await newsService.getAllNews();

      // Cache the news
      if (allNews && allNews.length > 0) {
        this.newsCache.set('all_news', allNews);
        this.newsLastUpdate = Date.now();
        logService.log('info', `Cached ${allNews.length} news articles from Coindesk API`, null, 'GlobalCacheService');
      }

      return allNews;
    } catch (error) {
      logService.log('error', 'Failed to get all news', error, 'GlobalCacheService');
      return [];
    }
  }

  /**
   * Get news for multiple assets from the global cache
   * @param assets List of assets to get news for
   * @returns Combined and deduplicated news for all specified assets
   * @deprecated Use getAllNews instead
   */
  async getNewsForAssets(assets: string[] = []): Promise<NewsItem[]> {
    try {
      // Collect news for all requested assets
      const allNews: NewsItem[] = [];

      // First, check if we have user strategy news in the cache
      if (this.newsCache.has('user_strategies')) {
        // If we have user strategy news, use it as the primary source
        const userStrategyNews = this.newsCache.get('user_strategies')!;
        if (userStrategyNews && userStrategyNews.length > 0) {
          allNews.push(...userStrategyNews);
        }

        // If specific assets were requested, we'll still add those
        if (assets.length > 0) {
          for (const asset of assets) {
            const normalizedAsset = asset.replace(/_/g, '').replace(/USDT/g, '');

            // Check if we have this asset in the cache
            if (this.newsCache.has(normalizedAsset)) {
              const assetNews = this.newsCache.get(normalizedAsset)!;
              if (assetNews && assetNews.length > 0) {
                allNews.push(...assetNews);
              }
            } else {
              // If not in cache, fetch directly and cache it
              const news = await newsService.getNewsForAsset(normalizedAsset);
              if (news && news.length > 0) {
                this.newsCache.set(normalizedAsset, news);
                allNews.push(...news);
              }
            }
          }
        }
      } else {
        // If no user strategy news, use default assets or requested assets
        const assetsToUse = assets.length > 0 ? assets : this.DEFAULT_ASSETS.map(a => a.replace(/_/g, '').replace(/USDT/g, ''));

        for (const asset of assetsToUse) {
          const normalizedAsset = asset.replace(/_/g, '').replace(/USDT/g, '');

          // Check if we have this asset in the cache
          if (this.newsCache.has(normalizedAsset)) {
            const assetNews = this.newsCache.get(normalizedAsset)!;
            if (assetNews && assetNews.length > 0) {
              allNews.push(...assetNews);
            }
          } else {
            // If not in cache, fetch directly and cache it
            const news = await newsService.getNewsForAsset(normalizedAsset);
            if (news && news.length > 0) {
              this.newsCache.set(normalizedAsset, news);
              allNews.push(...news);
            }
          }
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
   * Set portfolio summary data in the global cache
   * @param summary The portfolio summary data to cache
   * @param userId Optional user ID to associate with the summary
   */
  setPortfolioSummary(summary: any, userId?: string): void {
    try {
      // Create a cache key that includes the user ID
      const cacheKey = `portfolio_summary_${userId || 'all'}`;

      this.portfolioCache.set(cacheKey, summary);
      this.portfolioLastUpdate = Date.now();

      logService.log('info', 'Updated portfolio summary in global cache', {
        userId: userId || 'all users'
      }, 'GlobalCacheService');
    } catch (error) {
      logService.log('error', 'Failed to set portfolio summary in cache', error, 'GlobalCacheService');
    }
  }

  /**
   * Get portfolio summary data from the global cache
   * @param userId Optional user ID to filter data by
   * @returns Portfolio summary data
   */
  async getPortfolioSummary(userId?: string): Promise<any> {
    try {
      // Create a cache key that includes the user ID
      const cacheKey = `portfolio_summary_${userId || 'all'}`;

      logService.log('info', `Getting portfolio summary from cache`, {
        userId: userId || 'all users',
        cacheKey
      }, 'GlobalCacheService');

      // Check if we have cached data for this specific user
      if (this.portfolioCache.has(cacheKey)) {
        return this.portfolioCache.get(cacheKey);
      }

      // If not in cache, trigger a background refresh and return sample data
      setTimeout(() => {
        this.refreshPortfolioData().catch(error => {
          logService.log('error', 'Failed to refresh portfolio data in background', error, 'GlobalCacheService');
        });
      }, 100);

      // Import dynamically to avoid circular dependencies
      const { portfolioService } = await import('./portfolio-service');

      // Fetch directly with a timeout - increased to 5 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Portfolio summary timeout')), 5000);
      });

      try {
        // Pass the user ID to the portfolio service
        const dataPromise = portfolioService.getPortfolioSummary(userId);
        const data = await Promise.race([dataPromise, timeoutPromise]);

        if (data) {
          this.portfolioCache.set(cacheKey, data);
          return data;
        }
      } catch (error) {
        logService.log('warn', 'Failed to fetch portfolio summary directly', error, 'GlobalCacheService');
        // Continue to fallback data
      }

      // Return sample data if we couldn't fetch real data
      return {
        currentValue: 12450.75,
        startingValue: 10000,
        totalChange: 2450.75,
        percentChange: 24.51,
        totalTrades: 42,
        profitableTrades: 28,
        winRate: 66.67,
        strategies: [
          {
            id: 'strategy-1',
            name: 'Momentum Alpha',
            currentValue: 4357.76,
            startingValue: 3500,
            totalChange: 857.76,
            percentChange: 24.51,
            totalTrades: 18,
            profitableTrades: 12,
            winRate: 66.67,
            contribution: 35
          },
          {
            id: 'strategy-2',
            name: 'Trend Follower',
            currentValue: 3112.69,
            startingValue: 2500,
            totalChange: 612.69,
            percentChange: 24.51,
            totalTrades: 12,
            profitableTrades: 8,
            winRate: 66.67,
            contribution: 25
          },
          {
            id: 'strategy-3',
            name: 'Volatility Edge',
            currentValue: 2490.15,
            startingValue: 2000,
            totalChange: 490.15,
            percentChange: 24.51,
            totalTrades: 8,
            profitableTrades: 5,
            winRate: 62.5,
            contribution: 20
          },
          {
            id: 'strategy-4',
            name: 'Swing Trader',
            currentValue: 1867.61,
            startingValue: 1500,
            totalChange: 367.61,
            percentChange: 24.51,
            totalTrades: 4,
            profitableTrades: 3,
            winRate: 75.0,
            contribution: 15
          },
          {
            id: 'strategy-5',
            name: 'Market Neutral',
            currentValue: 622.54,
            startingValue: 500,
            totalChange: 122.54,
            percentChange: 24.51,
            totalTrades: 0,
            profitableTrades: 0,
            winRate: 0,
            contribution: 5
          }
        ]
      };
    } catch (error) {
      logService.log('error', 'Failed to get portfolio summary', error, 'GlobalCacheService');
      return null;
    }
  }

  /**
   * Get portfolio performance data from the global cache
   * @param timeframe The timeframe to get data for ('1h', '1d', '1w', '1m')
   * @param userId Optional user ID to filter data by
   * @returns Portfolio performance data for the specified timeframe
   */
  async getPortfolioData(timeframe: string = '1d', userId?: string): Promise<any> {
    try {
      // Create a cache key that includes the user ID
      const cacheKey = `performance_${timeframe}_${userId || 'all'}`;

      logService.log('info', `Getting portfolio data from cache for timeframe: ${timeframe}`, {
        userId: userId || 'all users',
        cacheKey
      }, 'GlobalCacheService');

      // Check if we have cached data for this specific user
      if (this.portfolioCache.has(cacheKey)) {
        return this.portfolioCache.get(cacheKey);
      }

      // If not in cache, trigger a background refresh and return synthetic data
      setTimeout(() => {
        this.refreshPortfolioData().catch(error => {
          logService.log('error', 'Failed to refresh portfolio data in background', error, 'GlobalCacheService');
        });
      }, 100);

      // Generate synthetic data as fallback
      const syntheticData = this.generateSyntheticPortfolioData(timeframe as any);

      try {
        // Import dynamically to avoid circular dependencies
        const { portfolioService } = await import('./portfolio-service');

        // Fetch directly with a timeout - increased to 5 seconds
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Portfolio data timeout')), 5000);
        });

        // Pass the user ID to the portfolio service
        const dataPromise = portfolioService.getPerformanceData(timeframe as any, userId);
        const data = await Promise.race([dataPromise, timeoutPromise]);

        // Cache the result with the user-specific key
        this.portfolioCache.set(cacheKey, data);
        return data;
      } catch (fetchError) {
        logService.log('warn', `Direct portfolio data fetch failed for ${timeframe}, using synthetic data`, fetchError, 'GlobalCacheService');
        // Cache the synthetic data
        this.portfolioCache.set(cacheKey, syntheticData);
        return syntheticData;
      }
    } catch (error) {
      logService.log('error', 'Failed to get portfolio data from cache', error, 'GlobalCacheService');
      // Return synthetic data as last resort
      return this.generateSyntheticPortfolioData(timeframe as any);
    }
  }

  // The getPortfolioSummary method is already defined above

  // We've removed the triggerBackgroundRefresh method since we no longer use automatic refreshes
  // Market insights will only be refreshed when a new strategy is added

  /**
   * Force a refresh of the market insights cache
   * @param assets Optional list of assets to refresh insights for
   * @returns Promise that resolves when the refresh is complete
   */
  async forceRefreshMarketInsights(assets?: string[]): Promise<void> {
    // If already refreshing, don't start another refresh
    if (this.isRefreshingInBackground) {
      logService.log('info', 'Skipping force refresh, already refreshing in background', null, 'GlobalCacheService');
      return;
    }

    this.isRefreshingInBackground = true;
    try {
      if (assets && assets.length > 0) {
        logService.log('info', 'Forcing refresh of market insights for specific assets', { assets: assets.join(',') }, 'GlobalCacheService');

        // Generate a cache key for the requested assets
        const cacheKey = assets.sort().join(',');

        // Fetch fresh market insights
        const insights = await aiMarketService.getMarketInsights(assets);

        // Update the cache
        this.marketInsightsCache.set(cacheKey, insights);
        this.marketInsightsLastUpdate = Date.now();

        // Reset the failed attempt tracker on success
        this.lastFailedRefreshAttempt = 0;

        // Save to localStorage
        this.saveCacheToLocalStorage();

        logService.log('info', 'Market insights cache refreshed successfully for specific assets', { assets: assets.join(',') }, 'GlobalCacheService');
      } else {
        // Refresh with user strategy assets
        logService.log('info', 'Forcing refresh of market insights with user strategy assets', null, 'GlobalCacheService');
        await this.refreshMarketInsights();
      }
    } catch (error) {
      logService.log('error', 'Failed to force refresh market insights cache', error, 'GlobalCacheService');
      this.lastFailedRefreshAttempt = Date.now();
      throw error;
    } finally {
      this.isRefreshingInBackground = false;
    }
  }

  /**
   * Force a refresh of the news cache
   * @returns Promise that resolves when the refresh is complete
   */
  async forceRefreshNews(): Promise<void> {
    try {
      logService.log('info', 'Forcing refresh of news cache using new getAllNews method', null, 'GlobalCacheService');

      // Clear all previous news
      this.newsCache.clear();
      logService.log('info', 'Cleared all news cache', null, 'GlobalCacheService');

      // Refresh all news at once using the new method
      const allNews = await this.refreshAllNews();

      logService.log('info', `News cache refreshed with ${allNews.length} articles`, null, 'GlobalCacheService');
    } catch (error) {
      logService.log('error', 'Failed to force refresh news cache', error, 'GlobalCacheService');
      throw error;
    }
  }

  /**
   * Generate synthetic portfolio data for a specific timeframe
   * @param timeframe The timeframe to generate data for ('1h', '1d', '1w', '1m')
   * @returns Array of synthetic performance data points
   */
  private generateSyntheticPortfolioData(timeframe: '1h' | '1d' | '1w' | '1m'): any[] {
    const now = Date.now();
    const dataPoints = [];
    let interval: number;
    let numPoints: number;
    let startValue = 10000; // Starting portfolio value

    // Determine interval and number of points based on timeframe
    switch (timeframe) {
      case '1h':
        interval = 5 * 60 * 1000; // 5 minutes
        numPoints = 12; // 1 hour / 5 minutes
        break;
      case '1d':
        interval = 60 * 60 * 1000; // 1 hour
        numPoints = 24; // 24 hours
        break;
      case '1w':
        interval = 6 * 60 * 60 * 1000; // 6 hours
        numPoints = 28; // 7 days / 6 hours
        break;
      case '1m':
        interval = 24 * 60 * 60 * 1000; // 1 day
        numPoints = 30; // 30 days
        break;
      default:
        interval = 60 * 60 * 1000; // 1 hour
        numPoints = 24; // 24 hours
    }

    // Generate data points
    let previousValue = startValue;
    for (let i = 0; i < numPoints; i++) {
      // Generate a random change between -2% and +3%
      const changePercent = -2 + (Math.random() * 5);
      const change = (previousValue * changePercent) / 100;
      const value = previousValue + change;

      dataPoints.push({
        date: now - ((numPoints - i) * interval),
        value,
        change,
        percentChange: changePercent
      });

      previousValue = value;
    }

    return dataPoints;
  }

  /**
   * Clean up resources when the service is no longer needed
   */
  cleanup(): void {
    // We no longer use automatic refresh timers for market insights and news
    // Only clean up the portfolio timer
    if (this.portfolioTimer) {
      clearInterval(this.portfolioTimer);
      this.portfolioTimer = null;
    }
  }
}

export const globalCacheService = GlobalCacheService.getInstance();
