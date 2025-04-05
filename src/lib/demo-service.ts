import { ccxtService } from './ccxt-service';
import { logService } from './log-service';
import { v4 as uuidv4 } from 'uuid';

/**
 * DemoService provides mock data and functionality for demo mode
 * It initializes the ccxtService with mock data to prevent errors
 */
class DemoService {
  private static instance: DemoService;
  private _isDemoMode: boolean = false;
  private mockExchangeId: string = 'binance';

  private constructor() {
    // Set demo mode to true immediately to prevent initialization issues
    this._isDemoMode = true;

    // Initialize demo mode asynchronously
    setTimeout(() => {
      this.initializeDemoMode().catch(error => {
        logService.log('error', 'Failed to initialize demo mode', error, 'DemoService');
      });
    }, 0);
  }

  static getInstance(): DemoService {
    if (!DemoService.instance) {
      DemoService.instance = new DemoService();
    }
    return DemoService.instance;
  }

  /**
   * Initialize demo mode by setting up mock exchange
   */
  private async initializeDemoMode(): Promise<void> {
    try {
      // Override the executeWithRetry method to provide mock data first
      // This ensures we have mock data even if exchange initialization fails
      this.overrideCcxtMethods();

      try {
        // Try to create a mock exchange instance with Binance TestNet
        const apiKey = import.meta.env.VITE_DEMO_EXCHANGE_API_KEY || import.meta.env.VITE_BINANCE_TESTNET_API_KEY || 'demo-api-key';
        const secret = import.meta.env.VITE_DEMO_EXCHANGE_SECRET || import.meta.env.VITE_BINANCE_TESTNET_API_SECRET || 'demo-secret';

        logService.log('info', 'Initializing demo mode with TestNet credentials', {
          hasApiKey: !!apiKey,
          hasSecret: !!secret,
          apiKeyLength: apiKey ? apiKey.length : 0,
          secretLength: secret ? secret.length : 0
        }, 'DemoService');

        await ccxtService.createExchange(
          this.mockExchangeId as any,
          {
            apiKey,
            secret,
          },
          true // Use testnet/sandbox mode
        );

        logService.log('info', 'Demo mode initialized successfully with Binance TestNet', null, 'DemoService');
      } catch (exchangeError) {
        // If we can't initialize with Binance TestNet, just continue with mock data
        logService.log('warn', 'Failed to initialize exchange in demo mode, using mock data only', exchangeError, 'DemoService');
      }

      // Ensure demo mode is set to true
      this._isDemoMode = true;
    } catch (error) {
      // If anything fails, ensure demo mode is still set to true
      this._isDemoMode = true;
      logService.log('error', 'Error in demo mode initialization, but continuing with basic mock data', error, 'DemoService');
    }
  }

  /**
   * Override ccxt methods to provide mock data
   */
  private overrideCcxtMethods(): void {
    // Store the original method
    const originalExecuteWithRetry = ccxtService.executeWithRetry.bind(ccxtService);

    // Override the method
    (ccxtService as any).executeWithRetry = async <T>(
      operation: () => Promise<T>,
      operationName: string,
      maxRetries: number = 3
    ): Promise<T> => {
      try {
        // Try to execute the original operation
        return await originalExecuteWithRetry(operation, operationName, maxRetries);
      } catch (error) {
        // If it fails, return mock data based on the operation name
        logService.log('info', `Providing mock data for ${operationName}`, null, 'DemoService');

        if (operationName.includes('fetchMarketData')) {
          return this.getMockMarketData(operationName) as unknown as T;
        }

        // For other operations, return a basic mock object
        return {} as T;
      }
    };
  }

  /**
   * Generate mock market data
   */
  private getMockMarketData(operationName: string): any {
    const now = Date.now();
    const basePrice = 50000 + Math.random() * 1000;

    return {
      timestamp: now,
      symbol: 'BTC/USDT',
      price: basePrice,
      volume: 100 + Math.random() * 50,
      high24h: basePrice * 1.05,
      low24h: basePrice * 0.95,
      orderBook: {
        asks: Array.from({ length: 10 }, (_, i) => [basePrice + (i * 10), 1 - (i * 0.05)]),
        bids: Array.from({ length: 10 }, (_, i) => [basePrice - (i * 10), 1 - (i * 0.05)]),
      },
      recentTrades: Array.from({ length: 20 }, (_, i) => ({
        id: uuidv4(),
        timestamp: now - (i * 60000),
        price: basePrice + (Math.random() * 200 - 100),
        amount: Math.random() * 2,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
      })),
    };
  }

  /**
   * Check if demo mode is active
   */
  isInDemoMode(): boolean {
    return this._isDemoMode;
  }

  /**
   * Check if demo mode is enabled (alias for isInDemoMode for compatibility)
   */
  isDemoMode(): boolean {
    return this._isDemoMode;
  }

  /**
   * Get the TestNet exchange instance for demo mode
   */
  async getTestNetExchange(): Promise<any> {
    try {
      const apiKey = import.meta.env.VITE_DEMO_EXCHANGE_API_KEY || import.meta.env.VITE_BINANCE_TESTNET_API_KEY || 'demo-api-key';
      const secret = import.meta.env.VITE_DEMO_EXCHANGE_SECRET || import.meta.env.VITE_BINANCE_TESTNET_API_SECRET || 'demo-secret';

      logService.log('info', 'Getting TestNet exchange with credentials', {
        hasApiKey: !!apiKey,
        hasSecret: !!secret,
        apiKeyLength: apiKey ? apiKey.length : 0,
        secretLength: secret ? secret.length : 0
      }, 'DemoService');

      // Always use 'binance' for TestNet, not the mockExchangeId
      return await ccxtService.createExchange(
        'binance', // Use binance explicitly for TestNet
        {
          apiKey,
          secret,
        },
        true // Enable TestNet mode
      );
    } catch (error) {
      logService.log('error', 'Failed to get TestNet exchange instance', error, 'DemoService');
      throw error;
    }
  }

  /**
   * Generate synthetic trade data for demo mode
   */
  generateSyntheticTrade(strategyId: string, symbol: string = 'BTC/USDT'): any {
    const now = Date.now();
    const basePrice = 50000 + Math.random() * 1000;
    const isBuy = Math.random() > 0.5;

    return {
      id: uuidv4(),
      strategy_id: strategyId,
      symbol: symbol,
      side: isBuy ? 'buy' : 'sell',
      type: 'market',
      amount: Math.random() * 0.1,
      price: basePrice,
      cost: basePrice * (Math.random() * 0.1),
      fee: {
        cost: basePrice * 0.001,
        currency: 'USDT',
      },
      timestamp: now,
      datetime: new Date(now).toISOString(),
      status: 'closed',
    };
  }
}

export const demoService = DemoService.getInstance();
