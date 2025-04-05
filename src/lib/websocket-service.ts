import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { demoService } from './demo-service';
import { configService } from './config-service';
import { config } from './config';
import ReconnectingWebSocket from 'reconnecting-websocket';
import type { WebSocketMessage, WebSocketConfig } from './types';

export class WebSocketService extends EventEmitter {
  private static instance: WebSocketService;
  private socket: ReconnectingWebSocket | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 5000;
  private readonly MESSAGE_QUEUE_SIZE = 1000;
  private readonly PING_INTERVAL = 30000; // 30 seconds

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

    // Always use the proxy server for WebSocket connections
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Use localhost:3001 directly to ensure we connect to the running proxy server
    const proxyHost = 'localhost:3001';
    const demoParam = isDemo ? '?demo=true' : '';

    // Use the proxy server WebSocket endpoint
    const wsUrl = `${wsProtocol}//${proxyHost}/ws${demoParam}`;

    logService.log('info', `Using WebSocket URL through proxy: ${wsUrl}`, null, 'WebSocketService');
    return wsUrl;
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
        connectionTimeout: 10000, // Increase timeout to 10 seconds
        maxRetries: this.MAX_RECONNECT_ATTEMPTS,
        maxReconnectionDelay: 10000,
        minReconnectionDelay: 1000,
        // Add debug logging
        debug: true, // Always enable debug logging
        // Use port 3001 for the proxy server
        wsPort: 3001
      });

      this.setupEventListeners();
      await this.waitForConnection();

      // Start the ping interval
      this.startPingInterval();

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

        // Handle ping/pong messages
        if (message.type === 'ping') {
          // Respond with a pong message
          this.send({
            type: 'pong',
            timestamp: Date.now(),
            echo: message.timestamp
          }).catch(error => {
            logService.log('error', 'Failed to send pong message', error, 'WebSocketService');
          });
        } else if (message.type === 'pong') {
          // Calculate round-trip time
          const rtt = Date.now() - (message.echo || 0);
          logService.log('debug', 'WebSocket pong received', { rtt }, 'WebSocketService');
        }

        // Handle Binance TestNet data
        else if (message.type === 'binance_data' || message.type === 'binance_market_data') {
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
    // Stop the ping interval
    this.stopPingInterval();

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

  private startPingInterval(): void {
    // Clear any existing ping interval
    this.stopPingInterval();

    // Start a new ping interval
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
        // Send a ping message
        this.send({
          type: 'ping',
          timestamp: Date.now()
        }).catch(error => {
          logService.log('error', 'Failed to send ping message', error, 'WebSocketService');
        });
      }
    }, this.PING_INTERVAL);

    logService.log('debug', 'Started WebSocket ping interval', null, 'WebSocketService');
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      logService.log('debug', 'Stopped WebSocket ping interval', null, 'WebSocketService');
    }
  }
}

export const websocketService = WebSocketService.getInstance();
