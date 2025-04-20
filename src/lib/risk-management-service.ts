import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { exchangeService } from './exchange-service';
import { RiskManagementConfig, RiskLevel, MarketType, MarketAnalysis } from './types';

/**
 * Service for managing trading risk
 * Handles position sizing, stop loss calculation, and risk limits
 */
class RiskManagementService extends EventEmitter {
  private static instance: RiskManagementService;
  private defaultConfig: RiskManagementConfig = {} as RiskManagementConfig;

  private constructor() {
    super();
    this.initializeDefaultConfig();
  }

  static getInstance(): RiskManagementService {
    if (!RiskManagementService.instance) {
      RiskManagementService.instance = new RiskManagementService();
    }
    return RiskManagementService.instance;
  }

  /**
   * Initialize default risk management configuration
   */
  private initializeDefaultConfig(): void {
    this.defaultConfig = {
      // Position sizing
      maxPositionSizePercentage: 0.1, // 10% of available budget
      dynamicPositionSizing: true,
      volatilityAdjustment: true,
      correlationAdjustment: false,

      // Stop loss strategies
      stopLossType: 'percent',
      fixedStopLossPercentage: 0.02, // 2%
      atrMultiplier: 2,
      useVolatilityBasedStops: true,

      // Take profit strategies
      takeProfitType: 'riskReward',
      fixedTakeProfitPercentage: 0.04, // 4%
      riskRewardRatio: 2, // 2:1 risk-reward ratio
      usePartialTakeProfits: false,
      partialTakeProfitLevels: [0.5, 0.75, 1.0], // 50%, 75%, 100%

      // Time-based exits
      useTimeBasedExit: false,
      maxTradeDuration: 7 * 24 * 60 * 60 * 1000, // 7 days

      // Risk limits
      maxRiskPerTrade: 0.01, // 1% of account
      maxRiskPerDay: 0.03, // 3% of account
      maxDrawdown: 0.1, // 10% drawdown

      // Kelly criterion
      useKellyCriterion: false,
      kellyFraction: 0.5 // Half Kelly
    };
  }

  /**
   * Get risk management configuration for a specific risk level
   * @param riskLevel The risk level to get configuration for
   */
  getRiskConfig(riskLevel: RiskLevel): RiskManagementConfig {
    // Start with default config
    const config = { ...this.defaultConfig };

    // Adjust based on risk level
    switch (riskLevel) {
      case 'Ultra Low':
        config.maxPositionSizePercentage = 0.05;
        config.fixedStopLossPercentage = 0.01;
        config.fixedTakeProfitPercentage = 0.02;
        config.maxRiskPerTrade = 0.005;
        config.maxRiskPerDay = 0.01;
        break;

      case 'Low':
        config.maxPositionSizePercentage = 0.08;
        config.fixedStopLossPercentage = 0.015;
        config.fixedTakeProfitPercentage = 0.03;
        config.maxRiskPerTrade = 0.0075;
        config.maxRiskPerDay = 0.02;
        break;

      case 'Medium':
        // Default values
        break;

      case 'High':
        config.maxPositionSizePercentage = 0.15;
        config.fixedStopLossPercentage = 0.025;
        config.fixedTakeProfitPercentage = 0.05;
        config.maxRiskPerTrade = 0.015;
        config.maxRiskPerDay = 0.04;
        break;

      case 'Ultra High':
        config.maxPositionSizePercentage = 0.2;
        config.fixedStopLossPercentage = 0.03;
        config.fixedTakeProfitPercentage = 0.06;
        config.maxRiskPerTrade = 0.02;
        config.maxRiskPerDay = 0.05;
        break;

      case 'Extreme':
        config.maxPositionSizePercentage = 0.25;
        config.fixedStopLossPercentage = 0.04;
        config.fixedTakeProfitPercentage = 0.08;
        config.maxRiskPerTrade = 0.025;
        config.maxRiskPerDay = 0.075;
        break;

      case 'God Mode':
        config.maxPositionSizePercentage = 0.3;
        config.fixedStopLossPercentage = 0.05;
        config.fixedTakeProfitPercentage = 0.1;
        config.maxRiskPerTrade = 0.03;
        config.maxRiskPerDay = 0.1;
        break;
    }

    return config;
  }

  /**
   * Calculate position size based on risk parameters
   * @param availableBudget Available budget for the trade
   * @param currentPrice Current price of the asset
   * @param riskLevel Risk level of the strategy
   * @param marketType Market type (spot, margin, futures)
   * @param marketAnalysis Market analysis data
   * @param confidence Confidence level of the trade signal (0-1)
   */
  calculatePositionSize(
    availableBudget: number,
    currentPrice: number,
    riskLevel: RiskLevel,
    marketType: MarketType = 'spot',
    marketAnalysis?: MarketAnalysis,
    confidence: number = 0.7
  ): number {
    try {
      // Get risk config for the specified risk level
      const riskConfig = this.getRiskConfig(riskLevel);

      // Base position size as percentage of available budget
      let baseSize = availableBudget * riskConfig.maxPositionSizePercentage;

      // Adjust for confidence level
      baseSize = baseSize * confidence;

      // Apply volatility adjustment if enabled
      if (riskConfig.volatilityAdjustment && marketAnalysis) {
        const volatilityFactor = this.calculateVolatilityFactor(marketAnalysis.volatility);
        baseSize = baseSize * volatilityFactor;
      }

      // Apply market type adjustments
      if (marketType === 'futures') {
        // For futures, we can use leverage, so we might want to be more conservative
        baseSize = baseSize * 0.8; // 20% more conservative for futures
      }

      // Calculate position size in asset units
      const positionSize = baseSize / currentPrice;

      // Round position size appropriately based on price
      return this.roundPositionSize(positionSize, currentPrice);
    } catch (error) {
      logService.log('error', 'Failed to calculate position size', error, 'RiskManagementService');
      // Return a safe default
      return (availableBudget * 0.05) / currentPrice;
    }
  }

  /**
   * Calculate volatility adjustment factor
   * @param volatility Normalized volatility (0-100)
   */
  private calculateVolatilityFactor(volatility: number): number {
    // Higher volatility = smaller position size
    // Scale: 0.5 (high volatility) to 1.2 (low volatility)
    if (volatility > 80) return 0.5;  // Very high volatility
    if (volatility > 60) return 0.7;  // High volatility
    if (volatility > 40) return 0.9;  // Medium volatility
    if (volatility > 20) return 1.0;  // Normal volatility
    return 1.2;  // Low volatility
  }

  /**
   * Round position size appropriately based on asset price
   * @param positionSize Position size in asset units
   * @param price Current price of the asset
   */
  private roundPositionSize(positionSize: number, price: number): number {
    // For high-value assets like BTC, round to more decimal places
    if (price >= 10000) {
      // For BTC: round to 6 decimal places (0.000001 BTC precision)
      return Math.floor(positionSize * 1e6) / 1e6;
    } else if (price >= 1000) {
      // For ETH and similar: round to 5 decimal places
      return Math.floor(positionSize * 1e5) / 1e5;
    } else if (price >= 100) {
      // For mid-priced assets: round to 4 decimal places
      return Math.floor(positionSize * 1e4) / 1e4;
    } else if (price >= 10) {
      // For lower-priced assets: round to 3 decimal places
      return Math.floor(positionSize * 1e3) / 1e3;
    } else if (price >= 1) {
      // For very low-priced assets: round to 2 decimal places
      return Math.floor(positionSize * 1e2) / 1e2;
    } else {
      // For extremely low-priced assets (like SHIB): round to 0 decimal places
      return Math.floor(positionSize);
    }
  }

  /**
   * Calculate stop loss price based on risk parameters
   * @param entryPrice Entry price of the trade
   * @param side Trade side ('buy' or 'sell')
   * @param riskLevel Risk level of the strategy
   * @param marketAnalysis Market analysis data
   * @param atr Average True Range value (optional)
   */
  calculateStopLoss(
    entryPrice: number,
    side: 'buy' | 'sell',
    riskLevel: RiskLevel,
    marketAnalysis?: MarketAnalysis,
    atr?: number
  ): number {
    try {
      // Get risk config for the specified risk level
      const riskConfig = this.getRiskConfig(riskLevel);

      // Default stop loss percentage
      let stopLossPercentage = riskConfig.fixedStopLossPercentage || 0.02; // Default to 2% if undefined

      // For buy orders, stop loss is below entry price
      // For sell orders, stop loss is above entry price
      const direction = side === 'buy' ? -1 : 1;

      // Calculate stop loss based on the configured type
      switch (riskConfig.stopLossType) {
        case 'atr':
          // ATR-based stop loss
          if (atr && atr > 0) {
            return entryPrice * (1 + (direction * atr * riskConfig.atrMultiplier! / entryPrice));
          }
          // Fall back to fixed percentage if ATR not available
          return entryPrice * (1 + (direction * stopLossPercentage));

        case 'support':
          // Support/resistance based stop loss
          if (marketAnalysis) {
            if (side === 'buy' && marketAnalysis.support) {
              // For buy orders, use support level if available and reasonable
              if (marketAnalysis.support < entryPrice &&
                  marketAnalysis.support > entryPrice * (1 - riskConfig.maxRiskPerTrade)) {
                return marketAnalysis.support;
              }
            } else if (side === 'sell' && marketAnalysis.resistance) {
              // For sell orders, use resistance level if available and reasonable
              if (marketAnalysis.resistance > entryPrice &&
                  marketAnalysis.resistance < entryPrice * (1 + riskConfig.maxRiskPerTrade)) {
                return marketAnalysis.resistance;
              }
            }
          }
          // Fall back to fixed percentage if support/resistance not available or not reasonable
          return entryPrice * (1 + (direction * stopLossPercentage));

        case 'percent':
        default:
          // Fixed percentage stop loss
          return entryPrice * (1 + (direction * stopLossPercentage));
      }
    } catch (error) {
      logService.log('error', 'Failed to calculate stop loss', error, 'RiskManagementService');
      // Return a safe default (2% from entry price)
      const direction = side === 'buy' ? -1 : 1;
      return entryPrice * (1 + (direction * 0.02));
    }
  }

  /**
   * Calculate take profit price based on risk parameters
   * @param entryPrice Entry price of the trade
   * @param stopLoss Stop loss price
   * @param side Trade side ('buy' or 'sell')
   * @param riskLevel Risk level of the strategy
   * @param marketAnalysis Market analysis data
   */
  calculateTakeProfit(
    entryPrice: number,
    stopLoss: number,
    side: 'buy' | 'sell',
    riskLevel: RiskLevel,
    marketAnalysis?: MarketAnalysis
  ): number {
    try {
      // Get risk config for the specified risk level
      const riskConfig = this.getRiskConfig(riskLevel);

      // Default take profit percentage
      let takeProfitPercentage = riskConfig.fixedTakeProfitPercentage || 0.04; // Default to 4% if undefined

      // For buy orders, take profit is above entry price
      // For sell orders, take profit is below entry price
      const direction = side === 'buy' ? 1 : -1;

      // Calculate take profit based on the configured type
      switch (riskConfig.takeProfitType) {
        case 'riskReward':
          // Risk-reward ratio based take profit
          const riskAmount = Math.abs(entryPrice - stopLoss);
          return entryPrice + (direction * riskAmount * (riskConfig.riskRewardRatio || 2));

        case 'resistance':
          // Support/resistance based take profit
          if (marketAnalysis) {
            if (side === 'buy' && marketAnalysis.resistance) {
              // For buy orders, use resistance level if available and reasonable
              if (marketAnalysis.resistance > entryPrice) {
                return marketAnalysis.resistance;
              }
            } else if (side === 'sell' && marketAnalysis.support) {
              // For sell orders, use support level if available and reasonable
              if (marketAnalysis.support < entryPrice) {
                return marketAnalysis.support;
              }
            }
          }
          // Fall back to fixed percentage if support/resistance not available
          return entryPrice * (1 + (direction * takeProfitPercentage));

        case 'fixed':
        default:
          // Fixed percentage take profit
          return entryPrice * (1 + (direction * takeProfitPercentage));
      }
    } catch (error) {
      logService.log('error', 'Failed to calculate take profit', error, 'RiskManagementService');
      // Return a safe default (4% from entry price)
      const direction = side === 'buy' ? 1 : -1;
      return entryPrice * (1 + (direction * 0.04));
    }
  }

  /**
   * Calculate position size using Kelly criterion
   * @param availableBudget Available budget for the trade
   * @param winRate Historical win rate (0-1)
   * @param avgWin Average win amount
   * @param avgLoss Average loss amount
   * @param riskLevel Risk level of the strategy
   */
  calculateKellyPositionSize(
    availableBudget: number,
    winRate: number,
    avgWin: number,
    avgLoss: number,
    riskLevel: RiskLevel
  ): number {
    try {
      // Get risk config for the specified risk level
      const riskConfig = this.getRiskConfig(riskLevel);

      // Calculate Kelly fraction
      // Kelly = W - [(1-W)/R] where W = win rate, R = win/loss ratio
      const winLossRatio = Math.abs(avgWin / avgLoss);
      const kellyPercentage = winRate - ((1 - winRate) / winLossRatio);

      // Apply Kelly fraction (usually use half or quarter Kelly for safety)
      const kellyFraction = riskConfig.kellyFraction || 0.5; // Default to half Kelly
      let positionSize = availableBudget * kellyPercentage * kellyFraction;

      // Cap at maximum position size from risk config
      const maxPositionSize = availableBudget * riskConfig.maxPositionSizePercentage;
      positionSize = Math.min(positionSize, maxPositionSize);

      // Ensure position size is positive
      return Math.max(0, positionSize);
    } catch (error) {
      logService.log('error', 'Failed to calculate Kelly position size', error, 'RiskManagementService');
      // Return a safe default (5% of available budget)
      return availableBudget * 0.05;
    }
  }

  /**
   * Validate if a trade meets risk management criteria
   * @param tradeAmount Trade amount in asset units
   * @param entryPrice Entry price of the trade
   * @param stopLoss Stop loss price
   * @param side Trade side ('buy' or 'sell')
   * @param riskLevel Risk level of the strategy
   * @param marketType Market type (spot, margin, futures)
   * @param availableBudget Available budget for the trade
   */
  validateTradeRisk(
    tradeAmount: number,
    entryPrice: number,
    stopLoss: number,
    _side: 'buy' | 'sell', // Prefix with underscore to indicate it's not used
    riskLevel: RiskLevel,
    marketType: MarketType = 'spot',
    availableBudget: number
  ): { valid: boolean; reason?: string } {
    try {
      // Get risk config for the specified risk level
      const riskConfig = this.getRiskConfig(riskLevel);

      // Calculate trade value
      const tradeValue = tradeAmount * entryPrice;

      // Calculate potential loss
      // Note: We use Math.abs here so direction is not needed
      const potentialLossPercentage = Math.abs((stopLoss - entryPrice) / entryPrice);
      const potentialLossAmount = tradeValue * potentialLossPercentage;

      // Check if trade value exceeds maximum position size
      const maxPositionSize = availableBudget * riskConfig.maxPositionSizePercentage;
      if (tradeValue > maxPositionSize) {
        return {
          valid: false,
          reason: `Trade value (${tradeValue.toFixed(2)}) exceeds maximum position size (${maxPositionSize.toFixed(2)})`
        };
      }

      // Check if potential loss exceeds maximum risk per trade
      const maxRiskAmount = availableBudget * riskConfig.maxRiskPerTrade;
      if (potentialLossAmount > maxRiskAmount) {
        return {
          valid: false,
          reason: `Potential loss (${potentialLossAmount.toFixed(2)}) exceeds maximum risk per trade (${maxRiskAmount.toFixed(2)})`
        };
      }

      // Additional checks for futures trading
      if (marketType === 'futures') {
        // Check if leverage is reasonable (this would require knowing the leverage)
        // For now, we'll just validate the basic risk parameters
      }

      return { valid: true };
    } catch (error) {
      logService.log('error', 'Failed to validate trade risk', error, 'RiskManagementService');
      return { valid: false, reason: 'Error validating trade risk' };
    }
  }

  /**
   * Validate margin and leverage settings for a strategy
   * @param symbol Trading pair symbol
   * @param marketType Market type (spot, margin, futures)
   * @param riskLevel Risk level of the strategy
   * @param leverage Current leverage setting (for futures)
   * @param marginRatio Current margin ratio (for margin, 0-1)
   */
  async validateMarginAndLeverage(
    symbol: string,
    marketType: MarketType,
    riskLevel: RiskLevel,
    leverage?: number,
    marginRatio?: number
  ): Promise<{ valid: boolean; reason?: string; recommendedValue?: number }> {
    try {
      // Skip validation for spot trading
      if (marketType === 'spot') {
        return { valid: true };
      }

      // For futures trading, validate leverage
      if (marketType === 'futures' && leverage !== undefined) {
        // Get maximum allowed leverage from exchange
        const maxAllowedLeverage = await exchangeService.getMaxAllowedLeverage(symbol, 'futures');

        // Get recommended leverage based on risk level
        const recommendedLeverage = this.getRecommendedLeverage(riskLevel, 'futures');

        // Check if leverage exceeds exchange maximum
        if (leverage > maxAllowedLeverage) {
          return {
            valid: false,
            reason: `Leverage (${leverage}x) exceeds exchange maximum (${maxAllowedLeverage}x)`,
            recommendedValue: Math.min(recommendedLeverage, maxAllowedLeverage)
          };
        }

        // Check if leverage is appropriate for risk level
        if (leverage > recommendedLeverage * 1.5) { // Allow some flexibility (50% over recommended)
          return {
            valid: false,
            reason: `Leverage (${leverage}x) is too high for ${riskLevel} risk level`,
            recommendedValue: recommendedLeverage
          };
        }
      }

      // For margin trading, validate margin ratio
      if (marketType === 'margin' && marginRatio !== undefined) {
        // Get maximum allowed margin from exchange
        const maxAllowedMargin = await exchangeService.getMaxAllowedMargin();

        // Get recommended margin based on risk level
        const recommendedMargin = this.getRecommendedMargin(riskLevel);

        // Check if margin exceeds exchange maximum
        if (marginRatio > maxAllowedMargin) {
          return {
            valid: false,
            reason: `Margin ratio (${(marginRatio * 100).toFixed(0)}%) exceeds exchange maximum (${(maxAllowedMargin * 100).toFixed(0)}%)`,
            recommendedValue: Math.min(recommendedMargin, maxAllowedMargin)
          };
        }

        // Check if margin is appropriate for risk level
        if (marginRatio > recommendedMargin * 1.2) { // Allow some flexibility (20% over recommended)
          return {
            valid: false,
            reason: `Margin ratio (${(marginRatio * 100).toFixed(0)}%) is too high for ${riskLevel} risk level`,
            recommendedValue: recommendedMargin
          };
        }
      }

      return { valid: true };
    } catch (error) {
      logService.log('error', 'Failed to validate margin and leverage', error, 'RiskManagementService');
      return { valid: false, reason: 'Error validating margin and leverage settings' };
    }
  }

  /**
   * Get recommended leverage based on risk level
   * @param riskLevel Risk level of the strategy
   * @param marketType Market type (margin or futures)
   */
  getRecommendedLeverage(riskLevel: RiskLevel, marketType: 'margin' | 'futures'): number {
    // For margin trading, leverage is usually fixed at 3x or 5x
    if (marketType === 'margin') {
      return 3; // Standard margin leverage
    }

    // For futures trading, leverage varies by risk level
    switch (riskLevel) {
      case 'Ultra Low':
        return 2;
      case 'Low':
        return 5;
      case 'Medium':
        return 10;
      case 'High':
        return 20;
      case 'Ultra High':
        return 50;
      case 'Extreme':
        return 75;
      case 'God Mode':
        return 100;
      default:
        return 10; // Default to Medium
    }
  }

  /**
   * Get recommended margin ratio based on risk level
   * @param riskLevel Risk level of the strategy
   */
  getRecommendedMargin(riskLevel: RiskLevel): number {
    switch (riskLevel) {
      case 'Ultra Low':
        return 0.2; // 20%
      case 'Low':
        return 0.3; // 30%
      case 'Medium':
        return 0.5; // 50%
      case 'High':
        return 0.6; // 60%
      case 'Ultra High':
        return 0.7; // 70%
      case 'Extreme':
        return 0.8; // 80%
      case 'God Mode':
        return 0.9; // 90%
      default:
        return 0.5; // Default to Medium
    }
  }

  /**
   * Calculate trailing stop percentage based on volatility
   * @param volatility Normalized volatility (0-100)
   * @param riskLevel Risk level of the strategy
   */
  calculateTrailingStop(volatility: number, riskLevel: RiskLevel): number {
    try {
      // Base trailing stop percentage based on risk level
      let basePercentage: number;

      switch (riskLevel) {
        case 'Ultra Low':
          basePercentage = 0.5; // 0.5%
          break;
        case 'Low':
          basePercentage = 1.0; // 1.0%
          break;
        case 'Medium':
          basePercentage = 1.5; // 1.5%
          break;
        case 'High':
          basePercentage = 2.0; // 2.0%
          break;
        case 'Ultra High':
          basePercentage = 2.5; // 2.5%
          break;
        case 'Extreme':
          basePercentage = 3.0; // 3.0%
          break;
        case 'God Mode':
          basePercentage = 4.0; // 4.0%
          break;
        default:
          basePercentage = 1.5; // Default to Medium
      }

      // Adjust based on volatility
      // Higher volatility = wider trailing stop
      let volatilityFactor: number;

      if (volatility > 80) volatilityFactor = 1.5;  // Very high volatility
      else if (volatility > 60) volatilityFactor = 1.3;  // High volatility
      else if (volatility > 40) volatilityFactor = 1.1;  // Medium volatility
      else if (volatility > 20) volatilityFactor = 1.0;  // Normal volatility
      else volatilityFactor = 0.9;  // Low volatility

      return basePercentage * volatilityFactor;
    } catch (error) {
      logService.log('error', 'Failed to calculate trailing stop', error, 'RiskManagementService');
      return 1.5; // Default to 1.5%
    }
  }
}

export const riskManagementService = RiskManagementService.getInstance();
