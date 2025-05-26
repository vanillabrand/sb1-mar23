import { rustApiIntegration } from '../lib/rust-api-integration';

/**
 * Comprehensive test suite for Rust API integration
 * Tests all endpoints and functionality
 */

describe('Rust API Integration Tests', () => {
  let testStrategyId: string;
  let testTradeId: string;

  beforeAll(async () => {
    // Wait for API to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      const health = await rustApiIntegration.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.service).toBe('trading-api');
    });
  });

  describe('Market Data', () => {
    test('should get market data for BTC-USDT', async () => {
      const marketData = await rustApiIntegration.getMarketData('BTC-USDT');
      expect(marketData).toBeDefined();
      expect(marketData.symbol).toBe('BTC-USDT');
    });

    test('should get all tickers', async () => {
      const tickers = await rustApiIntegration.getTickers();
      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBeGreaterThan(0);
    });

    test('should get candles for BTC-USDT', async () => {
      const candles = await rustApiIntegration.getCandles('BTC-USDT', '1h', 100);
      expect(Array.isArray(candles)).toBe(true);
    });

    test('should get order book for BTC-USDT', async () => {
      const orderBook = await rustApiIntegration.getOrderBook('BTC-USDT', 100);
      expect(orderBook).toBeDefined();
      expect(orderBook.bids).toBeDefined();
      expect(orderBook.asks).toBeDefined();
    });
  });

  describe('Strategy Management', () => {
    test('should get all strategies', async () => {
      const strategies = await rustApiIntegration.getStrategies();
      expect(Array.isArray(strategies)).toBe(true);
    });

    test('should create a new strategy', async () => {
      const newStrategy = {
        name: 'Test Strategy',
        description: 'A test strategy for integration testing',
        symbols: ['BTC-USDT'],
        market_type: 'Spot',
        risk_level: 'Medium',
        parameters: {
          leverage: 1,
          position_size: 100,
          confidence_threshold: 0.7,
          timeframe: '1h'
        },
        risk_management: {
          stop_loss: 0.05,
          take_profit: 0.1,
          trailing_stop: false
        }
      };

      const createdStrategy = await rustApiIntegration.createStrategy(newStrategy);
      expect(createdStrategy).toBeDefined();
      expect(createdStrategy.name).toBe(newStrategy.name);
      testStrategyId = createdStrategy.id;
    });

    test('should get strategy by ID', async () => {
      if (!testStrategyId) {
        throw new Error('Test strategy ID not available');
      }

      const strategy = await rustApiIntegration.getStrategy(testStrategyId);
      expect(strategy).toBeDefined();
      expect(strategy.id).toBe(testStrategyId);
    });

    test('should update strategy', async () => {
      if (!testStrategyId) {
        throw new Error('Test strategy ID not available');
      }

      const updatedStrategy = {
        name: 'Updated Test Strategy',
        description: 'An updated test strategy',
        symbols: ['BTC-USDT', 'ETH-USDT'],
        market_type: 'Spot',
        risk_level: 'High',
        parameters: {
          leverage: 2,
          position_size: 200,
          confidence_threshold: 0.8,
          timeframe: '4h'
        }
      };

      const result = await rustApiIntegration.updateStrategy(testStrategyId, updatedStrategy);
      expect(result).toBeDefined();
      expect(result.name).toBe(updatedStrategy.name);
    });

    test('should get strategy budget', async () => {
      if (!testStrategyId) {
        throw new Error('Test strategy ID not available');
      }

      const budget = await rustApiIntegration.getStrategyBudget(testStrategyId);
      expect(budget).toBeDefined();
      expect(typeof budget.allocated_amount).toBe('number');
    });

    test('should update strategy budget', async () => {
      if (!testStrategyId) {
        throw new Error('Test strategy ID not available');
      }

      const newBudget = {
        allocated_amount: 1000,
        available_amount: 1000,
        used_amount: 0
      };

      const result = await rustApiIntegration.updateStrategyBudget(testStrategyId, newBudget);
      expect(result).toBeDefined();
      expect(result.allocated_amount).toBe(newBudget.allocated_amount);
    });

    test('should activate strategy', async () => {
      if (!testStrategyId) {
        throw new Error('Test strategy ID not available');
      }

      const result = await rustApiIntegration.activateStrategy(testStrategyId);
      expect(result).toBeDefined();
      expect(result.status).toBe('Active');
    });

    test('should deactivate strategy', async () => {
      if (!testStrategyId) {
        throw new Error('Test strategy ID not available');
      }

      const result = await rustApiIntegration.deactivateStrategy(testStrategyId);
      expect(result).toBeDefined();
      expect(result.status).toBe('Inactive');
    });
  });

  describe('Trade Management', () => {
    test('should get all trades', async () => {
      const trades = await rustApiIntegration.getTrades();
      expect(Array.isArray(trades)).toBe(true);
    });

    test('should create a new trade', async () => {
      if (!testStrategyId) {
        throw new Error('Test strategy ID not available');
      }

      const newTrade = {
        strategy_id: testStrategyId,
        symbol: 'BTC-USDT',
        side: 'Buy',
        trade_type: 'Market',
        amount: 0.001,
        price: null,
        status: 'Pending'
      };

      const createdTrade = await rustApiIntegration.createTrade(newTrade);
      expect(createdTrade).toBeDefined();
      expect(createdTrade.symbol).toBe(newTrade.symbol);
      testTradeId = createdTrade.id;
    });

    test('should get trade by ID', async () => {
      if (!testTradeId) {
        throw new Error('Test trade ID not available');
      }

      const trade = await rustApiIntegration.getTrade(testTradeId);
      expect(trade).toBeDefined();
      expect(trade.id).toBe(testTradeId);
    });

    test('should get trades by strategy', async () => {
      if (!testStrategyId) {
        throw new Error('Test strategy ID not available');
      }

      const trades = await rustApiIntegration.getTradesByStrategy(testStrategyId);
      expect(Array.isArray(trades)).toBe(true);
    });

    test('should generate trades for strategy', async () => {
      if (!testStrategyId) {
        throw new Error('Test strategy ID not available');
      }

      const marketData = {
        symbol: 'BTC-USDT',
        price: 50000,
        volume: 1000000,
        trend: 'bullish'
      };

      const result = await rustApiIntegration.generateTrades(testStrategyId, marketData);
      expect(result).toBeDefined();
    });
  });

  describe('Monitoring', () => {
    test('should get system status', async () => {
      const status = await rustApiIntegration.getSystemStatus();
      expect(status).toBeDefined();
    });

    test('should get performance metrics', async () => {
      const metrics = await rustApiIntegration.getPerformanceMetrics();
      expect(metrics).toBeDefined();
    });

    test('should get all monitoring statuses', async () => {
      const statuses = await rustApiIntegration.getAllMonitoringStatuses();
      expect(Array.isArray(statuses)).toBe(true);
    });

    test('should get alerts', async () => {
      const alerts = await rustApiIntegration.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('Exchange Integration', () => {
    test('should get account balance', async () => {
      const balance = await rustApiIntegration.getBalance();
      expect(balance).toBeDefined();
    });

    test('should get open orders', async () => {
      const orders = await rustApiIntegration.getOpenOrders();
      expect(Array.isArray(orders)).toBe(true);
    });

    test('should get trade history', async () => {
      const history = await rustApiIntegration.getTradeHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  // Cleanup
  afterAll(async () => {
    // Clean up test data
    if (testTradeId) {
      try {
        await rustApiIntegration.deleteTrade(testTradeId);
      } catch (error) {
        console.warn('Failed to delete test trade:', error);
      }
    }

    if (testStrategyId) {
      try {
        await rustApiIntegration.deleteStrategy(testStrategyId);
      } catch (error) {
        console.warn('Failed to delete test strategy:', error);
      }
    }
  });
});
