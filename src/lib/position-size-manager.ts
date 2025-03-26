class PositionSizeManager {
  private readonly VOLATILITY_WEIGHT = 0.3;
  private readonly CORRELATION_WEIGHT = 0.2;
  private readonly MARKET_REGIME_WEIGHT = 0.5;

  async calculateAdaptivePositionSize(
    strategy: Strategy,
    marketData: MarketData,
    portfolioState: PortfolioState
  ): Promise<number> {
    try {
      // Get base position size from strategy config
      const baseSize = this.getBasePositionSize(strategy);
      
      // Calculate adjustment factors
      const volatilityFactor = await this.calculateVolatilityAdjustment(marketData);
      const correlationFactor = await this.calculateCorrelationAdjustment(strategy, portfolioState);
      const marketRegimeFactor = await this.calculateMarketRegimeAdjustment(marketData);

      // Combine factors with weights
      const adjustmentMultiplier = 
        (volatilityFactor * this.VOLATILITY_WEIGHT) +
        (correlationFactor * this.CORRELATION_WEIGHT) +
        (marketRegimeFactor * this.MARKET_REGIME_WEIGHT);

      // Calculate final position size
      let adaptiveSize = baseSize * adjustmentMultiplier;

      // Apply safety limits
      adaptiveSize = this.applyPositionSizeLimits(adaptiveSize, strategy, portfolioState);

      logService.log('info', 'Calculated adaptive position size', {
        baseSize,
        volatilityFactor,
        correlationFactor,
        marketRegimeFactor,
        finalSize: adaptiveSize
      }, 'PositionSizeManager');

      return adaptiveSize;
    } catch (error) {
      logService.log('error', 'Error calculating adaptive position size', error, 'PositionSizeManager');
      return this.getBasePositionSize(strategy);
    }
  }

  private async calculateVolatilityAdjustment(marketData: MarketData): Promise<number> {
    const currentVolatility = await this.calculateRecentVolatility(marketData);
    const historicalVolatility = await this.calculateHistoricalVolatility(marketData);
    
    // Reduce position size in high volatility environments
    return historicalVolatility / Math.max(currentVolatility, historicalVolatility);
  }

  private async calculateCorrelationAdjustment(
    strategy: Strategy,
    portfolioState: PortfolioState
  ): Promise<number> {
    const correlations = await this.calculatePortfolioCorrelations(strategy, portfolioState);
    const averageCorrelation = correlations.reduce((sum, corr) => sum + Math.abs(corr), 0) / 
                              Math.max(correlations.length, 1);
    
    // Reduce position size when correlation with portfolio is high
    return 1 - (averageCorrelation * 0.5);
  }

  private async calculateMarketRegimeAdjustment(marketData: MarketData): Promise<number> {
    const regime = await marketRegimeDetector.detectRegime(marketData);
    
    const regimeMultipliers = {
      'TRENDING': 1.2,
      'RANGING': 1.0,
      'VOLATILE': 0.7,
      'UNCERTAIN': 0.5
    };

    return regimeMultipliers[regime.type] || 1.0;
  }

  private applyPositionSizeLimits(
    size: number,
    strategy: Strategy,
    portfolioState: PortfolioState
  ): number {
    const maxSize = strategy.strategy_config.trade_parameters.max_position_size;
    const portfolioLimit = portfolioState.available_balance * 0.2; // Max 20% of portfolio
    
    return Math.min(size, maxSize, portfolioLimit);
  }
}