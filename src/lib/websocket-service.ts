import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { demoService } from './demo-service';
import { configService } from './config-service';
import ReconnectingWebSocket from 'reconnecting-websocket';
import type { WebSocketMessage, WebSocketConfig } from './types';

export class WebSocketService extends EventEmitter {
  private static instance: WebSocketService;
  private socket: ReconnectingWebSocket | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 5000;
  private readonly MESSAGE_QUEUE_SIZE = 1000;

  private constructor() {
    super();
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private getWebSocketUrl(): string {
    // Check if we're in demo mode
    const isDemo = demoService.isDemoMode();

    // For direct connection to Binance TestNet in demo mode
    if (isDemo && configService.get('USE_DIRECT_BINANCE_CONNECTION') === 'true') {
      const testnetWsUrl = configService.get('BINANCE_TESTNET_WEBSOCKETS_URL') || 'wss://testnet.binancefuture.com/ws-fapi/v1';
      logService.log('info', `Using direct Binance TestNet WebSocket URL: ${testnetWsUrl}`, null, 'WebSocketService');
      return testnetWsUrl;
    }

    // If user has configured their own exchange and not in demo mode
    const userExchangeWsUrl = configService.get('USER_EXCHANGE_WEBSOCKETS_URL');
    if (!isDemo && userExchangeWsUrl) {
      logService.log('info', `Using user-configured WebSocket URL: ${userExchangeWsUrl}`, null, 'WebSocketService');
      return userExchangeWsUrl;
    }

    // Use proxy server with demo parameter
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const demoParam = isDemo ? '?demo=true' : '';

    // Use the proxy server for WebSocket connections
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      const localWsUrl = `${protocol}//${host.split(':')[0]}:3001/ws${demoParam}`;
      logService.log('info', `Using local WebSocket URL: ${localWsUrl}`, null, 'WebSocketService');
      return localWsUrl;
    }

    const defaultWsUrl = `${protocol}//${host}/ws${demoParam}`;
    logService.log('info', `Using default WebSocket URL: ${defaultWsUrl}`, null, 'WebSocketService');
    return defaultWsUrl;
  }

  async connect(config: WebSocketConfig): Promise<void> {
    try {
      if (this.socket) {
        await this.disconnect();
      }

      // Use secure WebSocket if on HTTPS
      const wsUrl = config.url || this.getWebSocketUrl();

      this.socket = new ReconnectingWebSocket(wsUrl, [], {
        WebSocket: WebSocket,
        connectionTimeout: 4000,
        maxRetries: this.MAX_RECONNECT_ATTEMPTS,
        maxReconnectionDelay: 10000,
        minReconnectionDelay: 1000,
        // Add debug logging
        debug: process.env.NODE_ENV === 'development',
        // Use appropriate port based on protocol
        wsPort: window.location.protocol === 'https:' ? 443 : 80
      });

      this.setupEventListeners();
      await this.waitForConnection();

      if (config.subscriptions) {
        await this.subscribe(config.subscriptions);
      }

      logService.log('info', 'WebSocket connected successfully',
        { url: wsUrl }, 'WebSocketService');
    } catch (error) {
      logService.log('error', 'Failed to establish WebSocket connection',
        error, 'WebSocketService');
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.addEventListener('open', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      this.processMessageQueue();
    });

    this.socket.addEventListener('close', () => {
      this.isConnected = false;
      this.emit('disconnected');
      this.handleDisconnection();
    });

    this.socket.addEventListener('error', (error) => {
      logService.log('error', 'WebSocket error', error, 'WebSocketService');
      this.emit('error', error);
    });

    this.socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        logService.log('debug', 'WebSocket message received', message, 'WebSocketService');

        // Emit the message to all listeners
        this.emit('message', message);

        // Handle Binance TestNet data
        if (message.type === 'binance_data' || message.type === 'binance_market_data') {
          this.handleBinanceData(message.data);
        }

        // Also emit based on message type
        if (message.type) {
          this.emit(message.type, message.data);
        }
      } catch (error) {
        logService.log('error', 'Failed to parse WebSocket message',
          error, 'WebSocketService');
      }
    });
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      const handleConnection = () => {
        clearTimeout(timeout);
        this.socket?.removeEventListener('open', handleConnection);
        resolve();
      };

      if (this.socket.readyState === WebSocket.OPEN) {
        handleConnection();
      } else {
        this.socket.addEventListener('open', handleConnection);
      }
    });
  }

  private async subscribe(subscriptions: string[]): Promise<void> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    try {
      const subscribeMessage = {
        type: 'subscribe',
        channels: subscriptions
      };

      await this.send(subscribeMessage);
      logService.log('info', 'Subscribed to WebSocket channels',
        { channels: subscriptions }, 'WebSocketService');
    } catch (error) {
      logService.log('error', 'Failed to subscribe to WebSocket channels',
        error, 'WebSocketService');
      throw error;
    }
  }

  async send(message: WebSocketMessage): Promise<void> {
    if (!this.isConnected) {
      if (this.messageQueue.length >= this.MESSAGE_QUEUE_SIZE) {
        this.messageQueue.shift();
      }
      this.messageQueue.push(message);
      return;
    }

    try {
      this.socket?.send(JSON.stringify(message));
    } catch (error) {
      logService.log('error', 'Failed to send WebSocket message',
        error, 'WebSocketService');
      throw error;
    }
  }

  private async processMessageQueue(): Promise<void> {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        await this.send(message);
      }
    }
  }

  private handleDisconnection(): void {
    this.reconnectAttempts++;
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logService.log('error', 'Max WebSocket reconnection attempts reached',
        null, 'WebSocketService');
      this.emit('maxReconnectAttemptsReached');
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
      this.messageQueue = [];
      logService.log('info', 'WebSocket disconnected', null, 'WebSocketService');
    }
  }

  /**
   * Check if the WebSocket is connected
   * @returns True if connected, false otherwise
   */
  getConnectionStatus(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Handle Binance TestNet data
   * @param data The Binance data
   */
  private handleBinanceData(data: any): void {
    try {
      // Check if this is a trade update
      if (data.e === 'trade') {
        // Format the trade data to match our application's format
        const trade = {
          id: `binance-${data.t}`,
          timestamp: data.T,
          datetime: new Date(data.T).toISOString(),
          symbol: data.s.toUpperCase(),
          side: data.m ? 'sell' : 'buy', // m = is buyer the market maker
          price: parseFloat(data.p),
          amount: parseFloat(data.q),
          cost: parseFloat(data.p) * parseFloat(data.q),
          fee: {
            cost: parseFloat(data.p) * parseFloat(data.q) * 0.001, // 0.1% fee
            currency: data.s.slice(-4) // Last 4 characters (e.g., USDT from BTCUSDT)
          },
          status: 'closed',
          strategyId: 'binance-testnet'
        };

        // Emit the trade update
        this.emit('trade_update', {
          strategyId: 'binance-testnet',
          trade
        });
      }

      // Emit the raw Binance data
      this.emit('binance_raw_data', data);
    } catch (error) {
      logService.log('error', 'Failed to handle Binance data', error, 'WebSocketService');
    }
  }
}

export const websocketService = WebSocketService.getInstance();
