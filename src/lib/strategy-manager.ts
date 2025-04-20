import { riskManagementService } from './risk-management-service';
import { exchangeService } from './exchange-service';
import { logService } from './log-service';
import type { Strategy, StrategyConfig } from './types';

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

  async validateStrategyConfig(config: StrategyConfig): Promise<{ valid: boolean; reason?: string }> {
    const capabilities = exchangeService.getExchangeCapabilities();
    if (!capabilities) return { valid: false, reason: 'Exchange capabilities not available' };

    // Validate market pairs
    const availablePairs = exchangeService.getAvailableMarketPairs();
    const validPairs = config.assets.every(asset =>
      availablePairs.some(pair =>
        pair.type === config.marketType &&
        pair.isActive &&
        `${pair.base}_${pair.quote}` === asset
      )
    );

    if (!validPairs) return { valid: false, reason: 'One or more selected trading pairs are not available for this market type' };

    // Validate wallet type
    if (config.marketType === 'margin' && !capabilities.supportsMarginTrading) {
      return { valid: false, reason: 'Margin trading is not supported by the current exchange' };
    }
    if (config.marketType === 'futures' && !capabilities.supportsFuturesTrading) {
      return { valid: false, reason: 'Futures trading is not supported by the current exchange' };
    }

    // Validate margin and leverage settings
    if (config.marketType === 'margin' || config.marketType === 'futures') {
      // Use the first asset for validation (we've already validated that all assets are valid)
      const symbol = config.assets[0];

      // Get leverage and margin settings
      const leverage = config.marketType === 'futures' ? config.leverage : undefined;
      const marginRatio = config.marketType === 'margin' ? config.marginRatio : undefined;

      // Validate against exchange limits and risk level
      const marginLeverageValidation = await riskManagementService.validateMarginAndLeverage(
        symbol,
        config.marketType,
        config.riskLevel,
        leverage,
        marginRatio
      );

      if (!marginLeverageValidation.valid) {
        return {
          valid: false,
          reason: marginLeverageValidation.reason || 'Invalid margin or leverage settings'
        };
      }
    }

    return { valid: true };
  }
}