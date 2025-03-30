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