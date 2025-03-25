import ReconnectingWebSocket from 'reconnecting-websocket';
import { EventEmitter } from './event-emitter';
import { logService } from './log-service';

interface WebSocketMessage {
  type: string;
  data: any;
}

class WebSocketService extends EventEmitter {
  private static instance: WebSocketService;
  private socket: ReconnectingWebSocket | null = null;
  private subscriptions: Set<string> = new Set();
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 5000;
  private readonly PING_INTERVAL = 30000;
  private pingInterval: NodeJS.Timeout | null = null;
  private baseUrl = 'wss://ws-manager-compress.bitmart.com/api?protocol=1.1';
  private isDemo = true;

  private constructor() {
    super();
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  setDemoMode(demo: boolean): void {
    this.isDemo = demo;
    if (this.socket) {
      this.disconnect();
      this.connect();
    }
  }

  connect(): void {
    if (this.socket) return;

    // In demo mode, don't actually connect to WebSocket
    if (this.isDemo) {
      this.startDemoUpdates();
      return;
    }

    try {
      this.socket = new ReconnectingWebSocket(this.baseUrl, [], {
        WebSocket: window.WebSocket,
        connectionTimeout: 4000,
        maxRetries: this.MAX_RECONNECT_ATTEMPTS,
        maxReconnectionDelay: 10000,
        minReconnectionDelay: 1000,
        reconnectionDelayGrowFactor: 1.3,
        debug: false
      });

      this.socket.addEventListener('open', this.handleOpen.bind(this));
      this.socket.addEventListener('message', this.handleMessage.bind(this));
      this.socket.addEventListener('close', this.handleClose.bind(this));
      this.socket.addEventListener('error', this.handleError.bind(this));

      // Start ping interval
      this.startPingInterval();

      logService.log('info', 'WebSocket connection initialized', null, 'WebSocketService');
    } catch (error) {
      logService.log('error', 'WebSocket connection error', error, 'WebSocketService');
      this.fallbackToDemoMode();
    }
  }

  private handleOpen(): void {
    logService.log('info', 'WebSocket connected', null, 'WebSocketService');
    this.reconnectAttempts = 0;
    this.resubscribeAll();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;
      if (message.type === 'pong') return;
      this.emit(message.type, message.data);
    } catch (error) {
      logService.log('error', 'Error parsing WebSocket message', error, 'WebSocketService');
    }
  }

  private handleClose(): void {
    logService.log('info', 'WebSocket disconnected', null, 'WebSocketService');
    this.cleanup();
    
    if (++this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logService.log('warn', 'Max reconnection attempts reached, falling back to demo mode', null, 'WebSocketService');
      this.fallbackToDemoMode();
    }
  }

  private handleError(error: Event): void {
    logService.log('error', 'WebSocket error', error, 'WebSocketService');
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.fallbackToDemoMode();
    }
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.PING_INTERVAL);
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private fallbackToDemoMode(): void {
    logService.log('info', 'Falling back to demo mode', null, 'WebSocketService');
    this.isDemo = true;
    this.cleanup();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.startDemoUpdates();
  }

  private startDemoUpdates(): void {
    // Simulate WebSocket updates in demo mode
    setInterval(() => {
      this.subscriptions.forEach(subscription => {
        const [channel, symbol] = subscription.split(':');
        if (channel === 'spot/ticker') {
          const basePrice = symbol.includes('BTC') ? 45000 :
                         symbol.includes('ETH') ? 3000 :
                         symbol.includes('SOL') ? 100 :
                         symbol.includes('BNB') ? 300 :
                         symbol.includes('XRP') ? 0.5 : 1;
        
          // Add some randomness to price movement
          const priceChange = (Math.random() - 0.5) * 0.002;
          const price = basePrice * (1 + priceChange);
        
          // Calculate 24h change based on simulated open price
          const open24h = basePrice * (1 + (Math.random() - 0.5) * 0.01);
          const change24h = ((price - open24h) / open24h) * 100;
        
          this.emit('ticker', {
            symbol,
            last_price: price.toFixed(2),
            quote_volume_24h: (Math.random() * 1000000 + 500000).toFixed(2),
            high_24h: (price * (1 + Math.random() * 0.01)).toFixed(2),
            low_24h: (price * (1 - Math.random() * 0.01)).toFixed(2),
            open_24h: open24h.toFixed(2),
            change24h: change24h.toFixed(2),
            timestamp: Date.now()
          });
        }
      });
    }, 1000); // Update every second
  }

  private generateDemoPrice(symbol: string): number {
    const basePrice = symbol.startsWith('BTC') ? 45000 :
                     symbol.startsWith('ETH') ? 3000 :
                     symbol.startsWith('SOL') ? 100 :
                     symbol.startsWith('BNB') ? 300 :
                     symbol.startsWith('XRP') ? 0.5 : 1;
    
    return basePrice * (1 + (Math.random() - 0.5) * 0.002);
  }

  private generateDemoVolume(): number {
    return Math.random() * 1000000 + 500000;
  }

  subscribe(symbol: string, channel: string): void {
    const subscription = `${channel}:${symbol}`;
    if (this.subscriptions.has(subscription)) return;

    this.subscriptions.add(subscription);
    
    if (!this.isDemo && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        op: 'subscribe',
        args: [subscription]
      }));
    }

    logService.log('info', `Subscribed to ${subscription}`, null, 'WebSocketService');
  }

  unsubscribe(symbol: string, channel: string): void {
    const subscription = `${channel}:${symbol}`;
    if (!this.subscriptions.has(subscription)) return;

    this.subscriptions.delete(subscription);
    
    if (!this.isDemo && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        op: 'unsubscribe',
        args: [subscription]
      }));
    }

    logService.log('info', `Unsubscribed from ${subscription}`, null, 'WebSocketService');
  }

  private resubscribeAll(): void {
    if (this.isDemo || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const subscriptions = Array.from(this.subscriptions);
    if (subscriptions.length > 0) {
      this.socket.send(JSON.stringify({
        op: 'subscribe',
        args: subscriptions
      }));
      logService.log('info', `Resubscribed to ${subscriptions.length} channels`, null, 'WebSocketService');
    }
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN || this.isDemo;
  }

  disconnect(): void {
    this.cleanup();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.subscriptions.clear();
    this.reconnectAttempts = 0;
    logService.log('info', 'WebSocket disconnected', null, 'WebSocketService');
  }
}

export const websocketService = WebSocketService.getInstance();