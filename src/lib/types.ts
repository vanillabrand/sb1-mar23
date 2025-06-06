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


export interface BaseStrategy {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  status: 'active' | 'inactive' | 'paused' | 'stopped';
  performance: number;
  config: Json;
  performance_metrics: Json;
  /** @deprecated Use marketType instead */
  market_type?: MarketType;
  marketType?: MarketType;
  type?: string;
  selected_pairs?: string[];
  strategy_config?: any;
}

export interface Strategy extends BaseStrategy {}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface ApiStrategy extends BaseStrategy {
  // Override status to match API expectations
  status: 'active' | 'paused' | 'stopped';
  // Make name required for API
  name: string;
  // Make description required for API
  description: string;
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
  // Exchange information
  exchangeId?: string;
  exchange_id?: string;
  // Entry and exit conditions
  entryConditions?: string[] | string;
  entry_conditions?: string[] | string;
  exitConditions?: string[] | string;
  exit_conditions?: string[] | string;
  // Metadata
  metadata?: any;
  // Risk level
  risk_level?: string;
  riskLevel?: string;
  // Confidence level (0-1)
  confidence?: number;
  // Price (alias for entry_price)
  price?: number;
  // Add aliases for camelCase properties
  strategyId?: string;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  // Trade ID for tracking
  trade_id?: string;
  tradeId?: string;
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
  exchangeId?: string;
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
  strategy_id?: string;
  createdAt?: string;
  executedAt?: string | null;
  amount?: number;
  entry_price?: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  highestPrice?: number;
  lowestPrice?: number;
  entryConditions?: string[] | string;
  exitConditions?: string[] | string;
  entry_conditions?: string[] | string;
  exit_conditions?: string[] | string;
  currentPrice?: number;
  exchangeId?: string;
  exchange_id?: string;
  marketType?: MarketType;
}

export interface ExchangeHealth {
  ok: boolean;
  degraded?: boolean;
  message?: string;
  timestamp: string;
}

export interface IndicatorConfig {
  type: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BB' | 'ADX' | 'ATR' | 'STOCH' | 'CCI' | 'OBV' |
        'ICHIMOKU' | 'PSAR' | 'MFI' | 'VWAP' | 'SUPERTREND' | 'PIVOT';
  period?: number;
  signal?: number;
  signalPeriod?: number;
  acceleration?: number;
  maximum?: number;
  multiplier?: number;
  fastPeriod?: number;
  slowPeriod?: number;
}

export interface IndicatorResult {
  name: string;
  value: number;
  signal?: number;
  timestamp: number;
  metadata?: {
    period?: number;
    standardDeviation?: number;
    upper?: number;
    lower?: number;
    signal?: number;
    histogram?: number;
    k?: number;
    d?: number;
    kValues?: number[];
    dValues?: number[];
    sma?: number;
    meanDeviation?: number;
    typicalPrice?: number;
    obvValues?: number[];
    tenkanSen?: number;
    kijunSen?: number;
    senkouSpanA?: number;
    senkouSpanB?: number;
    chikouSpan?: number;
    cloud?: 'bullish' | 'bearish';
    currentPrice?: number;
    trend?: string;
    sarValues?: number[];
    trends?: string[];
    positiveFlow?: number;
    negativeFlow?: number;
    moneyFlowRatio?: number;
    cumulativeTPV?: number;
    cumulativeVolume?: number;
    atr?: number;
    superTrends?: number[];
    pivot?: number;
    r1?: number;
    r2?: number;
    r3?: number;
    s1?: number;
    s2?: number;
    s3?: number;
    high?: number;
    low?: number;
    close?: number;
    plusDI?: number;
    minusDI?: number;
    dx?: number;
    trueRanges?: number[];
    [key: string]: any;
  };
}

export interface MarketTypeBalance {
  total: number;
  allocated: number;
  available: number;
  profit: number;
  trades: number; // Number of trades in this market type
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
  market_type?: MarketType; // Database column name
  marketType?: MarketType; // For backward compatibility

  // Market type specific balances
  marketTypeBalances?: {
    spot?: MarketTypeBalance;
    margin?: MarketTypeBalance;
    futures?: MarketTypeBalance;
  };
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
  name: string;
  credentials?: ExchangeCredentials;
  encrypted_credentials?: string;
  memo?: string;
  testnet?: boolean;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  use_usdx?: boolean;
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

export interface CreateStrategyData extends Pick<BaseStrategy,
  'title' | 'description' | 'riskLevel' | 'marketType' | 'market_type'
> {
  name?: string;
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

// Trade Service interface
export interface TradeService {
  setBudget(strategyId: string, budget: StrategyBudget | null): Promise<void>;
  getBudget(strategyId: string): StrategyBudget | null;
  getAllBudgets(): Map<string, StrategyBudget>;
  calculateAvailableBudget(): number;
  setDemoMode(isDemo: boolean): void;
  isDemoMode(): boolean;
  reserveBudgetForTrade(strategyId: string, amount: number, tradeId?: string): boolean;
  releaseBudgetFromTrade(strategyId: string, amount: number, profit?: number, tradeId?: string): void;
  releaseBudget(strategyId: string, amount: number): void;
  clearAllBudgets(): void;
  isInitialized(): boolean;
  createDefaultBudget(): StrategyBudget;
  createTrade(tradeData: any): Promise<any>;
  connectStrategyToTradingEngine(strategyId: string): Promise<boolean>;
  removeTradesByStrategy(strategyId: string): Promise<boolean>;
  updateBudgetAfterTrade(strategyId: string, amount: number, profit?: number, tradeId?: string): Promise<void>;
  resetActiveStrategies(): Promise<boolean>;
}
