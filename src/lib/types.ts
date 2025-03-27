// Import CCXT types only
import type { Exchange as CCXTExchange } from 'ccxt';

// Define exchange types without direct CCXT reference
export type Exchange = CCXTExchange;
export type ExchangeCredentials = {
  apiKey: string;
  secret: string;
  memo?: string;
};

// Use string literal type instead of CCXT reference
export type ExchangeId = 
  | 'binance'
  | 'bitmart'
  | 'kucoin'
  | 'okx'
  | 'bybit'
  | string;

export interface ExchangeConfig {
  name: string;
  apiKey: string;
  secret: string;
  memo?: string;
  testnet?: boolean;
  useUSDX?: boolean;
  password?: string;  // Some exchanges use password instead of memo
}

export interface Exchange {
  id: string;
  name: string;
  logo: string;
  description: string;
  features: string[];
  fields: {
    name: string;
    key: 'apiKey' | 'secret' | 'memo';
    required: boolean;
    type: 'text' | 'password';
    placeholder: string;
    description: string;
  }[];
  docs: {
    setup: string[];
    permissions: string[];
    restrictions: string[];
  };
  testnetSupported: boolean;
  marginSupported: boolean;
  futuresSupported: boolean;
  spotSupported: boolean;
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
  name: string;
  description: string;
  riskLevel: RiskLevel;
  indicators: IndicatorConfig[];
  parameters: Record<string, any>;
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
export const SUPPORTED_EXCHANGES: Exchange[] = Object.entries(ccxt.exchanges).map(([id, ExchangeClass]) => {
  const exchange = new (ExchangeClass as any)();
  return {
    id,
    name: exchange.name || id.toUpperCase(),
    logo: `path/to/exchange/logos/${id}.png`,
    description: `Trade on ${exchange.name || id.toUpperCase()}`,
    features: [
      exchange.has.spot ? 'Spot Trading' : null,
      exchange.has.margin ? 'Margin Trading' : null,
      exchange.has.future ? 'Futures Trading' : null,
      'API Trading'
    ].filter(Boolean),
    fields: [
      {
        name: 'API Key',
        key: 'apiKey',
        required: true,
        type: 'text',
        placeholder: 'Enter your API key',
        description: `Your ${exchange.name || id.toUpperCase()} API key`
      },
      {
        name: 'API Secret',
        key: 'secret',
        required: true,
        type: 'password',
        placeholder: 'Enter your API secret',
        description: `Your ${exchange.name || id.toUpperCase()} API secret`
      },
      ...(exchange.has.memo ? [{
        name: 'Memo',
        key: 'memo',
        required: true,
        type: 'text',
        placeholder: 'Enter your memo',
        description: `Your ${exchange.name || id.toUpperCase()} memo`
      }] : []),
      ...(exchange.has.password ? [{
        name: 'Password',
        key: 'password',
        required: true,
        type: 'password',
        placeholder: 'Enter your password',
        description: `Your ${exchange.name || id.toUpperCase()} password`
      }] : [])
    ],
    docs: {
      setup: ['Visit the exchange website', 'Generate API keys with trading permissions'],
      permissions: ['Trading', 'Account info'],
      restrictions: ['No withdrawals']
    },
    testnetSupported: Boolean(exchange.urls?.test),
    marginSupported: exchange.has.margin,
    futuresSupported: exchange.has.future,
    spotSupported: exchange.has.spot
  };
});

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
  available: number;
  used: number;
  updateTime: number;
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
  status: string;
  strategy_config: any; // Define proper type
  maxRiskScore: number;
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
