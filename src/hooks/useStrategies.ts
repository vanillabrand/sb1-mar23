import { useState, useEffect } from 'react';
import { marketService } from '../lib/market-service';
import { useAuth } from '../lib/auth-context';
import { logService } from '../lib/log-service';
import { strategySync } from '../lib/strategy-sync';
import { aiService } from '../lib/ai-service';
import type { Database } from '../lib/supabase-types';
import type { RiskLevel } from '../lib/types';

type Strategy = Database['public']['Tables']['strategies']['Row'];

interface CreateStrategyData {
  title: string;
  description: string | null;
  risk_level: RiskLevel;
}

export function useStrategies() {
  const { user, isDemoMode } = useAuth();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());
  const [error, setError] = useState<Error | null>(null);
  const [creatingStrategy, setCreatingStrategy] = useState(false);
  const [clearingStrategies, setClearingStrategies] = useState(false);

  useEffect(() => {
    if (user) {
      loadStrategies();

      // Subscribe to strategy updates
      const handleStrategyUpdate = (strategy: Strategy) => {
        setStrategies(prev => {
          const index = prev.findIndex(s => s.id === strategy.id);
          if (index === -1) {
            return [strategy, ...prev];
          } else {
            const updated = [...prev];
            updated[index] = strategy;
            return updated;
          }
        });
      };

      const handleStrategyDelete = (strategyId: string) => {
        setStrategies(prev => prev.filter(s => s.id !== strategyId));
      };

      const handleAllStrategiesCleared = () => {
        setStrategies([]);
      };

      strategySync.on('strategyUpdated', handleStrategyUpdate);
      strategySync.on('strategyDeleted', handleStrategyDelete);
      strategySync.on('allStrategiesCleared', handleAllStrategiesCleared);

      return () => {
        strategySync.off('strategyUpdated', handleStrategyUpdate);
        strategySync.off('strategyDeleted', handleStrategyDelete);
        strategySync.off('allStrategiesCleared', handleAllStrategiesCleared);
      };
    } else {
      setStrategies([]);
      setLoading(false);
    }
  }, [user, isDemoMode]);

  async function loadStrategies() {
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
      // Filter out strategies pending deletion
      setStrategies(allStrategies.filter(s => !pendingDeletions.has(s.id)));
      
      logService.log('info', `Loaded ${allStrategies.length} strategies`, null, 'useStrategies');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load strategies';
      setError(err instanceof Error ? err : new Error(errorMsg));
      logService.log('error', 'Failed to load strategies:', err, 'useStrategies');
    } finally {
      setLoading(false);
    }
  }

  async function createStrategy(data: CreateStrategyData) {
    if (!user) throw new Error('User not authenticated');
    
    try {
      setCreatingStrategy(true);
      setError(null);

      const strategy = await strategySync.createStrategy({
        ...data,
        user_id: user.id,
        type: 'custom',
        status: 'inactive',
        performance: 0
      });

      logService.log('info', 'Created new strategy', strategy, 'useStrategies');
      return strategy;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to create strategy');
      setError(err);
      logService.log('error', 'Failed to create strategy:', error, 'useStrategies');
      throw err;
    } finally {
      setCreatingStrategy(false);
    }
  }

  async function updateStrategy(id: string, updates: Partial<Strategy>) {
    if (!user) throw new Error('User not authenticated');

    try {
      setError(null);
      const updated = await strategySync.updateStrategy(id, updates);
      logService.log('info', `Updated strategy ${id}`, updated, 'useStrategies');
      return updated;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to update strategy');
      setError(err);
      logService.log('error', 'Failed to update strategy:', error, 'useStrategies');
      throw err;
    }
  }

  async function deleteStrategy(id: string): Promise<void> {
    if (!user) throw new Error('User not authenticated');
    
    try {
      // Add to pending deletions immediately
      setPendingDeletions(prev => new Set(prev).add(id));
      
      // Remove from local state immediately
      setStrategies(prev => prev.filter(s => s.id !== id));
      
      // Use market service to handle deletion
      await marketService.deleteStrategy(id);
      logService.log('info', `Strategy ${id} deleted successfully`, null, 'useStrategies');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete strategy';
      logService.log('error', 'Failed to delete strategy:', error, 'useStrategies');
      
      // Remove from pending deletions if failed
      setPendingDeletions(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      
      // Refresh to restore state if deletion failed
      await loadStrategies();
      
      throw new Error(message);
    }
  }

  async function clearAllStrategies() {
    if (!user) throw new Error('User not authenticated');

    try {
      setClearingStrategies(true);
      setError(null);
      await strategySync.clearAllStrategies();
      // Strategy list will be automatically cleared via strategySync events
      logService.log('info', 'Cleared all strategies', null, 'useStrategies');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to clear strategies');
      setError(err);
      logService.log('error', 'Failed to clear strategies:', error, 'useStrategies');
      throw err;
    } finally {
      setClearingStrategies(false);
    }
  }

  return {
    strategies,
    loading,
    error,
    creatingStrategy,
    clearingStrategies,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    clearAllStrategies,
    refresh: loadStrategies
  };
}