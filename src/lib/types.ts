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
  symbol: string;
  side: 'buy' | 'sell';
  status: 'pending' | 'executed' | 'cancelled' | 'failed';
  entryPrice?: number;
  exitPrice?: number;
  profit?: number;
  timestamp: number;
  strategyId?: string;
  createdAt?: string;
  executedAt?: string | null;
}

export interface TradeOptions {
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  strategy_id?: string;
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
  trailing_stop?: number;
  demo?: boolean;
  testnet?: boolean;
  type?: 'market' | 'limit';
  // Add aliases for camelCase properties
  strategyId?: string;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
}

export interface TradeResult {
  id: string;
  status: string;
  timestamp: number;
  details: any;
}

export interface TradeStatus {
  status: string;
  lastUpdate: number;
  timestamp?: number;
  symbol?: string;
  side?: 'buy' | 'sell';
  entryPrice?: number;
  exitPrice?: number;
  profit?: number;
  strategyId?: string;
  createdAt?: string;
  executedAt?: string | null;
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

export type ExchangeId = 'binance' | 'bitmart' | 'kucoin' | 'coinbase' | 'kraken' | string;

export interface ExchangeCredentials {
  apiKey: string;
  secret: string;
  memo?: string;
}

export interface ExchangeConfig {
  name: string;
  apiKey: string;
  secret: string;
  memo?: string;
  testnet?: boolean;
  useUSDX?: boolean;
}

// Exchange interface for compatibility with ccxt
export interface Exchange {
  id: string;
  credentials: ExchangeCredentials;
  spotSupported?: boolean;
  marginSupported?: boolean;
  futuresSupported?: boolean;
}

// Wallet balance interface
export interface WalletBalance {
  free: number;
  used: number;
  total: number;
  currency: string;
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

export interface MarketInsight {
  timestamp: number;
  assets: {
    symbol: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    signals: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }[];
  marketConditions: {
    trend: 'bullish' | 'bearish' | 'sideways';
    volatility: 'low' | 'medium' | 'high';
    volume: 'low' | 'medium' | 'high';
  };
  recommendations: string[];
}

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  imageUrl?: string;
  publishedAt: string;
  relatedAssets?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  summary?: string;
}

export interface TradeSignal {
  id?: string;
  strategy_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  quantity?: number;
  confidence?: number;
  signal_type?: 'entry' | 'exit';
  status?: 'pending' | 'executed' | 'cancelled';
  expires_at?: string;
  executed_at?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  metadata?: any;
}

export interface TradeConfig {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  leverage?: number;
  margin?: boolean;
  timeInForce?: string;
}

export interface TradeAnalysis {
  shouldClose: boolean;
  shouldAdjustStops: boolean;
  reason: string;
  recommendedStops?: {
    stopLoss?: number;
    takeProfit?: number;
    trailingStop?: number;
  };
}

export interface MarketFitAnalysis {
  score: number;
  confidence: number;
  reasons: string[];
  recommendations: string[];
}
