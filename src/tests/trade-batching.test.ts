import { tradeBatchingService } from '../lib/trade-batching-service';
import { exchangeService } from '../lib/exchange-service';

// Mock the exchange service
jest.mock('../lib/exchange-service', () => ({
  exchangeService: {
    createOrder: jest.fn().mockImplementation((options) => {
      return Promise.resolve({
        id: 'mock-order-' + Date.now(),
        symbol: options.symbol,
        side: options.side,
        type: options.type || 'market',
        amount: options.amount,
        price: options.entry_price || options.price || 100,
        filled: options.amount,
        remaining: 0,
        status: 'filled',
        timestamp: Date.now(),
        datetime: new Date().toISOString(),
        cost: (options.entry_price || options.price || 100) * options.amount,
        fee: {
          cost: (options.entry_price || options.price || 100) * options.amount * 0.001,
          currency: options.symbol.split('/')[1] || 'USDT'
        }
      });
    })
  }
}));

// Mock the event bus
jest.mock('../lib/event-bus', () => ({
  eventBus: {
    emit: jest.fn()
  }
}));

// Mock the log service
jest.mock('../lib/log-service', () => ({
  logService: {
    log: jest.fn()
  }
}));

describe('Trade Batching Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should add a trade to the batching queue', async () => {
    const tradeOptions = {
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.01,
      entry_price: 50000,
      strategy_id: 'test-strategy'
    };

    const tradeId = await tradeBatchingService.addTrade(tradeOptions);
    expect(tradeId).toBeDefined();
  });

  test('should process batched trades', async () => {
    // Add multiple similar trades
    const tradeOptions1 = {
      symbol: 'ETH/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.1,
      entry_price: 3000,
      strategy_id: 'test-strategy'
    };

    const tradeOptions2 = {
      symbol: 'ETH/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.2,
      entry_price: 3000,
      strategy_id: 'test-strategy'
    };

    const tradeId1 = await tradeBatchingService.addTrade(tradeOptions1);
    const tradeId2 = await tradeBatchingService.addTrade(tradeOptions2);

    // Wait for the batch processor to run (it runs every 1 second)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Force batch processing (in a real scenario this would happen automatically)
    // @ts-ignore - Access private method for testing
    await tradeBatchingService['processBatches']();

    // Wait for the batch to be processed
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if the exchange service was called with the combined amount
    expect(exchangeService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'ETH/USDT',
        side: 'buy',
        type: 'market',
        amount: 0.3 // Combined amount from both trades
      })
    );

    // Check if both trades have results
    const result1 = await tradeBatchingService.getTradeResult(tradeId1);
    const result2 = await tradeBatchingService.getTradeResult(tradeId2);

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();

    if (result1 && result2) {
      expect(result1.symbol).toBe('ETH/USDT');
      expect(result2.symbol).toBe('ETH/USDT');
      expect(result1.side).toBe('buy');
      expect(result2.side).toBe('buy');
      expect(result1.amount).toBe(0.1);
      expect(result2.amount).toBe(0.2);
    }
  });

  test('should handle different trade types separately', async () => {
    // Add trades with different symbols
    const tradeOptions1 = {
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.01,
      entry_price: 50000,
      strategy_id: 'test-strategy'
    };

    const tradeOptions2 = {
      symbol: 'ETH/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.1,
      entry_price: 3000,
      strategy_id: 'test-strategy'
    };

    const tradeId1 = await tradeBatchingService.addTrade(tradeOptions1);
    const tradeId2 = await tradeBatchingService.addTrade(tradeOptions2);

    // Wait for the batch processor to run
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Force batch processing
    // @ts-ignore - Access private method for testing
    await tradeBatchingService['processBatches']();

    // Wait for the batches to be processed
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if the exchange service was called twice with different symbols
    expect(exchangeService.createOrder).toHaveBeenCalledTimes(2);

    // Check if both trades have results
    const result1 = await tradeBatchingService.getTradeResult(tradeId1);
    const result2 = await tradeBatchingService.getTradeResult(tradeId2);

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();

    if (result1 && result2) {
      expect(result1.symbol).toBe('BTC/USDT');
      expect(result2.symbol).toBe('ETH/USDT');
    }
  });

  test('should wait for trade result', async () => {
    const tradeOptions = {
      symbol: 'BTC/USDT',
      side: 'sell',
      type: 'market',
      amount: 0.01,
      entry_price: 50000,
      strategy_id: 'test-strategy'
    };

    const tradeId = await tradeBatchingService.addTrade(tradeOptions);

    // Start waiting for the result
    const resultPromise = tradeBatchingService.waitForTradeResult(tradeId, 5000);

    // Force batch processing
    // @ts-ignore - Access private method for testing
    await tradeBatchingService['processBatches']();

    // Wait for the result
    const result = await resultPromise;

    expect(result).toBeDefined();
    expect(result.symbol).toBe('BTC/USDT');
    expect(result.side).toBe('sell');
    expect(result.amount).toBe(0.01);
  });

  test('should cancel a pending trade', async () => {
    const tradeOptions = {
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.01,
      entry_price: 50000,
      strategy_id: 'test-strategy'
    };

    const tradeId = await tradeBatchingService.addTrade(tradeOptions);

    // Cancel the trade
    const cancelled = tradeBatchingService.cancelTrade(tradeId);
    expect(cancelled).toBe(true);

    // Try to get the result (should be null)
    const result = await tradeBatchingService.getTradeResult(tradeId);
    expect(result).toBeNull();
  });
});
