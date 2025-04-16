import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { proxyService } from './proxy-service';
// Remove static import to avoid circular dependency
// import { strategyService } from './strategy-service';
import type { NewsItem, Strategy } from './types';

class NewsService extends EventEmitter {
  private static instance: NewsService;
  private newsCache: Map<string, NewsItem[]> = new Map();
  private lastFetchTime: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  private readonly DEFAULT_ASSETS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP','USDT', 'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP_USDT'];

  private constructor() {
    super();
  }

  static getInstance(): NewsService {
    if (!NewsService.instance) {
      NewsService.instance = new NewsService();
    }
    return NewsService.instance;
  }

  async getNewsForAsset(asset: string): Promise<NewsItem[]> {
    const normalizedAsset = asset.replace(/_/g, '').replace(/USDT/g, '');

    // Check cache first
    const cachedNews = this.newsCache.get(normalizedAsset);
    const lastFetch = this.lastFetchTime.get(normalizedAsset) || 0;

    if (cachedNews && Date.now() - lastFetch < this.CACHE_DURATION) {
      return cachedNews;
    }

    try {
      const news = await this.fetchNewsForAsset(normalizedAsset);
      this.newsCache.set(normalizedAsset, news);
      this.lastFetchTime.set(normalizedAsset, Date.now());
      return news;
    } catch (error) {
      logService.log('warn', `Error fetching news for ${asset}:`, error, 'NewsService');
      return cachedNews || [];
    }
  }

  async getNewsForAssets(assets: string[]): Promise<NewsItem[]> {
    if (!assets || assets.length === 0) {
      assets = this.DEFAULT_ASSETS;
    }

    const allNews: NewsItem[] = [];
    const fetchPromises: Promise<void>[] = [];

    for (const asset of assets) {
      fetchPromises.push(
        this.getNewsForAsset(asset)
          .then(news => {
            allNews.push(...news);
            return;
          })
          .catch(error => {
            logService.log('warn', `Error fetching news for ${asset}:`, error, 'NewsService');
            return;
          })
      );
    }

    // Wait for all fetches to complete
    await Promise.all(fetchPromises);

    // Remove duplicates and sort by published date (newest first)
    return this.deduplicateAndSortNews(allNews);
  }

  /**
   * Get news for all assets in user strategies
   * This is useful for showing relevant news based on user's portfolio
   */
  async getNewsForUserStrategies(): Promise<NewsItem[]> {
    try {
      // Dynamically import strategyService to avoid circular dependency
      const { strategyService } = await import('./strategy-service');

      // Get all user strategies
      const strategies = await strategyService.getAllStrategies();

      if (!strategies || strategies.length === 0) {
        return this.getNewsForAssets(this.DEFAULT_ASSETS);
      }

      // Extract unique asset symbols from all strategies
      const assetSet = new Set<string>();

      strategies.forEach(strategy => {
        // Extract trading pairs from various possible locations
        const pairs = this.extractAssetPairsFromStrategy(strategy);

        // Extract the first part of each pair (e.g., 'BTC' from 'BTC/USDT')
        pairs.forEach(pair => {
          // Handle different pair formats (BTC/USDT, BTC_USDT, etc.)
          const asset = pair.split(/[\/\_]/).shift();
          if (asset) assetSet.add(asset);
        });
      });

      // Convert Set to Array
      const assets = Array.from(assetSet);

      // If no assets found, use defaults
      if (assets.length === 0) {
        return this.getNewsForAssets(this.DEFAULT_ASSETS);
      }

      // Get news for all assets
      return this.getNewsForAssets(assets);
    } catch (error) {
      logService.log('error', 'Error getting news for user strategies:', error, 'NewsService');
      return this.getNewsForAssets(this.DEFAULT_ASSETS);
    }
  }

  /**
   * Extract asset pairs from a strategy
   */
  private extractAssetPairsFromStrategy(strategy: Strategy): string[] {
    // Extract trading pairs from various possible locations
    if (strategy.selected_pairs && strategy.selected_pairs.length > 0) {
      return strategy.selected_pairs;
    }

    if (strategy.strategy_config && strategy.strategy_config.assets) {
      return strategy.strategy_config.assets;
    }

    if (strategy.strategy_config && strategy.strategy_config.config && strategy.strategy_config.config.pairs) {
      return strategy.strategy_config.config.pairs;
    }

    // Default to BTC/USDT if no pairs are found
    return ['BTC/USDT'];
  }

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

  private async fetchNewsForAsset(asset: string): Promise<NewsItem[]> {
    try {
      // Use a default API key if none is provided in environment variables
      const apiKey = import.meta.env.VITE_NEWS_API_KEY || '9d37acb8-4e4b-4b7e-8c3a-40f3d8c8f6a9';

      logService.log('info', `Fetching news for ${asset} through proxy service`, null, 'NewsService');

      try {
        // Use the proxy service to fetch news
        const response = await proxyService.fetchNews(asset, apiKey);

        // Handle the response - check for articles array
        if (response && Array.isArray(response.articles)) {
          const newsItems = response.articles.map(item => ({
            id: item.id || `${item.title}-${Date.now()}`,
            title: item.title,
            description: item.description || item.content,
            url: item.url,
            source: item.source?.name || 'Coindesk',
            imageUrl: item.urlToImage || item.image,
            publishedAt: new Date(item.publishedAt || Date.now()).toISOString(),
            relatedAssets: [asset],
            sentiment: this.analyzeSentiment(item.title + ' ' + (item.description || item.content || ''))
          }));

          logService.log('info', `Successfully fetched ${newsItems.length} news items for ${asset}`, null, 'NewsService');
          return newsItems;
        }
        // Fallback to old response format if needed
        else if (response && response.data && Array.isArray(response.data.items)) {
          const newsItems = response.data.items.map(item => ({
            id: item.id || `${item.title}-${Date.now()}`,
            title: item.title,
            description: item.description || item.excerpt,
            url: item.url,
            source: 'Coindesk',
            imageUrl: item.thumbnail?.url || item.leadImage?.url,
            publishedAt: new Date(item.publishedAt).toISOString(),
            relatedAssets: [asset],
            sentiment: this.analyzeSentiment(item.title + ' ' + (item.description || item.excerpt))
          }));

          logService.log('info', `Successfully fetched ${newsItems.length} news items for ${asset}`, null, 'NewsService');
          return newsItems;
        } else {
          logService.log('warn', `Invalid response format for ${asset} news`, response, 'NewsService');
          return [];
        }
      } catch (fetchError) {
        logService.log('warn', `API request failed for ${asset}`, fetchError, 'NewsService');
        return [];
      }
    } catch (error) {
      logService.log('error', `Error in fetchNewsForAsset for ${asset}:`, error, 'NewsService');
      return [];
    }
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['surge', 'gain', 'bull', 'rise', 'up', 'high', 'growth', 'profit', 'success'];
    const negativeWords = ['crash', 'drop', 'bear', 'fall', 'down', 'low', 'loss', 'fail', 'risk'];

    text = text.toLowerCase();
    let score = 0;

    positiveWords.forEach(word => {
      if (text.includes(word)) score++;
    });

    negativeWords.forEach(word => {
      if (text.includes(word)) score--;
    });

    return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  }
}

export const newsService = NewsService.getInstance();
