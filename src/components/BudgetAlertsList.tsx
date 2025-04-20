import React, { useState, useEffect } from 'react';
import { budgetAlertService, BudgetAlert } from '../lib/budget-alert-service';
import { logService } from '../lib/log-service';

interface BudgetAlertsListProps {
  strategyId: string;
  limit?: number;
  showAcknowledged?: boolean;
  onAcknowledge?: (alertId: string) => void;
}

const BudgetAlertsList: React.FC<BudgetAlertsListProps> = ({
  strategyId,
  limit = 5,
  showAcknowledged = false,
  onAcknowledge
}) => {
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await budgetAlertService.getAlerts(strategyId, showAcknowledged);
        setAlerts(data.slice(0, limit));
        
        logService.log('info', `Loaded ${data.length} budget alerts for strategy ${strategyId}`, 
          null, 'BudgetAlertsList');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load alerts: ${errorMessage}`);
        logService.log('error', `Failed to load budget alerts for strategy ${strategyId}`, 
          err, 'BudgetAlertsList');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    
    // Subscribe to alert events
    const handleNewAlert = (event: CustomEvent) => {
      const alert = event.detail;
      if (alert.strategyId === strategyId) {
        fetchAlerts();
      }
    };
    
    window.addEventListener('budget:alert', handleNewAlert as EventListener);
    window.addEventListener('budget:alertAcknowledged', handleNewAlert as EventListener);
    
    return () => {
      window.removeEventListener('budget:alert', handleNewAlert as EventListener);
      window.removeEventListener('budget:alertAcknowledged', handleNewAlert as EventListener);
    };
  }, [strategyId, limit, showAcknowledged]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await budgetAlertService.acknowledgeAlert(alertId);
      
      if (onAcknowledge) {
        onAcknowledge(alertId);
      }
      
      // Update the local state
      setAlerts(prevAlerts => {
        if (showAcknowledged) {
          // Just mark as acknowledged
          return prevAlerts.map(alert => 
            alert.id === alertId ? { ...alert, acknowledged: true } : alert
          );
        } else {
          // Remove from list
          return prevAlerts.filter(alert => alert.id !== alertId);
        }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logService.log('error', `Failed to acknowledge alert ${alertId}`, err, 'BudgetAlertsList');
      setError(`Failed to acknowledge alert: ${errorMessage}`);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return (
          <div className="flex-shrink-0 w-5 h-5 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className="flex-shrink-0 w-5 h-5 text-yellow-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex-shrink-0 w-5 h-5 text-blue-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
          </div>
        );
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'low_funds':
        return 'Low Funds';
      case 'validation':
        return 'Validation';
      case 'allocation':
        return 'Allocation';
      case 'profit':
        return 'Profit';
      case 'loss':
        return 'Loss';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse text-gray-400 p-4">
        Loading alerts...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm p-4 bg-red-900/20 rounded-md">
        {error}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-gray-400 text-sm p-4 bg-gunmetal-800 rounded-md">
        No budget alerts for this strategy.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div 
          key={alert.id || alert.timestamp} 
          className={`flex items-start p-3 rounded-md ${
            alert.severity === 'error' ? 'bg-red-900/20 border border-red-500/30' :
            alert.severity === 'warning' ? 'bg-yellow-900/20 border border-yellow-500/30' :
            'bg-blue-900/20 border border-blue-500/30'
          } ${alert.acknowledged ? 'opacity-60' : ''}`}
        >
          {getAlertIcon(alert.severity)}
          
          <div className="ml-3 flex-1">
            <div className="flex justify-between items-start">
              <div className="text-sm font-medium text-white">
                {getAlertTypeLabel(alert.type)}
              </div>
              <div className="text-xs text-gray-400">
                {formatTimestamp(alert.timestamp)}
              </div>
            </div>
            
            <div className="mt-1 text-sm text-gray-300">
              {alert.message}
            </div>
            
            {!alert.acknowledged && onAcknowledge && (
              <button
                onClick={() => handleAcknowledge(alert.id!)}
                className="mt-2 text-xs text-gray-400 hover:text-white"
              >
                Acknowledge
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BudgetAlertsList;
