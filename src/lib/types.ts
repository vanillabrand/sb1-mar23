export interface MarketData {
  timestamp: number;
  // Add other required fields
}

export type RiskLevel = 'Ultra Low' | 'Low' | 'Medium' | 'High' | 'Ultra High' | 'Extreme' | 'God Mode';

export interface Strategy {
  id: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  status: 'active' | 'inactive' | 'paused';
  type: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  performance: number;
  selected_pairs: string[];
  strategy_config: any;
}

export interface Trade {
  id: string;
  price: number;
  quantity: number;
  timestamp: number;
  side: 'buy' | 'sell';
  symbol: string;
  status: 'pending' | 'executed' | 'cancelled' | 'failed';
}

export interface IndicatorConfig {
  type: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BB';
  period?: number;
  signal?: number;
}

export interface IndicatorResult {
  value: number;
  signal?: number;
  timestamp: number;
}

export interface StrategyBudget {
  total: number;
  allocated: number;
  available: number;
  maxPositionSize: number;
}

export interface StrategyTemplate {
  id: string;
  title: string;
  description: string;
  riskLevel?: RiskLevel;
  risk_level?: RiskLevel; // Database uses snake_case
  type: 'system_template' | 'user_template';
  user_id?: string;
  created_at: string;
  updated_at: string;
  performance?: number; // Not in the database schema
  selected_pairs?: string[]; // Not in the database schema, stored in strategy_config
  strategy_config?: any; // Contains selected_pairs and other config
  config?: any; // Alternative field name that might be in the database
  data?: any; // Alternative field name that might be in the database
  metrics?: {
    winRate: number;
    profitFactor: number;
    averageProfit: number;
    maxDrawdown: number;
  };
}

export interface CreateStrategyData {
  title: string;
  description: string;
  riskLevel: RiskLevel;
  type?: string;
  status?: 'active' | 'inactive' | 'paused';
  selected_pairs?: string[];
  strategy_config?: any;
}

export interface MarketCondition {
  timestamp: number;
  volatility: number;
  trend: 'up' | 'down' | 'sideways';
  volume: {
    current: number;
    average: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  liquidity: {
    score: number;
    spreadAvg: number;
    depth: number;
  };
  sentiment: {
    score: number;
    signals: string[];
  };
}
