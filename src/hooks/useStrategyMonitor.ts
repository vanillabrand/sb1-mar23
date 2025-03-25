import { useState, useEffect } from 'react';
import { marketService } from '../lib/market-service';
import type { Database } from '../lib/supabase-types';

type Strategy = Database['public']['Tables']['strategies']['Row'];
type StrategyTrade = Database['public']['Tables']['strategy_trades']['Row'];

export function useStrategyMonitor(strategy: Strategy) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [trades, setTrades] = useState<StrategyTrade[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!strategy) return;

    const handleTradeExecuted = (data: { type: string; trade: StrategyTrade }) => {
      if (data.trade.strategy_id === strategy.id) {
        setTrades(prev => {
          const existing = prev.findIndex(t => t.id === data.trade.id);
          if (existing >= 0) {
            return [...prev.slice(0, existing), data.trade, ...prev.slice(existing + 1)];
          }
          return [data.trade, ...prev];
        });
      }
    };

    marketService.on('tradeExecuted', handleTradeExecuted);

    return () => {
      marketService.off('tradeExecuted', handleTradeExecuted);
    };
  }, [strategy]);

  const startMonitoring = async () => {
    try {
      setError(null);
      await marketService.startStrategyMonitoring(strategy);
      setIsMonitoring(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to start monitoring'));
      setIsMonitoring(false);
    }
  };

  const stopMonitoring = async () => {
    try {
      setError(null);
      await marketService.stopStrategyMonitoring(strategy.id);
      setIsMonitoring(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to stop monitoring'));
    }
  };

  return {
    isMonitoring,
    trades,
    error,
    startMonitoring,
    stopMonitoring
  };
}