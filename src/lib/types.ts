// Add these types to the existing types.ts file

export interface ExchangeConfig {
  name: string;
  apiKey: string;
  secret: string;
  memo?: string;
  testnet?: boolean;
  useUSDX?: boolean;
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

export const SUPPORTED_EXCHANGES: Exchange[] = [
  {
    id: 'bitmart',
    name: 'BitMart',
    logo: 'https://assets.staticimg.com/cms/media/1lB3PkckFDyfxz59kXSmUCSe6dQ9pqc3BL3n4e8Sc.png',
    description: 'A secure and reliable digital asset trading platform.',
    features: ['Spot Trading', 'Futures Trading', 'Margin Trading', 'API Trading'],
    fields: [
      {
        name: 'API Key',
        key: 'apiKey',
        required: true,
        type: 'text',
        placeholder: 'Enter your API key',
        description: 'Your BitMart API key'
      },
      {
        name: 'API Secret',
        key: 'secret',
        required: true,
        type: 'password',
        placeholder: 'Enter your API secret',
        description: 'Your BitMart API secret'
      },
      {
        name: 'Memo',
        key: 'memo',
        required: true,
        type: 'text',
        placeholder: 'Enter your memo',
        description: 'Your BitMart API memo'
      }
    ],
    docs: {
      setup: [
        'Log in to your BitMart account',
        'Go to Account > API Management',
        'Click "Create API"',
        'Set permissions for trading',
        'Copy API Key, Secret, and Memo'
      ],
      permissions: [
        'Read Info',
        'Spot Trading',
        'Futures Trading'
      ],
      restrictions: [
        'Withdrawals should be disabled for security',
        'IP restrictions recommended'
      ]
    },
    testnetSupported: true,
    marginSupported: true,
    futuresSupported: true,
    spotSupported: true
  }
];