import { logService } from './log-service';
import { Strategy } from './types';

/**
 * Utility class for calculating realistic strategy metrics
 */
export class StrategyMetricsCalculator {
  private static instance: StrategyMetricsCalculator;

  private constructor() {}

  static getInstance(): StrategyMetricsCalculator {
    if (!StrategyMetricsCalculator.instance) {
      StrategyMetricsCalculator.instance = new StrategyMetricsCalculator();
    }
    return StrategyMetricsCalculator.instance;
  }

  /**
   * Calculate realistic win rate based on strategy parameters
   * @param strategy The strategy to calculate win rate for
   * @returns Realistic win rate percentage
   */
  calculateWinRate(strategy: Strategy): number {
    try {
      // Get risk level
      const riskLevel = strategy.riskLevel || (strategy as any).risk_level || 'Medium';
      
      // Base win rate by risk level
      const baseWinRate = this.getBaseWinRateByRiskLevel(riskLevel);
      
      // Adjust based on strategy configuration
      let adjustedWinRate = baseWinRate;
      
      // Adjust based on strategy parameters if available
      if (strategy.strategy_config) {
        // Adjust based on stop loss and take profit ratio
        const stopLoss = this.getStopLossFromConfig(strategy);
        const takeProfit = this.getTakeProfitFromConfig(strategy);
        
        if (stopLoss > 0 && takeProfit > 0) {
          // Risk-reward ratio adjustment
          const rrRatio = takeProfit / stopLoss;
          if (rrRatio >= 2) {
            // Better risk-reward ratio can reduce win rate needed for profitability
            adjustedWinRate -= (rrRatio - 2) * 2; // Reduce win rate for better R:R
          } else if (rrRatio < 1) {
            // Poor risk-reward ratio requires higher win rate
            adjustedWinRate += (1 - rrRatio) * 10; // Increase win rate for worse R:R
          }
        }
        
        // Adjust based on indicators used
        const indicators = this.getIndicatorsFromConfig(strategy);
        if (indicators.includes('RSI') && indicators.includes('MACD')) {
          adjustedWinRate += 2; // Multiple confirmation indicators can improve win rate
        }
        
        // Adjust based on timeframe
        const timeframe = this.getTimeframeFromConfig(strategy);
        if (timeframe === '1d' || timeframe === 'daily') {
          adjustedWinRate += 3; // Daily timeframes tend to have higher win rates
        } else if (timeframe === '1m' || timeframe === '5m') {
          adjustedWinRate -= 5; // Very short timeframes tend to have lower win rates
        }
      }
      
      // Ensure win rate is within realistic bounds
      return Math.min(Math.max(adjustedWinRate, 35), 75);
    } catch (error) {
      logService.log('error', 'Error calculating win rate', error, 'StrategyMetricsCalculator');
      return 50; // Default to 50% if calculation fails
    }
  }
  
  /**
   * Calculate realistic potential profit based on strategy parameters
   * @param strategy The strategy to calculate potential profit for
   * @returns Realistic potential profit percentage
   */
  calculatePotentialProfit(strategy: Strategy): number {
    try {
      // Get risk level
      const riskLevel = strategy.riskLevel || (strategy as any).risk_level || 'Medium';
      
      // Base monthly return by risk level
      const baseMonthlyReturn = this.getBaseMonthlyReturnByRiskLevel(riskLevel);
      
      // Adjust based on strategy configuration
      let adjustedReturn = baseMonthlyReturn;
      
      // Adjust based on strategy parameters if available
      if (strategy.strategy_config) {
        // Adjust based on stop loss and take profit ratio
        const stopLoss = this.getStopLossFromConfig(strategy);
        const takeProfit = this.getTakeProfitFromConfig(strategy);
        
        if (stopLoss > 0 && takeProfit > 0) {
          // Risk-reward ratio adjustment
          const rrRatio = takeProfit / stopLoss;
          adjustedReturn *= Math.sqrt(rrRatio); // Scale return by square root of R:R ratio
        }
        
        // Adjust based on position size
        const positionSize = this.getPositionSizeFromConfig(strategy);
        if (positionSize > 0) {
          // Larger position sizes increase potential return but also risk
          adjustedReturn *= Math.sqrt(positionSize / 10); // Scale by square root of position size percentage
        }
        
        // Adjust based on timeframe
        const timeframe = this.getTimeframeFromConfig(strategy);
        if (timeframe === '1h' || timeframe === '4h') {
          adjustedReturn *= 1.2; // Medium timeframes often have good balance of return
        } else if (timeframe === '1m' || timeframe === '5m') {
          adjustedReturn *= 0.8; // Very short timeframes often have lower returns due to fees
        }
      }
      
      // Ensure return is within realistic bounds
      return Math.min(Math.max(adjustedReturn, 1), 50);
    } catch (error) {
      logService.log('error', 'Error calculating potential profit', error, 'StrategyMetricsCalculator');
      return 10; // Default to 10% if calculation fails
    }
  }
  
  /**
   * Get base win rate by risk level
   * @param riskLevel Risk level of the strategy
   * @returns Base win rate percentage
   */
  private getBaseWinRateByRiskLevel(riskLevel: string): number {
    switch (riskLevel) {
      case 'Ultra Low':
        return 65; // 65% win rate
      case 'Low':
        return 60; // 60% win rate
      case 'Medium':
        return 55; // 55% win rate
      case 'High':
        return 50; // 50% win rate
      case 'Ultra High':
        return 45; // 45% win rate
      case 'Extreme':
        return 42; // 42% win rate
      case 'God Mode':
        return 38; // 38% win rate
      default:
        return 50; // 50% win rate
    }
  }
  
  /**
   * Get base monthly return by risk level
   * @param riskLevel Risk level of the strategy
   * @returns Base monthly return percentage
   */
  private getBaseMonthlyReturnByRiskLevel(riskLevel: string): number {
    switch (riskLevel) {
      case 'Ultra Low':
        return 3; // 3% monthly return
      case 'Low':
        return 5; // 5% monthly return
      case 'Medium':
        return 8; // 8% monthly return
      case 'High':
        return 12; // 12% monthly return
      case 'Ultra High':
        return 18; // 18% monthly return
      case 'Extreme':
        return 25; // 25% monthly return
      case 'God Mode':
        return 35; // 35% monthly return
      default:
        return 8; // 8% monthly return
    }
  }
  
  /**
   * Extract stop loss from strategy configuration
   * @param strategy Strategy object
   * @returns Stop loss percentage or default value
   */
  private getStopLossFromConfig(strategy: Strategy): number {
    try {
      const config = strategy.strategy_config;
      
      // Check different possible locations for stop loss
      if (config.risk_management?.stopLoss) {
        return config.risk_management.stopLoss * 100;
      }
      
      if (config.risk_management?.stop_loss) {
        return config.risk_management.stop_loss * 100;
      }
      
      if (config.stopLoss) {
        return config.stopLoss * 100;
      }
      
      if (config.stop_loss) {
        return config.stop_loss * 100;
      }
      
      if (config.exitConditions?.stopLossPct) {
        return config.exitConditions.stopLossPct;
      }
      
      // Default stop loss based on risk level
      const riskLevel = strategy.riskLevel || (strategy as any).risk_level || 'Medium';
      switch (riskLevel) {
        case 'Ultra Low': return 1;
        case 'Low': return 2;
        case 'Medium': return 3;
        case 'High': return 5;
        case 'Ultra High': return 8;
        case 'Extreme': return 12;
        case 'God Mode': return 15;
        default: return 3;
      }
    } catch (error) {
      return 3; // Default to 3% if extraction fails
    }
  }
  
  /**
   * Extract take profit from strategy configuration
   * @param strategy Strategy object
   * @returns Take profit percentage or default value
   */
  private getTakeProfitFromConfig(strategy: Strategy): number {
    try {
      const config = strategy.strategy_config;
      
      // Check different possible locations for take profit
      if (config.risk_management?.takeProfit) {
        return config.risk_management.takeProfit * 100;
      }
      
      if (config.risk_management?.take_profit) {
        return config.risk_management.take_profit * 100;
      }
      
      if (config.takeProfit) {
        return config.takeProfit * 100;
      }
      
      if (config.take_profit) {
        return config.take_profit * 100;
      }
      
      if (config.exitConditions?.takeProfitPct) {
        return config.exitConditions.takeProfitPct;
      }
      
      // Default take profit based on risk level
      const riskLevel = strategy.riskLevel || (strategy as any).risk_level || 'Medium';
      switch (riskLevel) {
        case 'Ultra Low': return 2;
        case 'Low': return 3;
        case 'Medium': return 6;
        case 'High': return 10;
        case 'Ultra High': return 15;
        case 'Extreme': return 20;
        case 'God Mode': return 30;
        default: return 6;
      }
    } catch (error) {
      return 6; // Default to 6% if extraction fails
    }
  }
  
  /**
   * Extract position size from strategy configuration
   * @param strategy Strategy object
   * @returns Position size percentage or default value
   */
  private getPositionSizeFromConfig(strategy: Strategy): number {
    try {
      const config = strategy.strategy_config;
      
      // Check different possible locations for position size
      if (config.risk_management?.positionSize) {
        return config.risk_management.positionSize;
      }
      
      if (config.risk_management?.position_size) {
        return config.risk_management.position_size;
      }
      
      if (config.positionSize) {
        return config.positionSize;
      }
      
      if (config.position_size) {
        return config.position_size;
      }
      
      if (config.risk_management?.positionSizePercentage) {
        return config.risk_management.positionSizePercentage;
      }
      
      // Default position size based on risk level
      const riskLevel = strategy.riskLevel || (strategy as any).risk_level || 'Medium';
      switch (riskLevel) {
        case 'Ultra Low': return 5;
        case 'Low': return 10;
        case 'Medium': return 15;
        case 'High': return 20;
        case 'Ultra High': return 25;
        case 'Extreme': return 30;
        case 'God Mode': return 50;
        default: return 15;
      }
    } catch (error) {
      return 15; // Default to 15% if extraction fails
    }
  }
  
  /**
   * Extract timeframe from strategy configuration
   * @param strategy Strategy object
   * @returns Timeframe string or default value
   */
  private getTimeframeFromConfig(strategy: Strategy): string {
    try {
      const config = strategy.strategy_config;
      
      // Check different possible locations for timeframe
      if (config.timeframe) {
        return config.timeframe;
      }
      
      if (config.time_frame) {
        return config.time_frame;
      }
      
      return '1h'; // Default timeframe
    } catch (error) {
      return '1h'; // Default to 1h if extraction fails
    }
  }
  
  /**
   * Extract indicators from strategy configuration
   * @param strategy Strategy object
   * @returns Array of indicator names
   */
  private getIndicatorsFromConfig(strategy: Strategy): string[] {
    try {
      const config = strategy.strategy_config;
      const indicators: string[] = [];
      
      // Check different possible locations for indicators
      if (config.indicators) {
        // If indicators is an object, extract keys
        if (typeof config.indicators === 'object') {
          return Object.keys(config.indicators);
        }
        
        // If indicators is an array, return it
        if (Array.isArray(config.indicators)) {
          return config.indicators;
        }
      }
      
      // Check entry conditions for indicator names
      if (config.entryConditions) {
        if (config.entryConditions.rsiPeriod) indicators.push('RSI');
        if (config.entryConditions.macdFast) indicators.push('MACD');
        if (config.entryConditions.emaShort) indicators.push('EMA');
        if (config.entryConditions.smaShort) indicators.push('SMA');
        if (config.entryConditions.bbPeriod) indicators.push('Bollinger');
        if (config.entryConditions.atrPeriod) indicators.push('ATR');
      }
      
      // Check entry rules for indicator names
      if (config.entry_rules && Array.isArray(config.entry_rules)) {
        for (const rule of config.entry_rules) {
          if (typeof rule === 'string') {
            if (rule.includes('RSI')) indicators.push('RSI');
            if (rule.includes('MACD')) indicators.push('MACD');
            if (rule.includes('EMA')) indicators.push('EMA');
            if (rule.includes('SMA')) indicators.push('SMA');
            if (rule.includes('Bollinger')) indicators.push('Bollinger');
            if (rule.includes('ATR')) indicators.push('ATR');
          }
        }
      }
      
      return indicators;
    } catch (error) {
      return []; // Return empty array if extraction fails
    }
  }
}

export const strategyMetricsCalculator = StrategyMetricsCalculator.getInstance();
