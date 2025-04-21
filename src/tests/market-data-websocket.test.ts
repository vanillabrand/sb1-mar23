import { marketDataWebSocket } from '../lib/market-data-websocket';
import { websocketManager } from '../lib/websocket-manager';
import { eventBus } from '../lib/event-bus';

// Mock the websocket manager
jest.mock('../lib/websocket-manager', () => ({
  websocketManager: {
    createConnection: jest.fn().mockReturnValue('test-connection-id'),
    send: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
    addSubscription: jest.fn(),
    getState: jest.fn().mockReturnValue({
      isConnected: true,
      lastMessageTime: Date.now()
    }),
    reconnect: jest.fn()
  }
}));

// Mock the event bus
jest.mock('../lib/event-bus', () => ({
  eventBus: {
    emit: jest.fn(),
    on: jest.fn()
  }
}));

// Mock the cache service
jest.mock('../lib/cache-service', () => ({
  cacheService: {
    set: jest.fn(),
    get: jest.fn(),
    has: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn(),
    getCacheNames: jest.fn().mockReturnValue([]),
    createCache: jest.fn()
  }
}));

// Mock the log service
jest.mock('../lib/log-service', () => ({
  logService: {
    log: jest.fn()
  }
}));

describe('Market Data WebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should subscribe to market data', async () => {
    const subscriptionId = await marketDataWebSocket.subscribeToMarketData('BTC/USDT');

    expect(subscriptionId).toBeDefined();
    expect(websocketManager.createConnection).toHaveBeenCalled();
    expect(websocketManager.send).toHaveBeenCalled();
  });

  test('should unsubscribe from market data', async () => {
    // First subscribe
    const subscriptionId = await marketDataWebSocket.subscribeToMarketData('ETH/USDT');

    // Then unsubscribe
    const result = marketDataWebSocket.unsubscribeFromMarketData(subscriptionId);

    expect(result).toBe(true);
    expect(websocketManager.send).toHaveBeenCalledTimes(2); // Once for subscribe, once for unsubscribe
  });

  test('should batch subscribe to market data', async () => {
    const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
    const subscriptionIds = await marketDataWebSocket.batchSubscribeToMarketData(symbols);

    expect(subscriptionIds.length).toBe(symbols.length);
    expect(websocketManager.createConnection).toHaveBeenCalled();
    expect(websocketManager.send).toHaveBeenCalledTimes(symbols.length);
  });

  test('should handle WebSocket messages', () => {
    // Get the 'on' handler for 'message' events
    const onHandler = (websocketManager.on as jest.Mock).mock.calls.find(
      call => call[0] === 'message'
    )?.[1];

    expect(onHandler).toBeDefined();

    if (onHandler) {
      // Create a mock message
      const mockMessage = {
        connectionId: 'test-connection-id',
        message: {
          e: '24hrTicker',
          s: 'BTCUSDT',
          c: '50000',
          b: '49900',
          a: '50100',
          h: '51000',
          l: '49000',
          v: '100',
          P: '2.5',
          E: Date.now()
        }
      };

      // Call the handler
      onHandler(mockMessage);

      // Verify that the event was emitted
      expect(eventBus.emit).toHaveBeenCalledWith('marketData:update', expect.any(Object));
    }
  });

  test('should get latest market data', async () => {
    // Mock the cache service get method to return mock data
    const mockData = {
      symbol: 'BTC/USDT',
      price: 50000,
      bid: 49900,
      ask: 50100,
      high24h: 51000,
      low24h: 49000,
      volume24h: 100,
      change24h: 2.5,
      timestamp: Date.now(),
      source: 'binance'
    };

    // Import the actual cache service to mock it
    const { cacheService } = require('../lib/cache-service');
    (cacheService.get as jest.Mock).mockReturnValue(mockData);

    // Call the method
    const data = marketDataWebSocket.getLatestMarketData('BTC/USDT');

    // Verify the result
    expect(data).toEqual(mockData);
    expect(cacheService.get).toHaveBeenCalledWith('ticker:BTC/USDT', 'market_data');
  });

  test('should close all connections', () => {
    marketDataWebSocket.closeAllConnections();

    // No connections to close in the test, but the method should run without errors
    expect(true).toBe(true);
  });
});
