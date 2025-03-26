// Add these types to the existing types.ts file

export interface ExchangeConfig {
  name: string;
  apiKey: string;
  secret: string;
  memo?: string;
  testnet?: boolean;
  useUSDX?: boolean;
  password?: string;  // Some exchanges use password instead of memo
}

export interface ExchangeCredentials {
  apiKey: string;
  secret: string;
  memo?: string;
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

export type RiskLevel = 'Ultra Low' | 'Low' | 'Medium' | 'High' | 'Ultra High' | 'Extreme' | 'God Mode';

export interface StrategyTemplate {
  id: string;
  title: string;
  description: string;
  risk_level: RiskLevel;
  metrics: {
    expectedReturn: number;
  };
  config?: any;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StrategyBudget {
  total: number;
  allocated: number;
  available: number;
  maxPositionSize: number;
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

// Dynamic exchange configuration based on CCXT
export const SUPPORTED_EXCHANGES: Exchange[] = Object.entries(ccxt.exchanges).map(([id, ExchangeClass]) => {
  const exchange = new (ExchangeClass as any)();
  return {
    id,
    name: exchange.name || id.toUpperCase(),
    logo: `path/to/exchange/logos/${id}.png`, // You'll need to handle logos
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
    testnetSupported: Boolean(exchange.urls?.test),
    marginSupported: exchange.has.margin,
    futuresSupported: exchange.has.future,
    spotSupported: exchange.has.spot
  };
});

interface StrategyConfig {
  assets: string[];
  // other strategy configuration properties...
}

interface Strategy {
  id: string;
  status: string;
  strategy_config: StrategyConfig;
  // other strategy properties...
}
