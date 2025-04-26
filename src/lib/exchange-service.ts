import { EventEmitter } from './event-emitter';
import CryptoJS from 'crypto-js';
import { supabase } from './enhanced-supabase';
import { logService } from './log-service';
import { networkErrorHandler } from './network-error-handler';
import { userProfileService } from './user-profile-service';
import { websocketManager } from './websocket-manager';
import { cacheService } from './cache-service';
import { eventBus } from './event-bus';
import type {
  Exchange,
  ExchangeConfig,
  ExchangeCredentials,
  WalletBalance,
  ExchangeId,
  ExchangeHealth
} from './types';
import { ccxtService } from './ccxt-service';
import * as ccxt from 'ccxt';
import { config } from './config';
import { demoService } from './demo-service';

class ExchangeService extends EventEmitter {
  private static instance: ExchangeService;
  private activeExchange: Exchange | null = null;
  private readonly ENCRYPTION_KEY: string;
  private initialized = false;
  private ready = false;
  private initializationPromise: Promise<void> | null = null;
  private exchangeInstances: Map<string, any> = new Map();
  private demoMode = false;
  private activeOrders: Map<string, any> = new Map();
  private loggedOrderErrors: Set<string> = new Set();
  private websocketConnections: Map<string, string> = new Map(); // Map of exchange ID to WebSocket connection ID
  private marketDataSubscriptions: Map<string, Set<string>> = new Map(); // Map of connection ID to set of subscribed symbols
  private readonly CACHE_NAMESPACE = 'exchange_data';
  private readonly MARKET_DATA_CACHE_NAMESPACE = 'market_data';
  private readonly TICKER_CACHE_TTL = 10 * 1000; // 10 seconds
  private readonly ORDERBOOK_CACHE_TTL = 5 * 1000; // 5 seconds
  private readonly TRADES_CACHE_TTL = 30 * 1000; // 30 seconds
  private _websocketHealthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY;
    if (!this.ENCRYPTION_KEY) {
      throw new Error('Missing encryption key in environment variables');
    }

    // Initialize cache namespaces
    this.initializeCache();

    // Listen for WebSocket events
    this.setupWebSocketEventListeners();
  }

  /**
   * Initialize cache namespaces for exchange data
   */
  private initializeCache(): void {
    // Initialize exchange data cache
    cacheService.initializeCache({
      namespace: this.CACHE_NAMESPACE,
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 100
    });

    // Initialize market data cache
    cacheService.initializeCache({
      namespace: this.MARKET_DATA_CACHE_NAMESPACE,
      ttl: 30 * 1000, // 30 seconds
      maxSize: 500
    });

    logService.log('info', 'Initialized exchange service caches', null, 'ExchangeService');
  }

  /**
   * Set up event listeners for WebSocket events
   */
  private setupWebSocketEventListeners(): void {
    // Listen for WebSocket connection events
    websocketManager.on('connected', ({ connectionId }) => {
      const exchangeId = this.getExchangeIdForConnection(connectionId);
      if (exchangeId) {
        logService.log('info', `WebSocket connected for exchange ${exchangeId}`, null, 'ExchangeService');
        this.emit('websocket:connected', { exchangeId, connectionId });
      }
    });

    websocketManager.on('disconnected', ({ connectionId }) => {
      const exchangeId = this.getExchangeIdForConnection(connectionId);
      if (exchangeId) {
        logService.log('info', `WebSocket disconnected for exchange ${exchangeId}`, null, 'ExchangeService');
        this.emit('websocket:disconnected', { exchangeId, connectionId });
      }
    });

    websocketManager.on('error', ({ connectionId, error }) => {
      const exchangeId = this.getExchangeIdForConnection(connectionId);
      if (exchangeId) {
        logService.log('error', `WebSocket error for exchange ${exchangeId}`, error, 'ExchangeService');
        this.emit('websocket:error', { exchangeId, connectionId, error });
      }
    });

    websocketManager.on('message', ({ connectionId, message }) => {
      this.handleWebSocketMessage(connectionId, message);
    });

    websocketManager.on('resubscribe', ({ connectionId, subscriptions }) => {
      const exchangeId = this.getExchangeIdForConnection(connectionId);
      if (exchangeId) {
        logService.log('info', `Resubscribing to ${subscriptions.length} channels for exchange ${exchangeId}`, null, 'ExchangeService');
        this.resubscribeToMarketData(connectionId, exchangeId);
      }
    });
  }

  /**
   * Get the exchange ID for a WebSocket connection ID
   * @param connectionId WebSocket connection ID
   * @returns Exchange ID or undefined if not found
   */
  private getExchangeIdForConnection(connectionId: string): string | undefined {
    for (const [exchangeId, connId] of this.websocketConnections.entries()) {
      if (connId === connectionId) {
        return exchangeId;
      }
    }
    return undefined;
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
      // First try to load from user profile in database (for cross-device persistence)
      const profileExchange = await userProfileService.getActiveExchange();

      if (profileExchange) {
        logService.log('info', 'Loading exchange from user profile', { exchangeId: profileExchange.id }, 'ExchangeService');
        try {
          await this.connect(profileExchange);
          this.initialized = true;

          // Initialize WebSocket connections
          await this.initializeWebSockets();

          return;
        } catch (connectError) {
          logService.log('warn', 'Failed to connect to exchange from profile, falling back to local storage', connectError, 'ExchangeService');
          // Fall back to local storage if connection fails
        }
      }

      // Fall back to local storage if no profile exchange or connection failed
      const savedExchange = localStorage.getItem('activeExchange');
      if (savedExchange) {
        const exchange = JSON.parse(savedExchange);
        try {
          await this.connect(exchange);

          // Initialize WebSocket connections
          await this.initializeWebSockets();
        } catch (localStorageError) {
          logService.log('error', 'Failed to connect to exchange from local storage', localStorageError, 'ExchangeService');
          // Don't throw here, just log the error and continue
        }
      }

      this.initialized = true;
    } catch (error) {
      logService.log('error', 'Failed to initialize exchange service', error, 'ExchangeService');
      // Don't throw the error, just log it and continue
      this.initialized = true;
    }
  }

  async getUserExchanges(): Promise<Exchange[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const { data: userExchanges, error } = await supabase
        .from('user_exchanges')
        .select('*')
        .eq('user_id', user.user.id)
        .order('is_default', { ascending: false }) // Default exchanges first
        .order('created_at', { ascending: true }); // Then oldest first

      if (error) throw error;

      if (!userExchanges || userExchanges.length === 0) {
        return [];
      }

      return userExchanges.map(exchange => ({
        ...exchange,
        credentials: exchange.encrypted_credentials ?
          this.decryptCredentials(exchange.encrypted_credentials) : undefined
      }));
    } catch (error) {
      logService.log('error', 'Failed to fetch user exchanges', error, 'ExchangeService');
      throw new Error('Failed to fetch exchanges');
    }
  }

  /**
   * Get the currently active exchange
   * @returns The active exchange or null if none is active
   */
  async getActiveExchange(): Promise<Exchange | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return null;
      }

      // First check if we have an active exchange in memory
      if (this.activeExchange) {
        // Verify it still exists in the database
        const { data, error } = await supabase
          .from('user_exchanges')
          .select('*')
          .eq('user_id', user.user.id)
          .eq('name', this.activeExchange.id)
          .single();

        if (!error && data) {
          // Exchange exists in database, return it
          logService.log('info', `Using active exchange from memory: ${this.activeExchange.id}`, null, 'ExchangeService');
          return {
            ...data,
            credentials: data.encrypted_credentials ?
              this.decryptCredentials(data.encrypted_credentials) : undefined
          };
        } else {
          // Exchange no longer exists in database, clear it from memory
          logService.log('warn', `Active exchange ${this.activeExchange.id} no longer exists in database, clearing from memory`, null, 'ExchangeService');
          this.activeExchange = null;
          localStorage.removeItem('activeExchange');
        }
      }

      // Next, check if we have an active exchange in user profile
      const profileExchange = await userProfileService.getActiveExchange();
      if (profileExchange) {
        // Verify it exists in the database
        const { data, error } = await supabase
          .from('user_exchanges')
          .select('*')
          .eq('user_id', user.user.id)
          .eq('name', profileExchange.id)
          .single();

        if (!error && data) {
          // Exchange exists in database, set it as active and return it
          logService.log('info', `Using active exchange from user profile: ${profileExchange.id}`, null, 'ExchangeService');
          this.activeExchange = profileExchange;
          localStorage.setItem('activeExchange', JSON.stringify(profileExchange));
          return {
            ...data,
            credentials: data.encrypted_credentials ?
              this.decryptCredentials(data.encrypted_credentials) : undefined
          };
        }
      }

      // Next, try to get from localStorage
      const activeExchangeStr = localStorage.getItem('activeExchange');
      if (activeExchangeStr) {
        try {
          const activeExchangeInfo = JSON.parse(activeExchangeStr);
          if (activeExchangeInfo && activeExchangeInfo.id) {
            // Verify it exists in the database
            const { data, error } = await supabase
              .from('user_exchanges')
              .select('*')
              .eq('user_id', user.user.id)
              .eq('name', activeExchangeInfo.id)
              .single();

            if (!error && data) {
              // Exchange exists in database, set it as active and return it
              logService.log('info', `Using active exchange from localStorage: ${activeExchangeInfo.id}`, null, 'ExchangeService');
              const exchange = {
                ...data,
                credentials: data.encrypted_credentials ?
                  this.decryptCredentials(data.encrypted_credentials) : undefined
              };
              this.activeExchange = exchange;
              // Also save to user profile for cross-device persistence
              await userProfileService.saveActiveExchange(exchange);
              return exchange;
            }
          }
        } catch (e) {
          console.error('Failed to parse active exchange from localStorage:', e);
          localStorage.removeItem('activeExchange');
        }
      }

      // If no active exchange found, try to get the default exchange
      const { data: defaultExchange, error: defaultError } = await supabase
        .from('user_exchanges')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('is_default', true)
        .single();

      if (!defaultError && defaultExchange) {
        // Set as active exchange and return it
        logService.log('info', `Using default exchange: ${defaultExchange.name}`, null, 'ExchangeService');
        const exchange = {
          ...defaultExchange,
          credentials: defaultExchange.encrypted_credentials ?
            this.decryptCredentials(defaultExchange.encrypted_credentials) : undefined
        };
        this.activeExchange = exchange;
        localStorage.setItem('activeExchange', JSON.stringify(exchange));
        // Also save to user profile for cross-device persistence
        await userProfileService.saveActiveExchange(exchange);
        return exchange;
      }

      // If no default exchange, try to get the first exchange
      const { data: firstExchange, error: firstError } = await supabase
        .from('user_exchanges')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!firstError && firstExchange) {
        // Set as active exchange and return it
        logService.log('info', `Using first available exchange: ${firstExchange.name}`, null, 'ExchangeService');
        const exchange = {
          ...firstExchange,
          credentials: firstExchange.encrypted_credentials ?
            this.decryptCredentials(firstExchange.encrypted_credentials) : undefined
        };
        this.activeExchange = exchange;
        localStorage.setItem('activeExchange', JSON.stringify(exchange));
        // Also save to user profile for cross-device persistence
        await userProfileService.saveActiveExchange(exchange);
        return exchange;
      }

      // If no exchange found, return null
      logService.log('info', 'No exchange found', null, 'ExchangeService');
      return null;
    } catch (error) {
      logService.log('error', 'Failed to get active exchange', error, 'ExchangeService');
      return null;
    }
  }

  async connect(exchange: Exchange): Promise<void> {
    try {
      // Check if we're in demo mode
      const isDemo = demoService.isInDemoMode();

      // If in demo mode, use the demo exchange
      if (isDemo) {
        logService.log('info', 'Connecting to demo exchange', { exchangeId: exchange.id }, 'ExchangeService');

        // Create a demo exchange instance
        const demoExchange = {
          id: 'demo-exchange',
          name: 'Demo Exchange',
          credentials: {
            apiKey: 'demo-api-key',
            secret: 'demo-secret'
          },
          testnet: true
        };

        this.activeExchange = demoExchange as Exchange;
        localStorage.setItem('activeExchange', JSON.stringify(demoExchange));

        // Initialize demo WebSocket
        await this.initializeWebSockets();

        // Emit connected event
        this.emit('exchange:connected', demoExchange);
        return;
      }

      // For real exchanges, proceed with normal connection
      // Validate exchange ID
      if (!exchange.id) {
        throw new Error('Invalid exchange: missing ID');
      }

      // Normalize exchange ID to lowercase
      const exchangeId = exchange.id.toLowerCase();

      // Validate that this is a supported exchange
      const supportedExchanges = ['binance', 'bybit', 'bitmart', 'bitget', 'okx', 'coinbase', 'kraken'];
      if (!supportedExchanges.includes(exchangeId)) {
        logService.log('warn', `Connecting to potentially unsupported exchange: ${exchangeId}`, null, 'ExchangeService');
      }

      // Initialize CCXT exchange instance if not already created
      if (!this.exchangeInstances.has(exchangeId)) {
        const credentials = exchange.credentials;
        if (!credentials) {
          throw new Error('Exchange credentials not found');
        }

        logService.log('info', `Creating new exchange instance for ${exchangeId}`, {
          hasApiKey: !!credentials.apiKey,
          hasSecret: !!credentials.secret,
          testnet: !!exchange.testnet
        }, 'ExchangeService');

        const ccxtInstance = await ccxtService.createExchange(
          exchangeId as ExchangeId,
          credentials,
          exchange.testnet
        );
        this.exchangeInstances.set(exchangeId, ccxtInstance);
      }

      const ccxtInstance = this.exchangeInstances.get(exchangeId);
      if (!ccxtInstance) {
        throw new Error(`Failed to get exchange instance for ${exchangeId}`);
      }

      // Try to load markets with retry logic
      let retries = 3;
      let success = false;

      while (retries > 0 && !success) {
        try {
          logService.log('info', `Loading markets for ${exchangeId} (attempt ${4-retries}/3)`, null, 'ExchangeService');
          await ccxtInstance.loadMarkets();
          success = true;
          logService.log('info', `Successfully loaded markets for ${exchangeId}`, null, 'ExchangeService');
        } catch (error) {
          retries--;
          if (retries === 0) {
            throw error;
          }
          logService.log('warn', `Failed to load markets for ${exchangeId}, retrying (${retries} attempts left)`, error, 'ExchangeService');
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
        }
      }

      // Update active exchange
      this.activeExchange = {
        ...exchange,
        id: exchangeId // Ensure ID is normalized
      };

      // Store in localStorage
      localStorage.setItem('activeExchange', JSON.stringify(this.activeExchange));

      // Save to user profile in database for persistence across devices
      await userProfileService.saveActiveExchange(this.activeExchange);
      await userProfileService.updateConnectionStatus('connected');
      await userProfileService.resetConnectionAttempts();

      // Set as default exchange if requested
      if (exchange.is_default) {
        await this.setDefaultExchange(exchangeId);
      }

      // Initialize WebSocket connection for this exchange
      await this.initializeExchangeWebSocket(exchangeId);

      // Verify the connection is still active
      try {
        // Simple API call to verify connection
        await ccxtInstance.fetchTime();
        logService.log('info', `Successfully connected to ${exchangeId} exchange`, null, 'ExchangeService');
        this.emit('exchange:connected', this.activeExchange);
      } catch (verifyError) {
        logService.log('warn', `Connected to ${exchangeId} exchange but verification failed`, verifyError, 'ExchangeService');
        // Still emit the connected event, but with a warning flag
        this.emit('exchange:connected', { ...this.activeExchange, connectionWarning: true });
      }

    } catch (error) {
      logService.log('error', 'Failed to connect to exchange', error, 'ExchangeService');

      // Update connection status in user profile
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await userProfileService.updateConnectionStatus('error', errorMessage);

      this.emit('exchange:error', error);
      throw new Error('Failed to connect to exchange');
    }
  }

  /**
   * Initialize WebSocket connections for all active exchanges
   */
  private async initializeWebSockets(): Promise<void> {
    try {
      // Close any existing WebSocket connections
      this.closeAllWebSockets();

      // If we have an active exchange, initialize its WebSocket
      if (this.activeExchange) {
        await this.initializeExchangeWebSocket(this.activeExchange.id);
      }

      // Set up periodic WebSocket health check
      this.setupWebSocketHealthCheck();

      logService.log('info', 'Initialized WebSocket connections', null, 'ExchangeService');
    } catch (error) {
      logService.log('error', 'Failed to initialize WebSocket connections', error, 'ExchangeService');
    }
  }

  /**
   * Set up periodic health check for WebSocket connections
   * This will check every 30 seconds if the WebSocket is still connected
   * and reconnect if necessary
   */
  private setupWebSocketHealthCheck(): void {
    // Clear any existing interval
    if (this._websocketHealthCheckInterval) {
      clearInterval(this._websocketHealthCheckInterval);
    }

    // Set up new interval
    this._websocketHealthCheckInterval = setInterval(async () => {
      try {
        // Skip if we're not in a state where we need WebSockets
        if (!this.initialized || !this.activeExchange) {
          return;
        }

        // Get the connection ID for the active exchange
        const connectionId = this.websocketConnections.get(this.activeExchange.id);

        // If we have a connection ID but the WebSocket is disconnected, reconnect
        if (connectionId && !websocketManager.isConnected(connectionId)) {
          logService.log('warn', `WebSocket for ${this.activeExchange.id} is disconnected, reconnecting...`, null, 'ExchangeService');

          try {
            // Close the existing connection
            websocketManager.close(connectionId);

            // Initialize a new connection
            await this.initializeExchangeWebSocket(this.activeExchange.id);

            logService.log('info', `Successfully reconnected WebSocket for ${this.activeExchange.id}`, null, 'ExchangeService');
          } catch (reconnectError) {
            logService.log('error', `Failed to reconnect WebSocket for ${this.activeExchange.id}`, reconnectError, 'ExchangeService');
          }
        }
      } catch (error) {
        logService.log('error', 'Error in WebSocket health check', error, 'ExchangeService');
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Initialize a WebSocket connection for a specific exchange
   * @param exchangeId Exchange ID
   */
  private async initializeExchangeWebSocket(exchangeId: string): Promise<void> {
    try {
      // Import the WebSocket service dynamically to avoid circular dependencies
      const { exchangeServiceWebSocket } = await import('./exchange-service-websocket');

      // Close any existing WebSocket connection for this exchange
      this.closeExchangeWebSocket(exchangeId);

      // Get the exchange instance
      const exchange = this.exchangeInstances.get(exchangeId);
      if (!exchange) {
        logService.log('warn', `Cannot initialize WebSocket for exchange ${exchangeId}: Exchange instance not found`, null, 'ExchangeService');
        return;
      }

      // Get WebSocket URL for the exchange
      let wsUrl = '';

      // Different exchanges have different WebSocket URLs
      switch (exchangeId) {
        case 'binance':
          wsUrl = 'wss://stream.binance.com:9443/ws';
          break;
        case 'bitmart':
          wsUrl = 'wss://ws-manager-compress.bitmart.com/api?protocol=1.1';
          break;
        case 'kucoin':
          // KuCoin requires a token from the REST API
          try {
            const response = await exchange.publicGetBulletPublic();
            if (response && response.data) {
              const token = response.data.token;
              const endpoint = response.data.instanceServers[0].endpoint;
              wsUrl = `${endpoint}?token=${token}&[connectId=${Date.now()}]`;
            }
          } catch (error) {
            logService.log('error', `Failed to get WebSocket token for KuCoin`, error, 'ExchangeService');
            return;
          }
          break;
        default:
          // Try to get WebSocket URL from CCXT
          if (exchange.urls && exchange.urls.ws) {
            wsUrl = exchange.urls.ws;
          } else {
            logService.log('warn', `No WebSocket URL found for exchange ${exchangeId}`, null, 'ExchangeService');
            return;
          }
      }

      if (!wsUrl) {
        logService.log('warn', `Cannot initialize WebSocket for exchange ${exchangeId}: No WebSocket URL`, null, 'ExchangeService');
        return;
      }

      // Create WebSocket connection
      const connectionId = exchangeServiceWebSocket.createWebSocketConnection(exchangeId, {
        url: wsUrl,
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000
      });

      // Store the connection ID
      this.websocketConnections.set(exchangeId, connectionId);

      logService.log('info', `Initialized WebSocket connection for exchange ${exchangeId}`, {
        connectionId,
        url: wsUrl
      }, 'ExchangeService');

      // Subscribe to market data for common pairs
      await this.subscribeToCommonPairs(exchangeId, connectionId);
    } catch (error) {
      logService.log('error', `Failed to initialize WebSocket for exchange ${exchangeId}`, error, 'ExchangeService');
    }
  }

  /**
   * Subscribe to market data for common trading pairs
   * @param exchangeId Exchange ID
   * @param connectionId WebSocket connection ID
   */
  private async subscribeToCommonPairs(exchangeId: string, connectionId: string): Promise<void> {
    try {
      // Import the WebSocket service dynamically to avoid circular dependencies
      const { exchangeServiceWebSocket } = await import('./exchange-service-websocket');

      // Common trading pairs to subscribe to
      const commonPairs = [
        'BTC/USDT',
        'ETH/USDT',
        'SOL/USDT',
        'BNB/USDT',
        'XRP/USDT'
      ];

      // Initialize subscriptions set if it doesn't exist
      if (!this.marketDataSubscriptions.has(connectionId)) {
        this.marketDataSubscriptions.set(connectionId, new Set());
      }

      // Get the subscriptions set
      const subscriptions = this.marketDataSubscriptions.get(connectionId)!;

      // Subscribe to ticker data for each pair
      for (const pair of commonPairs) {
        try {
          // Format the subscription message based on the exchange
          let subscriptionMessage: any;

          switch (exchangeId) {
            case 'binance':
              // Binance uses lowercase symbols with no slashes
              const binanceSymbol = pair.replace('/', '').toLowerCase();
              subscriptionMessage = {
                method: 'SUBSCRIBE',
                params: [`${binanceSymbol}@ticker`],
                id: Date.now()
              };
              break;
            case 'bitmart':
              // BitMart uses a different format
              const bitmartSymbol = pair.replace('/', '-');
              subscriptionMessage = {
                op: 'subscribe',
                args: [`spot/ticker:${bitmartSymbol}`]
              };
              break;
            case 'kucoin':
              // KuCoin uses a different format
              const kucoinSymbol = pair.replace('/', '-');
              subscriptionMessage = {
                type: 'subscribe',
                topic: `/market/ticker:${kucoinSymbol}`,
                privateChannel: false,
                response: true
              };
              break;
            default:
              // Generic format
              subscriptionMessage = {
                type: 'subscribe',
                channel: 'ticker',
                symbol: pair
              };
          }

          // Subscribe to the ticker
          const subscriptionId = exchangeServiceWebSocket.subscribeToMarketData(
            connectionId,
            pair,
            'ticker',
            subscriptionMessage
          );

          // Add to subscriptions set
          subscriptions.add(subscriptionId);

          logService.log('info', `Subscribed to ticker for ${pair} on ${exchangeId}`, {
            connectionId,
            subscriptionId
          }, 'ExchangeService');
        } catch (error) {
          logService.log('error', `Failed to subscribe to ticker for ${pair} on ${exchangeId}`, error, 'ExchangeService');
        }
      }
    } catch (error) {
      logService.log('error', `Failed to subscribe to common pairs for ${exchangeId}`, error, 'ExchangeService');
    }
  }

  /**
   * Close a WebSocket connection for a specific exchange
   * @param exchangeId Exchange ID
   */
  private closeExchangeWebSocket(exchangeId: string): void {
    const connectionId = this.websocketConnections.get(exchangeId);
    if (connectionId) {
      // Close the WebSocket connection
      websocketManager.close(connectionId);

      // Remove from connections map
      this.websocketConnections.delete(exchangeId);

      // Remove subscriptions
      this.marketDataSubscriptions.delete(connectionId);

      logService.log('info', `Closed WebSocket connection for exchange ${exchangeId}`, null, 'ExchangeService');
    }
  }

  /**
   * Close all WebSocket connections
   */
  private closeAllWebSockets(): void {
    for (const [exchangeId, connectionId] of this.websocketConnections.entries()) {
      websocketManager.close(connectionId);
      logService.log('info', `Closed WebSocket connection for exchange ${exchangeId}`, null, 'ExchangeService');
    }

    // Clear connections and subscriptions
    this.websocketConnections.clear();
    this.marketDataSubscriptions.clear();

    // Clear the health check interval
    if (this._websocketHealthCheckInterval) {
      clearInterval(this._websocketHealthCheckInterval);
      this._websocketHealthCheckInterval = null;
    }
  }

  /**
   * Handle a WebSocket message
   * @param connectionId WebSocket connection ID
   * @param message Message received
   */
  private async handleWebSocketMessage(connectionId: string, message: any): Promise<void> {
    try {
      // Import the WebSocket service dynamically to avoid circular dependencies
      const { exchangeServiceWebSocket } = await import('./exchange-service-websocket');

      // Let the WebSocket service handle the message
      exchangeServiceWebSocket.handleWebSocketMessage(connectionId, message);
    } catch (error) {
      logService.log('error', `Failed to handle WebSocket message`, error, 'ExchangeService');
    }
  }

  /**
   * Resubscribe to market data after a WebSocket reconnection
   * @param connectionId WebSocket connection ID
   * @param exchangeId Exchange ID
   */
  private async resubscribeToMarketData(connectionId: string, exchangeId: string): Promise<void> {
    try {
      // Subscribe to common pairs again
      await this.subscribeToCommonPairs(exchangeId, connectionId);
    } catch (error) {
      logService.log('error', `Failed to resubscribe to market data for ${exchangeId}`, error, 'ExchangeService');
    }
  }

  /**
   * Set an exchange as the default exchange
   * @param exchangeId ID of the exchange to set as default
   */
  async setDefaultExchange(exchangeId: string): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      // First, clear the default flag from all exchanges
      await supabase
        .from('user_exchanges')
        .update({ is_default: false })
        .eq('user_id', user.user.id);

      // Then set the default flag for the specified exchange
      const { error } = await supabase
        .from('user_exchanges')
        .update({ is_default: true })
        .eq('user_id', user.user.id)
        .eq('id', exchangeId);

      if (error) {
        throw error;
      }

      // Also update the user profile with the default exchange ID
      await supabase
        .from('user_profiles')
        .update({ default_exchange_id: exchangeId })
        .eq('user_id', user.user.id);

      logService.log('info', `Set ${exchangeId} as default exchange`, null, 'ExchangeService');
    } catch (error) {
      logService.log('error', `Failed to set ${exchangeId} as default exchange`, error, 'ExchangeService');
      // Don't throw the error, just log it
    }
  }

  async disconnect(): Promise<void> {
    this.activeExchange = null;
    localStorage.removeItem('activeExchange');

    // Update user profile
    await userProfileService.saveActiveExchange(null);
    await userProfileService.updateConnectionStatus('disconnected');

    // Close any WebSocket connections
    this.closeAllWebSockets();

    // Emit event for UI updates
    this.emit('exchange:disconnected');
    eventBus.emit('exchange:disconnected');
  }



  async testConnection(config: ExchangeConfig): Promise<void> {
    try {
      // If in demo mode, always return success
      if (demoService.isInDemoMode()) {
        logService.log('info', 'Demo mode active, skipping real connection test', null, 'ExchangeService');
        return;
      }

      // Log the connection test attempt
      logService.log('info', `Testing connection to ${config.name}`, {
        testnet: config.testnet,
        hasApiKey: !!config.apiKey,
        hasSecret: !!config.secret
      }, 'ExchangeService');

      // Set a longer timeout for Kraken
      const timeoutDuration = config.name.toLowerCase() === 'kraken' ? 30000 : 15000;

      // Set a timeout for the connection test
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Connection test timed out for ${config.name}`));
        }, timeoutDuration);
      });

      // Create exchange instance with proper configuration
      const connectionPromise = ccxtService.createExchange(
        config.name as ExchangeId,
        {
          apiKey: config.apiKey,
          secret: config.secret,
          memo: config.memo
        },
        config.testnet // Pass testnet flag to ensure proper endpoint usage
      );

      // Race the connection promise against the timeout
      const testInstance = await Promise.race([connectionPromise, timeoutPromise]);

      // Proxy configuration is now handled in ccxt-service.ts
      logService.log('info', 'Using proxy configuration from ccxt-service.ts', null, 'ExchangeService');

      // Increase timeout for API calls - use longer timeout for Kraken
      testInstance.timeout = config.name.toLowerCase() === 'kraken' ? 60000 : 30000;

      // Special handling for Kraken
      if (config.name.toLowerCase() === 'kraken') {
        logService.log('info', 'Using special handling for Kraken connection test', null, 'ExchangeService');

        // For Kraken, try a simpler API call first (Time API) which doesn't require authentication
        try {
          logService.log('info', 'Testing Kraken connection with Time API', null, 'ExchangeService');
          const timeResponse = await testInstance.fetchTime();
          logService.log('info', 'Successfully connected to Kraken Time API', { timeResponse }, 'ExchangeService');

          // Now try a simple authenticated call
          try {
            logService.log('info', 'Testing Kraken authenticated API', null, 'ExchangeService');
            // Try to get account balance which requires authentication
            await testInstance.fetchBalance();
            logService.log('info', 'Successfully authenticated with Kraken', null, 'ExchangeService');

            // If we get here, both tests passed
            logService.log('info', 'Kraken connection test successful', null, 'ExchangeService');
            return;
          } catch (authError) {
            // If authentication fails but basic connection works, it's likely an API key issue
            logService.log('error', 'Kraken authentication failed', authError, 'ExchangeService');
            throw new Error(`Kraken authentication failed. Please check your API key and secret: ${authError instanceof Error ? authError.message : 'Unknown error'}`);
          }
        } catch (timeError) {
          // If even the Time API fails, it's likely a connection issue
          logService.log('error', 'Failed to connect to Kraken Time API', timeError, 'ExchangeService');
          throw new Error(`Failed to connect to Kraken. Please check your internet connection: ${timeError instanceof Error ? timeError.message : 'Unknown error'}`);
        }
      }

      // For other exchanges, use the standard test procedure
      // Test basic API functionality with better error handling and retry logic
      let retries = config.name.toLowerCase() === 'kraken' ? 5 : 3;
      let marketsLoaded = false;

      while (retries > 0 && !marketsLoaded) {
        try {
          await testInstance.loadMarkets();
          marketsLoaded = true;
          logService.log('info', 'Successfully loaded markets', null, 'ExchangeService');
        } catch (marketError) {
          retries--;
          if (retries === 0) {
            logService.log('error', 'Failed to load markets after multiple attempts', marketError, 'ExchangeService');
            throw new Error(`Failed to load markets: ${marketError instanceof Error ? marketError.message : 'Unknown error'}`);
          }
          logService.log('warn', `Failed to load markets, retrying (${retries} attempts left)`, marketError, 'ExchangeService');
          // Wait longer between retries for Kraken
          const retryDelay = config.name.toLowerCase() === 'kraken' ? 2000 : 1000;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      // Try to fetch balance with retry logic
      retries = config.name.toLowerCase() === 'kraken' ? 5 : 3;
      let balanceLoaded = false;

      while (retries > 0 && !balanceLoaded) {
        try {
          await testInstance.fetchBalance();
          balanceLoaded = true;
          logService.log('info', 'Successfully fetched balance', null, 'ExchangeService');
        } catch (balanceError) {
          retries--;
          if (retries === 0) {
            // If balance fetch fails, it might be due to API permissions
            logService.log('error', 'Failed to fetch balance after multiple attempts', balanceError, 'ExchangeService');
            throw new Error(`Failed to fetch balance. Please ensure your API key has 'Read' permissions: ${balanceError instanceof Error ? balanceError.message : 'Unknown error'}`);
          }
          logService.log('warn', `Failed to fetch balance, retrying (${retries} attempts left)`, balanceError, 'ExchangeService');
          // Wait longer between retries for Kraken
          const retryDelay = config.name.toLowerCase() === 'kraken' ? 2000 : 1000;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      // Skip additional checks if we've made it this far
      logService.log('info', 'Exchange connection test successful', null, 'ExchangeService');

    } catch (error) {
      // Handle network errors specifically
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log detailed information about the error
      logService.log('error', 'Exchange connection test failed', {
        error,
        errorMessage,
        exchangeName: config.name,
        testnet: config.testnet,
        hasApiKey: !!config.apiKey,
        hasSecret: !!config.secret,
        apiKeyLength: config.apiKey ? config.apiKey.length : 0,
        secretLength: config.secret ? config.secret.length : 0
      }, 'ExchangeService');

      console.error('Exchange connection test failed:', {
        error,
        errorMessage,
        exchangeName: config.name,
        testnet: config.testnet,
        hasApiKey: !!config.apiKey,
        hasSecret: !!config.secret
      });

      // Special handling for Kraken errors
      if (config.name.toLowerCase() === 'kraken') {
        if (errorMessage.includes('EAPI:Invalid nonce')) {
          throw new Error(`Kraken API error: Invalid nonce. This usually happens when requests are made too quickly. Please try again in a few seconds.`);
        }

        if (errorMessage.includes('EGeneral:Invalid arguments')) {
          throw new Error(`Kraken API error: Invalid arguments. Please check your API key and secret.`);
        }

        if (errorMessage.includes('EService:Unavailable')) {
          throw new Error(`Kraken service is currently unavailable. Please try again later.`);
        }
      }

      // Check for common error patterns and provide more helpful messages
      if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ECONNREFUSED')) {
        throw new Error(`Connection timed out. Please check your internet connection and try again.`);
      }

      if (networkErrorHandler.isNetworkError(error)) {
        // Let the network error handler handle this error
        const formattedError = new Error(networkErrorHandler.formatNetworkErrorMessage(error instanceof Error ? error : new Error(errorMessage)));
        networkErrorHandler.handleError(formattedError, 'ExchangeService.testConnection');
        throw formattedError;
      }

      if (errorMessage.includes('Invalid API-key') || errorMessage.includes('API-key format invalid') ||
          errorMessage.includes('Invalid API Key') || errorMessage.includes('apikey') ||
          errorMessage.includes('API key') || errorMessage.includes('signature')) {
        throw new Error(`Invalid API key or secret. Please double-check your credentials.`);
      }

      if (errorMessage.includes('permission') || errorMessage.includes('permissions') ||
          errorMessage.includes('access denied') || errorMessage.includes('not authorized')) {
        throw new Error(`Your API key doesn't have the required permissions. Please ensure it has 'Read' access at minimum.`);
      }

      if (errorMessage.includes('IP') || errorMessage.includes('ip address') ||
          errorMessage.includes('whitelist') || errorMessage.includes('restricted')) {
        throw new Error(`IP address not whitelisted. Please add your current IP address to the API key's whitelist in your exchange settings.`);
      }
      throw new Error(`Connection test failed: ${errorMessage}`);
    }
  }

  async addExchange(config: ExchangeConfig): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      // Check if exchange already exists
      const { data: existingExchanges, error: fetchError } = await supabase
        .from('user_exchanges')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('name', config.name.toLowerCase());

      if (fetchError) {
        throw new Error(`Failed to check for existing exchange: ${fetchError.message}`);
      }

      if (existingExchanges && existingExchanges.length > 0) {
        throw new Error(`Exchange ${config.name} already exists`);
      }

      // Check if this is the first exchange for the user
      const { data: allExchanges, error: countError } = await supabase
        .from('user_exchanges')
        .select('id')
        .eq('user_id', user.user.id);

      if (countError) {
        throw new Error(`Failed to count user exchanges: ${countError.message}`);
      }

      // If this is the first exchange, set it as default
      const isDefault = !allExchanges || allExchanges.length === 0;

      // Encrypt credentials
      const encryptedCredentials = this.encryptCredentials({
        apiKey: config.apiKey,
        secret: config.secret,
        memo: config.memo
      });

      // Add new exchange
      const { error } = await supabase
        .from('user_exchanges')
        .insert({
          user_id: user.user.id,
          name: config.name.toLowerCase(),
          encrypted_credentials: encryptedCredentials,
          memo: config.memo || '',
          testnet: config.testnet || false,
          use_usdx: config.useUSDX || false,
          is_default: isDefault,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to add exchange: ${error.message}`);
      }

      // Initialize exchange instance
      const ccxtInstance = await ccxtService.createExchange(
        config.name.toLowerCase() as ExchangeId,
        {
          apiKey: config.apiKey,
          secret: config.secret,
          memo: config.memo
        },
        config.testnet
      );

      this.exchangeInstances.set(config.name.toLowerCase(), ccxtInstance);

      logService.log('info', `Added exchange ${config.name}`, { isDefault }, 'ExchangeService');
      this.emit('exchange:added', config.name.toLowerCase());
      eventBus.emit('exchange:added', { name: config.name.toLowerCase(), isDefault });

    } catch (error) {
      logService.log('error', 'Failed to add exchange', error, 'ExchangeService');
      throw error;
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

  async updateExchange(exchangeId: string, config: ExchangeConfig): Promise<void> {
    try {
      // Get the current exchange data
      const { data: exchange, error: fetchError } = await supabase
        .from('user_exchanges')
        .select('*')
        .eq('id', exchangeId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch exchange: ${fetchError.message}`);
      }

      if (!exchange) {
        throw new Error(`Exchange not found`);
      }

      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      // Only update credentials if provided
      if (config.apiKey && config.secret) {
        const encryptedCredentials = this.encryptCredentials({
          apiKey: config.apiKey,
          secret: config.secret,
          memo: config.memo
        });
        updateData.encrypted_credentials = encryptedCredentials;
      }

      // Update other fields if provided
      if (config.testnet !== undefined) {
        updateData.testnet = config.testnet;
      }

      if (config.useUSDX !== undefined) {
        updateData.use_usdx = config.useUSDX;
      }

      if (config.memo !== undefined) {
        updateData.memo = config.memo;
      }

      // Update the exchange in the database
      const { error } = await supabase
        .from('user_exchanges')
        .update(updateData)
        .eq('id', exchangeId);

      if (error) throw error;

      // Get the exchange name from the database or config
      const exchangeName = exchange.name || config.name.toLowerCase();

      // Update the exchange instance if it exists and credentials were updated
      if (config.apiKey && config.secret && this.exchangeInstances.has(exchangeName)) {
        // Create a new instance with updated credentials
        const ccxtInstance = await ccxtService.createExchange(
          exchangeName as ExchangeId,
          {
            apiKey: config.apiKey,
            secret: config.secret,
            memo: config.memo
          },
          config.testnet !== undefined ? config.testnet : exchange.testnet
        );

        this.exchangeInstances.set(exchangeName, ccxtInstance);
      }

      // If this is the active exchange, update it
      if (this.activeExchange && this.activeExchange.id === exchangeName) {
        // Only update the fields that were provided
        const updatedExchange = { ...this.activeExchange };

        if (config.apiKey && config.secret) {
          updatedExchange.credentials = {
            apiKey: config.apiKey,
            secret: config.secret,
            memo: config.memo || updatedExchange.credentials?.memo || ''
          };
        }

        if (config.testnet !== undefined) {
          updatedExchange.testnet = config.testnet;
        }

        this.activeExchange = updatedExchange;
        localStorage.setItem('activeExchange', JSON.stringify(updatedExchange));
      }

      logService.log('info', `Updated exchange ${exchangeName}`, null, 'ExchangeService');
      this.emit('exchange:updated', exchangeName);
      eventBus.emit('exchange:updated', { name: exchangeName, id: exchangeId });

    } catch (error) {
      logService.log('error', 'Failed to update exchange', error, 'ExchangeService');
      throw error;
    }
  }

  async removeExchange(exchangeId: string): Promise<void> {
    try {
      // Get the exchange data before removing it
      const { data: exchange, error: fetchError } = await supabase
        .from('user_exchanges')
        .select('*')
        .eq('id', exchangeId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch exchange: ${fetchError.message}`);
      }

      if (!exchange) {
        throw new Error(`Exchange not found`);
      }

      // Check if this is the default exchange
      const isDefault = exchange.is_default;

      // Remove the exchange
      const { error } = await supabase
        .from('user_exchanges')
        .delete()
        .eq('id', exchangeId);

      if (error) throw error;

      // If this is the active exchange, disconnect
      if (this.activeExchange?.id === exchange.name) {
        await this.disconnect();
      }

      // Remove the exchange instance
      this.exchangeInstances.delete(exchange.name);

      // If this was the default exchange, set a new default
      if (isDefault) {
        // Get all remaining exchanges
        const { data: remainingExchanges, error: listError } = await supabase
          .from('user_exchanges')
          .select('id')
          .order('created_at', { ascending: true });

        if (!listError && remainingExchanges && remainingExchanges.length > 0) {
          // Set the oldest exchange as the new default
          const newDefaultId = remainingExchanges[0].id;
          await supabase
            .from('user_exchanges')
            .update({ is_default: true, updated_at: new Date().toISOString() })
            .eq('id', newDefaultId);

          logService.log('info', `Set new default exchange: ${newDefaultId}`, null, 'ExchangeService');
        }
      }

      logService.log('info', `Removed exchange ${exchange.name}`, { id: exchangeId }, 'ExchangeService');
      this.emit('exchange:removed', exchangeId);
      eventBus.emit('exchange:removed', { id: exchangeId, name: exchange.name });
    } catch (error) {
      logService.log('error', 'Failed to remove exchange', error, 'ExchangeService');
      throw error;
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
      used: parseFloat(ccxtBalance.used.USDT || 0),
      currency: 'USDT' // Default to USDT
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

  /**
   * Get the list of supported exchanges
   * @returns Array of supported exchange names
   */
  async getSupportedExchanges(): Promise<string[]> {
    try {
      // Return a list of supported exchanges
      return [
        'Binance',
        'Bybit',
        'OKX',
        'BitMart',
        'Bitget',
        'Coinbase',
        'Kraken'
      ];
    } catch (error) {
      logService.log('error', 'Failed to get supported exchanges', error, 'ExchangeService');
      return [];
    }
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
        logService.log('info', 'Initializing exchange', {
          exchangeName: config.name,
          testnet: config.testnet,
          hasApiKey: !!config.apiKey,
          hasSecret: !!config.secret
        }, 'ExchangeService');

        // Save the exchange configuration to localStorage for persistence
        this.saveExchangeConfig(config);

        if (config.testnet) {
          this.demoMode = true;
          await this.initializeDemoExchange(config);

          // Also initialize the futures exchange in demo mode
          try {
            await this.initializeFuturesExchange(config);
          } catch (futuresError) {
            logService.log('warn', 'Failed to initialize futures exchange, continuing with spot only', futuresError, 'ExchangeService');
            console.warn('Failed to initialize futures exchange, continuing with spot only:', futuresError);
          }
        } else {
          // User's own exchange
          this.demoMode = false;
          logService.log('info', `Initializing user exchange: ${config.name}`, null, 'ExchangeService');
          console.log(`Initializing user exchange: ${config.name}`);

          try {
            // Create the exchange instance with the user's credentials
            const exchange = await ccxtService.createExchange(
              config.name as ExchangeId,
              {
                apiKey: config.apiKey,
                secret: config.secret,
                memo: config.memo
              },
              config.testnet
            );

            // Test the connection by loading markets
            logService.log('info', 'Testing connection by loading markets', null, 'ExchangeService');
            await exchange.loadMarkets();
            logService.log('info', 'Successfully loaded markets', null, 'ExchangeService');

            // Store the exchange instance
            this.exchangeInstances.set(config.name, exchange);

            // Try to fetch balance to verify API key permissions
            try {
              logService.log('info', 'Testing API key permissions by fetching balance', null, 'ExchangeService');
              await exchange.fetchBalance();
              logService.log('info', 'Successfully fetched balance', null, 'ExchangeService');
            } catch (balanceError) {
              logService.log('warn', 'Could not fetch balance, API key may have limited permissions', balanceError, 'ExchangeService');
              console.warn('Could not fetch balance, API key may have limited permissions:', balanceError);
              // Continue anyway, as read-only API keys are still useful
            }
          } catch (error) {
            logService.log('error', `Failed to initialize ${config.name} exchange`, error, 'ExchangeService');
            console.error(`Failed to initialize ${config.name} exchange:`, error);
            throw new Error(`Failed to connect to ${config.name}. Please check your API credentials and try again.`);
          }
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

        // Store the active exchange in localStorage
        localStorage.setItem('activeExchange', JSON.stringify({
          id: config.name,
          testnet: config.testnet
        }));

        this.emit('exchange:initialized');
        logService.log('info', `Exchange ${config.name} initialized`, null, 'ExchangeService');
      } catch (error) {
        logService.log('error', 'Failed to initialize exchange', error, 'ExchangeService');
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  // Helper method to save exchange configuration
  private saveExchangeConfig(config: ExchangeConfig): void {
    try {
      // Get existing configurations
      const existingConfigsStr = localStorage.getItem('exchangeConfigs');
      const existingConfigs = existingConfigsStr ? JSON.parse(existingConfigsStr) : {};

      // Update or add the new configuration
      existingConfigs[config.name] = {
        name: config.name,
        testnet: config.testnet,
        memo: config.memo,
        // Don't store actual API keys in localStorage for security
        hasApiKey: !!config.apiKey,
        hasSecret: !!config.secret
      };

      // Save back to localStorage
      localStorage.setItem('exchangeConfigs', JSON.stringify(existingConfigs));

      logService.log('info', `Saved exchange configuration for ${config.name}`, null, 'ExchangeService');
    } catch (error) {
      logService.log('error', 'Failed to save exchange configuration', error, 'ExchangeService');
      console.error('Failed to save exchange configuration:', error);
    }
  }

  private async initializeFuturesExchange(_config: ExchangeConfig): Promise<void> {
    try {
      // Get API keys from environment variables
      const apiKey = import.meta.env.VITE_BINANCE_FUTURES_TESTNET_API_KEY || process.env.BINANCE_FUTURES_TESTNET_API_KEY || '';
      const apiSecret = import.meta.env.VITE_BINANCE_FUTURES_TESTNET_API_SECRET || process.env.BINANCE_FUTURES_TESTNET_API_SECRET || '';

      if (!apiKey || !apiSecret) {
        // This is expected in many cases, so we'll just log it as info
        logService.log('info', 'Futures trading not configured - missing Binance Futures TestNet API credentials', null, 'ExchangeService');
        // Don't show console warning as this is expected for many users
        return; // Exit early if credentials are missing
      }

      // Create a new CCXT exchange instance for Binance Futures
      // Pass 'future' as the marketType parameter to use the correct TestNet URL
      const futuresExchange = await ccxtService.createExchange(
        'binance',
        {
          apiKey: apiKey,
          secret: apiSecret,
        },
        true,
        'future' // Specify that this is for futures trading
      );

      // No need to manually set defaultType as it's now set in ccxtService.createExchange

      // Log the configuration
      console.log('Using Binance Futures TestNet with proper configuration');

      // Store the exchange instance
      this.exchangeInstances.set('binanceFutures', futuresExchange);

      logService.log('info', 'Successfully initialized Binance Futures TestNet exchange', null, 'ExchangeService');
      console.log('Successfully initialized Binance Futures TestNet exchange');
    } catch (error) {
      logService.log('error', 'Failed to initialize Binance Futures TestNet exchange', error, 'ExchangeService');
      console.error('Failed to initialize Binance Futures TestNet exchange:', error);
      // Don't throw the error, just log it and continue
      // This allows the application to work even if futures initialization fails
    }
  }

  private async initializeDemoExchange(_config: ExchangeConfig): Promise<void> {
    try {
      // Get API keys from environment variables, trying both VITE_ prefixed and non-prefixed versions
      const apiKey = import.meta.env.VITE_BINANCE_TESTNET_API_KEY || process.env.BINANCE_TESTNET_API_KEY || '';
      const apiSecret = import.meta.env.VITE_BINANCE_TESTNET_API_SECRET || process.env.BINANCE_TESTNET_API_SECRET || '';

      console.log('Environment variables:', {
        VITE_BINANCE_TESTNET_API_KEY: import.meta.env.VITE_BINANCE_TESTNET_API_KEY ? 'present' : 'missing',
        VITE_BINANCE_TESTNET_API_SECRET: import.meta.env.VITE_BINANCE_TESTNET_API_SECRET ? 'present' : 'missing',
      });

      if (!apiKey || !apiSecret) {
        logService.log('warn', 'Missing Binance TestNet API credentials', null, 'ExchangeService');
        console.warn('Missing Binance TestNet API credentials. Please check your .env file.');
        // Continue anyway with empty strings, which will result in mock data being used
      }

      console.log('Initializing Binance TestNet exchange');
      logService.log('info', 'Initializing Binance TestNet exchange',
        { hasApiKey: !!apiKey, hasApiSecret: !!apiSecret }, 'ExchangeService');

      // First, try to ping the Binance TestNet API through our proxy to verify connectivity
      try {
        const proxyUrl = `${config.getFullUrl(config.binanceTestnetApiUrl)}/api/v3/ping`;
        console.log(`Testing connection to Binance TestNet via proxy: ${proxyUrl}`);

        // Add a timeout to the fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout (increased)

        try {
          // Use no-cors mode to avoid CORS issues during the ping test
          const response = await fetch(proxyUrl, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`Failed to ping Binance TestNet API: ${response.status} ${response.statusText}`);
          }

          console.log('Successfully pinged Binance TestNet API through proxy');
        } catch (error) {
          clearTimeout(timeoutId);
          const fetchError = error as Error;
          if (fetchError && fetchError.name === 'AbortError') {
            throw new Error('Connection to Binance TestNet API timed out');
          }
          console.warn('Fetch error during ping test:', fetchError);
          // Don't throw here, just log and continue
        }
      } catch (pingError) {
        console.error('Error pinging Binance TestNet API:', pingError);
        logService.log('error', 'Failed to ping Binance TestNet API', pingError, 'ExchangeService');
        console.warn('Continuing with CCXT initialization despite ping failure');
        // Continue anyway, as CCXT might still work
      }

      // Log the API credentials (without showing the actual values)
      console.log('Binance TestNet API credentials:', {
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        apiKeyLength: apiKey ? apiKey.length : 0,
        secretLength: apiSecret ? apiSecret.length : 0
      });

      const testnetExchange = await ccxtService.createExchange(
        'binance',
        {
          apiKey: apiKey,
          secret: apiSecret,
        },
        true,
        'spot' // Specify that this is for spot trading
      );

      this.exchangeInstances.set('binance', testnetExchange);

      console.log('Loading markets from Binance TestNet...');
      try {
        // Try to load markets, but if it fails, use mock data
        await testnetExchange.loadMarkets();
        console.log('Successfully loaded markets from Binance TestNet');
      } catch (marketError) {
        console.warn('Failed to load markets from Binance TestNet, using mock data:', marketError);
        logService.log('warn', 'Failed to load markets from Binance TestNet, using mock data', marketError, 'ExchangeService');

        // Create mock markets data
        testnetExchange.markets = this.createMockMarkets();
        testnetExchange.marketsById = {};
        Object.values(testnetExchange.markets).forEach((market: any) => {
          testnetExchange.marketsById[market.id] = market;
        });

        console.log('Successfully created mock markets data');
      }

      this.activeExchange = {
        id: 'binance',
        credentials: {
          apiKey: apiKey,
          secret: apiSecret,
        }
      };

      logService.log('info', 'Successfully initialized Binance TestNet exchange', null, 'ExchangeService');
      console.log('Successfully initialized Binance TestNet exchange');
    } catch (error) {
      logService.log('error', 'Failed to initialize testnet exchange', error, 'ExchangeService');
      console.error('Failed to initialize Binance TestNet exchange:', error);

      // Provide more detailed error information
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }

        // Try to provide a more helpful error message
        if (error.message.includes('ECONNREFUSED')) {
          console.error('Connection refused. Make sure the proxy server is running on port 3004.');
        } else if (error.message.includes('NetworkError')) {
          console.error('Network error. Check your internet connection and proxy configuration.');
        }
      }

      throw error;
    }
  }

  isDemo(): boolean {
    return this.demoMode;
  }

  /**
   * Check if the service is in live mode (opposite of demo mode)
   */
  isLive(): boolean {
    return !this.demoMode;
  }

  /**
   * Clean up resources when the service is no longer needed
   * This should be called when the application is shutting down
   */
  cleanup(): void {
    // Close all WebSocket connections
    this.closeAllWebSockets();

    // Clear any cached data
    cacheService.clearNamespace(this.CACHE_NAMESPACE);
    cacheService.clearNamespace(this.MARKET_DATA_CACHE_NAMESPACE);

    // Clear exchange instances
    this.exchangeInstances.clear();

    // Clear active orders
    this.activeOrders.clear();

    // Clear logged order errors
    this.loggedOrderErrors.clear();

    logService.log('info', 'Exchange service cleaned up', null, 'ExchangeService');
  }

  /**
   * Switch between demo and live mode
   * @param isLive Whether to switch to live mode (true) or demo mode (false)
   */
  async switchMode(isLive: boolean): Promise<void> {
    try {
      // If we're already in the requested mode, do nothing
      if (isLive === !this.demoMode) {
        logService.log('info', `Already in ${isLive ? 'live' : 'demo'} mode`, null, 'ExchangeService');
        return;
      }

      logService.log('info', `Switching to ${isLive ? 'live' : 'demo'} mode`, null, 'ExchangeService');

      // Update the demo mode flag
      this.demoMode = !isLive;

      // Update other services that need to know about the mode
      const { tradeService } = await import('./trade-service');
      tradeService.setDemoMode(!isLive);

      const { budgetValidationService } = await import('./budget-validation-service');
      budgetValidationService.setDemoMode(!isLive);

      const { budgetHistoryService } = await import('./budget-history-service');
      budgetHistoryService.setDemoMode(!isLive);

      // If switching to demo mode, initialize the demo exchange
      if (!isLive) {
        // Create a demo exchange config
        const demoConfig = {
          name: 'binance',
          apiKey: 'demo-api-key',
          secret: 'demo-secret',
          testnet: true
        };

        // Initialize the demo exchange
        await this.initializeDemoExchange(demoConfig);

        // Create a demo exchange instance
        const demoExchange = {
          id: 'demo-exchange',
          name: 'Demo Exchange',
          credentials: {
            apiKey: 'demo-api-key',
            secret: 'demo-secret'
          },
          testnet: true
        };

        // Set as active exchange
        this.activeExchange = demoExchange as Exchange;
        localStorage.setItem('activeExchange', JSON.stringify(demoExchange));

        // Also save to user profile for cross-device persistence
        await userProfileService.saveActiveExchange(demoExchange);
        await userProfileService.updateConnectionStatus('connected');
      } else {
        // If switching to live mode, try to connect to the user's exchange
        const userExchanges = await this.getUserExchanges();

        if (userExchanges.length === 0) {
          throw new Error('No exchanges configured. Please add an exchange in the Wallet Manager.');
        }

        // First try to get the previously used live exchange from user profile
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('active_exchange')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        let exchangeToUse = null;

        // If we have a previously used live exchange in the profile and it's not a demo exchange
        if (userProfile?.active_exchange &&
            userProfile.active_exchange.id !== 'demo-exchange' &&
            !userProfile.active_exchange.testnet) {

          // Find this exchange in the user's exchanges
          const savedExchange = userExchanges.find(e => e.id === userProfile.active_exchange.id ||
                                                       e.name === userProfile.active_exchange.id);

          if (savedExchange) {
            logService.log('info', `Using previously used live exchange: ${savedExchange.name}`, null, 'ExchangeService');
            exchangeToUse = savedExchange;
          }
        }

        // If we couldn't find a previously used live exchange, use the default or first one
        if (!exchangeToUse) {
          // Find the default exchange or use the first one
          exchangeToUse = userExchanges.find(e => e.is_default) || userExchanges[0];
          logService.log('info', `Using ${exchangeToUse.is_default ? 'default' : 'first available'} exchange: ${exchangeToUse.name}`, null, 'ExchangeService');
        }

        // Connect to the exchange
        await this.connect(exchangeToUse);
      }

      // Update the backend trading engine mode
      try {
        const response = await fetch('/api/demo-mode', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ demo_mode: !isLive }),
        });

        if (!response.ok) {
          logService.log('warn', `Failed to update backend trading engine mode: ${response.statusText}`, null, 'ExchangeService');
        } else {
          logService.log('info', `Updated backend trading engine mode to ${!isLive ? 'demo' : 'live'}`, null, 'ExchangeService');
        }
      } catch (backendError) {
        logService.log('warn', 'Failed to update backend trading engine mode', backendError, 'ExchangeService');
        // Continue anyway, as this is not critical
      }

      // Emit event for UI updates
      this.emit('exchange:modeChanged', { isLive });
      eventBus.emit('exchange:modeChanged', { isLive });

      logService.log('info', `Successfully switched to ${isLive ? 'live' : 'demo'} mode`, null, 'ExchangeService');
    } catch (error) {
      // Provide more specific error messages based on the error type
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (isLive) {
        // Live mode specific errors
        if (errorMessage.includes('No exchanges configured')) {
          logService.log('error', 'Failed to switch to live mode: No exchanges configured', error, 'ExchangeService');
          throw new Error('No exchanges configured. Please add an exchange in the Wallet Manager before switching to live mode.');
        } else if (errorMessage.includes('credentials')) {
          logService.log('error', 'Failed to switch to live mode: Invalid credentials', error, 'ExchangeService');
          throw new Error('Invalid exchange credentials. Please check your API keys in the Wallet Manager.');
        } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
          logService.log('error', 'Failed to switch to live mode: Connection timeout', error, 'ExchangeService');
          throw new Error('Connection to exchange timed out. Please check your internet connection and try again.');
        } else {
          logService.log('error', `Failed to switch to live mode: ${errorMessage}`, error, 'ExchangeService');
          throw new Error(`Failed to switch to live mode: ${errorMessage}`);
        }
      } else {
        // Demo mode specific errors
        logService.log('error', `Failed to switch to demo mode: ${errorMessage}`, error, 'ExchangeService');
        throw new Error(`Failed to switch to demo mode: ${errorMessage}`);
      }
    }
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number = 100,
    since?: number
  ): Promise<any[]> {
    try {
      // Normalize the symbol format if needed
      const normalizedSymbol = symbol.includes('_') ? symbol.replace('_', '/') : symbol;

      // Log the request details
      logService.log('info', `Fetching candles for ${normalizedSymbol}`, {
        timeframe,
        limit,
        since: since ? new Date(since).toISOString() : 'undefined'
      }, 'ExchangeService');

      // Check if we're in demo mode
      if (this.demoMode) {
        logService.log('info', 'Using demo mode for candles', { symbol: normalizedSymbol }, 'ExchangeService');
        return this.generateSyntheticCandles(normalizedSymbol, timeframe, limit, since);
      }

      if (!this.activeExchange) {
        logService.log('warn', 'No active exchange, using synthetic data', null, 'ExchangeService');
        return this.generateSyntheticCandles(normalizedSymbol, timeframe, limit, since);
      }

      const exchange = this.exchangeInstances.get(this.activeExchange.id);
      if (!exchange) {
        logService.log('warn', 'Exchange instance not found, using synthetic data', null, 'ExchangeService');
        return this.generateSyntheticCandles(normalizedSymbol, timeframe, limit, since);
      }

      if (!exchange.has['fetchOHLCV']) {
        logService.log('warn', 'Exchange does not support OHLCV data, using synthetic data', null, 'ExchangeService');
        return this.generateSyntheticCandles(normalizedSymbol, timeframe, limit, since);
      }

      try {
        // Try to fetch candles from the exchange
        const candles = await exchange.fetchOHLCV(normalizedSymbol, timeframe, since, limit);

        if (!candles || candles.length === 0) {
          logService.log('warn', `No candles returned for ${normalizedSymbol}, using synthetic data`, null, 'ExchangeService');
          return this.generateSyntheticCandles(normalizedSymbol, timeframe, limit, since);
        }

        logService.log('info', `Successfully fetched ${candles.length} candles for ${normalizedSymbol}`, null, 'ExchangeService');

        return candles.map((candle: any) => ({
          timestamp: candle[0],
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5]
        }));
      } catch (fetchError) {
        logService.log('warn', `Failed to fetch candles from exchange for ${normalizedSymbol}, using synthetic data`, fetchError, 'ExchangeService');
        return this.generateSyntheticCandles(normalizedSymbol, timeframe, limit, since);
      }
    } catch (error) {
      logService.log('error', `Failed to fetch candles for ${symbol}`, error, 'ExchangeService');
      // Instead of throwing, return synthetic data as a fallback
      return this.generateSyntheticCandles(symbol, timeframe, limit, since);
    }
  }

  /**
   * Generates synthetic candle data for testing and fallback purposes
   * @param symbol Trading pair symbol
   * @param timeframe Timeframe for candles (e.g., '1h', '1d')
   * @param limit Number of candles to generate
   * @param since Optional timestamp to start from
   * @returns Array of synthetic candles
   */
  private generateSyntheticCandles(symbol: string, timeframe: string, limit: number, since?: number): any[] {
    // Parse the timeframe to get the interval in milliseconds
    const timeframeMs = this.parseTimeframe(timeframe);

    // Start time is either the provided 'since' or 30 days ago
    const startTime = since || Date.now() - (30 * 24 * 60 * 60 * 1000);

    // Generate synthetic candles
    const candles = [];
    let currentTime = startTime;
    let price = 100; // Starting price

    // Extract base asset from symbol for price adjustment
    const baseAsset = symbol.split('/')[0];

    // Set a more realistic starting price based on the asset
    if (baseAsset === 'BTC') price = 50000;
    else if (baseAsset === 'ETH') price = 3000;
    else if (baseAsset === 'SOL') price = 100;
    else if (baseAsset === 'BNB') price = 500;
    else if (baseAsset === 'XRP') price = 0.5;

    for (let i = 0; i < limit; i++) {
      // Generate a realistic price movement
      const priceChange = (Math.random() - 0.5) * 0.02; // -1% to +1%
      price = price * (1 + priceChange);

      // Generate OHLC values with some variation
      const open = price;
      const high = price * (1 + Math.random() * 0.01); // Up to 1% higher
      const low = price * (1 - Math.random() * 0.01);  // Up to 1% lower
      const close = price * (1 + (Math.random() - 0.5) * 0.01); // -0.5% to +0.5%

      // Generate volume based on price
      const volume = price * (Math.random() * 100 + 50); // Some reasonable volume

      candles.push({
        timestamp: currentTime,
        open,
        high,
        low,
        close,
        volume
      });

      // Move to the next time interval
      currentTime += timeframeMs;
    }

    return candles;
  }

  /**
   * Parses a timeframe string into milliseconds
   * @param timeframe Timeframe string (e.g., '1h', '1d')
   * @returns Milliseconds
   */
  private parseTimeframe(timeframe: string): number {
    const amount = parseInt(timeframe.replace(/[^0-9]/g, ''));
    const unit = timeframe.replace(/[0-9]/g, '');

    switch (unit) {
      case 'm': return amount * 60 * 1000; // minutes
      case 'h': return amount * 60 * 60 * 1000; // hours
      case 'd': return amount * 24 * 60 * 60 * 1000; // days
      case 'w': return amount * 7 * 24 * 60 * 60 * 1000; // weeks
      case 'M': return amount * 30 * 24 * 60 * 60 * 1000; // months (approximate)
      default: return 60 * 60 * 1000; // default to 1 hour
    }
  }

  async fetchTicker(symbol: string): Promise<any> {
    try {
      if (!this.activeExchange) {
        // Return mock data in demo mode
        return this.createMockTicker(symbol);
      }

      const exchange = this.exchangeInstances.get(this.activeExchange.id);
      if (!exchange) {
        return this.createMockTicker(symbol);
      }

      try {
        const ticker = await exchange.fetchTicker(symbol);
        return {
          symbol: ticker.symbol,
          bid: ticker.bid,
          ask: ticker.ask,
          last: ticker.last,
          bidVolume: ticker.bidVolume || 0,
          askVolume: ticker.askVolume || 0,
          timestamp: ticker.timestamp
        };
      } catch (exchangeError) {
        logService.log('warn', `Failed to fetch ticker from exchange for ${symbol}, using mock data`, exchangeError, 'ExchangeService');
        return this.createMockTicker(symbol);
      }
    } catch (error) {
      logService.log('error', `Failed to fetch ticker for ${symbol}`, error, 'ExchangeService');
      return this.createMockTicker(symbol);
    }
  }

  private createMockTicker(symbol: string): any {
    // Create a realistic mock ticker
    const basePrice = symbol.includes('BTC') ? 50000 : symbol.includes('ETH') ? 3000 : 1;
    const now = Date.now();

    // Add some randomness to make it look realistic
    const variance = basePrice * 0.001; // 0.1% variance
    const last = basePrice + (Math.random() * variance * 2 - variance);

    return {
      symbol,
      bid: last * 0.999,
      ask: last * 1.001,
      last,
      bidVolume: 10 + Math.random() * 20,
      askVolume: 10 + Math.random() * 20,
      timestamp: now
    };
  }

  /**
   * Create a mock wallet balance with realistic values
   * @param total Total balance amount
   * @param used Amount in use
   * @returns Mock wallet balance
   */
  private createMockWalletBalance(total: number, used: number): WalletBalance {
    return {
      free: total - used,
      used,
      total
    };
  }

  // Implementation moved to line 839

  /**
   * Fetch the current market price for a symbol
   * @param symbol The trading pair symbol
   * @returns Object containing the current price
   */
  async fetchMarketPrice(symbol: string): Promise<{ symbol: string; price: number; timestamp: number }> {
    try {
      // Normalize the symbol format if needed
      const normalizedSymbol = symbol.includes('_') ? symbol.replace('_', '/') : symbol;

      // Try to get from cache first
      const cacheKey = `ticker:${normalizedSymbol}`;
      const cachedTicker = cacheService.get<any>(cacheKey, this.MARKET_DATA_CACHE_NAMESPACE);

      if (cachedTicker && cachedTicker.last) {
        logService.log('debug', `Using cached price data for ${normalizedSymbol}`, null, 'ExchangeService');
        return {
          symbol: normalizedSymbol,
          price: cachedTicker.last,
          timestamp: cachedTicker.timestamp || Date.now()
        };
      }

      // Log the request
      logService.log('info', `Fetching market price for ${normalizedSymbol}`, null, 'ExchangeService');

      // If in demo mode, return mock data
      if (this.demoMode) {
        logService.log('info', `Using mock price data for ${normalizedSymbol} (demo mode)`, null, 'ExchangeService');
        const mockTicker = this.createMockTicker(normalizedSymbol);

        // Cache the mock ticker
        cacheService.set(cacheKey, mockTicker, this.MARKET_DATA_CACHE_NAMESPACE, this.TICKER_CACHE_TTL);

        return {
          symbol: normalizedSymbol,
          price: mockTicker.last,
          timestamp: mockTicker.timestamp
        };
      }

      // Ensure we have an active exchange
      if (!this.activeExchange) {
        // Try to get the active exchange
        const exchange = await this.getActiveExchange();

        if (!exchange) {
          logService.log('warn', `No active exchange found, using mock data for ${normalizedSymbol}`, null, 'ExchangeService');
          const mockTicker = this.createMockTicker(normalizedSymbol);

          // Cache the mock ticker
          cacheService.set(cacheKey, mockTicker, this.MARKET_DATA_CACHE_NAMESPACE, this.TICKER_CACHE_TTL);

          return {
            symbol: normalizedSymbol,
            price: mockTicker.last,
            timestamp: mockTicker.timestamp
          };
        }

        // Set the active exchange
        this.activeExchange = exchange;
      }

      // Get the exchange instance for the active exchange
      const exchange = this.exchangeInstances.get(this.activeExchange.id);
      if (!exchange) {
        logService.log('warn', `Exchange instance not found for ${this.activeExchange.id}, attempting to create it`, null, 'ExchangeService');

        // Try to create the exchange instance
        try {
          const newExchange = await ccxtService.createExchange(
            this.activeExchange.id as ExchangeId,
            this.activeExchange.credentials,
            this.activeExchange.testnet
          );

          this.exchangeInstances.set(this.activeExchange.id, newExchange);

          // Use the new exchange instance
          const ticker = await newExchange.fetchTicker(normalizedSymbol);

          // Cache the ticker
          cacheService.set(cacheKey, ticker, this.MARKET_DATA_CACHE_NAMESPACE, this.TICKER_CACHE_TTL);

          return {
            symbol: normalizedSymbol,
            price: ticker.last,
            timestamp: ticker.timestamp
          };
        } catch (createError) {
          logService.log('error', `Failed to create exchange instance for ${this.activeExchange.id}`, createError, 'ExchangeService');

          // Fall back to mock data
          const mockTicker = this.createMockTicker(normalizedSymbol);

          // Cache the mock ticker
          cacheService.set(cacheKey, mockTicker, this.MARKET_DATA_CACHE_NAMESPACE, this.TICKER_CACHE_TTL);

          return {
            symbol: normalizedSymbol,
            price: mockTicker.last,
            timestamp: mockTicker.timestamp
          };
        }
      }

      // Check if we have a WebSocket connection for this exchange
      const connectionId = this.websocketConnections.get(this.activeExchange.id);
      if (connectionId && websocketManager.isConnected(connectionId)) {
        // If we have a WebSocket connection but no cached data, wait a short time
        // for the WebSocket to potentially deliver data
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check cache again
        const cachedTickerAfterWait = cacheService.get<any>(cacheKey, this.MARKET_DATA_CACHE_NAMESPACE);
        if (cachedTickerAfterWait && cachedTickerAfterWait.last) {
          logService.log('debug', `Using WebSocket data for ${normalizedSymbol}`, null, 'ExchangeService');
          return {
            symbol: normalizedSymbol,
            price: cachedTickerAfterWait.last,
            timestamp: cachedTickerAfterWait.timestamp || Date.now()
          };
        }
      }

      // Fetch the ticker from the exchange
      logService.log('info', `Fetching ticker from ${this.activeExchange.id} for ${normalizedSymbol}`, null, 'ExchangeService');
      const ticker = await exchange.fetchTicker(normalizedSymbol);

      // Cache the ticker
      cacheService.set(cacheKey, ticker, this.MARKET_DATA_CACHE_NAMESPACE, this.TICKER_CACHE_TTL);

      return {
        symbol: normalizedSymbol,
        price: ticker.last,
        timestamp: ticker.timestamp
      };
    } catch (error) {
      logService.log('error', `Failed to fetch market price for ${symbol}`, error, 'ExchangeService');

      // Return mock data as fallback
      const normalizedSymbol = symbol.includes('_') ? symbol.replace('_', '/') : symbol;
      const mockTicker = this.createMockTicker(normalizedSymbol);

      // Cache the mock ticker
      const cacheKey = `ticker:${normalizedSymbol}`;
      cacheService.set(cacheKey, mockTicker, this.MARKET_DATA_CACHE_NAMESPACE, this.TICKER_CACHE_TTL);

      return {
        symbol: normalizedSymbol,
        price: mockTicker.last,
        timestamp: mockTicker.timestamp
      };
    }
  }

  /**
   * Cancel an order on the exchange
   * @param orderId The ID of the order to cancel
   */
  async cancelOrder(orderId: string): Promise<any> {
    try {
      if (!this.activeExchange) {
        // In demo mode, just return success
        return { success: true, id: orderId };
      }

      const exchange = this.exchangeInstances.get(this.activeExchange.id);
      if (!exchange) {
        return { success: true, id: orderId };
      }

      try {
        // Try to cancel the order on the exchange
        const result = await exchange.cancelOrder(orderId);
        return result;
      } catch (exchangeError) {
        logService.log('warn', `Failed to cancel order ${orderId} on exchange, returning mock success`, exchangeError, 'ExchangeService');
        return { success: true, id: orderId };
      }
    } catch (error) {
      logService.log('error', `Failed to cancel order ${orderId}`, error, 'ExchangeService');
      // Still return success to allow the app to continue
      return { success: true, id: orderId };
    }
  }

  /**
   * Fetch the status of an order from the exchange
   * @param orderId The ID of the order to check
   */
  async fetchOrderStatus(orderId: string): Promise<any> {
    try {
      // In demo mode or no active exchange, return mock status immediately
      if (this.demoMode || !this.activeExchange) {
        return this.createMockOrderStatus(orderId);
      }

      const exchange = this.exchangeInstances.get(this.activeExchange.id);
      if (!exchange) {
        return this.createMockOrderStatus(orderId);
      }

      try {
        // Extract symbol from orderId if it's in the format "SYMBOL-TIMESTAMP-ID" or "SYMBOL/QUOTE-TIMESTAMP-ID"
        let symbol = null;
        const orderIdParts = orderId.split('-');

        if (orderIdParts.length >= 3) {
          const symbolPart = orderIdParts[0];

          // Case 1: Symbol already includes '/' (e.g., "BTC/USDT-TIMESTAMP-ID")
          if (symbolPart.includes('/')) {
            symbol = symbolPart;
          }
          // Case 2: Symbol is just the base asset with USDT (e.g., "BTCUSDT-TIMESTAMP-ID")
          else if (symbolPart.includes('USDT')) {
            const base = symbolPart.replace('USDT', '');
            symbol = `${base}/USDT`;
          }
          // Case 3: Symbol is just the base asset (e.g., "BTC-TIMESTAMP-ID")
          else {
            // Assume USDT as the quote asset
            symbol = `${symbolPart}/USDT`;
          }
        }

        // If we couldn't extract from orderId, try to get from active orders
        if (!symbol) {
          const activeOrder = this.activeOrders.get(orderId);
          if (activeOrder?.symbol) {
            symbol = activeOrder.symbol.replace('_', '/');
          }
        }

        // If we still don't have a symbol, return mock status without logging
        if (!symbol) {
          return this.createMockOrderStatus(orderId);
        }

        // Fetch the order status from the exchange with both orderId and symbol
        const order = await exchange.fetchOrder(orderId, symbol);

        // If we successfully got the order, remove it from the logged errors set
        this.loggedOrderErrors.delete(orderId);

        return {
          id: order.id,
          status: order.status,
          symbol: order.symbol,
          side: order.side,
          price: order.price,
          amount: order.amount,
          filled: order.filled,
          remaining: order.remaining,
          cost: order.cost,
          timestamp: order.timestamp,
          lastTradeTimestamp: order.lastTradeTimestamp
        };
      } catch (exchangeError) {
        // Check if this is a "not found" error, which is common and expected
        const errorMessage = exchangeError instanceof Error ? exchangeError.message : String(exchangeError);
        const isNotFoundError =
          errorMessage.includes('Not found') ||
          errorMessage.includes('does not exist') ||
          errorMessage.includes('Order not found') ||
          errorMessage.includes('code":30000');

        // Only log once per order ID to reduce noise, and only if it's not a common "not found" error
        if (!this.loggedOrderErrors.has(orderId) && !isNotFoundError) {
          logService.log('info',
            `Failed to fetch order status for ${orderId} from exchange, returning mock status`,
            exchangeError,
            'ExchangeService'
          );
          this.loggedOrderErrors.add(orderId);

          // Limit the size of the logged errors set to prevent memory leaks
          if (this.loggedOrderErrors.size > 1000) {
            // Clear the oldest entries (first 500)
            const oldEntries = Array.from(this.loggedOrderErrors).slice(0, 500);
            oldEntries.forEach(entry => this.loggedOrderErrors.delete(entry));
          }
        }
        return this.createMockOrderStatus(orderId);
      }
    } catch (error) {
      // Only log general errors once per order ID to reduce noise
      if (!this.loggedOrderErrors.has(orderId)) {
        logService.log('error', `Failed to fetch order status for ${orderId}`, error, 'ExchangeService');
        this.loggedOrderErrors.add(orderId);
      }
      return this.createMockOrderStatus(orderId);
    }
  }

  /**
   * Create mock markets data for demo mode or when the exchange is unavailable
   * @returns Object containing mock markets data
   */
  private createMockMarkets(): any {
    // Create a set of common trading pairs
    const pairs = [
      'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'ADA/USDT',
      'XRP/USDT', 'DOT/USDT', 'DOGE/USDT', 'AVAX/USDT', 'MATIC/USDT',
      'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'BCH/USDT',
      'ALGO/USDT', 'XLM/USDT', 'FIL/USDT', 'TRX/USDT', 'ETC/USDT'
    ];

    // Create mock markets object
    const markets: Record<string, any> = {};

    pairs.forEach(pair => {
      const [base, quote] = pair.split('/');
      const id = pair.replace('/', '');

      markets[pair] = {
        id,
        symbol: pair,
        base,
        quote,
        baseId: base,
        quoteId: quote,
        active: true,
        precision: {
          price: 8,
          amount: 8
        },
        limits: {
          amount: {
            min: 0.00001,
            max: 1000000
          },
          price: {
            min: 0.00000001,
            max: 1000000
          },
          cost: {
            min: 1,
            max: 1000000
          }
        },
        info: {}
      };
    });

    return markets;
  }

  /**
   * Create a mock order status for demo mode or when the exchange is unavailable
   * @param orderId The ID of the order
   */
  private createMockOrderStatus(orderId: string): any {
    // Get the order details from active orders if available
    const activeOrder = this.activeOrders.get(orderId);

    if (!activeOrder) {
      // If no active order found, create a basic mock status
      return {
        id: orderId,
        status: 'closed', // Assume closed if we can't find it
        symbol: 'UNKNOWN',
        side: 'buy',
        price: 0,
        amount: 0,
        filled: 0,
        remaining: 0,
        cost: 0,
        timestamp: Date.now(),
        lastTradeTimestamp: Date.now()
      };
    }

    // If we have the order in our active orders, use its details
    const statuses = ['pending', 'open', 'filled', 'closed'];
    const currentStatusIndex = statuses.indexOf(activeOrder.status || 'pending');
    const newStatusIndex = Math.min(currentStatusIndex + (Math.random() > 0.7 ? 1 : 0), statuses.length - 1);
    const newStatus = statuses[newStatusIndex];

    // Create a realistic mock status based on the active order
    const mockStatus = {
      id: orderId,
      status: newStatus,
      symbol: activeOrder.symbol,
      side: activeOrder.side || 'buy',
      price: activeOrder.price || 0,
      amount: activeOrder.amount || 0,
      filled: newStatus === 'filled' ? (activeOrder.amount || 0) : (activeOrder.filled || 0),
      remaining: newStatus === 'filled' ? 0 : (activeOrder.remaining || activeOrder.amount || 0),
      cost: (activeOrder.price || 0) * (activeOrder.amount || 0),
      timestamp: activeOrder.timestamp || Date.now(),
      lastTradeTimestamp: Date.now()
    };

    // Update the order in our active orders map
    this.activeOrders.set(orderId, {
      ...activeOrder,
      status: newStatus,
      lastUpdate: Date.now()
    });

    return mockStatus;
  }

  /**
   * Check the health of the exchange connection
   */
  async checkHealth(): Promise<{ ok: boolean; degraded?: boolean; message?: string }> {
    try {
      // First try a simple ping without using CCXT
      const pingResponse = await fetch(`${config.binanceTestnetApiUrl}/api/v3/ping`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!pingResponse.ok) {
        return {
          ok: false,
          message: `API ping failed with status ${pingResponse.status}`
        };
      }

      // If ping succeeds, try a more complex request
      const exchange = await ccxtService.getExchange('binance', true);
      if (!exchange) {
        return {
          ok: false,
          message: 'Failed to initialize exchange'
        };
      }

      // Use fetchTime instead of direct API calls
      const start = performance.now();
      await exchange.fetchTime();
      const responseTime = performance.now() - start;

      return {
        ok: true,
        degraded: responseTime > 1000,
        message: responseTime > 1000 ? `High latency: ${Math.round(responseTime)}ms` : undefined
      };

    } catch (error) {
      logService.log('error', 'Exchange health check failed', error, 'ExchangeService');

      // Handle specific error types
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        return {
          ok: false,
          message: 'Connection timed out'
        };
      }

      if (errorMessage.includes('ECONNREFUSED')) {
        return {
          ok: false,
          message: 'Connection refused'
        };
      }

      return {
        ok: false,
        message: 'Connection failed'
      };
    }
  }

  /**
   * Get the TestNet exchange instance
   * @param marketType The market type (spot or future)
   * @returns The TestNet exchange instance
   */
  async getTestNetExchange(marketType: 'spot' | 'future' = 'spot'): Promise<any> {
    const exchangeId = marketType === 'future' ? 'binanceFutures' : 'binance';
    return this.exchangeInstances.get(exchangeId);
  }

  /**
   * Check if the TestNet exchange is connected
   * @param marketType The market type (spot or future)
   * @returns True if TestNet is connected, false otherwise
   */
  async isTestNetConnected(marketType: 'spot' | 'future' = 'spot'): Promise<boolean> {
    try {
      const testNetExchange = await this.getTestNetExchange(marketType);
      if (!testNetExchange) return false;

      // Try to fetch markets to verify connection
      await testNetExchange.fetchMarkets();
      return true;
    } catch (error) {
      logService.log('error', `Failed to connect to ${marketType} TestNet`, error, 'ExchangeService');
      return false;
    }
  }

  /**
   * Check if the service is in demo mode
   */
  isDemoMode(): boolean {
    return this.demoMode;
  }

  /**
   * Check if the user has configured exchange credentials
   * @returns True if the user has configured exchange credentials, false otherwise
   */
  hasCredentials(): boolean {
    try {
      // If we're in demo mode, check if there are any user exchanges configured
      if (this.demoMode) {
        // We'll need to check asynchronously, but for now return true if we have an active exchange
        return !!this.activeExchange;
      }

      // If we have an active exchange with credentials, return true
      if (this.activeExchange && this.activeExchange.credentials) {
        return !!this.activeExchange.credentials.apiKey && !!this.activeExchange.credentials.secret;
      }

      // Otherwise, return false
      return false;
    } catch (error) {
      logService.log('error', 'Failed to check if user has credentials', error, 'ExchangeService');
      return false;
    }
  }

  /**
   * Get the maximum allowed leverage for a trading pair
   * @param symbol The trading pair symbol
   * @param marketType The market type (margin or futures)
   * @returns The maximum allowed leverage
   */
  async getMaxAllowedLeverage(symbol: string, marketType: 'margin' | 'futures'): Promise<number> {
    try {
      // Default values if we can't get from exchange
      const defaultMaxLeverage = marketType === 'margin' ? 3 : 20;

      // If in demo mode, return default values
      if (this.demoMode) {
        return defaultMaxLeverage;
      }

      // If no active exchange, return default values
      if (!this.activeExchange) {
        return defaultMaxLeverage;
      }

      const exchange = this.exchangeInstances.get(this.activeExchange.id);
      if (!exchange) {
        return defaultMaxLeverage;
      }

      try {
        // Normalize symbol format
        const normalizedSymbol = symbol.includes('_') ? symbol.replace('_', '/') : symbol;

        if (marketType === 'futures') {
          // For futures, try to get leverage info from the exchange
          const leverageInfo = await exchange.fetchLeverageTiers([normalizedSymbol]);
          if (leverageInfo && leverageInfo[normalizedSymbol]) {
            const tiers = leverageInfo[normalizedSymbol];
            // Get the highest tier's max leverage
            const maxLeverage = Math.max(...tiers.map(tier => tier.maxLeverage));
            return maxLeverage;
          }

          // If we couldn't get leverage tiers, try to get market info
          const markets = await exchange.fetchMarkets();
          const market = markets.find(m => m.symbol === normalizedSymbol);
          if (market && market.limits && market.limits.leverage) {
            return market.limits.leverage.max || defaultMaxLeverage;
          }
        } else if (marketType === 'margin') {
          // For margin, most exchanges have fixed leverage (3x or 5x)
          // Try to get from market info if available
          const markets = await exchange.fetchMarkets();
          const market = markets.find(m => m.symbol === normalizedSymbol);
          if (market && market.limits && market.limits.leverage) {
            return market.limits.leverage.max || 3; // Default to 3x for margin
          }
          return 3; // Most exchanges offer 3x for margin
        }

        return defaultMaxLeverage;
      } catch (exchangeError) {
        logService.log('warn', `Failed to fetch max leverage from exchange for ${symbol}, using default values`, exchangeError, 'ExchangeService');
        return defaultMaxLeverage;
      }
    } catch (error) {
      logService.log('error', `Failed to get max allowed leverage for ${symbol}`, error, 'ExchangeService');
      return marketType === 'margin' ? 3 : 20; // Default values
    }
  }

  /**
   * Get the maximum allowed margin for a user
   * @returns The maximum allowed margin percentage (0-1)
   */
  async getMaxAllowedMargin(): Promise<number> {
    try {
      // Default value if we can't get from exchange
      const defaultMaxMargin = 0.8; // 80%

      // If in demo mode, return default value
      if (this.demoMode) {
        return defaultMaxMargin;
      }

      // If no active exchange, return default value
      if (!this.activeExchange) {
        return defaultMaxMargin;
      }

      const exchange = this.exchangeInstances.get(this.activeExchange.id);
      if (!exchange) {
        return defaultMaxMargin;
      }

      try {
        // Try to get margin info from the exchange
        // This is exchange-specific and may not be available through CCXT
        // For now, return conservative default values based on user tier/level

        // Try to get user info or account tier if available
        if (exchange.has.fetchAccounts) {
          const accounts = await exchange.fetchAccounts();
          // Check if user has VIP status or higher tier
          const isVIP = accounts.some(account =>
            account.type?.toLowerCase().includes('vip') ||
            (account.info && account.info.vipLevel && account.info.vipLevel > 0)
          );

          if (isVIP) {
            return 0.9; // 90% for VIP users
          }
        }

        return defaultMaxMargin;
      } catch (exchangeError) {
        logService.log('warn', `Failed to fetch max margin from exchange, using default values`, exchangeError, 'ExchangeService');
        return defaultMaxMargin;
      }
    } catch (error) {
      logService.log('error', `Failed to get max allowed margin`, error, 'ExchangeService');
      return 0.8; // Default to 80%
    }
  }

  /**
   * Check if an exchange is connected
   * @returns True if an exchange is connected, false otherwise
   */
  async isConnected(): Promise<boolean> {
    try {
      // If we're in demo mode, we're always "connected" to the demo exchange
      if (this.demoMode) {
        return true;
      }

      // Check if we have an active exchange
      if (!this.activeExchange) {
        return false;
      }

      // Get the exchange instance
      const exchange = this.exchangeInstances.get(this.activeExchange.id);
      if (!exchange) {
        return false;
      }

      // Try a simple API call to check if the exchange is responsive
      await exchange.fetchTime();
      return true;
    } catch (error) {
      logService.log('error', 'Failed to check exchange connection', error, 'ExchangeService');
      return false;
    }
  }

  /**
   * Create an order on the exchange
   * @param options Order options including symbol, side, type, amount, and price
   * @returns The created order
   */
  async createOrder(options: {
    symbol: string;
    side: string;
    type?: string;
    amount: number;
    entry_price?: number;
    price?: number;
    stop_loss?: number;
    take_profit?: number;
    trailing_stop?: number;
  }): Promise<any> {
    try {
      // Normalize the symbol format if needed
      const normalizedSymbol = options.symbol.includes('_') ? options.symbol.replace('_', '/') : options.symbol;

      // Log the request
      logService.log('info', `Creating order for ${normalizedSymbol}`, {
        side: options.side,
        type: options.type || 'market',
        amount: options.amount,
        price: options.entry_price || options.price
      }, 'ExchangeService');

      // If in demo mode, return mock order
      if (this.demoMode) {
        logService.log('info', `Using mock order for ${normalizedSymbol} (demo mode)`, null, 'ExchangeService');
        return this.createMockOrder(normalizedSymbol, options);
      }

      // Ensure we have an active exchange
      if (!this.activeExchange) {
        // Try to get the active exchange
        const exchange = await this.getActiveExchange();

        if (!exchange) {
          logService.log('warn', `No active exchange found, using mock order for ${normalizedSymbol}`, null, 'ExchangeService');
          return this.createMockOrder(normalizedSymbol, options);
        }

        // Set the active exchange
        this.activeExchange = exchange;
        logService.log('info', `Set active exchange to ${exchange.id} for order creation`, null, 'ExchangeService');
      }

      // Get the exchange instance for the active exchange
      const exchange = this.exchangeInstances.get(this.activeExchange.id);
      if (!exchange) {
        logService.log('warn', `Exchange instance not found for ${this.activeExchange.id}, attempting to create it`, null, 'ExchangeService');

        // Try to create the exchange instance
        try {
          const newExchange = await ccxtService.createExchange(
            this.activeExchange.id as ExchangeId,
            this.activeExchange.credentials,
            this.activeExchange.testnet
          );

          this.exchangeInstances.set(this.activeExchange.id, newExchange);

          // Use the new exchange instance
          return await this.executeOrderWithExchange(newExchange, normalizedSymbol, options);
        } catch (createError) {
          logService.log('error', `Failed to create exchange instance for ${this.activeExchange.id}`, createError, 'ExchangeService');
          return this.createMockOrder(normalizedSymbol, options);
        }
      }

      // Execute the order with the exchange instance
      return await this.executeOrderWithExchange(exchange, normalizedSymbol, options);
    } catch (error) {
      logService.log('error', `Failed to create order for ${options.symbol}`, error, 'ExchangeService');
      return this.createMockOrder(options.symbol, options);
    }
  }

  /**
   * Execute an order with a specific exchange instance
   * @param exchange The exchange instance to use
   * @param symbol The trading pair symbol
   * @param options Order options
   * @returns The created order
   */
  private async executeOrderWithExchange(exchange: any, symbol: string, options: any): Promise<any> {
    try {
      // Determine the order type (market or limit)
      const orderType = options.type || 'market';

      // For market orders, we don't need a price
      if (orderType === 'market') {
        logService.log('info', `Creating market order for ${symbol} on ${this.activeExchange?.id}`, null, 'ExchangeService');
        const order = await exchange.createOrder(
          symbol,
          orderType,
          options.side,
          options.amount
        );

        // Track the order
        this.activeOrders.set(order.id, {
          ...order,
          symbol: symbol,
          side: options.side,
          amount: options.amount,
          price: options.entry_price || options.price,
          status: 'open',
          timestamp: Date.now(),
          stopLoss: options.stop_loss,
          takeProfit: options.take_profit,
          trailingStop: options.trailing_stop
        });

        return order;
      } else {
        // For limit orders, we need a price
        const price = options.entry_price || options.price;
        if (!price) {
          throw new Error('Price is required for limit orders');
        }

        logService.log('info', `Creating limit order for ${symbol} on ${this.activeExchange?.id}`, null, 'ExchangeService');
        const order = await exchange.createOrder(
          symbol,
          orderType,
          options.side,
          options.amount,
          price
        );

        // Track the order
        this.activeOrders.set(order.id, {
          ...order,
          symbol: symbol,
          side: options.side,
          amount: options.amount,
          price: price,
          status: 'open',
          timestamp: Date.now(),
          stopLoss: options.stop_loss,
          takeProfit: options.take_profit,
          trailingStop: options.trailing_stop
        });

        return order;
      }
    } catch (exchangeError) {
      logService.log('warn', `Failed to create order on exchange for ${symbol}, using mock order`, exchangeError, 'ExchangeService');
      return this.createMockOrder(symbol, options);
    }
  }

  /**
   * Create a mock order for demo mode or when the exchange is unavailable
   * @param symbol The trading pair symbol
   * @param options Order options
   * @returns Mock order object
   */
  private createMockOrder(symbol: string, options: any): any {
    // Generate a unique order ID
    const orderId = `mock-${symbol.replace('/', '')}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Get the current price
    const currentPrice = options.entry_price || options.price || this.createMockTicker(symbol).last;

    // Create a mock order
    const order = {
      id: orderId,
      clientOrderId: `client-${orderId}`,
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      symbol: symbol,
      type: options.type || 'market',
      side: options.side,
      price: currentPrice,
      amount: options.amount,
      cost: currentPrice * options.amount,
      filled: 0,
      remaining: options.amount,
      status: 'open',
      fee: {
        cost: currentPrice * options.amount * 0.001, // 0.1% fee
        currency: symbol.split('/')[1] || 'USDT'
      },
      trades: [],
      stopLoss: options.stop_loss,
      takeProfit: options.take_profit,
      trailingStop: options.trailing_stop
    };

    // Track the order
    this.activeOrders.set(orderId, {
      ...order,
      lastUpdate: Date.now()
    });

    return order;
  }
}

export const exchangeService = ExchangeService.getInstance();
