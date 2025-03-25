import { useState, useEffect } from 'react';
import { StrategyService } from '../lib/strategy-service';
import type { Database } from '../lib/supabase-types';

type StrategyTrade = Database['public']['Tables']['strategy_trades']['Row'];

export function useStrategyTrades(strategyId: string) {
  const [trades, setTrades] = useState<StrategyTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (strategyId) {
      loadTrades();
    }
  }, [strategyId]);

  async function loadTrades() {
    try {
      setLoading(true);
      const data = await StrategyService.getStrategyTrades(strategyId);
      setTrades(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load trades'));
    } finally {
      setLoading(false);
    }
  }

  async function createTrade(data: Omit<StrategyTrade, 'id' | 'created_at' | 'updated_at'>) {
    try {
      const trade = await StrategyService.createTrade(data);
      setTrades(prev => [trade, ...prev]);
      return trade;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create trade');
    }
  }

  async function updateTrade(id: string, data: Partial<StrategyTrade>) {
    try {
      const updated = await StrategyService.updateTrade(id, data);
      setTrades(prev => prev.map(t => t.id === id ? updated : t));
      return updated;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update trade');
    }
  }

  async function deleteTrade(id: string) {
    try {
      await StrategyService.deleteTrade(id);
      setTrades(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete trade');
    }
  }

  return {
    trades,
    loading,
    error,
    createTrade,
    updateTrade,
    deleteTrade,
    refresh: loadTrades
  };
}