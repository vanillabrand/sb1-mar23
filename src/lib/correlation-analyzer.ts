class CorrelationAnalyzer {
  private readonly CORRELATION_THRESHOLD = 0.7;
  private readonly LOOKBACK_PERIODS = 100;

  async analyzeStrategyCorrelations(
    strategy: Strategy,
    activeStrategies: Strategy[]
  ): Promise<CorrelationAnalysis> {
    try {
      const returns = await this.calculateStrategyReturns(strategy, activeStrategies);
      const correlations = this.calculateCorrelationMatrix(returns);
      const risks = this.assessCorrelationRisks(correlations);

      // Calculate diversification score
      const diversificationScore = this.calculateDiversificationScore(correlations);

      // Identify highly correlated strategy pairs
      const correlatedPairs = this.identifyCorrelatedPairs(
        correlations,
        strategy,
        activeStrategies
      );

      return {
        overallScore: diversificationScore,
        correlatedPairs,
        risks,
        recommendations: this.generateRecommendations(risks, correlatedPairs)
      };
    } catch (error) {
      logService.log('error', 'Error analyzing strategy correlations', error, 'CorrelationAnalyzer');
      throw error;
    }
  }

  private async calculateStrategyReturns(
    strategy: Strategy,
    activeStrategies: Strategy[]
  ): Promise<Record<string, number[]>> {
    const returns: Record<string, number[]> = {};
    
    for (const strat of [strategy, ...activeStrategies]) {
      returns[strat.id] = await this.fetchStrategyReturns(strat, this.LOOKBACK_PERIODS);
    }
    
    return returns;
  }

  private calculateCorrelationMatrix(returns: Record<string, number[]>): number[][] {
    const strategies = Object.keys(returns);
    const matrix: number[][] = [];

    for (let i = 0; i < strategies.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < strategies.length; j++) {
        matrix[i][j] = this.calculatePearsonCorrelation(
          returns[strategies[i]],
          returns[strategies[j]]
        );
      }
    }

    return matrix;
  }

  private calculateDiversificationScore(correlationMatrix: number[][]): number {
    const averageCorrelation = this.calculateAverageAbsoluteCorrelation(correlationMatrix);
    return 1 - averageCorrelation;
  }

  private generateRecommendations(
    risks: CorrelationRisk[],
    correlatedPairs: CorrelatedPair[]
  ): string[] {
    const recommendations: string[] = [];

    if (risks.includes('HIGH_PORTFOLIO_CORRELATION')) {
      recommendations.push('Consider reducing position sizes across correlated strategies');
    }

    if (correlatedPairs.length > 0) {
      recommendations.push('Review and potentially adjust parameters for highly correlated strategies');
    }

    return recommendations;
  }
}