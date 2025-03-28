import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { marketMonitor } from './market-monitor';
import { riskManager } from './risk-manager';
import { tradeService } from './trade-service';
import { analyticsService } from './analytics-service';
import { aiTradeService } from './ai-trade-service';
import { exchangeService } from './exchange-service';
import { ccxtService } from './ccxt-service';
import { emailService } from './email-service';
import type { 
  Strategy, 
  MonitoringStatus, 
  HealthCheck,
  AlertConfig,
  Alert 
} from './types';

// Add new monitoring metrics types
interface SystemMetrics {
  cpu: number;
  memory: number;
  latency: number;
  uptime: number;
}

interface ExchangeMetrics {
  connectionStatus: boolean;
  apiLatency: number;
  rateLimit: number;
  lastSync: number;
}

interface AIMetrics {
  lastPredictionTime: number;
  predictionLatency: number;
  confidenceScore: number;
  errorRate: number;
}

// Extend MonitoringStatus
interface MonitoringStatus {
  strategyId: string;
  status: 'active' | 'paused' | 'error';
  lastUpdate: number;
  metrics: {
    market?: any;
    conditions?: any;
    lastTrade?: any;
    system?: SystemMetrics;
    exchange?: ExchangeMetrics;
    ai?: AIMetrics;
  };
  alerts: Alert[];
}

export class MonitoringService extends EventEmitter {
  private static instance: MonitoringService;
  private status: Map<string, MonitoringStatus> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alerts: Map<string, AlertConfig> = new Map();
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly SYSTEM_METRICS_INTERVAL = 60000;
  private readonly EXCHANGE_METRICS_INTERVAL = 15000;

  private constructor() {
    super();
    this.initializeHealthChecks();
    this.initializeSystemMetrics();
    this.initializeExchangeMetrics();
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  async startMonitoring(strategy: Strategy): Promise<void> {
    try {
      // Initialize monitoring status with new metrics
      this.status.set(strategy.id, {
        strategyId: strategy.id,
        status: 'active',
        lastUpdate: Date.now(),
        metrics: {
          system: await this.getInitialSystemMetrics(),
          exchange: await this.getInitialExchangeMetrics(),
          ai: this.getInitialAIMetrics()
        },
        alerts: []
      });

      // Set up alert configuration
      this.alerts.set(strategy.id, this.createDefaultAlertConfig());

      // Subscribe to market events
      marketMonitor.on('marketDataUpdate', this.handleMarketUpdate.bind(this));
      marketMonitor.on('marketConditionUpdate', this.handleMarketCondition.bind(this));

      // Subscribe to risk events
      riskManager.on('riskAlert', this.handleRiskAlert.bind(this));

      // Subscribe to trade events
      tradeService.on('tradeExecuted', this.handleTradeExecution.bind(this));
      tradeService.on('tradeError', this.handleTradeError.bind(this));

      // Add new event subscriptions
      analyticsService.on('analyticsUpdate', this.handleAnalyticsUpdate.bind(this));
      aiTradeService.on('predictionComplete', this.handleAIPrediction.bind(this));
      exchangeService.on('connectionStatus', this.handleExchangeConnection.bind(this));

      logService.log('info', `Started enhanced monitoring for strategy ${strategy.id}`, 
        { strategy: strategy.id }, 'MonitoringService');
    } catch (error) {
      logService.log('error', `Failed to start monitoring`, 
        { strategy: strategy.id, error }, 'MonitoringService');
      throw error;
    }
  }

  private initializeHealthChecks(): void {
    setInterval(() => {
      this.status.forEach((status, strategyId) => {
        this.performHealthCheck(strategyId).catch(error => {
          logService.log('error', 'Health check failed', 
            { strategyId, error }, 'MonitoringService');
        });
      });
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private async performHealthCheck(strategyId: string): Promise<void> {
    try {
      const status = this.status.get(strategyId);
      if (!status) return;

      const marketData = marketMonitor.getMarketData(strategyId);
      const riskMetrics = riskManager.getRiskMetrics(strategyId);
      const tradeStatus = await tradeService.getTradeStatus(strategyId);

      const healthCheck: HealthCheck = {
        timestamp: Date.now(),
        marketDataAge: marketData ? Date.now() - marketData.timestamp : Infinity,
        riskMetricsAge: riskMetrics ? Date.now() - riskMetrics.timestamp : Infinity,
        lastTradeAge: tradeStatus.lastTradeTimestamp ? 
          Date.now() - tradeStatus.lastTradeTimestamp : 
          Infinity,
        errors: []
      };

      // Check for stale data
      if (healthCheck.marketDataAge > 300000) { // 5 minutes
        healthCheck.errors.push('Stale market data');
      }
      if (healthCheck.riskMetricsAge > 300000) {
        healthCheck.errors.push('Stale risk metrics');
      }
      if (healthCheck.lastTradeAge > 86400000) { // 24 hours
        healthCheck.errors.push('No recent trades');
      }

      this.healthChecks.set(strategyId, healthCheck);

      if (healthCheck.errors.length > 0) {
        this.emitAlert(strategyId, {
          type: 'health',
          severity: 'warning',
          message: `Health check issues: ${healthCheck.errors.join(', ')}`,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logService.log('error', 'Health check failed', 
        { strategyId, error }, 'MonitoringService');
    }
  }

  private handleMarketUpdate({ strategyId, marketData }: any): void {
    const status = this.status.get(strategyId);
    if (!status) return;

    status.lastUpdate = Date.now();
    status.metrics.market = marketData;
    this.status.set(strategyId, status);
  }

  private handleMarketCondition({ strategyId, conditions }: any): void {
    const status = this.status.get(strategyId);
    if (!status) return;

    status.metrics.conditions = conditions;
    this.status.set(strategyId, status);
  }

  private handleRiskAlert({ strategyId, metrics }: any): void {
    this.emitAlert(strategyId, {
      type: 'risk',
      severity: 'high',
      message: `Risk threshold exceeded: ${JSON.stringify(metrics)}`,
      timestamp: Date.now()
    });
  }

  private handleTradeExecution({ strategyId, trade }: any): void {
    const status = this.status.get(strategyId);
    if (!status) return;

    status.metrics.lastTrade = trade;
    this.status.set(strategyId, status);
  }

  private handleTradeError({ strategyId, error }: any): void {
    this.emitAlert(strategyId, {
      type: 'trade',
      severity: 'error',
      message: `Trade execution failed: ${error.message}`,
      timestamp: Date.now()
    });
  }

  private emitAlert(strategyId: string, alert: Alert): void {
    const status = this.status.get(strategyId);
    if (!status) return;

    status.alerts.push(alert);
    if (status.alerts.length > 100) {
      status.alerts.shift(); // Keep last 100 alerts
    }

    this.status.set(strategyId, status);
    this.emit('alert', { strategyId, alert });
  }

  private createDefaultAlertConfig(): AlertConfig {
    return {
      riskThresholds: {
        drawdown: 0.15,
        dailyLoss: 0.10,
        exposure: 0.20
      },
      notifications: {
        email: true,
        slack: false,
        telegram: false
      },
      severity: {
        info: true,
        warning: true,
        error: true,
        critical: true
      }
    };
  }

  getStatus(strategyId: string): MonitoringStatus | undefined {
    return this.status.get(strategyId);
  }

  getHealthCheck(strategyId: string): HealthCheck | undefined {
    return this.healthChecks.get(strategyId);
  }

  updateAlertConfig(strategyId: string, config: Partial<AlertConfig>): void {
    const currentConfig = this.alerts.get(strategyId) || this.createDefaultAlertConfig();
    this.alerts.set(strategyId, { ...currentConfig, ...config });
  }

  stopMonitoring(strategyId: string): void {
    this.status.delete(strategyId);
    this.healthChecks.delete(strategyId);
    this.alerts.delete(strategyId);
    logService.log('info', `Stopped monitoring for strategy ${strategyId}`, 
      { strategyId }, 'MonitoringService');
  }

  private initializeSystemMetrics(): void {
    setInterval(() => {
      this.status.forEach((status, strategyId) => {
        this.updateSystemMetrics(strategyId).catch(error => {
          logService.log('error', 'System metrics update failed', 
            { strategyId, error }, 'MonitoringService');
        });
      });
    }, this.SYSTEM_METRICS_INTERVAL);
  }

  private initializeExchangeMetrics(): void {
    setInterval(() => {
      this.status.forEach((status, strategyId) => {
        this.updateExchangeMetrics(strategyId).catch(error => {
          logService.log('error', 'Exchange metrics update failed', 
            { strategyId, error }, 'MonitoringService');
        });
      });
    }, this.EXCHANGE_METRICS_INTERVAL);
  }

  private async updateSystemMetrics(strategyId: string): Promise<void> {
    const status = this.status.get(strategyId);
    if (!status) return;

    const metrics: SystemMetrics = {
      cpu: process.cpuUsage().user / 1000000,
      memory: process.memoryUsage().heapUsed / 1024 / 1024,
      latency: await this.measureLatency(),
      uptime: process.uptime()
    };

    status.metrics.system = metrics;
    this.status.set(strategyId, status);

    if (metrics.memory > 1024 || metrics.cpu > 80) {
      this.emitAlert(strategyId, {
        type: 'system',
        severity: 'warning',
        message: `High resource usage - Memory: ${metrics.memory.toFixed(2)}MB, CPU: ${metrics.cpu.toFixed(2)}%`,
        timestamp: Date.now()
      });
    }
  }

  private async updateExchangeMetrics(strategyId: string): Promise<void> {
    const status = this.status.get(strategyId);
    if (!status) return;

    const startTime = Date.now();
    const isConnected = await ccxtService.checkConnection();
    const latency = Date.now() - startTime;

    const metrics: ExchangeMetrics = {
      connectionStatus: isConnected,
      apiLatency: latency,
      rateLimit: ccxtService.getRateLimit(),
      lastSync: exchangeService.getLastSyncTime()
    };

    status.metrics.exchange = metrics;
    this.status.set(strategyId, status);

    if (metrics.apiLatency > 5000) {
      this.emitAlert(strategyId, {
        type: 'exchange',
        severity: 'warning',
        message: `High exchange API latency: ${metrics.apiLatency}ms`,
        timestamp: Date.now()
      });
    }
  }

  private async measureLatency(): Promise<number> {
    const start = Date.now();
    await marketMonitor.getMarketData();
    return Date.now() - start;
  }

  private handleAnalyticsUpdate({ strategyId, data }: any): void {
    const status = this.status.get(strategyId);
    if (!status) return;

    status.metrics.analytics = data;
    this.status.set(strategyId, status);
  }

  private handleAIPrediction({ strategyId, prediction, latency }: any): void {
    const status = this.status.get(strategyId);
    if (!status) return;

    status.metrics.ai = {
      ...status.metrics.ai,
      lastPredictionTime: Date.now(),
      predictionLatency: latency,
      confidenceScore: prediction.confidence
    };
    this.status.set(strategyId, status);
  }

  private handleExchangeConnection({ connected, latency }: any): void {
    this.status.forEach((status) => {
      if (status.metrics.exchange) {
        status.metrics.exchange.connectionStatus = connected;
        status.metrics.exchange.apiLatency = latency;
      }
    });
  }

  private getInitialSystemMetrics(): SystemMetrics {
    return {
      cpu: process.cpuUsage().user / 1000000,
      memory: process.memoryUsage().heapUsed / 1024 / 1024,
      latency: 0,
      uptime: process.uptime()
    };
  }

  private getInitialExchangeMetrics(): ExchangeMetrics {
    return {
      connectionStatus: ccxtService.checkConnection(),
      apiLatency: 0,
      rateLimit: ccxtService.getRateLimit(),
      lastSync: exchangeService.getLastSyncTime()
    };
  }

  private getInitialAIMetrics(): AIMetrics {
    return {
      lastPredictionTime: 0,
      predictionLatency: 0,
      confidenceScore: 0,
      errorRate: 0
    };
  }
}

export const monitoringService = MonitoringService.getInstance();
