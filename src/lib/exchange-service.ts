import { EventEmitter } from './event-emitter';
import { ccxtService } from './ccxt-service';
import { logService } from './log-service';
import type { ExchangeConfig, ExchangeCredentials } from './types';
import CryptoJS from 'crypto-js';
import { websocketService } from './websocket-service';

class ExchangeService extends EventEmitter {
  private static instance: ExchangeService;
  private currentExchange: string | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private isLiveMode = false;
  private isDemoMode = false;
  private useUSDX = false;
  private credentials: ExchangeCredentials | null = null;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private lastHealthCheck: ExchangeHealth = { ok: true, degraded: false };
  private readonly ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'your-fallback-key';
  private retryAttempts = 0;
  private walletBalances: Map<string, ExchangeWallets> = new Map();
  private marketPairs: Map<string, MarketPair[]> = new Map();
  private capabilities: ExchangeCapabilities | null = null;
  private balanceUpdateInterval: NodeJS.Timer | null = null;
  private wsSupported: boolean = false;
  private wsSubscriptions: Set<string> = new Set();
  private static MIN_REQUIRED_BALANCE = 10; // Minimum USD balance required
  private balanceCheckInterval: NodeJS.Timeout | null = null;
  private insufficientBalanceCallbacks: Set<(marketType: string) => void> = new Set();

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
            apiKey: savedCredentials.credentials!.apiKey,
            secret: savedCredentials.credentials!.secret,
            memo: savedCredentials.credentials!.memo,
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
      
      // Check if exchange supports WebSocket
      const exchange = await ccxtService.getExchange();
      this.wsSupported = Boolean(exchange.has.ws);
      
      await this.fetchExchangeCapabilities();
      await this.initializeMarketPairs();
      
      // Initialize balance updates based on exchange capabilities
      await this.initializeBalanceUpdates();

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
        isDemoMode: this.isDemoMode,
        capabilities: this.capabilities,
        wsSupported: this.wsSupported
      });
    } catch (error) {
      logService.log('error', 'Failed to initialize exchange', error, 'ExchangeService');
      throw error;
    }
  }

  private async fetchExchangeCapabilities(): Promise<void> {
    const exchange = await ccxtService.getExchange();
    this.capabilities = {
      supportedWallets: ['spot'],
      supportedOrderTypes: ['market', 'limit'],
      supportedTimeInForce: ['GTC'],
      supportsMarginTrading: exchange.has.margin,
      supportsFuturesTrading: exchange.has.future,
      supportsSpotTrading: exchange.has.spot
    };

    if (exchange.has.margin) {
      this.capabilities.supportedWallets.push('margin');
      this.capabilities.marginRequirements = await this.fetchMarginRequirements();
    }

    if (exchange.has.future) {
      this.capabilities.supportedWallets.push('futures');
    }
  }

  private async initializeMarketPairs(): Promise<void> {
    const exchange = await ccxtService.getExchange();
    const markets = await exchange.loadMarkets();
    
    const pairs: MarketPair[] = [];
    
    for (const [symbol, market] of Object.entries(markets)) {
      const pair: MarketPair = {
        base: market.base,
        quote: market.quote,
        type: market.type || 'spot',
        minQuantity: market.limits?.amount?.min || 0,
        maxQuantity: market.limits?.amount?.max || Infinity,
        pricePrecision: market.precision.price,
        quantityPrecision: market.precision.amount,
        minNotional: market.limits?.cost?.min || 0,
        isActive: market.active,
        permissions: market.info?.permissions || []
      };
      pairs.push(pair);
    }
    
    this.marketPairs.set(this.currentExchange, pairs);
  }

  private async initializeBalanceUpdates(): Promise<void> {
    if (this.wsSupported) {
      await this.subscribeToBalanceUpdates();
    } else {
      this.startPollingBalances();
    }
  }

  private async subscribeToBalanceUpdates(): Promise<void> {
    try {
      // Clear any existing subscriptions
      if (this.balanceUpdateInterval) {
        clearInterval(this.balanceUpdateInterval);
      }
      
      await websocketService.connect();
      
      // Subscribe to different wallet types based on capabilities
      const subscriptions = ['spot/balance'];
      if (this.capabilities?.supportsMarginTrading) {
        subscriptions.push('margin/balance');
      }
      if (this.capabilities?.supportsFuturesTrading) {
        subscriptions.push('futures/balance');
      }

      for (const channel of subscriptions) {
        await websocketService.subscribe(channel, this.handleBalanceUpdate.bind(this));
        this.wsSubscriptions.add(channel);
      }

      // Fetch initial balances
      await this.updateAllBalances();

      // Set up a fallback polling with longer interval
      this.balanceUpdateInterval = setInterval(async () => {
        await this.updateAllBalances();
      }, 60000); // Fallback update every minute

    } catch (error) {
      logService.log('error', 'Failed to subscribe to balance updates', error, 'ExchangeService');
      // Fallback to polling if WebSocket subscription fails
      this.startPollingBalances();
    }
  }

  private startPollingBalances(): void {
    if (this.balanceUpdateInterval) {
      clearInterval(this.balanceUpdateInterval);
    }

    this.balanceUpdateInterval = setInterval(async () => {
      await this.updateAllBalances();
    }, 10000); // Poll every 10 seconds when WebSocket not available
  }

  private handleBalanceUpdate(data: any): void {
    try {
      const walletType = data.channel.split('/')[0] as keyof ExchangeWallets;
      const currentBalances = this.walletBalances.get(this.currentExchange) || {};
      
      // Update specific wallet balance
      if (currentBalances[walletType]) {
        currentBalances[walletType] = {
          total: parseFloat(data.total) || 0,
          available: parseFloat(data.free) || 0,
          used: parseFloat(data.used) || 0,
          updateTime: Date.now()
        };

        this.walletBalances.set(this.currentExchange, currentBalances);
        this.emit('balancesUpdated', currentBalances);
      }
    } catch (error) {
      logService.log('error', 'Error processing balance update', error, 'ExchangeService');
    }
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;
    return this.initializeDefaultExchange();
  }

  async fetchTicker(symbol: string): Promise<any> {
    await this.ensureInitialized();
    return this.executeWithRetry(() => ccxtService.fetchTicker(symbol));
  }

  async fetchBalance(type: 'spot' | 'margin' | 'futures' = 'spot'): Promise<any> {
    await this.ensureInitialized();
    return this.executeWithRetry(() => ccxtService.fetchBalance(type));
  }

  async createOrder(
    symbol: string,
    type: 'market' | 'limit',
    side: 'buy' | 'sell',
    amount: number,
    price?: number
  ): Promise<any> {
    await this.ensureInitialized();
    return this.executeWithRetry(() => 
      ccxtService.createOrder(symbol, type, side, amount, price)
    );
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
      apiKey: live ? credentials.credentials!.apiKey : 'demo',
      secret: live ? credentials.credentials!.secret : 'demo',
      memo: live ? credentials.credentials!.memo : 'demo',
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

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === this.MAX_RETRIES - 1) throw error;
        
        this.retryAttempts++;
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        
        logService.log('warn', 
          `Retry attempt ${attempt + 1} of ${this.MAX_RETRIES}`, 
          error, 
          'ExchangeService'
        );
      }
    }
    throw new Error('Max retries exceeded');
  }

  getAvailableMarketPairs(): MarketPair[] {
    return this.marketPairs.get(this.currentExchange) || [];
  }

  getExchangeCapabilities(): ExchangeCapabilities | null {
    return this.capabilities;
  }

  async disconnect(): Promise<void> {
    // Clean up WebSocket subscriptions
    for (const channel of this.wsSubscriptions) {
      await websocketService.unsubscribe(channel);
    }
    this.wsSubscriptions.clear();

    // Clear polling interval
    if (this.balanceUpdateInterval) {
      clearInterval(this.balanceUpdateInterval);
      this.balanceUpdateInterval = null;
    }
  }

  async initializeBalanceMonitoring(): Promise<void> {
    if (this.balanceCheckInterval) {
      clearInterval(this.balanceCheckInterval);
    }

    this.balanceCheckInterval = setInterval(async () => {
      await this.checkBalances();
    }, 30000); // Check every 30 seconds

    // Initial check
    await this.checkBalances();
  }

  private async checkBalances(): Promise<void> {
    if (this.isDemoMode) {
      return; // Skip balance checks in demo mode
    }

    const wallets = await this.fetchWalletBalances();
    
    // Check each market type
    ['spot', 'margin', 'futures'].forEach(marketType => {
      const wallet = wallets[marketType as keyof ExchangeWallets];
      if (wallet && wallet.available < ExchangeService.MIN_REQUIRED_BALANCE) {
        this.emit('insufficientBalance', marketType);
        this.insufficientBalanceCallbacks.forEach(cb => cb(marketType));
      }
    });
  }

  onInsufficientBalance(callback: (marketType: string) => void): void {
    this.insufficientBalanceCallbacks.add(callback);
  }

  offInsufficientBalance(callback: (marketType: string) => void): void {
    this.insufficientBalanceCallbacks.delete(callback);
  }

  getExchangeDepositUrl(): string {
    return this.exchange?.urls?.deposit || this.exchange?.urls?.www || '';
  }
}

interface ExchangeHealth {
  ok: boolean;
  degraded: boolean;
  message?: string;
}

export const exchangeService = ExchangeService.getInstance();
