export type StrategyStatus = 'active' | 'inactive';
export type MonitoringStatus = 'monitoring' | 'generating' | 'executing' | 'idle';

export interface Strategy {
  id: string;
  status: StrategyStatus;
  // ... other strategy fields
}

export interface MonitoringState {
  strategy_id: string;
  status: MonitoringStatus;
  message: string;
  indicators: Record<string, number>;
  market_conditions: any;
  updated_at: string;
}