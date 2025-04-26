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
    // Normalize the asset name by removing trading pair suffixes
    // Examples: BTC/USDT -> BTC, ETH_USDT -> ETH, SOL -> SOL
    const normalizedAsset = this.normalizeAssetName(asset);

    // Check cache first
    const cachedNews = this.newsCache.get(normalizedAsset);
    const lastFetch = this.lastFetchTime.get(normalizedAsset) || 0;

    // If we have cached news and it's not expired, return it
    if (cachedNews && Date.now() - lastFetch < this.CACHE_DURATION) {
      logService.log('info', `Using cached news for ${normalizedAsset} (${cachedNews.length} items)`, null, 'NewsService');
      return cachedNews;
    }

    try {
      logService.log('info', `Fetching fresh news for ${normalizedAsset}`, null, 'NewsService');
      const news = await this.fetchNewsForAsset(normalizedAsset);

      // Only cache if we got some news
      if (news && news.length > 0) {
        this.newsCache.set(normalizedAsset, news);
        this.lastFetchTime.set(normalizedAsset, Date.now());
        logService.log('info', `Cached ${news.length} news items for ${normalizedAsset}`, null, 'NewsService');
      } else {
        logService.log('warn', `No news found for ${normalizedAsset}`, null, 'NewsService');
      }

      return news;
    } catch (error) {
      logService.log('warn', `Error fetching news for ${asset}:`, error, 'NewsService');
      return cachedNews || [];
    }
  }

  /**
   * Normalize asset name for news search
   * @param asset Asset name or trading pair
   * @returns Normalized asset name
   */
  private normalizeAssetName(asset: string): string {
    // Remove trading pair suffixes like /USDT, _USDT, -USDT
    // Also handle other quote currencies like /USD, /EUR, etc.
    const normalizedAsset = asset
      .replace(/[\/|_|\-].+$/, '') // Remove everything after /, _, or -
      .toUpperCase();              // Convert to uppercase

    return normalizedAsset;
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

      // Get all user strategies (both active and inactive)
      const strategies = await strategyService.getAllStrategies();

      if (!strategies || strategies.length === 0) {
        logService.log('info', 'No user strategies found, using default assets for news', null, 'NewsService');
        return this.getNewsForAssets(this.DEFAULT_ASSETS);
      }

      logService.log('info', `Found ${strategies.length} user strategies for news`, null, 'NewsService');

      // Extract unique asset symbols from all strategies
      const assetSet = new Set<string>();

      strategies.forEach(strategy => {
        // Extract trading pairs from various possible locations
        const pairs = this.extractAssetPairsFromStrategy(strategy);

        // Process each trading pair
        pairs.forEach(pair => {
          // First, add the full pair (some news might be specific to trading pairs)
          assetSet.add(pair);

          // Then extract the base asset (e.g., 'BTC' from 'BTC/USDT')
          // Handle different pair formats (BTC/USDT, BTC_USDT, etc.)
          const baseAsset = this.normalizeAssetName(pair);
          if (baseAsset) assetSet.add(baseAsset);

          // Also extract the quote asset if it's not a stablecoin
          const parts = pair.split(/[\/\_\-]/);
          if (parts.length > 1) {
            const quoteAsset = parts[1].toUpperCase();
            // Only add quote assets that aren't stablecoins
            if (quoteAsset && !['USDT', 'USDC', 'BUSD', 'DAI', 'USD'].includes(quoteAsset)) {
              assetSet.add(quoteAsset);
            }
          }
        });
      });

      // Convert Set to Array
      const assets = Array.from(assetSet);

      // If no assets found, use defaults
      if (assets.length === 0) {
        logService.log('warn', 'No assets extracted from user strategies, using default assets for news', null, 'NewsService');
        return this.getNewsForAssets(this.DEFAULT_ASSETS);
      }

      logService.log('info', `Extracted ${assets.length} unique assets from user strategies for news: ${assets.join(', ')}`, null, 'NewsService');

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
      // Use the API key from environment variables
      // The key in the .env file is: 162901f50202da15ee2a054fde27015c1f5b1a113a424f0935a5161627a3cc9e
      const apiKey = import.meta.env.VITE_NEWS_API_KEY || '162901f50202da15ee2a054fde27015c1f5b1a113a424f0935a5161627a3cc9e';

      logService.log('info', `Fetching news for ${asset} through proxy service with API key: ${apiKey.substring(0, 10)}...`, null, 'NewsService');

      try {
        // Use the proxy service to fetch news
        const response = await proxyService.fetchNews(asset, apiKey);

        // Handle the CoinDesk API response format - try multiple formats
        // First, try the v2 format
        if (response && response.data && Array.isArray(response.data.results)) {
          // This is the expected format from the CoinDesk API v2 search endpoint
          const newsItems = response.data.results.map(item => ({
            id: item.id || `${item.title}-${Date.now()}`,
            title: item.title || item.headline || '',
            description: item.description || item.excerpt || item.summary || '',
            url: item.url || `https://www.coindesk.com/search?q=${encodeURIComponent(asset)}`,
            source: 'Coindesk',
            imageUrl: item.thumbnail?.url || item.leadImage?.url || item.image?.url || item.imageUrl,
            publishedAt: new Date(item.publishedAt || item.published_at || Date.now()).toISOString(),
            relatedAssets: [asset],
            sentiment: this.analyzeSentiment(item.title + ' ' + (item.description || item.excerpt || item.summary || ''))
          }));

          logService.log('info', `Successfully parsed ${newsItems.length} news items from CoinDesk API v2 response`, {
            asset,
            responseFormat: 'data.results array',
            itemCount: response.data.results.length
          }, 'NewsService');

          return newsItems;
        }
        // Try the v1 format
        else if (response && response.data && Array.isArray(response.data.items)) {
          // This is the format from the CoinDesk API v1 search endpoint
          const newsItems = response.data.items.map(item => ({
            id: item.id || `${item.title}-${Date.now()}`,
            title: item.title || item.headline || '',
            description: item.description || item.excerpt || item.summary || '',
            url: item.url || `https://www.coindesk.com/search?q=${encodeURIComponent(asset)}`,
            source: 'Coindesk',
            imageUrl: item.thumbnail?.url || item.leadImage?.url || item.image?.url,
            publishedAt: new Date(item.publishedAt || item.published_at || Date.now()).toISOString(),
            relatedAssets: [asset],
            sentiment: this.analyzeSentiment(item.title + ' ' + (item.description || item.excerpt || item.summary || ''))
          }));

          logService.log('info', `Successfully parsed ${newsItems.length} news items from CoinDesk API v1 response`, {
            asset,
            responseFormat: 'data.items array',
            itemCount: response.data.items.length
          }, 'NewsService');

          return newsItems;
        }
        // Handle the response - check for articles array (fallback format)
        else if (response && Array.isArray(response.articles)) {
          const newsItems = response.articles.map(item => ({
            id: item.id || `${item.title}-${Date.now()}`,
            title: item.title || '',
            description: item.description || item.content || '',
            url: item.url || `https://www.coindesk.com/search?q=${encodeURIComponent(asset)}`,
            source: item.source?.name || 'Coindesk',
            imageUrl: item.urlToImage || item.image,
            publishedAt: new Date(item.publishedAt || Date.now()).toISOString(),
            relatedAssets: [asset],
            sentiment: this.analyzeSentiment(item.title + ' ' + (item.description || item.content || ''))
          }));

          // Check if this is fallback data
          if (response.source === 'fallback') {
            logService.log('info', `Using fallback news data for ${asset}`, null, 'NewsService');
          } else {
            logService.log('info', `Successfully fetched ${newsItems.length} news items for ${asset} (articles format)`, null, 'NewsService');
          }

          return newsItems;
        }
        // Handle array response directly (some API versions return an array)
        else if (response && Array.isArray(response)) {
          const newsItems = response.map(item => ({
            id: item.id || `${item.title}-${Date.now()}`,
            title: item.title || '',
            description: item.description || item.content || item.excerpt || '',
            url: item.url || `https://www.coindesk.com/search?q=${encodeURIComponent(asset)}`,
            source: item.source?.name || 'Coindesk',
            imageUrl: item.urlToImage || item.image || item.thumbnail?.url || item.leadImage?.url,
            publishedAt: new Date(item.publishedAt || Date.now()).toISOString(),
            relatedAssets: [asset],
            sentiment: this.analyzeSentiment(item.title + ' ' + (item.description || item.content || item.excerpt || ''))
          }));

          logService.log('info', `Successfully fetched ${newsItems.length} news items for ${asset} (array format)`, null, 'NewsService');
          return newsItems;
        }
        // Handle the case where we get a response but it doesn't match any expected format
        else {
          logService.log('warn', `Invalid response format for ${asset} news`, response, 'NewsService');

          // Try to extract any useful data from the response
          if (response && typeof response === 'object') {
            // Log the keys to help debug
            const keys = Object.keys(response);
            logService.log('info', `Response keys: ${keys.join(', ')}`, null, 'NewsService');

            // Try to find any array that might contain news items
            for (const key of keys) {
              if (Array.isArray(response[key])) {
                const possibleItems = response[key];
                if (possibleItems.length > 0 && possibleItems[0].title) {
                  logService.log('info', `Found possible news items in response.${key}`, null, 'NewsService');

                  const newsItems = possibleItems.map(item => ({
                    id: item.id || `${item.title}-${Date.now()}`,
                    title: item.title || '',
                    description: item.description || item.content || item.excerpt || '',
                    url: item.url || `https://www.coindesk.com/search?q=${encodeURIComponent(asset)}`,
                    source: 'Coindesk',
                    imageUrl: item.urlToImage || item.image || item.thumbnail?.url || item.leadImage?.url,
                    publishedAt: new Date(item.publishedAt || Date.now()).toISOString(),
                    relatedAssets: [asset],
                    sentiment: this.analyzeSentiment(item.title + ' ' + (item.description || item.content || item.excerpt || ''))
                  }));

                  return newsItems;
                }
              }
            }
          }

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
