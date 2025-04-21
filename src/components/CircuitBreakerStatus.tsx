import React, { useState, useEffect } from 'react';
import { eventBus } from '../lib/event-bus';

interface CircuitBreakerState {
  isOpen: boolean;
  isHalfOpen: boolean;
  failures: {
    network: number;
    exchange: number;
    validation: number;
    unknown: number;
  };
  totalFailures: number;
  thresholds: {
    network: number;
    exchange: number;
    validation: number;
    unknown: number;
  };
  lastStateChange: number;
  lastFailure: number;
}

const CircuitBreakerStatus: React.FC = () => {
  const [circuitBreaker, setCircuitBreaker] = useState<CircuitBreakerState>({
    isOpen: false,
    isHalfOpen: false,
    failures: {
      network: 0,
      exchange: 0,
      validation: 0,
      unknown: 0
    },
    totalFailures: 0,
    thresholds: {
      network: 3,
      exchange: 5,
      validation: 2,
      unknown: 3
    },
    lastStateChange: 0,
    lastFailure: 0
  });

  useEffect(() => {
    // Subscribe to circuit breaker events
    const subscriptions = [
      eventBus.on('trade:circuitBreakerOpened', handleCircuitBreakerOpened),
      eventBus.on('trade:circuitBreakerHalfOpen', handleCircuitBreakerHalfOpen),
      eventBus.on('trade:circuitBreakerClosed', handleCircuitBreakerClosed),
      eventBus.on('trade:circuitBreakerReset', handleCircuitBreakerReset)
    ];

    // Clean up
    return () => {
      subscriptions.forEach(unsub => unsub());
    };
  }, []);

  const handleCircuitBreakerOpened = (data: any) => {
    setCircuitBreaker(prev => ({
      ...prev,
      isOpen: true,
      isHalfOpen: false,
      failures: data.failures || prev.failures,
      totalFailures: data.totalFailures || prev.totalFailures,
      thresholds: data.thresholds || prev.thresholds,
      lastStateChange: Date.now()
    }));
  };

  const handleCircuitBreakerHalfOpen = () => {
    setCircuitBreaker(prev => ({
      ...prev,
      isOpen: false,
      isHalfOpen: true,
      lastStateChange: Date.now()
    }));
  };

  const handleCircuitBreakerClosed = () => {
    setCircuitBreaker(prev => ({
      ...prev,
      isOpen: false,
      isHalfOpen: false,
      failures: {
        network: 0,
        exchange: 0,
        validation: 0,
        unknown: 0
      },
      totalFailures: 0,
      lastStateChange: Date.now()
    }));
  };

  const handleCircuitBreakerReset = () => {
    setCircuitBreaker(prev => ({
      ...prev,
      isOpen: false,
      isHalfOpen: false,
      failures: {
        network: 0,
        exchange: 0,
        validation: 0,
        unknown: 0
      },
      totalFailures: 0,
      lastStateChange: Date.now()
    }));
  };

  const getStatusColor = () => {
    if (circuitBreaker.isOpen) return 'bg-red-600';
    if (circuitBreaker.isHalfOpen) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  const getStatusText = () => {
    if (circuitBreaker.isOpen) return 'OPEN';
    if (circuitBreaker.isHalfOpen) return 'HALF-OPEN';
    return 'CLOSED';
  };

  const getFailurePercentage = (type: keyof typeof circuitBreaker.failures) => {
    const threshold = circuitBreaker.thresholds[type];
    const failures = circuitBreaker.failures[type];
    return Math.min(100, Math.round((failures / threshold) * 100));
  };

  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4">Circuit Breaker Status</h2>
      
      <div className="flex items-center mb-4">
        <div className={`w-4 h-4 rounded-full ${getStatusColor()} mr-2`}></div>
        <span className="font-medium">{getStatusText()}</span>
      </div>
      
      <div className="space-y-3">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm">Network Errors</span>
            <span className="text-sm">{circuitBreaker.failures.network}/{circuitBreaker.thresholds.network}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full" 
              style={{ width: `${getFailurePercentage('network')}%` }}
            ></div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm">Exchange Errors</span>
            <span className="text-sm">{circuitBreaker.failures.exchange}/{circuitBreaker.thresholds.exchange}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-purple-500 h-2 rounded-full" 
              style={{ width: `${getFailurePercentage('exchange')}%` }}
            ></div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm">Validation Errors</span>
            <span className="text-sm">{circuitBreaker.failures.validation}/{circuitBreaker.thresholds.validation}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-yellow-500 h-2 rounded-full" 
              style={{ width: `${getFailurePercentage('validation')}%` }}
            ></div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm">Unknown Errors</span>
            <span className="text-sm">{circuitBreaker.failures.unknown}/{circuitBreaker.thresholds.unknown}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-red-500 h-2 rounded-full" 
              style={{ width: `${getFailurePercentage('unknown')}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-sm text-gray-400">
        <div>Total Failures: {circuitBreaker.totalFailures}</div>
        {circuitBreaker.lastStateChange > 0 && (
          <div>Last State Change: {new Date(circuitBreaker.lastStateChange).toLocaleTimeString()}</div>
        )}
      </div>
    </div>
  );
};

export default CircuitBreakerStatus;
