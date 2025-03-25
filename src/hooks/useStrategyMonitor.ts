import { useState, useEffect } from 'react';
import { marketService } from '../lib/market-service';
import { logService } from '../lib/log-service';
import type { Database } from '../lib/supabase-types';

type Strategy = Database['public']['Tables']['strategies']['Row'];
type StrategyTrade = Database['public']['Tables']['strategy_trades']['Row'];

export function useStrategyMonitor(strategy: Strategy) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [trades, setTrades] = useState<StrategyTrade[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

    // Start monitoring if the strategy is active
    if (strategy.status === 'active') {
      const startMonitoring = async () => {
        try {
          setIsLoading(true);
          setError(null);
          
          // Fetch initial trades
          const initialTrades = await marketService.getStrategyTrades(strategy.id);
          setTrades(initialTrades);
          
          // Start the monitoring process
          await marketService.startStrategyMonitoring(strategy.id);
          setIsMonitoring(true);
          
          logService.log('info', `Started monitoring strategy ${strategy.id}`, null, 'useStrategyMonitor');
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          logService.log('error', `Failed to start monitoring strategy ${strategy.id}`, err, 'useStrategyMonitor');
          setError(new Error(`Failed to start monitoring: ${errorMessage}`));
          setIsMonitoring(false);
        } finally {
          setIsLoading(false);
        }
      };
      
      startMonitoring();
      
      // Subscribe to trade events
      marketService.on('tradeExecuted', handleTradeExecuted);
      
      return () => {
        marketService.off('tradeExecuted', handleTradeExecuted);
        if (isMonitoring) {
          marketService.stopStrategyMonitoring(strategy.id)
            .catch(err => logService.log('error', `Error stopping strategy monitoring: ${strategy.id}`, err, 'useStrategyMonitor'));
        }
        setIsMonitoring(false);
      };
    }
  }, [strategy]);

  return { isMonitoring, isLoading, trades, error };
}
