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
    // Use the Rust API URL from config, defaulting to localhost:3000 if not set
    this.baseUrl = import.meta.env.VITE_RUST_API_URL || config.rustApiUrl || 'http://localhost:3000';

    logService.log('info', `API client initialized with Rust API base URL: ${this.baseUrl}`, null, 'ApiClient');
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
        this.isInitialized = false;
        logService.log('warn', 'API health check failed, falling back to direct Supabase access', health, 'ApiClient');
      }
    } catch (error) {
      this.isInitialized = false;
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

      // Add authorization header and user ID if session exists
      if (session?.access_token) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${session.access_token}`,
        };
      }

      // Add user ID header if session exists
      if (session?.user?.id) {
        options.headers = {
          ...options.headers,
          'X-User-ID': session.user.id,
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

  // ===== HEALTH CHECK ===== (Removed duplicate method)

  // ===== STRATEGY ENDPOINTS =====

  /**
   * Get strategies for the current user
   */
  public async getStrategies() {
    return this.get('/api/strategies');
  }

  /**
   * Get a specific strategy by ID
   */
  public async getStrategy(id: string) {
    return this.get(`/api/strategies/${id}`);
  }

  /**
   * Create a new strategy
   */
  public async createStrategy(strategy: any) {
    return this.post('/api/strategies', strategy);
  }

  /**
   * Update an existing strategy
   */
  public async updateStrategy(id: string, updates: any) {
    return this.put(`/api/strategies/${id}`, updates);
  }

  /**
   * Delete a strategy
   */
  public async deleteStrategy(id: string) {
    return this.delete(`/api/strategies/${id}`);
  }

  /**
   * Activate a strategy
   */
  public async activateStrategy(id: string) {
    return this.post(`/api/strategies/${id}/activate`);
  }

  /**
   * Deactivate a strategy
   */
  public async deactivateStrategy(id: string) {
    return this.post(`/api/strategies/${id}/deactivate`);
  }

  /**
   * Adapt a strategy based on market data
   */
  public async adaptStrategy(id: string, marketData: any) {
    return this.post(`/api/strategies/${id}/adapt`, marketData);
  }

  /**
   * Get strategy budget
   */
  public async getStrategyBudget(id: string) {
    return this.get(`/api/strategies/${id}/budget`);
  }

  /**
   * Update strategy budget
   */
  public async updateStrategyBudget(id: string, budget: any) {
    return this.put(`/api/strategies/${id}/budget`, budget);
  }

  // ===== TRADE ENDPOINTS =====

  /**
   * Get all trades
   */
  public async getTrades(params?: { status?: string; strategy_id?: string }) {
    return this.get('/api/trades', params);
  }

  /**
   * Get a specific trade by ID
   */
  public async getTrade(id: string) {
    return this.get(`/api/trades/${id}`);
  }

  /**
   * Create a new trade
   */
  public async createTrade(trade: any) {
    return this.post('/api/trades', trade);
  }

  /**
   * Update an existing trade
   */
  public async updateTrade(id: string, updates: any) {
    return this.put(`/api/trades/${id}`, updates);
  }

  /**
   * Delete a trade
   */
  public async deleteTrade(id: string) {
    return this.delete(`/api/trades/${id}`);
  }

  /**
   * Execute a trade
   */
  public async executeTrade(id: string) {
    return this.post(`/api/trades/${id}/execute`);
  }

  /**
   * Close a trade
   */
  public async closeTrade(id: string) {
    return this.post(`/api/trades/${id}/close`);
  }

  /**
   * Get trades for a specific strategy
   */
  public async getTradesByStrategy(strategyId: string) {
    return this.get(`/api/trades/strategy/${strategyId}`);
  }

  /**
   * Generate trades for a strategy
   */
  public async generateTrades(strategyId: string, marketData: any) {
    return this.post(`/api/trades/strategy/${strategyId}/generate`, marketData);
  }

  // ===== EXCHANGE ENDPOINTS =====

  /**
   * Get account balance
   */
  public async getBalance() {
    return this.get('/api/exchange/balance');
  }

  /**
   * Create an order
   */
  public async createOrder(order: any) {
    return this.post('/api/exchange/order', order);
  }

  /**
   * Cancel an order
   */
  public async cancelOrder(id: string) {
    return this.delete(`/api/exchange/order/${id}`);
  }

  /**
   * Get open orders
   */
  public async getOpenOrders(symbol?: string) {
    return this.get('/api/exchange/orders', symbol ? { symbol } : undefined);
  }

  /**
   * Get exchange trades
   */
  public async getExchangeTrades(symbol: string, limit?: number) {
    return this.get('/api/exchange/trades', { symbol, limit });
  }

  // ===== MARKET DATA ENDPOINTS =====

  /**
   * Get market data for a symbol
   */
  public async getMarketData(symbol: string) {
    return this.get(`/api/market/data/${symbol}`);
  }

  /**
   * Get candles for a symbol
   */
  public async getCandles(symbol: string, timeframe: string, limit: number) {
    return this.get(`/api/market/candles/${symbol}`, { timeframe, limit });
  }

  /**
   * Get order book for a symbol
   */
  public async getOrderBook(symbol: string, limit: number) {
    return this.get(`/api/market/orderbook/${symbol}`, { limit });
  }

  /**
   * Get all market tickers
   */
  public async getTickers() {
    return this.get('/api/market/tickers');
  }

  /**
   * Get ticker for a symbol
   */
  public async getTicker(symbol: string) {
    return this.get(`/api/market/ticker/${symbol}`);
  }

  /**
   * Get market state for a symbol
   */
  public async getMarketState(symbol: string) {
    return this.get(`/api/market/state/${symbol}`);
  }

  // ===== MONITORING ENDPOINTS =====

  /**
   * Get strategy monitoring status
   */
  public async getStrategyMonitoringStatus(id: string) {
    return this.get(`/api/monitoring/strategies/${id}`);
  }

  /**
   * Get all monitoring statuses
   */
  public async getAllMonitoringStatuses() {
    return this.get('/api/monitoring/strategies');
  }

  /**
   * Get system status
   */
  public async getSystemStatus() {
    return this.get('/api/monitoring/system');
  }

  /**
   * Get performance metrics
   */
  public async getPerformanceMetrics() {
    return this.get('/api/monitoring/metrics');
  }

  /**
   * Get system alerts
   */
  public async getAlerts() {
    return this.get('/api/monitoring/alerts');
  }

  // ===== NEWS ENDPOINTS =====

  /**
   * Get crypto news
   */
  public async getCryptoNews(limit: number) {
    return this.get('/api/news/crypto', { limit });
  }
}

// Export a singleton instance
export const apiClient = ApiClient.getInstance();
