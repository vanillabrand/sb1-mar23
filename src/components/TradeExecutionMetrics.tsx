import React, { useState, useEffect } from 'react';
import { eventBus } from '../lib/event-bus';
import { logService } from '../lib/log-service';

interface TradeExecutionMetricsProps {
  strategyId?: string;
}

interface ExecutionMetrics {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  retryCount: number;
  averageExecutionTime: number;
  circuitBreakerStatus: {
    isOpen: boolean;
    failures: number;
    threshold: number;
    lastFailure: number;
    resetTimeout: number;
  };
}

const TradeExecutionMetrics: React.FC<TradeExecutionMetricsProps> = ({ strategyId }) => {
  const [metrics, setMetrics] = useState<ExecutionMetrics>({
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    retryCount: 0,
    averageExecutionTime: 0,
    circuitBreakerStatus: {
      isOpen: false,
      failures: 0,
      threshold: 5,
      lastFailure: 0,
      resetTimeout: 300000
    }
  });

  useEffect(() => {
    // Subscribe to trade events
    const handleTradeCreated = (event: CustomEvent) => {
      const data = event.detail;
      if (!strategyId || data.order?.strategyId === strategyId || data.order?.strategy_id === strategyId) {
        setMetrics(prev => ({
          ...prev,
          totalTrades: prev.totalTrades + 1
        }));
      }
    };

    const handleTradeExecuted = (event: CustomEvent) => {
      const data = event.detail;
      if (!strategyId || data.order?.strategyId === strategyId || data.order?.strategy_id === strategyId) {
        setMetrics(prev => ({
          ...prev,
          successfulTrades: prev.successfulTrades + 1
        }));
      }
    };

    const handleTradeError = (event: CustomEvent) => {
      const data = event.detail;
      if (!strategyId || data.strategyId === strategyId || data.strategy_id === strategyId) {
        setMetrics(prev => ({
          ...prev,
          failedTrades: prev.failedTrades + 1
        }));
      }
    };

    const handleTradeRetry = (event: CustomEvent) => {
      const data = event.detail;
      if (!strategyId || data.options?.strategyId === strategyId || data.options?.strategy_id === strategyId) {
        setMetrics(prev => ({
          ...prev,
          retryCount: prev.retryCount + 1
        }));
      }
    };

    const handleCircuitBreakerOpened = (event: CustomEvent) => {
      const data = event.detail;
      setMetrics(prev => ({
        ...prev,
        circuitBreakerStatus: {
          ...prev.circuitBreakerStatus,
          isOpen: true,
          failures: data.failures || prev.circuitBreakerStatus.failures,
          threshold: data.threshold || prev.circuitBreakerStatus.threshold,
          lastFailure: Date.now(),
          resetTimeout: data.resetTimeout || prev.circuitBreakerStatus.resetTimeout
        }
      }));

      logService.log('warn', 'Circuit breaker opened', data, 'TradeExecutionMetrics');
    };

    const handleCircuitBreakerReset = () => {
      setMetrics(prev => ({
        ...prev,
        circuitBreakerStatus: {
          ...prev.circuitBreakerStatus,
          isOpen: false,
          failures: 0
        }
      }));

      logService.log('info', 'Circuit breaker reset', null, 'TradeExecutionMetrics');
    };

    // Add event listeners
    window.addEventListener('trade:created', handleTradeCreated as EventListener);
    window.addEventListener('trade:executed', handleTradeExecuted as EventListener);
    window.addEventListener('trade:error', handleTradeError as EventListener);
    window.addEventListener('trade:retry', handleTradeRetry as EventListener);
    window.addEventListener('trade:circuitBreakerOpened', handleCircuitBreakerOpened as EventListener);
    window.addEventListener('trade:circuitBreakerReset', handleCircuitBreakerReset as EventListener);

    // Clean up event listeners
    return () => {
      window.removeEventListener('trade:created', handleTradeCreated as EventListener);
      window.removeEventListener('trade:executed', handleTradeExecuted as EventListener);
      window.removeEventListener('trade:error', handleTradeError as EventListener);
      window.removeEventListener('trade:retry', handleTradeRetry as EventListener);
      window.removeEventListener('trade:circuitBreakerOpened', handleCircuitBreakerOpened as EventListener);
      window.removeEventListener('trade:circuitBreakerReset', handleCircuitBreakerReset as EventListener);
    };
  }, [strategyId]);

  // Calculate time until circuit breaker resets
  const calculateResetTime = () => {
    if (!metrics.circuitBreakerStatus.isOpen) return null;

    const now = Date.now();
    const elapsed = now - metrics.circuitBreakerStatus.lastFailure;
    const remaining = Math.max(0, metrics.circuitBreakerStatus.resetTimeout - elapsed);

    // Convert to minutes and seconds
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    return `${minutes}m ${seconds}s`;
  };

  const resetTime = calculateResetTime();

  return (
    <div className="bg-gunmetal-900 border border-gunmetal-700 rounded-lg p-4">
      <h3 className="text-neon-turquoise text-sm font-medium mb-3">Trade Execution Metrics</h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gunmetal-800 p-2 rounded">
          <div className="text-xs text-gray-400">Total Trades</div>
          <div className="text-lg font-medium text-white">{metrics.totalTrades}</div>
        </div>
        <div className="bg-gunmetal-800 p-2 rounded">
          <div className="text-xs text-gray-400">Success Rate</div>
          <div className="text-lg font-medium text-white">
            {metrics.totalTrades > 0
              ? `${Math.round((metrics.successfulTrades / metrics.totalTrades) * 100)}%`
              : '0%'}
          </div>
        </div>
        <div className="bg-gunmetal-800 p-2 rounded">
          <div className="text-xs text-gray-400">Successful</div>
          <div className="text-lg font-medium text-green-500">{metrics.successfulTrades}</div>
        </div>
        <div className="bg-gunmetal-800 p-2 rounded">
          <div className="text-xs text-gray-400">Failed</div>
          <div className="text-lg font-medium text-red-500">{metrics.failedTrades}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-1">Retry Count</div>
        <div className="flex items-center">
          <div className="h-2 flex-grow bg-gunmetal-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-500"
              style={{
                width: `${Math.min(100, (metrics.retryCount / 10) * 100)}%`
              }}
            />
          </div>
          <span className="ml-2 text-xs text-white">{metrics.retryCount}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-1">Circuit Breaker Status</div>
        <div className={`p-2 rounded ${metrics.circuitBreakerStatus.isOpen ? 'bg-red-900/30 border border-red-500/30' : 'bg-green-900/30 border border-green-500/30'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${metrics.circuitBreakerStatus.isOpen ? 'bg-red-500' : 'bg-green-500'}`}></div>
              <span className="text-sm font-medium">
                {metrics.circuitBreakerStatus.isOpen ? 'Open' : 'Closed'}
              </span>
            </div>
            {metrics.circuitBreakerStatus.isOpen && resetTime && (
              <span className="text-xs text-gray-300">Resets in: {resetTime}</span>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-300">
            Failures: {metrics.circuitBreakerStatus.failures} / {metrics.circuitBreakerStatus.threshold}
          </div>
          {metrics.circuitBreakerStatus.isOpen && (
            <div className="mt-1 text-xs text-red-400">
              Trading temporarily disabled due to multiple failures
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-500 mt-2">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default TradeExecutionMetrics;
