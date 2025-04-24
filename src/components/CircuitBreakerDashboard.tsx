import React, { useState, useEffect } from 'react';
import { CircuitState, CircuitBreakerStats } from '../lib/circuit-breaker';
import { networkResilience } from '../lib/network-resilience';
import { eventBus } from '../lib/event-bus';

interface CircuitBreakerDashboardProps {
  refreshInterval?: number;
}

const CircuitBreakerDashboard: React.FC<CircuitBreakerDashboardProps> = ({
  refreshInterval = 5000
}) => {
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerStats[]>([]);
  const [selectedCircuitBreaker, setSelectedCircuitBreaker] = useState<string | null>(null);
  
  // Fetch circuit breaker stats
  const fetchCircuitBreakerStats = () => {
    const allCircuitBreakers = networkResilience.getAllCircuitBreakers();
    const stats: CircuitBreakerStats[] = [];
    
    for (const circuitBreaker of allCircuitBreakers.values()) {
      stats.push(circuitBreaker.getStats());
    }
    
    setCircuitBreakers(stats);
  };
  
  // Reset a circuit breaker
  const resetCircuitBreaker = (name: string) => {
    const circuitBreaker = networkResilience.getCircuitBreaker(name);
    
    if (circuitBreaker) {
      circuitBreaker.reset();
      fetchCircuitBreakerStats();
    }
  };
  
  // Force a circuit breaker state
  const forceCircuitBreakerState = (name: string, state: CircuitState) => {
    networkResilience.forceCircuitBreakerState(name, state);
    fetchCircuitBreakerStats();
  };
  
  // Reset all circuit breakers
  const resetAllCircuitBreakers = () => {
    networkResilience.resetAllCircuitBreakers();
    fetchCircuitBreakerStats();
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return 'Never';
    
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };
  
  // Get state color
  const getStateColor = (state: CircuitState) => {
    switch (state) {
      case CircuitState.CLOSED:
        return 'green';
      case CircuitState.HALF_OPEN:
        return 'orange';
      case CircuitState.OPEN:
        return 'red';
      default:
        return 'gray';
    }
  };
  
  // Effect to fetch circuit breaker stats on mount and at interval
  useEffect(() => {
    // Initial fetch
    fetchCircuitBreakerStats();
    
    // Set up interval
    const intervalId = setInterval(fetchCircuitBreakerStats, refreshInterval);
    
    // Set up event listeners
    const eventHandlers = [
      'circuitBreaker:open',
      'circuitBreaker:close',
      'circuitBreaker:halfOpen',
      'circuitBreaker:forceState',
      'circuitBreaker:reset'
    ];
    
    eventHandlers.forEach(event => {
      eventBus.on(event, fetchCircuitBreakerStats);
    });
    
    // Clean up
    return () => {
      clearInterval(intervalId);
      
      eventHandlers.forEach(event => {
        eventBus.off(event, fetchCircuitBreakerStats);
      });
    };
  }, [refreshInterval]);
  
  // If no circuit breakers, show a message
  if (circuitBreakers.length === 0) {
    return (
      <div className="circuit-breaker-dashboard">
        <h2>Circuit Breakers</h2>
        <p>No circuit breakers found.</p>
      </div>
    );
  }
  
  return (
    <div className="circuit-breaker-dashboard">
      <h2>Circuit Breakers</h2>
      
      <div className="circuit-breaker-controls">
        <button onClick={resetAllCircuitBreakers}>Reset All Circuit Breakers</button>
      </div>
      
      <div className="circuit-breaker-list">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>State</th>
              <th>Failures</th>
              <th>Last State Change</th>
              <th>Success Rate</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {circuitBreakers.map(cb => (
              <tr key={cb.name} onClick={() => setSelectedCircuitBreaker(cb.name)}>
                <td>{cb.name}</td>
                <td>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: getStateColor(cb.state),
                      marginRight: '5px'
                    }}
                  />
                  {cb.state}
                </td>
                <td>{cb.totalFailures}</td>
                <td>{formatTimeAgo(cb.lastStateChange)}</td>
                <td>
                  {cb.totalCalls > 0
                    ? `${Math.round((cb.successfulCalls / cb.totalCalls) * 100)}%`
                    : 'N/A'}
                </td>
                <td>
                  <button onClick={() => resetCircuitBreaker(cb.name)}>Reset</button>
                  <button onClick={() => forceCircuitBreakerState(cb.name, CircuitState.CLOSED)}>
                    Force Closed
                  </button>
                  <button onClick={() => forceCircuitBreakerState(cb.name, CircuitState.OPEN)}>
                    Force Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {selectedCircuitBreaker && (
        <div className="circuit-breaker-details">
          <h3>Details for {selectedCircuitBreaker}</h3>
          
          {circuitBreakers
            .filter(cb => cb.name === selectedCircuitBreaker)
            .map(cb => (
              <div key={cb.name} className="circuit-breaker-detail-card">
                <div className="detail-row">
                  <div className="detail-label">State:</div>
                  <div className="detail-value">{cb.state}</div>
                </div>
                
                <div className="detail-row">
                  <div className="detail-label">Total Calls:</div>
                  <div className="detail-value">{cb.totalCalls}</div>
                </div>
                
                <div className="detail-row">
                  <div className="detail-label">Successful Calls:</div>
                  <div className="detail-value">{cb.successfulCalls}</div>
                </div>
                
                <div className="detail-row">
                  <div className="detail-label">Failed Calls:</div>
                  <div className="detail-value">{cb.failedCalls}</div>
                </div>
                
                <div className="detail-row">
                  <div className="detail-label">Prevented Calls:</div>
                  <div className="detail-value">{cb.preventedCalls}</div>
                </div>
                
                <div className="detail-row">
                  <div className="detail-label">Success Rate:</div>
                  <div className="detail-value">
                    {cb.totalCalls > 0
                      ? `${Math.round((cb.successfulCalls / cb.totalCalls) * 100)}%`
                      : 'N/A'}
                  </div>
                </div>
                
                <div className="detail-row">
                  <div className="detail-label">Last State Change:</div>
                  <div className="detail-value">{formatTimestamp(cb.lastStateChange)}</div>
                </div>
                
                <div className="detail-row">
                  <div className="detail-label">Last Failure:</div>
                  <div className="detail-value">{formatTimestamp(cb.lastFailure)}</div>
                </div>
                
                <div className="detail-row">
                  <div className="detail-label">Last Success:</div>
                  <div className="detail-value">{formatTimestamp(cb.lastSuccess)}</div>
                </div>
                
                <div className="detail-row">
                  <div className="detail-label">Consecutive Successes:</div>
                  <div className="detail-value">
                    {cb.consecutiveSuccesses} / {cb.requiredSuccesses}
                  </div>
                </div>
                
                <h4>Failures by Category</h4>
                <div className="failures-by-category">
                  <div className="detail-row">
                    <div className="detail-label">Network:</div>
                    <div className="detail-value">{cb.failures.network}</div>
                  </div>
                  
                  <div className="detail-row">
                    <div className="detail-label">Service:</div>
                    <div className="detail-value">{cb.failures.service}</div>
                  </div>
                  
                  <div className="detail-row">
                    <div className="detail-label">Validation:</div>
                    <div className="detail-value">{cb.failures.validation}</div>
                  </div>
                  
                  <div className="detail-row">
                    <div className="detail-label">Timeout:</div>
                    <div className="detail-value">{cb.failures.timeout}</div>
                  </div>
                  
                  <div className="detail-row">
                    <div className="detail-label">Unknown:</div>
                    <div className="detail-value">{cb.failures.unknown}</div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default CircuitBreakerDashboard;
