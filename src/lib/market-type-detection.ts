import { logService } from './log-service';
import type { MarketType } from './types';

/**
 * Detects market type from a strategy description or prompt
 * @param text The strategy description or prompt text
 * @returns The detected market type or 'spot' as default
 */
export function detectMarketType(text: string): MarketType {
  if (!text) return 'spot';
  
  const lowerText = text.toLowerCase();
  
  // Check for explicit market type mentions
  if (lowerText.includes('futures market') || 
      lowerText.includes('futures trading') || 
      lowerText.includes('trade futures') ||
      lowerText.includes('futures contract') ||
      lowerText.includes('perpetual futures') ||
      lowerText.includes('perpetual contract') ||
      lowerText.includes('with leverage') && lowerText.includes('futures') ||
      /\bfutures\b/.test(lowerText)) {
    return 'futures';
  }
  
  if (lowerText.includes('margin trading') || 
      lowerText.includes('trade on margin') || 
      lowerText.includes('margin account') ||
      lowerText.includes('with leverage') && !lowerText.includes('futures') ||
      lowerText.includes('leveraged trading') ||
      lowerText.includes('margin position') ||
      /\bmargin\b/.test(lowerText)) {
    return 'margin';
  }
  
  if (lowerText.includes('spot market') || 
      lowerText.includes('spot trading') || 
      lowerText.includes('trade spot') ||
      lowerText.includes('spot exchange') ||
      /\bspot\b/.test(lowerText)) {
    return 'spot';
  }
  
  // Check for leverage mentions without explicit market type
  if (lowerText.includes('leverage') || 
      lowerText.includes('leveraged') ||
      lowerText.match(/\d+x\s*(leverage|leveraged)/i)) {
    // Default to futures for leverage mentions without specific market type
    return 'futures';
  }
  
  // Check for short selling which implies margin or futures
  if ((lowerText.includes('short') || lowerText.includes('shorting')) &&
      (lowerText.includes('position') || lowerText.includes('selling') || lowerText.includes('trade'))) {
    // Default to margin for short selling without specific market type
    return 'margin';
  }
  
  // Default to spot if no market type is detected
  return 'spot';
}

/**
 * Validates if a market type is supported
 * @param marketType The market type to validate
 * @returns True if the market type is supported, false otherwise
 */
export function isValidMarketType(marketType: string): boolean {
  return ['spot', 'margin', 'futures'].includes(marketType);
}

/**
 * Normalizes a market type string to a valid MarketType
 * @param marketType The market type string to normalize
 * @returns A valid MarketType or 'spot' as default
 */
export function normalizeMarketType(marketType: string): MarketType {
  if (!marketType) return 'spot';
  
  const normalized = marketType.toLowerCase().trim();
  
  if (isValidMarketType(normalized)) {
    return normalized as MarketType;
  }
  
  // Try to match partial or similar strings
  if (normalized.startsWith('fut') || normalized.includes('perp')) {
    return 'futures';
  }
  
  if (normalized.startsWith('mar') || normalized.includes('lever')) {
    return 'margin';
  }
  
  if (normalized.startsWith('spo')) {
    return 'spot';
  }
  
  // Log unrecognized market type
  logService.log('warn', `Unrecognized market type: ${marketType}, defaulting to 'spot'`, null, 'MarketTypeDetection');
  
  // Default to spot
  return 'spot';
}

/**
 * Gets the appropriate leverage range for a market type
 * @param marketType The market type
 * @returns An object with min and max leverage values
 */
export function getLeverageRangeForMarketType(marketType: MarketType): { min: number, max: number } {
  switch (marketType) {
    case 'futures':
      return { min: 1, max: 125 }; // Binance futures allows up to 125x on some pairs
    case 'margin':
      return { min: 1, max: 10 }; // Binance margin typically allows up to 10x
    case 'spot':
    default:
      return { min: 1, max: 1 }; // No leverage for spot
  }
}

/**
 * Determines if a market type supports short positions
 * @param marketType The market type
 * @returns True if short positions are supported, false otherwise
 */
export function supportsShortPositions(marketType: MarketType): boolean {
  return marketType === 'margin' || marketType === 'futures';
}

/**
 * Determines if a market type supports leverage
 * @param marketType The market type
 * @returns True if leverage is supported, false otherwise
 */
export function supportsLeverage(marketType: MarketType): boolean {
  return marketType === 'margin' || marketType === 'futures';
}
