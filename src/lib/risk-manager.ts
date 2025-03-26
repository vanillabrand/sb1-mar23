import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { tradeManager } from './trade-manager';

class RiskManager extends EventEmitter {
  private strategyRiskParams: Map<string, RiskParameters> = new Map();
  private readonly DEFAULT_MAX_DRAWDOWN = 0.1; // 10%
  private readonly DEFAULT_MAX_POSITION_SIZE = 0.2; // 20% of budget
  private readonly DEFAULT_MAX_DAILY_TRADES = 10;

  async initializeStrategyRisk(strategy: any): Promise<void> {
    try {
      const riskParams: RiskParameters = {
        maxDrawdown: strategy.strategy_config?.maxDrawdown || this.DEFAULT_MAX_DRAWDOWN,
        maxPositionSize: strategy.strategy_config?.maxPositionSize || this.DEFAULT_MAX_POSITION_SIZE,
        maxDailyTrades: strategy.strategy_config?.maxDailyTrades || this.DEFAULT_MAX_DAILY_TRADES,
        stopLossPercentage: strategy.strategy_config?.stopLossPercentage,
        takeProfitPercentage: strategy.strategy_config?.takeProfitPercentage,
        trailingStopPercentage: strategy.strategy_config?.trailingStopPercentage,
        maxOpenPositions: strategy.strategy_config?.maxOpenPositions || 1,
        riskPerTrade: strategy.strategy_config?.riskPerTrade || 0.02
      };

      this.strategyRiskParams.set(strategy.id, riskParams);
    } catch (error) {
      logService.log('error', `Failed to initialize risk parameters for strategy ${strategy.id}`, 
        error, 'RiskManager');
      throw error;
    }
  }

  async validateRiskParameters(strategy: any): Promise<boolean> {
    try {
      const config = strategy.strategy_config;
      
      // Validate required parameters
      if (!config || !config.maxDrawdown || !config.maxPositionSize) {
        return false;
      }

      // Validate ranges
      if (config.maxDrawdown > 0.5 || config.maxPositionSize > 0.5) {
        return false;
      }

      // Validate stop loss and take profit
      if (config.stopLossPercentage && config.stopLossPercentage > 0.2) {
        return false;
      }

      if (config.takeProfitPercentage && config.takeProfitPercentage < config.stopLossPercentage) {
        return false;
      }

      return true;
    } catch (error) {
      logService.log('error', `Risk parameter validation failed for strategy ${strategy.id}`, 
        error, 'RiskManager');
      return false;
    }
  }

  async checkRiskLimits(strategy: any): Promise<RiskStatus> {
    try {
      const riskParams = this.strategyRiskParams.get(strategy.id);
      if (!riskParams) {
        throw new Error(`Risk parameters not found for strategy ${strategy.id}`);
      }

      const checks = await Promise.all([
        this.checkDrawdown(strategy, riskParams),
        this.checkPositionSizes(strategy, riskParams),
        this.checkDailyTradeLimit(strategy, riskParams),
        this.checkOpenPositions(strategy, riskParams)
      ]);

      const violations = checks.filter(check => !check.withinLimits);
      
      return {
        withinLimits: violations.length === 0,
        violations,
        requiresPositionClose: violations.some(v => v.requiresPositionClose),
        reason: violations.map(v => v.reason).join(', ')
      };
    } catch (error) {
      logService.log('error', `Risk check failed for strategy ${strategy.id}`, error, 'RiskManager');
      return {
        withinLimits: false,
        violations: [{
          type: 'error',
          reason: 'Risk check failed',
          requiresPositionClose: true
        }],
        requiresPositionClose: true,
        reason: 'Risk check failed'
      };
    }
  }

  async validateTradeSignal(strategy: any, signal: any): Promise<any> {
    try {
      const riskParams = this.strategyRiskParams.get(strategy.id);
      if (!riskParams) return null;

      // Validate position size
      const adjustedSize = this.calculateSafePositionSize(
        signal.amount,
        strategy,
        riskParams
      );

      if (adjustedSize <= 0) return null;

      // Add risk management parameters
      return {
        ...signal,
        amount: adjustedSize,
        stopLoss: this.calculateStopLoss(signal, riskParams),
        takeProfit: this.calculateTakeProfit(signal, riskParams),
        trailingStop: riskParams.trailingStopPercentage ? {
          percentage: riskParams.trailingStopPercentage,
          activation: signal.entry.price * (1 + riskParams.trailingStopPercentage)
        } : null
      };
    } catch (error) {
      logService.log('error', `Signal validation failed for strategy ${strategy.id}`, 
        error, 'RiskManager');
      return null;
    }
  }

  private async checkDrawdown(strategy: any, riskParams: RiskParameters): Promise<RiskCheckResult> {
    const trades = await tradeManager.getStrategyTrades(strategy.id);
    const drawdown = this.calculateDrawdown(trades);
    
    return {
      type: 'drawdown',
      withinLimits: drawdown <= riskParams.maxDrawdown,
      requiresPositionClose: drawdown > riskParams.maxDrawdown * 1.2,
      reason: `Drawdown (${(drawdown * 100).toFixed(2)}%) exceeds limit (${(riskParams.maxDrawdown * 100).toFixed(2)}%)`
    };
  }

  private calculateSafePositionSize(
    proposedSize: number,
    strategy: any,
    riskParams: RiskParameters
  ): number {
    const budget = tradeManager.getAvailableBudget(strategy.id);
    const maxSize = budget * riskParams.maxPositionSize;
    return Math.min(proposedSize, maxSize);
  }

  private calculateStopLoss(signal: any, riskParams: RiskParameters): number | null {
    if (!riskParams.stopLossPercentage) return null;
    
    const direction = signal.type.toLowerCase() === 'long' ? -1 : 1;
    return signal.entry.price * (1 + direction * riskParams.stopLossPercentage);
  }

  private calculateTakeProfit(signal: any, riskParams: RiskParameters): number | null {
    if (!riskParams.takeProfitPercentage) return null;
    
    const direction = signal.type.toLowerCase() === 'long' ? 1 : -1;
    return signal.entry.price * (1 + direction * riskParams.takeProfitPercentage);
  }
}

interface RiskParameters {
  maxDrawdown: number;
  maxPositionSize: number;
  maxDailyTrades: number;
  stopLossPercentage?: number;
  takeProfitPercentage?: number;
  trailingStopPercentage?: number;
  maxOpenPositions: number;
  riskPerTrade: number;
}

interface RiskCheckResult {
  type: string;
  withinLimits: boolean;
  requiresPositionClose: boolean;
  reason: string;
}

interface RiskStatus {
  withinLimits: boolean;
  violations: RiskCheckResult[];
  requiresPositionClose: boolean;
  reason: string;
}

export const riskManager = new RiskManager();