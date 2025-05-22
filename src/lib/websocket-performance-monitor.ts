/**
 * WebSocket Performance Monitor
 * 
 * This service monitors WebSocket performance metrics and provides insights
 * to help identify and fix performance issues.
 */

import { logService } from './log-service';
import { websocketManager } from './websocket-manager';
import { eventBus } from './event-bus';

interface WebSocketMetrics {
  connectionId: string;
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  errors: number;
  reconnects: number;
  latency: number[];
  lastMessageTime: number;
  connectionTime: number;
  disconnectionTime: number;
  connectionDuration: number;
}

interface WebSocketPerformanceReport {
  connectionId: string;
  averageLatency: number;
  maxLatency: number;
  messagesPerSecond: number;
  bytesPerSecond: number;
  errorRate: number;
  reconnectRate: number;
  uptime: number;
  connectionStability: number;
}

class WebSocketPerformanceMonitor {
  private metrics: Map<string, WebSocketMetrics> = new Map();
  private pingIntervals: Map<string, number> = new Map();
  private pendingPings: Map<string, { id: string; timestamp: number }[]> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval: number | null = null;
  private readonly DEFAULT_PING_INTERVAL = 10000; // 10 seconds
  private readonly MAX_LATENCY_SAMPLES = 50;
  private readonly MONITORING_INTERVAL = 60000; // 1 minute

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Start monitoring WebSocket performance
   * @param pingInterval Interval between ping messages in milliseconds
   */
  startMonitoring(pingInterval: number = this.DEFAULT_PING_INTERVAL): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Start monitoring all existing connections
    const connections = websocketManager.getConnections();
    connections.forEach(connectionId => {
      this.startMonitoringConnection(connectionId, pingInterval);
    });
    
    // Set up monitoring interval for periodic reports
    this.monitoringInterval = window.setInterval(() => {
      this.generatePerformanceReports();
    }, this.MONITORING_INTERVAL);
    
    logService.log('info', 'Started WebSocket performance monitoring', null, 'WebSocketPerformanceMonitor');
  }

  /**
   * Stop monitoring WebSocket performance
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    // Clear all ping intervals
    this.pingIntervals.forEach((intervalId, connectionId) => {
      clearInterval(intervalId);
    });
    this.pingIntervals.clear();
    
    // Clear monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    logService.log('info', 'Stopped WebSocket performance monitoring', null, 'WebSocketPerformanceMonitor');
  }

  /**
   * Start monitoring a specific WebSocket connection
   * @param connectionId Connection ID
   * @param pingInterval Interval between ping messages in milliseconds
   */
  startMonitoringConnection(connectionId: string, pingInterval: number = this.DEFAULT_PING_INTERVAL): void {
    // Check if connection exists
    if (!websocketManager.isConnected(connectionId)) {
      logService.log('warn', `Cannot monitor WebSocket ${connectionId}: not connected`, null, 'WebSocketPerformanceMonitor');
      return;
    }
    
    // Initialize metrics
    if (!this.metrics.has(connectionId)) {
      this.metrics.set(connectionId, {
        connectionId,
        messagesReceived: 0,
        messagesSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
        errors: 0,
        reconnects: 0,
        latency: [],
        lastMessageTime: Date.now(),
        connectionTime: Date.now(),
        disconnectionTime: 0,
        connectionDuration: 0
      });
    }
    
    // Initialize pending pings
    if (!this.pendingPings.has(connectionId)) {
      this.pendingPings.set(connectionId, []);
    }
    
    // Clear existing ping interval
    if (this.pingIntervals.has(connectionId)) {
      clearInterval(this.pingIntervals.get(connectionId));
    }
    
    // Set up ping interval
    const intervalId = window.setInterval(() => {
      this.sendPing(connectionId);
    }, pingInterval);
    
    this.pingIntervals.set(connectionId, intervalId);
    
    logService.log('info', `Started monitoring WebSocket ${connectionId}`, null, 'WebSocketPerformanceMonitor');
  }

  /**
   * Stop monitoring a specific WebSocket connection
   * @param connectionId Connection ID
   */
  stopMonitoringConnection(connectionId: string): void {
    // Clear ping interval
    if (this.pingIntervals.has(connectionId)) {
      clearInterval(this.pingIntervals.get(connectionId));
      this.pingIntervals.delete(connectionId);
    }
    
    // Keep metrics for reporting
    
    logService.log('info', `Stopped monitoring WebSocket ${connectionId}`, null, 'WebSocketPerformanceMonitor');
  }

  /**
   * Send a ping message to measure latency
   * @param connectionId Connection ID
   */
  private sendPing(connectionId: string): void {
    if (!websocketManager.isConnected(connectionId)) {
      return;
    }
    
    // Generate ping ID
    const pingId = `ping-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Send ping message
    const pingMessage = {
      type: 'ping',
      id: pingId,
      timestamp: Date.now()
    };
    
    const success = websocketManager.send(connectionId, pingMessage);
    
    if (success) {
      // Add to pending pings
      const pendingPings = this.pendingPings.get(connectionId) || [];
      pendingPings.push({ id: pingId, timestamp: Date.now() });
      this.pendingPings.set(connectionId, pendingPings);
      
      // Update metrics
      const metrics = this.metrics.get(connectionId);
      if (metrics) {
        metrics.messagesSent++;
        metrics.bytesSent += JSON.stringify(pingMessage).length;
      }
    }
  }

  /**
   * Handle a pong message to measure latency
   * @param connectionId Connection ID
   * @param pongMessage Pong message
   */
  private handlePong(connectionId: string, pongMessage: any): void {
    if (!pongMessage.id) {
      return;
    }
    
    // Find matching ping
    const pendingPings = this.pendingPings.get(connectionId) || [];
    const pingIndex = pendingPings.findIndex(ping => ping.id === pongMessage.id);
    
    if (pingIndex >= 0) {
      // Calculate latency
      const ping = pendingPings[pingIndex];
      const latency = Date.now() - ping.timestamp;
      
      // Update metrics
      const metrics = this.metrics.get(connectionId);
      if (metrics) {
        metrics.latency.push(latency);
        
        // Keep only the last N latency samples
        if (metrics.latency.length > this.MAX_LATENCY_SAMPLES) {
          metrics.latency.shift();
        }
      }
      
      // Remove from pending pings
      pendingPings.splice(pingIndex, 1);
      this.pendingPings.set(connectionId, pendingPings);
    }
  }

  /**
   * Generate performance reports for all monitored connections
   */
  private generatePerformanceReports(): void {
    const reports: WebSocketPerformanceReport[] = [];
    
    this.metrics.forEach((metrics, connectionId) => {
      // Calculate performance metrics
      const report = this.calculatePerformanceMetrics(metrics);
      reports.push(report);
      
      // Log report
      logService.log('info', `WebSocket performance report for ${connectionId}`, report, 'WebSocketPerformanceMonitor');
      
      // Emit report event
      eventBus.emit('websocket:performance:report', { connectionId, report });
    });
    
    // Emit combined report event
    eventBus.emit('websocket:performance:reports', { reports });
  }

  /**
   * Calculate performance metrics from raw metrics
   * @param metrics Raw WebSocket metrics
   * @returns Performance report
   */
  private calculatePerformanceMetrics(metrics: WebSocketMetrics): WebSocketPerformanceReport {
    // Calculate average latency
    const averageLatency = metrics.latency.length > 0
      ? metrics.latency.reduce((sum, latency) => sum + latency, 0) / metrics.latency.length
      : 0;
    
    // Calculate max latency
    const maxLatency = metrics.latency.length > 0
      ? Math.max(...metrics.latency)
      : 0;
    
    // Calculate connection duration
    const connectionDuration = metrics.disconnectionTime > 0
      ? metrics.disconnectionTime - metrics.connectionTime
      : Date.now() - metrics.connectionTime;
    
    // Calculate messages per second
    const messagesPerSecond = connectionDuration > 0
      ? (metrics.messagesReceived + metrics.messagesSent) / (connectionDuration / 1000)
      : 0;
    
    // Calculate bytes per second
    const bytesPerSecond = connectionDuration > 0
      ? (metrics.bytesReceived + metrics.bytesSent) / (connectionDuration / 1000)
      : 0;
    
    // Calculate error rate
    const totalMessages = metrics.messagesReceived + metrics.messagesSent;
    const errorRate = totalMessages > 0
      ? metrics.errors / totalMessages
      : 0;
    
    // Calculate reconnect rate (reconnects per hour)
    const reconnectRate = connectionDuration > 0
      ? (metrics.reconnects / (connectionDuration / 3600000))
      : 0;
    
    // Calculate uptime (percentage of time connected)
    const uptime = 1; // We don't track disconnection periods yet
    
    // Calculate connection stability (0-1, higher is better)
    // Based on error rate, reconnect rate, and latency
    const latencyFactor = averageLatency > 0
      ? Math.min(1, 100 / averageLatency)
      : 1;
    
    const errorFactor = Math.max(0, 1 - errorRate * 10);
    const reconnectFactor = Math.max(0, 1 - reconnectRate / 10);
    
    const connectionStability = (latencyFactor * 0.4 + errorFactor * 0.3 + reconnectFactor * 0.3);
    
    return {
      connectionId: metrics.connectionId,
      averageLatency,
      maxLatency,
      messagesPerSecond,
      bytesPerSecond,
      errorRate,
      reconnectRate,
      uptime,
      connectionStability
    };
  }

  /**
   * Set up event listeners for WebSocket events
   */
  private setupEventListeners(): void {
    // Listen for WebSocket connected events
    eventBus.on('websocket:connected', (data: any) => {
      const connectionId = data.connectionId;
      
      // Initialize or update metrics
      const metrics = this.metrics.get(connectionId) || {
        connectionId,
        messagesReceived: 0,
        messagesSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
        errors: 0,
        reconnects: 0,
        latency: [],
        lastMessageTime: Date.now(),
        connectionTime: Date.now(),
        disconnectionTime: 0,
        connectionDuration: 0
      };
      
      metrics.connectionTime = Date.now();
      this.metrics.set(connectionId, metrics);
      
      // Start monitoring if global monitoring is enabled
      if (this.isMonitoring) {
        this.startMonitoringConnection(connectionId);
      }
    });
    
    // Listen for WebSocket disconnected events
    eventBus.on('websocket:disconnected', (data: any) => {
      const connectionId = data.connectionId;
      
      // Update metrics
      const metrics = this.metrics.get(connectionId);
      if (metrics) {
        metrics.disconnectionTime = Date.now();
        metrics.connectionDuration += metrics.disconnectionTime - metrics.connectionTime;
      }
      
      // Stop monitoring this connection
      this.stopMonitoringConnection(connectionId);
    });
    
    // Listen for WebSocket error events
    eventBus.on('websocket:error', (data: any) => {
      const connectionId = data.connectionId;
      
      // Update metrics
      const metrics = this.metrics.get(connectionId);
      if (metrics) {
        metrics.errors++;
      }
    });
    
    // Listen for WebSocket message events
    eventBus.on('websocket:message', (data: any) => {
      const connectionId = data.connectionId;
      const message = data.message;
      
      // Update metrics
      const metrics = this.metrics.get(connectionId);
      if (metrics) {
        metrics.messagesReceived++;
        metrics.lastMessageTime = Date.now();
        
        // Estimate bytes received
        if (typeof message === 'string') {
          metrics.bytesReceived += message.length;
        } else if (typeof message === 'object') {
          metrics.bytesReceived += JSON.stringify(message).length;
        }
        
        // Check if this is a pong message
        if (message && (message.type === 'pong' || (message.type === 'ping' && message.id))) {
          this.handlePong(connectionId, message);
        }
      }
    });
    
    // Listen for WebSocket reconnecting events
    eventBus.on('websocket:reconnecting', (data: any) => {
      const connectionId = data.connectionId;
      
      // Update metrics
      const metrics = this.metrics.get(connectionId);
      if (metrics) {
        metrics.reconnects++;
      }
    });
  }
}

// Export a singleton instance
export const websocketPerformanceMonitor = new WebSocketPerformanceMonitor();
