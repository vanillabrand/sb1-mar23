import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { tradeService } from './trade-service';
import type { Strategy, RiskMetrics, Position, TradeOptions } from './types';

export class RiskManager extends EventEmitter {
  private static instance: RiskManager;
  private metrics: Map<string, RiskMetrics> = new Map();
  private readonly MAX_DRAWDOWN = 0.15; // 15%
  private readonly MAX_DAILY_LOSS = 0.10; // 10%
  // No position size limit
  private readonly POSITION_SIZE_LIMIT = Number.MAX_VALUE; // Effectively no limit

  private constructor() {
    super();
  }

  static getInstance(): RiskManager {
    if (!RiskManager.instance) {
      RiskManager.instance = new RiskManager();
    }
    return RiskManager.instance;
  }

  async evaluateRisk(strategy: Strategy): Promise<RiskMetrics> {
    try {
      const positions = await tradeService.getOpenPositions(strategy.id);
      const metrics = await this.calculateRiskMetrics(strategy, positions);
      this.metrics.set(strategy.id, metrics);

      if (this.shouldTriggerRiskAlert(metrics)) {
        this.emit('riskAlert', {
          strategyId: strategy.id,
          metrics,
          timestamp: Date.now()
        });
      }

      return metrics;
    } catch (error) {
      logService.log('error', 'Failed to evaluate risk',
        { strategyId: strategy.id, error }, 'RiskManager');
      throw error;
    }
  }

  private async calculateRiskMetrics(
    strategy: Strategy,
    positions: Position[]
  ): Promise<RiskMetrics> {
    const totalValue = await tradeService.getPortfolioValue(strategy.id);
    const dailyPnL = await this.calculateDailyPnL(strategy);
    const drawdown = await this.calculateDrawdown(strategy);
    const exposureRatio = this.calculateExposureRatio(positions, totalValue);
    const volatility = await this.calculateVolatility(strategy);

    return {
      timestamp: Date.now(),
      totalValue,
      dailyPnL,
      drawdown,
      exposureRatio,
      volatility,
      riskScore: this.calculateRiskScore({
        dailyPnL,
        drawdown,
        exposureRatio,
        volatility
      })
    };
  }

  private async calculateDailyPnL(strategy: Strategy): Promise<number> {
    const trades = await tradeService.getDailyTrades(strategy.id);
    return trades.reduce((total, trade) => total + trade.realizedPnL, 0);
  }

  private async calculateDrawdown(strategy: Strategy): Promise<number> {
    const history = await tradeService.getEquityCurve(strategy.id);
    let peak = -Infinity;
    let maxDrawdown = 0;

    history.forEach(point => {
      if (point.equity > peak) {
        peak = point.equity;
      }
      const drawdown = (peak - point.equity) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    });

    return maxDrawdown;
  }

  private calculateExposureRatio(
    positions: Position[],
    totalValue: number
  ): number {
    const totalExposure = positions.reduce(
      (sum, pos) => sum + Math.abs(pos.value),
      0
    );
    return totalExposure / totalValue;
  }

  private async calculateVolatility(strategy: Strategy): Promise<number> {
    const returns = await tradeService.getDailyReturns(strategy.id);
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const squaredDiffs = returns.map(ret => Math.pow(ret - mean, 2));
    return Math.sqrt(
      squaredDiffs.reduce((sum, diff) => sum + diff, 0) / returns.length
    );
  }

  private calculateRiskScore(metrics: {
    dailyPnL: number;
    drawdown: number;
    exposureRatio: number;
    volatility: number;
  }): number {
    const weights = {
      dailyPnL: 0.25,
      drawdown: 0.30,
      exposureRatio: 0.25,
      volatility: 0.20
    };

    return (
      (metrics.dailyPnL < -this.MAX_DAILY_LOSS ? 1 : 0) * weights.dailyPnL +
      (metrics.drawdown > this.MAX_DRAWDOWN ? 1 : 0) * weights.drawdown +
      // No position size limit check in risk score calculation
      0 * weights.exposureRatio +
      (metrics.volatility > 0.02 ? 1 : 0) * weights.volatility
    );
  }

  private shouldTriggerRiskAlert(metrics: RiskMetrics): boolean {
    return (
      metrics.drawdown > this.MAX_DRAWDOWN ||
      metrics.dailyPnL < -this.MAX_DAILY_LOSS ||
      // No position size limit check for risk alerts
      metrics.riskScore > 0.7
    );
  }

  getRiskMetrics(strategyId: string): RiskMetrics | undefined {
    return this.metrics.get(strategyId);
  }

  /**
   * Validates a trade against risk parameters
   * @param options Trade options
   * @returns Object with approval status and reason
   */
  async validateTrade(options: TradeOptions): Promise<{ approved: boolean; reason: string }> {
    try {
      // Get the strategy ID
      const strategyId = options.strategyId || options.strategy_id;

      if (!strategyId) {
        return { approved: true, reason: 'No strategy ID provided, skipping risk validation' };
      }

      // Get the budget for this strategy
      const budget = tradeService.getBudget(strategyId);
      if (!budget) {
        return { approved: false, reason: 'No budget found for strategy' };
      }

      // Calculate the trade cost
      const tradePrice = options.entry_price || options.price || 0;
      const tradeAmount = options.amount || 0;
      const tradeCost = tradePrice * tradeAmount;

      // Check if we have enough budget
      if (budget.available < tradeCost) {
        return {
          approved: false,
          reason: `Insufficient budget: ${tradeCost} required, ${budget.available} available`
        };
      }

      // No maximum position size check
      // We've removed the position size limit as per requirements

      // Get risk metrics for this strategy if available
      const metrics = this.getRiskMetrics(strategyId);
      if (metrics) {
        // Check if we're already at risk limits
        if (metrics.drawdown > this.MAX_DRAWDOWN) {
          return {
            approved: false,
            reason: `Maximum drawdown exceeded: ${(metrics.drawdown * 100).toFixed(2)}% > ${(this.MAX_DRAWDOWN * 100).toFixed(2)}%`
          };
        }

        if (metrics.dailyPnL < -this.MAX_DAILY_LOSS * budget.total) {
          return {
            approved: false,
            reason: `Maximum daily loss exceeded: ${metrics.dailyPnL.toFixed(2)} < ${(-this.MAX_DAILY_LOSS * budget.total).toFixed(2)}`
          };
        }

        if (metrics.riskScore > 0.7) {
          return {
            approved: false,
            reason: `Risk score too high: ${metrics.riskScore.toFixed(2)} > 0.7`
          };
        }
      }

      // All checks passed
      return { approved: true, reason: 'Trade approved' };
    } catch (error) {
      logService.log('error', 'Error validating trade', error, 'RiskManager');
      // Default to approving the trade if there's an error in validation
      return { approved: true, reason: 'Error in validation, trade approved by default' };
    }
  }
}

export const riskManager = RiskManager.getInstance();
