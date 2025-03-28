import { EventEmitter } from './event-emitter';
import { ExchangeConfig, ExchangeCredentials, ExchangeHealth, MarketPair } from '../types';
import { logService } from './log-service';
import { ccxtService } from './ccxt-service';
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
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000;
  private lastHealthCheck: ExchangeHealth = { ok: true, degraded: false };
  private readonly ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY;
  private retryAttempts = 0;
  private marketPairs = new Map<string, MarketPair[]>();
  private capabilities: ExchangeCapabilities | null = null;
  private readonly RECONNECT_DELAY = 5000;
  private readonly CONNECTION_TIMEOUT = 10000;
  private static readonly HEALTH_CHECK_TIMEOUT = 5000;
  private static readonly MIN_REQUIRED_BALANCE = 10;
  private insufficientBalanceCallbacks = new Set<(marketType: string) => void>();

  private connectionState: {
    isConnected: boolean;
    lastHealthCheck: Date;
    reconnectAttempts: number;
    degradedSince?: Date;
  } = {
    isConnected: false,
    lastHealthCheck: new Date(),
    reconnectAttempts: 0
  };

  constructor() {
    super();
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
      if (!this.connectionState.isConnected) {
        return this.createHealthStatus(false, true, 'Exchange disconnected');
      }

      const [ticker, balances] = await Promise.all([
        this.executeWithTimeout(
          () => this.fetchTicker('BTC/USDT'),
          ExchangeService.HEALTH_CHECK_TIMEOUT,
          'Health check timeout'
        ),
        this.checkBalances()
      ]);

      const isHealthy = this.validateTickerData(ticker);
      if (!isHealthy) {
        this.handleDegradedState();
      }

      return this.createHealthStatus(isHealthy, false);
    } catch (error) {
      this.handleDegradedState();
      logService.log('error', 'Exchange health check failed', error, 'ExchangeService');
      return this.createHealthStatus(
        false, 
        true, 
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private createHealthStatus(ok: boolean, degraded: boolean, message?: string): ExchangeHealth {
    return {
      ok,
      degraded,
      message: message || (ok ? 'Exchange connection healthy' : 'Exchange connection degraded'),
      timestamp: new Date().toISOString()
    };
  }

  private handleDegradedState(): void {
    if (!this.connectionState.degradedSince) {
      this.connectionState.degradedSince = new Date();
      this.emit('degraded');
    }

    if (this.shouldAttemptRecovery()) {
      void this.reconnect();
    }
  }

  private shouldAttemptRecovery(): boolean {
    if (!this.connectionState.degradedSince) return false;
    
    const degradedDuration = Date.now() - this.connectionState.degradedSince.getTime();
    return degradedDuration > this.HEALTH_CHECK_INTERVAL * 2;
  }

  private async initializeConnection(config: ExchangeConfig): Promise<void> {
    try {
      await this.executeWithTimeout(
        () => ccxtService.initialize(config),
        this.CONNECTION_TIMEOUT,
        'Exchange initialization timeout'
      );

      this.connectionState.isConnected = true;
      this.connectionState.reconnectAttempts = 0;
      this.emit('connected');

      this.startHealthCheck();
    } catch (error) {
      await this.handleConnectionError(error);
    }
  }

  private async handleConnectionError(error: unknown): Promise<void> {
    this.connectionState.isConnected = false;
    this.connectionState.reconnectAttempts++;

    logService.log('error', 'Exchange connection error', error, 'ExchangeService');
    this.emit('connectionError', error);

    if (this.connectionState.reconnectAttempts <= this.MAX_RETRIES) {
      await this.reconnect();
    } else {
      this.emit('connectionFailed');
      throw new Error('Failed to establish exchange connection after maximum retries');
    }
  }

  private async reconnect(): Promise<void> {
    const delay = this.calculateBackoff(this.connectionState.reconnectAttempts);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.initializeConnection(this.currentConfig);
    } catch (error) {
      logService.log('error', 'Reconnection attempt failed', error, 'ExchangeService');
    }
  }

  private calculateBackoff(attempt: number): number {
    return Math.min(
      this.RETRY_DELAY * Math.pow(2, attempt - 1),
      30000
    );
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number,
    timeoutMessage: string
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(timeoutMessage)), timeout);
      })
    ]);
  }

  private validateTickerData(ticker: any): boolean {
    return (
      ticker &&
      typeof ticker.last === 'number' &&
      typeof ticker.bid === 'number' &&
      typeof ticker.ask === 'number' &&
      ticker.last > 0 &&
      ticker.bid > 0 &&
      ticker.ask > 0
    );
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
      this.isDemoMode = config.testnet;
      this.isLiveMode = !config.testnet;
      this.useUSDX = config.useUSDX || false;

      // Validate demo credentials if in demo mode
      if (this.isDemoMode) {
        if (!config.apiKey || !config.secret || !config.memo) {
          throw new Error('Invalid demo credentials configuration');
        }
      }

      await ccxtService.initialize(config);
      this.currentExchange = config.name;
      
      // Check if exchange supports WebSocket
      const exchange = await ccxtService.getExchange();
      this.wsSupported = Boolean(exchange.has.ws);
      
      await this.fetchExchangeCapabilities();
      await this.initializeMarketPairs();
      await this.initializeBalanceUpdates();

      // Store credentials only for non-demo mode
      if (!this.isDemoMode) {
        this.setCredentials({
          apiKey: config.apiKey,
          secret: config.secret,
          memo: config.memo,
          password: config.password
        }, config.name);
      }

      this.initialized = true;
      this.emit('initialized');
      
      logService.log('info', 
        `Exchange initialized in ${this.isDemoMode ? 'Bitmart demo' : 'live'} mode`, 
        null, 
        'ExchangeService'
      );
    } catch (error) {
      logService.log('error', 'Failed to initialize exchange', error, 'ExchangeService');
      this.initialized = false;
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
    try {
      // Even in demo mode, fetch real market pairs from Bitmart
      const exchange = await ccxtService.getExchange();
      const markets = await exchange.loadMarkets();
      const pairs = this.processMarketPairs(markets);
      this.marketPairs.set(this.currentExchange!, pairs);
    } catch (error) {
      logService.log('error', 'Failed to initialize market pairs', error, 'ExchangeService');
      throw error;
    }
  }

  private async initializeBalanceUpdates(): Promise<void> {
    try {
      if (this.isDemoMode) {
        // Set up demo balance but still use real market data
        const demoBalance = {
          spot: { total: 10000, used: 0, free: 10000 },
          margin: { total: 5000, used: 0, free: 5000 },
          futures: { total: 5000, used: 0, free: 5000 }
        };
        
        this.emit('balanceUpdate', demoBalance);
        return;
      }
      
      // Normal balance update initialization for live mode
      if (this.wsSupported) {
        await this.subscribeToBalanceUpdates();
      } else {
        this.startPollingBalances();
      }
    } catch (error) {
      logService.log('error', 'Failed to initialize balance updates', error, 'ExchangeService');
      throw error;
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

  private decryptCredentials(encrypted: string): ExchangeCredentials {
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, this.ENCRYPTION_KEY);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
      logService.log('error', 'Failed to decrypt credentials', error, 'ExchangeService');
      throw new Error('Failed to decrypt credentials');
    }
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

  async destroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.removeAllListeners();
    this.initialized = false;
    this.currentExchange = null;
    this.credentials = null;
  }
}

export const exchangeService = ExchangeService.getInstance();
