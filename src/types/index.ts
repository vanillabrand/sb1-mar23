// Add missing type definitions
export interface ExchangeHealth {
  ok: boolean;
  degraded: boolean;
  message: string;
  timestamp: string;
}

export interface TradeOptions {
  symbol: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change24h: number;
  lastUpdate: number;
  source: string;
}

export type TimeFrame = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
