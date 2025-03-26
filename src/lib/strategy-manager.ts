export class StrategyManager {
  private availableTemplates: Strategy[] = [];

  async loadStrategyTemplates(): Promise<Strategy[]> {
    const capabilities = exchangeService.getExchangeCapabilities();
    if (!capabilities) return [];

    // Fetch all templates
    const templates = await this.fetchTemplatesFromDB();

    // Filter templates based on exchange capabilities
    this.availableTemplates = templates.filter(template => {
      const config = template.strategy_config;
      
      // Check if required market type is supported
      if (config.marketType === 'margin' && !capabilities.supportsMarginTrading) {
        return false;
      }
      if (config.marketType === 'futures' && !capabilities.supportsFuturesTrading) {
        return false;
      }

      // Check if required order types are supported
      const requiredOrderTypes = config.orderTypes || [];
      if (!requiredOrderTypes.every(type => 
        capabilities.supportedOrderTypes.includes(type))) {
        return false;
      }

      return true;
    });

    return this.availableTemplates;
  }

  async validateStrategyConfig(config: StrategyConfig): Promise<boolean> {
    const capabilities = exchangeService.getExchangeCapabilities();
    if (!capabilities) return false;

    // Validate market pairs
    const availablePairs = exchangeService.getAvailableMarketPairs();
    const validPairs = config.assets.every(asset => 
      availablePairs.some(pair => 
        pair.type === config.marketType && 
        pair.isActive && 
        `${pair.base}_${pair.quote}` === asset
      )
    );

    if (!validPairs) return false;

    // Validate wallet type
    if (config.marketType === 'margin' && !capabilities.supportsMarginTrading) {
      return false;
    }
    if (config.marketType === 'futures' && !capabilities.supportsFuturesTrading) {
      return false;
    }

    return true;
  }
}