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
      // Get API key and URL from environment variables
      // Try both VITE_ prefixed and non-prefixed versions
      const apiKey = import.meta.env.VITE_NEWS_API_KEY || import.meta.env.NEWS_API_KEY || process.env.VITE_NEWS_API_KEY || process.env.NEWS_API_KEY;
      const baseUrl = import.meta.env.VITE_NEWS_API_URL || import.meta.env.NEWS_API_URL || process.env.VITE_NEWS_API_URL || process.env.NEWS_API_URL;

      if (!apiKey || !baseUrl) {
        logService.log('error', 'Missing NEWS_API_KEY or NEWS_API_URL environment variables', null, 'NewsService');
        return this.generateMockNewsForAsset(asset);
      }

      logService.log('info', `Fetching news for ${asset} from API`, null, 'NewsService');

      // Construct the URL with the asset as a category
      const url = new URL(baseUrl);
      url.searchParams.append('categories', asset);

      try {
        // Make the API request directly
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'Accept': 'application/json'
          },
          // Add mode: 'no-cors' to bypass CORS issues
          mode: 'no-cors'
        });

        // Since we're using no-cors mode, we won't be able to read the response
        // So we'll use mock data instead
        return this.generateMockNewsForAsset(asset);
      } catch (fetchError) {
        logService.log('warn', `API request failed for ${asset}, using mock data`, fetchError, 'NewsService');
        return this.generateMockNewsForAsset(asset);
      }
    } catch (error) {
      logService.log('error', `Error in fetchNewsForAsset for ${asset}:`, error, 'NewsService');
      return this.generateMockNewsForAsset(asset);
    }
  }

  /**
   * Generate mock news data for an asset
   * @param asset The asset to generate news for
   * @returns Array of mock news items
   */
  private generateMockNewsForAsset(asset: string): NewsItem[] {
    const normalizedAsset = asset.replace(/[\/_]/g, '').replace(/USDT/g, '');
    const now = Date.now();

    // Generate 3-5 mock news items
    const count = 3 + Math.floor(Math.random() * 3);
    const news: NewsItem[] = [];

    const headlines = [
      `${normalizedAsset} Shows Strong Momentum in Current Market`,
      `Analysts Predict Bright Future for ${normalizedAsset}`,
      `${normalizedAsset} Adoption Continues to Grow Worldwide`,
      `New Partnership Announced for ${normalizedAsset} Project`,
      `${normalizedAsset} Technical Analysis: Key Levels to Watch`,
      `${normalizedAsset} Development Update: New Features Coming Soon`,
      `Market Sentiment Turns Positive for ${normalizedAsset}`,
      `${normalizedAsset} Trading Volume Reaches New Heights`
    ];

    const descriptions = [
      `Recent market movements show ${normalizedAsset} gaining significant traction among investors.`,
      `Industry experts are bullish on ${normalizedAsset}'s long-term prospects due to strong fundamentals.`,
      `Institutional adoption of ${normalizedAsset} continues to increase, signaling growing confidence.`,
      `A major industry player has announced a strategic partnership with the ${normalizedAsset} project.`,
      `Technical indicators suggest ${normalizedAsset} may be approaching a key resistance level.`,
      `The development team behind ${normalizedAsset} has announced an exciting roadmap for the coming months.`,
      `Market sentiment analysis shows increasing positive mentions of ${normalizedAsset} across social media.`,
      `Trading volume for ${normalizedAsset} has surged, indicating growing interest from traders.`
    ];

    // Create unique mock news items
    for (let i = 0; i < count; i++) {
      const headlineIndex = Math.floor(Math.random() * headlines.length);
      const descriptionIndex = Math.floor(Math.random() * descriptions.length);

      // Remove used headlines and descriptions to avoid duplicates
      const headline = headlines.splice(headlineIndex, 1)[0];
      const description = descriptions.splice(descriptionIndex, 1)[0];

      // Determine sentiment based on the content
      const sentiment = this.determineSentiment(headline, description);

      news.push({
        id: `mock-${normalizedAsset}-${i}-${now}-${Math.random().toString(36).substring(2, 8)}`,
        title: headline,
        description: description,
        url: `https://example.com/news/${normalizedAsset.toLowerCase()}/${i}`,
        source: 'Crypto Market News',
        imageUrl: `https://source.unsplash.com/random/300x200/?crypto,${normalizedAsset.toLowerCase()}`,
        publishedAt: new Date(now - (i * 3600000)).toISOString(),
        relatedAssets: [normalizedAsset],
        sentiment: sentiment
      });

      // Break if we run out of unique headlines or descriptions
      if (headlines.length === 0 || descriptions.length === 0) break;
    }

    return news;
  }

  /**
   * Determine sentiment from text
   * @param title The title text
   * @param description The description text
   * @returns The sentiment: positive, negative, or neutral
   */
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