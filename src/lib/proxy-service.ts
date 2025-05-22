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

      // Construct the proxy URL - ensure we have a base URL
      const baseUrl = this.proxyUrl || '/api'; // Default to '/api' if proxyUrl is empty
      const url = `${baseUrl}${formattedEndpoint}`;

      logService.log('info', `Fetching from proxy: ${url}`, null, 'ProxyService');

      // Make the request
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers, // Put custom headers after defaults so they can override
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
   * @deprecated Use fetchAllNews instead
   */
  async fetchNews(asset: string, apiKey: string): Promise<any> {
    try {
      // Make sure we're using the correct API key format
      const endpoint = `coindesk-news?asset=${encodeURIComponent(asset.toLowerCase())}&apiKey=${encodeURIComponent(apiKey)}`;

      logService.log('info', `Fetching news for ${asset} using endpoint: ${endpoint}`, null, 'ProxyService');

      // Add custom headers for the request
      const options: RequestInit = {
        headers: {
          'x-api-key': apiKey,
          'X-API-KEY': apiKey,
          'api-key': apiKey,
          'API-KEY': apiKey
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000) // 10 second timeout
      };

      const response = await this.fetchFromProxy(endpoint, options);

      // Log if we're getting fallback data
      if (response && response.source === 'fallback') {
        logService.log('info', `Received fallback news data for ${asset}`, null, 'ProxyService');
      }

      return response;
    } catch (error) {
      logService.log('error', `Failed to fetch news for ${asset} through proxy`, error, 'ProxyService');
      // Return empty array instead of throwing to prevent UI errors
      return { articles: [], source: 'error' };
    }
  }

  /**
   * Fetch all news data through the proxy using the new endpoint
   * @param apiKey The API key for the news service
   * @returns The news data
   */
  async fetchAllNews(apiKey: string): Promise<any> {
    try {
      // Use the new endpoint that fetches all news at once
      const endpoint = `coindesk-all-news?apiKey=${encodeURIComponent(apiKey)}`;

      logService.log('info', `Fetching all news using endpoint: ${endpoint}`, null, 'ProxyService');

      // Add custom headers for the request
      const options: RequestInit = {
        headers: {
          'x-api-key': apiKey,
          'X-API-KEY': apiKey,
          'api-key': apiKey,
          'API-KEY': apiKey
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(15000) // 15 second timeout for all news
      };

      const response = await this.fetchFromProxy(endpoint, options);

      // Log if we're getting fallback data
      if (response && response.source === 'fallback') {
        logService.log('info', `Received fallback news data for all news`, null, 'ProxyService');
      }

      return response;
    } catch (error) {
      logService.log('error', `Failed to fetch all news through proxy`, error, 'ProxyService');
      // Return empty array instead of throwing to prevent UI errors
      return { articles: [], source: 'error' };
    }
  }
}

export const proxyService = ProxyService.getInstance();
