import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { strategyService } from './strategy-service';
import type { NewsItem, Strategy } from './types';

class NewsService extends EventEmitter {
  private static instance: NewsService;
  private newsCache: Map<string, NewsItem[]> = new Map();
  private lastFetchTime: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  private readonly DEFAULT_ASSETS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];

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
          .then(news => allNews.push(...news))
          .catch(error => {
            logService.log('warn', `Error fetching news for ${asset}:`, error, 'NewsService');
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
      // Get API key and URL from environment variables
      const apiKey = import.meta.env.NEWS_API_KEY || process.env.NEWS_API_KEY;
      const baseUrl = import.meta.env.NEWS_API_URL || process.env.NEWS_API_URL;

      if (!apiKey || !baseUrl) {
        logService.log('error', 'Missing NEWS_API_KEY or NEWS_API_URL environment variables', null, 'NewsService');
        return [];
      }

      // Construct the URL with the asset as a category
      const url = new URL(baseUrl);
      url.searchParams.append('categories', asset);

      // Make the API request
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        logService.log('error', `Coindesk API error: ${response.status} ${errorText}`, null, 'NewsService');
        return [];
      }

      const data = await response.json();

      // Map the API response to our NewsItem format
      if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
        return data.data.map((article: any) => ({
          id: article.id || `${asset}-${Math.random().toString(36).substring(2, 9)}`,
          title: article.title || `${asset} News`,
          description: article.description || article.excerpt || '',
          url: article.url || '',
          source: article.source?.name || 'Coindesk',
          imageUrl: article.thumbnail?.url || `https://source.unsplash.com/random/300x200/?crypto,${asset.toLowerCase()}`,
          publishedAt: article.published_at || new Date().toISOString(),
          relatedAssets: [asset],
          sentiment: this.determineSentiment(article.title, article.description)
        }));
      }

      // If no data or empty array, return empty array
      logService.log('info', `No news articles found for ${asset}`, null, 'NewsService');
      return [];
    } catch (error) {
      logService.log('error', `Error fetching news from Coindesk API for ${asset}:`, error, 'NewsService');
      return [];
    }
  }

  private determineSentiment(title: string, description: string): 'positive' | 'negative' | 'neutral' {
    const text = `${title} ${description}`.toLowerCase();

    const positiveWords = ['bullish', 'surge', 'rally', 'gain', 'rise', 'soar', 'jump', 'positive', 'growth', 'up'];
    const negativeWords = ['bearish', 'crash', 'fall', 'drop', 'plunge', 'decline', 'negative', 'down', 'loss', 'risk'];

    let positiveScore = 0;
    let negativeScore = 0;

    positiveWords.forEach(word => {
      if (text.includes(word)) positiveScore++;
    });

    negativeWords.forEach(word => {
      if (text.includes(word)) negativeScore++;
    });

    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }


}

export const newsService = NewsService.getInstance();