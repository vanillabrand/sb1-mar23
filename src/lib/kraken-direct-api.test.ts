import { krakenDirectApi } from './kraken-direct-api';
import { logService } from './log-service';

// Mock the logService
jest.mock('./log-service', () => ({
  logService: {
    log: jest.fn()
  }
}));

// Mock fetch
global.fetch = jest.fn();

describe('KrakenDirectApi', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock successful fetch response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        error: [],
        result: { test: 'data' }
      })
    });
  });

  describe('publicRequest', () => {
    it('should make a public request to the Kraken API', async () => {
      // Call the method
      const result = await krakenDirectApi.publicRequest('Time');
      
      // Check that fetch was called with the correct URL
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.kraken.com/0/public/Time?',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'GiGAntic Trading Bot'
          })
        })
      );
      
      // Check that the result is correct
      expect(result).toEqual({ test: 'data' });
      
      // Check that the log was called
      expect(logService.log).toHaveBeenCalledWith(
        'info',
        'Making public request to Kraken API: Time',
        { params: {} },
        'KrakenDirectApi'
      );
    });
    
    it('should handle errors from the Kraken API', async () => {
      // Mock an error response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          error: ['API error'],
          result: {}
        })
      });
      
      // Call the method and expect it to throw
      await expect(krakenDirectApi.publicRequest('Time')).rejects.toThrow('Kraken API error: API error');
      
      // Check that the log was called
      expect(logService.log).toHaveBeenCalledWith(
        'error',
        'Failed to make public request to Kraken API: Time',
        expect.any(Error),
        'KrakenDirectApi'
      );
    });
    
    it('should handle network errors', async () => {
      // Mock a network error
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      // Call the method and expect it to throw
      await expect(krakenDirectApi.publicRequest('Time')).rejects.toThrow('Network error');
      
      // Check that the log was called
      expect(logService.log).toHaveBeenCalledWith(
        'error',
        'Failed to make public request to Kraken API: Time',
        expect.any(Error),
        'KrakenDirectApi'
      );
    });
  });
  
  describe('privateRequest', () => {
    it('should make a private request to the Kraken API', async () => {
      // Call the method
      const result = await krakenDirectApi.privateRequest(
        'Balance',
        {},
        'test-api-key',
        'test-api-secret'
      );
      
      // Check that fetch was called with the correct URL and headers
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.kraken.com/0/private/Balance',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            'API-Key': 'test-api-key',
            'API-Sign': expect.any(String),
            'User-Agent': 'GiGAntic Trading Bot'
          }),
          body: expect.stringContaining('nonce=')
        })
      );
      
      // Check that the result is correct
      expect(result).toEqual({ test: 'data' });
      
      // Check that the log was called
      expect(logService.log).toHaveBeenCalledWith(
        'info',
        'Making private request to Kraken API: Balance',
        expect.objectContaining({
          hasApiKey: true,
          hasApiSecret: true,
          params: expect.objectContaining({
            nonce: '[REDACTED]'
          })
        }),
        'KrakenDirectApi'
      );
    });
  });
  
  describe('convenience methods', () => {
    it('should call getServerTime', async () => {
      await krakenDirectApi.getServerTime();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.kraken.com/0/public/Time?',
        expect.any(Object)
      );
    });
    
    it('should call getAssetInfo', async () => {
      await krakenDirectApi.getAssetInfo('XBT,ETH');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.kraken.com/0/public/Assets?asset=XBT%2CETH',
        expect.any(Object)
      );
    });
    
    it('should call getAssetPairs', async () => {
      await krakenDirectApi.getAssetPairs('XBTUSDT');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.kraken.com/0/public/AssetPairs?pair=XBTUSDT',
        expect.any(Object)
      );
    });
    
    it('should call getTicker', async () => {
      await krakenDirectApi.getTicker('XBTUSDT');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.kraken.com/0/public/Ticker?pair=XBTUSDT',
        expect.any(Object)
      );
    });
    
    it('should call getOHLC', async () => {
      await krakenDirectApi.getOHLC('XBTUSDT', 5, 1234567890);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.kraken.com/0/public/OHLC?pair=XBTUSDT&interval=5&since=1234567890',
        expect.any(Object)
      );
    });
    
    it('should call getOrderBook', async () => {
      await krakenDirectApi.getOrderBook('XBTUSDT', 10);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.kraken.com/0/public/Depth?pair=XBTUSDT&count=10',
        expect.any(Object)
      );
    });
    
    it('should call getRecentTrades', async () => {
      await krakenDirectApi.getRecentTrades('XBTUSDT', 1234567890);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.kraken.com/0/public/Trades?pair=XBTUSDT&since=1234567890',
        expect.any(Object)
      );
    });
    
    it('should call getAccountBalance', async () => {
      await krakenDirectApi.getAccountBalance('test-api-key', 'test-api-secret');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.kraken.com/0/private/Balance',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'API-Key': 'test-api-key'
          })
        })
      );
    });
    
    it('should call addOrder', async () => {
      await krakenDirectApi.addOrder(
        'test-api-key',
        'test-api-secret',
        'XBTUSDT',
        'buy',
        'limit',
        '1.0',
        '50000'
      );
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.kraken.com/0/private/AddOrder',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'API-Key': 'test-api-key'
          }),
          body: expect.stringContaining('pair=XBTUSDT&type=buy&ordertype=limit&volume=1.0&price=50000')
        })
      );
    });
    
    it('should call cancelOrder', async () => {
      await krakenDirectApi.cancelOrder('test-api-key', 'test-api-secret', 'ABCDEF-12345-GHIJKL');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.kraken.com/0/private/CancelOrder',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'API-Key': 'test-api-key'
          }),
          body: expect.stringContaining('txid=ABCDEF-12345-GHIJKL')
        })
      );
    });
  });
});
