import { EventEmitter } from './event-emitter';
import { logService } from './log-service';

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  imageUrl?: string;
  publishedAt: string;
  relatedAssets?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}

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
    // Generate synthetic news for faster loading
    const currentDate = new Date();
    const headlines = [
      `${asset} Shows Strong Momentum in Recent Trading`,
      `Technical Analysis: ${asset} Tests Key Resistance`,
      `Market Update: ${asset} Volume Surges`,
      `${asset} Development Update: New Features Coming`,
      `Institutional Interest in ${asset} Growing`
    ];
    
    return headlines.map((title, index) => ({
      id: `${asset}-${index}`,
      title,
      description: `Latest market analysis and updates for ${asset}...`,
      url: 'https://example.com/news',
      source: 'Crypto Daily',
      imageUrl: `https://source.unsplash.com/random/300x200/?crypto,${asset.toLowerCase()}`,
      publishedAt: new Date(currentDate.getTime() - index * 3600000).toISOString(),
      relatedAssets: [asset],
      sentiment: Math.random() > 0.6 ? 'positive' : Math.random() < 0.4 ? 'negative' : 'neutral'
    }));
  }
}

export const newsService = NewsService.getInstance();
export type { NewsItem };