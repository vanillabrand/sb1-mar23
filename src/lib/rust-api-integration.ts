import { apiClient } from './api-client';
import { config } from './config';

/**
 * Comprehensive Rust API Integration Service
 * Handles all interactions between the frontend and the Rust API
 */
export class RustApiIntegration {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.rustApiUrl;
  }

  // ===== HEALTH CHECK =====

  /**
   * Check if the Rust API is healthy
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return await response.json();
    } catch (error) {
      console.error('Rust API health check failed:', error);
      throw error;
    }
  }

  // ===== STRATEGY MANAGEMENT =====

  /**
   * Get all strategies for the current user
   */
  async getStrategies() {
    return apiClient.get('/api/strategies');
  }

  /**
   * Get a specific strategy by ID
   */
  async getStrategy(id: string) {
    return apiClient.get(`/api/strategies/${id}`);
  }

  /**
   * Create a new strategy
   */
  async createStrategy(strategy: any) {
    return apiClient.post('/api/strategies', strategy);
  }

  /**
   * Update an existing strategy
   */
  async updateStrategy(id: string, strategy: any) {
    return apiClient.put(`/api/strategies/${id}`, strategy);
  }

  /**
   * Delete a strategy
   */
  async deleteStrategy(id: string) {
    return apiClient.delete(`/api/strategies/${id}`);
  }

  /**
   * Activate a strategy
   */
  async activateStrategy(id: string) {
    return apiClient.post(`/api/strategies/${id}/activate`);
  }

  /**
   * Deactivate a strategy
   */
  async deactivateStrategy(id: string) {
    return apiClient.post(`/api/strategies/${id}/deactivate`);
  }

  /**
   * Adapt a strategy using AI
   */
  async adaptStrategy(id: string, marketData: any) {
    return apiClient.post(`/api/strategies/${id}/adapt`, marketData);
  }

  /**
   * Get strategy budget
   */
  async getStrategyBudget(id: string) {
    return apiClient.get(`/api/strategies/${id}/budget`);
  }

  /**
   * Update strategy budget
   */
  async updateStrategyBudget(id: string, budget: any) {
    return apiClient.put(`/api/strategies/${id}/budget`, budget);
  }

  // ===== TRADE MANAGEMENT =====

  /**
   * Get all trades for the current user
   */
  async getTrades() {
    return apiClient.get('/api/trades');
  }

  /**
   * Get a specific trade by ID
   */
  async getTrade(id: string) {
    return apiClient.get(`/api/trades/${id}`);
  }

  /**
   * Create a new trade
   */
  async createTrade(trade: any) {
    return apiClient.post('/api/trades', trade);
  }

  /**
   * Update an existing trade
   */
  async updateTrade(id: string, trade: any) {
    return apiClient.put(`/api/trades/${id}`, trade);
  }

  /**
   * Delete a trade
   */
  async deleteTrade(id: string) {
    return apiClient.delete(`/api/trades/${id}`);
  }

  /**
   * Execute a trade
   */
  async executeTrade(id: string) {
    return apiClient.post(`/api/trades/${id}/execute`);
  }

  /**
   * Close a trade
   */
  async closeTrade(id: string) {
    return apiClient.post(`/api/trades/${id}/close`);
  }

  /**
   * Get trades for a specific strategy
   */
  async getTradesByStrategy(strategyId: string) {
    return apiClient.get(`/api/trades/strategy/${strategyId}`);
  }

  /**
   * Generate trades for a strategy using AI
   */
  async generateTrades(strategyId: string, marketData: any) {
    return apiClient.post(`/api/trades/strategy/${strategyId}/generate`, marketData);
  }

  // ===== MARKET DATA =====

  /**
   * Get market data for a symbol
   */
  async getMarketData(symbol: string) {
    return apiClient.getMarketData(symbol);
  }

  /**
   * Get candles for a symbol
   */
  async getCandles(symbol: string, timeframe: string, limit: number) {
    return apiClient.getCandles(symbol, timeframe, limit);
  }

  /**
   * Get order book for a symbol
   */
  async getOrderBook(symbol: string, limit: number) {
    return apiClient.getOrderBook(symbol, limit);
  }

  /**
   * Get all market tickers
   */
  async getTickers() {
    return apiClient.getTickers();
  }

  // ===== EXCHANGE INTEGRATION =====

  /**
   * Get account balance
   */
  async getBalance() {
    return apiClient.get('/api/exchange/balance');
  }

  /**
   * Create an order
   */
  async createOrder(order: any) {
    return apiClient.post('/api/exchange/order', order);
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string) {
    return apiClient.delete(`/api/exchange/order/${orderId}`);
  }

  /**
   * Get open orders
   */
  async getOpenOrders() {
    return apiClient.get('/api/exchange/orders');
  }

  /**
   * Get trade history
   */
  async getTradeHistory() {
    return apiClient.get('/api/exchange/trades');
  }

  // ===== MONITORING =====

  /**
   * Get strategy monitoring status
   */
  async getStrategyMonitoringStatus(id: string) {
    return apiClient.getStrategyMonitoringStatus(id);
  }

  /**
   * Get all monitoring statuses
   */
  async getAllMonitoringStatuses() {
    return apiClient.getAllMonitoringStatuses();
  }

  /**
   * Get system status
   */
  async getSystemStatus() {
    return apiClient.getSystemStatus();
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    return apiClient.getPerformanceMetrics();
  }

  /**
   * Get system alerts
   */
  async getAlerts() {
    return apiClient.getAlerts();
  }
}

// Export a singleton instance
export const rustApiIntegration = new RustApiIntegration();
