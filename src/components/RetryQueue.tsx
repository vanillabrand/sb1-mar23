import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { retryService, FailedOperation } from '../lib/retry-service';
import { eventBus } from '../lib/event-bus';
import { logService } from '../lib/log-service';
import { formatDistanceToNow } from 'date-fns';

const RetryQueue: React.FC = () => {
  const [failedOperations, setFailedOperations] = useState<FailedOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOperations, setExpandedOperations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load failed operations on mount
    loadFailedOperations();

    // Subscribe to events
    const subscriptions = [
      eventBus.on('retry:operationRecorded', handleOperationRecorded),
      eventBus.on('retry:operationSucceeded', handleOperationSucceeded),
      eventBus.on('retry:operationFailed', handleOperationFailed),
      eventBus.on('retry:operationCancelled', handleOperationCancelled)
    ];

    // Set up real-time subscription
    const subscription = supabase
      .channel('failed_operations_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'failed_operations' 
      }, () => {
        loadFailedOperations();
      })
      .subscribe();

    // Clean up
    return () => {
      subscriptions.forEach(unsub => unsub());
      subscription.unsubscribe();
    };
  }, []);

  const loadFailedOperations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('failed_operations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setFailedOperations(data || []);
    } catch (error) {
      logService.log('error', 'Failed to load retry operations', error, 'RetryQueue');
    } finally {
      setLoading(false);
    }
  };

  const handleOperationRecorded = () => {
    loadFailedOperations();
  };

  const handleOperationSucceeded = ({ operationId }: { operationId: string }) => {
    setFailedOperations(prev => 
      prev.map(op => 
        op.id === operationId ? { ...op, status: 'succeeded' } : op
      )
    );
  };

  const handleOperationFailed = ({ operationId }: { operationId: string }) => {
    setFailedOperations(prev => 
      prev.map(op => 
        op.id === operationId ? { ...op, status: 'failed' } : op
      )
    );
  };

  const handleOperationCancelled = ({ operationId }: { operationId: string }) => {
    setFailedOperations(prev => 
      prev.map(op => 
        op.id === operationId ? { ...op, status: 'cancelled' } : op
      )
    );
  };

  const handleRetry = async (operationId: string) => {
    try {
      await retryService.retryOperation(operationId);
      loadFailedOperations();
    } catch (error) {
      logService.log('error', `Failed to retry operation ${operationId}`, error, 'RetryQueue');
    }
  };

  const handleCancel = async (operationId: string) => {
    try {
      await retryService.cancelRetry(operationId);
      loadFailedOperations();
    } catch (error) {
      logService.log('error', `Failed to cancel operation ${operationId}`, error, 'RetryQueue');
    }
  };

  const toggleExpand = (operationId: string) => {
    setExpandedOperations(prev => ({
      ...prev,
      [operationId]: !prev[operationId]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-500';
      case 'in_progress': return 'text-blue-500';
      case 'succeeded': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'cancelled': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  const getOperationTypeLabel = (type: string) => {
    switch (type) {
      case 'trade_creation': return 'Trade Creation';
      case 'trade_execution': return 'Trade Execution';
      case 'order_cancellation': return 'Order Cancellation';
      case 'strategy_activation': return 'Strategy Activation';
      case 'strategy_deactivation': return 'Strategy Deactivation';
      case 'market_data_fetch': return 'Market Data Fetch';
      default: return type;
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (e) {
      return 'Invalid date';
    }
  };

  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Retry Queue</h2>
        <button 
          onClick={loadFailedOperations}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : failedOperations.length === 0 ? (
        <div className="text-center py-4 text-gray-400">No failed operations in queue</div>
      ) : (
        <div className="space-y-3">
          {failedOperations.map(operation => (
            <div 
              key={operation.id} 
              className="bg-gray-800 rounded-lg p-3 transition-all duration-200 hover:bg-gray-750"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center">
                    <span className={`font-medium ${getStatusColor(operation.status || 'pending')}`}>
                      {operation.status?.toUpperCase()}
                    </span>
                    <span className="mx-2">•</span>
                    <span className="font-medium">{getOperationTypeLabel(operation.operation_type)}</span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {operation.operation_data?.symbol && (
                      <span className="mr-2">{operation.operation_data.symbol}</span>
                    )}
                    <span>{formatTime(operation.created_at || '')}</span>
                    {operation.retry_count !== undefined && operation.retry_count > 0 && (
                      <span className="ml-2">• {operation.retry_count} retries</span>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {operation.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleRetry(operation.id || '')}
                        className="px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Retry Now
                      </button>
                      <button
                        onClick={() => handleCancel(operation.id || '')}
                        className="px-2 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => toggleExpand(operation.id || '')}
                    className="px-2 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-600"
                  >
                    {expandedOperations[operation.id || ''] ? 'Hide' : 'Details'}
                  </button>
                </div>
              </div>

              {expandedOperations[operation.id || ''] && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-sm">
                    <div className="mb-2">
                      <span className="text-gray-400">Error: </span>
                      <span className="text-red-400">{operation.error_message}</span>
                    </div>
                    {operation.next_retry_at && (
                      <div className="mb-2">
                        <span className="text-gray-400">Next retry: </span>
                        <span>{formatTime(operation.next_retry_at)}</span>
                      </div>
                    )}
                    <div className="mb-2">
                      <span className="text-gray-400">Operation data: </span>
                      <pre className="mt-1 bg-gray-900 p-2 rounded overflow-x-auto text-xs">
                        {JSON.stringify(operation.operation_data, null, 2)}
                      </pre>
                    </div>
                    {operation.error_details && (
                      <div>
                        <span className="text-gray-400">Error details: </span>
                        <pre className="mt-1 bg-gray-900 p-2 rounded overflow-x-auto text-xs">
                          {JSON.stringify(operation.error_details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RetryQueue;
