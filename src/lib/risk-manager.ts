import { EventEmitter } from './event-emitter';
import { logService } from './log-service';
import { tradeService } from './trade-service';
import type { Strategy, RiskMetrics, Position } from './types';

export class RiskManager extends EventEmitter {
  private static instance: RiskManager;
  private metrics: Map<string, RiskMetrics> = new Map();
  private readonly MAX_DRAWDOWN = 0.15; // 15%
  private readonly MAX_DAILY_LOSS = 0.10; // 10%
  private readonly POSITION_SIZE_LIMIT = 0.20; // 20% of portfolio

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
      (metrics.exposureRatio > this.POSITION_SIZE_LIMIT ? 1 : 0) * weights.exposureRatio +
      (metrics.volatility > 0.02 ? 1 : 0) * weights.volatility
    );
  }

  private shouldTriggerRiskAlert(metrics: RiskMetrics): boolean {
    return (
      metrics.drawdown > this.MAX_DRAWDOWN ||
      metrics.dailyPnL < -this.MAX_DAILY_LOSS ||
      metrics.exposureRatio > this.POSITION_SIZE_LIMIT ||
      metrics.riskScore > 0.7
    );
  }

  getRiskMetrics(strategyId: string): RiskMetrics | undefined {
    return this.metrics.get(strategyId);
  }
}

export const riskManager = RiskManager.getInstance();
