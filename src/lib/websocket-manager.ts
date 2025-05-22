import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { eventBus } from './event-bus';
import { websocketPerformanceMonitor } from './websocket-performance-monitor';

export interface WebSocketOptions {
  url: string;
  protocols?: string | string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  heartbeatMessage?: string | object;
  connectionTimeout?: number;
  name?: string;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  lastMessageTime: number;
  lastHeartbeatTime: number;
  subscriptions: Set<string>;
}

/**
 * WebSocket connection manager with reconnection, heartbeats, and subscription tracking
 */
class WebSocketManager extends EventEmitter {
  private static instance: WebSocketManager;
  private connections: Map<string, {
    ws: WebSocket | null;
    options: WebSocketOptions;
    state: WebSocketState;
    reconnectTimeout: NodeJS.Timeout | null;
    heartbeatInterval: NodeJS.Timeout | null;
    connectionTimeout: NodeJS.Timeout | null;
  }> = new Map();

  private readonly DEFAULT_RECONNECT_INTERVAL = 5000; // 5 seconds
  private readonly DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
  private readonly DEFAULT_HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly DEFAULT_CONNECTION_TIMEOUT = 10000; // 10 seconds

  private constructor() {
    super();
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Create a new WebSocket connection
   * @param options WebSocket connection options
   * @returns Connection ID
   */
  createConnection(options: WebSocketOptions): string {
    const connectionId = options.name || `ws-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Check if connection already exists
    if (this.connections.has(connectionId)) {
      logService.log('warn', `WebSocket connection ${connectionId} already exists`, null, 'WebSocketManager');
      return connectionId;
    }

    // Initialize connection state
    const state: WebSocketState = {
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      lastMessageTime: 0,
      lastHeartbeatTime: 0,
      subscriptions: new Set()
    };

    // Store connection
    this.connections.set(connectionId, {
      ws: null,
      options,
      state,
      reconnectTimeout: null,
      heartbeatInterval: null,
      connectionTimeout: null
    });

    // Connect
    this.connect(connectionId);

    return connectionId;
  }

  /**
   * Connect to a WebSocket
   * @param connectionId Connection ID
   */
  private connect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logService.log('error', `WebSocket connection ${connectionId} not found`, null, 'WebSocketManager');
      return;
    }

    // Clear any existing timeouts
    if (connection.reconnectTimeout) {
      clearTimeout(connection.reconnectTimeout);
      connection.reconnectTimeout = null;
    }

    if (connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval);
      connection.heartbeatInterval = null;
    }

    if (connection.connectionTimeout) {
      clearTimeout(connection.connectionTimeout);
      connection.connectionTimeout = null;
    }

    // Update state
    connection.state.isConnecting = true;

    // Log connection attempt
    logService.log('info', `Connecting to WebSocket ${connectionId}: ${connection.options.url}`, null, 'WebSocketManager');

    try {
      // Create WebSocket
      connection.ws = new WebSocket(connection.options.url, connection.options.protocols);

      // Set up event handlers
      connection.ws.onopen = () => this.handleOpen(connectionId);
      connection.ws.onclose = (event) => this.handleClose(connectionId, event);
      connection.ws.onerror = (event) => this.handleError(connectionId, event);
      connection.ws.onmessage = (event) => this.handleMessage(connectionId, event);

      // Set connection timeout
      const connectionTimeout = connection.options.connectionTimeout || this.DEFAULT_CONNECTION_TIMEOUT;
      connection.connectionTimeout = setTimeout(() => {
        if (connection.state.isConnecting && !connection.state.isConnected) {
          logService.log('warn', `WebSocket connection timeout for ${connectionId}`, null, 'WebSocketManager');

          // Close the connection
          if (connection.ws) {
            connection.ws.close();
          }

          // Attempt to reconnect
          this.scheduleReconnect(connectionId);
        }
      }, connectionTimeout);
    } catch (error) {
      logService.log('error', `Failed to create WebSocket connection ${connectionId}`, error, 'WebSocketManager');
      this.scheduleReconnect(connectionId);
    }
  }

  /**
   * Handle WebSocket open event
   * @param connectionId Connection ID
   */
  private handleOpen(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Update state
    connection.state.isConnected = true;
    connection.state.isConnecting = false;
    connection.state.reconnectAttempts = 0;
    connection.state.lastMessageTime = Date.now();

    // Clear connection timeout
    if (connection.connectionTimeout) {
      clearTimeout(connection.connectionTimeout);
      connection.connectionTimeout = null;
    }

    logService.log('info', `WebSocket connection established: ${connectionId}`, null, 'WebSocketManager');

    // Start heartbeat
    this.startHeartbeat(connectionId);

    // Emit events
    this.emit('connected', { connectionId });
    eventBus.emit(`websocket:connected:${connectionId}`, { connectionId });

    // Start performance monitoring for this connection
    websocketPerformanceMonitor.startMonitoringConnection(connectionId);

    // Resubscribe to channels
    this.resubscribe(connectionId);
  }

  /**
   * Handle WebSocket close event
   * @param connectionId Connection ID
   * @param event Close event
   */
  private handleClose(connectionId: string, event: CloseEvent): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Update state
    connection.state.isConnected = false;
    connection.state.isConnecting = false;

    // Clear heartbeat interval
    if (connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval);
      connection.heartbeatInterval = null;
    }

    // Log close event
    logService.log('info', `WebSocket connection closed: ${connectionId}`, {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    }, 'WebSocketManager');

    // Emit events
    this.emit('disconnected', { connectionId, code: event.code, reason: event.reason });
    eventBus.emit(`websocket:disconnected:${connectionId}`, { connectionId, code: event.code, reason: event.reason });

    // Stop performance monitoring for this connection
    websocketPerformanceMonitor.stopMonitoringConnection(connectionId);

    // Schedule reconnect
    this.scheduleReconnect(connectionId);
  }

  /**
   * Handle WebSocket error event
   * @param connectionId Connection ID
   * @param event Error event
   */
  private handleError(connectionId: string, event: Event): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    logService.log('error', `WebSocket error: ${connectionId}`, event, 'WebSocketManager');

    // Emit events
    this.emit('error', { connectionId, error: event });
    eventBus.emit(`websocket:error:${connectionId}`, { connectionId, error: event });
  }

  /**
   * Handle WebSocket message event
   * @param connectionId Connection ID
   * @param event Message event
   */
  private handleMessage(connectionId: string, event: MessageEvent): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Update last message time
    connection.state.lastMessageTime = Date.now();

    // Parse message
    let message: any;
    try {
      message = JSON.parse(event.data);
    } catch (e) {
      message = event.data;
    }

    // Check if this is a heartbeat response
    const isHeartbeatResponse = this.isHeartbeatResponse(message);

    // Track message metrics for performance monitoring
    const messageSize = typeof event.data === 'string' ? event.data.length :
                        event.data instanceof Blob ? event.data.size : 0;

    // Handle pong messages for latency measurement
    if (isHeartbeatResponse && message && message.id) {
      eventBus.emit('websocket:pong', {
        connectionId,
        id: message.id,
        timestamp: Date.now()
      });
    }

    if (!isHeartbeatResponse) {
      // Emit message event
      this.emit('message', { connectionId, message });
      eventBus.emit(`websocket:message:${connectionId}`, { connectionId, message });

      // Emit general message event for performance monitoring
      eventBus.emit('websocket:message', {
        connectionId,
        message,
        size: messageSize,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Schedule a reconnection attempt
   * @param connectionId Connection ID
   */
  private scheduleReconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Check if we've exceeded max reconnect attempts
    const maxAttempts = connection.options.maxReconnectAttempts || this.DEFAULT_MAX_RECONNECT_ATTEMPTS;
    if (connection.state.reconnectAttempts >= maxAttempts) {
      logService.log('warn', `Maximum reconnect attempts (${maxAttempts}) reached for ${connectionId}`, null, 'WebSocketManager');

      // Emit events
      this.emit('reconnectFailed', { connectionId, attempts: connection.state.reconnectAttempts });
      eventBus.emit(`websocket:reconnectFailed:${connectionId}`, { connectionId, attempts: connection.state.reconnectAttempts });

      return;
    }

    // Calculate reconnect interval with exponential backoff
    const baseInterval = connection.options.reconnectInterval || this.DEFAULT_RECONNECT_INTERVAL;
    const jitter = 0.2; // 20% jitter
    const backoffFactor = Math.min(Math.pow(1.5, connection.state.reconnectAttempts), 10);
    const interval = baseInterval * backoffFactor;
    const jitterAmount = interval * jitter;
    const reconnectInterval = interval + (Math.random() * jitterAmount * 2 - jitterAmount);

    logService.log('info', `Scheduling reconnect for ${connectionId} in ${Math.round(reconnectInterval)}ms (attempt ${connection.state.reconnectAttempts + 1})`, null, 'WebSocketManager');

    // Schedule reconnect
    connection.reconnectTimeout = setTimeout(() => {
      connection.state.reconnectAttempts++;
      this.connect(connectionId);
    }, reconnectInterval);
  }

  /**
   * Start heartbeat for a connection
   * @param connectionId Connection ID
   */
  private startHeartbeat(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.state.isConnected) return;

    // Clear any existing heartbeat interval
    if (connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval);
    }

    // Get heartbeat interval
    const heartbeatInterval = connection.options.heartbeatInterval || this.DEFAULT_HEARTBEAT_INTERVAL;

    // Start heartbeat interval
    connection.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat(connectionId);
    }, heartbeatInterval);

    logService.log('debug', `Started heartbeat for ${connectionId} (interval: ${heartbeatInterval}ms)`, null, 'WebSocketManager');
  }

  /**
   * Send a heartbeat message
   * @param connectionId Connection ID
   */
  private sendHeartbeat(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.ws || !connection.state.isConnected) return;

    try {
      // Get heartbeat message
      let heartbeatMessage = connection.options.heartbeatMessage;

      // If no heartbeat message is specified, use a ping frame
      if (!heartbeatMessage) {
        // For WebSocket ping frame, we don't need to send a message
        // But we'll update the timestamp
        connection.state.lastHeartbeatTime = Date.now();
        return;
      }

      // Send heartbeat message
      if (typeof heartbeatMessage === 'object') {
        connection.ws.send(JSON.stringify(heartbeatMessage));
      } else {
        connection.ws.send(heartbeatMessage);
      }

      // Update last heartbeat time
      connection.state.lastHeartbeatTime = Date.now();

      // Check for stale connection
      const now = Date.now();
      const lastMessageAge = now - connection.state.lastMessageTime;

      // If we haven't received a message in 3 heartbeat intervals, reconnect
      if (lastMessageAge > 3 * (connection.options.heartbeatInterval || this.DEFAULT_HEARTBEAT_INTERVAL)) {
        logService.log('warn', `Stale WebSocket connection detected for ${connectionId} (no messages for ${Math.round(lastMessageAge / 1000)}s)`, null, 'WebSocketManager');

        // Close and reconnect
        this.reconnect(connectionId);
      }
    } catch (error) {
      logService.log('error', `Failed to send heartbeat for ${connectionId}`, error, 'WebSocketManager');

      // If we can't send a heartbeat, the connection is probably dead
      this.reconnect(connectionId);
    }
  }

  /**
   * Check if a message is a heartbeat response
   * @param message The message to check
   * @returns True if the message is a heartbeat response
   */
  private isHeartbeatResponse(message: any): boolean {
    // This is a simple implementation - you may need to customize this
    // based on the specific WebSocket server's heartbeat response format
    if (typeof message === 'object') {
      return message.type === 'pong' ||
             message.op === 'pong' ||
             message.event === 'pong' ||
             message.ping !== undefined ||
             message.pong !== undefined;
    }

    if (typeof message === 'string') {
      return message === 'pong' || message === 'ping';
    }

    return false;
  }

  /**
   * Send a message through a WebSocket connection
   * @param connectionId Connection ID
   * @param message Message to send
   * @returns True if the message was sent, false otherwise
   */
  send(connectionId: string, message: string | object): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.ws || !connection.state.isConnected) {
      logService.log('warn', `Cannot send message: WebSocket ${connectionId} not connected`, null, 'WebSocketManager');
      return false;
    }

    try {
      // Convert object to string if necessary
      const messageStr = typeof message === 'object' ? JSON.stringify(message) : message;

      // Send message
      connection.ws.send(messageStr);

      // Track outgoing message metrics for performance monitoring
      const messageSize = messageStr.length;
      eventBus.emit('websocket:send', {
        connectionId,
        message,
        size: messageSize,
        timestamp: Date.now()
      });

      // If this is a ping message with an ID, track it for latency measurement
      if (typeof message === 'object' && message.type === 'ping' && message.id) {
        eventBus.emit('websocket:ping', {
          connectionId,
          id: message.id,
          timestamp: Date.now()
        });
      }

      return true;
    } catch (error) {
      logService.log('error', `Failed to send message to WebSocket ${connectionId}`, error, 'WebSocketManager');
      return false;
    }
  }

  /**
   * Close a WebSocket connection
   * @param connectionId Connection ID
   * @param code Close code
   * @param reason Close reason
   */
  close(connectionId: string, code?: number, reason?: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logService.log('warn', `WebSocket connection ${connectionId} not found`, null, 'WebSocketManager');
      return;
    }

    // Clear timeouts and intervals
    if (connection.reconnectTimeout) {
      clearTimeout(connection.reconnectTimeout);
      connection.reconnectTimeout = null;
    }

    if (connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval);
      connection.heartbeatInterval = null;
    }

    if (connection.connectionTimeout) {
      clearTimeout(connection.connectionTimeout);
      connection.connectionTimeout = null;
    }

    // Close WebSocket
    if (connection.ws) {
      try {
        connection.ws.close(code, reason);
      } catch (error) {
        logService.log('error', `Error closing WebSocket ${connectionId}`, error, 'WebSocketManager');
      }

      connection.ws = null;
    }

    // Update state
    connection.state.isConnected = false;
    connection.state.isConnecting = false;

    logService.log('info', `Closed WebSocket connection ${connectionId}`, null, 'WebSocketManager');

    // Remove connection
    this.connections.delete(connectionId);

    // Emit events
    this.emit('closed', { connectionId });
    eventBus.emit(`websocket:closed:${connectionId}`, { connectionId });
  }

  /**
   * Get all active connection IDs
   * @returns Array of connection IDs
   */
  getConnections(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Check if a connection is active
   * @param connectionId Connection ID
   * @returns True if the connection is active
   */
  isConnected(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    return !!connection && connection.state.isConnected;
  }

  /**
   * Reconnect a WebSocket connection
   * @param connectionId Connection ID
   */
  reconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logService.log('warn', `WebSocket connection ${connectionId} not found`, null, 'WebSocketManager');
      return;
    }

    logService.log('info', `Reconnecting WebSocket ${connectionId}`, null, 'WebSocketManager');

    // Close existing connection
    if (connection.ws) {
      try {
        connection.ws.close();
      } catch (error) {
        // Ignore errors
      }

      connection.ws = null;
    }

    // Clear timeouts and intervals
    if (connection.reconnectTimeout) {
      clearTimeout(connection.reconnectTimeout);
      connection.reconnectTimeout = null;
    }

    if (connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval);
      connection.heartbeatInterval = null;
    }

    if (connection.connectionTimeout) {
      clearTimeout(connection.connectionTimeout);
      connection.connectionTimeout = null;
    }

    // Update state
    connection.state.isConnected = false;
    connection.state.isConnecting = false;

    // Connect immediately
    this.connect(connectionId);

    // Emit events
    this.emit('reconnecting', { connectionId });
    eventBus.emit(`websocket:reconnecting:${connectionId}`, { connectionId });
  }

  /**
   * Get the state of a WebSocket connection
   * @param connectionId Connection ID
   * @returns Connection state or undefined if not found
   */
  getState(connectionId: string): WebSocketState | undefined {
    const connection = this.connections.get(connectionId);
    return connection?.state;
  }



  /**
   * Add a subscription to a connection
   * @param connectionId Connection ID
   * @param subscriptionId Subscription ID
   */
  addSubscription(connectionId: string, subscriptionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.state.subscriptions.add(subscriptionId);

    logService.log('debug', `Added subscription ${subscriptionId} to WebSocket ${connectionId}`, null, 'WebSocketManager');
  }

  /**
   * Remove a subscription from a connection
   * @param connectionId Connection ID
   * @param subscriptionId Subscription ID
   */
  removeSubscription(connectionId: string, subscriptionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.state.subscriptions.delete(subscriptionId);

    logService.log('debug', `Removed subscription ${subscriptionId} from WebSocket ${connectionId}`, null, 'WebSocketManager');
  }

  /**
   * Resubscribe to all subscriptions for a connection
   * @param connectionId Connection ID
   */
  private resubscribe(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const subscriptions = Array.from(connection.state.subscriptions);

    if (subscriptions.length > 0) {
      logService.log('info', `Resubscribing to ${subscriptions.length} channels for WebSocket ${connectionId}`, null, 'WebSocketManager');

      // Emit resubscribe event
      this.emit('resubscribe', { connectionId, subscriptions });
      eventBus.emit(`websocket:resubscribe:${connectionId}`, { connectionId, subscriptions });
    }
  }
}

export const websocketManager = WebSocketManager.getInstance();
