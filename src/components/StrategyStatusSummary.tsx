import React, { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Activity, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { eventBus } from '../lib/event-bus';
import { demoService } from '../lib/demo-service';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';
import type { Strategy, Trade } from '../lib/types';

interface StrategyStatusProps {
  strategyId: string;
}

export const StrategyStatusSummary: React.FC<StrategyStatusProps> = ({ strategyId }) => {
  const [strategy, setStrategy] = useState<any>(null);
  const [monitoringStatus, setMonitoringStatus] = useState<any>(null);

  useEffect(() => {
    // Load initial data
    const loadData = async () => {
      // Load strategy status
      const { data: strategyData } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', strategyId)
        .single();

      if (strategyData) setStrategy(strategyData);

      // Load monitoring status
      const { data: monitoringData } = await supabase
        .from('monitoring_status')
        .select('*')
        .eq('strategy_id', strategyId)
        .single();

      if (monitoringData) setMonitoringStatus(monitoringData);
    };

    loadData();

    // Subscribe to both status types
    const strategySubscription = supabase
      .channel(`strategy_${strategyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'strategies', filter: `id=eq.${strategyId}` },
        (payload) => {
          if (payload.new) setStrategy(payload.new);
        }
      )
      .subscribe();

    const monitoringSubscription = supabase
      .channel(`monitoring_${strategyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'monitoring_status', filter: `strategy_id=eq.${strategyId}` },
        (payload) => {
          if (payload.new) setMonitoringStatus(payload.new);
        }
      )
      .subscribe();

    return () => {
      strategySubscription.unsubscribe();
      monitoringSubscription.unsubscribe();
    };
  }, [strategyId]);

  return (
    <div className="strategy-status">
      <div className="status-row">
        <span>Strategy Status:</span>
        <StatusBadge status={strategy?.status || 'unknown'} />
      </div>
      <div className="status-row">
        <span>Monitoring Status:</span>
        <StatusBadge status={monitoringStatus?.status || 'idle'} />
        <span className="message">{monitoringStatus?.message}</span>
      </div>
    </div>
  );
};
