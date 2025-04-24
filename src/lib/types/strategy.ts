export interface StrategyConfig {
  type: 'scalper' | 'daytrader' | 'swing' | 'position';
  timeframes: {
    analysis: string;   // For analysis (e.g., '1h' for trend direction)
    execution: string;  // For trade execution (e.g., '1m' for scalping)
    holding: {
      min: number;     // Minimum hold time in milliseconds
      max: number;     // Maximum hold time in milliseconds
    };
  };
  tradingParams: {
    maxOpenTrades: number;
    minProfitPct: number;
    maxLossPct: number;
    trailingStop?: {
      activation: number;  // % profit to activate trailing stop
      distance: number;    // % distance to maintain
    };
  };
  riskManagement: {
    positionSizing: 'fixed' | 'dynamic' | 'kelly';
    maxPositionSize: number;
    maxTotalExposure: number;
  };
  marketConditions: {
    requiredTrend: string[];
    minVolatility: number;
    maxVolatility: number;
    correlationFilters: {
      btcMin: number;
      btcMax: number;
    };
  };
  validation: {
    minConfidence: number;
    requiredIndicators: string[];
    confirmationTimeframes: string[];
    minimumVolume: number;
  };
  executionRules: {
    entryConfirmation: string[];
    exitConfirmation: string[];
    positionScaling: {
      enabled: boolean;
      rules: string[];
    };
  };
  backtest: {
    minSampleSize: number;
    requiredMetrics: {
      minWinRate: number;
      maxDrawdown: number;
      minProfitFactor: number;
    };
  };
}
