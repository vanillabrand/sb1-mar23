import { logService } from './log-service';

class ProxyService {
  private static instance: ProxyService;
  private proxyUrl: string;

  private constructor() {
    // Use the environment variable or a relative URL to avoid hardcoding localhost
    // Never use localhost in the URL to avoid CORS issues
    this.proxyUrl = import.meta.env.VITE_PROXY_URL || '/api';

    // Ensure the proxy URL doesn't end with a slash
    if (this.proxyUrl.endsWith('/')) {
      this.proxyUrl = this.proxyUrl.slice(0, -1);
    }

    // Log the proxy URL for debugging
    logService.log('info', `Initialized ProxyService with URL: ${this.proxyUrl}`, null, 'ProxyService');
  }

  static getInstance(): ProxyService {
    if (!ProxyService.instance) {
      ProxyService.instance = new ProxyService();
    }
    return ProxyService.instance;
  }

  /**
   * Fetch data from an API through the proxy
   * @param endpoint The API endpoint to fetch from
   * @param options Fetch options
   * @returns The response data
   */
  async fetchFromProxy(endpoint: string, options: RequestInit = {}): Promise<any> {
    try {
      // Ensure endpoint starts with a slash
      const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

      // Construct the proxy URL
      const url = `${this.proxyUrl}${formattedEndpoint}`;

      logService.log('info', `Fetching from proxy: ${url}`, null, 'ProxyService');

      // Make the request
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logService.log('error', `Proxy request failed: ${response.status}`, { url, errorText }, 'ProxyService');
        throw new Error(`Proxy request failed: ${response.status} ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logService.log('error', 'Proxy request failed', error, 'ProxyService');
      throw error;
    }
  }

  /**
   * Fetch news data through the proxy
   * @param asset The asset to fetch news for
   * @param apiKey The API key for the news service
   * @returns The news data
   */
  async fetchNews(asset: string, apiKey: string): Promise<any> {
    try {
      const endpoint = `coindesk-news?asset=${encodeURIComponent(asset.toLowerCase())}&apiKey=${encodeURIComponent(apiKey)}`;

      logService.log('info', `Fetching news for ${asset} using endpoint: ${endpoint}`, null, 'ProxyService');
      return await this.fetchFromProxy(endpoint);
    } catch (error) {
      logService.log('error', `Failed to fetch news for ${asset} through proxy`, error, 'ProxyService');
      // Return empty array instead of throwing to prevent UI errors
      return { articles: [] };
    }
  }
}

export const proxyService = ProxyService.getInstance();
