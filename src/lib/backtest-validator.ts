class BacktestValidator {
  private readonly MIN_TRADES = 30;
  private readonly MIN_WIN_RATE = 0.4;
  private readonly MAX_DRAWDOWN = 0.25;
  private readonly MIN_SHARPE_RATIO = 0.5;
  private readonly MIN_PROFIT_FACTOR = 1.2;

  async validateBacktestResults(
    results: BacktestResults,
    strategy: Strategy
  ): Promise<ValidationReport> {
    try {
      const validations: ValidationCheck[] = [];
      let isValid = true;

      // Validate minimum number of trades
      validations.push(this.validateTradeCount(results.trades));

      // Validate win rate
      validations.push(this.validateWinRate(results));

      // Validate drawdown
      validations.push(this.validateDrawdown(results));

      // Validate risk metrics
      validations.push(this.validateRiskMetrics(results));

      // Validate for overfitting
      validations.push(await this.checkForOverfitting(results, strategy));

      // Validate consistency across different market regimes
      validations.push(await this.validateMarketRegimePerformance(results));

      // Check if any critical validations failed
      isValid = validations.every(v => !v.isCritical || v.passed);

      const recommendations = this.generateRecommendations(validations, results);

      return {
        isValid,
        validations,
        recommendations,
        riskScore: this.calculateRiskScore(validations),
        confidenceScore: this.calculateConfidenceScore(validations, results)
      };
    } catch (error) {
      logService.log('error', 'Error validating backtest results', error, 'BacktestValidator');
      throw error;
    }
  }

  private validateTradeCount(trades: Trade[]): ValidationCheck {
    return {
      name: 'Minimum Trade Count',
      passed: trades.length >= this.MIN_TRADES,
      isCritical: true,
      details: `Strategy executed ${trades.length} trades (minimum ${this.MIN_TRADES} required)`
    };
  }

  private async checkForOverfitting(
    results: BacktestResults,
    strategy: Strategy
  ): Promise<ValidationCheck> {
    // Perform walk-forward analysis
    const walkForwardResults = await this.performWalkForwardAnalysis(results, strategy);
    
    // Calculate consistency score between in-sample and out-of-sample results
    const consistencyScore = this.calculateConsistencyScore(
      results,
      walkForwardResults
    );

    return {
      name: 'Overfitting Check',
      passed: consistencyScore >= 0.7,
      isCritical: true,
      details: `Strategy consistency score: ${(consistencyScore * 100).toFixed(1)}%`
    };
  }

  private async validateMarketRegimePerformance(
    results: BacktestResults
  ): Promise<ValidationCheck> {
    const regimePerformance = await this.analyzeRegimePerformance(results);
    const isConsistent = this.evaluateRegimeConsistency(regimePerformance);

    return {
      name: 'Market Regime Consistency',
      passed: isConsistent,
      isCritical: false,
      details: `Strategy performance across different market regimes: ${
        isConsistent ? 'Consistent' : 'Inconsistent'
      }`
    };
  }

  private calculateRiskScore(validations: ValidationCheck[]): number {
    const weights = {
      'Drawdown': 0.3,
      'Risk Metrics': 0.3,
      'Market Regime Consistency': 0.2,
      'Overfitting Check': 0.2
    };

    return validations.reduce((score, validation) => {
      const weight = weights[validation.name] || 0;
      return score + (validation.passed ? weight : 0);
    }, 0);
  }

  private generateRecommendations(
    validations: ValidationCheck[],
    results: BacktestResults
  ): string[] {
    const recommendations: string[] = [];

    validations.forEach(validation => {
      if (!validation.passed) {
        recommendations.push(this.getRecommendationForFailedValidation(validation, results));
      }
    });

    return recommendations;
  }
}