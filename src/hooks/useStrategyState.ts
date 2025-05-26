import { useState, useEffect, useCallback } from 'react';
import { eventBus } from '../lib/event-bus';
import { logService } from '../lib/log-service';
import type { Strategy } from '../lib/types';

/**
 * Custom hook for managing strategy state with real-time updates
 * Handles local state management and event emission for strategy changes
 */
export function useStrategyState(initialStrategy: Strategy) {
  const [strategy, setStrategy] = useState<Strategy>(initialStrategy);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Update strategy when prop changes
  useEffect(() => {
    setStrategy(initialStrategy);
  }, [initialStrategy]);

  // Listen for strategy update events
  useEffect(() => {
    const handleStrategyUpdate = (event: any) => {
      if (event.strategyId === strategy.id) {
        logService.log('debug', `Strategy ${strategy.id} updated via event`, event, 'useStrategyState');
        
        if (event.strategy) {
          setStrategy(event.strategy);
        } else if (event.status) {
          setStrategy(prev => ({
            ...prev,
            status: event.status,
            updated_at: new Date().toISOString()
          }));
        }
      }
    };

    // Listen for various strategy events
    eventBus.on('strategy:activated', handleStrategyUpdate);
    eventBus.on('strategy:deactivated', handleStrategyUpdate);
    eventBus.on('strategy:updated', handleStrategyUpdate);

    return () => {
      eventBus.off('strategy:activated', handleStrategyUpdate);
      eventBus.off('strategy:deactivated', handleStrategyUpdate);
      eventBus.off('strategy:updated', handleStrategyUpdate);
    };
  }, [strategy.id]);

  // Update strategy status locally and emit event
  const updateStrategyStatus = useCallback((newStatus: 'active' | 'inactive', updatedStrategy?: Strategy) => {
    const updated = updatedStrategy || {
      ...strategy,
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    setStrategy(updated);

    // Emit event for other components
    eventBus.emit('strategy:updated', {
      strategyId: strategy.id,
      strategy: updated,
      status: newStatus,
      timestamp: Date.now()
    });

    logService.log('info', `Strategy ${strategy.id} status updated to ${newStatus}`, {
      strategyId: strategy.id,
      newStatus
    }, 'useStrategyState');
  }, [strategy]);

  // Activate strategy with immediate UI update
  const activateStrategy = useCallback(async (activationFn: () => Promise<Strategy>) => {
    try {
      setIsActivating(true);
      
      // Call the activation function
      const activatedStrategy = await activationFn();
      
      // Update local state immediately
      updateStrategyStatus('active', activatedStrategy);
      
      return activatedStrategy;
    } catch (error) {
      logService.log('error', `Failed to activate strategy ${strategy.id}`, error, 'useStrategyState');
      throw error;
    } finally {
      setIsActivating(false);
    }
  }, [strategy.id, updateStrategyStatus]);

  // Deactivate strategy with immediate UI update
  const deactivateStrategy = useCallback(async (deactivationFn: () => Promise<Strategy>) => {
    try {
      setIsDeactivating(true);
      
      // Call the deactivation function
      const deactivatedStrategy = await deactivationFn();
      
      // Update local state immediately
      updateStrategyStatus('inactive', deactivatedStrategy);
      
      return deactivatedStrategy;
    } catch (error) {
      logService.log('error', `Failed to deactivate strategy ${strategy.id}`, error, 'useStrategyState');
      throw error;
    } finally {
      setIsDeactivating(false);
    }
  }, [strategy.id, updateStrategyStatus]);

  return {
    strategy,
    isActivating,
    isDeactivating,
    updateStrategyStatus,
    activateStrategy,
    deactivateStrategy
  };
}
