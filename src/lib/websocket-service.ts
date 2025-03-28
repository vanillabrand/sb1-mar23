import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
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
        const data = JSON.parse(event.data);
        this.emit('message', data);
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
}

export const websocketService = WebSocketService.getInstance();
