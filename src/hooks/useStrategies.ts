import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { strategySync } from '../lib/strategy-sync';
import { logService } from '../lib/log-service';
import { eventBus } from '../lib/event-bus';
import type { Strategy, CreateStrategyData } from '../lib/types';

export function useStrategies() {
  const { user } = useAuth();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pendingDeletions] = useState<Set<string>>(new Set());

  const refreshStrategies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setStrategies([]);
        return [];
      }

      // Force a complete refresh from the database
      await strategySync.initialize();

      // Get all strategies
      const allStrategies = strategySync.getAllStrategies();

      // Filter out any pending deletions
      const filteredStrategies = allStrategies.filter(s => !pendingDeletions.has(s.id));

      // Update state with a new array to ensure React detects the change
      setStrategies(filteredStrategies as unknown as Strategy[]);

      console.log('Refreshed strategies:', filteredStrategies.length);
      logService.log('info', `Loaded ${filteredStrategies.length} strategies`, null, 'useStrategies');

      return filteredStrategies;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load strategies';
      setError(err instanceof Error ? err : new Error(errorMsg));
      logService.log('error', 'Failed to load strategies:', err, 'useStrategies');
      throw err; // Propagate error to caller
    } finally {
      setLoading(false);
    }
  }, [user, pendingDeletions]);

  const createStrategy = useCallback(async (data: CreateStrategyData): Promise<Strategy> => {
    try {
      const strategy = await strategySync.createStrategy(data);
      await refreshStrategies(); // Refresh the list after creating
      return strategy as unknown as Strategy;
    } catch (error) {
      logService.log('error', 'Failed to create strategy:', error, 'useStrategies');
      throw error;
    }
  }, [refreshStrategies]);

  // Load strategies on mount and when user changes
  useEffect(() => {
    refreshStrategies();
  }, [refreshStrategies]);

  // Listen for strategy updates from other components
  useEffect(() => {
    const handleStrategiesUpdated = (updatedStrategies: Strategy[]) => {
      setStrategies(updatedStrategies);
    };

    // Subscribe to the strategies:updated event
    const unsubscribe = eventBus.subscribe('strategies:updated', handleStrategiesUpdated);

    return () => {
      // Clean up the subscription when the component unmounts
      unsubscribe();
    };
  }, []);

  return {
    strategies,
    loading,
    error,
    refreshStrategies,
    createStrategy
  };
}
