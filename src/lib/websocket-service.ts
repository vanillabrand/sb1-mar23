import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { ccxtService } from './ccxt-service';

class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 1000;

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const exchange = await ccxtService.getExchange();
    const wsUrl = exchange.urls.ws;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.resubscribeAll();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            logService.log('error', 'WebSocket message parsing error', error, 'WebSocketService');
          }
        };

        this.ws.onclose = () => {
          this.handleDisconnect();
        };

        this.ws.onerror = (error) => {
          logService.log('error', 'WebSocket error', error, 'WebSocketService');
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private async handleDisconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logService.log('error', 'Max reconnection attempts reached', null, 'WebSocketService');
      return;
    }

    this.reconnectAttempts++;
    await new Promise(resolve => setTimeout(resolve, this.RECONNECT_DELAY));
    
    try {
      await this.connect();
    } catch (error) {
      logService.log('error', 'Reconnection failed', error, 'WebSocketService');
    }
  }

  async subscribe(channel: string, callback: (data: any) => void): Promise<void> {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    
    this.subscriptions.get(channel)!.add(callback);

    if (this.ws?.readyState === WebSocket.OPEN) {
      const subscribeMsg = {
        method: 'SUBSCRIBE',
        params: [channel],
        id: Date.now()
      };
      this.ws.send(JSON.stringify(subscribeMsg));
    }
  }

  private async resubscribeAll(): Promise<void> {
    for (const channel of this.subscriptions.keys()) {
      const subscribeMsg = {
        method: 'SUBSCRIBE',
        params: [channel],
        id: Date.now()
      };
      this.ws?.send(JSON.stringify(subscribeMsg));
    }
  }

  private handleMessage(data: any): void {
    if (!data.channel) return;

    const callbacks = this.subscriptions.get(data.channel);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(data);
      }
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const unsubscribeMsg = {
        method: 'UNSUBSCRIBE',
        params: [channel],
        id: Date.now()
      };
      this.ws.send(JSON.stringify(unsubscribeMsg));
    }
    
    this.subscriptions.delete(channel);
  }
}

export const websocketService = new WebSocketService();
