import { EventEmitter } from './event-emitter';
import CryptoJS from 'crypto-js';
import { supabase } from './supabase';
import { logService } from './log-service';
import type { 
  Exchange, 
  ExchangeConfig, 
  ExchangeCredentials,
  WalletBalance,
  ExchangeId 
} from './types';
import { ccxtService } from './ccxt-service';

class ExchangeService extends EventEmitter {
  private static instance: ExchangeService;
  private activeExchange: Exchange | null = null;
  private readonly ENCRYPTION_KEY: string;
  private initialized = false;
  private ready = false;
  private initializationPromise: Promise<void> | null = null;
  private exchangeInstances: Map<string, any> = new Map();
  private demoMode = false;

  private constructor() {
    super();
    this.ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY;
    if (!this.ENCRYPTION_KEY) {
      throw new Error('Missing encryption key in environment variables');
    }
  }

  static getInstance(): ExchangeService {
    if (!ExchangeService.instance) {
      ExchangeService.instance = new ExchangeService();
    }
    return ExchangeService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load last active exchange from local storage
      const savedExchange = localStorage.getItem('activeExchange');
      if (savedExchange) {
        const exchange = JSON.parse(savedExchange);
        await this.connect(exchange);
      }

      this.initialized = true;
    } catch (error) {
      logService.log('error', 'Failed to initialize exchange service', error, 'ExchangeService');
      throw error;
    }
  }

  async getUserExchanges(): Promise<Exchange[]> {
    try {
      const { data: userExchanges, error } = await supabase
        .from('user_exchanges')
        .select('*');

      if (error) throw error;

      return userExchanges.map(exchange => ({
        ...exchange,
        credentials: this.decryptCredentials(exchange.encrypted_credentials)
      }));
    } catch (error) {
      logService.log('error', 'Failed to fetch user exchanges', error, 'ExchangeService');
      throw new Error('Failed to fetch exchanges');
    }
  }

  async getActiveExchange(): Promise<Exchange | null> {
    return this.activeExchange;
  }

  async connect(exchange: Exchange): Promise<void> {
    try {
      // Initialize CCXT exchange instance if not already created
      if (!this.exchangeInstances.has(exchange.id)) {
        const credentials = exchange.credentials;
        if (!credentials) {
          throw new Error('Exchange credentials not found');
        }

        const ccxtInstance = await ccxtService.createExchange(
          exchange.id as ExchangeId,
          credentials
        );
        this.exchangeInstances.set(exchange.id, ccxtInstance);
      }

      const ccxtInstance = this.exchangeInstances.get(exchange.id);
      await ccxtInstance.loadMarkets();

      this.activeExchange = exchange;
      localStorage.setItem('activeExchange', JSON.stringify(exchange));
      
      this.emit('exchange:connected', exchange);
      
    } catch (error) {
      logService.log('error', 'Failed to connect to exchange', error, 'ExchangeService');
      this.emit('exchange:error', error);
      throw new Error('Failed to connect to exchange');
    }
  }

  async disconnect(): Promise<void> {
    this.activeExchange = null;
    localStorage.removeItem('activeExchange');
    this.emit('exchange:disconnected');
  }

  async testConnection(config: ExchangeConfig): Promise<void> {
    try {
      const testInstance = await ccxtService.createExchange(
        config.name as ExchangeId,
        {
          apiKey: config.apiKey,
          secret: config.secret,
          memo: config.memo
        }
      );

      // Test basic API functionality
      await testInstance.loadMarkets();
      await testInstance.fetchBalance();

      // Additional checks based on exchange capabilities
      if (testInstance.has.fetchOHLCV) {
        await testInstance.fetchOHLCV(testInstance.symbols[0], '1m', undefined, 1);
      }

    } catch (error) {
      logService.log('error', 'Exchange connection test failed', error, 'ExchangeService');
      throw new Error(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async addExchange(config: ExchangeConfig): Promise<void> {
    try {
      const encryptedCredentials = this.encryptCredentials({
        apiKey: config.apiKey,
        secret: config.secret,
        memo: config.memo
      });

      const { error } = await supabase
        .from('user_exchanges')
        .insert({
          name: config.name,
          encrypted_credentials: encryptedCredentials,
          testnet: config.testnet,
          use_usdx: config.useUSDX
        });

      if (error) throw error;

      // Initialize exchange instance
      const ccxtInstance = await ccxtService.createExchange(
        config.name as ExchangeId,
        {
          apiKey: config.apiKey,
          secret: config.secret,
          memo: config.memo
        }
      );

      this.exchangeInstances.set(config.name, ccxtInstance);
      this.emit('exchange:added', config.name);

    } catch (error) {
      logService.log('error', 'Failed to add exchange', error, 'ExchangeService');
      throw new Error('Failed to add exchange');
    }
  }

  getExchangeInstance(exchangeId: string): ccxt.Exchange | undefined {
    return this.exchangeInstances.get(exchangeId);
  }

  async executeExchangeOperation<T>(
    exchangeId: string,
    operation: (exchange: ccxt.Exchange) => Promise<T>
  ): Promise<T> {
    const exchange = this.getExchangeInstance(exchangeId);
    if (!exchange) {
      throw new Error('Exchange not initialized');
    }

    try {
      return await operation(exchange);
    } catch (error) {
      logService.log('error', 'Exchange operation failed', error, 'ExchangeService');
      throw error;
    }
  }

  async removeExchange(exchangeId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_exchanges')
        .delete()
        .eq('id', exchangeId);

      if (error) throw error;

      if (this.activeExchange?.id === exchangeId) {
        await this.disconnect();
      }

      this.exchangeInstances.delete(exchangeId);
      this.emit('exchange:removed', exchangeId);
    } catch (error) {
      logService.log('error', 'Failed to remove exchange', error, 'ExchangeService');
      throw new Error('Failed to remove exchange');
    }
  }

  async fetchAllWalletBalances(): Promise<{
    spot?: WalletBalance;
    margin?: WalletBalance;
    futures?: WalletBalance;
  }> {
    if (!this.activeExchange) {
      throw new Error('No active exchange');
    }

    try {
      const ccxtInstance = this.exchangeInstances.get(this.activeExchange.id);
      const balances: {
        spot?: WalletBalance;
        margin?: WalletBalance;
        futures?: WalletBalance;
      } = {};

      // Fetch spot balances
      if (this.activeExchange.spotSupported) {
        const spotBalance = await ccxtInstance.fetchBalance({ type: 'spot' });
        balances.spot = this.normalizeBalance(spotBalance);
      }

      // Fetch margin balances
      if (this.activeExchange.marginSupported) {
        const marginBalance = await ccxtInstance.fetchBalance({ type: 'margin' });
        balances.margin = this.normalizeBalance(marginBalance);
      }

      // Fetch futures balances
      if (this.activeExchange.futuresSupported) {
        const futuresBalance = await ccxtInstance.fetchBalance({ type: 'future' });
        balances.futures = this.normalizeBalance(futuresBalance);
      }

      return balances;
    } catch (error) {
      logService.log('error', 'Failed to fetch wallet balances', error, 'ExchangeService');
      throw new Error('Failed to fetch wallet balances');
    }
  }

  private normalizeBalance(ccxtBalance: any): WalletBalance {
    return {
      total: parseFloat(ccxtBalance.total.USDT || 0),
      free: parseFloat(ccxtBalance.free.USDT || 0),
      used: parseFloat(ccxtBalance.used.USDT || 0)
    };
  }

  private encryptCredentials(credentials: ExchangeCredentials): string {
    try {
      return CryptoJS.AES.encrypt(
        JSON.stringify(credentials),
        this.ENCRYPTION_KEY
      ).toString();
    } catch (error) {
      logService.log('error', 'Failed to encrypt credentials', error, 'ExchangeService');
      throw new Error('Failed to encrypt credentials');
    }
  }

  private decryptCredentials(encryptedData: string): ExchangeCredentials {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.ENCRYPTION_KEY);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
      logService.log('error', 'Failed to decrypt credentials', error, 'ExchangeService');
      throw new Error('Failed to decrypt credentials');
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async waitForReady(): Promise<void> {
    if (this.ready) return;
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    return new Promise((resolve) => {
      const checkReady = () => {
        if (this.ready) {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
  }

  async initializeExchange(config: ExchangeConfig): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        if (config.testnet) {
          this.demoMode = true;
          await this.initializeDemoExchange(config);
        } else {
          const exchange = await ccxtService.createExchange(
            config.name as ExchangeId,
            {
              apiKey: config.apiKey,
              secret: config.secret,
              memo: config.memo
            },
            config.testnet
          );

          this.exchangeInstances.set(config.name, exchange);
          await exchange.loadMarkets();
        }

        this.initialized = true;
        this.ready = true;
        this.activeExchange = {
          id: config.name,
          credentials: {
            apiKey: config.apiKey,
            secret: config.secret,
            memo: config.memo
          }
        };
        
        this.emit('exchange:initialized');
      } catch (error) {
        logService.log('error', 'Failed to initialize exchange', error, 'ExchangeService');
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  private async initializeDemoExchange(config: ExchangeConfig): Promise<void> {
    try {
      const testnetExchange = await ccxtService.createExchange(
        'binance',
        {
          apiKey: import.meta.env.VITE_BINANCE_TEST_API_KEY,
          secret: import.meta.env.VITE_BINANCE_TEST_SECRET,
        },
        true
      );

      this.exchangeInstances.set('binance', testnetExchange);
      await testnetExchange.loadMarkets();
      
      this.activeExchange = {
        id: 'binance',
        credentials: {
          apiKey: import.meta.env.VITE_BINANCE_TEST_API_KEY,
          secret: import.meta.env.VITE_BINANCE_TEST_SECRET,
        }
      };
    } catch (error) {
      logService.log('error', 'Failed to initialize testnet exchange', error, 'ExchangeService');
      throw error;
    }
  }

  isDemo(): boolean {
    return this.demoMode;
  }

  private async createExchangeInstance(config: ExchangeConfig): Promise<ccxt.Exchange> {
    return await ccxtService.createExchange(
      config.name as ExchangeId,
      {
        apiKey: config.apiKey,
        secret: config.secret,
        memo: config.memo
      },
      config.testnet
    );
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      if (!this.activeExchange) {
        throw new Error('No active exchange');
      }

      const exchange = this.exchangeInstances.get(this.activeExchange.id);
      if (!exchange) {
        throw new Error('Exchange instance not found');
      }

      if (!exchange.has['fetchOHLCV']) {
        throw new Error('Exchange does not support OHLCV data');
      }

      const candles = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
      
      return candles.map(candle => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5]
      }));

    } catch (error) {
      logService.log('error', `Failed to fetch candles for ${symbol}`, error, 'ExchangeService');
      throw new Error(`Failed to fetch candles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const exchangeService = ExchangeService.getInstance();
