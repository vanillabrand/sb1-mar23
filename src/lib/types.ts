// Import CCXT types only
import type { Exchange as CCXTExchange, exchanges } from 'ccxt';

// Define exchange types without direct CCXT reference
export type Exchange = CCXTExchange;
export type ExchangeCredentials = {
  apiKey: string;
  secret: string;
  memo?: string;
};

// Use string literal type instead of CCXT reference
export type ExchangeId = 
  | 'bitmart'
  | 'bitget'
  | 'coinbase'
  | 'kraken'
  | 'binance'
  | 'bybit'
  | 'upbit'
  | 'okx'
  | 'mexc'
  | 'gateio'
  | 'kucoin'
  | 'cryptocom'
  | 'bitfinex'
  | 'bitstamp'
  | 'pionex';

export interface ExchangeConfig {
  name: string;
  apiKey: string;
  secret: string;
  memo?: string;
  testnet?: boolean;
  useUSDX?: boolean;
}

export interface Exchange {
  id: string;
  credentials: ExchangeCredentials;
}

export interface ExchangeCredentials {
  apiKey: string;
  secret: string;
  memo?: string;
}

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface CreateStrategyData {
  title: string;
  description: string;
  riskLevel: RiskLevel;
  userId: string;
  strategyConfig: any;
  type: string;
  status: string;
  performance: number;
}

export interface StrategyTemplate {
  id: string;
  title: string;
  description: string;
  risk_level: 'Low' | 'Medium' | 'High';
  metrics: {
    winRate: number;
    avgReturn: number;
    sharpeRatio: number;
  };
  config?: {
    timeframe: string;
    marketType: 'spot' | 'futures';
    indicators: string[];
    validationRules: any;
  };
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface IndicatorConfig {
  name: string;
  parameters: Record<string, any>;
  timeframe?: string;
  weight?: number;
}

export interface StrategyBudget {
  strategyId: string;
  allocation: number;
  maxDrawdown: number;
  riskLevel: RiskLevel;
}

export interface TradeValidationResult {
  isValid: boolean;
  riskScore: number;
  recommendations: string[];
}

export interface BudgetHistory {
  id: string;
  budget_id: string;
  total_before: number;
  total_after: number;
  allocated_before: number;
  allocated_after: number;
  available_before: number;
  available_after: number;
  reason?: string;
  created_at: string;
}

export interface TradeConfig {
  symbol: string;
  type: 'Long' | 'Short';
  amount: number;
  leverage: number;
  stopLoss: number;
  takeProfit: number;
  trailingStop?: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}

export interface MarketInsight {
  timestamp: number;
  assets: AssetInsight[];
  marketConditions: MarketConditions;
  recommendations: string[];
}

export interface AssetInsight {
  symbol: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  signals: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface MarketConditions {
  trend: 'uptrend' | 'downtrend' | 'sideways';
  volatility: 'low' | 'medium' | 'high';
  volume: 'low' | 'medium' | 'high';
}

// Dynamic exchange configuration based on CCXT
export const SUPPORTED_EXCHANGES: Exchange[] = [
  {
    id: 'bitmart',
    name: 'BitMart',
    logo: '/exchange-logos/bitmart.png',
    description: 'Global digital asset trading platform',
    spotSupported: true,
    marginSupported: true,
    futuresSupported: true
  },
  // Add other supported exchanges here
];

export type SupportedExchange = typeof SUPPORTED_EXCHANGES[number];

interface StrategyConfig {
  marketType: 'spot' | 'margin' | 'futures';
  assets: string[];
  // other strategy configuration properties...
}

interface Strategy {
  id: string;
  status: string;
  strategy_config: StrategyConfig;
  risk_level: string;
  // other strategy properties...
}

export interface WalletBalance {
  total: number;
  free: number;
  used: number;
}

export interface ExchangeWallets {
  spot: WalletBalance;
  margin?: WalletBalance;
  futures?: WalletBalance;
  funding?: WalletBalance;
}

export interface MarketPair {
  base: string;
  quote: string;
  type: 'spot' | 'margin' | 'futures';
  minQuantity: number;
  maxQuantity: number;
  pricePrecision: number;
  quantityPrecision: number;
  minNotional: number;
  isActive: boolean;
  permissions: string[];
}

export interface ExchangeCapabilities {
  supportedWallets: ('spot' | 'margin' | 'futures' | 'funding')[];
  supportedOrderTypes: ('market' | 'limit' | 'stop' | 'stopLimit')[];
  supportedTimeInForce: string[];
  supportsMarginTrading: boolean;
  supportsFuturesTrading: boolean;
  supportsSpotTrading: boolean;
  marginRequirements?: {
    initialMargin: number;
    maintenanceMargin: number;
    maxLeverage: number;
  };
}

export interface TradeSignal {
  asset: string;
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  position_size: number;
  confidence: number;
  conditions_met: string[];
  timestamp: number;
}

export interface Strategy {
  id: string;
  title: string;
  description: string | null;
  risk_level: string;
  strategy_config: any;
  status: 'active' | 'inactive' | 'backend_processing';
  user_id: string;
  type: 'custom' | 'template';
  performance: number;
  selected_pairs: string[];
  created_at: string;
  updated_at: string;
}

export type SortOption = 'performance' | 'risk' | 'name';

export interface FilterOptions {
  status: 'all' | 'active' | 'inactive' | 'paused';
  riskLevel: 'all' | 'low' | 'medium' | 'high';
  performance: 'all' | 'positive' | 'negative';
}

export interface MonitoringStatus {
  status: 'active' | 'inactive' | 'error';
  lastUpdate: Date;
  strategy_id: string;
  // Add other monitoring status properties as needed
}

export interface TradeConfig {
  // Add proper fields
}

export interface TradeAnalysis {
  shouldClose: boolean;
  shouldAdjustStops: boolean;
  reason: string;
  recommendedStops?: {
    stopLoss: number;
    takeProfit: number;
  };
}

export interface MarketFitAnalysis {
  isSuitable: boolean;
  // Add other required fields
}

export interface MonitorState {
  isActive: boolean;
  lastCheckTime: number;
}

export interface MarketData {
  price: Decimal | null;
  volume: number;
  timestamp: number;
}

export interface TradingParams {
  minProfitPct: number;
  maxLossPct: number;
  timeframes: {
    holding: {
      max: number;
    };
  };
  trailingStop?: {
    activation: number;
    distance: number;
  };
}

export interface Trade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  openPrice: number;
  size: number;
  openTime: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStopPct?: number;
}

export interface MarketSentiment {
  fearGreedIndex: number;
  bullBearIndex: number;
  lastUpdate: number;
}

export interface CSVValidationError {
  type: 'INVALID_HEADERS' | 'PARSE_ERROR' | 'FILE_SIZE' | 'INVALID_DATA';
  message: string;
}

export interface BacktestConfig {
  startDate: Date;
  endDate: Date;
  asset: string;
  strategy: string;
  parameters: Record<string, any>;
}

export interface ProgressStatus {
  status: 'running' | 'complete' | 'error';
  progress: number;
  currentStep: string;
  error?: string;
}

export interface AIStrategyConfig {
  assets: string[];
  timeframe: string;
  marketType: 'spot' | 'futures';
  marketRequirements: {
    trendFilter: boolean;
    volatilityFilter: boolean;
    correlationFilter: boolean;
    volumeFilter: boolean;
  };
  validationCriteria: {
    minWinRate: number;
    minProfitFactor: number;
    maxDrawdown: number;
    minTradeCount: number;
  };
  confirmationRules: {
    timeframes: string[];
    indicators: string[];
    minConfidence: number;
  };
}

export interface Trade {
  id: string;
  pair: string;
  timestamp: number;
  profit: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  volume24h: number;
  change24h: number;
}

export interface Strategy {
  id: string;
  strategy_config?: {
    assets?: string[];
    indicators?: string[];
    conditions?: {
      entry: Array<{
        indicator: string;
        operator: string;
        value: number;
      }>;
    };
    trade_parameters?: {
      confidence_factor: number;
    };
  };
}

export interface StrategyBudget {
  amount: number;
  currency: string;
}

export interface MonitoringStatus {
  strategy_id: string;
  status: 'active' | 'inactive';
  metrics: {
    lastTrade?: Trade;
    exchange?: ExchangeMetrics;
  };
  alerts: Alert[];
}

export interface ExchangeMetrics {
  connectionStatus: boolean;
  apiLatency: number;
  rateLimit: number;
  lastSync: number;
}

export interface Alert {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  timestamp: number;
}
