import { IndicatorService } from './indicator-service';
import { TechnicalIndicators } from './technical-indicators';

// Export singleton instances
export const indicatorService = IndicatorService.getInstance();
export const technicalIndicators = new TechnicalIndicators();

// Export types and classes
export type { IndicatorConfig, IndicatorResult } from './types';
export { IndicatorService };
export { TechnicalIndicators };
