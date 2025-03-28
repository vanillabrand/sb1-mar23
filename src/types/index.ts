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
  ticker: any; // Replace with proper ticker type
  trades: any[]; // Replace with proper trade type
  candles: any[]; // Replace with proper candle type
  lastUpdate: number;
}

export type TimeFrame = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';