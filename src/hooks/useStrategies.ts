import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { strategySync } from '../lib/strategy-sync';
import { logService } from '../lib/log-service';
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
        return;
      }

      if (!strategySync.isSyncing()) {
        await strategySync.initialize();
      }
      
      const allStrategies = strategySync.getAllStrategies();
      setStrategies(allStrategies.filter(s => !pendingDeletions.has(s.id)));
      
      logService.log('info', `Loaded ${allStrategies.length} strategies`, null, 'useStrategies');
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
      return strategy;
    } catch (error) {
      logService.log('error', 'Failed to create strategy:', error, 'useStrategies');
      throw error;
    }
  }, [refreshStrategies]);

  // Load strategies on mount and when user changes
  useEffect(() => {
    refreshStrategies();
  }, [refreshStrategies]);

  return {
    strategies,
    loading,
    error,
    refreshStrategies,
    createStrategy
  };
}
