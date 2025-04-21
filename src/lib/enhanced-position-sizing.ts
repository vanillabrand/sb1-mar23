import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { riskManagementService } from './risk-management-service';
import { tradeService } from './trade-service';
import type { Strategy, MarketType, RiskLevel } from './types';

/**
 * Interface for position sizing options
 */
export interface PositionSizingOptions {
  availableBudget: number;
  currentPrice: number;
  riskLevel: RiskLevel;
  marketType?: MarketType;
  confidence?: number;
  symbol?: string;
  strategyId?: string;
  volatility?: number;
  stopLossPrice?: number;
}

/**
 * Enhanced position sizing service with advanced algorithms
 */
class EnhancedPositionSizing extends EventEmitter {
  private static instance: EnhancedPositionSizing;

  // Minimum trade value in USD
  private readonly MIN_TRADE_VALUE = 5;

  private constructor() {
    super();
  }

  static getInstance(): EnhancedPositionSizing {
    if (!EnhancedPositionSizing.instance) {
      EnhancedPositionSizing.instance = new EnhancedPositionSizing();
    }
    return EnhancedPositionSizing.instance;
  }

  /**
   * Calculate position size using the basic algorithm
   * @param options Position sizing options
   * @returns Position size in asset units
   */
  calculateBasicPositionSize(options: PositionSizingOptions): number {
    try {
      const {
        availableBudget,
        currentPrice,
        riskLevel,
        marketType = 'spot',
        confidence = 0.7
      } = options;

      // Log inputs for debugging
      logService.log('debug', 'Calculating basic position size', {
        availableBudget,
        currentPrice,
        riskLevel,
        marketType,
        confidence
      }, 'EnhancedPositionSizing');

      // Use risk management service for position sizing
      const positionSize = riskManagementService.calculatePositionSize(
        availableBudget,
        currentPrice,
        riskLevel,
        marketType,
        undefined, // No market analysis for basic calculation
        confidence
      );

      // Ensure minimum trade value
      const positionValue = positionSize * currentPrice;
      if (positionValue < this.MIN_TRADE_VALUE) {
        logService.log('info', `Adjusting position size to meet minimum trade value of $${this.MIN_TRADE_VALUE}`, {
          originalSize: positionSize,
          originalValue: positionValue
        }, 'EnhancedPositionSizing');

        return this.MIN_TRADE_VALUE / currentPrice;
      }

      return positionSize;
    } catch (error) {
      logService.log('error', 'Error calculating basic position size', error, 'EnhancedPositionSizing');
      // Return a safe default value (1% of available budget)
      return (options.availableBudget * 0.01) / options.currentPrice;
    }
  }

  /**
   * Calculate position size based on risk per trade
   * This method uses the stop loss to determine position size
   * @param options Position sizing options with stopLossPrice
   * @returns Position size in asset units
   */
  calculateRiskBasedPositionSize(options: PositionSizingOptions): number {
    try {
      const {
        availableBudget,
        currentPrice,
        riskLevel,
        stopLossPrice
      } = options;

      // If no stop loss price is provided, fall back to basic position sizing
      if (!stopLossPrice) {
        logService.log('warn', 'No stop loss price provided for risk-based position sizing, falling back to basic method', null, 'EnhancedPositionSizing');
        return this.calculateBasicPositionSize(options);
      }

      // Get risk config for the specified risk level
      const riskConfig = riskManagementService.getRiskConfig(riskLevel);

      // Calculate risk amount (how much we're willing to lose on this trade)
      const riskAmount = availableBudget * riskConfig.maxRiskPerTrade;

      // Calculate the price difference between entry and stop loss
      const priceDifference = Math.abs(currentPrice - stopLossPrice);

      // Calculate position size based on risk amount and price difference
      // Formula: riskAmount / priceDifference = position size
      let positionSize = riskAmount / priceDifference;

      // Ensure position size doesn't exceed max allowed percentage of budget
      const maxPositionSize = (availableBudget * riskConfig.maxPositionSizePercentage) / currentPrice;
      positionSize = Math.min(positionSize, maxPositionSize);

      // Round position size appropriately
      positionSize = this.roundPositionSize(positionSize, currentPrice);

      // Ensure minimum trade value
      const positionValue = positionSize * currentPrice;
      if (positionValue < this.MIN_TRADE_VALUE) {
        logService.log('info', `Adjusting risk-based position size to meet minimum trade value of $${this.MIN_TRADE_VALUE}`, {
          originalSize: positionSize,
          originalValue: positionValue
        }, 'EnhancedPositionSizing');

        return this.MIN_TRADE_VALUE / currentPrice;
      }

      logService.log('debug', 'Calculated risk-based position size', {
        availableBudget,
        currentPrice,
        stopLossPrice,
        riskAmount,
        priceDifference,
        positionSize,
        positionValue
      }, 'EnhancedPositionSizing');

      return positionSize;
    } catch (error) {
      logService.log('error', 'Error calculating risk-based position size', error, 'EnhancedPositionSizing');
      // Fall back to basic position sizing
      return this.calculateBasicPositionSize(options);
    }
  }

  /**
   * Calculate position size using Kelly Criterion
   * @param options Position sizing options
   * @returns Position size in asset units
   */
  async calculateKellyPositionSize(options: PositionSizingOptions): Promise<number> {
    try {
      const {
        availableBudget,
        currentPrice,
        riskLevel,
        strategyId
      } = options;

      // If no strategy ID is provided, fall back to basic position sizing
      if (!strategyId) {
        logService.log('warn', 'No strategy ID provided for Kelly position sizing, falling back to basic method', null, 'EnhancedPositionSizing');
        return this.calculateBasicPositionSize(options);
      }

      // Get historical trade data for the strategy
      const trades = await tradeService.getTradeHistory(strategyId);

      // If not enough trade history, fall back to basic position sizing
      if (trades.length < 10) {
        logService.log('info', `Not enough trade history (${trades.length} trades) for Kelly position sizing, falling back to basic method`, null, 'EnhancedPositionSizing');
        return this.calculateBasicPositionSize(options);
      }

      // Calculate win rate and average win/loss ratio
      const winningTrades = trades.filter(trade => trade.pnl > 0);
      const losingTrades = trades.filter(trade => trade.pnl < 0);

      const winRate = winningTrades.length / trades.length;

      const avgWin = winningTrades.length > 0 ?
        winningTrades.reduce((sum, trade) => sum + trade.pnl, 0) / winningTrades.length : 0;

      const avgLoss = losingTrades.length > 0 ?
        Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0) / losingTrades.length) : 1;

      // Use risk management service to calculate Kelly position size
      const kellyPositionSizeUSD = riskManagementService.calculateKellyPositionSize(
        availableBudget,
        winRate,
        avgWin,
        avgLoss,
        riskLevel
      );

      // Convert to asset units
      let positionSize = kellyPositionSizeUSD / currentPrice;

      // Round position size appropriately
      positionSize = this.roundPositionSize(positionSize, currentPrice);

      // Ensure minimum trade value
      const positionValue = positionSize * currentPrice;
      if (positionValue < this.MIN_TRADE_VALUE) {
        logService.log('info', `Adjusting Kelly position size to meet minimum trade value of $${this.MIN_TRADE_VALUE}`, {
          originalSize: positionSize,
          originalValue: positionValue
        }, 'EnhancedPositionSizing');

        return this.MIN_TRADE_VALUE / currentPrice;
      }

      logService.log('debug', 'Calculated Kelly position size', {
        availableBudget,
        currentPrice,
        winRate,
        avgWin,
        avgLoss,
        kellyPositionSizeUSD,
        positionSize,
        positionValue
      }, 'EnhancedPositionSizing');

      return positionSize;
    } catch (error) {
      logService.log('error', 'Error calculating Kelly position size', error, 'EnhancedPositionSizing');
      // Fall back to basic position sizing
      return this.calculateBasicPositionSize(options);
    }
  }

  /**
   * Calculate position size using volatility-adjusted method
   * @param options Position sizing options with volatility
   * @returns Position size in asset units
   */
  calculateVolatilityAdjustedPositionSize(options: PositionSizingOptions): number {
    try {
      const {
        availableBudget,
        currentPrice,
        riskLevel,
        volatility
      } = options;

      // If no volatility is provided, fall back to basic position sizing
      if (volatility === undefined) {
        logService.log('warn', 'No volatility provided for volatility-adjusted position sizing, falling back to basic method', null, 'EnhancedPositionSizing');
        return this.calculateBasicPositionSize(options);
      }

      // Get risk config for the specified risk level
      const riskConfig = riskManagementService.getRiskConfig(riskLevel);

      // Base position size as percentage of available budget
      let baseSize = availableBudget * riskConfig.maxPositionSizePercentage;

      // Calculate volatility factor (inverse relationship - higher volatility = smaller position)
      let volatilityFactor = 1;

      if (volatility <= 10) {
        volatilityFactor = 1.2; // Very low volatility - increase position size
      } else if (volatility <= 20) {
        volatilityFactor = 1.0; // Low volatility - normal position size
      } else if (volatility <= 30) {
        volatilityFactor = 0.8; // Medium volatility - reduce position size
      } else if (volatility <= 50) {
        volatilityFactor = 0.6; // High volatility - significantly reduce position size
      } else {
        volatilityFactor = 0.4; // Very high volatility - drastically reduce position size
      }

      // Apply volatility adjustment
      let adjustedSize = baseSize * volatilityFactor;

      // Convert to asset units
      let positionSize = adjustedSize / currentPrice;

      // Round position size appropriately
      positionSize = this.roundPositionSize(positionSize, currentPrice);

      // Ensure minimum trade value
      const positionValue = positionSize * currentPrice;
      if (positionValue < this.MIN_TRADE_VALUE) {
        logService.log('info', `Adjusting volatility-adjusted position size to meet minimum trade value of $${this.MIN_TRADE_VALUE}`, {
          originalSize: positionSize,
          originalValue: positionValue
        }, 'EnhancedPositionSizing');

        return this.MIN_TRADE_VALUE / currentPrice;
      }

      logService.log('debug', 'Calculated volatility-adjusted position size', {
        availableBudget,
        currentPrice,
        volatility,
        volatilityFactor,
        adjustedSize,
        positionSize,
        positionValue
      }, 'EnhancedPositionSizing');

      return positionSize;
    } catch (error) {
      logService.log('error', 'Error calculating volatility-adjusted position size', error, 'EnhancedPositionSizing');
      // Fall back to basic position sizing
      return this.calculateBasicPositionSize(options);
    }
  }

  /**
   * Round position size appropriately based on asset price
   * @param positionSize Position size in asset units
   * @param price Current price of the asset
   * @returns Rounded position size
   */
  roundPositionSize(positionSize: number, price: number): number {
    try {
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
        // For extremely low-priced assets (penny tokens): round to 0 decimal places
        return Math.floor(positionSize * 1e8) / 1e8;
      }
    } catch (error) {
      logService.log('error', 'Error rounding position size', error, 'EnhancedPositionSizing');
      // Return the original position size if rounding fails
      return positionSize;
    }
  }
  /**
   * Calculate optimal position size using the best available algorithm
   * @param options Position sizing options
   * @returns Promise that resolves to the optimal position size
   */
  async calculateOptimalPositionSize(options: PositionSizingOptions): Promise<number> {
    try {
      const {
        stopLossPrice,
        volatility,
        strategyId
      } = options;

      // Try Kelly Criterion first if we have a strategy ID
      if (strategyId) {
        try {
          const kellySize = await this.calculateKellyPositionSize(options);
          logService.log('info', 'Using Kelly Criterion for position sizing', null, 'EnhancedPositionSizing');
          return kellySize;
        } catch (kellyError) {
          logService.log('warn', 'Kelly Criterion calculation failed, trying next method', kellyError, 'EnhancedPositionSizing');
          // Continue to next method
        }
      }

      // Try risk-based position sizing if we have a stop loss price
      if (stopLossPrice) {
        try {
          const riskBasedSize = this.calculateRiskBasedPositionSize(options);
          logService.log('info', 'Using risk-based method for position sizing', null, 'EnhancedPositionSizing');
          return riskBasedSize;
        } catch (riskError) {
          logService.log('warn', 'Risk-based calculation failed, trying next method', riskError, 'EnhancedPositionSizing');
          // Continue to next method
        }
      }

      // Try volatility-adjusted position sizing if we have volatility data
      if (volatility !== undefined) {
        try {
          const volatilitySize = this.calculateVolatilityAdjustedPositionSize(options);
          logService.log('info', 'Using volatility-adjusted method for position sizing', null, 'EnhancedPositionSizing');
          return volatilitySize;
        } catch (volatilityError) {
          logService.log('warn', 'Volatility-adjusted calculation failed, falling back to basic method', volatilityError, 'EnhancedPositionSizing');
          // Continue to basic method
        }
      }

      // Fall back to basic position sizing
      logService.log('info', 'Using basic method for position sizing', null, 'EnhancedPositionSizing');
      return this.calculateBasicPositionSize(options);
    } catch (error) {
      logService.log('error', 'Error calculating optimal position size', error, 'EnhancedPositionSizing');
      // Fall back to basic position sizing as a last resort
      return this.calculateBasicPositionSize(options);
    }
  }
}

export const enhancedPositionSizing = EnhancedPositionSizing.getInstance();
