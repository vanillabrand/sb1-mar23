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
      // Log the data we're trying to create
      console.log('useStrategies: Creating strategy with data:', {
        title: data.title,
        name: data.name,
        risk_level: data.risk_level,
        riskLevel: data.riskLevel,
        selected_pairs: data.selected_pairs?.length || 0,
        marketType: data.marketType,
        market_type: data.market_type
      });

      // Create the strategy
      const strategy = await strategySync.createStrategy(data);

      // Validate the returned strategy
      if (!strategy || !strategy.id) {
        const error = new Error('Failed to create strategy - no valid strategy data returned');
        logService.log('error', error.message, { data }, 'useStrategies');
        throw error;
      }

      // Log success
      console.log('useStrategies: Strategy created successfully:', strategy.id);

      // Emit an event to notify other components
      eventBus.emit('strategy:created', strategy);

      // Refresh the list after creating
      await refreshStrategies();

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

    const handleStrategyCreated = (data: any) => {
      // Handle both formats: direct strategy object or {strategy} object
      const newStrategy = data.strategy || data;

      if (!newStrategy || !newStrategy.id) {
        console.warn('Received invalid strategy data:', data);
        return;
      }

      console.log('Strategy created event received in useStrategies:', newStrategy.id);

      // Immediately add the new strategy to the list
      setStrategies(prevStrategies => {
        // Only add if not already in the list
        if (!prevStrategies.some(s => s.id === newStrategy.id)) {
          console.log('Adding new strategy to list:', newStrategy.id);
          return [...prevStrategies, newStrategy];
        }
        console.log('Strategy already in list:', newStrategy.id);
        return prevStrategies;
      });

      // Force a refresh to ensure we have the latest data
      setTimeout(() => {
        refreshStrategies().catch(error => {
          console.error('Error refreshing strategies after creation:', error);
        });
      }, 500);
    };

    // Subscribe to events
    const unsubscribeUpdated = eventBus.subscribe('strategies:updated', handleStrategiesUpdated);
    const unsubscribeCreated = eventBus.subscribe('strategy:created', handleStrategyCreated);

    return () => {
      // Clean up the subscriptions when the component unmounts
      unsubscribeUpdated();
      unsubscribeCreated();
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
