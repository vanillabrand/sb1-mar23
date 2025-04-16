export interface MarketData {
  timestamp: number;
  // Add other required fields
}

export type RiskLevel = 'Ultra Low' | 'Low' | 'Medium' | 'High' | 'Ultra High' | 'Extreme' | 'God Mode';

export type MarketType = 'spot' | 'margin' | 'futures';

export type MarketRegime = 'trending' | 'ranging' | 'volatile' | 'unknown';

export interface MarketAnalysis {
  regime: MarketRegime;
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
  volatility: number; // Normalized volatility (0-100)
  volume: {
    current: number;
    average: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  liquidity: {
    score: number; // 0-100
    spreadPercentage: number;
    depth: number;
  };
  support: number | null;
  resistance: number | null;
}

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
  marketType?: MarketType; // Added market type field
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  status: 'pending' | 'executed' | 'cancelled' | 'failed' | 'closed';  // Added 'closed'
  amount?: number;
  entryPrice?: number;
  exitPrice?: number;
  profit?: number;
  timestamp: number;
  strategyId?: string;
  createdAt?: string;
  executedAt?: string | null;
  marketType?: MarketType;
  leverage?: number; // Only used for futures trading
  stopLoss?: number; // Stop loss price
  takeProfit?: number; // Take profit price
  trailingStop?: number; // Trailing stop percentage
  orderType?: 'market' | 'limit'; // Order type
  marginType?: 'cross' | 'isolated'; // Margin type for futures/margin
  tradeValue?: number; // Total value of the trade
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
  // Market type and margin settings
  marketType?: MarketType;
  marginType?: 'cross' | 'isolated';
  leverage?: number;
  // Trade value
  tradeValue?: number;
  // Order type
  orderType?: 'market' | 'limit';
  // Risk management
  riskPercentage?: number;
  maxRiskAmount?: number;
  timeBasedExit?: number; // Time in milliseconds after which to exit
  // Add aliases for camelCase properties
  strategyId?: string;
}

export interface BacktestResult {
  returns: number[];
  positions: Record<string, number>;
  trades: {
    entryPrice: number;
    exitPrice: number;
    entryTime: Date;
    exitTime: Date;
    profit: number;
    size: number;
    processed?: boolean;
  }[];
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
  equityCurve?: { date: string; value: number }[];
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
  lastUpdated?: number;
  profit?: number;
  allocationPercentage?: number;
  profitPercentage?: number;
  marketType?: MarketType; // Added market type
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
  assets?: string[]; // New column added to the database schema
  strategy_config?: any; // Contains selected_pairs and other config
  config?: any; // Alternative field name that might be in the database
  data?: any; // Alternative field name that might be in the database
  marketType?: MarketType; // Market type (spot, margin, futures)
  metrics?: {
    winRate: number;
    profitFactor: number;
    averageProfit: number;
    maxDrawdown: number;
  };
}

export interface CreateStrategyData {
  title: string;
  name?: string; // Added name field to match database schema requirement
  description: string;
  riskLevel: RiskLevel;
  type?: string;
  status?: 'active' | 'inactive' | 'paused';
  selected_pairs?: string[];
  strategy_config?: any;
  marketType?: MarketType; // Market type (spot, margin, futures)
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

export interface RiskManagementConfig {
  // Position sizing
  maxPositionSizePercentage: number; // Maximum percentage of available budget for a single trade
  dynamicPositionSizing: boolean; // Whether to adjust position size based on volatility
  volatilityAdjustment: boolean; // Reduce position size in high volatility
  correlationAdjustment: boolean; // Reduce position size for correlated assets

  // Stop loss strategies
  stopLossType: 'fixed' | 'atr' | 'support' | 'percent'; // Type of stop loss
  fixedStopLossPercentage?: number; // Fixed percentage for stop loss
  atrMultiplier?: number; // Multiplier for ATR-based stop loss
  useVolatilityBasedStops: boolean; // Whether to use volatility for stop loss calculation

  // Take profit strategies
  takeProfitType: 'fixed' | 'riskReward' | 'resistance' | 'trailing';
  fixedTakeProfitPercentage?: number; // Fixed percentage for take profit
  riskRewardRatio?: number; // Risk-reward ratio for take profit
  usePartialTakeProfits: boolean; // Whether to use partial take profits
  partialTakeProfitLevels?: number[]; // Levels for partial take profits (percentages)

  // Time-based exits
  useTimeBasedExit: boolean; // Whether to use time-based exits
  maxTradeDuration?: number; // Maximum duration for a trade in milliseconds

  // Risk limits
  maxRiskPerTrade: number; // Maximum risk per trade as percentage of account
  maxRiskPerDay: number; // Maximum risk per day as percentage of account
  maxDrawdown: number; // Maximum drawdown before stopping trading

  // Kelly criterion
  useKellyCriterion: boolean; // Whether to use Kelly criterion for position sizing
  kellyFraction?: number; // Fraction of Kelly to use (0.5 = half Kelly)
}
