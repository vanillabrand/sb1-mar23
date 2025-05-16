import { logService } from './log-service';
import { config } from './config';
import { supabase } from './supabase';

/**
 * API client for interacting with the Rust API server
 */
class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string;
  private isInitialized: boolean = false;

  private constructor() {
    // Use the API URL from config, defaulting to localhost:8080 if not set
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    
    logService.log('info', `API client initialized with base URL: ${this.baseUrl}`, null, 'ApiClient');
  }

  /**
   * Get the singleton instance of the API client
   */
  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * Initialize the API client
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if the API is available
      const health = await this.checkHealth();
      
      if (health.status === 'ok') {
        this.isInitialized = true;
        logService.log('info', 'API client connected successfully', health, 'ApiClient');
      } else {
        logService.log('warn', 'API health check failed, falling back to direct Supabase access', health, 'ApiClient');
      }
    } catch (error) {
      logService.log('warn', 'Failed to initialize API client, falling back to direct Supabase access', error, 'ApiClient');
    }
  }

  /**
   * Check the health of the API
   */
  public async checkHealth(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await this.get('/health');
      return response;
    } catch (error) {
      logService.log('error', 'API health check failed', error, 'ApiClient');
      return { status: 'error', timestamp: new Date().toISOString() };
    }
  }

  /**
   * Make a GET request to the API
   * @param endpoint API endpoint
   * @param params Query parameters
   */
  public async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>('GET', endpoint, params);
  }

  /**
   * Make a POST request to the API
   * @param endpoint API endpoint
   * @param data Request body
   */
  public async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('POST', endpoint, data);
  }

  /**
   * Make a PUT request to the API
   * @param endpoint API endpoint
   * @param data Request body
   */
  public async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('PUT', endpoint, data);
  }

  /**
   * Make a DELETE request to the API
   * @param endpoint API endpoint
   */
  public async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint);
  }

  /**
   * Make a request to the API
   * @param method HTTP method
   * @param endpoint API endpoint
   * @param data Request body or query parameters
   */
  private async request<T>(method: string, endpoint: string, data?: any): Promise<T> {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      // Prepare the URL
      let url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      
      // Add query parameters for GET requests
      if (method === 'GET' && data) {
        const queryParams = new URLSearchParams();
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        });
        
        const queryString = queryParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }
      
      // Prepare the request options
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };
      
      // Add authorization header if session exists
      if (session?.access_token) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${session.access_token}`,
        };
      }
      
      // Add request body for non-GET requests
      if (method !== 'GET' && data) {
        options.body = JSON.stringify(data);
      }
      
      // Make the request
      const response = await fetch(url, options);
      
      // Handle errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      // Parse the response
      const result = await response.json();
      return result as T;
    } catch (error) {
      logService.log('error', `API request failed: ${method} ${endpoint}`, error, 'ApiClient');
      throw error;
    }
  }

  /**
   * Get strategies for the current user
   */
  public async getStrategies() {
    return this.get('/api/strategies');
  }

  /**
   * Get a strategy by ID
   * @param id Strategy ID
   */
  public async getStrategy(id: string) {
    return this.get(`/api/strategies/${id}`);
  }

  /**
   * Create a new strategy
   * @param strategy Strategy data
   */
  public async createStrategy(strategy: any) {
    return this.post('/api/strategies', strategy);
  }

  /**
   * Update a strategy
   * @param id Strategy ID
   * @param strategy Strategy data
   */
  public async updateStrategy(id: string, strategy: any) {
    return this.put(`/api/strategies/${id}`, strategy);
  }

  /**
   * Delete a strategy
   * @param id Strategy ID
   */
  public async deleteStrategy(id: string) {
    return this.delete(`/api/strategies/${id}`);
  }

  /**
   * Activate a strategy
   * @param id Strategy ID
   */
  public async activateStrategy(id: string) {
    return this.post(`/api/strategies/${id}/activate`);
  }

  /**
   * Deactivate a strategy
   * @param id Strategy ID
   */
  public async deactivateStrategy(id: string) {
    return this.post(`/api/strategies/${id}/deactivate`);
  }

  /**
   * Adapt a strategy
   * @param id Strategy ID
   * @param marketData Market data
   */
  public async adaptStrategy(id: string, marketData: any) {
    return this.post(`/api/strategies/${id}/adapt`, marketData);
  }

  /**
   * Get trades for a strategy
   * @param strategyId Strategy ID
   * @param status Trade status filter
   */
  public async getTrades(strategyId?: string, status?: string) {
    const params: Record<string, any> = {};
    if (strategyId) params.strategy_id = strategyId;
    if (status) params.status = status;
    return this.get('/api/trades', params);
  }

  /**
   * Get a trade by ID
   * @param id Trade ID
   */
  public async getTrade(id: string) {
    return this.get(`/api/trades/${id}`);
  }

  /**
   * Create a new trade
   * @param trade Trade data
   */
  public async createTrade(trade: any) {
    return this.post('/api/trades', trade);
  }

  /**
   * Update a trade
   * @param id Trade ID
   * @param trade Trade data
   */
  public async updateTrade(id: string, trade: any) {
    return this.put(`/api/trades/${id}`, trade);
  }

  /**
   * Delete a trade
   * @param id Trade ID
   */
  public async deleteTrade(id: string) {
    return this.delete(`/api/trades/${id}`);
  }

  /**
   * Execute a trade
   * @param id Trade ID
   */
  public async executeTrade(id: string) {
    return this.post(`/api/trades/${id}/execute`);
  }

  /**
   * Close a trade
   * @param id Trade ID
   */
  public async closeTrade(id: string) {
    return this.post(`/api/trades/${id}/close`);
  }

  /**
   * Generate trades for a strategy
   * @param strategyId Strategy ID
   * @param marketData Market data
   */
  public async generateTrades(strategyId: string, marketData: any) {
    return this.post(`/api/trades/strategy/${strategyId}/generate`, marketData);
  }

  /**
   * Get market data for a symbol
   * @param symbol Trading pair symbol
   */
  public async getMarketData(symbol: string) {
    return this.get(`/api/market/data/${symbol}`);
  }

  /**
   * Get candles for a symbol
   * @param symbol Trading pair symbol
   * @param timeframe Timeframe
   * @param limit Number of candles
   */
  public async getCandles(symbol: string, timeframe: string, limit: number) {
    return this.get(`/api/market/candles/${symbol}`, { timeframe, limit });
  }

  /**
   * Get order book for a symbol
   * @param symbol Trading pair symbol
   * @param limit Order book depth
   */
  public async getOrderBook(symbol: string, limit: number) {
    return this.get(`/api/market/orderbook/${symbol}`, { limit });
  }

  /**
   * Get ticker for a symbol
   * @param symbol Trading pair symbol
   */
  public async getTicker(symbol: string) {
    return this.get(`/api/market/ticker/${symbol}`);
  }

  /**
   * Get market state for a symbol
   * @param symbol Trading pair symbol
   */
  public async getMarketState(symbol: string) {
    return this.get(`/api/market/state/${symbol}`);
  }

  /**
   * Get account balance
   */
  public async getBalance() {
    return this.get('/api/exchange/balance');
  }

  /**
   * Create an order
   * @param order Order data
   */
  public async createOrder(order: any) {
    return this.post('/api/exchange/order', order);
  }

  /**
   * Cancel an order
   * @param id Order ID
   */
  public async cancelOrder(id: string) {
    return this.delete(`/api/exchange/order/${id}`);
  }

  /**
   * Get open orders
   * @param symbol Trading pair symbol
   */
  public async getOpenOrders(symbol?: string) {
    return this.get('/api/exchange/orders', symbol ? { symbol } : undefined);
  }

  /**
   * Get trades from the exchange
   * @param symbol Trading pair symbol
   * @param limit Number of trades
   */
  public async getExchangeTrades(symbol: string, limit: number) {
    return this.get('/api/exchange/trades', { symbol, limit });
  }

  /**
   * Get crypto news
   * @param limit Number of news items
   */
  public async getCryptoNews(limit: number) {
    return this.get('/api/news/crypto', { limit });
  }
}

// Export a singleton instance
export const apiClient = ApiClient.getInstance();
