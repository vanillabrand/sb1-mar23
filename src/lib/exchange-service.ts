import { EventEmitter } from './event-emitter';
import { ccxtService } from './ccxt-service';
import { logService } from './log-service';
import type { ExchangeConfig, ExchangeCredentials } from './types';
import CryptoJS from 'crypto-js';

class ExchangeService extends EventEmitter {
  private static instance: ExchangeService;
  private currentExchange: string | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private isLiveMode = false;
  private isDemoMode = false;
  private useUSDX = false;
  private credentials: ExchangeCredentials | null = null;
  private retryAttempts = 0;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private lastHealthCheck: ExchangeHealth = { ok: true, degraded: false };
  private readonly ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || 'your-fallback-key';

  private constructor() {
    super();
    this.startHealthCheck();
  }

  static getInstance(): ExchangeService {
    if (!ExchangeService.instance) {
      ExchangeService.instance = new ExchangeService();
    }
    return ExchangeService.instance;
  }

  private startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        this.lastHealthCheck = health;
        this.emit('healthUpdate', health);
      } catch (error) {
        logService.log('error', 'Health check failed', error, 'ExchangeService');
        this.lastHealthCheck = { ok: false, degraded: true, message: 'Health check failed' };
        this.emit('healthUpdate', this.lastHealthCheck);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  async checkHealth(): Promise<ExchangeHealth> {
    try {
      if (!this.initialized) {
        return {
          ok: false,
          degraded: true,
          message: 'Exchange service not initialized'
        };
      }

      if (this.isDemoMode) {
        return {
          ok: true,
          degraded: false,
          message: 'Running in demo mode'
        };
      }

      // Check connection to exchange via CCXT
      const ticker = await ccxtService.fetchTicker('BTC_USDT');
      const hasValidPrice = !isNaN(parseFloat(ticker.last_price));

      if (!hasValidPrice) {
        return {
          ok: false,
          degraded: true,
          message: 'Invalid market data received'
        };
      }

      return {
        ok: true,
        degraded: false,
        message: 'Exchange connection healthy'
      };
    } catch (error) {
      return {
        ok: false,
        degraded: true,
        message: error instanceof Error ? error.message : 'Exchange connection error'
      };
    }
  }

  private async initializeDefaultExchange(): Promise<void> {
    if (this.initialized || this.initializationPromise) return;

    const savedUseUSDX = localStorage.getItem('useUSDX') === 'true';
    const savedCredentials = this.getCredentials();

    
    this.initializationPromise = (async () => {
      try {
        if (savedCredentials) {
          // Initialize with stored credentials
          await this.initializeExchange({
            name: 'bitmart',
            apiKey: savedCredentials.apiKey,
            secret: savedCredentials.secret,
            memo: savedCredentials.memo,
            testnet: false,
            useUSDX: savedUseUSDX
          });
        } else {
          // Initialize in demo mode
          await this.initializeExchange({
            name: 'bitmart',
            apiKey: 'demo',
            secret: 'demo',
            memo: 'demo',
            testnet: true,
            useUSDX: savedUseUSDX
          });
        }
        
        this.initialized = true;
        this.emit('initialized');
      } catch (error) {
        logService.log('error', 'Failed to initialize default exchange', error, 'ExchangeService');
        // Fall back to demo mode
        await this.initializeExchange({
          name: 'bitmart',
          apiKey: 'demo',
          secret: 'demo',
          memo: 'demo',
          testnet: true,
          useUSDX: false
        });
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  async initializeExchange(config: ExchangeConfig): Promise<void> {
    try {
      await ccxtService.initialize(config);
      this.currentExchange = config.name;
      this.initialized = true;

      if (!this.isDemoMode) {
        this.setCredentials({
          apiKey: config.apiKey,
          secret: config.secret,
          memo: config.memo,
          password: config.password
        }, config.name);
      }

      this.emit('exchangeInitialized', { 
        exchangeId: config.name, 
        isDemoMode: this.isDemoMode 
      });
    } catch (error) {
      logService.log('error', 'Failed to initialize exchange', error, 'ExchangeService');
      throw error;
    }
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;
    return this.initializeDefaultExchange();
  }

  async fetchTicker(symbol: string): Promise<any> {
    await this.ensureInitialized();
    return ccxtService.fetchTicker(symbol);
  }

  async fetchBalance(type: 'spot' | 'margin' | 'futures' = 'spot'): Promise<any> {
    await this.ensureInitialized();
    return ccxtService.fetchBalance(type);
  }

  async createOrder(
    symbol: string,
    type: 'market' | 'limit',
    side: 'buy' | 'sell',
    amount: number,
    price?: number
  ): Promise<any> {
    await this.ensureInitialized();
    return ccxtService.createOrder(symbol, type, side, amount, price);
  }

  private encryptCredentials(credentials: ExchangeCredentials): string {
    return CryptoJS.AES.encrypt(
      JSON.stringify(credentials),
      this.ENCRYPTION_KEY
    ).toString();
  }

  private decryptCredentials(encrypted: string): ExchangeCredentials {
    const bytes = CryptoJS.AES.decrypt(encrypted, this.ENCRYPTION_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  }

  setCredentials(credentials: ExchangeCredentials | null, exchangeId: string) {
    if (credentials) {
      const encrypted = this.encryptCredentials(credentials);
      localStorage.setItem('current_exchange', exchangeId);
      localStorage.setItem(`exchange_credentials_${exchangeId}`, encrypted);
    } else {
      localStorage.removeItem('current_exchange');
      localStorage.removeItem(`exchange_credentials_${this.currentExchange}`);
    }
  }

  getCredentials(): { credentials: ExchangeCredentials | null, exchangeId: string | null } {
    const exchangeId = localStorage.getItem('current_exchange');
    if (!exchangeId) return { credentials: null, exchangeId: null };

    const encrypted = localStorage.getItem(`exchange_credentials_${exchangeId}`);
    if (!encrypted) return { credentials: null, exchangeId: null };

    try {
      const credentials = this.decryptCredentials(encrypted);
      return { credentials, exchangeId };
    } catch (error) {
      logService.log('error', 'Failed to decrypt credentials', error, 'ExchangeService');
      return { credentials: null, exchangeId: null };
    }
  }

  getCurrentExchange(): string | null {
    return this.currentExchange;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isLive(): boolean {
    return this.isLiveMode;
  }

  isDemo(): boolean {
    return this.isDemoMode;
  }

  isUsingUSDX(): boolean {
    return this.useUSDX;
  }

  hasCredentials(): boolean {
    return this.credentials !== null;
  }

  async switchMode(live: boolean): Promise<void> {
    const credentials = this.getCredentials();
    if (live && !credentials) {
      throw new Error('No credentials available for live mode');
    }

    await this.initializeExchange({
      name: 'bitmart',
      apiKey: live ? credentials!.apiKey : 'demo',
      secret: live ? credentials!.secret : 'demo',
      memo: live ? credentials!.memo : 'demo',
      testnet: !live,
      useUSDX: this.useUSDX
    });
  }

  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    ccxtService.cleanup();
    this.currentExchange = null;
    this.initialized = false;
    this.isLiveMode = false;
    this.isDemoMode = true;
    this.credentials = null;
    this.retryAttempts = 0;
  }
}

interface ExchangeHealth {
  ok: boolean;
  degraded: boolean;
  message?: string;
}

export const exchangeService = ExchangeService.getInstance();
